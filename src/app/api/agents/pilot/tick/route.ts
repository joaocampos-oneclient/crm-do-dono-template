import { NextRequest, NextResponse } from "next/server";
import { requisicaoAgentesAutorizada } from "@/lib/agents/autorizacao";
import { executarTickPilot } from "@/lib/agents/pilot-tick";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function limiteDe(valor: unknown): number | undefined {
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 50) : undefined;
}

async function rodar(req: NextRequest, limite: unknown, ignorarJanela: boolean) {
  if (!requisicaoAgentesAutorizada(req)) {
    return NextResponse.json({ ok: false, erro: "Não autorizado." }, { status: 401 });
  }
  try {
    const resultado = await executarTickPilot({ limite: limiteDe(limite), ignorarJanela });
    return NextResponse.json({ ok: true, ...resultado });
  } catch (e) {
    return NextResponse.json(
      { ok: false, erro: e instanceof Error ? e.message : "Erro ao executar tick do Pilot." },
      { status: 500 },
    );
  }
}

/** Cron (ex.: Vercel Cron) chama GET. Sem CRM_PILOT_AUTO=1 só sugere. */
export async function GET(req: NextRequest) {
  return rodar(req, req.nextUrl.searchParams.get("limite"), req.nextUrl.searchParams.get("ignorarJanela") === "1");
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return rodar(req, body?.limite, body?.ignorarJanela === true);
}
