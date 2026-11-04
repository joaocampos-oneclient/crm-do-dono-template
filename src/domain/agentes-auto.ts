/**
 * Regras puras do auto-atendimento dos agentes (Cláudio + Scout no WhatsApp).
 * Funções puras: sem rede, sem disco, `agora` injetado. Cada regra diz o que protege.
 *
 * Princípio: na dúvida, o robô cala ou passa para o humano. Nunca insiste.
 */
import {
  detectarPedidoOptOut,
  detectarRecusaRecente,
  dentroDaJanelaHorario,
  mencionaPrecoComercial,
} from "./reciclador";
import type { FreiosCampanhaReciclador } from "./reciclador-types";
import { mencionaPreco } from "./rules";

export type DecisaoAutoAtendimento = "responder" | "handoff" | "silenciar";

export type JanelaComercial = Pick<
  FreiosCampanhaReciclador,
  "apenasDiasUteis" | "janelaInicioHora" | "janelaFimHora"
>;

/** Janela padrão do auto-atendimento: dias úteis, 8h às 20h (America/Sao_Paulo). */
export const JANELA_AUTO_PADRAO: JanelaComercial = {
  apenasDiasUteis: true,
  janelaInicioHora: 8,
  janelaFimHora: 20,
};

export const MAX_RESPOSTAS_SEGUIDAS_PADRAO = 3;

/** Nota (Pergunta Matadora) a partir da qual a conversa vai para o humano. */
export const NOTA_HANDOFF = 9;

export interface EntradaAutoAtendimento {
  texto: string;
  agora: string;
  /** Contato já pediu para parar (registro permanente de opt-out). */
  optOut?: boolean;
  /** Um humano respondeu por último ou assumiu a conversa. */
  humanoAssumiu?: boolean;
  /** O contato já está esperando um humano. */
  handoffPendente?: boolean;
  /** Quantas mensagens automáticas seguidas existem no fim da conversa. */
  autoRespostasSeguidas?: number;
  maxSeguidas?: number;
  ultimaRespostaRoboEm?: string | null;
  pediuPreco?: boolean;
  pediuHumano?: boolean;
  notaScout?: number | null;
  acaoScout?: string | null;
  janela?: JanelaComercial;
}

export interface ResultadoAutoAtendimento {
  decisao: DecisaoAutoAtendimento;
  motivo: string;
}

/** Pedido explícito de falar com uma pessoa. */
export function pediuAtendimentoHumano(texto: string): boolean {
  return /\b(?:humano|atendente|pessoa|vendedor|consultor|especialista|falar\s+com\s+algu[eé]m|me\s+liga|pode\s+me\s+ligar)\b/i.test(
    texto,
  );
}

/** Pedido de preço/condição na mensagem do contato (regra do CRM + regra comercial do Reciclador). */
export function pediuPrecoNaMensagem(texto: string): boolean {
  return mencionaPreco(texto) || mencionaPrecoComercial(texto);
}

/**
 * Decide o que o robô faz com uma mensagem recebida.
 * Ordem importa: proteção do contato vem antes de tudo (LGPD), depois handoff, depois silêncio operacional.
 */
export function avaliarAutoAtendimento(entrada: EntradaAutoAtendimento): ResultadoAutoAtendimento {
  const texto = entrada.texto ?? "";

  // 1. Proteção do contato: pediu para parar ou recusou → silêncio absoluto.
  if (entrada.optOut || detectarPedidoOptOut(texto)) {
    return { decisao: "silenciar", motivo: "Contato pediu para parar (opt-out)." };
  }
  if (detectarRecusaRecente(texto)) {
    return { decisao: "silenciar", motivo: "Contato recusou; o robô não insiste." };
  }

  // 2. Humano já está no comando: o robô não atravessa.
  if (entrada.humanoAssumiu) {
    return { decisao: "silenciar", motivo: "Um humano já assumiu a conversa." };
  }
  if (entrada.handoffPendente) {
    return { decisao: "silenciar", motivo: "Handoff pendente: aguardando o humano." };
  }

  // 3. Gatilhos objetivos de handoff (preço, humano, nota alta, Scout).
  if (entrada.pediuPreco || pediuPrecoNaMensagem(texto)) {
    return { decisao: "handoff", motivo: "Falou de preço ou condição: só o humano responde." };
  }
  if (entrada.pediuHumano || pediuAtendimentoHumano(texto)) {
    return { decisao: "handoff", motivo: "Pediu para falar com uma pessoa." };
  }
  if (entrada.notaScout != null && entrada.notaScout >= NOTA_HANDOFF) {
    return { decisao: "handoff", motivo: `Nota ${entrada.notaScout}: momento de compra, passa ao humano.` };
  }
  if (entrada.acaoScout === "handoff") {
    return { decisao: "handoff", motivo: "Scout recomendou handoff." };
  }

  // 4. Janela comercial: sem responder de madrugada nem no fim de semana.
  const janela = entrada.janela ?? JANELA_AUTO_PADRAO;
  const dentro = dentroDaJanelaHorario(entrada.agora, janela as FreiosCampanhaReciclador);
  if (!dentro.ok) {
    return { decisao: "silenciar", motivo: dentro.motivo ?? "Fora da janela comercial." };
  }

  // 5. Anti-loop: depois de N respostas automáticas seguidas, chama o humano.
  const max = entrada.maxSeguidas ?? MAX_RESPOSTAS_SEGUIDAS_PADRAO;
  if ((entrada.autoRespostasSeguidas ?? 0) >= max) {
    return {
      decisao: "handoff",
      motivo: `${entrada.autoRespostasSeguidas} respostas automáticas seguidas: anti-loop, chama o humano.`,
    };
  }

  if (entrada.acaoScout === "ignorar") {
    return { decisao: "silenciar", motivo: "Scout classificou como ignorar." };
  }

  return { decisao: "responder", motivo: "Dentro dos freios: Cláudio pode responder." };
}

/** Conta mensagens automáticas (autor "robo") consecutivas no fim da conversa. */
export function contarRespostasAutomaticasSeguidas(
  mensagens: { autor: "contato" | "robo" | "humano" }[],
): number {
  let n = 0;
  for (let i = mensagens.length - 1; i >= 0; i--) {
    const a = mensagens[i].autor;
    if (a === "robo") n += 1;
    else if (a === "contato") continue; // mensagens do contato não zeram a contagem do robô: só o humano zera
    else break;
  }
  return n;
}

/** O último remetente não-contato foi um humano? Então ele assumiu a conversa. */
export function humanoAssumiuNoHistorico(
  mensagens: { autor: "contato" | "robo" | "humano" }[],
): boolean {
  for (let i = mensagens.length - 1; i >= 0; i--) {
    const a = mensagens[i].autor;
    if (a === "contato") continue;
    return a === "humano";
  }
  return false;
}

/**
 * Extrai a nota 0–10 quando o contato responde só com o número ("9", "nota 8", "8!").
 * Qualquer outra frase devolve null: a nota nunca é inventada.
 */
export function extrairNotaDaResposta(texto: string): number | null {
  const m = (texto ?? "")
    .trim()
    .match(/^(?:nota\s*[:-]?\s*)?(\d{1,2})(?:\s*(?:\/\s*10|de\s*10))?\s*[!.]*$/i);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 0 && n <= 10 ? n : null;
}

/** Texto final do robô passa nas travas de preço? Revalidação obrigatória antes de enviar. */
export function textoRoboSeguro(texto: string): { ok: boolean; motivo?: string } {
  const t = (texto ?? "").trim();
  if (!t) return { ok: false, motivo: "Texto vazio." };
  if (mencionaPreco(t) || mencionaPrecoComercial(t)) {
    return { ok: false, motivo: "Texto do robô menciona preço ou condição." };
  }
  return { ok: true };
}
