import { NextRequest, NextResponse } from "next/server";
import { obterDetalheCampanha, simularCampanhaReciclador } from "@/lib/reciclador";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const limite = Number.isFinite(Number(body.limite)) && Number(body.limite) > 0 ? Number(body.limite) : 3;

    const resultado = await simularCampanhaReciclador(id, limite);
    const detalhe = await obterDetalheCampanha(id);

    return NextResponse.json({
      ok: true,
      ...resultado,
      resultado,
      detalhe,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro na simulação da campanha.";
    const status = /não encontrada/i.test(msg) ? 404 : 500;
    return NextResponse.json({ ok: false, erro: msg }, { status });
  }
}
