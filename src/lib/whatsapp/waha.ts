/**
 * Adaptador WAHA (WhatsApp HTTP API) — QR code por sessão.
 * Sem WAHA_URL, opera em modo demo.
 */
export type WahaStatus = "desconectado" | "qr" | "conectado" | "erro";

export type WahaSessao = {
  name: string;
  status: WahaStatus;
  qr?: string;
  telefone?: string;
};

const demos = new Map<string, WahaSessao>();

function baseUrl(): string | null {
  return process.env.WAHA_URL?.replace(/\/$/, "") || null;
}

function headers(): HeadersInit {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.WAHA_API_KEY) h["X-Api-Key"] = process.env.WAHA_API_KEY;
  return h;
}

export async function statusSessao(nome = "principal"): Promise<WahaSessao> {
  const base = baseUrl();
  if (!base) {
    return demos.get(nome) ?? { name: nome, status: "desconectado" };
  }
  try {
    const res = await fetch(`${base}/api/sessions/${nome}`, { headers: headers() });
    if (!res.ok) return { name: nome, status: "desconectado" };
    const j = await res.json();
    const status: WahaStatus =
      j.status === "WORKING" ? "conectado" : j.status === "SCAN_QR_CODE" ? "qr" : "desconectado";
    return { name: nome, status, telefone: j.me?.id };
  } catch {
    return { name: nome, status: "erro" };
  }
}

export async function iniciarSessao(nome = "principal"): Promise<WahaSessao> {
  const base = baseUrl();
  if (!base) {
    const s: WahaSessao = {
      name: nome,
      status: "qr",
      qr: "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="#fff" width="200" height="200"/><text x="20" y="100" font-size="12">QR demo · configure WAHA_URL</text></svg>`),
    };
    demos.set(nome, s);
    return s;
  }
  await fetch(`${base}/api/sessions`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ name: nome, start: true }),
  }).catch(() => null);
  return statusSessao(nome);
}

export async function obterQr(nome = "principal"): Promise<string | null> {
  const base = baseUrl();
  if (!base) {
    const s = demos.get(nome) ?? (await iniciarSessao(nome));
    return s.qr ?? null;
  }
  try {
    const res = await fetch(`${base}/api/${nome}/auth/qr?format=image`, { headers: headers() });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const b64 = Buffer.from(buf).toString("base64");
    return `data:image/png;base64,${b64}`;
  } catch {
    return null;
  }
}

export async function enviarTexto(nome: string, chatId: string, texto: string): Promise<{ ok: boolean; id?: string; erro?: string }> {
  const base = baseUrl();
  if (!base) return { ok: true, id: `demo-${Date.now()}` };
  try {
    const res = await fetch(`${base}/api/sendText`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ session: nome, chatId, text: texto }),
    });
    if (!res.ok) return { ok: false, erro: await res.text() };
    const j = await res.json();
    return { ok: true, id: j.id };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}
