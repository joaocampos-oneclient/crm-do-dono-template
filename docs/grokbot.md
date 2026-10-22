# Grokbot e outros agentes · três níveis de acesso

O CRM foi feito para ser operado também por agentes (Grokbot, o agente do Cursor, um bot de navegador). A ideia é dar acesso em camadas, do mais seguro para o mais poderoso.

| Nível | O que o agente faz | Como | Risco |
| --- | --- | --- | --- |
| **1. Leitura** | Responde "quantas vendas hoje?", lista quem pediu humano, lê a ficha de um contato, mostra conversão por etapa. | MCP com chave de escopo `leitura` | nenhum: não muda nada |
| **2. Código (Cursor)** | Muda regras, telas, integrações. | Abre este repositório no Cursor com o prompt abaixo | médio: revisado por você antes do commit |
| **3. Navegador** | Abre o CRM, clica, testa uma funcionalidade nova e relata. | Operador de papel `bot` | baixo: dados de teste |

E, quando você quiser, um **nível 1.5**: MCP com chave de `escrita`, que libera criar lead, mover etapa, adicionar nota, criar tarefa, enviar mensagem e assumir conversa.

## Gerar o prompt com os seus dados

No CRM: **Integrações → Grokbot / agentes → "Copiar"**. O texto sai preenchido com seus funis, produtos, operadores, URL da API e configuração MCP. Também está em `GET /api/integracoes/prompt-grokbot`.

Cole no Grokbot (ou no chat do Cursor) e siga: ele vai pedir para você confirmar cada nível.

## Nível 1 · MCP

Servidor MCP por stdio: `server/mcp.ts`. Ele fala com a API (não com o arquivo de dados), então a API precisa estar no ar (`npm run dev:server`).

Configuração (Cursor: `.cursor/mcp.json`; Grokbot: tela de servidores MCP):

```json
{
  "mcpServers": {
    "crm-do-dono": {
      "command": "npx",
      "args": ["tsx", "/caminho/para/crm-do-dono/server/mcp.ts"],
      "env": { "CRM_API_URL": "http://localhost:8787", "CRM_API_KEY": "crm_leitura_…" }
    }
  }
}
```

Ferramentas com chave de leitura:

| Ferramenta | Devolve |
| --- | --- |
| `resumo_do_dia` | vendas hoje, leads hoje, gasto, receita e projeção do mês, quem pediu humano, tarefas vencidas, ocorrências |
| `buscar_metricas(periodo)` | demandas por período e por funil (CPL, CPV, conversão) |
| `listar_contatos(busca?, categoria?)` | contatos com etapa, dono, nota |
| `ver_contato(contatoId)` | ficha, últimas mensagens, notas, tarefas, linha do tempo |
| `listar_funil` | cards e valor por etapa, conversão entre etapas |
| `listar_tarefas` | tarefas abertas |
| `listar_ocorrencias` | ocorrências abertas |

Com chave de escrita (`crm_escrita_…`), aparecem também: `criar_lead`, `mover_etapa`, `adicionar_nota`, `criar_tarefa`, `enviar_mensagem`, `assumir_conversa`. As mesmas regras do CRM valem: o agente não move para etapa automática, não pula etapa sem motivo, e qualquer mensagem passa pelos mesmos caminhos do humano.

Perguntas que funcionam bem: "Quem pediu humano e está esperando?", "Qual funil tem o menor custo por lead nos últimos 7 dias?", "Me resume a conversa com a Mariana", "Crie uma tarefa para ligar para o Paulo amanhã às 10h".

### MCP remoto (quando publicar)

Em produção o Grokbot não roda `npx` na sua máquina. Duas opções: (a) rodar `server/mcp.ts` numa VPS/Railway e expor por SSE/HTTP com o transporte `StreamableHTTPServerTransport` do SDK (veja [deploy.md](deploy.md)); (b) usar só a API REST com a chave de leitura, que o Grokbot consome direto. A API já responde tudo que o MCP responde.

## Nível 2 · Cursor

Abra o repositório no Cursor e cole:

```text
Você vai evoluir este CRM. Leia nesta ordem: README.md, docs/PRD.md, src/domain/types.ts,
src/domain/comandos.ts, src/domain/funil.ts, docs/plano-cursor.md.

Regras:
- Toda regra de negócio nova entra em src/domain (de preferência como Comando) com teste em tests/.
- Telas não falam com rede nem com storage: só com useCRM().despachar(comando).
- Integrações novas entram em server/adapters.ts (servidor) ou src/adapters (navegador), com a mesma interface das locais.
- Nunca coloque segredo no código. Use .env.local.
- Antes de cada mudança me diga o que vai fazer e o que pode quebrar. Depois rode npm run typecheck && npm test.
- Explique em português simples; eu sou empreendedor, não programador.
```

Peça uma coisa por vez. Sugestões de ordem em [plano-cursor.md](plano-cursor.md).

## Nível 3 · Navegador

Crie (ou use) o operador **"Bot de testes (navegador)"**, papel `bot`. Ele é humano para fins de login local, mas o papel deixa claro no histórico que foi um agente. Roteiro padrão de teste que você passa ao agente:

1. Abrir http://localhost:5173, entrar como o bot.
2. Demandas: trocar período, lançar um gasto.
3. Funil: arrastar um card uma etapa; tentar arrastar para "Pago" (deve ser recusado).
4. Conversas: assumir, enviar, devolver; simular mensagem do lead com "quanto custa?" (deve virar handoff sem falar preço).
5. Contatos: preencher briefing, gerar proposta, criar oferta, simular pagamento (card vai para Pago).
6. Relatar com prints o que funcionou e o que não.

Quando você ligar o Supabase, dê ao bot um usuário próprio com papel `bot` (RLS só leitura).

## Segurança

- Uma chave por agente, com nome. Revogue quando não usar.
- Leitura para consulta; escrita só para o que precisa agir.
- O agente não vê segredos: a chave do LLM e do banco ficam no servidor.
- Tudo que o agente fizer aparece na linha do tempo com `por: "mcp"` ou com o operador da chave.
