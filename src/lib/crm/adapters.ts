/**
 * Adapters EstadoCRM (template) → view-models do CRM v3 (produção).
 * Mantém a UI v3 alimentada pelo estado normalizado local / Supabase.
 */
import { ETAPAS } from "@/domain/funil";
import type { ContatoCompleto, EstadoCRM, EtapaId, Mensagem, Oportunidade } from "@/domain/types";
import { contatosCompletos } from "@/domain/visao";
import { estaParado, minutosNaEtapa, type EtapaInfo, type EtapaSlug, type TaxaEtapa } from "@/lib/crm/domain";
import type { ConversaDetalhe, ConversaResumo, MensagemView } from "@/lib/crm/conversas";
import type { CardFunil, ContatoLinha, Hoje, TaxasFunil } from "@/lib/crm/queries";
import type { Relatorio } from "@/lib/crm/relatorios";

/** Template usa `conversa`; produção/v3 usa `claudio`. */
export function slugV3(etapa: EtapaId): EtapaSlug {
  if (etapa === "conversa") return "claudio";
  if (etapa === "perdido") return "novo";
  return etapa as EtapaSlug;
}

export function etapasV3(): EtapaInfo[] {
  return ETAPAS.filter((e) => e.id !== "perdido").map((e, i) => ({
    id: e.id,
    slug: slugV3(e.id),
    ordem: i + 1,
    nome: e.nome,
    dono: e.dono === "robo" ? "claudio" : e.dono === "humano" ? "otavio" : "sistema",
    validacao: e.validacao,
    prazo_parado_min: e.prazoMin > 0 ? e.prazoMin : null,
    meta_taxa: e.meta / 100,
    automatica: e.auto,
    motivos_perda: e.motivosPerda,
  }));
}

function reaisParaCentavos(v: number): number {
  return Math.round(v * 100);
}

function oppViva(ops: Oportunidade[]): Oportunidade | undefined {
  return ops.find((o) => !o.perdida) ?? ops[0];
}

export function cardsFunilDe(estado: EstadoCRM, agoraIso: string): CardFunil[] {
  const agora = new Date(agoraIso);
  return estado.oportunidades
    .filter((o) => !o.perdida && o.etapa !== "perdido")
    .map((o) => {
      const c = estado.contatos.find((x) => x.id === o.contatoId);
      return {
        id: o.id,
        etapaId: o.etapa,
        etapaDesde: o.entrouNaEtapaEm,
        contatoId: o.contatoId,
        contatoNome: c?.nome ?? "Sem nome",
        empresa: c?.empresa || null,
        nota: c?.nota ?? null,
        valorCentavos: reaisParaCentavos(o.valor),
        proximaAcao: o.proximoPasso || null,
        bateuNaTrave: o.etapa === "oferta" && minutosNaEtapa(new Date(o.entrouNaEtapaEm), agora) > 2 * 24 * 60,
        dono: c?.dono === "humano" ? "otavio" : "claudio",
      } satisfies CardFunil;
    });
}

export function taxasFunilDe(estado: EstadoCRM, etapas: EtapaInfo[], janelaDias: number): TaxasFunil {
  const desde = Date.now() - janelaDias * 86_400_000;
  const real: TaxaEtapa[] = etapas.map((e, i) => {
    const prox = etapas[i + 1];
    const entraram = estado.movimentos.filter(
      (m) => m.para === e.id && Date.parse(m.em) >= desde,
    ).length;
    const sairam = prox
      ? estado.movimentos.filter((m) => m.de === e.id && m.para === prox.id && Date.parse(m.em) >= desde).length
      : 0;
    return {
      etapaId: e.id,
      entraram,
      avancaram: sairam,
      taxa: entraram === 0 ? null : sairam / entraram,
    };
  });
  const baseline: TaxaEtapa[] = etapas.map((e) => ({
    etapaId: e.id,
    entraram: 0,
    avancaram: 0,
    taxa: e.meta_taxa,
  }));
  return { janelaDias, real, baseline };
}

export function hojeDe(estado: EstadoCRM, agoraIso: string): Hoje {
  const agora = new Date(agoraIso);
  const etapas = etapasV3();
  const porId = new Map(etapas.map((e) => [e.id, e]));

  const tarefas = estado.tarefas
    .filter((t) => !t.feita)
    .map((t) => {
      const c = estado.contatos.find((x) => x.id === t.contatoId);
      return {
        id: t.id,
        titulo: t.texto,
        vence_em: t.venceEm,
        contato: c ? { id: c.id, nome: c.nome } : null,
      };
    })
    .sort((a, b) => (a.vence_em ?? "").localeCompare(b.vence_em ?? ""));

  const paradas = estado.oportunidades
    .filter((o) => !o.perdida)
    .map((o) => {
      const etapa = porId.get(o.etapa);
      if (!etapa || !estaParado(etapa, new Date(o.entrouNaEtapaEm), agora)) return null;
      const c = estado.contatos.find((x) => x.id === o.contatoId);
      return {
        id: o.id,
        contatoId: o.contatoId,
        contatoNome: c?.nome ?? "Sem nome",
        etapaNome: etapa.nome,
        etapaSlug: etapa.slug,
        minutos: minutosNaEtapa(new Date(o.entrouNaEtapaEm), agora),
      };
    })
    .filter((x): x is NonNullable<typeof x> => !!x);

  const handoffsPendentes = contatosCompletos(estado)
    .filter((c) => {
      const o = oppViva(c.oportunidades);
      return c.handoffPendente || (c.dono === "humano" && o?.etapa === "handoff");
    })
    .map((c) => ({
      id: c.id,
      nome: c.nome,
      desde: c.handoffDesde ?? oppViva(c.oportunidades)?.entrouNaEtapaEm ?? c.criadoEm,
      slaAte: null as string | null,
    }));

  return { tarefas, paradas, handoffsPendentes };
}

export function contatosLinhaDe(estado: EstadoCRM, tipo: "lead" | "cliente"): ContatoLinha[] {
  return contatosCompletos(estado)
    .filter((c) => (tipo === "cliente" ? c.categoria === "cliente" : c.categoria !== "cliente"))
    .map((c) => linhaDe(c));
}

function linhaDe(c: ContatoCompleto): ContatoLinha {
  return {
    id: c.id,
    nome: c.nome,
    empresa: c.empresa || null,
    whatsapp: c.telefone || null,
    email: c.email || null,
    origem: c.origem || null,
    dono: c.dono === "humano" ? "otavio" : "claudio",
    tipo: c.categoria === "cliente" ? "cliente" : "lead",
    categoria: c.categoria,
    criadoEm: c.criadoEm,
  };
}

function autorMsg(m: Mensagem): MensagemView["autor"] {
  if (m.autor === "contato") return "lead";
  if (m.autor === "robo") return "claudio";
  if (m.aviso) return "sistema";
  return "team";
}

export function conversasDe(estado: EstadoCRM): ConversaResumo[] {
  const porContato = new Map<string, Mensagem[]>();
  for (const m of estado.mensagens) {
    const arr = porContato.get(m.contatoId) ?? [];
    arr.push(m);
    porContato.set(m.contatoId, arr);
  }
  const lista: ConversaResumo[] = [];
  for (const [contatoId, msgs] of porContato) {
    const c = estado.contatos.find((x) => x.id === contatoId);
    if (!c) continue;
    const ordenadas = [...msgs].sort((a, b) => a.em.localeCompare(b.em));
    const ultima = ordenadas[ordenadas.length - 1];
    const op = c.operadorId ? estado.operadores.find((o) => o.id === c.operadorId) : null;
    lista.push({
      contatoId,
      nome: c.nome,
      empresa: c.empresa || null,
      ultimaTexto: ultima?.texto ?? "",
      ultimaEm: ultima?.em ?? c.criadoEm,
      ultimaAutor: ultima ? autorMsg(ultima) : "sistema",
      modo: c.dono === "humano" ? "humano" : "claudio",
      responsavelNome: op?.nome ?? null,
      handoff: c.handoffPendente
        ? { abertoEm: c.handoffDesde ?? c.criadoEm, nivel: "15min", slaAte: null }
        : null,
    });
  }
  return lista.sort((a, b) => b.ultimaEm.localeCompare(a.ultimaEm));
}

export function conversaDetalheDe(estado: EstadoCRM, contatoId: string): ConversaDetalhe | null {
  const c = estado.contatos.find((x) => x.id === contatoId);
  if (!c) return null;
  const msgs = estado.mensagens
    .filter((m) => m.contatoId === contatoId)
    .sort((a, b) => a.em.localeCompare(b.em));
  const op = c.operadorId ? estado.operadores.find((o) => o.id === c.operadorId) : null;
  return {
    contato: { id: c.id, nome: c.nome, empresa: c.empresa || null },
    modo: c.dono === "humano" ? "humano" : "claudio",
    desde: msgs[0]?.em ?? null,
    responsavel: op ? { id: op.id, nome: op.nome } : null,
    mensagens: msgs.map(
      (m): MensagemView => ({
        id: m.id,
        autor: autorMsg(m),
        direcao: m.autor === "contato" ? "in" : "out",
        texto: m.texto,
        midia: null,
        aviso: !!m.aviso,
        em: m.em,
        ocorrencias: [],
      }),
    ),
    handoff: c.handoffPendente
      ? {
          abertoEm: c.handoffDesde ?? c.criadoEm,
          nivel: "15min",
          slaAte: null,
          nota: c.nota,
          faixa: null,
          oQueFalta: null,
          motivo: null,
          humanoDestino: op?.nome ?? null,
          status: "aberto",
        }
      : null,
  };
}

export function relatorioDe(estado: EstadoCRM, agoraIso: string): Relatorio {
  const agora = new Date(agoraIso);
  const inicioDia = new Date(agora);
  inicioDia.setHours(0, 0, 0, 0);
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);

  const ganhas = estado.oportunidades.filter((o) => !o.perdida && (o.etapa === "pago" || o.etapa === "dentro"));
  const ganhasHoje = ganhas.filter((o) => Date.parse(o.entrouNaEtapaEm) >= inicioDia.getTime());
  const ganhasMes = ganhas.filter((o) => Date.parse(o.entrouNaEtapaEm) >= inicioMes.getTime());
  const leadsMes = estado.contatos.filter((c) => Date.parse(c.criadoEm) >= inicioMes.getTime()).length;

  const ofertasAbertas = estado.oportunidades.filter((o) => !o.perdida && o.etapa === "oferta").length;
  const conversas = estado.oportunidades.filter((o) => !o.perdida && ["conversa", "handoff", "briefing"].includes(o.etapa)).length;

  const etapas = etapasV3();
  const hojeVm = hojeDe(estado, agoraIso);
  const taxasCalc = taxasFunilDe(estado, etapas, 30);

  return {
    geradoEm: agoraIso,
    janelaDias: 30,
    hoje: { vendas: ganhasHoje.length, conversas, ofertas: ofertasAbertas },
    mes: { vendas: ganhasMes.length, conversas, ofertas: ofertasAbertas },
    metas: { vendas_dia: null, conversas_dia: null, ofertas_dia: null, max_dias_sem_fechar: null },
    diasSemFechar: ganhasMes.length === 0 ? 3 : 0,
    vendasDoMes: {
      n: ganhasMes.length,
      receitaCentavos: reaisParaCentavos(ganhasMes.reduce((s, o) => s + o.valor, 0)),
      maduras: ganhasMes.length,
      emGarantia: 0,
    },
    previsao: { fimDoMes: ganhasMes.length > 0 ? ganhasMes.length + 1 : null, receitaCentavos: null },
    taxas: etapas.slice(0, -1).map((e, i) => {
      const r = taxasCalc.real.find((t) => t.etapaId === e.id);
      return {
        etapaId: e.id,
        de: e.nome,
        para: etapas[i + 1]?.nome ?? "",
        real: r?.taxa ?? null,
        meta: e.meta_taxa,
        baseline: e.meta_taxa,
        n: r?.entraram ?? 0,
      };
    }),
    conta: { leadsPorDia: leadsMes > 0 ? leadsMes / Math.max(1, agora.getDate()) : null },
    parado: hojeVm.paradas.reduce<Relatorio["parado"]>((acc, p) => {
      const hit = acc.find((x) => x.etapaId === p.etapaSlug);
      if (hit) {
        hit.cards += 1;
        hit.minutos = Math.max(hit.minutos ?? 0, p.minutos);
      } else {
        acc.push({ etapaId: p.etapaSlug, nome: p.etapaNome, cards: 1, minutos: p.minutos });
      }
      return acc;
    }, []),
    perdas: [],
    vendasDiretasDoMes: 0,
    vendasNoFunilDoMes: ganhasMes.length,
    comissao: null,
  };
}
