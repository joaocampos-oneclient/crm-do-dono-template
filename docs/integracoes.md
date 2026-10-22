# Integrações · como ligar os canais de verdade

O CRM já fala com o mundo por três portas: **webhooks de entrada** (`/api/...`), **adaptadores de saída** (`server/adapters.ts`) e **adaptadores do navegador** (`src/adapters/`). No template, as saídas são locais (ficam em `GET /api/saidas`). Aqui está o que trocar para cada serviço. Troque **um por vez** e teste antes do próximo.

Toda chamada à API leva o header `x-api-key` com uma chave de **escrita** (Operadores e chaves) ou a `CRM_API_KEY` do servidor.

## 1. Entrada de leads: `POST /api/leads`

Corpo simples:

```json
{ "nome": "Maria", "telefone": "62999990000", "origem": "perpetuo", "empresa": "ACME", "email": "m@acme.com", "mensagemInicial": "Vi o anúncio" }
```

- `origem` = id do funil de entrada (Produtos e funis). Nome do funil também funciona. Sem origem, cai no primeiro funil.
- Telefone repetido **não duplica**: devolve o contato existente (`novo: false`).
- O Cláudio abre a conversa na hora (a abertura sai pelo adaptador de WhatsApp).

### Meta Lead Ads (formulário instantâneo)

O Meta manda `field_data`. O endpoint entende direto:

```json
{ "field_data": [ { "name": "full_name", "values": ["Maria"] }, { "name": "phone_number", "values": ["+5562999990000"] }, { "name": "email", "values": ["m@acme.com"] } ], "utm_source": "perpetuo" }
```

Como ligar: Meta Business → Webhooks → `leadgen` apontando para a sua URL pública de `/api/leads` (precisa publicar, [deploy.md](deploy.md)). O Meta primeiro faz um `GET` de verificação com `hub.challenge`; adicione uma rota que devolva o challenge (3 linhas no `server/api.ts`) ou use um intermediário (Make/Zapier/n8n) que recebe do Meta e chama `/api/leads`. Para pegar o lead completo o Meta exige buscar por id com token da página; o intermediário resolve isso sem código.

### Google Ads (formulário de lead)

O Google envia `user_column_data` com `column_id` (`FULL_NAME`, `PHONE_NUMBER`, `EMAIL`). Mapeie para `nome/telefone/email` num intermediário ou adicione o mapeamento em `normalizarLead` (`server/api.ts`), ao lado do `field_data` do Meta.

### Formulário do site, Typeform, Tally, landing page

Qualquer coisa que faça um POST JSON. Campos aceitos: `nome|name|full_name`, `telefone|phone|phone_number|whatsapp`, `email`, `empresa|company`, `origem|funil|source|utm_source`, `mensagemInicial|mensagem|message`.

### Planilha / importação em massa

Exporte CSV, converta em JSON e faça um `POST /api/leads` por linha (um script de 10 linhas; peça ao Cursor). Use `"abrirConversa": false` no comando `criarLead` via `/api/comandos` se não quiser que o Cláudio dispare mensagem para a base antiga.

## 2. WhatsApp

### Entrada: `POST /api/webhooks/whatsapp`

```json
{ "telefone": "62999990000", "texto": "9, e quanto custa?", "nome": "Maria", "origem": "perpetuo" }
```

Resposta:

```json
{ "ok": true, "contatoId": "...", "respostas": ["Faz sentido, Maria. Vou te passar para Otávio…"], "dono": "robo", "handoffPendente": true, "nota": 9 }
```

Número desconhecido vira lead. Se um humano está no comando, `respostas` vem vazio (o robô fica calado).

### Saída: adaptador `whatsapp.enviar(telefone, texto)`

Em `server/adapters.ts`, troque a implementação local por uma destas:

| Provedor | Como | Observação |
| --- | --- | --- |
| **Z-API** | `POST https://api.z-api.io/instances/{id}/token/{token}/send-text` com `{ phone, message }` | mais simples para começar; número comum |
| **Evolution API** (self-hosted) | `POST {base}/message/sendText/{instancia}` com `{ number, text }` | grátis, roda na sua VPS |
| **WhatsApp Cloud API** (oficial) | `POST https://graph.facebook.com/v20.0/{phone_id}/messages` | exige templates aprovados fora da janela de 24 h |

Todos têm webhook de mensagem recebida: aponte para `/api/webhooks/whatsapp` com um pequeno mapeamento (`from` → `telefone`, `body/text` → `texto`). O corpo da resposta já traz o que enviar de volta, ou deixe o adaptador de saída cuidar (ele é chamado automaticamente para toda mensagem de robô/humano nova).

Exemplo Z-API, substituindo `whatsapp` em `adaptadoresLocais`:

```ts
whatsapp: {
  async enviar(telefone, texto) {
    const r = await fetch(`https://api.z-api.io/instances/${process.env.ZAPI_INSTANCIA}/token/${process.env.ZAPI_TOKEN}/send-text`, {
      method: "POST", headers: { "content-type": "application/json", "client-token": process.env.ZAPI_CLIENT_TOKEN ?? "" },
      body: JSON.stringify({ phone: telefoneDigitos(telefone), message: texto }),
    });
    return { ok: r.ok, id: String((await r.json().catch(() => ({})))?.messageId ?? "") };
  },
},
```

## 3. Telefonia e transcrição

Hoje a ligação é simulada no navegador (`src/adapters/mock.ts`): cronômetro e transcrição gerada do contexto. Para ligar de verdade:

| Peça | Opção | Como entra |
| --- | --- | --- |
| Discagem | **Twilio Voice** (SDK JS no navegador, `Device.connect`) ou **Zenvia / TotalVoice** (click-to-call: liga para o vendedor e depois para o lead) | `src/adapters/index.ts` → `telefonia.ligar` |
| Gravação | o provedor grava (Twilio `record: true`) | áudio vai para bucket **privado** (Supabase Storage / S3); guarde só o caminho em `crm_ligacoes.audio_path` |
| Transcrição | **Whisper** (OpenAI), **AssemblyAI**, **Deepgram** (todos com português) | rode no servidor ao receber o webhook de gravação; preencha `trechos`, `resumo`, `termometroIA`, `followups` |
| Marcação de trechos | um prompt curto ao LLM: "classifique cada fala em dor/meta/prazo/objeção/decisão/null" | mesmo lugar |

Fluxo recomendado: o botão "Ligar" chama a telefonia; ao encerrar, o modal fica em "aguardando transcrição"; o webhook do provedor chega no servidor, que transcreve e despacha `registrarLigacao`. O front recebe pelo polling (`/api/versao`).

**Aviso de gravação é obrigatório**. O comando `registrarLigacao` recusa transcrição sem `avisoGravacaoDado`.

## 4. E-mail

Adaptador `email.enviar(para, assunto, texto)` em `server/adapters.ts`. Opções: **Resend** (`POST https://api.resend.com/emails`), **Amazon SES**, **SMTP** (Nodemailer). Configure o domínio (SPF/DKIM) antes de mandar para cliente.

## 5. Pagamento

### Criar link

Adaptador `pagamento.criarLink`. O comando `criarLinkPagamento` hoje gera um link de exemplo. Para usar o provedor, chame o adaptador na rota `/api/comandos` quando `cmd.tipo === "criarLinkPagamento"` e grave a URL devolvida (`linkUrl`) e o `provedor_id`.

| Provedor | Criar cobrança | Webhook |
| --- | --- | --- |
| **Asaas** | `POST /v3/payments` (Pix, boleto, cartão) | `PAYMENT_RECEIVED` / `PAYMENT_CONFIRMED` |
| **Stripe** | `POST /v1/checkout/sessions` | `checkout.session.completed` |
| **Pagar.me / Mercado Pago** | links de pagamento | notificação de pagamento aprovado |

### Confirmar: `POST /api/webhooks/pagamento`

```json
{ "pagamentoId": "<id do pagamento no CRM>", "status": "pago" }
```

Mapeie o webhook do provedor para este formato (use `provedor_id` ou coloque o id do CRM no `metadata/externalReference` ao criar a cobrança). Valide a assinatura do provedor antes de chamar.

## 6. Proposta aberta

Quando o contato abre a proposta, o card vai para "Proposta aberta" sozinho. Para detectar a abertura: hospede a proposta numa página sua com um link único (`/p/<propostaId>`) que chama `POST /api/webhooks/proposta-aberta { "propostaId" }` ao carregar, ou use o "lido" do WhatsApp via webhook do provedor.

## 7. Gasto de mídia automático

Hoje é lançado à mão em Demandas. Para automatizar: uma rotina diária (cron no servidor, GitHub Actions ou o próprio Grokbot) que lê a **Marketing API do Meta** (`/act_{id}/insights?fields=spend,clicks&time_increment=1&level=ad`) e a **Google Ads API**, e despacha `lancarGasto` por dia/funil/criativo via `/api/comandos`. Mapeie campanha → funil e anúncio → criativo pelo nome.

## 8. Cláudio com LLM

`server/claudio.ts`. Qualquer endpoint compatível com a API de chat da OpenAI. O modelo só redige; as decisões são das regras. Se quiser que ele também **decida**, mude `claudioResponde` com teste: nunca retire a trava `sanitizarFalaDoRobo`.

## 9. LGPD e boas práticas

- Base legal: legítimo interesse para lead que pediu contato; consentimento para gravação. Avise sempre.
- "Não quero mais contato" encerra e marca perdido; não escreva mais. Guarde a prova.
- Áudio e transcrição em storage privado com URL assinada; defina retenção (ex.: 12 meses).
- Não mande dado real para um projeto de teste. Use o estado de exemplo para testar integrações.
- Chaves de API: uma por integração, nomeada, revogável. Em produção, guarde só o hash (`crm_chaves_api.hash`).
