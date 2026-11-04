import { resolveProviderId } from "./index";
import { effectiveApiKey, effectiveSessionId } from "./store";

/** Há credenciais para enviar WhatsApp agora? (WAHA: URL base; WPP Engine: chave + sessão.) */
export function sessaoWhatsAppAtiva(): boolean {
  if (resolveProviderId() === "waha") {
    return Boolean(process.env.WAHA_BASE_URL?.trim());
  }
  return Boolean(effectiveApiKey() && effectiveSessionId());
}
