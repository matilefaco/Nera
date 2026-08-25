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

function isDirectChatId(value) {
  return typeof value === 'string' && value.endsWith('@c.us');
}

async function sendViaWaha(phone, message) {
  const normalized = normalizePhone(phone);
  if (!normalized) throw new Error('invalid_phone');

  const response = await fetch(`${WAHA_BASE_URL}/api/sendText`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      'x-api-key': WAHA_API_KEY,
    },
    body: JSON.stringify({
      session: WAHA_SESSION,
      chatId: `${normalized}@c.us`,
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
    const error = new Error(`WAHA ${response.status}: ${text.slice(0, 500)}`);
    error.status = response.status;
    throw error;
  }

  return payload;
}

async function forwardInboundToNera(event) {
  const payload = event?.payload || {};

  if (event?.event !== 'message') return { skipped: 'not_message_event' };
  if (payload.fromMe) return { skipped: 'from_me' };
  if (!isDirectChatId(payload.from)) return { skipped: 'not_direct_chat' };
  if (typeof payload.body !== 'string' || !payload.body.trim()) return { skipped: 'empty_body' };

  const phone = payload.from.replace(/@c\.us$/, '');
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
      return json(res, 502, { error: 'waha_send_failed' });
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
