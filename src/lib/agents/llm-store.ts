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
  updatedAt: string;
};

const FILE = resolve(process.cwd(), "data/llm-connection.json");

export function loadLlmConnection(): LlmConnection | null {
  try {
    if (!existsSync(FILE)) return null;
    return JSON.parse(readFileSync(FILE, "utf8")) as LlmConnection;
  } catch {
    return null;
  }
}

export function saveLlmConnection(c: LlmConnection): void {
  mkdirSync(dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(c, null, 2));
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

export function temLlmKey(): boolean {
  return Boolean(effectiveLlmApiKey());
}

export function mascaraChave(key: string | null): string | null {
  if (!key) return null;
  if (key.length <= 12) return "***";
  return `${key.slice(0, 8)}…${key.slice(-4)}`;
}
