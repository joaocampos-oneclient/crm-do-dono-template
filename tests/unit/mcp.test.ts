import { describe, expect, it } from "vitest";
import { callTool, listToolsForNivel } from "@/lib/mcp/tools";
import { estadoExemplo } from "@/data/exemplo";

const ctx = (nivel: "leitura" | "escrita" | "admin") => ({
  nivel,
  estado: estadoExemplo(),
  audit: () => undefined,
});

describe("MCP", () => {
  it("leitura não vê ferramentas de escrita", () => {
    const nomes = listToolsForNivel("leitura").map((t) => t.name);
    expect(nomes).toContain("crm_funil_resumo");
    expect(nomes).not.toContain("crm_oportunidade_mover");
  });

  it("escrita cobre farol e agentes", () => {
    const nomes = listToolsForNivel("escrita").map((t) => t.name);
    expect(nomes).toContain("crm_farol_funil");
    expect(nomes).toContain("crm_agente_executar");
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
});
