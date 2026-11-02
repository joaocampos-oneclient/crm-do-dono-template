/**
 * Adaptador opcional WAHA. Não é o caminho padrão.
 * Ative com WHATSAPP_PROVIDER=waha e WAHA_URL.
 * Compose: docker compose -f docker-compose.waha.yml up -d
 */
import type {
  ConnectCallbackResult,
  ConnectStart,
  EnvioResultado,
  WhatsAppProvider,
  WhatsAppSession,
} from "./types";

type WahaRaw = { name: string; status: string; qr?: string; telefone?: string };

const demos = new Map<string, WahaRaw>();

function baseUrl(): string | null {
  return process.env.WAHA_URL?.replace(/\/$/, "") || null;
}

function headers(): HeadersInit {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.WAHA_API_KEY) h["X-Api-Key"] = process.env.WAHA_API_KEY;
  return h;
}

function map(s: WahaRaw): WhatsAppSession {
  const status =
    s.status === "WORKING" || s.status === "conectado"
      ? "conectado"
      : s.status === "SCAN_QR_CODE" || s.status === "qr"
        ? "qr"
        : s.status === "erro"
          ? "erro"
          : "desconectado";
  return {
    provider: "waha",
    sessionId: s.name,
    status,
    qr: s.qr,
    telefone: s.telefone,
    detalhe: "Provedor alternativo (WAHA). Preferimos WPP Engine.",
  };
}

export function createWahaProvider(): WhatsAppProvider {
  return {
    id: "waha",
    label: "WAHA (opcional)",

    signupUrl() {
      return "https://waha.devlike.pro/";
    },

    async startConnect({ returnTo }): Promise<ConnectStart> {
      return {
        redirectUrl: returnTo,
        state: "waha-local",
        mode: "api_key",
      };
    },

    async completeConnect(): Promise<ConnectCallbackResult> {
      return { ok: false, erro: "WAHA não usa OAuth. Configure WAHA_URL." };
    },

    async validateKey() {
      if (!baseUrl()) return { ok: false, erro: "WAHA_URL ausente" };
      return { ok: true };
    },

    async status(sessionId = "principal") {
      const base = baseUrl();
      if (!base) {
        const d = demos.get(sessionId) ?? { name: sessionId, status: "desconectado" };
        return map(d);
      }
      try {
        const res = await fetch(`${base}/api/sessions/${sessionId}`, { headers: headers() });
        if (!res.ok) return map({ name: sessionId, status: "desconectado" });
        const j = await res.json();
        return map({
          name: sessionId,
          status: j.status,
          telefone: j.me?.id,
        });
      } catch {
        return map({ name: sessionId, status: "erro" });
      }
    },

    async createSession({ displayName }) {
      const nome = displayName || "principal";
      const base = baseUrl();
      if (!base) {
        const s: WahaRaw = {
          name: nome,
          status: "qr",
          qr:
            "data:image/svg+xml," +
            encodeURIComponent(
              `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="#fff" width="200" height="200"/><text x="16" y="100" font-size="11">QR WAHA demo</text></svg>`,
            ),
        };
        demos.set(nome, s);
        return map(s);
      }
      await fetch(`${base}/api/sessions`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ name: nome, start: true }),
      }).catch(() => null);
      return this.status(nome);
    },

    async getQr(sessionId) {
      const base = baseUrl();
      if (!base) {
        const s = demos.get(sessionId);
        return { qr: s?.qr ?? null, expiresAt: null };
      }
      try {
        const res = await fetch(`${base}/api/${sessionId}/auth/qr?format=image`, { headers: headers() });
        if (!res.ok) return { qr: null, expiresAt: null };
        const buf = await res.arrayBuffer();
        return { qr: `data:image/png;base64,${Buffer.from(buf).toString("base64")}`, expiresAt: null };
      } catch {
        return { qr: null, expiresAt: null };
      }
    },

    async reconnect(sessionId) {
      return this.createSession({ phone: "", displayName: sessionId });
    },

    async sendText({ sessionId, to, text }): Promise<EnvioResultado> {
      const base = baseUrl();
      if (!base) return { ok: true, id: `waha-demo-${Date.now()}` };
      try {
        const res = await fetch(`${base}/api/sendText`, {
          method: "POST",
          headers: headers(),
          body: JSON.stringify({ session: sessionId, chatId: to, text }),
        });
        if (!res.ok) return { ok: false, erro: await res.text() };
        const j = await res.json();
        return { ok: true, id: String(j.id ?? Date.now()) };
      } catch (e) {
        return { ok: false, erro: e instanceof Error ? e.message : String(e) };
      }
    },

    async registerWebhook() {
      return { ok: true };
    },

    webhookPath() {
      return "/api/whatsapp/webhook";
    },
  };
}
