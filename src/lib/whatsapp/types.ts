/**
 * Contrato do provedor de WhatsApp do CRM.
 * Padrão: `wpp-engine`. Alternativa opcional: `waha`.
 *
 * Spec Engine: https://wpp-engine.oneclient.com.br/v1/openapi.json
 * Docs: docs/wpp-engine-contrato.md
 */

export type WhatsAppProviderId = "wpp-engine" | "waha";

/** Status normalizados do CRM (mapeados a partir do Engine). */
export type WhatsAppSessionStatus =
  | "desconectado"
  | "pending"
  | "qr"
  | "pairing"
  | "conectado"
  | "banned"
  | "revoked"
  | "logged_out"
  | "erro";

export type WhatsAppSession = {
  provider: WhatsAppProviderId;
  sessionId: string;
  status: WhatsAppSessionStatus;
  /** Data-URL, URL ou payload do QR (quando status === "qr"). */
  qr?: string | null;
  qrExpiresAt?: string | null;
  telefone?: string | null;
  displayName?: string | null;
  /** Aviso de número cold / aquecimento. */
  coldWarning?: boolean;
  detalhe?: string;
};

export type EnvioResultado =
  | { ok: true; id: string }
  | { ok: false; erro: string; retryAfterSec?: number };

/**
 * Futuro: OAuth / device-link sem colar token.
 * Hoje o onboarding usa API key colada uma vez (console do Engine).
 */
export type ConnectStart = {
  redirectUrl: string;
  state: string;
  mode: "oauth_future" | "api_key";
};

export type ConnectCallbackResult = {
  ok: boolean;
  session?: WhatsAppSession;
  erro?: string;
};

export interface WhatsAppProvider {
  readonly id: WhatsAppProviderId;
  readonly label: string;

  /** URL do console / signup (criar conta + emitir key). */
  signupUrl(): string;

  /** Futuro OAuth. Hoje devolve URL do console + mode api_key. */
  startConnect(opts: { returnTo: string; operadorId?: string }): Promise<ConnectStart>;

  /** Futuro OAuth callback. */
  completeConnect(opts: {
    code?: string | null;
    state?: string | null;
  }): Promise<ConnectCallbackResult>;

  /** Valida a API key (GET /tenants/me). */
  validateKey(apiKey: string): Promise<{ ok: boolean; tenantId?: string; slug?: string; erro?: string }>;

  status(sessionId?: string): Promise<WhatsAppSession>;
  createSession(opts: {
    phone: string;
    displayName?: string;
    externalId?: string;
  }): Promise<WhatsAppSession>;
  getQr(sessionId: string): Promise<{ qr: string | null; expiresAt: string | null }>;
  reconnect(sessionId: string): Promise<WhatsAppSession>;
  sendText(opts: {
    sessionId: string;
    to: string;
    text: string;
    idempotencyKey: string;
  }): Promise<EnvioResultado>;

  /** Gera secret e registra webhook_url no tenant. */
  registerWebhook(opts: {
    webhookUrl: string;
    webhookSecret: string;
  }): Promise<{ ok: boolean; erro?: string }>;

  webhookPath(): string;
}
