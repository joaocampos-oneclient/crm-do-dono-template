/**
 * Camada LLM (Mastra + Anthropic) para os agentes.
 * Sem chave do membro → retorna null e o caller usa regras locais.
 */
import { Agent } from "@mastra/core/agent";
import { createAnthropic } from "@ai-sdk/anthropic";
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

export { instructionsDoAgente, REGRAS_GLOBAIS } from "./prompts";
import { instructionsDoAgente } from "./prompts";

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
export type GerarComLlmOpts = {
  slug: AgenteSlug;
  prompt: string;
  instructions?: string;
  modelOverride?: string;
};

/**
 * SÓ PARA TESTES: substitui a chamada ao modelo por uma função local (sem chave, sem rede).
 * Passe `null` para voltar ao comportamento normal. Nunca use em código de produção.
 */
let geradorDeTeste: ((opts: GerarComLlmOpts) => Promise<LlmGenerateResult | null>) | null = null;
export function __setLlmGeneratorForTests(
  fn: ((opts: GerarComLlmOpts) => Promise<LlmGenerateResult | null>) | null,
): void {
  geradorDeTeste = fn;
}

export async function gerarComLlm(opts: GerarComLlmOpts): Promise<LlmGenerateResult | null> {
  if (geradorDeTeste) return geradorDeTeste(opts);
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
