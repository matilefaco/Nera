# Nera WAHA Z-API Compatibility Bridge

Camada de compatibilidade de baixo consumo e custo zero/mínimo para substituir a **Z-API** paga por uma instância self-hosted do **WAHA Core (NOWEB)**, preservando 100% da lógica de negócio, idempotência, políticas de plano e tratamento de mensagens da Nera.

---

## 1. Arquitetura

### Envio de Mensagens (Outbound)
```text
Nera (sendWhatsApp)
  │ (HTTP POST /instances/:id/token/:token/send-text)
  ▼
Caddy (:443 HTTPS - Sem expor WAHA ou logs sensíveis)
  │
  ▼
Nera WAHA Bridge (:8080)
  │ (validação fail-closed de Client-Token & instance token)
  │ (verifica existência do número: GET /api/contacts/check-exists)
  ▼
WAHA Core NOWEB (:3000 interno)
  │ (POST /api/sendText com X-Api-Key obrigatória)
  ▼
WhatsApp Network
```

### Recebimento de Mensagens (Inbound)
```text
WhatsApp Network
  │ (Mensagem do cliente: "Sim", "1", "2", "3")
  ▼
WAHA Core NOWEB
  │ (Webhook com assinatura obrigatória HMAC SHA-512)
  ▼
Nera WAHA Bridge (:8080 /webhook/waha)
  │ (valida obrigatoriamente HMAC SHA-512 do corpo raw em timing-safe)
  │ (ignora fromMe, grupos, canais, status, broadcasts)
  │ (resolve @lid para telefone via endpoint oficial /api/{session}/lids/{lid})
  │ (molda para contrato Z-API on-message-received)
  ▼
Nera Backend (POST /api/zapi/webhook)
  │ (valida client-token / x-zapi-token)
  ▼
handleInboundMessage() -> Firestore -> Confirmação / Reagendamento / Cancelamento
```

---

## 2. Por que esta abordagem?

- **Zero alteração de regras de negócio:** O backend da Nera continua chamando `sendWhatsApp()` e recebendo `handleInboundMessage()` exatamente como antes.
- **Segurança Fail-Closed:** Todos os segredos e chaves de validação são estritamente obrigatórios no startup do bridge. Se qualquer credencial estiver ausente, o serviço não inicia e nunca desativa a autenticação.
- **Rollback instantâneo:** Trocar entre WAHA e Z-API é feito alterando apenas a variável `ZAPI_BASE_URL` (sem migração de banco de dados).
- **Sem peso:** O bridge é um servidor Node 22 nativo (`node:http`, `node:crypto`, `fetch`), sem frameworks pesados, sem Redis, sem PostgreSQL.
- **Economia:** Elimina a mensalidade fixa da Z-API mantendo a mesma confiabilidade para o volume da Nera.

---

## 3. Recomendações de Hospedagem

### Opção A — Oracle Cloud Always Free (Recomendado: R$ 0 / mês)
- **Instância:** `VM.Standard.A1.Flex` (ARM64 Ampere A1).
- **Recursos mínimos:** 1 OCPU, 2 a 4 GB RAM.
- **Sistema:** Ubuntu 22.04 ou 24.04 ARM64.
- **Imagem WAHA:** `devlikeapro/waha:noweb-arm-2026.8.1` (definida no `.env` via `WAHA_IMAGE`).
- *Nota:* A capacidade gratuita na Oracle pode ter restrições temporárias de disponibilidade por região e políticas de inatividade.

### Opção B — VPS Barato (Hetzner / DigitalOcean / Linode / GCP)
- **Instância:** 1 vCPU, 1 GB a 2 GB RAM (AMD64).
- **Imagem WAHA:** `devlikeapro/waha:noweb-2026.8.1` (padrão no `.env`).
- *Nota no GCP e2-micro:* Google cobra pequeno valor residual por IPv4 público estático caso a VM não se enquadre nos limites exatos do Free Tier.

---

## 4. Configuração de Firewall

Abra na VM apenas as portas necessárias:
- **Porta 22 (SSH):** Preferencialmente restrita ao seu IP de administrador.
- **Porta 80 (HTTP):** Para emissão de certificados ACME do Caddy.
- **Porta 443 (HTTPS):** Tráfego TLS público para o bridge.
- **Porta 3000 (WAHA):** **NUNCA** abra para a internet pública! O WAHA fica restrito à rede interna Docker e a `127.0.0.1:3000` na máquina local para acesso via SSH Tunnel.

---

## 5. DNS

Crie um registro **A** no seu provedor de DNS (Cloudflare / Registro.br / etc.):
```text
wa.usenera.com  ->  <IP_PUBLICO_DA_SUA_VM>
```

---

## 6. Passo a Passo de Instalação e Subida

### 6.1. Clonar / Copiar os arquivos na VM
```bash
mkdir -p /opt/nera-waha-bridge
cd /opt/nera-waha-bridge
# copie a pasta infra/waha-zapi-bridge para cá
```

### 6.2. Configurar o arquivo `.env`
```bash
cp .env.example .env
```

Gere dois segredos criptográficos fortes de 32 bytes:
```bash
openssl rand -hex 32   # Use para WAHA_API_KEY
openssl rand -hex 32   # Use para WAHA_WEBHOOK_HMAC_KEY
```

Preencha o `.env`:
```env
BRIDGE_PUBLIC_HOST=wa.usenera.com
WAHA_SESSION=default

# Imagem Docker:
# Para AMD64:
WAHA_IMAGE=devlikeapro/waha:noweb-2026.8.1
# Para Oracle ARM64:
# WAHA_IMAGE=devlikeapro/waha:noweb-arm-2026.8.1

WAHA_API_KEY=<segredo_gerado_1>
WAHA_WEBHOOK_HMAC_KEY=<segredo_gerado_2>

# Credenciais do Bridge (podem reutilizar temporariamente as da Z-API durante a migração):
BRIDGE_INSTANCE_ID=SUA_INSTANCE_ID_ATUAL
BRIDGE_INSTANCE_TOKEN=SEU_INSTANCE_TOKEN_ATUAL
BRIDGE_CLIENT_TOKEN=SEU_CLIENT_TOKEN_ATUAL

# Destino das mensagens recebidas para a Nera:
NERA_ZAPI_WEBHOOK_URL=https://usenera.com/api/zapi/webhook
NERA_ZAPI_WEBHOOK_TOKEN=SEU_ZAPI_WEBHOOK_TOKEN_ATUAL
```

### 6.3. Subir os containers
```bash
docker compose pull
docker compose up -d --build
docker compose ps
```

### 6.4. Verificar Health Check
```bash
curl -i https://wa.usenera.com/healthz
```
*Resposta esperada (HTTP 200):*
```json
{"ok":true,"service":"nera-waha-zapi-bridge"}
```

---

## 7. Criar Sessão NOWEB com Store e Parear WhatsApp

### 7.1. Acessar o Dashboard via Túnel SSH
Na sua máquina local (terminal do seu computador):
```bash
ssh -L 3000:127.0.0.1:3000 ubuntu@IP_DA_SUA_VM
```
Agora acesse no navegador do seu computador:
`http://localhost:3000/dashboard` (ou utilize as chamadas de API abaixo).

### 7.2. Criar a sessão no WAHA (com NOWEB Store habilitado para suportar @lid)
Pelo terminal da VM ou localmente via túnel:
```bash
curl -X POST http://127.0.0.1:3000/api/sessions \
  -H "X-Api-Key: SUA_WAHA_API_KEY" \
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

### 7.3. Escanear o QR Code
- Abra o dashboard em `http://localhost:3000/dashboard` (via SSH tunnel) ou solicite o QR Code:
```bash
curl -X GET http://127.0.0.1:3000/api/default/auth/qr \
  -H "X-Api-Key: SUA_WAHA_API_KEY"
```
- No WhatsApp do seu celular comercial da Nera: **Aparelhos Conectados > Conectar um aparelho** e escaneie o QR Code.
- O status da sessão deve mudar para `WORKING`.

---

## 8. Fases da Migração e Proteção contra Inbound Duplicado

Durante a migração, a Z-API e o WAHA podem estar conectados simultaneamente ao mesmo número de WhatsApp. Para impedir que uma mesma mensagem de cliente seja processada duas vezes pela Nera (dual-inbound), o bridge possui a trava de segurança `BRIDGE_INBOUND_FORWARDING_ENABLED` (por padrão **`false`**).

---

### FASE A — PREPARAÇÃO / SHADOW (Estado Inicial)
- **Nera Outbound:** Z-API (`ZAPI_BASE_URL=https://api.z-api.io`)
- **Nera Inbound:** Z-API (Webhook da Z-API ativo na URL da Nera)
- **WAHA / Bridge:** Conectado e ativo, com **`BRIDGE_INBOUND_FORWARDING_ENABLED=false`**

**Permitido nesta fase:**
- Verificar saúde do bridge via `GET https://wa.usenera.com/healthz`.
- Testar sessão do WAHA e reconexão automática (`docker compose restart waha` / reboot da VM).
- Testar envio direto pelo bridge via `curl` para números de teste da equipe.
- Testar verificação de número brasileiro (`check-exists`).
- O WAHA receberá as mensagens dos clientes, mas o bridge responderá `200 { status: 'skipped', reason: 'inbound_forwarding_disabled' }` e **NÃO** repassará nada para a Nera.

---

### FASE B — CUTOVER CONTROLADO (Transição para WAHA — Concluído)
O backend da Nera foi atualizado no código com o padrão durável `ZAPI_BASE_URL=https://wa.usenera.com`.
Qualquer deploy padrão (manual ou CI/CD via GitHub Actions) utilizará automaticamente o bridge WAHA self-hosted sem depender de arquivos `.env` locais no ambiente de build.

1. A sessão WAHA está conectada em estado `WORKING`.
2. O bridge está saudável (`https://wa.usenera.com/healthz`).
3. O webhook inbound da Z-API está desabilitado no painel da Z-API.
4. No arquivo `.env` do bridge na VM: `BRIDGE_INBOUND_FORWARDING_ENABLED=true`.
5. Segredos da Function configurados: `ZAPI_INSTANCE_ID`, `ZAPI_INSTANCE_TOKEN`, `ZAPI_CLIENT_TOKEN` e `ZAPI_WEBHOOK_TOKEN`.
6. Mensagens inbound de clientes chegam no formato WAHA e são registradas no Firestore com `provider: "waha"`.

---

### FASE C — ROLLBACK INSTANTÂNEO (Se houver qualquer instabilidade)
Se for necessário reverter temporariamente para a Z-API:

1. No `.env` do bridge na VM, desative o forwarding:
   ```env
   BRIDGE_INBOUND_FORWARDING_ENABLED=false
   ```
   E aplique: `docker compose up -d bridge`.
2. No ambiente da Nera (GCP / Firebase Secrets / Cloud Run / .env):
   Defina a variável de ambiente:
   ```env
   ZAPI_BASE_URL=https://api.z-api.io
   ```
   *(Como o código agora tem como padrão `https://wa.usenera.com`, a definição explícita de `ZAPI_BASE_URL=https://api.z-api.io` sobrescreve o padrão para direcionar as requisições de volta à Z-API).*
3. Reative o webhook inbound no painel da Z-API apontando para `https://usenera.com/api/zapi/webhook`.
4. O tráfego retornará imediatamente para a Z-API sem mensagens duplicadas.

---

## 9. Checklist Obrigatório Antes de Cancelar a Z-API

Execute e aprove todos os 23 itens:

- [ ] 1. Novo agendamento criado → Profissional recebe notificação no WhatsApp.
- [ ] 2. Agendamento confirmado → Cliente recebe mensagem de confirmação no WhatsApp.
- [ ] 3. Lembrete de 24h disparado pelo cron → Cliente recebe WhatsApp.
- [ ] 4. Cliente responde `Sim` → Status de presença muda para confirmado no Firestore.
- [ ] 5. Cliente responde `1` → Mensagem com link de reagendamento é enviada de volta.
- [ ] 6. Cliente responde `2` → Agendamento é cancelado e profissional é avisado.
- [ ] 7. Cliente responde `3` / texto desconhecido → Menu de ajuda da Nera é retornado.
- [ ] 8. Reiniciar o container do WAHA (`docker compose restart waha`) → Sessão volta automaticamente em estado `WORKING` sem precisar escanear QR novamente.
- [ ] 9. Reiniciar a VM inteira (`sudo reboot`) → Stack sobe automaticamente e sessão conecta.
- [ ] 10. Testar número de celular brasileiro com 9º dígito (13 dígitos).
- [ ] 11. Testar celular brasileiro com variação de DDD.
- [ ] 12. Confirmar que não há duplicação de mensagens (idempotência no Firestore mantida).
- [ ] 13. Confirmar que logs em `whatsapp_logs` continuam sendo salvos como `sent`.
- [ ] 14. Teste de segurança: Enviar request ao bridge com `Client-Token` inválido → Retorna `401 Unauthorized`.
- [ ] 15. Teste de segurança: Enviar webhook com HMAC inválido → Retorna `401 Unauthorized`.
- [ ] 16. Teste de segurança: Porta 3000 inacessível diretamente pela internet (`curl http://wa.usenera.com:3000` deve falhar/dar timeout).
- [ ] 17. Confirmar que eventos de grupo, canais, status e broadcasts são ignorados sem chegar ao banco da Nera.
- [ ] 18. Testar envio para número que não está no WhatsApp → Retorna erro `number_not_on_whatsapp` sem travar.
- [ ] 19. Verificar que `/healthz` retorna `{"ok":true}`.
- [ ] 20. Confirmar que mensagens com `@lid` são resolvidas para número normal.
- [ ] 21. Usuário no plano Free tentando disparar lembrete Pro → É bloqueado pela política da Nera normalmente.
- [ ] 22. Testar agendamento com lista de espera / cancelamento proativo.
- [ ] 23. Manter a operação rodando por pelo menos 48h sem anomalias.

**SOMENTE APÓS CUMPRIR TODOS OS ITENS ACIMA: Cancelar a assinatura da Z-API.**

---

## 11. Procedimento de Rollback Instantâneo

Se for identificado qualquer problema durante a validação:
1. No painel da Nera (GCP / Firebase Secrets):
   ```env
   ZAPI_BASE_URL=https://api.z-api.io
   ```
2. Reinicie / faça deploy da API.
3. O tráfego voltará imediatamente a passar pelos servidores oficiais da Z-API sem qualquer perda de dados ou necessidade de alteração no código.

---

## 12. Execução dos Testes Automatizados Locais do Bridge

Para rodar a suíte de testes unitários e de integração do bridge:
```bash
node --test infra/waha-zapi-bridge/test.mjs
```
*Todos os testes utilizam os mocks nativos do Node 22 com validação estrita de segurança e roteamento.*
