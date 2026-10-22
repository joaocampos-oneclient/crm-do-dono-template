import { describe, expect, it } from "vitest";
import { estadoExemplo } from "../src/data/exemplo";
import { conversaoPorEtapa, intervalos, painelDemandas, relatorio, taxasReais, valorPorEtapa, variacao } from "../src/domain/metricas";

const AGORA = "2026-10-22T12:00:00.000Z";
const estado = estadoExemplo(AGORA);

describe("intervalos", () => {
  it("'hoje' começa à meia-noite e o anterior é ontem", () => {
    const { atual, anterior, dias } = intervalos("hoje", AGORA);
    expect(dias).toBe(1);
    expect(atual.inicio.slice(0, 10)).toBe("2026-10-22");
    expect(anterior.inicio.slice(0, 10)).toBe("2026-10-21");
  });
  it("'30d' cobre 30 dias", () => {
    const { atual } = intervalos("30d", AGORA);
    expect((Date.parse(atual.fim) - Date.parse(atual.inicio)) / 86400000).toBeGreaterThan(29);
  });
});

describe("demandas", () => {
  it("conta leads, vendas, gasto, CPL e CPV por período", () => {
    const p = painelDemandas(estado, "30d", AGORA);
    expect(p.atual.leads).toBe(estado.contatos.length);
    expect(p.atual.vendas).toBeGreaterThanOrEqual(3);
    expect(p.atual.gasto).toBeGreaterThan(0);
    expect(p.atual.cpl).not.toBeNull();
    expect(p.atual.cpv).not.toBeNull();
  });
  it("quebra por funil de entrada e o total bate com a soma", () => {
    const p = painelDemandas(estado, "30d", AGORA);
    const somaLeads = p.porFunil.reduce((s, f) => s + f.atual.leads, 0);
    expect(somaLeads).toBe(p.atual.leads);
    expect(p.porFunil.map((f) => f.funil.id)).toEqual(["perpetuo", "live", "evento"]);
  });
  it("'hoje' pega só o que entrou hoje", () => {
    const p = painelDemandas(estado, "hoje", AGORA);
    expect(p.atual.leads).toBeLessThan(estado.contatos.length);
    expect(p.atual.leads).toBeGreaterThan(0);
  });
  it("variação é null quando o anterior é zero", () => {
    expect(variacao(5, 0)).toBeNull();
    expect(variacao(6, 4)).toBe(50);
  });
});

describe("funil e relatórios", () => {
  it("conversão por etapa decresce ao longo do funil", () => {
    const c = conversaoPorEtapa(estado);
    expect(c[0].base).toBeGreaterThanOrEqual(c[1].base);
    expect(c.every((x) => x.taxa === null || (x.taxa >= 0 && x.taxa <= 1))).toBe(true);
  });
  it("taxas reais ficam entre 0 e 1", () => {
    const t = taxasReais(estado);
    for (const v of Object.values(t)) expect(v >= 0 && v <= 1).toBe(true);
  });
  it("valor por etapa ignora perdidas", () => {
    const v = valorPorEtapa(estado);
    expect(v.get("oferta")!.n).toBe(1);
  });
  it("relatório tem receita do mês, ticket médio e projeção", () => {
    const r = relatorio(estado, AGORA);
    expect(r.vendasHoje).toBe(1);
    expect(r.receitaMes).toBeGreaterThan(0);
    expect(r.ticketMedio).toBeGreaterThan(0);
    expect(r.projecaoMes).toBeGreaterThanOrEqual(r.receitaMes);
    expect(r.ocorrenciasAbertas).toBe(1);
  });
});
