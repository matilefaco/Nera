import http from 'node:http';
import crypto from 'node:crypto';

// Configuration from environment
const PORT = parseInt(process.env.PORT || '8080', 10);
const WAHA_BASE_URL = (process.env.WAHA_BASE_URL || 'http://waha:3000').replace(/\/+$/, '');
const WAHA_SESSION = process.env.WAHA_SESSION || 'default';
const WAHA_API_KEY = process.env.WAHA_API_KEY || '';
const WAHA_WEBHOOK_HMAC_KEY = process.env.WAHA_WEBHOOK_HMAC_KEY || '';

const BRIDGE_INSTANCE_ID = process.env.BRIDGE_INSTANCE_ID || '';
const BRIDGE_INSTANCE_TOKEN = process.env.BRIDGE_INSTANCE_TOKEN || '';
const BRIDGE_CLIENT_TOKEN = process.env.BRIDGE_CLIENT_TOKEN || '';

const NERA_ZAPI_WEBHOOK_URL = process.env.NERA_ZAPI_WEBHOOK_URL || 'https://usenera.com/api/zapi/webhook';
const NERA_ZAPI_WEBHOOK_TOKEN = process.env.NERA_ZAPI_WEBHOOK_TOKEN || '';

const MAX_BODY_BYTES = 256 * 1024; // 256 KB limit
const FETCH_TIMEOUT_MS = 15000; // 15 seconds

/**
 * Mask phone numbers for privacy-safe logs (e.g. 5511999991234 -> *******1234)
 */
function maskPhone(phone) {
  if (!phone || typeof phone !== 'string') return '[NO_PHONE]';
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 4) return '****';
  return '*'.repeat(Math.max(0, digits.length - 4)) + digits.slice(-4);
}

/**
 * Constant-time string comparison to mitigate timing attacks
 */
function constantTimeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    // Hash both to avoid leaking length through timing
    const hashA = crypto.createHash('sha256').update(bufA).digest();
    const hashB = crypto.createHash('sha256').update(bufB).digest();
    crypto.timingSafeEqual(hashA, hashB);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Helper to read raw request body with size limit
 */
function readBody(req, maxBytes = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;

    req.on('data', (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > maxBytes) {
        req.destroy();
        const err = new Error('Payload Too Large');
        err.statusCode = 413;
        reject(err);
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    req.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Send JSON response
 */
function sendJson(res, statusCode, data) {
  const jsonStr = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(jsonStr, 'utf8')
  });
  res.end(jsonStr);
}

/**
 * Normalize phone to digits only
 */
function normalizeDigits(phone) {
  if (!phone || typeof phone !== 'string') return '';
  return phone.replace(/\D/g, '');
}

/**
 * Check if contact exists on WhatsApp via WAHA check-exists API
 */
async function checkContactExists(phone, session = WAHA_SESSION) {
  const normalized = normalizeDigits(phone);
  if (!normalized) return { exists: false, error: 'invalid_phone' };

  try {
    const checkUrl = `${WAHA_BASE_URL}/api/contacts/check-exists?phone=${encodeURIComponent(normalized)}&session=${encodeURIComponent(session)}`;
    const response = await fetch(checkUrl, {
      method: 'GET',
      headers: {
        ...(WAHA_API_KEY ? { 'X-Api-Key': WAHA_API_KEY } : {})
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    });

    if (response.ok) {
      const data = await response.json();
      // WAHA check-exists returns { numberExists: boolean, chatId?: string } or { exists: boolean, id?: string }
      const exists = data.numberExists ?? data.exists ?? false;
      const chatId = data.chatId || data.id || (exists ? `${normalized}@c.us` : null);
      return { exists, chatId };
    }

    // If endpoint returned 404/not found or error status
    if (response.status === 404) {
      return { exists: false, error: 'not_found' };
    }

    console.warn(`[WAHA_CHECK_EXISTS] Unexpected status ${response.status} for ${maskPhone(normalized)}. Applying fallback.`);
    // Fallback on non-fatal technical error
    return { exists: true, chatId: `${normalized}@c.us`, fallback: true };
  } catch (err) {
    console.warn(`[WAHA_CHECK_EXISTS] Network/timeout error for ${maskPhone(normalized)}: ${err.message}. Applying fallback.`);
    return { exists: true, chatId: `${normalized}@c.us`, fallback: true };
  }
}

/**
 * Resolve @lid to standard phone number via WAHA LID resolution endpoint
 */
async function resolveLidToPhone(lid, session = WAHA_SESSION) {
  try {
    // Attempt standard WAHA lid lookup endpoints
    const lidUrl = `${WAHA_BASE_URL}/api/${encodeURIComponent(session)}/lids/${encodeURIComponent(lid)}`;
    let response = await fetch(lidUrl, {
      method: 'GET',
      headers: {
        ...(WAHA_API_KEY ? { 'X-Api-Key': WAHA_API_KEY } : {})
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    });

    if (!response.ok) {
      // Fallback endpoint in some WAHA builds: /api/contacts/{lid}
      const altUrl = `${WAHA_BASE_URL}/api/contacts/${encodeURIComponent(lid)}?session=${encodeURIComponent(session)}`;
      response = await fetch(altUrl, {
        method: 'GET',
        headers: {
          ...(WAHA_API_KEY ? { 'X-Api-Key': WAHA_API_KEY } : {})
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
      });
    }

    if (response.ok) {
      const data = await response.json();
      const phoneCandidate = data.pn || data.phone || data.number || (data.id && typeof data.id === 'object' ? data.id.user : data.id);
      const digits = normalizeDigits(String(phoneCandidate || ''));
      if (digits && digits.length >= 8) {
        return digits;
      }
    }
  } catch (err) {
    console.warn(`[WAHA_LID_RESOLVE] Error resolving lid: ${err.message}`);
  }
  return null;
}

/**
 * Handle Outbound Message: POST /instances/:instanceId/token/:token/send-text
 */
async function handleSendText(req, res, pathParts) {
  const instanceId = pathParts[1];
  const token = pathParts[3];

  // 1. Authenticate instance & token
  const isInstanceValid = BRIDGE_INSTANCE_ID ? constantTimeCompare(instanceId, BRIDGE_INSTANCE_ID) : true;
  const isTokenValid = BRIDGE_INSTANCE_TOKEN ? constantTimeCompare(token, BRIDGE_INSTANCE_TOKEN) : true;

  const clientTokenHeader = req.headers['client-token'] || req.headers['x-client-token'] || '';
  const isClientTokenValid = BRIDGE_CLIENT_TOKEN ? constantTimeCompare(String(clientTokenHeader), BRIDGE_CLIENT_TOKEN) : true;

  if (!isInstanceValid || !isTokenValid || !isClientTokenValid) {
    console.warn('[OUTBOUND_AUTH_FAILED] Invalid credentials received.');
    return sendJson(res, 401, { error: 'Unauthorized: Invalid credentials or token' });
  }

  // 2. Read and parse body
  let rawBody;
  try {
    rawBody = await readBody(req);
  } catch (err) {
    return sendJson(res, err.statusCode || 400, { error: err.message });
  }

  let body;
  try {
    body = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return sendJson(res, 400, { error: 'Invalid JSON payload' });
  }

  const { phone, message } = body;
  if (!phone || !message) {
    return sendJson(res, 400, { error: 'Missing required fields: phone, message' });
  }

  const normalizedPhone = normalizeDigits(phone);
  if (!normalizedPhone || normalizedPhone.length < 8) {
    return sendJson(res, 400, { error: 'Invalid phone number format' });
  }

  // 3. Verify number existence via WAHA check-exists
  const contactCheck = await checkContactExists(normalizedPhone, WAHA_SESSION);
  if (contactCheck.exists === false) {
    console.warn(`[OUTBOUND_NOT_ON_WA] Number ${maskPhone(normalizedPhone)} does not exist on WhatsApp.`);
    return sendJson(res, 400, {
      error: 'number_not_on_whatsapp',
      message: 'Phone number is not registered on WhatsApp'
    });
  }

  const chatId = contactCheck.chatId || `${normalizedPhone}@c.us`;

  // 4. Send text via WAHA
  try {
    const sendUrl = `${WAHA_BASE_URL}/api/sendText`;
    const wahaResponse = await fetch(sendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(WAHA_API_KEY ? { 'X-Api-Key': WAHA_API_KEY } : {})
      },
      body: JSON.stringify({
        session: WAHA_SESSION,
        chatId,
        text: message
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    });

    if (wahaResponse.ok) {
      const result = await wahaResponse.json().catch(() => ({}));
      const msgId = result.id || result.messageId || `waha-${Date.now()}`;
      console.log(`[OUTBOUND_SUCCESS] Message sent to ${maskPhone(normalizedPhone)}`);
      return sendJson(res, 200, {
        zaapId: msgId,
        messageId: msgId,
        id: msgId,
        success: true
      });
    }

    const errText = await wahaResponse.text().catch(() => 'Unknown WAHA error');
    console.error(`[OUTBOUND_ERROR] WAHA returned status ${wahaResponse.status}`);
    return sendJson(res, 502, {
      error: 'Failed to send message via WAHA',
      status: wahaResponse.status,
      details: errText
    });
  } catch (err) {
    console.error(`[OUTBOUND_ERROR] Error connecting to WAHA: ${err.message}`);
    return sendJson(res, 502, {
      error: 'WAHA connection failed',
      message: err.message
    });
  }
}

/**
 * Handle Inbound Webhook: POST /webhook/waha
 */
async function handleWahaWebhook(req, res) {
  // 1. Read raw body
  let rawBody;
  try {
    rawBody = await readBody(req);
  } catch (err) {
    return sendJson(res, err.statusCode || 400, { error: err.message });
  }

  // 2. Validate HMAC if secret is configured
  if (WAHA_WEBHOOK_HMAC_KEY) {
    const signature = req.headers['x-webhook-hmac'] || '';
    const algorithm = (req.headers['x-webhook-hmac-algorithm'] || '').toLowerCase();

    if (algorithm !== 'sha512' && algorithm !== 'sha-512') {
      console.warn('[HMAC_INVALID] Unsupported or missing HMAC algorithm header');
      return sendJson(res, 401, { error: 'Invalid or unsupported HMAC algorithm' });
    }

    const expectedHmac = crypto
      .createHmac('sha512', WAHA_WEBHOOK_HMAC_KEY)
      .update(rawBody)
      .digest('hex');

    if (!constantTimeCompare(signature, expectedHmac)) {
      console.warn('[HMAC_INVALID] Signature verification failed');
      return sendJson(res, 401, { error: 'Invalid HMAC signature' });
    }
  }

  // 3. Parse JSON
  let eventPayload;
  try {
    eventPayload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return sendJson(res, 400, { error: 'Invalid JSON payload' });
  }

  // 4. Filter events: only process 'message'
  const eventName = eventPayload.event;
  if (eventName !== 'message') {
    return sendJson(res, 200, { status: 'ignored', reason: 'unsupported_event' });
  }

  const messageData = eventPayload.payload || {};

  // Ignore messages sent by ourselves
  if (messageData.fromMe === true || eventPayload.fromMe === true) {
    return sendJson(res, 200, { status: 'ignored', reason: 'from_me' });
  }

  const fromRaw = String(messageData.from || messageData.participant || messageData.author || '');

  // Ignore groups, broadcasts, status, newsletters/channels
  if (
    fromRaw.includes('@g.us') ||
    fromRaw.includes('@broadcast') ||
    fromRaw.includes('status@') ||
    fromRaw.includes('@newsletter')
  ) {
    return sendJson(res, 200, { status: 'ignored', reason: 'non_direct_chat' });
  }

  // 5. Resolve phone number
  let senderPhone = '';
  if (fromRaw.endsWith('@c.us') || fromRaw.endsWith('@s.whatsapp.net')) {
    senderPhone = normalizeDigits(fromRaw.split('@')[0]);
  } else if (fromRaw.endsWith('@lid')) {
    const sessionName = eventPayload.session || WAHA_SESSION;
    senderPhone = await resolveLidToPhone(fromRaw, sessionName);
    if (!senderPhone) {
      console.warn('[INBOUND_SKIPPED] Unresolved @lid sender.');
      return sendJson(res, 200, { status: 'skipped', reason: 'unresolved_lid' });
    }
  } else {
    senderPhone = normalizeDigits(fromRaw);
  }

  if (!senderPhone || senderPhone.length < 8) {
    return sendJson(res, 200, { status: 'skipped', reason: 'invalid_sender_phone' });
  }

  // Extract text body
  const messageText = messageData.body || messageData.text || messageData.caption || '';
  if (!messageText || typeof messageText !== 'string' || messageText.trim() === '') {
    return sendJson(res, 200, { status: 'skipped', reason: 'empty_text' });
  }

  const messageId = messageData.id || eventPayload.id || `waha-${Date.now()}`;

  // 6. Build Z-API compatible payload for Nera's handleInboundMessage
  const zapiPayload = {
    type: 'on-message-received',
    phone: senderPhone,
    text: {
      message: messageText.trim()
    },
    messageId,
    provider: 'waha',
    session: eventPayload.session || WAHA_SESSION
  };

  // 7. Forward to Nera's webhook
  try {
    const forwardHeaders = {
      'Content-Type': 'application/json'
    };

    if (NERA_ZAPI_WEBHOOK_TOKEN) {
      forwardHeaders['client-token'] = NERA_ZAPI_WEBHOOK_TOKEN;
      forwardHeaders['x-zapi-token'] = NERA_ZAPI_WEBHOOK_TOKEN;
    }

    const neraResponse = await fetch(NERA_ZAPI_WEBHOOK_URL, {
      method: 'POST',
      headers: forwardHeaders,
      body: JSON.stringify(zapiPayload),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    });

    if (neraResponse.ok) {
      console.log(`[INBOUND_FORWARDED] Forwarded message from ${maskPhone(senderPhone)} to Nera (${neraResponse.status})`);
      return sendJson(res, 200, { status: 'forwarded' });
    }

    console.warn(`[INBOUND_FORWARD_WARN] Nera returned status ${neraResponse.status} for ${maskPhone(senderPhone)}`);
    return sendJson(res, 200, { status: 'forward_attempted', neraStatus: neraResponse.status });
  } catch (err) {
    console.error(`[INBOUND_FORWARD_ERROR] Failed forwarding to Nera: ${err.message}`);
    return sendJson(res, 502, { error: 'Failed to forward webhook to Nera' });
  }
}

/**
 * Main HTTP Server Request Router
 */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname.replace(/\/+$/, '') || '/';
  const method = req.method.toUpperCase();

  // Health check endpoint
  if (method === 'GET' && pathname === '/healthz') {
    return sendJson(res, 200, {
      ok: true,
      service: 'nera-waha-zapi-bridge'
    });
  }

  // Outbound sendText route: /instances/:instanceId/token/:token/send-text
  const sendTextMatch = pathname.match(/^\/instances\/([^/]+)\/token\/([^/]+)\/send-text$/);
  if (method === 'POST' && sendTextMatch) {
    return handleSendText(req, res, pathname.split('/'));
  }

  // Inbound webhook from WAHA: /webhook/waha
  if (method === 'POST' && pathname === '/webhook/waha') {
    return handleWahaWebhook(req, res);
  }

  // Fallback 404
  return sendJson(res, 404, { error: 'Not Found' });
});

// Start listening
if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[NERA_WAHA_BRIDGE] Listening on port ${PORT}`);
  });
}

export { server, handleSendText, handleWahaWebhook, readBody, checkContactExists, resolveLidToPhone, maskPhone, constantTimeCompare };
