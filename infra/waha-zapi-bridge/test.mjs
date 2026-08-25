import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';

// Setup test env BEFORE importing server to pass fail-closed validation
process.env.NODE_ENV = 'test';
process.env.PORT = '0';
process.env.BRIDGE_INSTANCE_ID = 'test_instance';
process.env.BRIDGE_INSTANCE_TOKEN = 'test_token';
process.env.BRIDGE_CLIENT_TOKEN = 'test_client_token';
process.env.WAHA_API_KEY = 'test_waha_key';
process.env.WAHA_WEBHOOK_HMAC_KEY = 'test_hmac_secret';
process.env.NERA_ZAPI_WEBHOOK_TOKEN = 'test_nera_webhook_token';

// Helper to spin up a mock server
function createMockServer(handler) {
  return new Promise((resolve) => {
    const s = http.createServer(handler);
    s.listen(0, '127.0.0.1', () => {
      const port = s.address().port;
      resolve({
        server: s,
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((res) => s.close(res))
      });
    });
  });
}

test('Nera WAHA Bridge Test Suite', async (t) => {
  let mockWaha;
  let mockNera;
  let bridgeServer;
  let bridgeUrl;
  let lastWahaRequest = null;
  let lastNeraRequest = null;
  let wahaCheckExistsResponse = { numberExists: true, chatId: '5511999991234@c.us' };
  let wahaLidResponse = { pn: '5511988887777@c.us', lid: '123456789@lid' };

  // 1. Mock WAHA
  mockWaha = await createMockServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let bodyChunks = [];
    req.on('data', (c) => bodyChunks.push(c));
    req.on('end', () => {
      const rawBody = Buffer.concat(bodyChunks).toString('utf8');
      lastWahaRequest = {
        method: req.method,
        path: url.pathname,
        query: Object.fromEntries(url.searchParams),
        headers: req.headers,
        body: rawBody ? JSON.parse(rawBody) : null
      };

      if (url.pathname === '/api/contacts/check-exists') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(wahaCheckExistsResponse));
        return;
      }

      if (url.pathname.includes('/lids/')) {
        if (!wahaLidResponse) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'not_found' }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(wahaLidResponse));
        return;
      }

      if (url.pathname === '/api/sendText') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: 'msg_waha_123', success: true }));
        return;
      }

      res.writeHead(404);
      res.end();
    });
  });

  // 2. Mock Nera
  mockNera = await createMockServer((req, res) => {
    let bodyChunks = [];
    req.on('data', (c) => bodyChunks.push(c));
    req.on('end', () => {
      const rawBody = Buffer.concat(bodyChunks).toString('utf8');
      lastNeraRequest = {
        method: req.method,
        path: req.url,
        headers: req.headers,
        body: rawBody ? JSON.parse(rawBody) : null
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'OK' }));
    });
  });

  process.env.WAHA_BASE_URL = mockWaha.url;
  process.env.NERA_ZAPI_WEBHOOK_URL = `${mockNera.url}/api/zapi/webhook`;

  const { server, maskPhone, constantTimeCompare, requireEnv } = await import('./server.mjs');
  bridgeServer = server;

  await new Promise((resolve) => {
    bridgeServer.listen(0, '127.0.0.1', () => {
      bridgeUrl = `http://127.0.0.1:${bridgeServer.address().port}`;
      resolve();
    });
  });

  t.after(async () => {
    await new Promise((res) => bridgeServer.close(res));
    await mockWaha.close();
    await mockNera.close();
  });

  await t.test('Fail-Closed: requireEnv throws on missing or empty values', () => {
    assert.throws(() => requireEnv('TEST_VAR', ''), /Missing required environment variable: TEST_VAR/);
    assert.throws(() => requireEnv('TEST_VAR', undefined), /Missing required environment variable: TEST_VAR/);
    assert.throws(() => requireEnv('TEST_VAR', '   '), /Missing required environment variable: TEST_VAR/);
    assert.equal(requireEnv('TEST_VAR', 'valid_val'), 'valid_val');
  });

  await t.test('Utility functions: maskPhone and constantTimeCompare', () => {
    assert.equal(maskPhone('5511999991234'), '*********1234');
    assert.equal(maskPhone('1234'), '****');
    assert.equal(maskPhone(''), '[NO_PHONE]');
    assert.equal(constantTimeCompare('secret_token', 'secret_token'), true);
    assert.equal(constantTimeCompare('secret_token', 'wrong_token'), false);
    assert.equal(constantTimeCompare('short', 'much_longer_token'), false);
  });

  await t.test('GET /healthz returns status 200 with service name', async () => {
    const res = await fetch(`${bridgeUrl}/healthz`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.ok, true);
    assert.equal(data.service, 'nera-waha-zapi-bridge');
  });

  await t.test('Outbound: 401 on missing or incorrect auth', async () => {
    // Missing client token
    const res1 = await fetch(`${bridgeUrl}/instances/test_instance/token/test_token/send-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '5511999991234', message: 'Hello' })
    });
    assert.equal(res1.status, 401);

    // Wrong instance ID
    const res2 = await fetch(`${bridgeUrl}/instances/wrong_instance/token/test_token/send-text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': 'test_client_token'
      },
      body: JSON.stringify({ phone: '5511999991234', message: 'Hello' })
    });
    assert.equal(res2.status, 401);

    // Wrong instance token
    const res3 = await fetch(`${bridgeUrl}/instances/test_instance/token/wrong_token/send-text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': 'test_client_token'
      },
      body: JSON.stringify({ phone: '5511999991234', message: 'Hello' })
    });
    assert.equal(res3.status, 401);

    // Wrong client token
    const res4 = await fetch(`${bridgeUrl}/instances/test_instance/token/test_token/send-text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': 'wrong_client_token'
      },
      body: JSON.stringify({ phone: '5511999991234', message: 'Hello' })
    });
    assert.equal(res4.status, 401);
  });

  await t.test('Outbound: 400 on invalid body payload', async () => {
    const res = await fetch(`${bridgeUrl}/instances/test_instance/token/test_token/send-text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': 'test_client_token'
      },
      body: JSON.stringify({ phone: '5511999991234' }) // Missing message
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.match(data.error, /Missing required fields/);
  });

  await t.test('Outbound: 400 when number is not on WhatsApp', async () => {
    wahaCheckExistsResponse = { numberExists: false };
    const res = await fetch(`${bridgeUrl}/instances/test_instance/token/test_token/send-text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': 'test_client_token'
      },
      body: JSON.stringify({ phone: '5511900000000', message: 'Hello' })
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.error, 'number_not_on_whatsapp');
  });

  await t.test('Outbound: successfully extracts instanceId/token from URL and sends text via WAHA', async () => {
    wahaCheckExistsResponse = { numberExists: true, chatId: '5511999991234@c.us' };
    const res = await fetch(`${bridgeUrl}/instances/test_instance/token/test_token/send-text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': 'test_client_token'
      },
      body: JSON.stringify({ phone: '5511999991234', message: 'Olá do teste Nera' })
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.zaapId, 'msg_waha_123');

    // Verify WAHA received sendText call with X-Api-Key
    assert.equal(lastWahaRequest.path, '/api/sendText');
    assert.equal(lastWahaRequest.body.chatId, '5511999991234@c.us');
    assert.equal(lastWahaRequest.body.text, 'Olá do teste Nera');
    assert.equal(lastWahaRequest.headers['x-api-key'], 'test_waha_key');
  });

  await t.test('Inbound Webhook: 401 on missing or invalid HMAC', async () => {
    const rawPayload = JSON.stringify({ event: 'message', payload: { body: 'Sim' } });

    // Missing HMAC header
    const resMissing = await fetch(`${bridgeUrl}/webhook/waha`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: rawPayload
    });
    assert.equal(resMissing.status, 401);

    // Bad HMAC
    const resBad = await fetch(`${bridgeUrl}/webhook/waha`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-hmac': 'bad_hmac',
        'x-webhook-hmac-algorithm': 'sha512'
      },
      body: rawPayload
    });
    assert.equal(resBad.status, 401);

    // Unsupported algorithm
    const resAlgo = await fetch(`${bridgeUrl}/webhook/waha`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-hmac': 'some_hmac',
        'x-webhook-hmac-algorithm': 'sha256'
      },
      body: rawPayload
    });
    assert.equal(resAlgo.status, 401);
  });

  await t.test('Inbound Webhook: ignores non-message events and fromMe', async () => {
    const sign = (body) => crypto.createHmac('sha512', 'test_hmac_secret').update(body).digest('hex');

    // Status event
    const statusPayload = JSON.stringify({ event: 'session.status', payload: {} });
    const res1 = await fetch(`${bridgeUrl}/webhook/waha`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-hmac': sign(statusPayload),
        'x-webhook-hmac-algorithm': 'sha512'
      },
      body: statusPayload
    });
    assert.equal(res1.status, 200);
    const d1 = await res1.json();
    assert.equal(d1.reason, 'unsupported_event');

    // fromMe event
    const fromMePayload = JSON.stringify({ event: 'message', payload: { fromMe: true, body: 'Oi' } });
    const res2 = await fetch(`${bridgeUrl}/webhook/waha`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-hmac': sign(fromMePayload),
        'x-webhook-hmac-algorithm': 'sha512'
      },
      body: fromMePayload
    });
    assert.equal(res2.status, 200);
    const d2 = await res2.json();
    assert.equal(d2.reason, 'from_me');
  });

  await t.test('Inbound Webhook: ignores group and channel messages', async () => {
    const sign = (body) => crypto.createHmac('sha512', 'test_hmac_secret').update(body).digest('hex');

    const groupPayload = JSON.stringify({
      event: 'message',
      payload: {
        from: '120363024888888888@g.us',
        body: 'Sim'
      }
    });

    const res = await fetch(`${bridgeUrl}/webhook/waha`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-hmac': sign(groupPayload),
        'x-webhook-hmac-algorithm': 'sha512'
      },
      body: groupPayload
    });
    assert.equal(res.status, 200);
    const d = await res.json();
    assert.equal(d.reason, 'non_direct_chat');
  });

  await t.test('Inbound Webhook: successfully processes direct @c.us message and forwards to Nera', async () => {
    const sign = (body) => crypto.createHmac('sha512', 'test_hmac_secret').update(body).digest('hex');

    const messagePayload = JSON.stringify({
      event: 'message',
      session: 'default',
      payload: {
        id: 'waha_inbound_999',
        from: '5511999995555@c.us',
        body: 'Sim'
      }
    });

    const res = await fetch(`${bridgeUrl}/webhook/waha`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-hmac': sign(messagePayload),
        'x-webhook-hmac-algorithm': 'sha512'
      },
      body: messagePayload
    });

    assert.equal(res.status, 200);
    const d = await res.json();
    assert.equal(d.status, 'forwarded');

    // Verify Nera received formatted Z-API compatible webhook
    assert.equal(lastNeraRequest.path, '/api/zapi/webhook');
    assert.equal(lastNeraRequest.headers['client-token'], 'test_nera_webhook_token');
    assert.equal(lastNeraRequest.headers['x-zapi-token'], 'test_nera_webhook_token');
    assert.equal(lastNeraRequest.body.type, 'on-message-received');
    assert.equal(lastNeraRequest.body.phone, '5511999995555');
    assert.equal(lastNeraRequest.body.text.message, 'Sim');
    assert.equal(lastNeraRequest.body.messageId, 'waha_inbound_999');
    assert.equal(lastNeraRequest.body.provider, 'waha');
  });

  await t.test('Inbound Webhook: resolves @lid and forwards to Nera', async () => {
    const sign = (body) => crypto.createHmac('sha512', 'test_hmac_secret').update(body).digest('hex');

    wahaLidResponse = { pn: '5511988887777@c.us', lid: '123456789@lid' };
    const lidPayload = JSON.stringify({
      event: 'message',
      session: 'default',
      payload: {
        id: 'waha_lid_msg_1',
        from: '123456789@lid',
        body: '1'
      }
    });

    const res = await fetch(`${bridgeUrl}/webhook/waha`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-hmac': sign(lidPayload),
        'x-webhook-hmac-algorithm': 'sha512'
      },
      body: lidPayload
    });

    assert.equal(res.status, 200);
    const d = await res.json();
    assert.equal(d.status, 'forwarded');

    assert.equal(lastNeraRequest.body.phone, '5511988887777');
    assert.equal(lastNeraRequest.body.text.message, '1');
  });

  await t.test('Inbound Webhook: unresolvable @lid is skipped without forwarding', async () => {
    const sign = (body) => crypto.createHmac('sha512', 'test_hmac_secret').update(body).digest('hex');

    wahaLidResponse = null; // simulate unresolvable lid
    const lidPayload = JSON.stringify({
      event: 'message',
      session: 'default',
      payload: {
        id: 'waha_lid_unresolved',
        from: '999999999@lid',
        body: '2'
      }
    });

    const res = await fetch(`${bridgeUrl}/webhook/waha`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-hmac': sign(lidPayload),
        'x-webhook-hmac-algorithm': 'sha512'
      },
      body: lidPayload
    });

    assert.equal(res.status, 200);
    const d = await res.json();
    assert.equal(d.status, 'skipped');
    assert.equal(d.reason, 'unresolved_lid');
  });
});
