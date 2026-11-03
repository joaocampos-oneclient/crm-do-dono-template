/**
 * Domínio puro do CRM de vendas (sem banco, sem UI): regras do funil, taxas e formatação.
 * Fonte das regras: docs/2026-10-19-crm-vendas-prd.md (§2b, §4) e protótipo v2.
 */

export const ETAPA_SLUGS = [
  "novo",
  "claudio",
  "handoff",
  "briefing",
  "proposta",
  "oferta",
  "pago",
  "dentro",
] as const;
export type EtapaSlug = (typeof ETAPA_SLUGS)[number];

export type Categoria = "lead" | "prospect" | "cliente";

export interface EtapaInfo {
  id: string;
  slug: EtapaSlug;
  ordem: number;
  nome: string;
  dono: "claudio" | "otavio" | "sistema";
  validacao: string;
  prazo_parado_min: number | null;
  meta_taxa: number | null;
  automatica: boolean;
  motivos_perda: string[];
}

/** Rótulos dos motivos de perda (lista fechada, igual ao CHECK da migration 1). */
export const MOTIVOS_PERDA: Record<string, string> = {
  numero_invalido: "Número inválido",
  duplicado: "Duplicado",
  nao_respondeu: "Não respondeu (3 tentativas)",
  opt_out: "Pediu para sair",
  nao_e_dono: "Não é dono",
  quer_profissao_em_ia: "Quer profissão em IA",
  curioso_sem_negocio: "Curioso sem negócio",
  sem_caixa: "Sem caixa",
  sumiu: "Sumiu",
  sem_meta: "Sem meta",
  nao_abriu: "Não abriu a proposta",
  vou_pensar: "Vou pensar",
  preco: "Preço",
  sem_tempo: "Não vou ter tempo",
  socio: "Sócio",
  pix_expirou: "Pix expirou",
  cartao_recusado: "Cartão recusado",
  reembolso: "Reembolso",
  nao_engajou: "Não engajou / não respondeu",
};

/** Menos que isso e a tela avisa "amostra pequena" em vez de mostrar porcentagem. */
export const AMOSTRA_MINIMA = 10;
export const amostraPequena = (n: number): boolean => n < AMOSTRA_MINIMA;

/** Categoria calculada, ninguém edita (PRD §2b). */
export function categoriaContato(opps: { status: "aberta" | "ganha" | "perdida"; etapaSlug: EtapaSlug; etapaDesde: Date }[], agora = new Date()): Categoria {
  const GARANTIA_MS = 7 * 24 * 60 * 60 * 1000;
  const cliente = opps.some(
    (o) =>
      (o.status === "ganha" || o.etapaSlug === "dentro") &&
      agora.getTime() - o.etapaDesde.getTime() >= GARANTIA_MS,
  );
  if (cliente) return "cliente";
  if (opps.some((o) => o.status === "aberta")) return "prospect";
  return "lead";
}

export const minutosNaEtapa = (desde: Date, agora = new Date()): number =>
  Math.max(0, Math.floor((agora.getTime() - desde.getTime()) / 60_000));

/** Card "apita" quando passou do prazo parado da etapa. Etapa sem prazo nunca apita. */
export function estaParado(etapa: Pick<EtapaInfo, "prazo_parado_min">, desde: Date, agora = new Date()): boolean {
  if (etapa.prazo_parado_min == null) return false;
  return minutosNaEtapa(desde, agora) > etapa.prazo_parado_min;
}

/** 5 min, 2 h, 3 d. */
export function duracaoCurta(min: number): string {
  if (min < 60) return `${min} min`;
  if (min < 60 * 24) return `${Math.floor(min / 60)} h`;
  return `${Math.floor(min / (60 * 24))} d`;
}

export function formatarReais(centavos: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(centavos / 100);
}

/** Valor com desconto (até 20% conta para a meta dos parceiros). */
export function valorComDesconto(centavos: number, descontoPct: number): number {
  const d = Math.min(100, Math.max(0, descontoPct));
  return Math.round(centavos * (1 - d / 100));
}

export const DESCONTO_MAX_PARCEIROS_PCT = 20;

/** Máscara para quem não pode ver o número completo (papel tráfego): +55 11 *****-1234. */
export function mascararWhatsapp(w: string | null): string {
  if (!w) return "—";
  return `${w.slice(0, 4)} ${"*".repeat(Math.max(0, w.length - 8))}${w.slice(-4)}`;
}

// ---------------------------------------------------------------- validação de etapa

export interface DadosValidacao {
  nome: string | null;
  whatsapp: string | null;
  origem: string | null;
  nota_claudio: number | null;
  dor: string | null;
  meta: string | null;
  meta_ate: string | null;
}

const preenchido = (v: string | null | undefined) => !!v && v.trim().length > 0;

/** Etapas que humano move à mão no PR 2. As automáticas e as de oferta chegam com Propostas (PR 5). */
export const DESTINOS_MANUAIS: readonly EtapaSlug[] = ["claudio", "handoff", "briefing"];

export interface ResultadoMovimento {
  ok: boolean;
  /** O que falta para o card poder andar (mostrado ao operador). */
  faltando: string[];
  /** Motivo de bloqueio que não é falta de dado. */
  bloqueio?: string;
}

/**
 * "O card só anda quando a validação aconteceu" (PRD §4).
 * Só permite avançar uma etapa por vez, para a frente, entre as etapas manuais.
 * A validação checada é a da etapa de destino (a etapa é um estado alcançado).
 */
export function validarMovimento(
  de: Pick<EtapaInfo, "slug" | "ordem">,
  para: Pick<EtapaInfo, "slug" | "ordem">,
  d: DadosValidacao,
): ResultadoMovimento {
  if (para.ordem <= de.ordem) {
    return { ok: false, faltando: [], bloqueio: "O card só anda para a frente. Para encerrar, marque como perdido." };
  }
  if (para.ordem !== de.ordem + 1) {
    return { ok: false, faltando: [], bloqueio: "Avance uma etapa por vez." };
  }
  if (!DESTINOS_MANUAIS.includes(para.slug)) {
    return {
      ok: false,
      faltando: [],
      bloqueio: "Esta etapa se completa sozinha (proposta aberta, pagamento) quando o módulo de Propostas entrar.",
    };
  }
  const faltando: string[] = [];
  // A etapa é um estado alcançado ("Briefing feito"): vale a validação da etapa de DESTINO (PRD §4).
  if (para.slug === "claudio" || para.slug === "handoff") {
    // "Respondeu + nota 0-10 gravada". A prova de resposta do lead/Otávio chega com Conversas (PR 3).
    if (d.nota_claudio == null) faltando.push("nota que o lead se deu (0 a 10)");
  } else if (para.slug === "briefing") {
    if (!preenchido(d.dor)) faltando.push("o que dói hoje");
    if (!preenchido(d.meta)) faltando.push("meta");
    if (!preenchido(d.meta_ate)) faltando.push("data da meta");
  }
  return { ok: faltando.length === 0, faltando };
}

// ---------------------------------------------------------------- taxas por etapa

export interface Movimento {
  oportunidade_id: string;
  para_ordem: number | null;
  em: Date;
}

export interface TaxaEtapa {
  etapaId: string;
  /** Quantas oportunidades entraram na etapa na janela. */
  entraram: number;
  /** Quantas dessas chegaram a uma etapa posterior. */
  avancaram: number;
  /** % real, ou null quando a amostra é pequena (a tela avisa em vez de mostrar número). */
  taxa: number | null;
}

/**
 * Taxa de conversão de cada etapa para a seguinte, só com oportunidades do CRM.
 * `entraram` = oportunidades com movimento para a etapa dentro da janela [inicio, fim).
 * `avancaram` = dessas, as que têm (em qualquer momento) movimento para etapa de ordem maior.
 */
export function calcularTaxas(
  etapas: Pick<EtapaInfo, "id" | "ordem">[],
  movimentos: Movimento[],
  janela: { inicio: Date; fim: Date },
): TaxaEtapa[] {
  const maiorOrdem = new Map<string, number>();
  for (const m of movimentos) {
    if (m.para_ordem == null) continue;
    maiorOrdem.set(m.oportunidade_id, Math.max(maiorOrdem.get(m.oportunidade_id) ?? 0, m.para_ordem));
  }
  return etapas.map((e) => {
    const entrou = new Set<string>();
    for (const m of movimentos) {
      if (m.para_ordem === e.ordem && m.em >= janela.inicio && m.em < janela.fim) entrou.add(m.oportunidade_id);
    }
    let avancaram = 0;
    for (const id of entrou) if ((maiorOrdem.get(id) ?? 0) > e.ordem) avancaram += 1;
    const entraram = entrou.size;
    return {
      etapaId: e.id,
      entraram,
      avancaram,
      taxa: amostraPequena(entraram) ? null : Math.round((avancaram / entraram) * 100),
    };
  });
}

// ---------------------------------------------------------------- propostas e ofertas (PR 5)

/** Degraus de desconto que o checkout aceita (cupom de 10% ou mais). Até 20% conta para a meta dos parceiros. */
export const DESCONTOS_OFERTA = [0, 10, 15, 20] as const;
export type DescontoOferta = (typeof DESCONTOS_OFERTA)[number];

/** Validade padrão de uma oferta (sugestão: 48 h). O João pode trocar depois. */
export const VALIDADE_OFERTA_PADRAO_HORAS = 48;

export type StatusOferta = "criada" | "enviada" | "paga" | "expirada" | "perdida";

/** Oferta está viva (ainda dá para pagar) quando não está encerrada e a validade não passou. */
export function ofertaVigente(o: { status: StatusOferta; validoAte: Date }, agora = new Date()): boolean {
  return (o.status === "criada" || o.status === "enviada") && o.validoAte.getTime() > agora.getTime();
}

export function segundosRestantes(validoAte: Date, agora = new Date()): number {
  return Math.max(0, Math.floor((validoAte.getTime() - agora.getTime()) / 1000));
}

/** "1 d 04:12:09" ou "04:12:09". Para a contagem na página da oferta. */
export function contagemRegressiva(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos));
  const d = Math.floor(s / 86_400);
  const hh = String(Math.floor((s % 86_400) / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${d > 0 ? `${d} d ` : ""}${hh}:${mm}:${ss}`;
}

/** Dá para escrever a proposta? Só a partir de "Briefing feito" (ordem 4) e com dor e meta preenchidas. */
export function podeCriarProposta(
  etapa: Pick<EtapaInfo, "ordem">,
  d: Pick<DadosValidacao, "dor" | "meta">,
): ResultadoMovimento {
  if (etapa.ordem < 4) {
    return { ok: false, faltando: [], bloqueio: "Faça o briefing antes de escrever a proposta." };
  }
  if (etapa.ordem > 6) {
    return { ok: false, faltando: [], bloqueio: "Esta oportunidade já passou da etapa de proposta." };
  }
  const faltando: string[] = [];
  if (!preenchido(d.dor)) faltando.push("dor");
  if (!preenchido(d.meta)) faltando.push("meta");
  return { ok: faltando.length === 0, faltando };
}

/** A oferta só nasce depois que o lead abriu a proposta (etapa 5, "Proposta aberta"). */
export function podeCriarOferta(etapa: Pick<EtapaInfo, "ordem">): ResultadoMovimento {
  if (etapa.ordem < 5) {
    return { ok: false, faltando: [], bloqueio: "A oferta só vale depois que o lead abrir a proposta." };
  }
  if (etapa.ordem > 6) {
    return { ok: false, faltando: [], bloqueio: "Esta oportunidade já passou da etapa de oferta." };
  }
  return { ok: true, faltando: [] };
}

/** Valor final da oferta (centavos), a partir do valor do cadastro e do desconto escolhido. */
export function valorDaOferta(valorCentavos: number, descontoPct: number): number {
  return valorComDesconto(valorCentavos, descontoPct);
}

/** Devolve o degrau de desconto se o número vindo de fora for um degrau válido; senão null. */
export function descontoValido(n: number): DescontoOferta | null {
  return (DESCONTOS_OFERTA as readonly number[]).includes(n) ? (n as DescontoOferta) : null;
}

/** Garantia do produto (dias). O card passa a "Dentro" só depois dela. */
export const GARANTIA_DIAS = 7;

/**
 * Passa de "Pago" para "Dentro (7 dias)" quando: passou a garantia desde o pagamento,
 * o acesso foi provisionado (grant ativo) e o aluno fez login pelo menos uma vez.
 */
export function elegivelParaDentro(
  x: { pagoDesde: Date; grantAtivo: boolean; loginRegistrado: boolean },
  agora = new Date(),
): boolean {
  const passou = agora.getTime() - x.pagoDesde.getTime() >= GARANTIA_DIAS * 86_400_000;
  return passou && x.grantAtivo && x.loginRegistrado;
}

/** Segunda-feira (AAAA-MM-DD) da semana da data dada, no fuso de São Paulo (UTC-3, sem horário de verão). */
export function segundaDaSemana(d: Date): string {
  const local = new Date(d.getTime() - 3 * 3_600_000);
  const volta = (local.getUTCDay() + 6) % 7;
  const seg = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - volta));
  return seg.toISOString().slice(0, 10);
}
