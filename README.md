# CRM do dono

Um CRM de vendas completo em que **a IA qualifica e o humano fecha**. Feito para a comunidade IA para Donos: roda no seu computador em 2 minutos, sem banco de dados e sem deploy, e já vem com API, webhooks e MCP para você ligar ao Grokbot, ao Cursor e aos seus canais de tráfego quando quiser.

Tudo em TypeScript (Vite + React no front, Hono no servidor). Português do começo ao fim.

## O que tem dentro

| Área | O que faz |
| --- | --- |
| **Demandas** | Leads, qualificados, ofertas, vendas, receita, gasto em mídia, custo por lead, custo por venda, visita→lead. Por período (hoje, 7 dias, 30 dias), comparado com o período anterior, por funil de entrada (Perpétuo, Live semanal, Evento) e por criativo. |
| **Hoje** | O que fazer agora, em ordem: quem pediu humano, prazos vencidos, tarefas, próximas ações sugeridas. |
| **Funil** | Kanban com 8 etapas. Arraste para mover; etapas automáticas o sistema move; pular ou voltar exige motivo. Valor em aberto por etapa. |
| **Conversas** | O Cláudio (IA) conversa, qualifica com a Pergunta Matadora e faz handoff. Você assume, envia, devolve. Templates, notas internas, registrar ocorrência marcando trechos. |
| **Contatos** | Ficha completa: linha do tempo, ligações com transcrição, tarefas, e-mails com modelos, pagamentos, propostas, oportunidades. Briefing → proposta → oferta com condição → link de pagamento. |
| **Ligação** | De dentro do CRM: aviso de gravação, cronômetro, transcrição com trechos marcados (dor, meta, prazo, objeção, decisão), termômetro obrigatório, follow-ups que viram tarefas. Discagem rápida de qualquer tela. |
| **Relatórios** | Vendas e receita do mês, projeção, ticket médio, conversão por etapa contra a sua meta, motivos de perda, conta reversa com as suas taxas reais. |
| **Ocorrências** | O vendedor marca onde o agente errou; o dono responde e ajusta. É daqui que o Cláudio melhora. |
| **Playbook** | Pergunta Matadora das 8 etapas, com faixas, complementares, objeções, condição e próximo passo. Por produto. |
| **Produtos e funis** | Múltiplos produtos (com gatilhos de oferta e playbook próprio), funis de entrada, criativos, gasto de mídia. |
| **Operadores e chaves** | Humanos e IAs, papéis (dono, vendedor, leitura, bot), chaves de API por escopo. |
| **Integrações** | Prompt pronto para o Grokbot, configuração MCP, exemplos de webhook, exportar/importar, zerar. |
| **API + webhooks** | `POST /api/leads` (qualquer canal), `POST /api/webhooks/whatsapp`, `POST /api/webhooks/pagamento`, métricas, funil, contatos. |
| **MCP** | `resumo_do_dia`, `buscar_metricas`, `listar_contatos`, `ver_contato`, `listar_funil`… e, com chave de escrita, `criar_lead`, `mover_etapa`, `enviar_mensagem`… |

## Rodar em 2 minutos

```bash
npm install
npm run dev          # abre http://localhost:5173 (dados no navegador, sem servidor)
```

Entre como "Otávio" ou "João (dono)". Os dados são de exemplo e ficam no seu navegador. Para zerar: Integrações → Dados.

Para receber leads de fora e conectar o Grokbot, suba também o servidor:

```bash
cp .env.example .env.local      # descomente VITE_API_URL e VITE_API_KEY
npm run dev:all                 # front em :5173 + API em :8787
curl http://localhost:8787/api/saude
```

Passo a passo completo, com o primeiro lead via `curl` e o MCP no Cursor: [docs/instalacao.md](docs/instalacao.md).

```bash
npm test             # 76 testes (regras, Cláudio, comandos, métricas, API)
npm run typecheck    # front + servidor
npm run build
```

Precisa de Node 20 ou mais novo.

## Como o CRM é pensado

1. **Contato** é a pessoa. **Oportunidade** é uma chance de vender um produto para ela. Um contato pode ter várias. **Categoria** (lead, prospect, cliente) é calculada; ninguém edita.
2. **Funil de venda com 8 etapas**: Lead novo → Em conversa → Handoff → Briefing feito → Proposta aberta → Oferta com condição → Pago → Dentro. Cada etapa tem um Canvas: objetivo, como validar, prazo, meta, quem move, motivos de perda. "Proposta aberta", "Pago" e "Dentro" são movidas pelo sistema (abertura, pagamento, acesso).
3. **Pergunta Matadora**: uma por etapa. Na qualificação, nota de 0 a 10: 0-6 nutre, 7-8 convida, 9-10 passa ao humano. Pedir preço ou pedir humano também passa.
4. **Handoff**: o Cláudio qualifica, o humano fecha. A troca de mão sempre avisa o contato.
5. **Regra de ouro**: o robô nunca fala preço, desconto, parcela ou condição. Trava em código (`mencionaPreco`, `sanitizarFalaDoRobo`), não só no prompt.
6. **Oferta** só com condição verdadeira cadastrada no produto, com prazo. Nunca inventada na hora.
7. **Ligação** gravada só com aviso. Transcrição marcada, termômetro do vendedor manda, follow-ups viram tarefas.
8. **Tudo é comando**: cada mudança passa por `aplicar(estado, comando)` em `src/domain/comandos.ts`. Mesma regra no navegador, no servidor, no MCP e nos testes.

## Mapa das pastas

```
src/domain/     tipos, regras, comandos, Cláudio, métricas, playbook (puro; roda em qualquer lugar)
src/data/       estado de exemplo
src/repo/       onde o estado mora: localStorage ou HTTP (servidor)
src/app/        contexto React (estado, operador, rotas)
src/screens/    as telas
src/ds/         design system
src/adapters/   telefonia e transcrição (simuladas no navegador)
server/         API Hono, store em JSON, MCP, Cláudio com LLM opcional, adaptadores de WhatsApp/e-mail/pagamento
supabase/       schema.sql e seed.sql (recomendação para quando ligar um banco)
docs/           PRD, instalação, banco, deploy, integrações, Grokbot, plano para o Cursor
tests/          76 testes
```

## Documentação

- [docs/PRD.md](docs/PRD.md): o produto, personas, regras, fora de escopo.
- [docs/instalacao.md](docs/instalacao.md): do zero ao primeiro lead e ao MCP no Cursor.
- [docs/integracoes.md](docs/integracoes.md): Meta Lead Ads, Google Ads, formulários, WhatsApp (Z-API/Evolution/oficial), telefonia, transcrição, e-mail, pagamento, LGPD.
- [docs/grokbot.md](docs/grokbot.md): os três níveis de acesso (leitura, Cursor, navegador) e o prompt.
- [docs/banco-de-dados.md](docs/banco-de-dados.md): quando e como ligar o Supabase sem reescrever o CRM.
- [docs/deploy.md](docs/deploy.md): publicar front, API e MCP.
- [docs/plano-cursor.md](docs/plano-cursor.md): como evoluir este CRM com o Cursor, um passo por vez, com os prompts.

## Antes de usar com cliente de verdade

- Troque etapas, metas, gatilhos e Pergunta Matadora pelos **seus**. Os números aqui são exemplo.
- Revogue as chaves de exemplo e crie as suas (Operadores e chaves).
- Avise o contato quando a conversa for gravada. Sem aviso, não grave.
- Revise LGPD: finalidade, retenção, quem acessa, pedido de "não me escreva mais" (o Cláudio já respeita).
- Dados no navegador são de um computador só. Para time, suba o servidor; para escala, ligue o banco.

## Licença

MIT. O design system (Design System 2027) e as fontes Geist (licença OFL, via `@fontsource`) acompanham o projeto.
