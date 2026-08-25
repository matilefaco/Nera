import http from 'node:http';
import crypto from 'node:crypto';

const PORT = Number(process.env.PORT || 8080);
const WAHA_BASE_URL = (process.env.WAHA_BASE_URL || 'http://waha:3000').replace(/\/+$/, '');
const WAHA_API_KEY = process.env.WAHA_API_KEY || '';
const WAHA_SESSION = process.env.WAHA_SESSION || 'default';
const WAHA_WEBHOOK_HMAC_KEY = process.env.WAHA_WEBHOOK_HMAC_KEY || '';

const BRIDGE_INSTANCE_ID = process.env.BRIDGE_INSTANCE_ID || '';
const BRIDGE_INSTANCE_TOKEN = process.env.BRIDGE_INSTANCE_TOKEN || '';
const BRIDGE_CLIENT_TOKEN = process.env.BRIDGE_CLIENT_TOKEN || '';

const NERA_ZAPI_WEBHOOK_URL = process.env.NERA_ZAPI_WEBHOOK_URL || '';
const NERA_ZAPI_WEBHOOK_TOKEN = process.env.NERA_ZAPI_WEBHOOK_TOKEN || '';

const MAX_BODY_BYTES = 256 * 1024;

function requireEnv(name, value) {
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
}

[
  ['WAHA_API_KEY', WAHA_API_KEY],
  ['WAHA_WEBHOOK_HMAC_KEY', WAHA_WEBHOOK_HMAC_KEY],
  ['BRIDGE_INSTANCE_ID', BRIDGE_INSTANCE_ID],
  ['BRIDGE_INSTANCE_TOKEN', BRIDGE_INSTANCE_TOKEN],
  ['BRIDGE_CLIENT_TOKEN', BRIDGE_CLIENT_TOKEN],
  ['NERA_ZAPI_WEBHOOK_URL', NERA_ZAPI_WEBHOOK_URL],
  ['NERA_ZAPI_WEBHOOK_TOKEN', NERA_ZAPI_WEBHOOK_TOKEN],
].forEach(([name, value]) => requireEnv(name, value));

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  });
  res.end(body);
}

async function readRawBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) throw new Error('request_body_too_large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ''), 'utf8');
  const bb = Buffer.from(String(b || ''), 'utf8');
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function verifyWahaHmac(rawBody, signature) {
  const expected = crypto
    .createHmac('sha512', WAHA_WEBHOOK_HMAC_KEY)
    .update(rawBody)
    .digest('hex');
  return safeEqual(expected, signature);
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function wahaHeaders(extra = {}) {
  return {
    accept: 'application/json',
    'x-api-key': WAHA_API_KEY,
    ...extra,
  };
}

async function resolveOutboundChatId(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) throw new Error('invalid_phone');

  // WAHA explicitly recommends check-exists for Brazilian numbers because the
  // historical extra 9-digit convention can make a hand-built @c.us id wrong.
  try {
    const url = new URL(`${WAHA_BASE_URL}/api/contacts/check-exists`);
    url.searchParams.set('phone', normalized);
    url.searchParams.set('session', WAHA_SESSION);

    const response = await fetch(url, {
      headers: wahaHeaders(),
      signal: AbortSignal.timeout(10_000),
    });

    if (response.ok) {
      const result = await response.json();
      if (result?.numberExists === false) throw new Error('number_not_on_whatsapp');
      if (typeof result?.chatId === 'string' && result.chatId) return result.chatId;
      if (typeof result?.pn === 'string' && result.pn) return result.pn;
    } else {
      console.warn(`[CONTACT_CHECK] WAHA returned ${response.status}; falling back to @c.us`);
    }
  } catch (error) {
    if (error?.message === 'number_not_on_whatsapp') throw error;
    console.warn('[CONTACT_CHECK] failed; falling back to @c.us', error?.message || error);
  }

  return `${normalized}@c.us`;
}

async function resolveInboundPhone(chatId, sessionName) {
  if (typeof chatId !== 'string' || !chatId) return null;

  if (chatId.endsWith('@c.us') || chatId.endsWith('@s.whatsapp.net')) {
    return normalizePhone(chatId.split('@')[0]);
  }

  if (!chatId.endsWith('@lid')) return null;

  try {
    const session = encodeURIComponent(sessionName || WAHA_SESSION);
    const lid = encodeURIComponent(chatId);
    const response = await fetch(`${WAHA_BASE_URL}/api/${session}/lids/${lid}`, {
      headers: wahaHeaders(),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      console.warn(`[LID_RESOLVE] WAHA returned ${response.status} for inbound LID`);
      return null;
    }

    const result = await response.json();
    if (typeof result?.pn !== 'string' || !result.pn) return null;
    return normalizePhone(result.pn.split('@')[0]);
  } catch (error) {
    console.warn('[LID_RESOLVE] failed', error?.message || error);
    return null;
  }
}

async function sendViaWaha(phone, message) {
  const chatId = await resolveOutboundChatId(phone);

  const response = await fetch(`${WAHA_BASE_URL}/api/sendText`, {
    method: 'POST',
    headers: wahaHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify({
      session: WAHA_SESSION,
      chatId,
      text: String(message || ''),
    }),
    signal: AbortSignal.timeout(15_000),
  });

  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }

  if (!response.ok) {
    throw new Error(`WAHA ${response.status}: ${text.slice(0, 500)}`);
  }

  return payload;
}

async function forwardInboundToNera(event) {
  const payload = event?.payload || {};

  if (event?.event !== 'message') return { skipped: 'not_message_event' };
  if (payload.fromMe) return { skipped: 'from_me' };
  if (typeof payload.body !== 'string' || !payload.body.trim()) return { skipped: 'empty_body' };

  const phone = await resolveInboundPhone(payload.from, event.session || WAHA_SESSION);
  if (!phone) return { skipped: 'non_direct_or_unresolved_sender' };

  const zapiCompatiblePayload = {
    type: 'on-message-received',
    phone,
    text: { message: payload.body },
    messageId: payload.id || event.id || null,
    provider: 'waha',
    session: event.session || WAHA_SESSION,
  };

  const response = await fetch(NERA_ZAPI_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-zapi-token': NERA_ZAPI_WEBHOOK_TOKEN,
      'x-nera-whatsapp-provider': 'waha',
    },
    body: JSON.stringify(zapiCompatiblePayload),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Nera webhook ${response.status}: ${body.slice(0, 500)}`);
  }

  return { forwarded: true };
}

async function handle(req, res) {
  const url = new URL(req.url, 'http://bridge.local');

  if (req.method === 'GET' && url.pathname === '/healthz') {
    return json(res, 200, { ok: true, service: 'nera-waha-zapi-bridge' });
  }

  const outboundMatch = url.pathname.match(/^\/instances\/([^/]+)\/token\/([^/]+)\/send-text$/);
  if (req.method === 'POST' && outboundMatch) {
    const [, instanceId, instanceToken] = outboundMatch;
    const clientToken = req.headers['client-token'];

    if (
      !safeEqual(instanceId, BRIDGE_INSTANCE_ID) ||
      !safeEqual(instanceToken, BRIDGE_INSTANCE_TOKEN) ||
      !safeEqual(clientToken, BRIDGE_CLIENT_TOKEN)
    ) {
      return json(res, 401, { error: 'unauthorized' });
    }

    try {
      const rawBody = await readRawBody(req);
      const body = JSON.parse(rawBody.toString('utf8') || '{}');
      if (!body.phone || typeof body.message !== 'string') {
        return json(res, 400, { error: 'phone_and_message_required' });
      }

      const result = await sendViaWaha(body.phone, body.message);
      return json(res, 200, {
        id: result?.id || result?.key?.id || null,
        messageId: result?.id || result?.key?.id || null,
        provider: 'waha',
      });
    } catch (error) {
      console.error('[OUTBOUND_ERROR]', error?.message || error);
      return json(res, 502, {
        error: error?.message === 'number_not_on_whatsapp' ? 'number_not_on_whatsapp' : 'waha_send_failed',
      });
    }
  }

  if (req.method === 'POST' && url.pathname === '/webhook/waha') {
    try {
      const rawBody = await readRawBody(req);
      const signature = req.headers['x-webhook-hmac'];
      const algorithm = String(req.headers['x-webhook-hmac-algorithm'] || '').toLowerCase();

      if (algorithm && algorithm !== 'sha512') {
        return json(res, 401, { error: 'unsupported_hmac_algorithm' });
      }
      if (!signature || !verifyWahaHmac(rawBody, signature)) {
        return json(res, 401, { error: 'invalid_hmac' });
      }

      const event = JSON.parse(rawBody.toString('utf8') || '{}');
      const result = await forwardInboundToNera(event);
      return json(res, 200, { ok: true, ...result });
    } catch (error) {
      console.error('[INBOUND_ERROR]', error?.message || error);
      return json(res, 502, { error: 'nera_webhook_forward_failed' });
    }
  }

  return json(res, 404, { error: 'not_found' });
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((error) => {
    console.error('[UNHANDLED]', error);
    if (!res.headersSent) json(res, 500, { error: 'internal_error' });
    else res.end();
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[BOOT] Nera WAHA/Z-API compatibility bridge listening on :${PORT}`);
});
