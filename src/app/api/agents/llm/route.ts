import { NextRequest, NextResponse } from "next/server";
import {
  effectiveAgentLlmModel,
  effectiveLlmApiKey,
  effectiveLlmModel,
  loadLlmConnection,
  mascaraChave,
  saveLlmConnection,
  temLlmKey,
} from "@/lib/agents/llm-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Status da chave LLM do membro (nunca devolve a chave completa). */
export async function GET() {
  const key = effectiveLlmApiKey();
  const conn = loadLlmConnection();
  const fromEnv = Boolean(
    process.env.CRM_LLM_API_KEY?.trim() || process.env.ANTHROPIC_API_KEY?.trim(),
  );
  return NextResponse.json({
    ok: true,
    configurada: temLlmKey(),
    origem: key ? (fromEnv ? "env" : "ui") : null,
    mascara: mascaraChave(key),
    model: effectiveLlmModel(),
    emberModel: effectiveAgentLlmModel("ember"),
    agentModels: conn?.agentModels ?? {},
    fallback: "regras locais nos agentes padrão; Ember exige LLM real e bloqueia sem chave",
  });
}

/**
 * Salva a chave Anthropic do membro e/ou modelos por agente (arquivo local + process.env da sessão).
 * Body: { apiKey?: "sk-ant-...", model?: "claude-haiku-4-5", emberModel?: "claude-sonnet-4-5", agentModels?: Record<string, string> }
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const hasApiKeyField = typeof body.apiKey === "string" && body.apiKey.trim().length > 0;
  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  const model = typeof body.model === "string" ? body.model.trim() || undefined : undefined;
  const emberModel = typeof body.emberModel === "string" ? body.emberModel.trim() : undefined;
  const rawAgentModels =
    body.agentModels && typeof body.agentModels === "object" && !Array.isArray(body.agentModels)
      ? (body.agentModels as Record<string, unknown>)
      : undefined;

  if (body.clear === true) {
    saveLlmConnection({ provider: "anthropic", updatedAt: new Date().toISOString() });
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.CRM_LLM_API_KEY;
    delete process.env.CRM_EMBER_MODEL;
    return NextResponse.json({
      ok: true,
      configurada: false,
      model: effectiveLlmModel(),
      emberModel: effectiveAgentLlmModel("ember"),
      agentModels: {},
    });
  }

  const prev = loadLlmConnection();
  const nextAgentModels: Record<string, string> = { ...(prev?.agentModels ?? {}) };
  if (rawAgentModels) {
    for (const [slug, val] of Object.entries(rawAgentModels)) {
      const v = typeof val === "string" ? val.trim() : "";
      if (v) nextAgentModels[slug] = v;
      else delete nextAgentModels[slug];
    }
  }
  if (emberModel !== undefined) {
    if (emberModel) nextAgentModels.ember = emberModel;
    else delete nextAgentModels.ember;
  }

  const isModelOnlyUpdate =
    !hasApiKeyField && (emberModel !== undefined || rawAgentModels !== undefined || model !== undefined);

  if (isModelOnlyUpdate) {
    saveLlmConnection({
      provider: "anthropic",
      apiKey: prev?.apiKey,
      model: model || prev?.model,
      agentModels: nextAgentModels,
      updatedAt: new Date().toISOString(),
    });
    if (model) process.env.CRM_LLM_MODEL = model;
    if (emberModel !== undefined) {
      if (emberModel) process.env.CRM_EMBER_MODEL = emberModel;
      else delete process.env.CRM_EMBER_MODEL;
    }
    const currentKey = effectiveLlmApiKey();
    return NextResponse.json({
      ok: true,
      configurada: temLlmKey(),
      mascara: mascaraChave(currentKey),
      model: effectiveLlmModel(),
      emberModel: effectiveAgentLlmModel("ember"),
      agentModels: nextAgentModels,
    });
  }

  if (!apiKey || apiKey.length < 20) {
    return NextResponse.json({ ok: false, erro: "Cole uma chave Anthropic válida (sk-ant-…)." }, { status: 400 });
  }

  saveLlmConnection({
    provider: "anthropic",
    apiKey,
    model: model || prev?.model,
    agentModels: nextAgentModels,
    updatedAt: new Date().toISOString(),
  });
  // Disponível no processo atual (dev / single-node).
  process.env.ANTHROPIC_API_KEY = apiKey;
  if (model) process.env.CRM_LLM_MODEL = model;
  if (emberModel) process.env.CRM_EMBER_MODEL = emberModel;

  return NextResponse.json({
    ok: true,
    configurada: true,
    mascara: mascaraChave(apiKey),
    model: effectiveLlmModel(),
    emberModel: effectiveAgentLlmModel("ember"),
    agentModels: nextAgentModels,
  });
}
