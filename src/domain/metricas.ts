/**
 * Métricas: Demandas (por período e por funil de entrada) e Relatórios. Funções puras sobre o EstadoCRM.
 * Tudo sai de movimentos, pagamentos e gastos. Nada é digitado à mão.
 */
import { ETAPAS, indiceEtapa } from "./funil";
import type { EstadoCRM, EtapaId, Funil, Periodo } from "./types";

export interface Intervalo { inicio: string; fim: string }

const inicioDoDia = (iso: string) => { const d = new Date(iso); d.setHours(0, 0, 0, 0); return d.toISOString(); };

/** Intervalo do período e o intervalo imediatamente anterior, do mesmo tamanho (para comparar). */
export function intervalos(periodo: Periodo, agora: string): { atual: Intervalo; anterior: Intervalo; dias: number } {
  const dias = periodo === "hoje" ? 1 : periodo === "7d" ? 7 : 30;
  const fim = agora;
  const inicio = new Date(Date.parse(inicioDoDia(agora)) - (dias - 1) * 86400000).toISOString();
  const fimAnt = new Date(Date.parse(inicio) - 1).toISOString();
  const inicioAnt = new Date(Date.parse(inicio) - dias * 86400000).toISOString();
  return { atual: { inicio, fim }, anterior: { inicio: inicioAnt, fim: fimAnt }, dias };
}

export const dentro = (iso: string, i: Intervalo) => Date.parse(iso) >= Date.parse(i.inicio) && Date.parse(iso) <= Date.parse(i.fim);
const diaDentro = (dia: string, i: Intervalo) => dia >= i.inicio.slice(0, 10) && dia <= i.fim.slice(0, 10);

export interface Demanda {
  leads: number;
  qualificados: number;
  ofertas: number;
  vendas: number;
  receita: number;
  gasto: number;
  visitas: number;
  /** Custo por lead e por venda. null quando não há como calcular. */
  cpl: number | null;
  cpv: number | null;
  visitaParaLead: number | null;
  leadParaVenda: number | null;
}

export function demanda(estado: EstadoCRM, i: Intervalo, funilId?: Funil["id"]): Demanda {
  const contatos = estado.contatos.filter((c) => (!funilId || c.origem === funilId));
  const ids = new Set(contatos.map((c) => c.id));
  const ops = estado.oportunidades.filter((o) => ids.has(o.contatoId));
  const opIds = new Set(ops.map((o) => o.id));
  const movs = estado.movimentos.filter((m) => opIds.has(m.oportunidadeId) && dentro(m.em, i));
  const unicos = (para: EtapaId) => new Set(movs.filter((m) => m.para === para).map((m) => m.oportunidadeId)).size;
  const leads = contatos.filter((c) => dentro(c.criadoEm, i)).length;
  const qualificados = unicos("handoff");
  const ofertas = unicos("oferta");
  const vendas = unicos("pago");
  const receita = estado.pagamentos.filter((p) => p.status === "pago" && p.pagoEm && dentro(p.pagoEm, i) && opIds.has(p.oportunidadeId)).reduce((s, p) => s + p.valor, 0);
  const gastos = estado.gastos.filter((g) => (!funilId || g.funilId === funilId) && diaDentro(g.data, i));
  const gasto = gastos.reduce((s, g) => s + g.valor, 0);
  const visitas = gastos.reduce((s, g) => s + g.visitas, 0);
  return {
    leads, qualificados, ofertas, vendas, receita, gasto, visitas,
    cpl: leads > 0 && gasto > 0 ? gasto / leads : null,
    cpv: vendas > 0 && gasto > 0 ? gasto / vendas : null,
    visitaParaLead: visitas > 0 ? leads / visitas : null,
    leadParaVenda: leads > 0 ? vendas / leads : null,
  };
}

export interface PainelDemandas {
  periodo: Periodo;
  atual: Demanda;
  anterior: Demanda;
  porFunil: { funil: Funil; atual: Demanda; anterior: Demanda }[];
}

export function painelDemandas(estado: EstadoCRM, periodo: Periodo, agora: string): PainelDemandas {
  const { atual, anterior } = intervalos(periodo, agora);
  return {
    periodo,
    atual: demanda(estado, atual),
    anterior: demanda(estado, anterior),
    porFunil: estado.funis.filter((f) => f.ativo).map((funil) => ({ funil, atual: demanda(estado, atual, funil.id), anterior: demanda(estado, anterior, funil.id) })),
  };
}

/** Variação percentual entre períodos. null quando o anterior é zero. */
export const variacao = (atual: number, anterior: number) => (anterior === 0 ? null : Math.round(((atual - anterior) / anterior) * 100));

/** Conversão entre etapas consecutivas: quantas oportunidades chegaram em cada etapa (por movimentos). */
export function conversaoPorEtapa(estado: EstadoCRM) {
  const chegou = (etapa: EtapaId) => new Set(estado.movimentos.filter((m) => indiceEtapa(m.para) >= indiceEtapa(etapa) && m.para !== "perdido").map((m) => m.oportunidadeId)).size;
  return ETAPAS.slice(0, -1).map((e, i) => {
    const prox = ETAPAS[i + 1];
    const base = chegou(e.id);
    const seguinte = chegou(prox.id);
    return { de: e, para: prox, base, seguinte, taxa: base ? seguinte / base : null };
  });
}

/** Taxas reais para a conta reversa. Quando não há amostra, usa 0 (a conta avisa). */
export function taxasReais(estado: EstadoCRM) {
  const c = conversaoPorEtapa(estado);
  const t = (de: EtapaId, ate: EtapaId) => {
    const base = c.find((x) => x.de.id === de)?.base ?? 0;
    const alvo = c.find((x) => x.para.id === ate)?.seguinte ?? 0;
    return base ? alvo / base : 0;
  };
  return { leadParaConversa: t("novo", "conversa"), conversaParaHandoff: t("conversa", "handoff"), handoffParaOferta: t("handoff", "oferta"), ofertaParaVenda: t("oferta", "pago") };
}

/** Valor em aberto por etapa: soma das oportunidades vivas paradas em cada coluna. */
export function valorPorEtapa(estado: EstadoCRM) {
  const mapa = new Map<EtapaId, { n: number; valor: number }>();
  for (const e of ETAPAS) mapa.set(e.id, { n: 0, valor: 0 });
  for (const o of estado.oportunidades) {
    if (o.perdida) continue;
    const m = mapa.get(o.etapa);
    if (m) { m.n += 1; m.valor += o.valor; }
  }
  return mapa;
}

export interface Relatorio {
  vendasHoje: number;
  vendasMes: number;
  receitaMes: number;
  ticketMedio: number | null;
  /** Projeção linear do mês: receita até agora / dias passados * dias do mês. */
  projecaoMes: number | null;
  receitaTotal: number;
  ocorrenciasAbertas: number;
  tarefasVencidas: number;
  leadsMes: number;
  conversouComClaudio: number;
  passouParaHumano: number;
  briefings: number;
  propostasAbertas: number;
  ofertas: number;
}

export function relatorio(estado: EstadoCRM, agora: string): Relatorio {
  const d = new Date(agora);
  const inicioMes = new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
  const mes: Intervalo = { inicio: inicioMes, fim: agora };
  const hoje: Intervalo = { inicio: inicioDoDia(agora), fim: agora };
  const pagosMes = estado.pagamentos.filter((p) => p.status === "pago" && p.pagoEm && dentro(p.pagoEm, mes));
  const receitaMes = pagosMes.reduce((s, p) => s + p.valor, 0);
  const diasPassados = d.getDate();
  const diasNoMes = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const unicosMes = (para: EtapaId) => new Set(estado.movimentos.filter((m) => m.para === para && dentro(m.em, mes)).map((m) => m.oportunidadeId)).size;
  const contatosMes = estado.contatos.filter((c) => dentro(c.criadoEm, mes));
  const idsMes = new Set(contatosMes.map((c) => c.id));
  return {
    vendasHoje: new Set(estado.movimentos.filter((m) => m.para === "pago" && dentro(m.em, hoje)).map((m) => m.oportunidadeId)).size,
    vendasMes: unicosMes("pago"),
    receitaMes,
    ticketMedio: pagosMes.length ? receitaMes / pagosMes.length : null,
    projecaoMes: receitaMes > 0 ? (receitaMes / diasPassados) * diasNoMes : null,
    receitaTotal: estado.pagamentos.filter((p) => p.status === "pago").reduce((s, p) => s + p.valor, 0),
    ocorrenciasAbertas: estado.ocorrencias.filter((o) => o.status !== "resolvida").length,
    tarefasVencidas: estado.tarefas.filter((t) => !t.feita && t.venceEm && Date.parse(t.venceEm) < Date.parse(agora)).length,
    leadsMes: contatosMes.length,
    conversouComClaudio: new Set(estado.mensagens.filter((m) => m.autor === "robo" && idsMes.has(m.contatoId)).map((m) => m.contatoId)).size,
    passouParaHumano: unicosMes("handoff"),
    briefings: unicosMes("briefing"),
    propostasAbertas: unicosMes("proposta"),
    ofertas: unicosMes("oferta"),
  };
}
