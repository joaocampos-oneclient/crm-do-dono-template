import { NextRequest, NextResponse } from "next/server";
import { requisicaoAgentesAutorizada } from "@/lib/agents/autorizacao";
import { lerSugestoesPilot } from "@/lib/agents/pilot-tick";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Sugestões de follow-up pendentes que o Pilot preparou (nada foi enviado). */
export async function GET(req: NextRequest) {
  if (!requisicaoAgentesAutorizada(req)) {
    return NextResponse.json({ ok: false, erro: "Não autorizado." }, { status: 401 });
  }
  return NextResponse.json({ ok: true, sugestoes: lerSugestoesPilot().filter((s) => s.status === "pendente") });
}
