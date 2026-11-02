# CRM do dono · v3 instalável

Template completo da comunidade **IA para Donos**. O que foi mostrado na live semanal: funil, agentes, WhatsApp por QR, MCP para Cursor e GrokBot.

**Você só cria as contas (Vercel, Supabase, Anthropic) e cola as chaves.** O resto está neste repositório.

## Rodar em 2 minutos (modo demo)

```bash
npm install
npm run doctor
npm run dev        # http://localhost:3000
npm test
```

Sem `.env.local` o CRM usa dados de exemplo no navegador. Nada sai da sua máquina.

## Produção (Supabase + Vercel)

Siga o guia completo: **[IMPLEMENTAR.md](./IMPLEMENTAR.md)**.

```bash
cp .env.example .env.local
# cole URL e chaves do Supabase
npm run setup
npm run db:push   # gera supabase/all.sql para colar no SQL Editor
```

## O que vem pronto

| Parte | Estado |
| --- | --- |
| Telas (Hoje, Funil, Conversas, Contatos, Demanda, Relatórios, Agentes…) | Pronto |
| 6 agentes (Cláudio, Scout, Scribe, Ledger, Pilot, Eco) | Pronto (regras + DecisionEngine; LLM opcional) |
| MCP Cursor / GrokBot (~20 ferramentas) | Pronto em `/api/mcp/crm` |
| WhatsApp via WAHA (QR) | Pronto (`docker compose up`) |
| Schema SQL + RLS + agentes | Pronto em `supabase/migrations/` |
| E-mail em massa / cobrança / coach | Em breve (ver `docs/LIVE-CHECKLIST.md`) |

## MCP em 1 minuto

Token demo: `crm_demo_escrita`

```bash
curl -s -H "Authorization: Bearer crm_demo_escrita" \
  -H "Content-Type: application/json" \
  -d '{"tool":"crm_funil_resumo","arguments":{}}' \
  http://localhost:3000/api/mcp/crm
```

Config do Cursor: ver `IMPLEMENTAR.md` e `.cursor/mcp.json.example`.

## Editar com IA

Abra o projeto no Cursor, leia `AGENTS.md` e peça em português:

> Na tela de funil, ponha farol vermelho nas oportunidades com problema com o Cláudio.

## Checklist da live

Cada frase da live de 28/10 → [`docs/LIVE-CHECKLIST.md`](./docs/LIVE-CHECKLIST.md).

## Licença

MIT. Design System 2027 e fontes Geist (OFL) acompanham o template.
