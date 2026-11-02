import { NextRequest, NextResponse } from "next/server";
import { iniciarSessao, obterQr, statusSessao, enviarTexto } from "@/lib/whatsapp/waha";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const nome = req.nextUrl.searchParams.get("session") ?? "principal";
  const action = req.nextUrl.searchParams.get("action") ?? "status";
  if (action === "qr") {
    const qr = await obterQr(nome);
    return NextResponse.json({ session: nome, qr });
  }
  const status = await statusSessao(nome);
  return NextResponse.json(status);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const nome = String(body.session ?? "principal");
  const action = String(body.action ?? "start");

  if (action === "start") {
    const s = await iniciarSessao(nome);
    const qr = s.status === "qr" ? await obterQr(nome) : null;
    return NextResponse.json({ ...s, qr });
  }
  if (action === "send") {
    const r = await enviarTexto(nome, String(body.chatId ?? ""), String(body.text ?? ""));
    return NextResponse.json(r, { status: r.ok ? 200 : 400 });
  }
  return NextResponse.json({ error: "action inválida" }, { status: 400 });
}

/** Webhook WAHA → grava mensagem (demo: só loga). */
export async function PUT(req: NextRequest) {
  const payload = await req.json().catch(() => null);
  console.info("[whatsapp webhook]", JSON.stringify(payload)?.slice(0, 500));
  return NextResponse.json({ ok: true });
}
