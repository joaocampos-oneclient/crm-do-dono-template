import { NextRequest, NextResponse } from "next/server";
import {
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
  const fromEnv = Boolean(
    process.env.CRM_LLM_API_KEY?.trim() || process.env.ANTHROPIC_API_KEY?.trim(),
  );
  return NextResponse.json({
    ok: true,
    configurada: temLlmKey(),
    origem: key ? (fromEnv ? "env" : "ui") : null,
    mascara: mascaraChave(key),
    model: effectiveLlmModel(),
    fallback: "regras locais (sem chave ou se a chamada falhar)",
  });
}

/**
 * Salva a chave Anthropic do membro (arquivo local + process.env da sessão).
 * Body: { apiKey: "sk-ant-...", model?: "claude-haiku-4-5" }
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const apiKey = String(body.apiKey ?? "").trim();
  const model = String(body.model ?? "").trim() || undefined;

  if (body.clear === true) {
    saveLlmConnection({ provider: "anthropic", updatedAt: new Date().toISOString() });
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.CRM_LLM_API_KEY;
    return NextResponse.json({ ok: true, configurada: false });
  }

  if (!apiKey || apiKey.length < 20) {
    return NextResponse.json({ ok: false, erro: "Cole uma chave Anthropic válida (sk-ant-…)." }, { status: 400 });
  }

  const prev = loadLlmConnection();
  saveLlmConnection({
    provider: "anthropic",
    apiKey,
    model: model || prev?.model,
    updatedAt: new Date().toISOString(),
  });
  // Disponível no processo atual (dev / single-node).
  process.env.ANTHROPIC_API_KEY = apiKey;
  if (model) process.env.CRM_LLM_MODEL = model;

  return NextResponse.json({
    ok: true,
    configurada: true,
    mascara: mascaraChave(apiKey),
    model: effectiveLlmModel(),
  });
}
