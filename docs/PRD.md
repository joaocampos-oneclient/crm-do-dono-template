# PRD · CRM do dono

Documento de produto do CRM entregue à comunidade IA para Donos. Serve para você entender o que foi construído, por quê, e o que fica fora. Também é o texto que você cola no Cursor quando quiser mudar algo com contexto.

## 1. Problema

Dono de negócio pequeno vende pelo WhatsApp e perde: lead que não é respondido, lead respondido tarde, conversa sem registro, proposta sem follow-up, venda sem saber de qual anúncio veio. CRMs de mercado são genéricos, caros por assento e não conversam com o lead.

## 2. Solução em uma frase

Um CRM em que **um agente de IA (Cláudio) atende e qualifica todo lead na hora, e o humano só entra quando vale a pena**, com cada etapa do funil medida contra uma meta que o dono escolheu.

## 3. Personas

| Persona | O que precisa | Telas |
| --- | --- | --- |
| **Dono** (João) | Saber quantos leads entraram, quanto custou, quanto virou venda; onde o funil vaza; onde o Cláudio erra. | Demandas, Relatórios, Ocorrências, Produtos, Operadores |
| **Vendedor** (Otávio) | Saber o que fazer agora; assumir conversa; ligar; registrar briefing; mandar proposta e oferta. | Hoje, Conversas, Contatos, Funil, Ligação |
| **Cláudio** (IA) | Abrir a conversa, fazer a Pergunta Matadora, decidir nutrir/convidar/handoff, nunca falar de preço. | Conversas (como autor), Playbook |
| **Agente externo** (Grokbot, Cursor, bot de navegador) | Ler métricas e contatos; agir com permissão; mudar código com regras. | MCP, API, Integrações |

## 4. Modelo de dados

- **Contato** (pessoa) 1→N **Oportunidade** (uma por produto). Categoria do contato calculada: cliente > prospect > lead.
- **Funil de entrada** (de onde veio: Perpétuo, Live, Evento) ≠ **Funil de venda** (8 etapas).
- **Movimento**: toda mudança de etapa. É a fonte de conversões, CPV e linha do tempo.
- **Mensagem** (contato / robô / humano), **Nota** interna, **Tarefa**, **Ligação** (com transcrição e termômetro), **Proposta**, **Pagamento**, **Ocorrência**, **E-mail**, **Template**, **Gasto de mídia**, **Criativo**, **Operador**, **Chave de API**.
- Estado normalizado em `src/domain/types.ts`; tabelas 1:1 em `supabase/schema.sql`.

## 5. Funil de venda

| # | Etapa | Quem move | Validação | Prazo | Meta |
| --- | --- | --- | --- | --- | --- |
| 1 | Lead novo | robô | nome + WhatsApp + origem | 5 min | 70% |
| 2 | Em conversa | robô | respondeu e deu nota 0-10 | 1 dia | 35% |
| 3 | Handoff | humano | humano respondeu no chat | 2 h | 80% |
| 4 | Briefing feito | humano | dor, meta e data na ficha | 2 dias | 80% |
| 5 | Proposta aberta | sistema | contato abriu a proposta | 2 dias | 85% |
| 6 | Oferta com condição | humano | link com condição e validade | 2 dias | 45% |
| 7 | Pago | sistema | pagamento confirmado | — | 95% |
| 8 | Dentro | sistema | primeiro acesso | 7 dias | 100% |

Metas são do dono, não benchmark. Revisar com 30 dias de dado real.

## 6. Regras de negócio (todas em código, todas com teste)

1. Nota nunca é inventada: sem número claro, pergunta de novo.
2. Nota 0-6 nutre; 7-8 convida; 9-10 handoff. Pedir preço, pedir humano ou querer entrar = handoff, qualquer nota.
3. O robô nunca fala preço/desconto/parcela/condição. Toda fala do robô passa por `sanitizarFalaDoRobo`.
4. Troca de mão (assumir/devolver) sempre gera aviso ao contato.
5. Etapas automáticas só o sistema move. Pular ou voltar etapa exige motivo. Perder exige motivo.
6. Briefing (dor, meta, data) é pré-requisito de proposta. Proposta aberta é evento do contato, não do vendedor.
7. Oferta exige condição cadastrada no produto, com validade de 1 a 30 dias.
8. Ligação só grava com aviso. Termômetro do vendedor é obrigatório e vale sobre o da IA.
9. Telefone é chave natural: lead repetido não duplica.
10. "Não quero mais contato" encerra e marca perdido (LGPD).
11. Amostra menor que 10 não vira porcentagem.

## 7. Métricas

- **Demandas**: leads (contatos criados), qualificados (chegaram a Handoff), ofertas, vendas (chegaram a Pago), receita (pagamentos pagos), gasto, visitas, CPL, CPV, visita→lead, lead→venda. Por período (hoje/7d/30d) comparado ao anterior; por funil de entrada; por criativo.
- **Relatórios**: vendas hoje/mês, receita do mês, projeção linear, ticket médio, conversão por etapa vs meta, valor em aberto por etapa, motivos de perda, conta reversa com taxas reais.

## 8. Integrações

- **Entrada**: `POST /api/leads` universal (simples ou `field_data` do Meta). Origem = id do funil.
- **WhatsApp**: `POST /api/webhooks/whatsapp` recebe mensagem; o robô responde; a resposta volta no corpo e sai pelo adaptador.
- **Pagamento**: `POST /api/webhooks/pagamento` confirma e move para Pago.
- **Proposta**: `POST /api/webhooks/proposta-aberta` move para Proposta aberta.
- **MCP** (stdio) para Grokbot/Cursor com escopo por chave.
- **Saídas**: toda mensagem de robô/humano e todo e-mail novo vão para os adaptadores do servidor (locais no template).

## 9. Segurança e acesso

- Chaves de API com escopo `leitura` ou `escrita`, revogáveis. Chave mestra opcional por ambiente.
- Papéis: dono, vendedor, leitura, bot. No banco, RLS por papel.
- Segredos só no servidor. Front nunca vê service_role nem chave de LLM.
- LGPD: aviso de gravação, direito de parar, áudio em bucket privado, retenção definida pelo dono.

## 10. Fora de escopo desta versão

- Envio real por WhatsApp/telefonia/e-mail/pagamento (adaptadores locais + guia de troca).
- Login com senha/SSO (login local por operador; guia para Supabase Auth).
- Multiempresa (uma empresa por instalação).
- Outbound (scraper do Google Maps): próximo passo sugerido em docs/plano-cursor.md.
- Cláudio ouvindo a ligação e agindo sozinho (follow-up de segurança): idem.

## 11. Critérios de pronto

- `npm run typecheck`, `npm test` e `npm run build` verdes.
- `npm run dev` abre com dados de exemplo; todas as telas navegáveis; nenhuma ação depende de rede.
- `npm run dev:all` + `curl POST /api/leads` cria lead que aparece em Demandas, Funil e Conversas com a abertura do Cláudio.
- MCP responde `resumo_do_dia` no Cursor.
