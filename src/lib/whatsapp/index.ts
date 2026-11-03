import type { WhatsAppProvider, WhatsAppProviderId } from "./types";
import { createWppEngineProvider } from "./wpp-engine";
import { createWahaProvider } from "./waha";

export type { WhatsAppProvider, WhatsAppProviderId, WhatsAppSession, WhatsAppSessionStatus } from "./types";
export {
  verifyWppEngineSignature,
  newWebhookSecret,
  newIdempotencyKey,
} from "./wpp-engine";
export {
  engineBaseUrl,
  engineApiKey,
  engineSessionId,
  engineWebhookSecret,
  engineConsoleUrl,
  WppEngineError,
} from "./client";

/** Padrão: wpp-engine. Alternativa: WHATSAPP_PROVIDER=waha */
export function resolveProviderId(): WhatsAppProviderId {
  const raw = (process.env.WHATSAPP_PROVIDER ?? "wpp-engine").toLowerCase();
  return raw === "waha" ? "waha" : "wpp-engine";
}

export function getWhatsAppProvider(): WhatsAppProvider {
  return resolveProviderId() === "waha" ? createWahaProvider() : createWppEngineProvider();
}
