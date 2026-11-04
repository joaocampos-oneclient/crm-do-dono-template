-- CRM v3: Agente Ember / Relance (Reciclador de Oportunidades)
-- 100% ADITIVA. Registra o agente 'ember' e cria as tabelas de campanhas, fila, opt-outs e incidentes.

INSERT INTO public.crm_agentes (slug, nome, resumo, modo_default, modo_atual, permite_automatico)
VALUES (
  'ember',
  'Ember',
  'Recicla leads parados com contexto real e dispara a primeira mensagem sem aprovação humana, com freios.',
  'automatico',
  'automatico',
  true
)
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.crm_reciclador_campanhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  objetivo text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho', 'ativa', 'pausada', 'emergencia', 'concluida')),
  filtro jsonb NOT NULL DEFAULT '{}'::jsonb,
  fontes jsonb NOT NULL DEFAULT '{}'::jsonb,
  cercas jsonb NOT NULL DEFAULT '{}'::jsonb,
  freios jsonb NOT NULL DEFAULT '{}'::jsonb,
  criada_em timestamptz NOT NULL DEFAULT now(),
  atualizada_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crm_reciclador_campanhas_status_idx
  ON public.crm_reciclador_campanhas (status, atualizada_em DESC);

CREATE TABLE IF NOT EXISTS public.crm_reciclador_fila (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id uuid NOT NULL REFERENCES public.crm_reciclador_campanhas (id) ON DELETE CASCADE,
  contato_id text NOT NULL,
  oportunidade_id text,
  nome_contato text NOT NULL,
  empresa text NOT NULL DEFAULT '',
  telefone text NOT NULL,
  telefone_digitos text NOT NULL,
  telefone_mascarado text NOT NULL,
  etapa_inicial text NOT NULL DEFAULT 'conversa',
  etapa_atual text NOT NULL DEFAULT 'conversa',
  contexto_extraido text NOT NULL DEFAULT '',
  fontes_lidas jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'simulado', 'enviado', 'adiado', 'ignorado', 'bloqueado', 'erro')),
  decisao text
    CHECK (decisao IS NULL OR decisao IN ('abordar', 'adiar', 'ignorar')),
  motivo text NOT NULL DEFAULT '',
  gancho_identificado text,
  mensagem_gerada text,
  modelo_usado text,
  custo_tokens integer NOT NULL DEFAULT 0,
  provider_whatsapp text,
  message_id_whatsapp text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  processado_em timestamptz,
  respondeu_em timestamptz,
  avancou_etapa boolean NOT NULL DEFAULT false,
  virou_venda boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS crm_reciclador_fila_campanha_status_idx
  ON public.crm_reciclador_fila (campanha_id, status, criado_em ASC);

CREATE INDEX IF NOT EXISTS crm_reciclador_fila_telefone_status_idx
  ON public.crm_reciclador_fila (telefone_digitos, status);

CREATE TABLE IF NOT EXISTS public.crm_reciclador_optouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telefone_digitos text NOT NULL UNIQUE,
  telefone_mascarado text NOT NULL,
  contato_id text,
  nome_contato text,
  motivo text NOT NULL DEFAULT 'pedido_parar'
    CHECK (motivo IN ('pedido_parar', 'recusa_recente', 'manual')),
  evidencia text NOT NULL DEFAULT '',
  tema text,
  registrado_em timestamptz NOT NULL DEFAULT now(),
  expira_em timestamptz
);

CREATE INDEX IF NOT EXISTS crm_reciclador_optouts_telefone_idx
  ON public.crm_reciclador_optouts (telefone_digitos);

CREATE TABLE IF NOT EXISTS public.crm_reciclador_incidentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id uuid REFERENCES public.crm_reciclador_campanhas (id) ON DELETE SET NULL,
  tipo text NOT NULL
    CHECK (tipo IN ('sessao_desconectada', 'erro_envio', 'parada_emergencia', 'rate_limit', 'sem_llm')),
  detalhe text NOT NULL DEFAULT '',
  em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crm_reciclador_incidentes_campanha_em_idx
  ON public.crm_reciclador_incidentes (campanha_id, em DESC);

ALTER TABLE public.crm_reciclador_campanhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_reciclador_fila ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_reciclador_optouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_reciclador_incidentes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY crm_reciclador_campanhas_leitura ON public.crm_reciclador_campanhas
    FOR SELECT USING (public.crm_eh_operador());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY crm_reciclador_campanhas_escrita ON public.crm_reciclador_campanhas
    FOR ALL USING (public.crm_pode_escrever()) WITH CHECK (public.crm_pode_escrever());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY crm_reciclador_fila_leitura ON public.crm_reciclador_fila
    FOR SELECT USING (public.crm_eh_operador());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY crm_reciclador_fila_escrita ON public.crm_reciclador_fila
    FOR ALL USING (public.crm_pode_escrever()) WITH CHECK (public.crm_pode_escrever());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY crm_reciclador_optouts_leitura ON public.crm_reciclador_optouts
    FOR SELECT USING (public.crm_eh_operador());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY crm_reciclador_optouts_escrita ON public.crm_reciclador_optouts
    FOR ALL USING (public.crm_pode_escrever()) WITH CHECK (public.crm_pode_escrever());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY crm_reciclador_incidentes_leitura ON public.crm_reciclador_incidentes
    FOR SELECT USING (public.crm_eh_operador());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY crm_reciclador_incidentes_escrita ON public.crm_reciclador_incidentes
    FOR ALL USING (public.crm_pode_escrever()) WITH CHECK (public.crm_pode_escrever());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
