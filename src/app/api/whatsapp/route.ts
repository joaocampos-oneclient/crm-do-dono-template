import { NextRequest, NextResponse } from "next/server";
import {
  getWhatsAppProvider,
  newIdempotencyKey,
  newWebhookSecret,
  resolveProviderId,
} from "@/lib/whatsapp";
import { loadConnection, saveConnection } from "@/lib/whatsapp/store";
import { createWppEngineProvider } from "@/lib/whatsapp/wpp-engine";
import { engineConsoleUrl } from "@/lib/whatsapp/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function appOrigin(req: NextRequest): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
}

/** Status / QR / info do provedor ativo. */
export async function GET(req: NextRequest) {
  const provider = getWhatsAppProvider();
  const sessionId = req.nextUrl.searchParams.get("session") ?? undefined;
  const action = req.nextUrl.searchParams.get("action") ?? "status";
  const conn = loadConnection();

  if (action === "info") {
    return NextResponse.json({
      provider: provider.id,
      label: provider.label,
      signupUrl: provider.signupUrl(),
      consoleUrl: engineConsoleUrl(),
      connected: Boolean(conn?.apiKey || process.env.WPP_API_KEY),
      sessionId: conn?.sessionId ?? process.env.WPP_SESSION_ID ?? null,
      oauthReady: false,
      limits: {
        reqPerSec: 60,
        msgsPerDay: 5000,
        selfServiceSessions: 1,
        groupsOptInMaxPerDay: 20,
        coldWarning: true,
      },
    });
  }

  if (action === "qr" && sessionId) {
    const qr = await provider.getQr(sessionId);
    return NextResponse.json({ sessionId, ...qr, provider: provider.id });
  }

  const status = await provider.status(sessionId);
  if ((status.status === "qr" || status.status === "pending") && status.sessionId) {
    const qr = await provider.getQr(status.sessionId).catch(() => ({ qr: null, expiresAt: null }));
    return NextResponse.json({ ...status, qr: qr.qr ?? status.qr, qrExpiresAt: qr.expiresAt });
  }
  return NextResponse.json(status);
}

/**
 * Ações:
 * - save_key: cola a API key uma vez (valida via GET /tenants/me)
 * - bootstrap: key + phone → valida, cria sessão, registra webhook, devolve QR
 * - refresh_qr / reconnect / send / start (legado)
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "status");
  const providerId = resolveProviderId();

  if (action === "save_key") {
    const apiKey = String(body.apiKey ?? "").trim();
    if (!apiKey.startsWith("wae_")) {
      return NextResponse.json(
        { ok: false, erro: "A key do Engine começa com wae_live_… (emitida no console)." },
        { status: 400 },
      );
    }
    const engine = createWppEngineProvider();
    const check = await engine.validateKey(apiKey);
    if (!check.ok) {
      return NextResponse.json({ ok: false, erro: check.erro ?? "Key inválida" }, { status: 401 });
    }
    const prev = loadConnection();
    saveConnection({
      provider: "wpp-engine",
      apiKey,
      sessionId: prev?.sessionId,
      webhookSecret: prev?.webhookSecret,
      tenantSlug: check.slug,
      phone: prev?.phone,
      updatedAt: new Date().toISOString(),
    });
    // Disponibiliza para este processo
    process.env.WPP_API_KEY = apiKey;
    return NextResponse.json({ ok: true, tenantId: check.tenantId, slug: check.slug });
  }

  if (action === "bootstrap") {
    const apiKey = String(body.apiKey ?? process.env.WPP_API_KEY ?? loadConnection()?.apiKey ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const displayName = body.displayName ? String(body.displayName) : undefined;
    if (!apiKey) {
      return NextResponse.json({ ok: false, erro: "Informe a API key do WPP Engine." }, { status: 400 });
    }
    if (!phone || phone.length < 8) {
      return NextResponse.json({ ok: false, erro: "Informe o telefone em E.164 (ex.: +5511999999999)." }, { status: 400 });
    }

    process.env.WPP_API_KEY = apiKey;
    const engine = createWppEngineProvider();
    const check = await engine.validateKey(apiKey);
    if (!check.ok) {
      return NextResponse.json({ ok: false, erro: check.erro ?? "Key inválida" }, { status: 401 });
    }

    const session = await engine.createSession({
      phone,
      displayName,
      externalId: `crm-${Date.now()}`,
    });

    const secret = newWebhookSecret();
    const origin = appOrigin(req);
    const webhookUrl = `${origin}${engine.webhookPath()}`;
    const hook = await engine.registerWebhook({ webhookUrl, webhookSecret: secret });

    saveConnection({
      provider: "wpp-engine",
      apiKey,
      sessionId: session.sessionId,
      webhookSecret: secret,
      phone,
      tenantSlug: check.slug,
      updatedAt: new Date().toISOString(),
    });
    process.env.WPP_SESSION_ID = session.sessionId;
    process.env.WPP_WEBHOOK_SECRET = secret;

    let qr = session.qr ?? null;
    let qrExpiresAt = session.qrExpiresAt ?? null;
    if (session.sessionId && !qr) {
      const q = await engine.getQr(session.sessionId).catch(() => ({ qr: null, expiresAt: null }));
      qr = q.qr;
      qrExpiresAt = q.expiresAt;
    }

    return NextResponse.json({
      ok: true,
      session: { ...session, qr, qrExpiresAt },
      webhook: { url: webhookUrl, registered: hook.ok, erro: hook.erro },
      coldWarning: true,
      aviso:
        "Número novo nasce cold: aqueça aos poucos. Limite 5000 msgs/dia · 1 sessão no plano self-service. Multi-operador fica no CRM (o Engine não tem atendentes).",
    });
  }

  const provider = getWhatsAppProvider();

  if (action === "refresh_qr") {
    const sessionId = String(body.sessionId ?? loadConnection()?.sessionId ?? "");
    if (!sessionId) return NextResponse.json({ ok: false, erro: "Sem sessionId" }, { status: 400 });
    const qr = await provider.getQr(sessionId);
    return NextResponse.json({ ok: true, sessionId, ...qr });
  }

  if (action === "reconnect") {
    const sessionId = String(body.sessionId ?? loadConnection()?.sessionId ?? "");
    if (!sessionId) return NextResponse.json({ ok: false, erro: "Sem sessionId" }, { status: 400 });
    const session = await provider.reconnect(sessionId);
    return NextResponse.json({ ok: true, session });
  }

  if (action === "send") {
    const sessionId = String(body.sessionId ?? loadConnection()?.sessionId ?? "");
    const to = String(body.to ?? "");
    const text = String(body.text ?? "");
    if (!sessionId || !to || !text) {
      return NextResponse.json({ ok: false, erro: "sessionId, to e text são obrigatórios" }, { status: 400 });
    }
    const r = await provider.sendText({
      sessionId,
      to,
      text,
      idempotencyKey: String(body.idempotencyKey ?? newIdempotencyKey()),
    });
    return NextResponse.json(r, { status: r.ok ? 200 : 400 });
  }

  if (action === "start") {
    // Compat: WAHA ou createSession simples
    if (providerId === "waha") {
      const session = await provider.createSession({ phone: "", displayName: String(body.session ?? "principal") });
      return NextResponse.json(session);
    }
    return NextResponse.json(
      { ok: false, erro: "Use action=bootstrap com apiKey + phone (WPP Engine)." },
      { status: 400 },
    );
  }

  return NextResponse.json({ error: "action inválida", provider: providerId }, { status: 400 });
}
