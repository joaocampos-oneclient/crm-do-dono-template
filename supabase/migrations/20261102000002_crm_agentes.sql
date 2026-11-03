-- CRM v3: agentes, execuções, aprovações, sinais e delegações.
-- 100% ADITIVA. Ledger nunca fica em Automático.

CREATE TABLE IF NOT EXISTS public.crm_agentes (
  slug text PRIMARY KEY,
  nome text NOT NULL,
  resumo text NOT NULL DEFAULT '',
  modo_default text NOT NULL DEFAULT 'sugerir'
    CHECK (modo_default IN ('sugerir', 'perguntar', 'automatico')),
  modo_atual text NOT NULL DEFAULT 'sugerir'
    CHECK (modo_atual IN ('sugerir', 'perguntar', 'automatico')),
  permite_automatico boolean NOT NULL DEFAULT true,
  ativo boolean NOT NULL DEFAULT true,
  CONSTRAINT crm_agentes_ledger_sem_auto CHECK (slug <> 'ledger' OR permite_automatico = false)
);

INSERT INTO public.crm_agentes (slug, nome, resumo, modo_default, modo_atual, permite_automatico) VALUES
  ('claudio', 'Cláudio', 'Conversa com leads. Nunca fala preço nem fecha.', 'automatico', 'automatico', true),
  ('scout', 'Scout', 'Analisa conversas e silêncio; encontra momento de compra.', 'sugerir', 'sugerir', true),
  ('scribe', 'Scribe', 'Resume reuniões e gera atividades / follow-ups.', 'perguntar', 'perguntar', true),
  ('ledger', 'Ledger', 'Monitora risco nos 7 primeiros dias. Nunca automático. Nunca cobra.', 'sugerir', 'sugerir', false),
  ('pilot', 'Pilot', 'Dispara follow-ups sem intervenção humana.', 'sugerir', 'sugerir', true),
  ('eco', 'Eco', 'Prepara briefing antes da reunião.', 'sugerir', 'sugerir', true)
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.crm_agente_execucoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agente text NOT NULL REFERENCES public.crm_agentes (slug),
  contato_id uuid REFERENCES public.crm_contatos (id) ON DELETE SET NULL,
  oportunidade_id uuid REFERENCES public.crm_oportunidades (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'aberta'
    CHECK (status IN ('aberta', 'aprovada', 'rejeitada', 'executada', 'erro')),
  entrada jsonb NOT NULL DEFAULT '{}',
  saida jsonb NOT NULL DEFAULT '{}',
  custo_tokens integer NOT NULL DEFAULT 0,
  erro text,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS crm_agente_execucoes_contato_idx
  ON public.crm_agente_execucoes (contato_id, created_at DESC);
CREATE INDEX IF NOT EXISTS crm_agente_execucoes_abertas_idx
  ON public.crm_agente_execucoes (status) WHERE status = 'aberta';

CREATE TABLE IF NOT EXISTS public.crm_aprovacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  detalhe text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'aprovada', 'rejeitada')),
  execucao_id uuid REFERENCES public.crm_agente_execucoes (id) ON DELETE SET NULL,
  contato_id uuid REFERENCES public.crm_contatos (id) ON DELETE SET NULL,
  criado_por text NOT NULL DEFAULT 'sistema',
  decidido_por uuid REFERENCES public.crm_operadores (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);
CREATE INDEX IF NOT EXISTS crm_aprovacoes_abertas_idx
  ON public.crm_aprovacoes (status, created_at) WHERE status = 'pendente';

CREATE TABLE IF NOT EXISTS public.crm_sinais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contato_id uuid NOT NULL REFERENCES public.crm_contatos (id) ON DELETE CASCADE,
  tipo text NOT NULL,
  evidencia text NOT NULL DEFAULT '',
  visto_em timestamptz NOT NULL DEFAULT now(),
  origem text NOT NULL DEFAULT 'sistema'
);
CREATE INDEX IF NOT EXISTS crm_sinais_contato_idx
  ON public.crm_sinais (contato_id, visto_em DESC);

CREATE TABLE IF NOT EXISTS public.crm_delegacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  de_operador_id uuid NOT NULL REFERENCES public.crm_operadores (id),
  para_operador_id uuid NOT NULL REFERENCES public.crm_operadores (id),
  contato_id uuid REFERENCES public.crm_contatos (id) ON DELETE SET NULL,
  motivo text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'concluida', 'cancelada')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_delegacoes_de_idx
  ON public.crm_delegacoes (de_operador_id, status);

-- Campos de negócio no contato (aditivos)
ALTER TABLE public.crm_contatos
  ADD COLUMN IF NOT EXISTS nicho text,
  ADD COLUMN IF NOT EXISTS cidade text,
  ADD COLUMN IF NOT EXISTS uf char(2),
  ADD COLUMN IF NOT EXISTS faturamento_faixa text,
  ADD COLUMN IF NOT EXISTS saude text,
  ADD COLUMN IF NOT EXISTS objecao_principal text;

ALTER TABLE public.crm_oportunidades
  ADD COLUMN IF NOT EXISTS previsao_centavos integer,
  ADD COLUMN IF NOT EXISTS fechamento_previsto date,
  ADD COLUMN IF NOT EXISTS proxima_acao_em timestamptz,
  ADD COLUMN IF NOT EXISTS proxima_acao_autor text;

-- Tokens MCP (Cursor / GrokBot)
CREATE TABLE IF NOT EXISTS public.crm_mcp_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  nivel text NOT NULL CHECK (nivel IN ('leitura', 'escrita', 'admin')),
  hash text NOT NULL UNIQUE,
  prefixo text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  criado_por uuid REFERENCES public.crm_operadores (id) ON DELETE SET NULL,
  ultimo_uso timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Sessões WhatsApp (WAHA)
CREATE TABLE IF NOT EXISTS public.crm_whatsapp_sessoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operador_id uuid REFERENCES public.crm_operadores (id) ON DELETE SET NULL,
  nome text NOT NULL DEFAULT 'principal',
  status text NOT NULL DEFAULT 'desconectado'
    CHECK (status IN ('desconectado', 'qr', 'conectado', 'erro')),
  waha_session text NOT NULL UNIQUE,
  ultimo_qr text,
  telefone text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_agentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_agente_execucoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_aprovacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_sinais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_delegacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_mcp_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_whatsapp_sessoes ENABLE ROW LEVEL SECURITY;
