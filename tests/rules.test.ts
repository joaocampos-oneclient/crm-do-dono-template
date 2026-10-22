import { describe, expect, it } from "vitest";
import { estadoExemplo } from "../src/data/exemplo";
import { acaoDaNota, categoria, contaReversa, deveFazerHandoff, estourouPrazo, mencionaPreco, podeRoboEnviar, preencherTemplate, proximasAcoes, proximoTermometro, taxaOuAviso } from "../src/domain/rules";
import { montarContato } from "../src/domain/visao";

const AGORA = "2026-10-22T12:00:00.000Z";
const estado = estadoExemplo(AGORA);
const contato = (id: string) => montarContato(estado, id)!;

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
  it("detecta preço em várias formas", () => {
    expect(mencionaPreco("O valor é R$ 100")).toBe(true);
    expect(mencionaPreco("Tem desconto?")).toBe(true);
    expect(mencionaPreco("Oi, tudo bem?")).toBe(false);
  });
  it("nunca fala preço", () => expect(podeRoboEnviar("O valor é R$ 100", true, null).ok).toBe(false));
  it("exige aprovação humana", () => expect(podeRoboEnviar("Oi, tudo bem?", false, null).ok).toBe(false));
  it("respeita a janela de 48 horas", () => expect(podeRoboEnviar("Oi, tudo bem?", true, 10).ok).toBe(false));
  it("libera quando tudo está certo", () => expect(podeRoboEnviar("Oi, tudo bem?", true, 72).ok).toBe(true));
});

describe("calculados", () => {
  it("categoria vem das oportunidades", () => {
    expect(categoria(contato("c7").oportunidades)).toBe("cliente");
    expect(categoria(contato("c2").oportunidades)).toBe("prospect");
    expect(categoria(contato("c6").oportunidades)).toBe("lead");
    expect(categoria(contato("c11").oportunidades)).toBe("lead");
  });
  it("prazo estourado usa o relógio injetado", () => {
    expect(estourouPrazo(contato("c4").oportunidades[0], AGORA)).toBe(true);
    expect(estourouPrazo(contato("c7").oportunidades[0], AGORA)).toBe(false);
  });
  it("amostra pequena não vira porcentagem", () => {
    expect(taxaOuAviso(2, 3)).toContain("amostra pequena");
    expect(taxaOuAviso(5, 10)).toBe("50%");
  });
  it("termômetro dá a volta", () => {
    expect(proximoTermometro(null)).toBe("frio");
    expect(proximoTermometro("quente")).toBe(null);
  });
  it("conta reversa arredonda para cima e não divide por zero", () => {
    expect(contaReversa(1, { leadParaConversa: 0.5, conversaParaHandoff: 0.5, handoffParaOferta: 0.5, ofertaParaVenda: 0.5 }).leads).toBe(16);
    expect(Number.isFinite(contaReversa(1, { leadParaConversa: 0, conversaParaHandoff: 0, handoffParaOferta: 0, ofertaParaVenda: 0 }).leads)).toBe(true);
  });
  it("próximas ações: handoff pendente vem primeiro", () => {
    expect(proximasAcoes(contato("c1"), AGORA)[0].titulo).toBe("Assumir agora");
    expect(proximasAcoes(contato("c2"), AGORA).some((a) => a.titulo.includes("proposta"))).toBe(true);
  });
  it("templates preenchem variáveis e deixam as desconhecidas", () => {
    expect(preencherTemplate("Oi {nome}, {x}", { nome: "Ana" })).toBe("Oi Ana, {x}");
  });
});
