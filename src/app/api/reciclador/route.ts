import { NextRequest, NextResponse } from "next/server";
import { effectiveAgentLlmModel, temLlmKey } from "@/lib/agents/llm-store";
import {
  acionarParadaEmergenciaGlobal,
  criarCampanhaReciclador,
  listarEstadoReciclador,
  obterDetalheCampanha,
  registrarOptOutReciclador,
} from "@/lib/reciclador";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const estado = await listarEstadoReciclador();
    const campanhaIdQuery = req.nextUrl.searchParams.get("campanhaId");
    const alvoId = campanhaIdQuery || estado.campanhas[0]?.id || null;
    const detalheInicial = alvoId ? await obterDetalheCampanha(alvoId) : null;

    return NextResponse.json({
      ok: true,
      ...estado,
      detalheInicial,
      llmConfigurada: temLlmKey(),
      emberModel: effectiveAgentLlmModel("ember"),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, erro: e instanceof Error ? e.message : "Erro ao carregar estado do Reciclador." },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const acao = typeof body.acao === "string" ? body.acao : "";

    if (acao === "emergencia" || acao === "parada_emergencia" || acao === "emergencia_global") {
      const res = await acionarParadaEmergenciaGlobal(
        typeof body.motivo === "string" ? body.motivo : undefined,
      );
      const estado = await listarEstadoReciclador();
      return NextResponse.json({ ok: true, ...res, ...estado });
    }

    if (acao === "optout" || acao === "registrar_optout") {
      const telefone = String(body.telefone ?? "").trim();
      if (!telefone) {
        return NextResponse.json({ ok: false, erro: "Informe um telefone para opt-out." }, { status: 400 });
      }
      const res = await registrarOptOutReciclador({
        telefone,
        contatoId: typeof body.contatoId === "string" ? body.contatoId : undefined,
        nomeContato: typeof body.nomeContato === "string" ? body.nomeContato : undefined,
        motivo: body.motivo ?? "manual",
        evidencia: typeof body.evidencia === "string" ? body.evidencia : undefined,
        tema: typeof body.tema === "string" ? body.tema : undefined,
      });
      const estado = await listarEstadoReciclador();
      return NextResponse.json({ ok: true, ...res, ...estado });
    }

    const origemCampanha =
      body.campanha && typeof body.campanha === "object"
        ? (body.campanha as Record<string, unknown>)
        : (body as Record<string, unknown>);

    const nome = String(origemCampanha.nome ?? "").trim();
    if (!nome) {
      return NextResponse.json(
        { ok: false, erro: "Informe o nome da campanha." },
        { status: 400 },
      );
    }

    const criada = await criarCampanhaReciclador({
      nome,
      objetivo: String(origemCampanha.objetivo ?? "Reabrir conversas paradas com contexto real."),
      filtro: origemCampanha.filtro as never,
      fontes: origemCampanha.fontes as never,
      cercas: origemCampanha.cercas as never,
      freios: origemCampanha.freios as never,
      popularDoCrm: origemCampanha.popularDoCrm !== false,
    });

    return NextResponse.json({
      ok: true,
      ...criada,
      incidentes: [],
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, erro: e instanceof Error ? e.message : "Erro ao processar ação no Reciclador." },
      { status: 500 },
    );
  }
}
