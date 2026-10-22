/**
 * Textos de integração gerados a partir do estado: prompt para o Grokbot, configuração MCP, exemplos de curl.
 * Usados pela tela Integrações e pelo endpoint GET /api/integracoes/prompt-grokbot.
 */
import type { EstadoCRM } from "./types";

export interface OpcoesIntegracao {
  apiUrl: string;
  chaveLeitura: string | null;
  chaveEscrita: string | null;
  /** Caminho absoluto do repositório, para a configuração MCP por stdio. */
  caminhoRepo?: string;
}

export const chaveAtiva = (estado: EstadoCRM, escopo: "leitura" | "escrita") => estado.chaves.find((k) => k.escopo === escopo && !k.revogadaEm)?.chave ?? null;

export function exemplosCurl(estado: EstadoCRM, o: OpcoesIntegracao) {
  const k = o.chaveEscrita ?? "SUA_CHAVE_DE_ESCRITA";
  const funil = estado.funis[0]?.id ?? "perpetuo";
  return {
    lead: `curl -X POST ${o.apiUrl}/api/leads \\
  -H "content-type: application/json" \\
  -H "x-api-key: ${k}" \\
  -d '{"nome":"Nome do lead","telefone":"62999990000","origem":"${funil}","empresa":"Empresa","email":"lead@exemplo.com","mensagemInicial":"Vi o anúncio"}'`,
    whatsapp: `curl -X POST ${o.apiUrl}/api/webhooks/whatsapp \\
  -H "content-type: application/json" \\
  -H "x-api-key: ${k}" \\
  -d '{"telefone":"62999990000","texto":"9. E quanto custa?","nome":"Nome do lead"}'`,
    pagamento: `curl -X POST ${o.apiUrl}/api/webhooks/pagamento \\
  -H "content-type: application/json" \\
  -H "x-api-key: ${k}" \\
  -d '{"pagamentoId":"ID_DO_PAGAMENTO","status":"pago"}'`,
    metricas: `curl ${o.apiUrl}/api/metricas/demandas?periodo=7d -H "x-api-key: ${o.chaveLeitura ?? "SUA_CHAVE_DE_LEITURA"}"`,
  };
}

export function configMcp(o: OpcoesIntegracao) {
  const repo = o.caminhoRepo ?? "/caminho/para/crm-do-dono";
  return JSON.stringify({
    mcpServers: {
      "crm-do-dono": {
        command: "npx",
        args: ["tsx", `${repo}/server/mcp.ts`],
        env: { CRM_API_URL: o.apiUrl, CRM_API_KEY: o.chaveLeitura ?? "SUA_CHAVE" },
      },
    },
  }, null, 2);
}

export function promptGrokbot(estado: EstadoCRM, o: OpcoesIntegracao) {
  const funis = estado.funis.map((f) => `- ${f.nome} (id: ${f.id}) · canal: ${f.canal}`).join("\n");
  const produtos = estado.produtos.filter((p) => p.ativo).map((p) => `- ${p.nome} · R$ ${p.valor}${p.parcelas ? ` (${p.parcelas})` : ""}`).join("\n");
  const operadores = estado.operadores.filter((op) => op.ativo).map((op) => `- ${op.nome} · ${op.papel} · ${op.tipo}`).join("\n");
  return `Você é o assistente do CRM da ${estado.config.nomeEmpresa} ("CRM do dono"). Vou te conectar a ele em três níveis. Faça uma etapa por vez e me confirme antes de seguir.

## O que é este CRM
- Contato (pessoa) tem N Oportunidades (uma por produto). Categoria (lead/prospect/cliente) é calculada, ninguém edita.
- Funil de venda com 8 etapas: Lead novo → Em conversa → Handoff → Briefing feito → Proposta aberta → Oferta com condição → Pago → Dentro. "Proposta aberta", "Pago" e "Dentro" são movidas pelo sistema, nunca por você.
- ${estado.config.nomeRobo} é o agente de IA que qualifica (Pergunta Matadora, nota 0-10). Nota 9-10, pedido de preço ou de humano = handoff para um vendedor.
- Regra de ouro: o robô nunca fala preço, desconto, parcela ou condição. Só humano. Isto está travado em código.

Funis de entrada:
${funis}

Produtos:
${produtos}

Operadores:
${operadores}

## Nível 1 · Leitura (MCP)
Servidor MCP por stdio em server/mcp.ts. Configure assim (ajuste o caminho):
${configMcp(o)}
Ferramentas: resumo_do_dia, buscar_metricas(periodo), listar_contatos(filtro), ver_contato(id), listar_funil, listar_ocorrencias, listar_tarefas. Com chave de ESCRITA você também tem: mover_etapa, adicionar_nota, criar_tarefa, criar_lead, enviar_mensagem, assumir_conversa.
Teste: chame resumo_do_dia e me diga quantas vendas houve hoje.

## Nível 2 · Alterações no código (Cursor)
O repositório é TypeScript (Vite + React + Hono). Leia nesta ordem: README.md, docs/PRD.md, src/domain/types.ts, src/domain/comandos.ts, src/domain/funil.ts.
Regras: toda mudança de regra entra em src/domain com teste em tests/; nenhuma integração nova toca as telas diretamente (entra em server/adapters ou src/adapters); nunca coloque segredo no código. Antes de editar, me diga o que vai mudar e o que pode quebrar. Rode npm run typecheck && npm test antes de dar por pronto.

## Nível 3 · Testes pelo navegador
Abra ${o.apiUrl.replace(/:\d+$/, ":5173")} e entre como o operador "Bot de testes (navegador)" (papel bot). Faça o roteiro: Demandas → Funil (arraste um card) → Conversas (assuma uma conversa, envie mensagem, devolva ao ${estado.config.nomeRobo}) → Contatos (abra uma ficha, preencha briefing, gere proposta). Me relate o que funcionou e o que não funcionou, com prints.

## API e webhooks (para outros sistemas)
Base: ${o.apiUrl}. Header x-api-key. Leitura: ${o.chaveLeitura ? "chave fornecida" : "crie em Operadores e chaves"}; escrita: ${o.chaveEscrita ? "chave fornecida" : "crie em Operadores e chaves"}.
- POST /api/leads {nome, telefone, origem, empresa?, email?, mensagemInicial?} — cria o lead e ${estado.config.nomeRobo} abre a conversa.
- POST /api/webhooks/whatsapp {telefone, texto, nome?} — mensagem recebida; devolve a resposta do robô para você enviar.
- POST /api/webhooks/pagamento {pagamentoId, status} — confirma pagamento e move para Pago.
- GET /api/metricas/demandas?periodo=hoje|7d|30d, GET /api/metricas/relatorio, GET /api/contatos, GET /api/contatos/:id, GET /api/funil.

Não invente dados. Quando não souber, pergunte. Quando uma ação mudar o funil, me diga antes.`;
}
