-- WhatsApp: provedor padrão WPP Engine (WAHA opcional).
-- Aditivo sobre crm_whatsapp_sessoes.

ALTER TABLE public.crm_whatsapp_sessoes
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'wpp-engine'
    CHECK (provider IN ('wpp-engine', 'waha')),
  ADD COLUMN IF NOT EXISTS external_session_id text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS webhook_secret_prefix text;

-- waha_session deixa de ser obrigatório (Engine usa UUID)
ALTER TABLE public.crm_whatsapp_sessoes
  ALTER COLUMN waha_session DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS crm_whatsapp_sessoes_external_uidx
  ON public.crm_whatsapp_sessoes (provider, external_session_id)
  WHERE external_session_id IS NOT NULL;

-- Dedupe de eventos de webhook
CREATE TABLE IF NOT EXISTS public.crm_whatsapp_eventos (
  event_id text PRIMARY KEY,
  tipo text NOT NULL,
  session_id text,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_whatsapp_eventos ENABLE ROW LEVEL SECURITY;
