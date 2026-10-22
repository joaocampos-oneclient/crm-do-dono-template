# Banco de dados · quando e como ligar o Supabase

O CRM **não exige banco**. Ele roda com o estado inteiro em um lugar só:

| Modo | Onde o estado mora | Serve para | Limite |
| --- | --- | --- | --- |
| Navegador | `localStorage` (`crm-do-dono:estado`) | conhecer, testar, uma pessoa | um computador; ~5 MB; sem webhook |
| Servidor local | `server/data/crm.json` | time pequeno na mesma rede, webhooks, MCP | um processo; sem histórico de versões; backup é copiar o arquivo |
| **Banco (Supabase/Postgres)** | tabelas de `supabase/schema.sql` | multiusuário com login, escala, auditoria, BI | precisa de projeto Supabase e do adaptador abaixo |

Troque de modo quando sentir o limite, não antes. O desenho foi feito para a troca ser **sem reescrever telas nem regras**.

## Por que a troca é simples

Toda mudança é um **Comando** aplicado por `aplicar(estado, comando)` (`src/domain/comandos.ts`). O repositório só persiste. Hoje existem dois (`src/repo/local.ts`, `src/repo/http.ts`) e o store do servidor (`server/store.ts`). Um terceiro, `supabase`, implementa a mesma interface:

```ts
interface RepositorioCRM {
  carregar(): Promise<EstadoCRM>;
  despachar(comando: Comando): Promise<EstadoCRM>;
  assinar(cb: (estado: EstadoCRM) => void): () => void;
}
```

E o `EstadoCRM` é **normalizado**: cada array é uma tabela com o mesmo nome (`contatos` → `crm_contatos`, `movimentos` → `crm_movimentos`…). Os campos em `camelCase` viram `snake_case`; valores em reais viram `*_centavos`.

## Caminho recomendado (servidor como única porta para o banco)

Não ligue o navegador direto no banco no começo. Mantenha o **servidor** como a única peça que fala com o Postgres: o front continua usando `src/repo/http.ts`, os webhooks e o MCP continuam iguais, e só `server/store.ts` muda. Isso evita expor regras e segredos no front e mantém um único escritor.

### Passo 1 · Criar o projeto e rodar o schema

1. Crie um projeto novo no Supabase (de teste primeiro).
2. SQL Editor → cole `supabase/schema.sql` → Run. Depois `supabase/seed.sql`.
3. Em Authentication, crie os usuários humanos (e-mail + link mágico). Ligue cada um ao operador:
   `update crm_operadores set user_id = '<uuid>' where email = 'otavio@exemplo.com';`

### Passo 2 · Store em Postgres no servidor

Crie `server/store.supabase.ts` com a mesma interface de `Store`:

- `estado()`: carrega todas as tabelas (`select * from crm_*`) e monta o `EstadoCRM` (conversão de nomes e centavos). Para CRMs pequenos, carregar tudo é rápido e mantém as regras puras. Cacheie em memória e invalide a cada escrita.
- `despachar(cmd)`: aplica `aplicar(estadoAtual, cmd)` em memória, calcula o **diff** entre o estado anterior e o novo (linhas novas/alteradas por tabela) e grava numa transação. Como todo id é gerado antes (`novoId`), o diff é por `id`. Um `upsert` por tabela alterada resolve.
- `versao()`: um contador na tabela `crm_config` ou `max(em)` de `crm_movimentos`.

Use `@supabase/supabase-js` com a **service_role** (só no servidor) ou `pg` direto. Depois troque em `server/index.ts`:

```ts
const store = process.env.SUPABASE_URL ? criarStoreSupabase(...) : criarStore(dados);
```

Peça ao Cursor com este prompt: "Implemente `server/store.supabase.ts` com a interface `Store` de `server/store.ts`, carregando o `EstadoCRM` das tabelas de `supabase/schema.sql` e persistindo o diff após `aplicar`. Mapeie camelCase→snake_case e reais→centavos. Escreva um teste que roda o mesmo cenário de `tests/comandos.test.ts` contra um Postgres local (docker)."

### Passo 3 · Login

Hoje o login é local (escolha do operador). Com Supabase:

- Front: `supabase.auth.signInWithOtp({ email })` (link mágico). Guarde o JWT.
- Servidor: aceite `Authorization: Bearer <jwt>` além de `x-api-key`; valide com `supabase.auth.getUser(jwt)`, ache o operador por `user_id` e aplique o escopo pelo papel (`dono`/`vendedor` escrevem, `leitura`/`bot` só leem).
- Chaves de API continuam para integrações e agentes.

### Passo 4 · Migrar os dados que você já tem

Integrações → Dados → **Exportar estado (JSON)**. O JSON tem as mesmas tabelas. Um script (peça ao Cursor) percorre cada array e faz `insert` em ordem: operadores, produtos, funis, criativos, etapas, templates, chaves, contatos, oportunidades, movimentos, mensagens, notas, tarefas, ligações, propostas, pagamentos, ocorrências, e-mails, gastos.

## Se quiser o navegador direto no banco (sem servidor)

Possível para um CRM de uma pessoa, com `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` e RLS. Escreva `src/repo/supabase.ts` com `RepositorioCRM`: `carregar` lê as tabelas; `despachar` aplica o comando e grava o diff com o cliente autenticado; `assinar` usa Realtime (`supabase.channel(...).on('postgres_changes', ...)`). Limitações: webhooks e MCP precisam de servidor de qualquer forma; a trava de regras fica no cliente (quem tem o JWT pode gravar direto nas tabelas, respeitando só o RLS). Por isso o caminho recomendado é o servidor.

## RLS resumido

- `crm_operadores`: operador lê a lista; só dono escreve.
- `crm_chaves_api`, `crm_config`: só dono.
- Demais tabelas: operador ativo lê; `dono` e `vendedor` escrevem; `leitura` e `bot` só leem.
- `anon` não acessa nada. Webhooks entram pelo servidor com service_role.

## Storage

- Bucket **privado** `ligacoes` para áudio. Grave só o caminho em `crm_ligacoes.audio_path`; sirva com URL assinada curta.
- Bucket `propostas` se quiser hospedar PDFs; o link rastreado dispara `registrarAberturaProposta`.

## Backups

- Supabase faz backup diário nos planos pagos; no free, exporte com `pg_dump` ou pelo painel toda semana.
- Enquanto estiver no JSON: copie `server/data/crm.json` (é texto; dá para versionar num repositório privado).
