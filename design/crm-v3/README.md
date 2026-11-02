# Design CRM v3

Referência visual da live (28/10/2026).

O pacote completo (`prototipos/`, `tokens/`, `components/crm-ui.tsx`, `design-system-2027/`) vem do export Claude Design `CRMIPD - IA Para Donos.zip`.

Neste repositório a fonte de verdade em código é:

- Tokens e CSS: `src/design-system-2027/`
- Componentes de UI do CRM: `src/screens/` + `src/design-system-2027/components/`
- Tokens de produto: `crm.config.ts`

Para atualizar o visual a partir de um novo export:

1. Descompacte o zip em `design/crm-v3/export/`
2. Diff dos tokens com `src/design-system-2027/tokens/`
3. Aplique Desktop v2 / Mobile 2 na casca (`src/screens/App.tsx`, sidebar em 3 grupos)

Decisões D1–D6 (confirmadas): base DS 2027, acento tinta, cores de agente só em glifo 16px, card parado usa tinta (não vermelho), nav mobile Hoje·Funil·Conversas·Leads·Mais, vidro só nas barras.
