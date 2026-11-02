/**
 * Regras do CRM. Funções puras: rodam no navegador, no servidor e nos testes.
 * Cada regra diz o que protege. Datas chegam como ISO; `agora` é injetado para ser testável.
 */
import { ETAPAS_CLIENTE, ETAPAS_PROSPECT, etapaDe } from "./funil";
import type { Categoria, ContatoCompleto, Oportunidade, Termometro } from "./types";

export const minutosEntre = (deIso: string, ateIso: string) => Math.max(0, Math.round((Date.parse(ateIso) - Date.parse(deIso)) / 60000));

/** Minutos que a oportunidade está parada na etapa atual. */
export const minutosNaEtapa = (o: Oportunidade, agora: string) => minutosEntre(o.entrouNaEtapaEm, agora);

/** O card passou do prazo da etapa? (prazo 0 = sem prazo). */
export const estourouPrazo = (o: Oportunidade, agora: string) => {
  const e = etapaDe(o.etapa);
  return !!e && !o.perdida && e.prazoMin > 0 && minutosNaEtapa(o, agora) > e.prazoMin;
};

/** Categoria calculada pelas oportunidades. Ninguém edita. */
export function categoria(oportunidades: Oportunidade[]): Categoria {
  const vivas = oportunidades.filter((o) => !o.perdida);
  if (vivas.some((o) => ETAPAS_CLIENTE.includes(o.etapa))) return "cliente";
  if (vivas.some((o) => ETAPAS_PROSPECT.includes(o.etapa))) return "prospect";
  return "lead";
}

/** Ação da nota 0 a 10. A nota nunca é inventada: sem número claro, devolve "perguntar de novo". */
export function acaoDaNota(nota: number | null): "perguntar de novo" | "nutrir" | "convidar" | "passar ao humano" {
  if (nota === null || Number.isNaN(nota) || nota < 0 || nota > 10) return "perguntar de novo";
  if (nota <= 6) return "nutrir";
  if (nota <= 8) return "convidar";
  return "passar ao humano";
}

/** Gatilhos objetivos de handoff. Qualquer um passa a conversa para o humano. */
export function deveFazerHandoff(p: { nota: number | null; pediuPreco?: boolean; pediuHumano?: boolean; quisEntrar?: boolean }) {
  return acaoDaNota(p.nota) === "passar ao humano" || !!p.pediuPreco || !!p.pediuHumano || !!p.quisEntrar;
}

/** Texto fala de preço, desconto, parcela, cupom ou condição? Só o humano pode. */
export const mencionaPreco = (texto: string) => /R\$|\bpre[cç]o|desconto|parcel|cupom|\boferta|condi[cç][aã]o|checkout|\bvalor\b|investimento/i.test(texto);

/** O robô nunca fala preço. Em follow-up automático exige aprovação humana e janela de 48 h. Trava em código, não só no prompt. */
export function podeRoboEnviar(texto: string, aprovadoPorHumano: boolean, horasDesdeUltimaAutomatica: number | null) {
  if (mencionaPreco(texto)) return { ok: false, motivo: "Menciona preço ou condição: só o humano." };
  if (!aprovadoPorHumano) return { ok: false, motivo: "Falta aprovação humana." };
  if (horasDesdeUltimaAutomatica !== null && horasDesdeUltimaAutomatica < 48) {
    return { ok: false, motivo: "Mensagem automática nas últimas 48 horas." };
  }
  return { ok: true, motivo: "" };
}

/** Taxa pequena não vira porcentagem. Com poucos leads, o número ainda não significa nada. */
export const taxaOuAviso = (acertos: number, total: number, minimo = 10) =>
  total < minimo ? `n=${total} · amostra pequena` : `${Math.round((acertos / total) * 100)}%`;

/** Conta reversa: quantos leads por dia você precisa para N vendas por dia, com as SUAS taxas. */
export function contaReversa(
  vendasPorDia: number,
  taxas: { leadParaConversa: number; conversaParaHandoff: number; handoffParaOferta: number; ofertaParaVenda: number },
) {
  const seguro = (t: number) => (t > 0 ? t : 0.01);
  const ofertas = vendasPorDia / seguro(taxas.ofertaParaVenda);
  const handoffs = ofertas / seguro(taxas.handoffParaOferta);
  const conversas = handoffs / seguro(taxas.conversaParaHandoff);
  const leads = conversas / seguro(taxas.leadParaConversa);
  return { ofertas: Math.ceil(ofertas), handoffs: Math.ceil(handoffs), conversas: Math.ceil(conversas), leads: Math.ceil(leads) };
}

/** Aviso ao contato quando a conversa troca de mão. O contato sempre sabe quem fala. */
export const avisoAssumir = (nome: string, atendente: string) =>
  `Oi ${nome}, daqui pra frente quem fala com você é ${atendente}. O assistente de IA não atende mais esta conversa.`;
export const avisoDevolver = (nome: string, robo = "o Cláudio, nosso assistente de IA") =>
  `${nome}, a conversa voltou para ${robo}. Se quiser falar com uma pessoa, é só pedir.`;

/** Termômetro do vendedor alterna: sem marca, frio, morno, quente. Não substitui a nota e não move etapa. */
export const proximoTermometro = (t: Termometro | null): Termometro | null => {
  const ordem = [null, "frio", "morno", "quente"] as const;
  return ordem[(ordem.indexOf(t ?? null) + 1) % ordem.length];
};

/** Preenche {nome}, {empresa}, {produto}, {operador}, {link}, {primeiroNome} num template. */
export function preencherTemplate(texto: string, vars: Record<string, string | undefined>) {
  return texto.replace(/\{([^{}]+)\}/g, (_, k: string) => vars[k.trim()] ?? `{${k}}`);
}

export const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] ?? nome;

/** Oportunidade "principal" do contato: a primeira viva; senão a última. */
export const oportunidadePrincipal = (ops: Oportunidade[]) => ops.find((o) => !o.perdida) ?? ops[ops.length - 1] ?? null;

/** Próximas ações sugeridas (até 3), cada uma com o porquê. A IA sugere, o humano decide. */
export function proximasAcoes(c: ContatoCompleto, agora: string) {
  const o = oportunidadePrincipal(c.oportunidades);
  if (!o) return [];
  const e = etapaDe(o.etapa);
  const a: { titulo: string; porque: string }[] = [];
  if (c.dono === "robo" && c.handoffPendente) {
    const min = c.handoffDesde ? minutosEntre(c.handoffDesde, agora) : 0;
    a.push({ titulo: "Assumir agora", porque: `Pediu humano com nota ${c.nota ?? "—"}. Prazo do handoff: 2 h; passaram ${min} min.` });
  } else if (o.etapa === "handoff") a.push({ titulo: "Ligar para fazer o briefing", porque: "Uma ligação curta fecha dor, meta e data." });
  if (o.etapa === "briefing") a.push({ titulo: "Gerar a proposta com a dor e a meta do briefing", porque: "Quanto antes sai, maior a chance de abrir no mesmo dia." });
  if (o.etapa === "proposta") a.push({ titulo: "Fazer a oferta com condição e prazo", porque: "Sem oferta, a abertura da proposta esfria." });
  if (o.etapa === "oferta") a.push({ titulo: "Follow-up sem pressão", porque: "Ajude com a forma de pagamento em vez de apertar." });
  if (estourouPrazo(o, agora) && e) a.push({ titulo: "Prazo vencido: retomar hoje", porque: `Parado em "${e.nome}" (prazo ${e.prazoTexto}).` });
  const tarefaVencida = c.tarefas.find((t) => !t.feita && t.venceEm && Date.parse(t.venceEm) < Date.parse(agora));
  if (tarefaVencida) a.push({ titulo: `Tarefa vencida: ${tarefaVencida.texto}`, porque: `Origem: ${tarefaVencida.origem}.` });
  if (c.termometro === "morno" || c.termometro === "frio") a.push({ titulo: "Cumprir o follow-up da última ligação", porque: `Termômetro ${c.termometro}.` });
  if (!c.ligacoes.length && ["handoff", "briefing", "proposta", "oferta"].includes(o.etapa)) a.push({ titulo: "Ainda sem ligação: ligar", porque: "Só texto até aqui." });
  return a.slice(0, 3);
}

export const formatarReais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: v % 1 ? 2 : 0 });

export const formatarTempo = (min: number) => (min < 60 ? `${min} min` : min < 1440 ? `${Math.round(min / 60)} h` : `${Math.round(min / 1440)} d`);

export const horaDe = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export const dataCurta = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export const dataHora = (iso: string) => `${dataCurta(iso)} ${horaDe(iso)}`;

export const diaIso = (iso: string) => iso.slice(0, 10);

export const somarDias = (iso: string, dias: number) => new Date(Date.parse(iso) + dias * 86400000).toISOString();
export const somarMinutos = (iso: string, min: number) => new Date(Date.parse(iso) + min * 60000).toISOString();

/** Telefone só com dígitos, com 55 na frente quando falta (para link wa.me). */
export const telefoneDigitos = (t: string) => {
  const d = t.replace(/\D/g, "");
  return d.length <= 11 ? `55${d}` : d;
};
export const linkWhatsApp = (telefone: string, texto: string) => `https://wa.me/${telefoneDigitos(telefone)}?text=${encodeURIComponent(texto)}`;
