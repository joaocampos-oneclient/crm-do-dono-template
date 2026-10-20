/**
 * Regras do CRM. Funções puras: copie para o backend ou para um hook.
 * Cada regra diz o que protege.
 */
import { etapaDe } from "./funil";
import type { Categoria, Contato, Oportunidade, Termometro } from "./types";

/** O card passou do prazo da etapa? (prazo 0 = sem prazo). */
export const estourouPrazo = (o: Oportunidade) => {
  const e = etapaDe(o.etapa);
  return !!e && e.prazoMin > 0 && o.minutosNaEtapa > e.prazoMin;
};

/** Categoria calculada pelas oportunidades. Ninguém edita. */
export function categoria(c: Contato): Categoria {
  if (c.oportunidades.some((o) => o.etapa === "pago" || o.etapa === "dentro")) return "cliente";
  if (c.oportunidades.some((o) => ["briefing", "proposta", "oferta"].includes(o.etapa))) return "prospect";
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

/** O robô nunca fala preço, desconto, parcela, cupom ou condição. Trava em código, não só no prompt. */
export function podeRoboEnviar(texto: string, aprovadoPorHumano: boolean, horasDesdeUltimaAutomatica: number | null) {
  if (/R\$|pre[cç]o|desconto|parcel|cupom|oferta|condi[cç][aã]o|checkout/i.test(texto)) {
    return { ok: false, motivo: "Menciona preço ou condição: só o humano." };
  }
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
  const ofertas = vendasPorDia / taxas.ofertaParaVenda;
  const handoffs = ofertas / taxas.handoffParaOferta;
  const conversas = handoffs / taxas.conversaParaHandoff;
  const leads = conversas / taxas.leadParaConversa;
  return { ofertas: Math.ceil(ofertas), handoffs: Math.ceil(handoffs), conversas: Math.ceil(conversas), leads: Math.ceil(leads) };
}

/** Aviso ao contato quando a conversa troca de mão. O contato sempre sabe quem fala. */
export const avisoAssumir = (nome: string, atendente: string) =>
  `Oi ${nome}, daqui pra frente quem fala com você é ${atendente}. O assistente de IA não atende mais esta conversa.`;
export const avisoDevolver = (nome: string) =>
  `${nome}, a conversa voltou para o nosso assistente de IA. Se quiser falar com uma pessoa, é só pedir.`;

/** Termômetro do vendedor alterna: sem marca, frio, morno, quente. Não substitui a nota e não move etapa. */
export const proximoTermometro = (t: Termometro | null): Termometro | null => {
  const ordem = [null, "frio", "morno", "quente"] as const;
  return ordem[(ordem.indexOf(t ?? null) + 1) % ordem.length];
};

/** Próximas ações sugeridas (até 3), cada uma com o porquê. A IA sugere, o humano decide. */
export function proximasAcoes(c: Contato) {
  const o = c.oportunidades.find((x) => x.etapa !== "perdido") ?? c.oportunidades[0];
  if (!o) return [];
  const e = etapaDe(o.etapa);
  const a: { titulo: string; porque: string }[] = [];
  if (c.dono === "robo" && c.handoffPendente) a.push({ titulo: "Assumir agora", porque: `Pediu humano com nota ${c.nota}. Prazo do handoff: 2 h; passaram ${c.handoffMin} min.` });
  else if (o.etapa === "handoff") a.push({ titulo: "Ligar para fazer o briefing", porque: "Uma ligação curta fecha dor, meta e data." });
  if (o.etapa === "briefing") a.push({ titulo: "Gerar a proposta com a dor e a meta do briefing", porque: "Quanto antes sai, maior a chance de abrir no mesmo dia." });
  if (o.etapa === "proposta") a.push({ titulo: "Fazer a oferta com condição e prazo", porque: "Sem oferta, a abertura da proposta esfria." });
  if (o.etapa === "oferta") a.push({ titulo: "Follow-up sem pressão", porque: "Ajude com a forma de pagamento em vez de apertar." });
  if (estourouPrazo(o) && e) a.push({ titulo: "Prazo vencido: retomar hoje", porque: `Parado em "${e.nome}" (prazo ${e.prazoTexto}).` });
  if (c.termometro === "morno" || c.termometro === "frio") a.push({ titulo: "Cumprir o follow-up da última ligação", porque: `Termômetro ${c.termometro}.` });
  if (!c.ligacoes.length && ["handoff", "briefing", "proposta", "oferta"].includes(o.etapa)) a.push({ titulo: "Ainda sem ligação: ligar", porque: "Só texto até aqui." });
  return a.slice(0, 3);
}
