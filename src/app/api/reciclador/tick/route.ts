import { NextRequest, NextResponse } from "next/server";
import { executarTickReciclador } from "@/lib/reciclador";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function requisicaoAutorizada(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) return true;

  const authHeader = req.headers.get("authorization") ?? "";
  if (authHeader === `Bearer ${cronSecret}`) return true;

  // Permite disparo manual via UI no mesmo domínio (POST same-origin)
  if (req.method === "POST") {
    const secFetchSite = req.headers.get("sec-fetch-site");
    if (secFetchSite === "same-origin") return true;

    const host = req.headers.get("host");
    const origin = req.headers.get("origin");
    const referer = req.headers.get("referer");
    if (host) {
      if (origin && origin.includes(host)) return true;
      if (referer && referer.includes(host)) return true;
    }
  }

  return false;
}

export async function GET(req: NextRequest) {
  if (!requisicaoAutorizada(req)) {
    return NextResponse.json({ ok: false, erro: "Não autorizado." }, { status: 401 });
  }

  try {
    const campanhaId = req.nextUrl.searchParams.get("campanhaId") || undefined;
    const limiteRaw = Number(req.nextUrl.searchParams.get("limite"));
    const limite = Number.isFinite(limiteRaw) && limiteRaw > 0 ? limiteRaw : undefined;
    const ignorarJanela = req.nextUrl.searchParams.get("ignorarJanela") === "1";

    const resultado = await executarTickReciclador({
      campanhaId,
      limite,
      ignorarJanela,
    });
    return NextResponse.json({ ok: true, ...resultado, resultado });
  } catch (e) {
    return NextResponse.json(
      { ok: false, erro: e instanceof Error ? e.message : "Erro ao executar tick do Reciclador." },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  if (!requisicaoAutorizada(req)) {
    return NextResponse.json({ ok: false, erro: "Não autorizado." }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const campanhaId = typeof body.campanhaId === "string" && body.campanhaId.trim() ? body.campanhaId.trim() : undefined;
    const limiteRaw = Number(body.limite);
    const limite = Number.isFinite(limiteRaw) && limiteRaw > 0 ? limiteRaw : undefined;
    const ignorarJanela = body.ignorarJanela === true;

    const resultado = await executarTickReciclador({
      campanhaId,
      limite,
      ignorarJanela,
    });
    return NextResponse.json({ ok: true, ...resultado, resultado });
  } catch (e) {
    return NextResponse.json(
      { ok: false, erro: e instanceof Error ? e.message : "Erro ao executar tick do Reciclador." },
      { status: 500 },
    );
  }
}
