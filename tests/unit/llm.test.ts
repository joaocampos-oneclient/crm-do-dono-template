import { afterEach, describe, expect, it } from "vitest";
import { existsSync, rmSync } from "fs";
import { resolve } from "path";
import {
  effectiveLlmApiKey,
  mascaraChave,
  saveLlmConnection,
  temLlmKey,
} from "@/lib/agents/llm-store";
import { instructionsDoAgente, parseJsonDaResposta } from "@/lib/agents/llm";
import { executarAgente } from "@/lib/agents";

const FILE = resolve(process.cwd(), "data/llm-connection.json");

afterEach(() => {
  if (existsSync(FILE)) rmSync(FILE);
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.CRM_LLM_API_KEY;
});

describe("llm-store", () => {
  it("sem chave → temLlmKey false", () => {
    expect(temLlmKey()).toBe(false);
    expect(effectiveLlmApiKey()).toBeNull();
  });

  it("salva chave na UI e mascara", () => {
    saveLlmConnection({
      provider: "anthropic",
      apiKey: "sk-ant-test-chave-bem-longa-123456",
      updatedAt: new Date().toISOString(),
    });
    expect(temLlmKey()).toBe(true);
    expect(mascaraChave(effectiveLlmApiKey())).toMatch(/…/);
  });

  it("env tem prioridade sobre arquivo", () => {
    saveLlmConnection({
      provider: "anthropic",
      apiKey: "sk-ant-arquivo-xxxxxxxxxxxx",
      updatedAt: new Date().toISOString(),
    });
    process.env.ANTHROPIC_API_KEY = "sk-ant-env-yyyyyyyyyyyy";
    expect(effectiveLlmApiKey()).toBe("sk-ant-env-yyyyyyyyyyyy");
  });
});

describe("llm helpers", () => {
  it("parseJsonDaResposta lê fence e objeto cru", () => {
    expect(parseJsonDaResposta('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJsonDaResposta('Olá {"texto":"oi"} fim')).toEqual({ texto: "oi" });
  });

  it("instructionsDoAgente menciona preço para Cláudio", () => {
    expect(instructionsDoAgente("claudio")).toMatch(/preço/i);
    expect(instructionsDoAgente("ledger")).toMatch(/Nunca cobra/i);
  });
});

describe("fallback regras sem LLM", () => {
  it("executarAgente marca usadoLlm=false", async () => {
    const r = await executarAgente("claudio", { contexto: { rascunho: "Oi!" } });
    expect(r.usadoLlm).toBe(false);
    expect(r.saida.payload.texto).toMatch(/Oi/);
  });
});
