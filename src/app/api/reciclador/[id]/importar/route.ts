import { NextRequest, NextResponse } from "next/server";
import { importarCsvNaCampanha, obterDetalheCampanha } from "@/lib/reciclador";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function extrairCsvDaRequisicao(req: NextRequest): Promise<string> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file") ?? form.get("csv");
    if (file && typeof (file as Blob).text === "function") {
      return await (file as Blob).text();
    }
    if (typeof file === "string") return file;
    return "";
  }

  if (contentType.includes("text/csv") || contentType.includes("text/plain")) {
    return await req.text();
  }

  const body = await req.json().catch(() => ({}));
  return String(body.csv ?? body.csvText ?? body.conteudo ?? "");
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const csvText = await extrairCsvDaRequisicao(req);
    if (!csvText.trim()) {
      return NextResponse.json(
        { ok: false, erro: "Envie um conteúdo CSV válido com colunas de telefone e contexto." },
        { status: 400 },
      );
    }

    const resultado = await importarCsvNaCampanha(id, csvText);
    const detalhe = await obterDetalheCampanha(id);

    return NextResponse.json({
      ok: true,
      ...resultado,
      resultado,
      detalhe,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao importar CSV.";
    const status = /não encontrada/i.test(msg) ? 404 : 500;
    return NextResponse.json({ ok: false, erro: msg }, { status });
  }
}
