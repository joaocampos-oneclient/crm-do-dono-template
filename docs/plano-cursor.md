# Plano para o Cursor · como evoluir este CRM um passo por vez

Este é o "plano para jogar no Cursor". Cada passo é pequeno, tem um prompt pronto e um jeito de conferir. Faça na ordem ou pule para o que dói mais. Antes de qualquer passo, cole o **prompt base** uma vez na conversa.

## Prompt base (cole primeiro)

```text
Você vai me ajudar a evoluir o "CRM do dono". Eu sou empreendedor, não programador: explique em
português simples e entregue em passos pequenos.

Contexto: leia README.md, docs/PRD.md, src/domain/types.ts, src/domain/comandos.ts,
src/domain/funil.ts e server/api.ts. O estado de exemplo está em src/data/exemplo.ts.

Regras:
- Toda mudança de regra entra em src/domain (de preferência como um Comando novo ou alterado em
  comandos.ts) com teste em tests/. Telas só chamam useCRM().despachar(comando).
- Integrações novas entram em server/adapters.ts (servidor) ou src/adapters (navegador), com a mesma
  interface das locais. Nunca mude as telas para falar com rede.
- Nunca coloque segredo no código. Use .env.local e documente em .env.example.
- Antes de cada mudança, me diga o que vai fazer e o que pode dar errado. Depois rode
  npm run typecheck && npm test e me mostre o resultado.
- Uma coisa por vez. Espere eu aprovar antes do próximo passo.
```

## Trilha 1 · Deixar com a sua cara (sem código novo)

| Passo | Onde | Como conferir |
| --- | --- | --- |
| 1.1 Zerar os dados de exemplo | Integrações → Dados → Começar do zero | só dono + Cláudio em Operadores |
| 1.2 Seus produtos, gatilhos e preços | Produtos e funis | aparecem na oferta e na proposta |
| 1.3 Seus funis de entrada | Produtos e funis → Novo funil | o id aparece nos exemplos de webhook |
| 1.4 Sua Pergunta Matadora | Produtos → Playbook (por produto) | Playbook mostra "playbook próprio" |
| 1.5 Seus templates | Templates | aparecem em "template rápido" na conversa |
| 1.6 Nome da empresa e do robô | prompt: "Mude config.nomeEmpresa e nomeRobo pelo comando salvarConfig; adicione um formulário em Integrações para isso" | Cláudio se apresenta com o novo nome |

## Trilha 2 · Receber leads de verdade

| Passo | Prompt | Conferir |
| --- | --- | --- |
| 2.1 Servidor no ar | `npm run dev:all` ([instalacao.md](instalacao.md)) | badge "servidor local" |
| 2.2 Formulário do site | "Meu formulário manda JSON com os campos X, Y, Z. Ajuste `normalizarLead` em server/api.ts para aceitar esses nomes, com teste em tests/api.test.ts." | `curl` com o payload real cria o lead |
| 2.3 Meta Lead Ads | "Adicione a rota GET /api/leads que responde o hub.challenge do Meta e documente em docs/integracoes.md." | Meta valida o webhook |
| 2.4 Publicar a API | [deploy.md](deploy.md) | `GET /api/saude` na URL pública |

## Trilha 3 · WhatsApp de verdade

| Passo | Prompt | Conferir |
| --- | --- | --- |
| 3.1 Saída | "Implemente o adaptador de WhatsApp com Z-API em server/adapters.ts (variáveis ZAPI_INSTANCIA, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN). Mantenha o local como padrão quando as variáveis não existirem." | mensagem chega no seu celular |
| 3.2 Entrada | "Crie a rota POST /api/webhooks/zapi que converte o payload da Z-API para o formato de /api/webhooks/whatsapp e reaproveita a mesma lógica." | responder no celular aciona o Cláudio |
| 3.3 Janela e silêncio | "Adicione um comando `followupAutomatico` que o servidor roda a cada hora: para contatos com dono robô sem resposta há mais de 1 dia, manda uma mensagem de retomada passando por podeRoboEnviar (48 h, aprovação). Máximo 3 tentativas; na terceira, marcar perdida com motivo 'não respondeu (3 tentativas)'." | teste em tests/ cobre as 3 tentativas |

## Trilha 4 · Ligação e transcrição

| Passo | Prompt | Conferir |
| --- | --- | --- |
| 4.1 Click-to-call | "Troque `telefonia.ligar` em src/adapters por Twilio (ou Zenvia): o servidor cria a chamada ligando primeiro para o vendedor e depois para o lead. Guarde o id da chamada." | telefone do vendedor toca |
| 4.2 Gravação + transcrição | "Ao receber o webhook de gravação da Twilio, baixe o áudio para um bucket privado, transcreva com Whisper em português, marque trechos (dor/meta/prazo/objeção/decisão) com um prompt curto e despache `registrarLigacao`." | transcrição aparece na ficha sem digitar nada |
| 4.3 Cláudio ouve a ligação | "Depois da transcrição, gere follow-ups sugeridos e um `termometroIA`. Siga a regra: a IA sugere, o humano confirma; só follow-ups 'de segurança' (ex.: lembrar do prazo da oferta) podem ser enviados sem confirmação, e ainda assim passando por podeRoboEnviar." | tarefa aparece com origem 'cláudio' |

## Trilha 5 · Pagamento e proposta

| Passo | Prompt | Conferir |
| --- | --- | --- |
| 5.1 Link real | "Implemente `pagamento.criarLink` com Asaas (Pix e cartão). Em /api/comandos, quando o comando for criarLinkPagamento, chame o adaptador antes de aplicar e passe a URL real." | link abre no Asaas |
| 5.2 Confirmação | "Crie POST /api/webhooks/asaas que valida o token e chama o mesmo fluxo de /api/webhooks/pagamento." | pagar move o card para Pago |
| 5.3 Proposta rastreada | "Crie a página pública /p/:propostaId (no front, rota por hash) que mostra a proposta e chama POST /api/webhooks/proposta-aberta ao abrir." | abrir move para Proposta aberta |

## Trilha 6 · Time e banco

| Passo | Prompt | Conferir |
| --- | --- | --- |
| 6.1 Supabase | [banco-de-dados.md](banco-de-dados.md), passos 1 e 2 | `npm run dev:server` com SUPABASE_URL carrega do banco |
| 6.2 Login | "Adicione login por link mágico do Supabase no front e aceite JWT no servidor, mapeando papel → escopo." | cada vendedor entra com seu e-mail |
| 6.3 Metas por vendedor | "Adicione meta de vendas por operador e um bloco em Relatórios com realizado × meta por pessoa." | Relatórios mostra por vendedor |

## Trilha 7 · Grokbot e automações

| Passo | Prompt | Conferir |
| --- | --- | --- |
| 7.1 MCP no Cursor | [grokbot.md](grokbot.md) | "resumo do dia" responde |
| 7.2 Gasto de mídia automático | "Crie um script em server/rotinas/gastos.ts que lê a Marketing API do Meta (spend, clicks por anúncio e dia) e despacha lancarGasto. Rode com `npm run rotina:gastos` e documente o cron." | Demandas atualiza sozinho |
| 7.3 Alerta de CTR | "Rotina que compara CPL dos últimos 2 dias com a média de 14 dias e, se piorar 30%, cria uma ocorrência tipo 'problema' com o criativo." | ocorrência aparece |
| 7.4 Resumo diário no WhatsApp do dono | "Rotina às 8h que chama o mesmo cálculo de resumo_do_dia e envia pelo adaptador de WhatsApp para o telefone do dono." | mensagem chega às 8h |

## Trilha 8 · Outbound (versão 2)

| Passo | Prompt | Conferir |
| --- | --- | --- |
| 8.1 Funil outbound | Criar funil "Outbound" em Produtos e funis | id `outbound` |
| 8.2 Importar lista | "Script que lê um CSV (nome, telefone, empresa, cidade, segmento) e cria leads no funil outbound com abrirConversa:false." | contatos em Lead novo sem mensagem |
| 8.3 Abertura ativa | "Comando `abrirConversaOutbound` com um template próprio (apresentação + pergunta), respeitando podeRoboEnviar e limite de N por dia." | Cláudio abre com o texto de outbound |
| 8.4 Fonte: Google Maps | "Integre uma fonte de leads (ex.: Apify Google Maps Scraper) que gera o CSV do passo 8.2 a partir de segmento + cidade." | lista chega sozinha |

## Como pedir mudanças que não estão aqui

Descreva o **comportamento**, não a tela: "quando o lead der nota 7 e for do funil Evento, em vez de convidar para a live, mandar o link do evento". O Cursor vai achar `claudioResponde`, alterar, escrever o teste e te mostrar. Se ele mexer em tela antes de mexer em regra, peça para inverter.
