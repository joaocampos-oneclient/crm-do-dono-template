import { describe, expect, it } from "vitest";
import { estadoExemplo } from "../src/data/exemplo";
import { claudioAbreConversa, claudioResponde, extrairNota, lerSinais, sanitizarFalaDoRobo, type ContextoClaudio } from "../src/domain/claudio";
import { mencionaPreco } from "../src/domain/rules";

const estado = estadoExemplo("2026-10-22T12:00:00.000Z");
const ctx = (contatoId: string): ContextoClaudio => {
  const contato = estado.contatos.find((c) => c.id === contatoId)!;
  return {
    contato,
    oportunidade: estado.oportunidades.find((o) => o.contatoId === contatoId) ?? null,
    mensagens: estado.mensagens.filter((m) => m.contatoId === contatoId),
    produto: estado.produtos[0],
    funil: estado.funis.find((f) => f.id === contato.origem) ?? null,
    nomeOperador: "Otávio",
    nomeEmpresa: "IA para Donos",
  };
};

describe("extrair nota", () => {
  it("lê números e por extenso", () => {
    expect(extrairNota("Acho que 7.")).toBe(7);
    expect(extrairNota("10, quero começar")).toBe(10);
    expect(extrairNota("nota nove")).toBe(9);
  });
  it("não confunde horas, dinheiro e quantidades com nota", () => {
    expect(extrairNota("Tenho 5 funcionários")).toBe(null);
    expect(extrairNota("Fatura 3 mil")).toBe(null);
    expect(extrairNota("Talvez")).toBe(null);
  });
});

describe("Cláudio decide pelo playbook", () => {
  it("sem nota, faz a Pergunta Matadora", () => {
    const d = claudioResponde(ctx("c6"), "Oi, pode sim");
    expect(d.acao).toBe("perguntar");
    expect(d.resposta).toMatch(/0 a 10/);
  });
  it("nota baixa nutre, nota média convida, nota alta passa ao humano", () => {
    expect(claudioResponde(ctx("c6"), "Uns 3").acao).toBe("nutrir");
    expect(claudioResponde(ctx("c6"), "Nota 8").acao).toBe("convidar");
    expect(claudioResponde(ctx("c6"), "9").acao).toBe("handoff");
  });
  it("pergunta de preço vira handoff e o robô não fala valor", () => {
    const d = claudioResponde(ctx("c6"), "Quanto custa?");
    expect(d.acao).toBe("handoff");
    expect(mencionaPreco(d.resposta ?? "")).toBe(false);
    expect(d.sinais.pediuPreco).toBe(true);
  });
  it("pedir humano vira handoff", () => {
    expect(claudioResponde(ctx("c6"), "Queria falar com uma pessoa").acao).toBe("handoff");
  });
  it("pedir para parar encerra", () => {
    const d = claudioResponde(ctx("c6"), "Não quero mais contato, para de mandar");
    expect(d.acao).toBe("encerrar");
  });
  it("abre a conversa com nome e origem", () => {
    expect(claudioAbreConversa(ctx("c6"))).toMatch(/Fábio/);
    expect(claudioAbreConversa(ctx("c6"))).toMatch(/perpétuo/i);
  });
  it("sanitiza qualquer fala com preço", () => {
    expect(sanitizarFalaDoRobo("Custa R$ 1.997").ok).toBe(false);
    expect(sanitizarFalaDoRobo("Oi!").ok).toBe(true);
  });
  it("lê sinais objetivos", () => {
    expect(lerSinais("quero fechar hoje").quisEntrar).toBe(true);
    expect(lerSinais("me liga").pediuHumano).toBe(true);
  });
});
