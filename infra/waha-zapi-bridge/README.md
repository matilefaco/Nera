# Nera WAHA / Z-API Compatibility Bridge

This stack removes the paid Z-API hop without forcing a risky rewrite of Nera's existing WhatsApp notification code.

## Why this bridge exists

Nera currently sends text through the Z-API-compatible contract:

```text
POST {ZAPI_BASE_URL}/instances/{instanceId}/token/{token}/send-text
Client-Token: ...

{
  "phone": "5585999999999",
  "message": "..."
}
```

The bridge keeps that exact contract and translates it to WAHA:

```text
Nera -> compatibility bridge -> WAHA -> WhatsApp
```

Inbound messages take the reverse path:

```text
WhatsApp -> WAHA webhook -> compatibility bridge -> existing /api/zapi/webhook -> Nera
```

That means the existing booking confirmation / reschedule / cancel logic can keep working while Z-API is removed from the infrastructure.

## Components

- **WAHA Core** using the browserless `NOWEB` engine.
- **Nera bridge**: tiny Node HTTP service with no npm dependencies.
- **Caddy**: HTTPS termination. WAHA itself is never exposed publicly.
- Persistent Docker volume for the WhatsApp session.

The WAHA image is pinned to `devlikeapro/waha:noweb-2026.8.1` so an upstream release cannot silently change production behavior.

## Security model

Outbound requests must match all three credentials already used by Nera:

- instance id
- instance token
- `Client-Token`

WAHA webhooks are verified using `X-Webhook-Hmac` (`sha512`) before any message is forwarded to Nera.

The bridge ignores:

- messages sent by the Nera WhatsApp account itself (`fromMe`)
- groups
- channels
- broadcasts/status
- empty/non-text messages

The WAHA dashboard is bound to `127.0.0.1:3000` and should only be reached through an SSH tunnel.

## 1. Server

For the cheapest setup, use one small always-on Linux VM. The intended first test is a Google Cloud `e2-micro` Free Tier VM in an eligible US region.

Because `e2-micro` only has 1 GB RAM, add swap before starting Docker:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

If this proves too tight in practice, move the exact same Compose stack to a cheap 2-4 GB VPS. No Nera application-code change is required.

## 2. DNS

Create an `A` record such as:

```text
wa.usenera.com -> VM_PUBLIC_IP
```

Open inbound TCP ports **80** and **443** on the VM firewall. Do not expose port 3000 publicly.

Caddy will obtain and renew TLS automatically after DNS resolves.

## 3. Install Docker

Install Docker Engine and the Docker Compose plugin on the VM, then copy this directory to the server.

```bash
cd infra/waha-zapi-bridge
cp .env.example .env
```

Generate new WAHA-only secrets:

```bash
openssl rand -hex 32
openssl rand -hex 32
```

Use one as `WAHA_API_KEY` and the other as `WAHA_WEBHOOK_HMAC_KEY`.

For the bridge compatibility credentials, use the values Nera already has for:

```text
ZAPI_INSTANCE_ID       -> BRIDGE_INSTANCE_ID
ZAPI_INSTANCE_TOKEN    -> BRIDGE_INSTANCE_TOKEN
ZAPI_CLIENT_TOKEN      -> BRIDGE_CLIENT_TOKEN
ZAPI_WEBHOOK_TOKEN     -> NERA_ZAPI_WEBHOOK_TOKEN
```

Do **not** commit `.env`.

## 4. Start

```bash
docker compose pull
docker compose up -d --build
```

Check:

```bash
docker compose ps
curl https://wa.usenera.com/healthz
```

Expected:

```json
{"ok":true,"service":"nera-waha-zapi-bridge"}
```

## 5. Pair the WhatsApp account

WAHA's dashboard is not public. From your computer, open a tunnel:

```bash
ssh -L 3000:127.0.0.1:3000 USER@VM_PUBLIC_IP
```

Then open locally:

```text
http://localhost:3000/dashboard
```

Use the WAHA API key from `.env`, start the `default` session and pair the WhatsApp account by QR/pairing flow.

Confirm the session reaches `WORKING` before routing Nera traffic to it.

## 6. Test the bridge before changing Nera

A direct compatibility test should return HTTP 200 and deliver a WhatsApp message:

```bash
curl -X POST \
  "https://wa.usenera.com/instances/$BRIDGE_INSTANCE_ID/token/$BRIDGE_INSTANCE_TOKEN/send-text" \
  -H "Client-Token: $BRIDGE_CLIENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone":"55DDDNUMERO","message":"Teste Nera via WAHA"}'
```

Then reply to the WhatsApp message and confirm the bridge logs show an inbound event forwarded to Nera.

```bash
docker compose logs -f bridge
```

## 7. Cut Nera over

Nera already reads `ZAPI_BASE_URL`. Point only that variable to the bridge:

```text
ZAPI_BASE_URL=https://wa.usenera.com
```

Keep the current instance id/token/client token unchanged for the first migration. They now authenticate against our bridge instead of Z-API.

Do not cancel Z-API yet.

Test these real flows end-to-end:

1. new booking -> professional receives WhatsApp
2. booking confirmed -> client receives WhatsApp
3. 24h reminder -> client receives WhatsApp
4. client replies `Sim` -> attendance is confirmed
5. client replies `1` -> reschedule flow
6. client replies `2` -> cancellation flow
7. container restart -> WAHA session returns to `WORKING` without a new QR

Only after all seven pass should the Z-API subscription be cancelled.

## Rollback

Rollback is intentionally one variable:

```text
ZAPI_BASE_URL=https://api.z-api.io
```

No database migration is involved.

## Operations

Useful commands:

```bash
docker compose ps
docker compose logs -f waha
docker compose logs -f bridge
docker compose restart waha
docker compose pull && docker compose up -d
```

Before upgrading WAHA to a newer image, test outbound and inbound messages with the new pinned version. Do not use an unpinned `latest` tag in production.

## Important limitation

WAHA is an unofficial WhatsApp Web integration, not the official Meta Cloud API. There is a higher risk of session disconnects or account restrictions than with the official API. Keep message volume conservative, use opt-in users, avoid unsolicited bulk messaging, and retain email/push fallbacks for important notifications.
