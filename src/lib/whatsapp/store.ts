/**
 * Persistência leve da conexão WhatsApp em arquivo local (modo demo / single-node).
 * Em produção com Supabase, use a tabela crm_whatsapp_sessoes.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";

export type WhatsAppConnection = {
  provider: "wpp-engine" | "waha";
  apiKey?: string;
  sessionId?: string;
  webhookSecret?: string;
  phone?: string;
  tenantSlug?: string;
  updatedAt: string;
};

const FILE = resolve(process.cwd(), "data/whatsapp-connection.json");

export function loadConnection(): WhatsAppConnection | null {
  try {
    if (!existsSync(FILE)) return null;
    return JSON.parse(readFileSync(FILE, "utf8")) as WhatsAppConnection;
  } catch {
    return null;
  }
}

export function saveConnection(c: WhatsAppConnection): void {
  mkdirSync(dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(c, null, 2));
}

/** API key efetiva: env tem prioridade; senão a colada no onboarding. */
export function effectiveApiKey(): string | null {
  return process.env.WPP_API_KEY?.trim() || loadConnection()?.apiKey || null;
}

export function effectiveSessionId(): string | null {
  return process.env.WPP_SESSION_ID?.trim() || loadConnection()?.sessionId || null;
}

export function effectiveWebhookSecret(): string | null {
  return process.env.WPP_WEBHOOK_SECRET?.trim() || loadConnection()?.webhookSecret || null;
}
