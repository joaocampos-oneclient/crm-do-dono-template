import { NextRequest, NextResponse } from "next/server";
import { requisicaoAgentesAutorizada } from "@/lib/agents/autorizacao";
import { lerLogAgentes } from "@/lib/agents/log";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!requisicaoAgentesAutorizada(req)) {
    return NextResponse.json({ ok: false, erro: "Não autorizado." }, { status: 401 });
  }
  const limite = Number(req.nextUrl.searchParams.get("limite"));
  return NextResponse.json({ ok: true, decisoes: lerLogAgentes(Number.isFinite(limite) && limite > 0 ? limite : 100) });
}
