# Implementar o CRM do dono em menos de 1 hora

Arraste este arquivo no Cursor ou no GrokBot e diga: **siga o IMPLEMENTAR.md até o login funcionar**.

Você só cria contas e cola chaves. O resto é automático.

## 1. Contas (gratuitas)

1. [GitHub](https://github.com) — clone este repositório
2. [Supabase](https://supabase.com) — projeto novo (região perto de você)
3. [Vercel](https://vercel.com) — importe o repositório
4. (Opcional) [Anthropic](https://console.anthropic.com) — chave para os agentes
5. (Opcional) WhatsApp: conta no [WPP Engine](https://wpp-engine.oneclient.com.br) (padrão). WAHA só se você quiser o adaptador alternativo.

## 2. Local (2 minutos)

```bash
git clone <url-deste-repo>
cd crm-do-dono-template
npm install
cp .env.example .env.local
npm run doctor
npm run dev
```

Abra http://localhost:3000 — modo demo, sem banco. Escolha um operador e use.

## 3. Ligar o Supabase

No `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

No SQL Editor do Supabase, rode na ordem:

1. `supabase/migrations/20261102000000_crm_casa.sql`
2. `supabase/migrations/20261102000002_crm_agentes.sql`
3. `supabase/migrations/20261102000003_crm_whatsapp_wpp_engine.sql`
4. `supabase/migrations/20261102000001_crm_seed_demo.sql` (opcional)

Ou: `npm run db:push` e cole `supabase/all.sql`.

Auth → URL Configuration → Redirect URLs: `http://localhost:3000/auth/callback` e a URL da Vercel.

## 4. Deploy na Vercel

1. Importar o repo
2. Colar as mesmas env vars (sem `SUPABASE_SERVICE_ROLE_KEY` no client — só Server)
3. Deploy
4. Atualizar `NEXT_PUBLIC_APP_URL` e as Redirect URLs do Supabase

## 5. MCP no Cursor (1 clique)

Em Integrações, ou cole em `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "crm-do-dono": {
      "url": "https://SEU_DOMINIO/api/mcp/crm",
      "headers": { "Authorization": "Bearer crm_demo_escrita" }
    }
  }
}
```

Local sem deploy:

```json
{
  "mcpServers": {
    "crm-do-dono": {
      "command": "npx",
      "args": ["tsx", "scripts/mcp-stdio.ts"],
      "cwd": "/caminho/absoluto/deste-repo",
      "env": { "CRM_MCP_NIVEL": "escrita" }
    }
  }
}
```

Teste: “liste as ferramentas do CRM” e “resumo do funil”.

## 6. WhatsApp (WPP Engine — padrão)

1. Na home do CRM ou em **Integrações › WhatsApp**, clique **Criar conta no WPP Engine** (abre o console: signup + checkout → key `wae_live_…`).
2. Cole a key **uma vez** e o telefone em E.164 (`+5511…`).
3. Clique **Integrar meu WhatsApp**. O CRM sozinho:
   - valida a key (`GET /v1/tenants/me`)
   - cria a sessão (`POST /v1/sessions`)
   - mostra o QR (refresh automático)
   - gera `webhook_secret` e registra (`PATCH /v1/tenants/me`)
4. Escaneie o QR no celular.

Env opcional (se preferir não colar na UI):

```
WPP_API_BASE_URL=https://wpp-engine.oneclient.com.br/v1
WPP_API_KEY=wae_live_…
WPP_SESSION_ID=
WPP_WEBHOOK_SECRET=
WPP_CONSOLE_URL=https://wpp-engine.oneclient.com.br
```

Contrato completo: `docs/wpp-engine-contrato.md`.  
**Não use** o legado `wpp-api.oneclient.tech`.

### Alternativa WAHA (não recomendada)

```bash
WHATSAPP_PROVIDER=waha
WAHA_URL=http://localhost:3001
docker compose -f docker-compose.waha.yml up -d
```

### Futuro (sem colar token)

OAuth / device-link: interface `startConnect` / `completeConnect` já existe; o Engine ainda não expõe. Quando existir, a UI troca o campo de key pelo redirect automático.

## 7. Se travar

- `npm run doctor`
- Live de suporte da comunidade (terças)
- Canal de dúvidas técnicas

## Em breve (não bloqueia o uso)

- Disparo de e-mail em massa (vários tokens Resend)
- Agente de cobrança
- Agente coach / v4
