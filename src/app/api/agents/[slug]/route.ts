import { NextRequest, NextResponse } from "next/server";
import { executarAgente } from "@/lib/agents";
import { AgenteSlug } from "@/lib/agents/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const parsed = AgenteSlug.safeParse(slug);
  if (!parsed.success) {
    return NextResponse.json({ error: "Agente inválido" }, { status: 400 });
  }
  const body = await req.json().catch(() => ({}));
  const result = await executarAgente(parsed.data, {
    contatoId: body.contatoId,
    oportunidadeId: body.oportunidadeId,
    contexto: body.contexto ?? {},
  });
  return NextResponse.json(result);
}
