# Changelog

## 1.1.0 — 2026-11-04

### Relance · Agente Ember (Reciclador de oportunidades)

- Novo agente **Ember** (`ember`) com escolha de modelo próprio por agente (`CRM_EMBER_MODEL`, padrão `claude-sonnet-4-5`) e bloqueio estrito contra fallback genérico sem IA.
- Nova tela isolada **Relance** (`#/relance`): campanhas de reabertura de leads com histórico real, simulação seca em 3 leads, parada de emergência, importação CSV com contexto obrigatório, lista permanente de opt-out e trilha de auditoria por lead.
- Motor de fila e freios (`src/domain/reciclador.ts`, `src/lib/reciclador/`): teto por hora/dia, espaçamento entre envios, janela comercial, recusa de leads sem contexto mínimo, pausa automática se o WhatsApp desconectar e passagem de bastão ao atendimento quando o lead responde.
- Novas ferramentas MCP `crm_reciclador_*` e migration aditiva `20261104000005_crm_ember_reciclador.sql`.
- Correção no `.gitignore` (`/data/` ancorado na raiz) restaurando `src/data/exemplo.ts` no repositório.

## 1.0.0 — 2026-11-02

### Vitrine e documentação

- README de vitrine em português (voz do dono) + espelho `README.en.md`.
- Screenshots commitados em `docs/screenshots/` (Hoje, Funil, Conversas, Leads, Agentes, mobile).
- Marca SVG em `docs/brand/` (lockup + mark do CRM).
- Badges, sumário, FAQ, avisos de ban/LGPD, créditos Oficina IPD.
- Repo canônico documentado: `github.com/oficina-ipd/crm-do-dono-template`.

### Instalação

- `Dockerfile` + `docker-compose.yml` para subir o CRM em modo demo com um comando.
- `docker-compose.waha.yml` permanece só como provedor WhatsApp **opcional**.
- Guia longo inalterado em espírito: `IMPLEMENTAR.md`.

### App (v3 instalável)

- Next.js 15 (App Router) no lugar do Vite educacional `v0.1-vite`.
- Porte visual das telas Hoje, Funil, Conversas, Leads/Clientes, Agentes (casca CRM v3).
- `crm.config.ts` genérico (empresa, produtos, 3 funis, agentes).
- Seis agentes (Cláudio, Scout, Scribe, Ledger, Pilot, Eco) com DecisionEngine; LLM opcional (chave do membro).
- MCP-first: `/api/mcp/crm` + stdio, níveis leitura/escrita/admin.
- WhatsApp via **WPP Engine** (provedor padrão: key uma vez + QR + webhook). WAHA opcional.
- Migrations Supabase (casa + agentes + WhatsApp + seed).
- `npm run setup`, `npm run doctor`, `AGENTS.md`, `docs/LIVE-CHECKLIST.md`.

### Em breve (entregas separadas)

- Disparo de e-mail em massa (multi-token Resend).
- Agente de cobrança (nunca misturado com o Ledger).
- Agente coach e v4 (e-mail marketing).

Ver também [`docs/EM-BREVE.md`](./docs/EM-BREVE.md).
