import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { verifyWppEngineSignature } from "@/lib/whatsapp";
import { effectiveWebhookSecret } from "@/lib/whatsapp/store";
import {
  ingestWhatsAppMessage,
  type MessageEventType,
} from "@/lib/whatsapp/ingest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Dedupe em memória (processo). Em multi-instância, use Redis/Supabase. */
const seen = new Map<string, number>();
const SEEN_TTL_MS = 24 * 60 * 60 * 1000;

const MESSAGE_TYPES = new Set<MessageEventType>([
  "message.received",
  "message.sent",
  "message.delivered",
  "message.read",
  "message.failed",
]);

function remember(eventId: string): boolean {
  const now = Date.now();
  for (const [k, t] of seen) {
    if (now - t > SEEN_TTL_MS) seen.delete(k);
  }
  if (seen.has(eventId)) return false;
  seen.set(eventId, now);
  return true;
}

/**
 * Webhook do WPP Engine.
 * Envelope: { id, type, timestamp, tenant_id, session_id, channel, data }
 * Header: X-WPP-Engine-Signature (HMAC-SHA256 hex), X-WPP-Engine-Event-Id
 */
export async function POST(req: NextRequest) {
  const raw = Buffer.from(await req.arrayBuffer());
  const signature = req.headers.get("x-wpp-engine-signature");
  const eventId =
    req.headers.get("x-wpp-engine-event-id") ??
    createHash("sha256").update(raw).digest("hex").slice(0, 32);

  const secret = effectiveWebhookSecret();
  if (secret) {
    const ok = verifyWppEngineSignature(raw, signature, secret);
    if (!ok) {
      return NextResponse.json({ ok: false, erro: "assinatura inválida" }, { status: 401 });
    }
  }

  if (!remember(eventId)) {
    return NextResponse.json({ ok: true, deduped: true });
  }

  let payload: {
    id?: string;
    type?: string;
    timestamp?: string;
    session_id?: string;
    data?: unknown;
  } = {};
  try {
    payload = JSON.parse(raw.toString("utf8"));
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const type = payload.type ?? "";
  let ingest: Awaited<ReturnType<typeof ingestWhatsAppMessage>> | null = null;

  if (MESSAGE_TYPES.has(type as MessageEventType)) {
    try {
      ingest = await ingestWhatsAppMessage({
        type: type as MessageEventType,
        eventId: payload.id ?? eventId,
        sessionId: payload.session_id,
        data: payload.data,
        timestamp: payload.timestamp,
      });
    } catch (e) {
      console.error("[wpp-engine webhook] ingest falhou", e);
      // Ainda responde 2xx para o Engine não retentar em loop agressivo;
      // o erro fica no log para o dono/ops.
      return NextResponse.json({
        ok: true,
        ingest: { ok: false, erro: e instanceof Error ? e.message : String(e) },
      });
    }
  } else {
    console.info("[wpp-engine webhook]", type, payload.session_id, eventId);
  }

  return NextResponse.json({ ok: true, ingest: ingest ?? undefined });
}
