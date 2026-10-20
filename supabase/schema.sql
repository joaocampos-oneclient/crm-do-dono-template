-- =============================================================================
-- CRM do dono · schema educacional (Postgres / Supabase)
-- Rode em um projeto Supabase NOVO, seu. Nunca em produção sem testar antes.
-- Ordem: este arquivo, depois seed.sql (dados de exemplo ilustrativo).
--
-- Ideia central: Contato (a pessoa) 1 -> N Oportunidades (uma chance de venda por produto).
-- Categoria (lead / prospect / cliente) é CALCULADA pela view, ninguém edita.
-- RLS ligado em tudo: só quem está em crm_operadores enxerga e escreve.
-- =============================================================================

create extension if not exists pgcrypto;

-- Quem pode usar o CRM (vendedores, dono). Ligado ao usuário do Supabase Auth.
create table if not exists crm_operadores (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  papel text not null default 'vendedor' check (papel in ('dono', 'vendedor')),
  criado_em timestamptz not null default now()
);

create or replace function crm_eh_operador() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from crm_operadores where user_id = auth.uid());
$$;

create table if not exists crm_produtos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  valor_centavos integer not null check (valor_centavos >= 0),
  ativo boolean not null default true
);

create table if not exists crm_funis (          -- funis de ENTRADA (de onde o lead vem)
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  canal text not null,
  produto_id uuid references crm_produtos(id)
);

create table if not exists crm_etapas (         -- etapas do funil de VENDA (o Canvas de cada etapa)
  id text primary key,                          -- ex.: 'novo', 'conversa', 'handoff'
  ordem integer not null unique,
  nome text not null,
  objetivo text not null,
  validacao text not null,                      -- critério checável para o card andar
  prazo_minutos integer not null default 0,     -- 0 = sem prazo
  meta_conversao integer check (meta_conversao between 0 and 100),
  automatica boolean not null default false,    -- true = o sistema move, ninguém arrasta
  dono_padrao text not null default 'humano' check (dono_padrao in ('robo', 'humano', 'sistema'))
);

create table if not exists crm_contatos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  empresa text,
  segmento text,
  cidade text,
  telefone text,
  email text,
  funil_origem_id uuid references crm_funis(id),
  nota_pergunta_matadora smallint check (nota_pergunta_matadora between 0 and 10),
  dono text not null default 'robo' check (dono in ('robo', 'humano')),
  handoff_pendente boolean not null default false,
  termometro text check (termometro in ('frio', 'morno', 'quente')),
  criado_em timestamptz not null default now()
);
create unique index if not exists crm_contatos_telefone_uq on crm_contatos (telefone) where telefone is not null;

create table if not exists crm_oportunidades (
  id uuid primary key default gen_random_uuid(),
  contato_id uuid not null references crm_contatos(id) on delete cascade,
  produto_id uuid not null references crm_produtos(id),
  etapa_id text not null references crm_etapas(id),
  valor_centavos integer not null check (valor_centavos >= 0),
  entrou_na_etapa_em timestamptz not null default now(),
  proximo_passo text,
  briefing jsonb,                               -- { dor, meta, data }
  perdida boolean not null default false,
  motivo_perda text,
  criado_em timestamptz not null default now(),
  constraint crm_perdida_exige_motivo check (not perdida or motivo_perda is not null)
);
create index if not exists crm_oportunidades_contato_idx on crm_oportunidades (contato_id);
create index if not exists crm_oportunidades_etapa_idx on crm_oportunidades (etapa_id) where not perdida;

-- Histórico: toda mudança de etapa vira uma linha. É daqui que saem as conversões.
create table if not exists crm_movimentos (
  id uuid primary key default gen_random_uuid(),
  oportunidade_id uuid not null references crm_oportunidades(id) on delete cascade,
  de_etapa text references crm_etapas(id),
  para_etapa text not null references crm_etapas(id),
  por text not null,                            -- 'robo' | 'sistema' | id do operador
  em timestamptz not null default now()
);

create table if not exists crm_mensagens (
  id uuid primary key default gen_random_uuid(),
  contato_id uuid not null references crm_contatos(id) on delete cascade,
  autor text not null check (autor in ('contato', 'robo', 'humano')),
  texto text not null,
  aviso_automatico boolean not null default false,  -- troca de atendente
  em timestamptz not null default now()
);
create index if not exists crm_mensagens_contato_idx on crm_mensagens (contato_id, em);

create table if not exists crm_notas (
  id uuid primary key default gen_random_uuid(),
  contato_id uuid not null references crm_contatos(id) on delete cascade,
  autor_id uuid references auth.users(id),
  texto text not null,
  em timestamptz not null default now()
);

create table if not exists crm_tarefas (
  id uuid primary key default gen_random_uuid(),
  contato_id uuid not null references crm_contatos(id) on delete cascade,
  texto text not null,
  vence_em timestamptz,
  origem text,                                  -- ex.: 'ligacao 08:55' ou 'manual'
  feita boolean not null default false
);

-- Ligações: o áudio fica em storage PRIVADO; aqui só o registro e a transcrição.
create table if not exists crm_ligacoes (
  id uuid primary key default gen_random_uuid(),
  contato_id uuid not null references crm_contatos(id) on delete cascade,
  operador_id uuid references auth.users(id),
  iniciou_em timestamptz not null default now(),
  duracao_seg integer,
  resultado text check (resultado in ('atendeu', 'caixa_postal', 'nao_atende')),
  aviso_gravacao_dado boolean not null default false,   -- sem aviso, não grava
  audio_path text,                                       -- bucket privado; use URL assinada
  transcricao jsonb,                                     -- [{quem, texto, hora, marca}]
  followups jsonb,                                       -- [{texto, quando, origem}]
  termometro_vendedor text check (termometro_vendedor in ('frio', 'morno', 'quente')),
  termometro_ia text check (termometro_ia in ('frio', 'morno', 'quente'))
);

-- Categoria calculada. Ninguém edita: cliente > prospect > lead.
create or replace view crm_contatos_categoria with (security_invoker = true) as
select c.*,
  case
    when exists (select 1 from crm_oportunidades o where o.contato_id = c.id and not o.perdida and o.etapa_id in ('pago', 'dentro')) then 'cliente'
    when exists (select 1 from crm_oportunidades o where o.contato_id = c.id and not o.perdida and o.etapa_id in ('briefing', 'proposta', 'oferta')) then 'prospect'
    else 'lead'
  end as categoria
from crm_contatos c;

-- ------------------------------ RLS ------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['crm_operadores','crm_produtos','crm_funis','crm_etapas','crm_contatos','crm_oportunidades','crm_movimentos','crm_mensagens','crm_notas','crm_tarefas','crm_ligacoes']
  loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- Operadores: cada um vê só a si mesmo. Cadastrar operador é feito por você, no painel (service role), nunca pelo front.
drop policy if exists crm_operadores_self on crm_operadores;
create policy crm_operadores_self on crm_operadores for select to authenticated using (user_id = auth.uid());

-- Demais tabelas: só operador lê e escreve.
do $$
declare t text;
begin
  foreach t in array array['crm_produtos','crm_funis','crm_etapas','crm_contatos','crm_oportunidades','crm_movimentos','crm_mensagens','crm_notas','crm_tarefas','crm_ligacoes']
  loop
    execute format('drop policy if exists %I on %I', t || '_operador', t);
    execute format('create policy %I on %I for all to authenticated using (crm_eh_operador()) with check (crm_eh_operador())', t || '_operador', t);
  end loop;
end $$;

-- Nada é público (anon não acessa nenhuma tabela).
revoke all on all tables in schema public from anon;
