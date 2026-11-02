# Checklist da live (28/10/2026)

Cada afirmação da live e onde está no repo. Critério de “tudo que falei é verdade”.

| # | Afirmação | Onde | Como testar | Status |
| --- | --- | --- | --- | --- |
| 1 | CRM v3 com telas operacionais (Hoje, Funil, Conversas, Contatos, Demanda, Placar) | `src/screens/*` | `npm run dev` → navegar sidebar | verdade |
| 2 | Seis agentes: Cláudio, Scout, Scribe, Ledger, Pilot, Eco | `crm.config.ts`, `src/lib/agents/`, tela Agentes | `#/agentes` → Executar exemplo | verdade |
| 3 | Cláudio nunca fala preço | `src/domain/rules.ts` `mencionaPreco` / `podeRoboEnviar`; agente claudio | `npm test`; POST `/api/agents/claudio` com preço no rascunho | verdade |
| 4 | Scout acha oportunidade por conversa ou silêncio | `src/lib/agents` scout + `decision-engine` | Executar Scout com nota 9 / silêncio 36h | verdade |
| 5 | Scribe resume reunião e gera atividades | `src/lib/agents` scribe | Executar Scribe | verdade |
| 6 | Ledger monitora 7 dias / logins; nunca automático; nunca cobra | agente ledger + constraint SQL | Modo Auto desabilitado na UI; payload `nuncaCobra` | verdade |
| 7 | Pilot follow-ups com cooldown 48h e teto 14 dias | agente pilot + `crm.config.ts` | Executar com `horasDesdeUltimaAutomatica: 10` | verdade |
| 8 | Eco prepara briefing antes da reunião | agente eco | Executar Eco | verdade |
| 9 | Três funis: perpétuo, live semanal, imersão | `crm.config.ts` funis; Demanda | Tela Demandas / Produtos | verdade |
| 10 | Métricas / CPL / taxas por etapa | `src/domain/metricas.ts`, Relatórios, MCP `crm_metricas_funis` | Tela Relatórios + Demandas | verdade |
| 11 | Editar por linguagem natural (Cursor / GrokBot) | `AGENTS.md`, `.cursor/rules`, MCP | Conectar MCP e pedir farol vermelho | verdade |
| 12 | Conta gratuita Supabase + Vercel | `IMPLEMENTAR.md` | Seguir guia | verdade |
| 13 | Clone no GitHub e instalar | este repo público | `git clone` + `npm i` + `npm run dev` | verdade |
| 14 | Guia de implementação arrastável | `IMPLEMENTAR.md` | Arrastar no Cursor | verdade |
| 15 | WhatsApp por QR | WPP Engine padrão (`src/lib/whatsapp/wpp-engine.ts`, onboarding, `/api/whatsapp`); WAHA opcional (`docker-compose.waha.yml`) | Integrações › WhatsApp: colar key + telefone → QR | verdade (precisa key real do Engine para conectar de verdade) |
| 16 | Assumir / devolver com aviso | domínio comandos + MCP `crm_conversa_assumir` | Tela Conversas | verdade |
| 17 | Ocorrências do Cláudio | tela Ocorrências + MCP | Registrar ocorrência | verdade |
| 18 | Vários usuários / supervisão | `crm_operadores`, papéis | Entrada com operadores | verdade |
| 19 | MCP com níveis | `src/lib/mcp/niveis.ts`, tokens demo | GET `/api/mcp/crm` com Bearer | verdade |
| 20 | Framework Mastra / LLM Anthropic plugável | deps `@mastra/core`, `ANTHROPIC_API_KEY` | Sem chave: regras locais | verdade |
| 21 | Jev para decisão rápida | `src/lib/agents/decision-engine.ts` | Sem token: fallback local | verdade (fallback) |
| 22 | Disparo de e-mail em massa | docs | — | em breve |
| 23 | Agente de cobrança | docs | — | em breve |
| 24 | Agente coach / v4 e-mail marketing | docs | — | em breve |
| 25 | `npm run setup` / `doctor` zero-config | `scripts/setup.ts`, `scripts/doctor.ts` | rodar os scripts | verdade |
