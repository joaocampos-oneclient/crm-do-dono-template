/**
 * Comandos: TODA mudança no CRM passa por aqui. `aplicar(estado, comando, ctx)` é uma função pura:
 * recebe o estado, devolve o estado novo (ou lança ErroDeRegra). Roda igual no navegador
 * (localStorage), no servidor (arquivo JSON / API / MCP) e nos testes.
 *
 * Para ligar um banco de verdade, cada comando vira uma transação com as mesmas escritas
 * (veja docs/banco-de-dados.md). As regras continuam aqui.
 */
import { claudioAbreConversa, claudioResponde, sanitizarFalaDoRobo } from "./claudio";
import { ETAPAS, etapaDe, indiceEtapa } from "./funil";
import { avisoAssumir, avisoDevolver, oportunidadePrincipal, primeiroNome, proximoTermometro, somarDias } from "./rules";
import type {
  Briefing, ChaveApi, Contato, Criativo, EstadoCRM, EtapaId, Funil, GastoMidia, Ligacao, Ocorrencia, Operador, Oportunidade, Produto, Template, Termometro,
} from "./types";

export class ErroDeRegra extends Error {
  constructor(msg: string) { super(msg); this.name = "ErroDeRegra"; }
}

export interface CtxComando {
  agora: string;
  novoId: () => string;
}

/** Resposta já redigida (ex.: por um LLM no servidor). As regras ainda validam antes de gravar. */
export interface RespostaRobo { texto: string; nota?: number | null; acao?: "perguntar" | "nutrir" | "convidar" | "handoff" | "encerrar" }

export type Comando =
  | { tipo: "criarLead"; nome: string; telefone: string; origem: string; empresa?: string; segmento?: string; cidade?: string; email?: string; produtoId?: string; valor?: number; mensagemInicial?: string; abrirConversa?: boolean; por?: string }
  | { tipo: "salvarContato"; contato: Partial<Contato> & { id?: string; nome: string; telefone: string } }
  | { tipo: "receberMensagem"; contatoId: string; texto: string; respostaRobo?: RespostaRobo }
  | { tipo: "enviarMensagem"; contatoId: string; texto: string; operadorId: string }
  | { tipo: "assumirConversa"; contatoId: string; operadorId: string }
  | { tipo: "devolverConversa"; contatoId: string; operadorId: string }
  | { tipo: "moverEtapa"; oportunidadeId: string; para: EtapaId; por: string; motivo?: string; forcar?: boolean }
  | { tipo: "marcarPerdida"; oportunidadeId: string; motivo: string; por: string }
  | { tipo: "reabrir"; oportunidadeId: string; por: string }
  | { tipo: "salvarBriefing"; oportunidadeId: string; briefing: Briefing; por: string }
  | { tipo: "criarOportunidade"; contatoId: string; produtoId: string; valor?: number; por: string }
  | { tipo: "gerarProposta"; oportunidadeId: string; texto: string; por: string }
  | { tipo: "enviarProposta"; propostaId: string; canal: "whatsapp" | "email"; por: string }
  | { tipo: "registrarAberturaProposta"; propostaId: string }
  | { tipo: "criarLinkPagamento"; oportunidadeId: string; valor: number; metodo: "pix" | "cartao" | "boleto"; validadeDias: number; condicao: string; por: string }
  | { tipo: "confirmarPagamento"; pagamentoId: string }
  | { tipo: "falharPagamento"; pagamentoId: string }
  | { tipo: "registrarPrimeiroAcesso"; oportunidadeId: string }
  | { tipo: "adicionarNota"; contatoId: string; texto: string; autorId: string | null }
  | { tipo: "criarTarefa"; contatoId: string; texto: string; venceEm: string | null; origem: string }
  | { tipo: "concluirTarefa"; tarefaId: string; feita?: boolean }
  | { tipo: "registrarLigacao"; ligacao: Omit<Ligacao, "id">; criarTarefasDosFollowups?: boolean }
  | { tipo: "alternarTermometro"; contatoId: string }
  | { tipo: "definirTermometro"; contatoId: string; termometro: Termometro | null }
  | { tipo: "registrarOcorrencia"; contatoId: string; tipoOcorrencia: Ocorrencia["tipo"]; descricao: string; trechos: Ocorrencia["trechos"]; abertaPor: string | null }
  | { tipo: "atualizarOcorrencia"; ocorrenciaId: string; status?: Ocorrencia["status"]; resposta?: string }
  | { tipo: "enviarEmail"; contatoId: string; assunto: string; texto: string; por: string | null }
  | { tipo: "salvarProduto"; produto: Partial<Produto> & { nome: string; valor: number } }
  | { tipo: "removerProduto"; produtoId: string }
  | { tipo: "salvarFunil"; funil: Partial<Funil> & { nome: string; canal: string; produto: string } }
  | { tipo: "salvarCriativo"; criativo: Partial<Criativo> & { funilId: string; nome: string } }
  | { tipo: "lancarGasto"; gasto: Omit<GastoMidia, "id"> & { id?: string } }
  | { tipo: "removerGasto"; gastoId: string }
  | { tipo: "salvarOperador"; operador: Partial<Operador> & { nome: string; papel: Operador["papel"] } }
  | { tipo: "removerOperador"; operadorId: string }
  | { tipo: "salvarTemplate"; template: Partial<Template> & { nome: string; canal: Template["canal"]; texto: string } }
  | { tipo: "removerTemplate"; templateId: string }
  | { tipo: "criarChaveApi"; nome: string; escopo: ChaveApi["escopo"]; operadorId: string | null; chave?: string }
  | { tipo: "revogarChaveApi"; chaveId: string }
  | { tipo: "salvarConfig"; config: Partial<EstadoCRM["config"]> }
  | { tipo: "substituirEstado"; estado: EstadoCRM };

export type TipoComando = Comando["tipo"];

/** Comandos que só leem? Nenhum. Mas estes podem ser executados por chave de escopo "leitura" porque vêm do próprio contato/sistema. */
export const COMANDOS_DE_SISTEMA: TipoComando[] = ["receberMensagem", "registrarAberturaProposta", "confirmarPagamento", "falharPagamento", "registrarPrimeiroAcesso", "criarLead"];

const achar = <T extends { id: string }>(lista: T[], id: string, nome: string): T => {
  const x = lista.find((i) => i.id === id);
  if (!x) throw new ErroDeRegra(`${nome} não encontrado: ${id}`);
  return x;
};
const trocar = <T extends { id: string }>(lista: T[], item: T) => lista.map((i) => (i.id === item.id ? item : i));
const normalizarTelefone = (t: string) => t.replace(/\D/g, "");

const gerarChave = (escopo: ChaveApi["escopo"], novoId: () => string) => `crm_${escopo}_${novoId().replace(/-/g, "").slice(0, 24)}`;

export const nomeDoOperador = (estado: EstadoCRM, id: string | null | undefined) =>
  (id && estado.operadores.find((o) => o.id === id)?.nome) || (id === "robo" ? estado.config.nomeRobo : id === "sistema" ? "sistema" : "o time comercial");

function primeiroVendedorAtivo(estado: EstadoCRM) {
  return estado.operadores.find((o) => o.tipo === "humano" && o.ativo && o.papel === "vendedor") ?? estado.operadores.find((o) => o.tipo === "humano" && o.ativo) ?? null;
}

function mover(estado: EstadoCRM, o: Oportunidade, para: EtapaId, por: string, ctx: CtxComando, motivo: string | null = null, forcar = false): EstadoCRM {
  if (o.etapa === para && !o.perdida) return estado;
  const alvo = etapaDe(para);
  if (!alvo) throw new ErroDeRegra(`Etapa inválida: ${para}`);
  const ehSistema = por === "sistema";
  if (!forcar && alvo.auto && !ehSistema) throw new ErroDeRegra(`"${alvo.nome}" é movida pelo sistema (pagamento, abertura, acesso), não por você. Se precisar, informe o motivo e force.`);
  if (!forcar && para === "briefing" && !o.briefing) throw new ErroDeRegra("Para avançar: preencha dor, meta e data no briefing.");
  if (!forcar && !ehSistema && por !== "robo" && indiceEtapa(para) > indiceEtapa(o.etapa) + 1 && !motivo) throw new ErroDeRegra("Pular etapa exige um motivo.");
  if (!forcar && indiceEtapa(para) < indiceEtapa(o.etapa) && !motivo) throw new ErroDeRegra("Voltar etapa exige um motivo.");
  const novo: Oportunidade = { ...o, etapa: para, entrouNaEtapaEm: ctx.agora, perdida: false, motivoPerda: null, proximoPasso: etapaDe(para)?.objetivo ?? o.proximoPasso };
  return {
    ...estado,
    oportunidades: trocar(estado.oportunidades, novo),
    movimentos: [...estado.movimentos, { id: ctx.novoId(), oportunidadeId: o.id, de: o.perdida ? "perdido" : o.etapa, para, por, em: ctx.agora, motivo }],
  };
}

function mensagem(estado: EstadoCRM, m: Omit<EstadoCRM["mensagens"][number], "id">, ctx: CtxComando): EstadoCRM {
  return { ...estado, mensagens: [...estado.mensagens, { id: ctx.novoId(), ...m }] };
}

export function aplicar(estado: EstadoCRM, cmd: Comando, ctx: CtxComando): EstadoCRM {
  switch (cmd.tipo) {
    case "criarLead": {
      const tel = normalizarTelefone(cmd.telefone);
      if (!cmd.nome.trim()) throw new ErroDeRegra("Lead precisa de nome.");
      if (tel.length < 8) throw new ErroDeRegra("Telefone inválido.");
      const funil = estado.funis.find((f) => f.id === cmd.origem) ?? estado.funis[0];
      if (!funil) throw new ErroDeRegra("Cadastre um funil de entrada antes.");
      const produtoId = cmd.produtoId ?? funil.produto;
      const produto = estado.produtos.find((p) => p.id === produtoId) ?? estado.produtos[0];
      if (!produto) throw new ErroDeRegra("Cadastre um produto antes.");
      const existente = estado.contatos.find((c) => normalizarTelefone(c.telefone) === tel);
      let s = estado;
      let contato: Contato;
      if (existente) {
        contato = existente;
      } else {
        contato = {
          id: ctx.novoId(), nome: cmd.nome.trim(), empresa: cmd.empresa ?? "", segmento: cmd.segmento ?? "", cidade: cmd.cidade ?? "", telefone: cmd.telefone, email: cmd.email ?? "",
          origem: funil.id, nota: null, dono: "robo", operadorId: null, handoffPendente: false, handoffDesde: null, termometro: null, criadoEm: ctx.agora,
        };
        s = { ...s, contatos: [...s.contatos, contato] };
      }
      const temViva = s.oportunidades.some((o) => o.contatoId === contato.id && !o.perdida && o.produtoId === produto.id);
      if (!temViva) {
        const o: Oportunidade = { id: ctx.novoId(), contatoId: contato.id, produtoId: produto.id, valor: cmd.valor ?? produto.valor, etapa: "novo", entrouNaEtapaEm: ctx.agora, proximoPasso: "Cláudio abre a conversa", briefing: null, perdida: false, motivoPerda: null, criadaEm: ctx.agora };
        s = { ...s, oportunidades: [...s.oportunidades, o], movimentos: [...s.movimentos, { id: ctx.novoId(), oportunidadeId: o.id, de: null, para: "novo", por: cmd.por ?? "sistema", em: ctx.agora, motivo: existente ? "nova oportunidade para contato existente" : null }] };
      }
      if (cmd.mensagemInicial) s = mensagem(s, { contatoId: contato.id, autor: "contato", texto: cmd.mensagemInicial, em: ctx.agora }, ctx);
      if (cmd.abrirConversa !== false && contato.dono === "robo") {
        const texto = claudioAbreConversa({ contato, funil, produto, nomeEmpresa: s.config.nomeEmpresa });
        s = mensagem(s, { contatoId: contato.id, autor: "robo", texto, em: ctx.agora }, ctx);
      }
      return s;
    }

    case "salvarContato": {
      const c = cmd.contato;
      if (!c.nome.trim()) throw new ErroDeRegra("Contato precisa de nome.");
      const tel = normalizarTelefone(c.telefone);
      const duplicado = estado.contatos.find((x) => normalizarTelefone(x.telefone) === tel && x.id !== c.id);
      if (duplicado) throw new ErroDeRegra(`Já existe contato com este telefone: ${duplicado.nome}.`);
      if (c.id) {
        const atual = achar(estado.contatos, c.id, "Contato");
        return { ...estado, contatos: trocar(estado.contatos, { ...atual, ...c, id: atual.id }) };
      }
      const novo: Contato = {
        id: ctx.novoId(), nome: c.nome, empresa: c.empresa ?? "", segmento: c.segmento ?? "", cidade: c.cidade ?? "", telefone: c.telefone, email: c.email ?? "",
        origem: c.origem ?? estado.funis[0]?.id ?? "", nota: c.nota ?? null, dono: c.dono ?? "robo", operadorId: c.operadorId ?? null, handoffPendente: false, handoffDesde: null, termometro: c.termometro ?? null, criadoEm: ctx.agora,
      };
      return { ...estado, contatos: [...estado.contatos, novo] };
    }

    case "receberMensagem": {
      const contato = achar(estado.contatos, cmd.contatoId, "Contato");
      let s = mensagem(estado, { contatoId: contato.id, autor: "contato", texto: cmd.texto, em: ctx.agora }, ctx);
      const ops = s.oportunidades.filter((o) => o.contatoId === contato.id);
      const o = oportunidadePrincipal(ops);
      if (o && o.etapa === "novo" && !o.perdida) s = mover(s, o, "conversa", "robo", ctx);
      if (contato.dono !== "robo") return s;

      const produto = s.produtos.find((p) => p.id === o?.produtoId) ?? null;
      const funil = s.funis.find((f) => f.id === contato.origem) ?? null;
      const vendedor = primeiroVendedorAtivo(s);
      const decisao = cmd.respostaRobo
        ? { acao: cmd.respostaRobo.acao ?? "perguntar", resposta: cmd.respostaRobo.texto, nota: cmd.respostaRobo.nota ?? contato.nota, motivo: "Resposta do modelo de linguagem." }
        : claudioResponde({ contato, oportunidade: o, mensagens: s.mensagens.filter((m) => m.contatoId === contato.id), produto, funil, nomeOperador: vendedor?.nome ?? "uma pessoa do time", nomeEmpresa: s.config.nomeEmpresa }, cmd.texto);

      let c: Contato = { ...contato, nota: decisao.nota ?? contato.nota };
      if (decisao.resposta) {
        const fala = sanitizarFalaDoRobo(decisao.resposta);
        s = mensagem(s, { contatoId: contato.id, autor: "robo", texto: fala.texto, em: ctx.agora }, ctx);
        if (!fala.ok) decisao.acao = "handoff";
      }
      if (decisao.acao === "handoff") {
        c = { ...c, handoffPendente: true, handoffDesde: ctx.agora };
        const oAtual = s.oportunidades.find((x) => x.id === o?.id);
        if (oAtual && !oAtual.perdida && indiceEtapa(oAtual.etapa) < indiceEtapa("handoff")) s = mover(s, oAtual, "handoff", "robo", ctx, decisao.motivo);
      }
      if (decisao.acao === "encerrar" && o) {
        const oAtual = s.oportunidades.find((x) => x.id === o.id);
        if (oAtual && !oAtual.perdida) s = { ...s, oportunidades: trocar(s.oportunidades, { ...oAtual, perdida: true, motivoPerda: "não quer mais contato" }), movimentos: [...s.movimentos, { id: ctx.novoId(), oportunidadeId: oAtual.id, de: oAtual.etapa, para: "perdido", por: "robo", em: ctx.agora, motivo: "pediu para parar" }] };
      }
      return { ...s, contatos: trocar(s.contatos, c) };
    }

    case "enviarMensagem": {
      const contato = achar(estado.contatos, cmd.contatoId, "Contato");
      if (!cmd.texto.trim()) throw new ErroDeRegra("Mensagem vazia.");
      let s = estado;
      if (contato.dono === "robo") s = aplicar(s, { tipo: "assumirConversa", contatoId: contato.id, operadorId: cmd.operadorId }, ctx);
      return mensagem(s, { contatoId: contato.id, autor: "humano", texto: cmd.texto, em: ctx.agora, operadorId: cmd.operadorId }, ctx);
    }

    case "assumirConversa": {
      const contato = achar(estado.contatos, cmd.contatoId, "Contato");
      const operador = estado.operadores.find((o) => o.id === cmd.operadorId);
      if (!operador || operador.tipo !== "humano") throw new ErroDeRegra("Só um operador humano assume a conversa.");
      let s = mensagem(estado, { contatoId: contato.id, autor: "humano", aviso: true, em: ctx.agora, operadorId: operador.id, texto: avisoAssumir(primeiroNome(contato.nome), operador.nome) }, ctx);
      s = { ...s, contatos: trocar(s.contatos, { ...contato, dono: "humano", operadorId: operador.id, handoffPendente: false, handoffDesde: null }) };
      const o = oportunidadePrincipal(s.oportunidades.filter((x) => x.contatoId === contato.id));
      if (o && !o.perdida && indiceEtapa(o.etapa) < indiceEtapa("handoff")) s = mover(s, o, "handoff", operador.id, ctx, "humano assumiu a conversa");
      return s;
    }

    case "devolverConversa": {
      const contato = achar(estado.contatos, cmd.contatoId, "Contato");
      let s = mensagem(estado, { contatoId: contato.id, autor: "robo", aviso: true, em: ctx.agora, texto: avisoDevolver(primeiroNome(contato.nome), `${estado.config.nomeRobo}, nosso assistente de IA`) }, ctx);
      s = { ...s, contatos: trocar(s.contatos, { ...contato, dono: "robo", handoffPendente: false, handoffDesde: null }) };
      return s;
    }

    case "moverEtapa": {
      const o = achar(estado.oportunidades, cmd.oportunidadeId, "Oportunidade");
      if (cmd.para === "perdido") throw new ErroDeRegra("Use marcarPerdida para perder uma oportunidade, com motivo.");
      return mover(estado, o, cmd.para, cmd.por, ctx, cmd.motivo ?? null, cmd.forcar);
    }

    case "marcarPerdida": {
      const o = achar(estado.oportunidades, cmd.oportunidadeId, "Oportunidade");
      if (!cmd.motivo.trim()) throw new ErroDeRegra("Perder exige motivo. É dele que sai o aprendizado.");
      return {
        ...estado,
        oportunidades: trocar(estado.oportunidades, { ...o, perdida: true, motivoPerda: cmd.motivo }),
        movimentos: [...estado.movimentos, { id: ctx.novoId(), oportunidadeId: o.id, de: o.etapa, para: "perdido", por: cmd.por, em: ctx.agora, motivo: cmd.motivo }],
      };
    }

    case "reabrir": {
      const o = achar(estado.oportunidades, cmd.oportunidadeId, "Oportunidade");
      if (!o.perdida) return estado;
      return mover(estado, { ...o, perdida: true }, o.etapa, cmd.por, ctx, "reaberta", true);
    }

    case "salvarBriefing": {
      const o = achar(estado.oportunidades, cmd.oportunidadeId, "Oportunidade");
      const b = cmd.briefing;
      if (!b.dor.trim() || !b.meta.trim() || !b.data.trim()) throw new ErroDeRegra("Briefing precisa de dor, meta e data.");
      let s: EstadoCRM = { ...estado, oportunidades: trocar(estado.oportunidades, { ...o, briefing: b }) };
      const atual = s.oportunidades.find((x) => x.id === o.id)!;
      if (indiceEtapa(atual.etapa) < indiceEtapa("briefing") && !atual.perdida) s = mover(s, atual, "briefing", cmd.por, ctx, "briefing preenchido", true);
      return s;
    }

    case "criarOportunidade": {
      achar(estado.contatos, cmd.contatoId, "Contato");
      const produto = achar(estado.produtos, cmd.produtoId, "Produto");
      const o: Oportunidade = { id: ctx.novoId(), contatoId: cmd.contatoId, produtoId: produto.id, valor: cmd.valor ?? produto.valor, etapa: "novo", entrouNaEtapaEm: ctx.agora, proximoPasso: "Qualificar para este produto", briefing: null, perdida: false, motivoPerda: null, criadaEm: ctx.agora };
      return { ...estado, oportunidades: [...estado.oportunidades, o], movimentos: [...estado.movimentos, { id: ctx.novoId(), oportunidadeId: o.id, de: null, para: "novo", por: cmd.por, em: ctx.agora, motivo: "nova oportunidade" }] };
    }

    case "gerarProposta": {
      const o = achar(estado.oportunidades, cmd.oportunidadeId, "Oportunidade");
      if (!o.briefing) throw new ErroDeRegra("Proposta sem briefing é proposta genérica. Preencha dor, meta e data antes.");
      if (!cmd.texto.trim()) throw new ErroDeRegra("Proposta vazia.");
      return { ...estado, propostas: [...estado.propostas, { id: ctx.novoId(), oportunidadeId: o.id, texto: cmd.texto, criadaEm: ctx.agora, enviadaEm: null, enviadaPor: null, abertaEm: null }] };
    }

    case "enviarProposta": {
      const p = achar(estado.propostas, cmd.propostaId, "Proposta");
      const o = achar(estado.oportunidades, p.oportunidadeId, "Oportunidade");
      const contato = achar(estado.contatos, o.contatoId, "Contato");
      let s: EstadoCRM = { ...estado, propostas: trocar(estado.propostas, { ...p, enviadaEm: ctx.agora, enviadaPor: cmd.canal }) };
      if (cmd.canal === "whatsapp") s = mensagem(s, { contatoId: contato.id, autor: "humano", texto: p.texto, em: ctx.agora, operadorId: cmd.por }, ctx);
      else s = { ...s, emails: [...s.emails, { id: ctx.novoId(), contatoId: contato.id, assunto: `Proposta · ${s.config.nomeEmpresa}`, texto: p.texto, em: ctx.agora, enviadoPor: cmd.por }] };
      return s;
    }

    case "registrarAberturaProposta": {
      const p = achar(estado.propostas, cmd.propostaId, "Proposta");
      if (p.abertaEm) return estado;
      let s: EstadoCRM = { ...estado, propostas: trocar(estado.propostas, { ...p, abertaEm: ctx.agora }) };
      const o = achar(s.oportunidades, p.oportunidadeId, "Oportunidade");
      if (!o.perdida && indiceEtapa(o.etapa) < indiceEtapa("proposta")) s = mover(s, o, "proposta", "sistema", ctx, "contato abriu a proposta");
      return s;
    }

    case "criarLinkPagamento": {
      const o = achar(estado.oportunidades, cmd.oportunidadeId, "Oportunidade");
      if (!cmd.condicao.trim()) throw new ErroDeRegra("Oferta exige uma condição verdadeira, com prazo.");
      if (cmd.validadeDias < 1 || cmd.validadeDias > 30) throw new ErroDeRegra("Validade entre 1 e 30 dias.");
      const contato = achar(estado.contatos, o.contatoId, "Contato");
      const id = ctx.novoId();
      const expira = somarDias(ctx.agora, cmd.validadeDias);
      let s: EstadoCRM = { ...estado, pagamentos: [...estado.pagamentos, { id, oportunidadeId: o.id, valor: cmd.valor, metodo: cmd.metodo, status: "pendente", linkUrl: `https://pagamento.exemplo/${id.slice(0, 8)}`, expiraEm: expira, criadoEm: ctx.agora, pagoEm: null }] };
      s = mensagem(s, { contatoId: contato.id, autor: "humano", operadorId: cmd.por, em: ctx.agora, texto: `${primeiroNome(contato.nome)}, segue o link para ${cmd.metodo === "pix" ? "Pix" : cmd.metodo === "cartao" ? "cartão" : "boleto"}: https://pagamento.exemplo/${id.slice(0, 8)} · Condição: ${cmd.condicao}, válida até ${new Date(expira).toLocaleDateString("pt-BR")}.` }, ctx);
      const oAtual = s.oportunidades.find((x) => x.id === o.id)!;
      if (!oAtual.perdida && indiceEtapa(oAtual.etapa) < indiceEtapa("oferta")) s = mover(s, { ...oAtual, valor: cmd.valor }, "oferta", cmd.por, ctx, cmd.condicao, true);
      else s = { ...s, oportunidades: trocar(s.oportunidades, { ...oAtual, valor: cmd.valor }) };
      return s;
    }

    case "confirmarPagamento": {
      const p = achar(estado.pagamentos, cmd.pagamentoId, "Pagamento");
      if (p.status === "pago") return estado;
      let s: EstadoCRM = { ...estado, pagamentos: trocar(estado.pagamentos, { ...p, status: "pago", pagoEm: ctx.agora }) };
      const o = achar(s.oportunidades, p.oportunidadeId, "Oportunidade");
      if (indiceEtapa(o.etapa) < indiceEtapa("pago") || o.perdida) s = mover(s, o, "pago", "sistema", ctx, `pagamento ${p.metodo} confirmado`);
      return s;
    }

    case "falharPagamento": {
      const p = achar(estado.pagamentos, cmd.pagamentoId, "Pagamento");
      return { ...estado, pagamentos: trocar(estado.pagamentos, { ...p, status: "falhou" }) };
    }

    case "registrarPrimeiroAcesso": {
      const o = achar(estado.oportunidades, cmd.oportunidadeId, "Oportunidade");
      if (o.etapa !== "pago") throw new ErroDeRegra("Só entra quem pagou.");
      return mover(estado, o, "dentro", "sistema", ctx, "primeiro acesso");
    }

    case "adicionarNota": {
      achar(estado.contatos, cmd.contatoId, "Contato");
      if (!cmd.texto.trim()) throw new ErroDeRegra("Nota vazia.");
      return { ...estado, notas: [...estado.notas, { id: ctx.novoId(), contatoId: cmd.contatoId, texto: cmd.texto, autorId: cmd.autorId, em: ctx.agora }] };
    }

    case "criarTarefa": {
      achar(estado.contatos, cmd.contatoId, "Contato");
      return { ...estado, tarefas: [...estado.tarefas, { id: ctx.novoId(), contatoId: cmd.contatoId, texto: cmd.texto, venceEm: cmd.venceEm, origem: cmd.origem, feita: false, criadaEm: ctx.agora }] };
    }

    case "concluirTarefa": {
      const t = achar(estado.tarefas, cmd.tarefaId, "Tarefa");
      return { ...estado, tarefas: trocar(estado.tarefas, { ...t, feita: cmd.feita ?? true }) };
    }

    case "registrarLigacao": {
      const l = cmd.ligacao;
      const contato = achar(estado.contatos, l.contatoId, "Contato");
      if (!l.avisoGravacaoDado && l.trechos.length) throw new ErroDeRegra("Sem aviso de gravação não há transcrição. Avise antes de gravar.");
      const id = ctx.novoId();
      let s: EstadoCRM = { ...estado, ligacoes: [...estado.ligacoes, { ...l, id }], contatos: trocar(estado.contatos, { ...contato, termometro: l.termometroVendedor }) };
      if (cmd.criarTarefasDosFollowups !== false) {
        for (const f of l.followups) {
          const venceEm = f.quando === "hoje" ? somarDias(ctx.agora, 0).slice(0, 10) + "T23:59:00.000Z" : f.quando === "amanhã" ? somarDias(ctx.agora, 1) : /^\d{4}-\d{2}-\d{2}/.test(f.quando) ? f.quando : null;
          s = { ...s, tarefas: [...s.tarefas, { id: ctx.novoId(), contatoId: contato.id, texto: f.texto, venceEm, origem: `ligação ${new Date(l.iniciouEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`, feita: false, criadaEm: ctx.agora }] };
        }
      }
      return s;
    }

    case "alternarTermometro": {
      const c = achar(estado.contatos, cmd.contatoId, "Contato");
      return { ...estado, contatos: trocar(estado.contatos, { ...c, termometro: proximoTermometro(c.termometro) }) };
    }

    case "definirTermometro": {
      const c = achar(estado.contatos, cmd.contatoId, "Contato");
      return { ...estado, contatos: trocar(estado.contatos, { ...c, termometro: cmd.termometro }) };
    }

    case "registrarOcorrencia": {
      achar(estado.contatos, cmd.contatoId, "Contato");
      if (!cmd.descricao.trim()) throw new ErroDeRegra("Descreva a ocorrência.");
      return { ...estado, ocorrencias: [...estado.ocorrencias, { id: ctx.novoId(), contatoId: cmd.contatoId, tipo: cmd.tipoOcorrencia, descricao: cmd.descricao, trechos: cmd.trechos, status: "aberta", abertaPor: cmd.abertaPor, em: ctx.agora, resposta: null }] };
    }

    case "atualizarOcorrencia": {
      const o = achar(estado.ocorrencias, cmd.ocorrenciaId, "Ocorrência");
      return { ...estado, ocorrencias: trocar(estado.ocorrencias, { ...o, status: cmd.status ?? o.status, resposta: cmd.resposta ?? o.resposta }) };
    }

    case "enviarEmail": {
      const c = achar(estado.contatos, cmd.contatoId, "Contato");
      if (!c.email) throw new ErroDeRegra("Contato sem e-mail cadastrado.");
      if (!cmd.assunto.trim() || !cmd.texto.trim()) throw new ErroDeRegra("E-mail precisa de assunto e texto.");
      return { ...estado, emails: [...estado.emails, { id: ctx.novoId(), contatoId: c.id, assunto: cmd.assunto, texto: cmd.texto, em: ctx.agora, enviadoPor: cmd.por }] };
    }

    case "salvarProduto": {
      const p = cmd.produto;
      if (!p.nome.trim()) throw new ErroDeRegra("Produto precisa de nome.");
      if (p.valor < 0) throw new ErroDeRegra("Valor inválido.");
      if (p.id) {
        const atual = achar(estado.produtos, p.id, "Produto");
        return { ...estado, produtos: trocar(estado.produtos, { ...atual, ...p, id: atual.id }) };
      }
      const novo: Produto = { id: ctx.novoId(), nome: p.nome, valor: p.valor, parcelas: p.parcelas ?? "", descricao: p.descricao ?? "", ativo: p.ativo ?? true, gatilhos: p.gatilhos ?? [], playbook: p.playbook ?? [] };
      return { ...estado, produtos: [...estado.produtos, novo] };
    }

    case "removerProduto": {
      if (estado.oportunidades.some((o) => o.produtoId === cmd.produtoId)) {
        const p = achar(estado.produtos, cmd.produtoId, "Produto");
        return { ...estado, produtos: trocar(estado.produtos, { ...p, ativo: false }) };
      }
      return { ...estado, produtos: estado.produtos.filter((p) => p.id !== cmd.produtoId) };
    }

    case "salvarFunil": {
      const f = cmd.funil;
      if (!f.nome.trim()) throw new ErroDeRegra("Funil precisa de nome.");
      achar(estado.produtos, f.produto, "Produto");
      if (f.id) {
        const atual = achar(estado.funis, f.id, "Funil");
        return { ...estado, funis: trocar(estado.funis, { ...atual, ...f, id: atual.id }) };
      }
      const id = f.nome.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || ctx.novoId();
      if (estado.funis.some((x) => x.id === id)) throw new ErroDeRegra("Já existe funil com esse nome.");
      return { ...estado, funis: [...estado.funis, { id, nome: f.nome, canal: f.canal, produto: f.produto, ativo: f.ativo ?? true }] };
    }

    case "salvarCriativo": {
      const c = cmd.criativo;
      achar(estado.funis, c.funilId, "Funil");
      if (c.id) {
        const atual = achar(estado.criativos, c.id, "Criativo");
        return { ...estado, criativos: trocar(estado.criativos, { ...atual, ...c, id: atual.id }) };
      }
      return { ...estado, criativos: [...estado.criativos, { id: ctx.novoId(), funilId: c.funilId, nome: c.nome, plataforma: c.plataforma ?? "Meta Ads", ativo: c.ativo ?? true }] };
    }

    case "lancarGasto": {
      const g = cmd.gasto;
      achar(estado.funis, g.funilId, "Funil");
      if (g.valor < 0 || g.visitas < 0) throw new ErroDeRegra("Gasto e visitas não podem ser negativos.");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(g.data)) throw new ErroDeRegra("Data do gasto no formato AAAA-MM-DD.");
      if (g.id) {
        const atual = achar(estado.gastos, g.id, "Gasto");
        return { ...estado, gastos: trocar(estado.gastos, { ...atual, ...g, id: atual.id }) };
      }
      return { ...estado, gastos: [...estado.gastos, { id: ctx.novoId(), funilId: g.funilId, criativoId: g.criativoId ?? null, data: g.data, valor: g.valor, visitas: g.visitas }] };
    }

    case "removerGasto":
      return { ...estado, gastos: estado.gastos.filter((g) => g.id !== cmd.gastoId) };

    case "salvarOperador": {
      const o = cmd.operador;
      if (!o.nome.trim()) throw new ErroDeRegra("Operador precisa de nome.");
      if (o.id) {
        const atual = achar(estado.operadores, o.id, "Operador");
        if (atual.id === estado.config.roboOperadorId && o.tipo === "humano") throw new ErroDeRegra("O robô continua IA.");
        return { ...estado, operadores: trocar(estado.operadores, { ...atual, ...o, id: atual.id }) };
      }
      return { ...estado, operadores: [...estado.operadores, { id: ctx.novoId(), nome: o.nome, papel: o.papel, tipo: o.tipo ?? "humano", email: o.email, ativo: o.ativo ?? true }] };
    }

    case "removerOperador": {
      const o = achar(estado.operadores, cmd.operadorId, "Operador");
      if (o.id === estado.config.roboOperadorId) throw new ErroDeRegra("O robô não pode ser removido; desative-o.");
      const donos = estado.operadores.filter((x) => x.papel === "dono" && x.ativo && x.id !== o.id);
      if (o.papel === "dono" && donos.length === 0) throw new ErroDeRegra("Precisa existir pelo menos um dono.");
      return { ...estado, operadores: trocar(estado.operadores, { ...o, ativo: false }), contatos: estado.contatos.map((c) => (c.operadorId === o.id ? { ...c, operadorId: null } : c)) };
    }

    case "salvarTemplate": {
      const t = cmd.template;
      if (!t.nome.trim() || !t.texto.trim()) throw new ErroDeRegra("Template precisa de nome e texto.");
      if (t.id) {
        const atual = achar(estado.templates, t.id, "Template");
        return { ...estado, templates: trocar(estado.templates, { ...atual, ...t, id: atual.id }) };
      }
      return { ...estado, templates: [...estado.templates, { id: ctx.novoId(), nome: t.nome, canal: t.canal, assunto: t.assunto ?? null, texto: t.texto }] };
    }

    case "removerTemplate":
      return { ...estado, templates: estado.templates.filter((t) => t.id !== cmd.templateId) };

    case "criarChaveApi": {
      if (!cmd.nome.trim()) throw new ErroDeRegra("Dê um nome à chave (ex.: 'Grokbot leitura').");
      return { ...estado, chaves: [...estado.chaves, { id: ctx.novoId(), nome: cmd.nome, chave: cmd.chave ?? gerarChave(cmd.escopo, ctx.novoId), escopo: cmd.escopo, operadorId: cmd.operadorId, criadaEm: ctx.agora, revogadaEm: null }] };
    }

    case "revogarChaveApi": {
      const k = achar(estado.chaves, cmd.chaveId, "Chave");
      return { ...estado, chaves: trocar(estado.chaves, { ...k, revogadaEm: ctx.agora }) };
    }

    case "salvarConfig":
      return { ...estado, config: { ...estado.config, ...cmd.config } };

    case "substituirEstado":
      return cmd.estado;
  }
}

/** Etapas para as quais um humano pode arrastar um card (as automáticas não). */
export const etapasArrastaveis = () => ETAPAS.filter((e) => !e.auto).map((e) => e.id);
