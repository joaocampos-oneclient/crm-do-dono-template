import { NextRequest, NextResponse } from "next/server";
import { atualizarCampanhaReciclador, obterDetalheCampanha } from "@/lib/reciclador";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const detalhe = await obterDetalheCampanha(id);
  if (!detalhe.campanha) {
    return NextResponse.json({ ok: false, erro: "Campanha não encontrada." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, ...detalhe });
}

async function handleUpdate(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const detalhe = await atualizarCampanhaReciclador(id, body);
    if (!detalhe.campanha) {
      return NextResponse.json({ ok: false, erro: "Campanha não encontrada." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, ...detalhe });
  } catch (e) {
    return NextResponse.json(
      { ok: false, erro: e instanceof Error ? e.message : "Erro ao atualizar campanha." },
      { status: 500 },
    );
  }
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  return handleUpdate(req, ctx);
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  return handleUpdate(req, ctx);
}
