/**
 * Persistência leve da chave Anthropic do membro (modo demo / single-node).
 * Em produção, prefira ANTHROPIC_API_KEY / CRM_LLM_API_KEY no .env.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";

export type LlmConnection = {
  provider: "anthropic";
  apiKey?: string;
  model?: string;
  agentModels?: Record<string, string>;
  updatedAt: string;
};

function connectionFile(): string {
  return process.env.CRM_LLM_CONNECTION_FILE?.trim() || resolve(process.cwd(), "data/llm-connection.json");
}

export function loadLlmConnection(): LlmConnection | null {
  try {
    const file = connectionFile();
    if (!existsSync(file)) return null;
    return JSON.parse(readFileSync(file, "utf8")) as LlmConnection;
  } catch {
    return null;
  }
}

export function saveLlmConnection(c: LlmConnection): void {
  const file = connectionFile();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(c, null, 2));
}

export function saveAgentLlmModel(slug: string, model: string): void {
  const prev = loadLlmConnection();
  const nextModels: Record<string, string> = { ...(prev?.agentModels ?? {}) };
  const trimmed = model.trim();
  if (trimmed) {
    nextModels[slug] = trimmed;
  } else {
    delete nextModels[slug];
  }
  saveLlmConnection({
    provider: "anthropic",
    apiKey: prev?.apiKey,
    model: prev?.model,
    agentModels: nextModels,
    updatedAt: new Date().toISOString(),
  });
}

/** Chave efetiva: env tem prioridade; senão a colada na UI. */
export function effectiveLlmApiKey(): string | null {
  const fromEnv =
    process.env.CRM_LLM_API_KEY?.trim() ||
    process.env.ANTHROPIC_API_KEY?.trim() ||
    "";
  if (fromEnv) return fromEnv;
  return loadLlmConnection()?.apiKey?.trim() || null;
}

export function effectiveLlmModel(): string {
  return (
    process.env.CRM_LLM_MODEL?.trim() ||
    loadLlmConnection()?.model?.trim() ||
    "claude-haiku-4-5"
  );
}

/**
 * Modelo por agente:
 * override explícito -> CRM_EMBER_MODEL (se ember) -> agentModels[slug] -> "claude-sonnet-4-5" (se ember) -> effectiveLlmModel()
 */
export function effectiveAgentLlmModel(slug?: string, override?: string): string {
  if (override?.trim()) return override.trim();
  if (slug === "ember" && process.env.CRM_EMBER_MODEL?.trim()) {
    return process.env.CRM_EMBER_MODEL.trim();
  }
  if (slug) {
    const saved = loadLlmConnection()?.agentModels?.[slug]?.trim();
    if (saved) return saved;
  }
  if (slug === "ember") {
    return "claude-sonnet-4-5";
  }
  return effectiveLlmModel();
}

export function temLlmKey(): boolean {
  return Boolean(effectiveLlmApiKey());
}

export function mascaraChave(key: string | null): string | null {
  if (!key) return null;
  if (key.length <= 12) return "***";
  return `${key.slice(0, 8)}…${key.slice(-4)}`;
}
