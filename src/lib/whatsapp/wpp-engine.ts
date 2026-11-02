/**
 * Adaptador padrão: WPP Engine (https://wpp-engine.oneclient.com.br/v1).
 * Não usar o legado wpp-api.oneclient.tech.
 */
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import type {
  ConnectCallbackResult,
  ConnectStart,
  EnvioResultado,
  WhatsAppProvider,
  WhatsAppSession,
  WhatsAppSessionStatus,
} from "./types";
import {
  engineApiKey,
  engineConsoleUrl,
  engineFetch,
  engineSessionId,
  WppEngineError,
} from "./client";

function mapStatus(s: string | undefined): WhatsAppSessionStatus {
  switch (s) {
    case "pending":
      return "pending";
    case "qr":
      return "qr";
    case "pairing":
      return "pairing";
    case "connected":
      return "conectado";
    case "banned":
      return "banned";
    case "revoked":
      return "revoked";
    case "logged_out":
      return "logged_out";
    case "disconnected":
      return "desconectado";
    default:
      return s ? "erro" : "desconectado";
  }
}

function toSession(raw: Record<string, unknown>): WhatsAppSession {
  const status = mapStatus(String(raw.status ?? ""));
  const tier = typeof raw.tier === "string" ? raw.tier : "";
  return {
    provider: "wpp-engine",
    sessionId: String(raw.session_id ?? raw.id ?? ""),
    status,
    qr: typeof raw.qr_code === "string" ? raw.qr_code : null,
    qrExpiresAt: typeof raw.qr_expires_at === "string" ? raw.qr_expires_at : null,
    telefone:
      typeof raw.phone_normalized === "string"
        ? raw.phone_normalized
        : typeof raw.phone === "string"
          ? raw.phone
          : null,
    displayName: typeof raw.display_name === "string" ? raw.display_name : null,
    // Número novo / self-service: mostre aviso de aquecimento
    coldWarning: tier === "cold" || tier === "" || status === "conectado" || status === "qr",
    detalhe:
      tier === "cold" || tier === ""
        ? "Número novo nasce cold: aqueça aos poucos (poucas mensagens por dia no começo). Limite: 5000 msgs/dia por sessão; plano self-service = 1 sessão."
        : undefined,
  };
}

export function createWppEngineProvider(): WhatsAppProvider {
  return {
    id: "wpp-engine",
    label: "WPP Engine",

    signupUrl() {
      return engineConsoleUrl();
    },

    async startConnect({ returnTo }): Promise<ConnectStart> {
      // Futuro: OAuth/device-link. Hoje o console emite a API key.
      const state = randomBytes(16).toString("hex");
      const url = new URL(engineConsoleUrl());
      url.searchParams.set("utm_source", "crm-do-dono");
      url.searchParams.set("return_to", returnTo);
      return { redirectUrl: url.toString(), state, mode: "api_key" };
    },

    async completeConnect(): Promise<ConnectCallbackResult> {
      return {
        ok: false,
        erro: "OAuth ainda não está disponível no Engine. Cole a API key uma vez em Integrações › WhatsApp.",
      };
    },

    async validateKey(apiKey) {
      try {
        const data = await engineFetch<{ id: string; slug: string }>("/tenants/me", { apiKey });
        return { ok: true, tenantId: data.id, slug: data.slug };
      } catch (err) {
        const msg = err instanceof WppEngineError ? err.message : String(err);
        return { ok: false, erro: msg };
      }
    },

    async status(sessionId) {
      const id = sessionId || engineSessionId();
      if (!id) {
        return {
          provider: "wpp-engine",
          sessionId: "",
          status: "desconectado",
          detalhe: engineApiKey()
            ? "Nenhuma sessão. Informe o telefone e escaneie o QR."
            : "Cole a WPP_API_KEY (wae_live_…) para começar.",
        };
      }
      try {
        const data = await engineFetch<Record<string, unknown>>(`/sessions/${id}`);
        return toSession(data);
      } catch (e) {
        return {
          provider: "wpp-engine",
          sessionId: id,
          status: "erro",
          detalhe: e instanceof Error ? e.message : String(e),
        };
      }
    },

    async createSession({ phone, displayName, externalId }) {
      const data = await engineFetch<Record<string, unknown>>("/sessions", {
        method: "POST",
        body: {
          phone,
          display_name: displayName,
          external_id: externalId,
        },
      });
      return toSession(data);
    },

    async getQr(sessionId) {
      const data = await engineFetch<{ qr_code: string | null; qr_expires_at: string | null }>(
        `/sessions/${sessionId}/qr`,
      );
      return { qr: data.qr_code, expiresAt: data.qr_expires_at };
    },

    async reconnect(sessionId) {
      const data = await engineFetch<Record<string, unknown>>(`/sessions/${sessionId}/reconnect`, {
        method: "POST",
        body: {},
      });
      return toSession(data);
    },

    async sendText({ sessionId, to, text, idempotencyKey }): Promise<EnvioResultado> {
      // Engine NÃO faz retry — o CRM reenvia com a mesma idempotency_key.
      const maxAttempts = 3;
      let lastErr = "falha ao enviar";
      let retryAfterSec: number | undefined;
      for (let i = 0; i < maxAttempts; i++) {
        try {
          const data = await engineFetch<{ id?: string; message_id?: string }>(
            `/sessions/${sessionId}/messages`,
            {
              method: "POST",
              body: {
                to,
                content: { type: "text", text },
                idempotency_key: idempotencyKey,
              },
            },
          );
          return { ok: true, id: String(data.id ?? data.message_id ?? idempotencyKey) };
        } catch (e) {
          if (e instanceof WppEngineError) {
            lastErr = e.message;
            retryAfterSec = e.retryAfterSec;
            if (e.status === 429) {
              await new Promise((r) => setTimeout(r, (e.retryAfterSec ?? 1) * 1000));
              continue;
            }
            if (e.status >= 500) {
              await new Promise((r) => setTimeout(r, 500 * (i + 1)));
              continue;
            }
            return { ok: false, erro: lastErr, retryAfterSec };
          }
          lastErr = e instanceof Error ? e.message : String(e);
        }
      }
      return { ok: false, erro: lastErr, retryAfterSec };
    },

    async registerWebhook({ webhookUrl, webhookSecret }) {
      try {
        await engineFetch("/tenants/me", {
          method: "PATCH",
          body: { webhook_url: webhookUrl, webhook_secret: webhookSecret },
        });
        return { ok: true };
      } catch (e) {
        return { ok: false, erro: e instanceof Error ? e.message : String(e) };
      }
    },

    webhookPath() {
      return "/api/whatsapp/webhook";
    },
  };
}

/** Valida X-WPP-Engine-Signature (HMAC-SHA256 hex do raw body). */
export function verifyWppEngineSignature(
  rawBody: string | Buffer,
  signatureHex: string | null,
  secret: string,
): boolean {
  if (!signatureHex || !secret) return false;
  const digest = createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    const a = Buffer.from(digest, "utf8");
    const b = Buffer.from(signatureHex.trim(), "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function newWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString("hex")}`;
}

export function newIdempotencyKey(prefix = "crm"): string {
  return `${prefix}_${Date.now()}_${randomBytes(8).toString("hex")}`.slice(0, 120);
}
