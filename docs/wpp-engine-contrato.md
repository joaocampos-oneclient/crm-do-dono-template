# Contrato WPP Engine ↔ CRM do dono

Fonte: OpenAPI `https://wpp-engine.oneclient.com.br/v1/openapi.json` (spec enviada pelo time do Engine).

**Base:** `https://wpp-engine.oneclient.com.br/v1`  
**Não usar** o legado `wpp-api.oneclient.tech`.  
**Envelope:** `{ data, error: { code, message } }`.

## Auth

- Header: `Authorization: Bearer <api_key>` (`wae_live_…`)
- Uma key por tenant, emitida no **console** (signup + checkout). Não há criar tenant pela API pública.
- Env: `WPP_API_BASE_URL`, `WPP_API_KEY`, `WPP_SESSION_ID`, `WPP_WEBHOOK_SECRET` (+ `WPP_CONSOLE_URL` opcional)

## Sessões (só QR)

| Método | Path | Uso no CRM |
| --- | --- | --- |
| POST | `/v1/sessions` | Criar `{ phone E.164, display_name?, external_id? }` → `session_id`, `status`, `qr_code`, `qr_expires_at` |
| GET | `/v1/sessions/:id` | Status |
| GET | `/v1/sessions/:id/qr` | Refresh do QR |
| POST | `/v1/sessions/:id/reconnect` | Reconectar |
| GET | `/v1/sessions/:id/events` | Histórico |
| PATCH/DELETE | `/v1/sessions/:id` | Atualizar / remover |

Status Engine: `pending \| qr \| pairing \| connected \| disconnected \| banned \| revoked \| logged_out`.

## Envio

`POST /v1/sessions/:id/messages` com `to` (E.164) ou `to_group`, `content` (text | media), `idempotency_key` (8–120).

Mídia: `POST /v1/media/upload` (multipart) ou `/v1/media/upload-url`.

**O Engine não faz retry.** O CRM reenvia com a mesma `idempotency_key` (ver `sendText` no adaptador).

## Webhook

O CRM registra sozinho:

`PATCH /v1/tenants/me` `{ webhook_url HTTPS, webhook_secret }`

Validação: `X-WPP-Engine-Signature` = HMAC-SHA256 hex do raw body (`timingSafeEqual`).  
Dedupe: `X-WPP-Engine-Event-Id`. Responder **2xx rápido**.

Envelope: `{ id, type, timestamp, tenant_id, session_id, channel, data }`.

Eventos: `message.received|sent|delivered|read|failed`, `session.connected|disconnected|banned|qr_generated`, `group.message.received|sent`, `group.digest.ready`.

## Limites (mostrar na UI)

- 60 req/s por tenant (429 + `Retry-After`)
- 5000 msgs/dia por sessão
- Self-service = **1 sessão**
- Grupos: opt-in, teto 20 envios/dia por grupo
- Número novo nasce **cold** — aquecer devagar (aviso na UI)
- Engine **não tem atendentes**: multi-operador e atribuição ficam no CRM

## UX atual vs futuro

**Agora:** botão “Criar conta no WPP Engine” → console; campo para colar a key **uma vez**; CRM valida, cria sessão, QR com refresh, gera secret, registra webhook, acompanha status.

**Futuro (interface já prevista em `startConnect` / `completeConnect`):** OAuth ou device-link sem colar token.

## Código

- `src/lib/whatsapp/wpp-engine.ts` — adaptador padrão
- `src/lib/whatsapp/waha.ts` — opcional (`WHATSAPP_PROVIDER=waha`)
- `src/app/api/whatsapp/` — bootstrap + status + send
- `src/app/api/whatsapp/webhook/` — assinatura + dedupe
