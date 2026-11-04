import { afterEach, describe, expect, it } from "vitest";
import { existsSync, rmSync } from "fs";
import { resolve } from "path";
import { callTool, listToolsForNivel } from "@/lib/mcp/tools";
import { estadoExemplo } from "@/data/exemplo";

const TEMP_RECICLADOR = resolve(process.cwd(), "data/test-mcp-reciclador.json");

afterEach(() => {
  if (existsSync(TEMP_RECICLADOR)) rmSync(TEMP_RECICLADOR);
  delete process.env.RECICLADOR_DATA_FILE;
});

const ctx = (nivel: "leitura" | "escrita" | "admin") => ({
  nivel,
  estado: estadoExemplo(),
  audit: () => undefined,
});

describe("MCP", () => {
  it("leitura não vê ferramentas de escrita", () => {
    const nomes = listToolsForNivel("leitura").map((t) => t.name);
    expect(nomes).toContain("crm_funil_resumo");
    expect(nomes).toContain("crm_reciclador_listar");
    expect(nomes).not.toContain("crm_oportunidade_mover");
    expect(nomes).not.toContain("crm_reciclador_criar");
  });

  it("escrita cobre farol, agentes e reciclador", () => {
    const nomes = listToolsForNivel("escrita").map((t) => t.name);
    expect(nomes).toContain("crm_farol_funil");
    expect(nomes).toContain("crm_agente_executar");
    expect(nomes).toContain("crm_reciclador_simular");
    expect(nomes).toContain("crm_reciclador_emergencia");
  });

  it("crm_funil_resumo responde", async () => {
    const r = await callTool("crm_funil_resumo", {}, ctx("leitura"));
    expect(r.isError).toBeFalsy();
    expect(r.content[0].text).toMatch(/etapas/);
  });

  it("crm_farol_funil exige escrita", async () => {
    const negado = await callTool("crm_farol_funil", { aplicar: true }, ctx("leitura"));
    expect(negado.isError).toBe(true);
    const ok = await callTool("crm_farol_funil", { aplicar: true, criterio: "problema com o Cláudio" }, ctx("escrita"));
    expect(ok.isError).toBeFalsy();
    expect(ok.content[0].text).toMatch(/aplicado/);
  });

  it("mascara telefone na listagem", async () => {
    const r = await callTool("crm_contatos_listar", { limite: 5 }, ctx("leitura"));
    expect(r.content[0].text).toMatch(/\*\*\*/);
  });

  it("crm_hoje e crm_placar respondem para o dono", async () => {
    const hoje = await callTool("crm_hoje", {}, ctx("leitura"));
    expect(hoje.isError).toBeFalsy();
    expect(hoje.content[0].text).toMatch(/handoffs/);
    const placar = await callTool("crm_placar", {}, ctx("leitura"));
    expect(placar.isError).toBeFalsy();
    expect(placar.content[0].text).toMatch(/vendasHoje/);
  });

  it("crm_tarefas_listar e handoffs", async () => {
    const tarefas = await callTool("crm_tarefas_listar", { soVencidas: true }, ctx("leitura"));
    expect(tarefas.isError).toBeFalsy();
    expect(tarefas.content[0].text).toMatch(/tarefas/);
    const handoffs = await callTool("crm_handoffs_listar", {}, ctx("leitura"));
    expect(handoffs.isError).toBeFalsy();
    expect(handoffs.content[0].text).toMatch(/handoffs/);
  });

  it("crm_contato_criar exige escrita", async () => {
    const negado = await callTool(
      "crm_contato_criar",
      { nome: "Teste", telefone: "62999990000" },
      ctx("leitura"),
    );
    expect(negado.isError).toBe(true);
    const ok = await callTool(
      "crm_contato_criar",
      { nome: "Teste", telefone: "62999990000" },
      ctx("escrita"),
    );
    expect(ok.isError).toBeFalsy();
  });

  it("crm_reciclador_* cria campanha, mascara PII, simula dry-run e aciona emergência", async () => {
    process.env.RECICLADOR_DATA_FILE = TEMP_RECICLADOR;

    const negado = await callTool(
      "crm_reciclador_criar",
      { nome: "Teste Relance", objetivo: "Reabrir conversas antigas" },
      ctx("leitura"),
    );
    expect(negado.isError).toBe(true);

    const criada = await callTool(
      "crm_reciclador_criar",
      { nome: "Teste Relance", objetivo: "Reabrir conversas antigas", horasParadoMin: 0 },
      ctx("escrita"),
    );
    expect(criada.isError).toBeFalsy();
    const parsedCriada = JSON.parse(criada.content[0].text);
    const campanhaId = parsedCriada.campanha.id as string;
    expect(campanhaId).toBeTruthy();

    const detalhe = await callTool("crm_reciclador_listar", { campanhaId }, ctx("leitura"));
    expect(detalhe.isError).toBeFalsy();
    expect(detalhe.content[0].text).toMatch(/telefoneMascarado/);
    expect(detalhe.content[0].text).not.toMatch(/"telefone":/);

    const sim = await callTool("crm_reciclador_simular", { campanhaId, limite: 2 }, ctx("escrita"));
    expect(sim.isError).toBeFalsy();

    const opt = await callTool(
      "crm_reciclador_optout",
      { telefone: "5511988112233", nomeContato: "Lead Protegido" },
      ctx("escrita"),
    );
    expect(opt.isError).toBeFalsy();
    expect(opt.content[0].text).not.toMatch(/5511988112233/);

    const emerg = await callTool("crm_reciclador_emergencia", { motivo: "Teste MCP" }, ctx("escrita"));
    expect(emerg.isError).toBeFalsy();
    expect(emerg.content[0].text).toMatch(/global/);
  });
});
