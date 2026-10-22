import { describe, expect, it } from "vitest";
import { estadoExemplo, IDS } from "../src/data/exemplo";
import { aplicar, ErroDeRegra, type Comando, type CtxComando } from "../src/domain/comandos";
import type { EstadoCRM } from "../src/domain/types";
import { montarContato } from "../src/domain/visao";

const AGORA = "2026-10-22T12:00:00.000Z";
let seq = 0;
const ctx = (agora = AGORA): CtxComando => ({ agora, novoId: () => `id-${++seq}` });
const base = () => estadoExemplo(AGORA);
const roda = (estado: EstadoCRM, ...cmds: Comando[]) => cmds.reduce((s, c) => aplicar(s, c, ctx()), estado);

describe("criarLead", () => {
  it("cria contato, oportunidade em 'novo', movimento e abertura do Cláudio", () => {
    const s = roda(base(), { tipo: "criarLead", nome: "Nova Pessoa", telefone: "(62) 98888-0000", origem: "perpetuo" });
    const c = s.contatos.find((x) => x.nome === "Nova Pessoa")!;
    const cc = montarContato(s, c.id)!;
    expect(cc.oportunidades[0].etapa).toBe("novo");
    expect(cc.movimentos[0].para).toBe("novo");
    expect(cc.mensagens[0].autor).toBe("robo");
    expect(cc.mensagens[0].texto).toMatch(/Nova/);
  });
  it("é idempotente por telefone: não duplica contato nem oportunidade viva", () => {
    const s1 = roda(base(), { tipo: "criarLead", nome: "Mariana de novo", telefone: "62900000001", origem: "live" });
    expect(s1.contatos.length).toBe(base().contatos.length);
    expect(s1.oportunidades.filter((o) => o.contatoId === "c1").length).toBe(1);
  });
  it("rejeita telefone inválido", () => {
    expect(() => roda(base(), { tipo: "criarLead", nome: "X", telefone: "12", origem: "perpetuo" })).toThrow(ErroDeRegra);
  });
});

describe("conversa com o Cláudio", () => {
  it("lead novo responde: vai para 'conversa' e recebe a Pergunta Matadora", () => {
    const s = roda(base(), { tipo: "receberMensagem", contatoId: "c6", texto: "Pode perguntar" });
    const c = montarContato(s, "c6")!;
    expect(c.oportunidades[0].etapa).toBe("conversa");
    expect(c.mensagens.at(-1)!.autor).toBe("robo");
    expect(c.mensagens.at(-1)!.texto).toMatch(/0 a 10/);
  });
  it("nota 9 vira handoff pendente e move o card", () => {
    const s = roda(base(), { tipo: "receberMensagem", contatoId: "c6", texto: "Pode" }, { tipo: "receberMensagem", contatoId: "c6", texto: "9" });
    const c = montarContato(s, "c6")!;
    expect(c.nota).toBe(9);
    expect(c.handoffPendente).toBe(true);
    expect(c.oportunidades[0].etapa).toBe("handoff");
  });
  it("quando o humano está no comando, o Cláudio fica calado", () => {
    const s = roda(base(), { tipo: "receberMensagem", contatoId: "c2", texto: "Oi Otávio, quanto custa?" });
    const c = montarContato(s, "c2")!;
    expect(c.mensagens.at(-1)!.autor).toBe("contato");
  });
  it("resposta vinda de LLM passa pela trava de preço", () => {
    const s = roda(base(), { tipo: "receberMensagem", contatoId: "c6", texto: "oi", respostaRobo: { texto: "Custa R$ 1.997 à vista!" } });
    const c = montarContato(s, "c6")!;
    expect(c.mensagens.at(-1)!.texto).not.toMatch(/R\$/);
    expect(c.handoffPendente).toBe(true);
  });
});

describe("assumir e devolver", () => {
  it("assumir avisa o contato, muda o dono e move para handoff", () => {
    const s = roda(base(), { tipo: "assumirConversa", contatoId: "c3", operadorId: IDS.otavio });
    const c = montarContato(s, "c3")!;
    expect(c.dono).toBe("humano");
    expect(c.operadorId).toBe(IDS.otavio);
    expect(c.mensagens.at(-1)!.aviso).toBe(true);
    expect(c.oportunidades[0].etapa).toBe("handoff");
  });
  it("só humano assume", () => {
    expect(() => roda(base(), { tipo: "assumirConversa", contatoId: "c3", operadorId: IDS.claudio })).toThrow(/humano/);
  });
  it("enviar mensagem com o robô no comando assume automaticamente", () => {
    const s = roda(base(), { tipo: "enviarMensagem", contatoId: "c1", texto: "Oi Mariana, sou o Otávio", operadorId: IDS.otavio });
    const c = montarContato(s, "c1")!;
    expect(c.dono).toBe("humano");
    expect(c.handoffPendente).toBe(false);
  });
  it("devolver volta para o robô com aviso", () => {
    const s = roda(base(), { tipo: "devolverConversa", contatoId: "c2", operadorId: IDS.otavio });
    expect(montarContato(s, "c2")!.dono).toBe("robo");
  });
});

describe("mover etapa", () => {
  const op = (s: EstadoCRM, contatoId: string) => s.oportunidades.find((o) => o.contatoId === contatoId)!;
  it("humano não move para etapa automática", () => {
    expect(() => roda(base(), { tipo: "moverEtapa", oportunidadeId: op(base(), "c4").id, para: "pago", por: IDS.otavio })).toThrow(/sistema/);
  });
  it("briefing exige dor, meta e data", () => {
    expect(() => roda(base(), { tipo: "moverEtapa", oportunidadeId: op(base(), "c1").id, para: "briefing", por: IDS.otavio })).toThrow(/briefing/);
    const s = roda(base(), { tipo: "salvarBriefing", oportunidadeId: op(base(), "c1").id, briefing: { dor: "x", meta: "y", data: "z" }, por: IDS.otavio });
    expect(op(s, "c1").etapa).toBe("briefing");
  });
  it("pular ou voltar etapa exige motivo e grava no histórico", () => {
    expect(() => roda(base(), { tipo: "moverEtapa", oportunidadeId: op(base(), "c3").id, para: "briefing", por: IDS.otavio })).toThrow();
    const s = roda(base(), { tipo: "moverEtapa", oportunidadeId: op(base(), "c4").id, para: "briefing", por: IDS.otavio, motivo: "proposta errada" });
    expect(s.movimentos.at(-1)!.motivo).toBe("proposta errada");
  });
  it("perder exige motivo", () => {
    expect(() => roda(base(), { tipo: "marcarPerdida", oportunidadeId: op(base(), "c3").id, motivo: " ", por: IDS.otavio })).toThrow();
    const s = roda(base(), { tipo: "marcarPerdida", oportunidadeId: op(base(), "c3").id, motivo: "sem orçamento", por: IDS.otavio });
    expect(op(s, "c3").perdida).toBe(true);
  });
});

describe("proposta, oferta e pagamento", () => {
  const op = (s: EstadoCRM, contatoId: string) => s.oportunidades.find((o) => o.contatoId === contatoId)!;
  it("proposta sem briefing é recusada", () => {
    expect(() => roda(base(), { tipo: "gerarProposta", oportunidadeId: op(base(), "c1").id, texto: "x", por: IDS.otavio })).toThrow(/briefing/);
  });
  it("gerar, enviar por WhatsApp e abrir move para 'proposta' pelo sistema", () => {
    let s = roda(base(), { tipo: "gerarProposta", oportunidadeId: op(base(), "c2").id, texto: "Proposta do Paulo", por: IDS.otavio });
    const p = s.propostas.at(-1)!;
    s = roda(s, { tipo: "enviarProposta", propostaId: p.id, canal: "whatsapp", por: IDS.otavio }, { tipo: "registrarAberturaProposta", propostaId: p.id });
    expect(op(s, "c2").etapa).toBe("proposta");
    expect(s.movimentos.at(-1)!.por).toBe("sistema");
    expect(montarContato(s, "c2")!.mensagens.some((m) => m.texto === "Proposta do Paulo")).toBe(true);
  });
  it("oferta exige condição; pagamento confirmado move para 'pago'", () => {
    expect(() => roda(base(), { tipo: "criarLinkPagamento", oportunidadeId: op(base(), "c4").id, valor: 1997, metodo: "pix", validadeDias: 3, condicao: "", por: IDS.otavio })).toThrow(/condição/);
    let s = roda(base(), { tipo: "criarLinkPagamento", oportunidadeId: op(base(), "c4").id, valor: 1997, metodo: "pix", validadeDias: 3, condicao: "bônus do evento", por: IDS.otavio });
    expect(op(s, "c4").etapa).toBe("oferta");
    const pg = s.pagamentos.at(-1)!;
    s = roda(s, { tipo: "confirmarPagamento", pagamentoId: pg.id });
    expect(op(s, "c4").etapa).toBe("pago");
    s = roda(s, { tipo: "registrarPrimeiroAcesso", oportunidadeId: op(s, "c4").id });
    expect(op(s, "c4").etapa).toBe("dentro");
  });
});

describe("ligação, notas, tarefas, ocorrências", () => {
  it("ligação sem aviso de gravação não aceita transcrição", () => {
    const l = { contatoId: "c1", operadorId: IDS.otavio, iniciouEm: AGORA, duracaoSeg: 60, resultado: "atendeu" as const, avisoGravacaoDado: false, trechos: [{ quem: "contato" as const, texto: "x", hora: "00:01", marca: null }], followups: [], resumo: "", termometroVendedor: "morno" as const, termometroIA: "morno" as const };
    expect(() => roda(base(), { tipo: "registrarLigacao", ligacao: l })).toThrow(/aviso/);
  });
  it("follow-ups da ligação viram tarefas e o termômetro do vendedor vale", () => {
    const l = { contatoId: "c1", operadorId: IDS.otavio, iniciouEm: AGORA, duracaoSeg: 60, resultado: "atendeu" as const, avisoGravacaoDado: true, trechos: [], followups: [{ texto: "Mandar proposta", quando: "amanhã", origem: "01:00" }], resumo: "ok", termometroVendedor: "quente" as const, termometroIA: "morno" as const };
    const s = roda(base(), { tipo: "registrarLigacao", ligacao: l });
    const c = montarContato(s, "c1")!;
    expect(c.tarefas.some((t) => t.texto === "Mandar proposta")).toBe(true);
    expect(c.termometro).toBe("quente");
  });
  it("ocorrência guarda trechos e começa aberta", () => {
    const s = roda(base(), { tipo: "registrarOcorrencia", contatoId: "c1", tipoOcorrencia: "problema", descricao: "Robô repetiu pergunta", trechos: [{ autor: "robo", texto: "x", em: AGORA }], abertaPor: IDS.otavio });
    expect(s.ocorrencias.at(-1)!.status).toBe("aberta");
  });
  it("e-mail exige contato com e-mail", () => {
    expect(() => roda(base(), { tipo: "enviarEmail", contatoId: "c3", assunto: "a", texto: "b", por: IDS.otavio })).toThrow(/e-mail/);
  });
});

describe("cadastros", () => {
  it("produto em uso não some, só desativa", () => {
    const s = roda(base(), { tipo: "removerProduto", produtoId: IDS.comunidade });
    expect(s.produtos.find((p) => p.id === IDS.comunidade)!.ativo).toBe(false);
  });
  it("chave de API é gerada com prefixo do escopo e pode ser revogada", () => {
    let s = roda(base(), { tipo: "criarChaveApi", nome: "Teste", escopo: "leitura", operadorId: null });
    const k = s.chaves.at(-1)!;
    expect(k.chave.startsWith("crm_leitura_")).toBe(true);
    s = roda(s, { tipo: "revogarChaveApi", chaveId: k.id });
    expect(s.chaves.at(-1)!.revogadaEm).toBe(AGORA);
  });
  it("sempre existe um dono", () => {
    expect(() => roda(base(), { tipo: "removerOperador", operadorId: IDS.dono })).toThrow(/dono/);
  });
  it("gasto de mídia exige data válida", () => {
    expect(() => roda(base(), { tipo: "lancarGasto", gasto: { funilId: "perpetuo", criativoId: null, data: "22/10", valor: 10, visitas: 0 } })).toThrow();
  });
});
