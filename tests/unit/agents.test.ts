import { describe, expect, it } from "vitest";
import { executarAgente } from "@/lib/agents";
import { decidirLocal } from "@/lib/agents/decision-engine";

describe("agentes", () => {
  it("Cláudio bloqueia preço", async () => {
    const r = await executarAgente("claudio", { contexto: { rascunho: "O preço é R$ 297" } });
    expect(r.saida.payload.bloqueado).toBe(true);
  });

  it("Cláudio deixa mensagem sem preço", async () => {
    const r = await executarAgente("claudio", { contexto: { rascunho: "Oi! Posso te ajudar?" } });
    expect(r.saida.payload.bloqueado).toBeUndefined();
    expect(r.saida.payload.texto).toMatch(/Oi/);
  });

  it("Scout faz handoff com nota 9", async () => {
    const r = await executarAgente("scout", {
      contexto: { textoConversas: "quero", minutosSilencio: 5, nota: 9 },
    });
    expect(r.saida.payload.acao).toBe("handoff");
  });

  it("Ledger nunca cobra e marca risco com 1 login", async () => {
    const r = await executarAgente("ledger", { contexto: { logins7d: 1, diasDesdePagamento: 3 } });
    expect(r.saida.payload.nuncaCobra).toBe(true);
    expect(r.saida.payload.risco).toBe(true);
  });

  it("Pilot respeita cooldown 48h", async () => {
    const r = await executarAgente("pilot", {
      contexto: { horasDesdeUltimaAutomatica: 10, diasParado: 1, textoFollowup: "Tudo bem?" },
    });
    expect(r.saida.payload.cooldown).toBe(true);
  });

  it("Eco monta briefing", async () => {
    const r = await executarAgente("eco", {
      contexto: { nome: "Ana", dor: "estoque", meta: "crescer", nota: 8 },
    });
    expect(String(r.saida.payload.briefing)).toMatch(/Ana/);
    expect(String(r.saida.payload.briefing)).toMatch(/estoque/);
  });
});

describe("decision-engine", () => {
  it("retoma após silêncio de 1–3 dias", () => {
    const d = decidirLocal({ textoConversas: "", minutosSilencio: 60 * 30, nota: null });
    expect(d.acao).toBe("retomar");
    expect(d.usadoJev).toBe(false);
  });
});
