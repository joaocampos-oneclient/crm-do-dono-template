# Design CRM v3

Referência visual da live (28/10/2026) — Desktop v2 / Mobile 2.

## O que há neste repo

| Caminho | Conteúdo |
| --- | --- |
| `src/design-system-2027/` | Tokens + componentes (fonte de verdade em código) |
| `src/lib/nav.ts` | Sidebar 3 grupos + tabbar mobile Hoje·Funil·Conversas·Leads·Mais |
| `src/screens/App.tsx` | Casca Desktop v2 / Mobile 2 |
| `src/app/entrar/page.tsx` | Gate magic-link fiel a `crm.iaparadonos.com/entrar` |
| `design/crm-v3/reference/` | Capturas públicas do CRM em produção (só login) |

## O que **não** está versionado

O pacote Claude Design `CRMIPD - IA Para Donos.zip` (**prototipos/**, HTML/PNG Desktop v2 e Mobile 2) **não foi encontrado** em nenhuma branch nem no histórico deste repositório (`main`, `cursor/crm-v3-instalavel-83e7`, `cursor/crm-do-dono-completo-7025`). Só este README citava o zip.

Para atualizar a partir de um novo export:

1. Descompacte o zip em `design/crm-v3/export/`
2. Diff dos tokens com `src/design-system-2027/tokens/`
3. Confira a casca em `src/screens/App.tsx` + `src/lib/nav.ts`

## Referência usada nesta entrega

Sem o zip, a fidelidade usou:

1. Tokens já portados em `src/design-system-2027/` (DS 2027)
2. Decisões D1–D6 (abaixo)
3. Captura pública de https://crm.iaparadonos.com/entrar (demais telas exigem magic link — não acessíveis sem credencial)

## Decisões D1–D6 (confirmadas)

1. Base DS 2027
2. Acento tinta (`--fg`)
3. Cores de agente só em glifo 16px
4. Card parado usa tinta (não vermelho)
5. Nav mobile: **Hoje · Funil · Conversas · Leads · Mais**
6. Vidro só nas barras (tabbar / toast / CTA)
