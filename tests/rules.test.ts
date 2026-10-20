import { describe, expect, it } from "vitest";
import { CONTATOS } from "../src/data/demo";
import { acaoDaNota, categoria, contaReversa, deveFazerHandoff, estourouPrazo, podeRoboEnviar, proximoTermometro, taxaOuAviso } from "../src/domain/rules";

describe("nota da pergunta matadora", () => {
  it("separa nutrir, convidar e passar ao humano", () => {
    expect(acaoDaNota(3)).toBe("nutrir");
    expect(acaoDaNota(7)).toBe("convidar");
    expect(acaoDaNota(9)).toBe("passar ao humano");
  });
  it("nunca inventa nota", () => {
    expect(acaoDaNota(null)).toBe("perguntar de novo");
    expect(acaoDaNota(11)).toBe("perguntar de novo");
  });
  it("pedir preço ou humano faz handoff mesmo com nota baixa", () => {
    expect(deveFazerHandoff({ nota: 2, pediuPreco: true })).toBe(true);
    expect(deveFazerHandoff({ nota: 2 })).toBe(false);
  });
});

describe("trava do robô", () => {
  it("nunca fala preço", () => expect(podeRoboEnviar("O valor é R$ 100", true, null).ok).toBe(false));
  it("exige aprovação humana", () => expect(podeRoboEnviar("Oi, tudo bem?", false, null).ok).toBe(false));
  it("respeita a janela de 48 horas", () => expect(podeRoboEnviar("Oi, tudo bem?", true, 10).ok).toBe(false));
  it("libera quando tudo está certo", () => expect(podeRoboEnviar("Oi, tudo bem?", true, 72).ok).toBe(true));
});

describe("calculados", () => {
  it("categoria vem das oportunidades", () => {
    expect(categoria(CONTATOS.find((c) => c.id === "c7")!)).toBe("cliente");
    expect(categoria(CONTATOS.find((c) => c.id === "c2")!)).toBe("prospect");
    expect(categoria(CONTATOS.find((c) => c.id === "c6")!)).toBe("lead");
  });
  it("prazo estourado", () => {
    expect(estourouPrazo(CONTATOS.find((c) => c.id === "c4")!.oportunidades[0])).toBe(true);
    expect(estourouPrazo(CONTATOS.find((c) => c.id === "c7")!.oportunidades[0])).toBe(false);
  });
  it("amostra pequena não vira porcentagem", () => {
    expect(taxaOuAviso(2, 3)).toContain("amostra pequena");
    expect(taxaOuAviso(5, 10)).toBe("50%");
  });
  it("termômetro dá a volta", () => {
    expect(proximoTermometro(null)).toBe("frio");
    expect(proximoTermometro("quente")).toBe(null);
  });
  it("conta reversa arredonda para cima", () => {
    expect(contaReversa(1, { leadParaConversa: 0.5, conversaParaHandoff: 0.5, handoffParaOferta: 0.5, ofertaParaVenda: 0.5 }).leads).toBe(16);
  });
});
