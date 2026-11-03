/**
 * Cliente HTTP do WPP Engine: envelope { data, error }, Bearer key, 429 Retry-After.
 */
import { effectiveApiKey, effectiveSessionId, effectiveWebhookSecret } from "./store";

export type EngineEnvelope<T> = {
  data: T | null;
  error: { code: string; message: string } | null;
};

export class WppEngineError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
    public retryAfterSec?: number,
  ) {
    super(message);
    this.name = "WppEngineError";
  }
}

export function engineBaseUrl(): string {
  const raw = process.env.WPP_API_BASE_URL?.trim() || "https://wpp-engine.oneclient.com.br/v1";
  return raw.replace(/\/$/, "");
}

export function engineApiKey(): string | null {
  return process.env.WPP_API_KEY?.trim() || effectiveApiKey();
}

export function engineSessionId(): string | null {
  return process.env.WPP_SESSION_ID?.trim() || effectiveSessionId();
}

export function engineWebhookSecret(): string | null {
  return process.env.WPP_WEBHOOK_SECRET?.trim() || effectiveWebhookSecret();
}

export function engineConsoleUrl(): string {
  return process.env.WPP_CONSOLE_URL?.trim() || "https://wpp-engine.oneclient.com.br";
}

export async function engineFetch<T>(
  path: string,
  opts: {
    method?: string;
    body?: unknown;
    apiKey?: string;
    headers?: Record<string, string>;
  } = {},
): Promise<T> {
  const key = opts.apiKey ?? engineApiKey();
  if (!key) throw new WppEngineError("WPP_API_KEY ausente. Cole a key em Integrações.", "missing_key", 401);

  const url = `${engineBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
    ...(opts.headers ?? {}),
  };
  let body: BodyInit | undefined;
  if (opts.body !== undefined) {
    if (typeof FormData !== "undefined" && opts.body instanceof FormData) {
      body = opts.body;
    } else {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(opts.body);
    }
  }

  const res = await fetch(url, { method: opts.method ?? "GET", headers, body });
  const retryAfter = res.headers.get("Retry-After");
  const retryAfterSec = retryAfter ? Number(retryAfter) || undefined : undefined;

  let json: EngineEnvelope<T> | null = null;
  try {
    json = (await res.json()) as EngineEnvelope<T>;
  } catch {
    throw new WppEngineError(
      `Resposta inválida do Engine (HTTP ${res.status})`,
      "invalid_response",
      res.status,
      retryAfterSec,
    );
  }

  if (res.status === 429) {
    throw new WppEngineError(
      json?.error?.message ?? "Limite de 60 req/s. Aguarde e tente de novo.",
      json?.error?.code ?? "rate_limited",
      429,
      retryAfterSec,
    );
  }

  if (!res.ok || json.error) {
    throw new WppEngineError(
      json.error?.message ?? `HTTP ${res.status}`,
      json.error?.code ?? "http_error",
      res.status,
      retryAfterSec,
    );
  }

  if (json.data === null || json.data === undefined) {
    throw new WppEngineError("Engine devolveu data vazia", "empty_data", res.status);
  }
  return json.data;
}
