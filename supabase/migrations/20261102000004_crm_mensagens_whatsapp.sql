-- Mensagens WhatsApp: id externo, status de entrega, vínculo com sessão.
ALTER TABLE public.crm_mensagens
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS status text
    CHECK (status IS NULL OR status IN ('received', 'sent', 'delivered', 'read', 'failed')),
  ADD COLUMN IF NOT EXISTS wa_from text,
  ADD COLUMN IF NOT EXISTS wa_to text,
  ADD COLUMN IF NOT EXISTS session_id text,
  ADD COLUMN IF NOT EXISTS event_id text;

CREATE UNIQUE INDEX IF NOT EXISTS crm_mensagens_external_uidx
  ON public.crm_mensagens (external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS crm_mensagens_status_idx
  ON public.crm_mensagens (status, em DESC)
  WHERE status IS NOT NULL;
