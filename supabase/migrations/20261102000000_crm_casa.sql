-- =============================================================================
-- CRM do dono · schema (Postgres / Supabase)
-- RECOMENDAÇÃO, não requisito: o CRM roda sem banco (localStorage ou arquivo JSON do servidor).
-- Quando precisar de multiusuário, histórico longo ou acesso de fora, rode isto num projeto
-- Supabase NOVO, seu. Depois: seed.sql. Como ligar o código: docs/banco-de-dados.md.
--
-- Espelha 1:1 o EstadoCRM de src/domain/types.ts (um array = uma tabela).
-- Ideia central: Contato (a pessoa) 1 -> N Oportunidades (uma chance de venda por produto).
-- Categoria (lead / prospect / cliente) é CALCULADA pela view, ninguém edita.
-- RLS ligado em tudo: só quem está em crm_operadores enxerga; papel 'leitura' e 'bot' só leem.
-- =============================================================================

create extension if not exists pgcrypto;

-- ------------------------------ configuração ---------------------------------
create table if not exists crm_config (
  id boolean primary key default true check (id),      -- uma linha só
  nome_empresa text not null default 'Minha empresa',
  nome_robo text not null default 'Cláudio',
  robo_operador_id uuid
);

-- Quem pode usar o CRM. Humanos ligam ao Supabase Auth (user_id); IAs e bots não têm login.
create table if not exists crm_operadores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  nome text not null,
  papel text not null default 'vendedor' check (papel in ('dono', 'vendedor', 'leitura', 'bot')),
  tipo text not null default 'humano' check (tipo in ('humano', 'ia')),
  email text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create or replace function crm_operador_atual() returns crm_operadores
language sql stable security definer set search_path = public as $$
  select o.* from crm_operadores o where o.user_id = auth.uid() and o.ativo limit 1;
$$;
create or replace function crm_eh_operador() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from crm_operadores where user_id = auth.uid() and ativo);
$$;
create or replace function crm_pode_escrever() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from crm_operadores where user_id = auth.uid() and ativo and papel in ('dono', 'vendedor'));
$$;
create or replace function crm_eh_dono() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from crm_operadores where user_id = auth.uid() and ativo and papel = 'dono');
$$;

-- ------------------------------ cadastros ------------------------------------
create table if not exists crm_produtos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  valor_centavos integer not null check (valor_centavos >= 0),
  parcelas text not null default '',
  descricao text,
  ativo boolean not null default true,
  gatilhos text[] not null default '{}',               -- condições verdadeiras de oferta
  playbook jsonb not null default '[]'                 -- PerguntaMatadora[] próprio do produto
);

create table if not exists crm_funis (                 -- funis de ENTRADA (de onde o lead vem)
  id text primary key,                                 -- ex.: 'perpetuo' (é o que vai no webhook)
  nome text not null,
  canal text not null,
  produto_id uuid references crm_produtos(id),
  ativo boolean not null default true
);

create table if not exists crm_criativos (
  id uuid primary key default gen_random_uuid(),
  funil_id text not null references crm_funis(id),
  nome text not null,
  plataforma text not null default 'Meta Ads',
  ativo boolean not null default true
);

create table if not exists crm_gastos_midia (
  id uuid primary key default gen_random_uuid(),
  funil_id text not null references crm_funis(id),
  criativo_id uuid references crm_criativos(id),
  data date not null,
  valor_centavos integer not null check (valor_centavos >= 0),
  visitas integer not null default 0 check (visitas >= 0)
);
create index if not exists crm_gastos_data_idx on crm_gastos_midia (data, funil_id);

create table if not exists crm_etapas (                -- etapas do funil de VENDA (o Canvas de cada etapa)
  id text primary key,                                 -- 'novo', 'conversa', 'handoff', ...
  ordem integer not null unique,
  nome text not null,
  objetivo text not null,
  validacao text not null,
  prazo_minutos integer not null default 0,            -- 0 = sem prazo
  meta_conversao integer check (meta_conversao between 0 and 100),
  automatica boolean not null default false,           -- true = o sistema move, ninguém arrasta
  dono_padrao text not null default 'humano' check (dono_padrao in ('robo', 'humano', 'sistema'))
);

create table if not exists crm_templates (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  canal text not null check (canal in ('whatsapp', 'email')),
  assunto text,
  texto text not null
);

-- Chaves de API: guarde SÓ o hash (sha256). O servidor compara hash(chave recebida) = hash.
create table if not exists crm_chaves_api (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  prefixo text not null,                               -- 'crm_leitura_ab12' só para exibir
  hash text not null unique,
  escopo text not null check (escopo in ('leitura', 'escrita')),
  operador_id uuid references crm_operadores(id),
  criada_em timestamptz not null default now(),
  revogada_em timestamptz
);

-- ------------------------------ operação -------------------------------------
create table if not exists crm_contatos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  empresa text not null default '',
  segmento text not null default '',
  cidade text not null default '',
  telefone text not null,
  telefone_digitos text generated always as (regexp_replace(telefone, '\D', '', 'g')) stored,
  email text not null default '',
  funil_origem_id text references crm_funis(id),
  nota_pergunta_matadora smallint check (nota_pergunta_matadora between 0 and 10),
  dono text not null default 'robo' check (dono in ('robo', 'humano')),
  operador_id uuid references crm_operadores(id),
  handoff_pendente boolean not null default false,
  handoff_desde timestamptz,
  termometro text check (termometro in ('frio', 'morno', 'quente')),
  criado_em timestamptz not null default now()
);
create unique index if not exists crm_contatos_telefone_uq on crm_contatos (telefone_digitos);

create table if not exists crm_oportunidades (
  id uuid primary key default gen_random_uuid(),
  contato_id uuid not null references crm_contatos(id) on delete cascade,
  produto_id uuid not null references crm_produtos(id),
  etapa_id text not null references crm_etapas(id),
  valor_centavos integer not null check (valor_centavos >= 0),
  entrou_na_etapa_em timestamptz not null default now(),
  proximo_passo text not null default '',
  briefing jsonb,                                      -- { dor, meta, data }
  perdida boolean not null default false,
  motivo_perda text,
  criada_em timestamptz not null default now(),
  constraint crm_perdida_exige_motivo check (not perdida or motivo_perda is not null)
);
create index if not exists crm_oportunidades_contato_idx on crm_oportunidades (contato_id);
create index if not exists crm_oportunidades_etapa_idx on crm_oportunidades (etapa_id) where not perdida;

-- Histórico: toda mudança de etapa vira uma linha. É daqui que saem as conversões e o CPV.
create table if not exists crm_movimentos (
  id uuid primary key default gen_random_uuid(),
  oportunidade_id uuid not null references crm_oportunidades(id) on delete cascade,
  de_etapa text,                                       -- null na entrada; 'perdido' ao reabrir
  para_etapa text not null,                            -- etapa ou 'perdido'
  por text not null,                                   -- 'robo' | 'sistema' | id do operador
  em timestamptz not null default now(),
  motivo text
);
create index if not exists crm_movimentos_em_idx on crm_movimentos (em, para_etapa);

create table if not exists crm_mensagens (
  id uuid primary key default gen_random_uuid(),
  contato_id uuid not null references crm_contatos(id) on delete cascade,
  autor text not null check (autor in ('contato', 'robo', 'humano')),
  texto text not null,
  aviso_automatico boolean not null default false,     -- troca de atendente
  operador_id uuid references crm_operadores(id),
  em timestamptz not null default now()
);
create index if not exists crm_mensagens_contato_idx on crm_mensagens (contato_id, em);

create table if not exists crm_notas (
  id uuid primary key default gen_random_uuid(),
  contato_id uuid not null references crm_contatos(id) on delete cascade,
  autor_id uuid references crm_operadores(id),
  texto text not null,
  em timestamptz not null default now()
);

create table if not exists crm_tarefas (
  id uuid primary key default gen_random_uuid(),
  contato_id uuid not null references crm_contatos(id) on delete cascade,
  texto text not null,
  vence_em timestamptz,
  origem text not null default 'manual',               -- 'ligação 10:15', 'manual', 'mcp'
  feita boolean not null default false,
  criada_em timestamptz not null default now()
);

-- Ligações: o áudio fica em storage PRIVADO; aqui só o registro e a transcrição.
create table if not exists crm_ligacoes (
  id uuid primary key default gen_random_uuid(),
  contato_id uuid not null references crm_contatos(id) on delete cascade,
  operador_id uuid references crm_operadores(id),
  iniciou_em timestamptz not null default now(),
  duracao_seg integer not null default 0,
  resultado text check (resultado in ('atendeu', 'caixa postal', 'não atende')),
  aviso_gravacao_dado boolean not null default false,  -- sem aviso, não grava
  audio_path text,                                     -- bucket privado; use URL assinada
  transcricao jsonb not null default '[]',             -- [{quem, texto, hora, marca}]
  followups jsonb not null default '[]',               -- [{texto, quando, origem}]
  resumo text not null default '',
  termometro_vendedor text check (termometro_vendedor in ('frio', 'morno', 'quente')),
  termometro_ia text check (termometro_ia in ('frio', 'morno', 'quente')),
  constraint crm_transcricao_exige_aviso check (aviso_gravacao_dado or transcricao = '[]'::jsonb)
);

create table if not exists crm_propostas (
  id uuid primary key default gen_random_uuid(),
  oportunidade_id uuid not null references crm_oportunidades(id) on delete cascade,
  texto text not null,
  criada_em timestamptz not null default now(),
  enviada_em timestamptz,
  enviada_por text check (enviada_por in ('whatsapp', 'email')),
  aberta_em timestamptz                                -- este evento move o card para 'proposta'
);

create table if not exists crm_pagamentos (
  id uuid primary key default gen_random_uuid(),
  oportunidade_id uuid not null references crm_oportunidades(id) on delete cascade,
  valor_centavos integer not null check (valor_centavos >= 0),
  metodo text not null check (metodo in ('pix', 'cartao', 'boleto')),
  status text not null default 'pendente' check (status in ('pendente', 'pago', 'falhou', 'reembolsado')),
  link_url text,
  provedor_id text,                                    -- id no Stripe/Asaas/Pagar.me
  expira_em timestamptz,
  criado_em timestamptz not null default now(),
  pago_em timestamptz
);

create table if not exists crm_ocorrencias (
  id uuid primary key default gen_random_uuid(),
  contato_id uuid not null references crm_contatos(id) on delete cascade,
  tipo text not null check (tipo in ('problema', 'melhoria')),
  descricao text not null,
  trechos jsonb not null default '[]',                 -- [{autor, texto, em}]
  status text not null default 'aberta' check (status in ('aberta', 'em análise', 'resolvida')),
  aberta_por uuid references crm_operadores(id),
  em timestamptz not null default now(),
  resposta text
);

create table if not exists crm_emails (
  id uuid primary key default gen_random_uuid(),
  contato_id uuid not null references crm_contatos(id) on delete cascade,
  assunto text not null,
  texto text not null,
  em timestamptz not null default now(),
  enviado_por uuid references crm_operadores(id)
);

-- ------------------------------ views ----------------------------------------
-- Categoria calculada. Ninguém edita: cliente > prospect > lead.
create or replace view crm_contatos_categoria with (security_invoker = true) as
select c.*,
  case
    when exists (select 1 from crm_oportunidades o where o.contato_id = c.id and not o.perdida and o.etapa_id in ('pago', 'dentro')) then 'cliente'
    when exists (select 1 from crm_oportunidades o where o.contato_id = c.id and not o.perdida and o.etapa_id in ('briefing', 'proposta', 'oferta')) then 'prospect'
    else 'lead'
  end as categoria
from crm_contatos c;

-- Demanda por dia e funil: base da tela Demandas (leads, qualificados, ofertas, vendas, gasto, visitas).
create or replace view crm_demanda_diaria with (security_invoker = true) as
with dias as (
  select d::date as dia, f.id as funil_id from generate_series(current_date - 60, current_date, interval '1 day') d cross join crm_funis f
),
leads as (select criado_em::date dia, funil_origem_id funil_id, count(*) n from crm_contatos group by 1, 2),
movs as (
  select m.em::date dia, c.funil_origem_id funil_id, m.para_etapa, count(distinct m.oportunidade_id) n
  from crm_movimentos m join crm_oportunidades o on o.id = m.oportunidade_id join crm_contatos c on c.id = o.contato_id
  group by 1, 2, 3
),
gastos as (select data dia, funil_id, sum(valor_centavos) gasto_centavos, sum(visitas) visitas from crm_gastos_midia group by 1, 2),
receita as (
  select p.pago_em::date dia, c.funil_origem_id funil_id, sum(p.valor_centavos) receita_centavos
  from crm_pagamentos p join crm_oportunidades o on o.id = p.oportunidade_id join crm_contatos c on c.id = o.contato_id
  where p.status = 'pago' group by 1, 2
)
select d.dia, d.funil_id,
  coalesce(l.n, 0) leads,
  coalesce((select n from movs where movs.dia = d.dia and movs.funil_id = d.funil_id and para_etapa = 'handoff'), 0) qualificados,
  coalesce((select n from movs where movs.dia = d.dia and movs.funil_id = d.funil_id and para_etapa = 'oferta'), 0) ofertas,
  coalesce((select n from movs where movs.dia = d.dia and movs.funil_id = d.funil_id and para_etapa = 'pago'), 0) vendas,
  coalesce(g.gasto_centavos, 0) gasto_centavos,
  coalesce(g.visitas, 0) visitas,
  coalesce(r.receita_centavos, 0) receita_centavos
from dias d
left join leads l on l.dia = d.dia and l.funil_id = d.funil_id
left join gastos g on g.dia = d.dia and g.funil_id = d.funil_id
left join receita r on r.dia = d.dia and r.funil_id = d.funil_id;

-- Valor em aberto por etapa (tela Funil e Relatórios).
create or replace view crm_valor_por_etapa with (security_invoker = true) as
select e.id etapa_id, e.nome, e.ordem, count(o.id) cards, coalesce(sum(o.valor_centavos), 0) valor_centavos
from crm_etapas e left join crm_oportunidades o on o.etapa_id = e.id and not o.perdida
group by e.id, e.nome, e.ordem order by e.ordem;

-- ------------------------------ RLS ------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['crm_config','crm_operadores','crm_produtos','crm_funis','crm_criativos','crm_gastos_midia','crm_etapas','crm_templates','crm_chaves_api','crm_contatos','crm_oportunidades','crm_movimentos','crm_mensagens','crm_notas','crm_tarefas','crm_ligacoes','crm_propostas','crm_pagamentos','crm_ocorrencias','crm_emails']
  loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- Operadores: todo operador vê a lista (precisa para atribuir); só dono escreve.
drop policy if exists crm_operadores_ler on crm_operadores;
create policy crm_operadores_ler on crm_operadores for select to authenticated using (crm_eh_operador());
drop policy if exists crm_operadores_escrever on crm_operadores;
create policy crm_operadores_escrever on crm_operadores for all to authenticated using (crm_eh_dono()) with check (crm_eh_dono());

-- Chaves e config: só dono.
do $$
declare t text;
begin
  foreach t in array array['crm_chaves_api','crm_config']
  loop
    execute format('drop policy if exists %I on %I', t || '_dono', t);
    execute format('create policy %I on %I for all to authenticated using (crm_eh_dono()) with check (crm_eh_dono())', t || '_dono', t);
  end loop;
end $$;

-- Demais tabelas: operador lê; dono e vendedor escrevem; 'leitura' e 'bot' só leem.
do $$
declare t text;
begin
  foreach t in array array['crm_produtos','crm_funis','crm_criativos','crm_gastos_midia','crm_etapas','crm_templates','crm_contatos','crm_oportunidades','crm_movimentos','crm_mensagens','crm_notas','crm_tarefas','crm_ligacoes','crm_propostas','crm_pagamentos','crm_ocorrencias','crm_emails']
  loop
    execute format('drop policy if exists %I on %I', t || '_ler', t);
    execute format('create policy %I on %I for select to authenticated using (crm_eh_operador())', t || '_ler', t);
    execute format('drop policy if exists %I on %I', t || '_escrever', t);
    execute format('create policy %I on %I for all to authenticated using (crm_pode_escrever()) with check (crm_pode_escrever())', t || '_escrever', t);
  end loop;
end $$;

-- Nada é público (anon não acessa nenhuma tabela). Webhooks entram pelo servidor com service_role.
revoke all on all tables in schema public from anon;
