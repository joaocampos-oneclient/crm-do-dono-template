import type { CardFunil, Hoje, TaxasFunil } from "@/lib/crm/queries";
import type { EtapaInfo } from "@/lib/crm/domain";
import type { FeedItem, HojeKpi, MeetItem } from "./hoje";
import type { Approval } from "./crm-ui";

const ETAPAS: EtapaInfo[] = [
  { id: "e0", slug: "novo", ordem: 0, nome: "Novo", dono: "sistema", validacao: "", prazo_parado_min: 1440, meta_taxa: 0.25, automatica: false, motivos_perda: [] },
  { id: "e1", slug: "claudio", ordem: 1, nome: "Cláudio", dono: "claudio", validacao: "", prazo_parado_min: 1440, meta_taxa: 0.36, automatica: false, motivos_perda: [] },
  { id: "e2", slug: "handoff", ordem: 2, nome: "Handoff", dono: "otavio", validacao: "", prazo_parado_min: 180, meta_taxa: 0.47, automatica: false, motivos_perda: [] },
  { id: "e3", slug: "briefing", ordem: 3, nome: "Briefing", dono: "otavio", validacao: "", prazo_parado_min: 2880, meta_taxa: 0.58, automatica: false, motivos_perda: [] },
  { id: "e4", slug: "proposta", ordem: 4, nome: "Proposta", dono: "otavio", validacao: "", prazo_parado_min: 2880, meta_taxa: 0.69, automatica: false, motivos_perda: [] },
  { id: "e5", slug: "oferta", ordem: 5, nome: "Oferta", dono: "otavio", validacao: "", prazo_parado_min: 2880, meta_taxa: 0.8, automatica: false, motivos_perda: [] },
  { id: "e6", slug: "pago", ordem: 6, nome: "Pago", dono: "sistema", validacao: "", prazo_parado_min: null, meta_taxa: null, automatica: true, motivos_perda: [] },
  { id: "e7", slug: "dentro", ordem: 7, nome: "Dentro", dono: "sistema", validacao: "", prazo_parado_min: null, meta_taxa: null, automatica: true, motivos_perda: [] },
];

export const MOCK_ETAPAS = ETAPAS;

export const MOCK_HOJE: Hoje = {
  tarefas: [
    { id: "t1", titulo: "Mandar o resumo da ligação para a Renata?", vence_em: null, contato: { id: "c-renata", nome: "Renata Moura" } },
    { id: "t2", titulo: "Mover Fábio para Oferta?", vence_em: null, contato: { id: "c-fabio", nome: "Fábio Nunes" } },
  ],
  paradas: [
    { id: "p1", contatoId: "c-bruno", contatoNome: "BRUNO CAVALCANTE NUNES", etapaNome: "Lead novo", etapaSlug: "novo", minutos: 2100 },
    { id: "p2", contatoId: "c-lia", contatoNome: "LIA MENDES", etapaNome: "Lead novo", etapaSlug: "novo", minutos: 1800 },
    { id: "p3", contatoId: "c-paulo", contatoNome: "Paulo Vieira", etapaNome: "Lead novo", etapaSlug: "novo", minutos: 1600 },
    { id: "p4", contatoId: "c-carla", contatoNome: "Carla Souza", etapaNome: "Cláudio", etapaSlug: "claudio", minutos: 200 },
  ],
  handoffsPendentes: [
    { id: "c-marcio", nome: "Márcio Teles", desde: "2026-10-25T12:00:00-03:00", slaAte: "2026-10-25T13:25:00-03:00" },
  ],
};

export const MOCK_HOJE_VAZIO: Hoje = { tarefas: [], paradas: [], handoffsPendentes: [] };

export const MOCK_KPIS: HojeKpi[] = [
  { label: "Vendas / outubro", value: "14", unit: " vendas", caption: "35% da meta útil", chart: [8, 9, 10, 11, 12, 13, 14] },
  { label: "Handoff / pagou", value: "17", unit: "%", caption: "+3 pts vs 20% · mediana 7 dias", chart: [14, 15, 16, 15, 17] },
  { label: "Resposta ao handoff", value: "1", unit: "h08", caption: "mediana 7 dias", chart: [90, 80, 70, 68] },
  { label: "Cobertura", value: "0,9", unit: "×", caption: "R$ 191.922 / 77.922 ao mês", isNew: true, chart: [0.6, 0.7, 0.8, 0.9] },
  { label: "Agentes hoje", value: "37", unit: " execuções", caption: "6,40 de 15", isNew: true, chart: [10, 18, 24, 37] },
  { label: "Próximo Meet", value: "48", unit: " min", caption: "Renata Moura · briefing pronto" },
];

export const MOCK_MEETS: MeetItem[] = [
  { hora: "10:00", nome: "Renata Moura", detalhe: "Studio Lumière · estética", status: "BRIEF PRONTO" },
  { hora: "14:30", nome: "Roberto Dias", detalhe: "Dias Agro · insumos", status: "PREPARANDO" },
  { hora: "16:00", nome: "Fábio Nunes", detalhe: "Nunes Contabilidade", status: "ÀS 15:45" },
];

export const MOCK_FEED: FeedItem[] = [
  { who: "scout", texto: "Scout está procurando sinais · Luciana Prado", tempo: "agora", live: true },
  { who: "echo", texto: "Echo prepara o brief do Meet das 14:30 · Roberto Dias", tempo: "agora", live: true },
  { who: "claudio", texto: "Cláudio respondeu em 2 min · Henrique Lopes", tempo: "6 min" },
  { who: "pilot", texto: "Pilot ofreceu o próximo passo · Camila Freitas", tempo: "14 min" },
  { who: "scribe", texto: "Scribe resumiu a ligação · Renata Moura", tempo: "1 h" },
];

export const MOCK_APPROVALS: Approval[] = [
  {
    kind: "handoff",
    author: "claudio",
    title: "Cláudio pediu handoff",
    lead: "Márcio Teles · Padaria Bom alimento · Anápolis",
    context: ["WhatsApp", "06:25"],
    preview: "quanto fica pra entrar? a live de quarta",
    source: "WhatsApp · 06:25",
    sla: "SLA 1h13",
  },
  {
    kind: "suggestion",
    author: "scribe",
    title: "Mandar o resumo da ligação para a Renata?",
    lead: "Renata Moura · Studio Lumière · estética",
    preview: "Renata, obrigado pelos 14 minutos de hoje. Como combinado: o agente de agendamento no WhatsApp até 15/11, e o João no forno de entrar. Te mando o link da proposta ainda hoje.",
    source: "ligação com o Cláudio · confiança 92%",
    confidence: 92,
  },
  {
    kind: "suggestion",
    author: "pilot",
    title: "Mover Fábio para Oferta?",
    lead: "Fábio Nunes · Nunes Contabilidade · Goiânia",
    stageChange: [3, 5],
    source: "abriu a proposta 3× · pediu o link do Pix · confiança 88%",
    confidence: 88,
  },
];

export const MOCK_CARDS: CardFunil[] = [
  { id: "o1", etapaId: "e0", etapaDesde: "2026-10-25T08:00:00-03:00", contatoId: "c1", contatoNome: "Leonardo Lacerda", empresa: "Lacerda", nota: 7, valorCentavos: 690000, proximaAcao: null, bateuNaTrave: false, dono: "claudio" },
  { id: "o2", etapaId: "e1", etapaDesde: "2026-10-24T10:00:00-03:00", contatoId: "c2", contatoNome: "Vitor Anselmo", empresa: null, nota: 8, valorCentavos: 690000, proximaAcao: "esperando resposta", bateuNaTrave: false, dono: "claudio" },
  { id: "o3", etapaId: "e2", etapaDesde: "2026-10-25T12:00:00-03:00", contatoId: "c-marcio", contatoNome: "Márcio Teles", empresa: "Padaria Bom alimento", nota: 9, valorCentavos: 690000, proximaAcao: "assumir", bateuNaTrave: false, dono: "otavio" },
];

export const MOCK_TAXAS: TaxasFunil = {
  janelaDias: 7,
  real: ETAPAS.map((e) => ({ etapaId: e.id, taxa: e.meta_taxa, entraram: e.meta_taxa ? 12 : 0, avancaram: 4 })),
  baseline: ETAPAS.map((e) => ({ etapaId: e.id, taxa: e.meta_taxa, entraram: 30, avancaram: 10 })),
};

function contato(
  id: string,
  nome: string,
  empresa: string,
  whatsapp: string,
  email: string,
  origem: string,
  tipo: "lead" | "cliente",
) {
  return {
    id,
    nome,
    empresa,
    whatsapp,
    email,
    origem,
    dono: "otavio" as const,
    tipo,
    categoria: tipo === "cliente" ? ("cliente" as const) : ("lead" as const),
    criadoEm: "2026-10-20T12:00:00-03:00",
  };
}

export const MOCK_LEADS = [
  contato("c-marcio", "Márcio Teles", "Padaria Bom alimento", "+55 62 9••••-4421", "m••••@padaria.com", "whatsapp", "lead"),
  contato("c-renata", "Renata Moura", "Studio Lumière", "+55 11 9••••-1002", "r••••@lumiere.com", "indicacao", "lead"),
  contato("c-fabio", "Fábio Nunes", "Nunes Contabilidade", "+55 62 9••••-8810", "f••••@nunes.cnt.br", "organica", "lead"),
];

export const MOCK_CLIENTES = [
  contato("cl-1", "Camila Freitas", "Freitas Lab", "+55 11 9••••-3300", "c••••@freitas.lab", "comunidade", "cliente"),
];

export const MOCK_DEMANDA = {
  total: 48,
  porOrigem: [
    { origem: "WhatsApp", total: 22 },
    { origem: "Orgânica", total: 14 },
    { origem: "Indicação", total: 12 },
  ],
  porDia: [3, 5, 4, 6, 8, 7, 5],
};

export const MOCK_SUBTITLE =
  "Enquanto você estava fora: Cláudio atendeu 23 e os agentes fizeram 37 execuções. 3 precisam de você.";
