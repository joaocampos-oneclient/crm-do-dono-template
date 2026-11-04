/**
 * Camada LLM (Mastra + Anthropic) para os agentes.
 * Sem chave do membro → retorna null e o caller usa regras locais.
 */
import { Agent } from "@mastra/core/agent";
import { createAnthropic } from "@ai-sdk/anthropic";
import { crmConfig } from "@crm/config";
import type { AgenteSlug } from "./types";
import {
  effectiveAgentLlmModel,
  effectiveLlmApiKey,
  effectiveLlmModel,
  saveAgentLlmModel,
  temLlmKey,
} from "./llm-store";

export {
  temLlmKey,
  effectiveLlmApiKey,
  effectiveLlmModel,
  effectiveAgentLlmModel,
  saveAgentLlmModel,
} from "./llm-store";

const REGRAS_GLOBAIS = [
  "Você opera no CRM do dono (IA para Donos).",
  "Cláudio nunca fala preço, desconto, parcela, valor ou condição comercial — se o rascunho tiver isso, bloqueie.",
  "Ledger nunca cobra e nunca fica em modo automático.",
  "Responda sempre em português brasileiro, curto e acionável.",
  "Quando pedir JSON, devolva só JSON válido, sem markdown.",
].join(" ");

export function instructionsDoAgente(slug: AgenteSlug): string {
  const a = crmConfig.agentes[slug];
  const extras: Record<AgenteSlug, string> = {
    claudio:
      "Você redige mensagens WhatsApp amigáveis. Nunca mencione preço. Se o rascunho tiver preço, responda JSON {\"bloqueado\":true,\"motivo\":\"preco\",\"resumo\":\"...\"}. Senão: {\"bloqueado\":false,\"texto\":\"...\",\"resumo\":\"...\",\"acaoSugerida\":\"...\"}.",
    scout:
      'Classifique a conversa. JSON: {"rotulo":"...","confianca":0-1,"acao":"aguardar|retomar|handoff|nutrir|ignorar","porque":"...","resumo":"...","acaoSugerida":"..."}. Handoff se pediu preço/humano ou nota 9–10.',
    scribe:
      'Resuma a reunião e sugira follow-ups. JSON: {"resumo":"...","followups":["..."],"acaoSugerida":"..."}.',
    ledger:
      'Avalie risco de cancelamento nos 7 primeiros dias (logins). Nunca cobre. JSON: {"risco":bool,"resumo":"...","acaoSugerida":"...","nuncaCobra":true,"nuncaAutomatico":true,"logins7d":n,"diasDesdePagamento":n}.',
    pilot:
      'Prepare follow-up sem preço, respeitando cooldown 48h e teto 14 dias. JSON: {"texto":"...","resumo":"...","acaoSugerida":"...","cooldown":bool?,"pausado":bool?,"bloqueado":bool?}.',
    eco: 'Monte briefing curto do lead. JSON: {"briefing":"...","resumo":"...","acaoSugerida":"Abrir na reunião."}.',
    ember: [
      "Você é o Ember (Relance), agente reciclador de oportunidades que opera sem aprovação humana por mensagem.",
      "Analise o histórico real do lead (mensagens, notas, briefing, etapa), cruze com a base de conteúdo do negócio e notas de mercado, e tome uma decisão conservadora: \"abordar\", \"adiar\" ou \"ignorar\".",
      "Na dúvida ou se o sinal for fraco/genérico, escolha \"ignorar\" ou \"adiar\" — calar é mais inteligente do que queimar o contato.",
      "Se decidir \"abordar\", escreva 1 mensagem curta e natural de abertura para WhatsApp que: (1) prove que leu o histórico citando um fato concreto do lead; (2) conecte valor sem catálogo; (3) termine com 1 pergunta fechada e fácil de responder.",
      "Zero intimidade falsa, zero clichê proibido (nunca use 'oi tudo bem sou fulano', 'oi, tudo bem? aqui é', 'passando para', 'oi sumido', 'condição especial esse mês').",
      "Respeite estritamente `proibirPreco` (jamais cite R$, preço, desconto, parcela, boleto, pix, cupom ou condição comercial quando proibirPreco=true) e `temasProibidos`.",
      'Responda estritamente em JSON válido: {"decisao":"abordar|adiar|ignorar","motivo":"...","gancho":"...","texto":"...","resumo":"..."}. Se decisao != "abordar", devolva "texto": "".',
    ].join(" "),
  };
  return `${REGRAS_GLOBAIS}\nVocê é ${a.nome}: ${a.resumo}\n${extras[slug]}`;
}

export type LlmGenerateResult = {
  text: string;
  tokens: number;
  modelId?: string;
  raw?: unknown;
};

/**
 * Gera texto via Mastra Agent + Anthropic.
 * Retorna null se não houver chave ou se a chamada falhar (fallback = regras).
 */
export async function gerarComLlm(opts: {
  slug: AgenteSlug;
  prompt: string;
  instructions?: string;
  modelOverride?: string;
}): Promise<LlmGenerateResult | null> {
  const apiKey = effectiveLlmApiKey();
  if (!apiKey) return null;

  try {
    const anthropic = createAnthropic({ apiKey });
    const modelId = effectiveAgentLlmModel(opts.slug, opts.modelOverride);
    const agent = new Agent({
      id: opts.slug,
      name: opts.slug,
      instructions: opts.instructions ?? instructionsDoAgente(opts.slug),
      model: anthropic(modelId),
    });

    const result = await agent.generate(opts.prompt);
    const text = typeof result?.text === "string" ? result.text : "";
    if (!text.trim()) return null;

    const usage = result?.usage as
      | {
          totalTokens?: number;
          inputTokens?: number;
          outputTokens?: number;
          promptTokens?: number;
          completionTokens?: number;
        }
      | undefined;
    let tokens = usage?.totalTokens;
    if (tokens == null) {
      tokens =
        (usage?.inputTokens ?? usage?.promptTokens ?? 0) +
        (usage?.outputTokens ?? usage?.completionTokens ?? 0);
    }
    if (!tokens) tokens = 1;

    return { text, tokens, modelId, raw: result };
  } catch (e) {
    console.warn("[llm]", opts.slug, e instanceof Error ? e.message : e);
    return null;
  }
}

/** Tenta parsear JSON embutido na resposta do modelo. */
export function parseJsonDaResposta(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fence ? fence[1].trim() : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}
