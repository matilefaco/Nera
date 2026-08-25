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

That preserves Nera's existing booking confirmation, reschedule, cancel, plan-policy, idempotency and Firestore logging logic while removing Z-API from the transport layer.

## Components

- **WAHA Core** using the browserless `NOWEB` engine.
- **Nera bridge**: tiny Node HTTP service with no npm dependencies.
- **Caddy**: HTTPS termination. WAHA itself is never exposed publicly.
- Persistent Docker volume for the WhatsApp session and NOWEB store.

The WAHA image is pinned to version `2026.8.1` so an upstream release cannot silently change production behavior.

## Cheapest hosting order

### Option A — Oracle Cloud Always Free (target: R$0 fixed/month)

This is the preferred zero-fixed-cost host if an Always Free Ampere A1 instance is available in the account's home region.

Suggested starting shape for Nera's tiny traffic:

```text
VM.Standard.A1.Flex
1 OCPU
1 GB RAM
Ubuntu ARM64
Always Free eligible
```

WAHA has a native ARM NOWEB image. In `.env` use:

```text
WAHA_IMAGE=devlikeapro/waha:noweb-arm-2026.8.1
```

Oracle can reclaim Always Free compute that it classifies as idle, and Always Free capacity is sometimes unavailable. Treat that as an infrastructure risk, not as a guarantee of permanent uptime. The persistent session design and one-variable Nera rollback make recovery straightforward.

### Option B — Google Compute Engine e2-micro

The VM itself is in Google's Free Tier in eligible US regions, but a public IPv4 address on a normal VM is billed separately. Therefore this is **not literally R$0** with a standard public IPv4 setup.

For x86 use:

```text
WAHA_IMAGE=devlikeapro/waha:noweb-2026.8.1
```

An `e2-micro` has 1 GB RAM. Add 2 GB swap before starting Docker:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Option C — cheap VPS

If free hosts prove unreliable, move this exact Compose stack to a small 2-4 GB VPS. Nera itself does not need another code change; only DNS / `ZAPI_BASE_URL` changes.

## Brazil + LID handling

The bridge does not blindly build `{phone}@c.us`.

Before outbound messages it calls WAHA `GET /api/contacts/check-exists` and uses the returned `chatId`. WAHA explicitly recommends this for Brazilian numbers because the historical extra 9-digit convention can make a hand-built chat id incorrect.

For inbound messages, normal `@c.us` / `@s.whatsapp.net` ids are converted directly to a phone number. If WhatsApp sends the newer private `@lid` identifier, the bridge resolves it through WAHA's LID mapping API before forwarding it to Nera.

That is why the NOWEB session **must be created with its store enabled**.

## Security model

Outbound requests must match all three credentials already used by Nera:

- instance id
- instance token
- `Client-Token`

WAHA webhooks are verified using `X-Webhook-Hmac` (`sha512`) over the raw request body before any message is forwarded to Nera.

The bridge ignores:

- messages sent by the Nera WhatsApp account itself (`fromMe`)
- groups
- channels
- broadcasts/status
- empty/non-text messages
- senders whose phone number cannot be safely resolved

The WAHA dashboard is bound to `127.0.0.1:3000` and should only be reached through an SSH tunnel.

## 1. Provision the VM

For the R$0 target, create an Oracle Always Free Ampere A1 VM in the tenancy's home region with an Always Free-eligible Ubuntu ARM64 image.

Create it in a public subnet and assign a public IPv4 address. Allow inbound TCP:

```text
22   SSH (preferably restricted to your IP)
80   HTTP, used for Caddy certificate bootstrap/redirect
443  HTTPS bridge
```

Do **not** expose port 3000 publicly.

If using Google instead, use an eligible US region and `e2-micro` with standard persistent disk.

## 2. DNS

Create an `A` record such as:

```text
wa.usenera.com -> VM_PUBLIC_IP
```

Caddy will obtain and renew TLS automatically after DNS resolves.

## 3. Install Docker and configure the stack

Install Docker Engine and the Docker Compose plugin on the VM, copy this directory to the server, then:

```bash
cd infra/waha-zapi-bridge
cp .env.example .env
```

On Oracle Ampere A1, set:

```text
WAHA_IMAGE=devlikeapro/waha:noweb-arm-2026.8.1
```

On an x86 host, keep:

```text
WAHA_IMAGE=devlikeapro/waha:noweb-2026.8.1
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

## 4. Start the stack

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

## 5. Create and pair the NOWEB session

WAHA's dashboard/API is deliberately not public. From your computer, open an SSH tunnel:

```bash
ssh -L 3000:127.0.0.1:3000 USER@VM_PUBLIC_IP
```

With that tunnel open, create the session **before scanning the QR**, with the NOWEB store enabled:

```bash
curl -X POST http://localhost:3000/api/sessions \
  -H "X-Api-Key: YOUR_WAHA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "default",
    "config": {
      "noweb": {
        "store": {
          "enabled": true,
          "fullSync": false
        }
      }
    }
  }'
```

`fullSync: false` is intentional: Nera does not need historical chat synchronization; the store is enabled mainly so WAHA can maintain the `@lid` <-> phone-number mapping needed for reliable inbound replies.

Then open:

```text
http://localhost:3000/dashboard
```

Use the WAHA API key from `.env`, select the `default` session and pair the Nera WhatsApp account by QR/pairing flow.

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

Then reply to the WhatsApp message and confirm the bridge logs show an inbound event forwarded to Nera:

```bash
docker compose logs -f bridge
```

## 7. Cut Nera over

Nera already reads `ZAPI_BASE_URL`. Point only that variable to the bridge:

```text
ZAPI_BASE_URL=https://wa.usenera.com
```

Keep the current instance id/token/client token unchanged for the first migration. They now authenticate against our bridge instead of Z-API.

**Do not cancel Z-API yet.**

Test these real flows end-to-end:

1. new booking -> professional receives WhatsApp
2. booking confirmed -> client receives WhatsApp
3. 24h reminder -> client receives WhatsApp
4. client replies `Sim` -> attendance is confirmed
5. client replies `1` -> reschedule flow
6. client replies `2` -> cancellation flow
7. container/VM restart -> WAHA session returns to `WORKING` without a new QR
8. test at least two Brazilian mobile numbers from different carriers/DDD if available

Only after all eight pass should the Z-API subscription be cancelled.

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
