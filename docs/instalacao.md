# Instalação · do zero ao primeiro lead

Tempo: 10 minutos. Você não precisa de banco, de conta em nuvem nem de cartão.

## 0. O que você precisa

- **Node 20 ou mais novo**. Confira com `node -v`. Se não tiver: [nodejs.org](https://nodejs.org) (versão LTS).
- **Git** (para baixar) e o **Cursor** (para evoluir). O CRM roda sem o Cursor.

## 1. Baixar e instalar

```bash
git clone <url-deste-repositorio> crm-do-dono
cd crm-do-dono
npm install
```

## 2. Rodar só no navegador (modo mais simples)

```bash
npm run dev
```

Abra http://localhost:5173. Escolha "Otávio" (vendedor) ou "João (dono)". Tudo funciona: funil, conversas com o Cláudio, ligação, proposta, oferta, pagamento simulado, relatórios. Os dados ficam no seu navegador (localStorage).

Roteiro para conhecer em 5 minutos:

1. **Demandas**: troque o período. Clique em "Lançar gasto de mídia".
2. **Hoje**: veja quem pediu humano. Marque uma tarefa como feita.
3. **Funil**: arraste "Ana Beatriz Lima" de "Em conversa" para "Handoff".
4. **Conversas**: abra "Fábio Antunes" → Mais → "Simular mensagem do lead" → escreva "9. E quanto custa?". Veja o Cláudio passar para o humano. Clique "Assumir" e responda.
5. **Contatos**: abra "Paulo Mendes" → "Gerar proposta" → "Oferta com condição" → aba Pagamentos → "Simular pago". O card vai para "Pago" sozinho.
6. Botão **+** (canto inferior): discagem rápida. Digite um número novo; o CRM cria o contato e liga.

Quer zerar e colocar os seus produtos e funis? **Integrações → Dados → Começar do zero**, depois **Produtos e funis**.

## 3. Rodar com o servidor local (leads de fora + Grokbot)

O servidor guarda os dados num arquivo (`server/data/crm.json`), recebe webhooks e expõe a API e o MCP.

```bash
cp .env.example .env.local
```

Edite `.env.local` e deixe estas duas linhas sem `#`:

```
VITE_API_URL=http://localhost:8787
VITE_API_KEY=crm_escrita_exemplo_troque_esta_chave
```

Suba tudo:

```bash
npm run dev:all
```

Você verá no terminal as chaves de exemplo e `CRM do dono · API em http://localhost:8787`. Abra http://localhost:5173: no rodapé da barra lateral aparece "servidor local".

### Primeiro lead por webhook

Em outro terminal:

```bash
curl -X POST http://localhost:8787/api/leads \
  -H "content-type: application/json" \
  -H "x-api-key: crm_escrita_exemplo_troque_esta_chave" \
  -d '{"nome":"Meu primeiro lead","telefone":"62999990000","origem":"perpetuo","empresa":"Teste"}'
```

Volte ao navegador: o lead está em **Demandas** (leads de hoje +1), no **Funil** (coluna Lead novo) e em **Conversas** (o Cláudio abriu a conversa). Agora simule a resposta do lead como se viesse do WhatsApp:

```bash
curl -X POST http://localhost:8787/api/webhooks/whatsapp \
  -H "content-type: application/json" \
  -H "x-api-key: crm_escrita_exemplo_troque_esta_chave" \
  -d '{"telefone":"62999990000","texto":"9, quero falar com alguém"}'
```

A resposta traz o que o Cláudio disse e `handoffPendente: true`. Na tela **Hoje**, o lead aparece em "Pediu humano e ninguém assumiu".

### Conferir o que saiu

Toda mensagem do robô/humano e todo e-mail "enviado" ficam registrados:

```bash
curl http://localhost:8787/api/saidas -H "x-api-key: crm_leitura_exemplo_troque_esta_chave"
```

Para enviar de verdade, troque os adaptadores: [integracoes.md](integracoes.md).

## 4. MCP no Cursor (o CRM responde "quantas vendas hoje?")

Com o servidor no ar, crie `.cursor/mcp.json` na raiz do projeto (há um exemplo em `.cursor/mcp.json.example`):

```json
{
  "mcpServers": {
    "crm-do-dono": {
      "command": "npx",
      "args": ["tsx", "server/mcp.ts"],
      "env": { "CRM_API_URL": "http://localhost:8787", "CRM_API_KEY": "crm_leitura_exemplo_troque_esta_chave" }
    }
  }
}
```

Reabra o Cursor, vá em Settings → MCP e confirme que `crm-do-dono` está verde. No chat, pergunte: "Qual o resumo do dia do CRM?". Ele chama `resumo_do_dia`.

Troque a chave por uma de **escrita** para liberar `criar_lead`, `mover_etapa`, `enviar_mensagem` etc. Detalhes e o prompt completo para o Grokbot: [grokbot.md](grokbot.md).

## 5. Cláudio com modelo de linguagem (opcional)

Sem nada configurado, o Cláudio responde por regras: previsível, grátis, sem chave. Se quiser redação mais natural:

```
LLM_API_KEY=sua-chave
LLM_BASE_URL=https://api.openai.com/v1      # ou Groq, xAI, OpenRouter, Ollama local
LLM_MODEL=gpt-4o-mini
```

Reinicie `npm run dev:server`. O modelo **só redige**: nota, handoff e trava de preço continuam nas regras.

## 6. Comandos úteis

| Comando | Para quê |
| --- | --- |
| `npm run dev` | só front, dados no navegador |
| `npm run dev:server` | só API (porta 8787) |
| `npm run dev:all` | front + API |
| `npm run mcp` | servidor MCP por stdio (quem chama é o Cursor/Grokbot) |
| `npm test` | 76 testes |
| `npm run typecheck` | tipos do front e do servidor |
| `npm run build` | build de produção em `dist/` |

## 7. Problemas comuns

- **"Não consegui carregar o CRM"**: você definiu `VITE_API_URL` mas o servidor não está no ar. Rode `npm run dev:server` ou comente a variável.
- **401 na API**: chave ausente/errada. Veja as chaves em Operadores e chaves ou no terminal do servidor.
- **403 na API**: a chave é de leitura e a operação exige escrita.
- **Mudei `.env.local` e nada aconteceu**: reinicie o `npm run dev` (variáveis `VITE_*` são lidas no início).
- **Quero apagar tudo do servidor**: pare o servidor e apague `server/data/crm.json`.
