# Deploy · publicar quando quiser

Nada aqui é obrigatório para usar o CRM. Publique quando precisar de: webhooks chegando da internet (Meta, WhatsApp, pagamento), time acessando de fora, ou Grokbot em nuvem.

São três peças, publicáveis separadamente:

| Peça | O que é | Onde publicar |
| --- | --- | --- |
| **Front** | site estático (`dist/`) | Vercel, Netlify, Cloudflare Pages, qualquer hospedagem de arquivos |
| **API** | servidor Node (Hono) em `server/index.ts` | Railway, Render, Fly.io, VPS; ou Vercel Functions com adaptação |
| **MCP** | `server/mcp.ts` por stdio (roda onde o cliente MCP está) ou remoto por HTTP | junto do cliente (Cursor) ou junto da API |

## Antes de publicar

1. **Revogue as chaves de exemplo** e crie as suas em Operadores e chaves. Elas estão no código-fonte público (`src/data/exemplo.ts`).
2. Defina `CRM_API_KEY` forte no servidor (chave mestra para webhooks de terceiros).
3. Nunca use `CRM_SEM_AUTH=1` fora da sua máquina.
4. Decida a persistência: arquivo JSON num disco persistente (Railway Volume, VPS) ou banco ([banco-de-dados.md](banco-de-dados.md)). Em plataformas serverless o disco some entre execuções: aí é banco.
5. Configure `CRM_URL_PUBLICA` com a URL final da API (vai para os textos de integração).

## Front (Vite)

```bash
VITE_API_URL=https://api.seudominio.com VITE_API_KEY=crm_escrita_... npm run build
```

Suba `dist/`. Na Vercel: importe o repositório, framework Vite, build `npm run build`, output `dist`, e as duas variáveis em Environment Variables. Como o front é estático, `VITE_API_KEY` fica visível para quem abrir o site: proteja o site (Vercel Password Protection, Cloudflare Access) ou migre para login com Supabase Auth, em que a chave de escrita sai do front e cada usuário leva seu JWT.

Rotas são por hash (`#/funil`), então não precisa de rewrite.

## API (Hono + Node)

### Railway / Render / Fly.io (recomendado para começar)

- Build: `npm ci`
- Start: `npm run start:server` (usa `tsx`; se preferir compilar, adicione um `tsc -p tsconfig.server.json --outDir build` e rode `node build/server/index.js`)
- Variáveis: `PORT` (a plataforma define), `CRM_API_KEY`, `CRM_URL_PUBLICA`, `CRM_DADOS=/data/crm.json` com um volume montado em `/data`, e opcionalmente `LLM_*`.
- Healthcheck: `GET /api/saude`.

### VPS (Ubuntu)

```bash
git clone ... && cd crm-do-dono && npm ci
cp .env.example .env.local   # preencha
npx pm2 start "npm run start:server" --name crm-api
```

Coloque Caddy ou Nginx na frente com HTTPS (Let's Encrypt). Backup diário de `server/data/crm.json`.

### Vercel Functions / Cloudflare Workers

Hono roda nos dois, mas o store em arquivo não. Use banco ([banco-de-dados.md](banco-de-dados.md)) e exporte o app:

```ts
// api/[...rota].ts (Vercel)
import { handle } from "hono/vercel";
import { criarApi } from "../server/api";
import { criarStoreSupabase } from "../server/store.supabase";
export default handle(criarApi({ store: criarStoreSupabase(), chaveMestra: process.env.CRM_API_KEY }));
```

### Supabase Edge Functions (alternativa)

Se tudo já estiver no Supabase, as rotas de webhook podem virar Edge Functions (Deno) que aplicam o mesmo `aplicar` do domínio (`src/domain` não tem dependência de Node). É mais trabalho de empacotamento; comece por Railway.

## MCP

- **Local (Cursor na sua máquina)**: não precisa publicar. `server/mcp.ts` roda por stdio e fala com a API publicada (`CRM_API_URL=https://api.seudominio.com`).
- **Remoto (Grokbot em nuvem)**: rode o MCP junto da API usando `StreamableHTTPServerTransport` do `@modelcontextprotocol/sdk` numa rota (ex.: `/mcp`), protegida por chave. Peça ao Cursor: "Exponha `criarServidorMcp()` em `/mcp` com StreamableHTTPServerTransport, validando `x-api-key` como a API". Alternativa sem MCP: o Grokbot consome a API REST com a chave de leitura.

## Domínios e CORS

A API aceita qualquer origem por padrão (`cors({ origin })`). Em produção, restrinja em `server/api.ts` para o domínio do front.

## Custos de referência (outubro/2026, ordem de grandeza)

| Peça | Grátis até | Depois |
| --- | --- | --- |
| Front na Vercel/Netlify | uso pessoal | US$ 20/mês por membro |
| API no Railway | US$ 5 de crédito/mês | ~US$ 5-10/mês para este app |
| Supabase | 500 MB, 50 k usuários | US$ 25/mês |
| LLM para o Cláudio | — | centavos por conversa com modelos pequenos |
| WhatsApp (Z-API / Evolution) | Evolution é grátis na sua VPS | Z-API ~R$ 100/mês por número |

## Checklist de produção

- [ ] Chaves de exemplo revogadas; chaves próprias criadas e guardadas fora do código.
- [ ] `CRM_SEM_AUTH` ausente.
- [ ] Persistência em disco persistente ou banco; backup configurado.
- [ ] HTTPS na API e no front.
- [ ] CORS restrito ao domínio do front.
- [ ] Webhooks dos provedores validando assinatura antes de chamar a API.
- [ ] Aviso de gravação e política de retenção definidos (LGPD).
- [ ] `npm run build` e `npm test` verdes no commit publicado.
