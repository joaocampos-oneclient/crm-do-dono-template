import { describe, expect, it } from "vitest";
import { estadoExemplo } from "@/data/exemplo";
import {
  cardsFunilDe,
  conversasDe,
  etapasV3,
  hojeDe,
  relatorioDe,
  slugV3,
} from "@/lib/crm/adapters";

describe("adapters CRM v3", () => {
  const agora = new Date().toISOString();
  const estado = estadoExemplo();

  it("mapeia conversa → claudio", () => {
    expect(slugV3("conversa")).toBe("claudio");
    expect(slugV3("handoff")).toBe("handoff");
  });

  it("monta etapas e cards do funil", () => {
    const etapas = etapasV3();
    expect(etapas.some((e) => e.slug === "claudio")).toBe(true);
    const cards = cardsFunilDe(estado, agora);
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.every((c) => typeof c.valorCentavos === "number")).toBe(true);
  });

  it("monta Hoje e conversas a partir do estado", () => {
    const hoje = hojeDe(estado, agora);
    expect(Array.isArray(hoje.tarefas)).toBe(true);
    expect(Array.isArray(hoje.paradas)).toBe(true);
    const lista = conversasDe(estado);
    expect(lista.length).toBeGreaterThan(0);
    const rel = relatorioDe(estado, agora);
    expect(rel.mes.vendas).toBeGreaterThanOrEqual(0);
  });
});
