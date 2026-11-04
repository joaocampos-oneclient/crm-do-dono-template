/**
 * Guardrails dos agentes (Cláudio, Scout, Scribe, Ledger, Pilot, Eco).
 * Funções puras: rodam nos testes, no servidor e no MCP. A trava vive em código;
 * o prompt só reforça. Se a saída do LLM violar, o agente descarta e usa regras locais.
 */
import { mencionaPreco } from "./rules";
import { detectarPedidoOptOut, detectarRecusaRecente, mencionaPrecoComercial } from "./reciclador";

export const NAO_INFORMADO = "não informado";
export const MAX_FOLLOWUPS_SCRIBE = 5;

/** Preço, desconto, parcela, oferta ou condição comercial (junta a regra ampla e a regra comercial). */
export function mencionaPrecoOuCondicao(texto: string): boolean {
  if (!texto) return false;
  return mencionaPreco(texto) || mencionaPrecoComercial(texto);
}

/** Texto de cobrança: o Ledger nunca escreve isso, nem sugere. */
export function textoDeCobranca(texto: string): boolean {
  if (!texto) return false;
  return /\bcobr(?:ar|ei|e|a|ando|ança|anca|anças|ancas)\b|\bboletos?\b|\bpagar\b|\bpague\b|\bpagamentos?\b|\bvencid[oa]s?\b|\bvencimento\b|\batras(?:o|ad[oa]s?)\b|\bfaturas?\b|\bd[eé]bitos?\b|\binadimpl|\bmensalidades?\b|\bpix\b|R\$/i.test(
    texto,
  );
}

/** Pediu atendimento humano? (mesma intenção do handoff do Ember, só que para qualquer agente). */
export function pediuAtendimentoHumano(texto: string): boolean {
  return /\b(?:humano|atendente|pessoa|vendedor|consultor|especialista|falar\s+com\s+algu[eé]m|me\s+liga|pode\s+me\s+ligar)\b/i.test(
    texto ?? "",
  );
}

export type BloqueioPilot = "teto_anti_loop" | "cooldown" | "opt_out" | "recusa_recente";

export interface EntradaGuardrailPilot {
  horasDesdeUltimaAutomatica: number | null;
  diasParado: number;
  /** Última mensagem escrita pelo contato (para detectar pedido de parar/recusa). */
  ultimaMensagemContato?: string | null;
  cooldownHoras: number;
  tetoDias: number;
}

/** Ordem: opt-out e recusa (respeito ao contato) → teto anti-loop → cooldown. */
export function avaliarPilotPre(e: EntradaGuardrailPilot): { ok: true } | { ok: false; bloqueio: BloqueioPilot; motivo: string } {
  const ultima = e.ultimaMensagemContato?.trim() ?? "";
  if (ultima && detectarPedidoOptOut(ultima)) {
    return { ok: false, bloqueio: "opt_out", motivo: "Contato pediu para parar: nenhum follow-up." };
  }
  if (ultima && detectarRecusaRecente(ultima)) {
    return { ok: false, bloqueio: "recusa_recente", motivo: "Contato recusou recentemente: nenhum follow-up." };
  }
  if (e.diasParado >= e.tetoDias) {
    return { ok: false, bloqueio: "teto_anti_loop", motivo: `Parado há ${e.diasParado} dias: teto anti-loop.` };
  }
  if (e.horasDesdeUltimaAutomatica !== null && e.horasDesdeUltimaAutomatica < e.cooldownHoras) {
    return { ok: false, bloqueio: "cooldown", motivo: `Última automática há menos de ${e.cooldownHoras}h.` };
  }
  return { ok: true };
}

/** Valores e datas que aparecem no texto gerado mas não existem na fonte (indício de invenção). */
export function numerosInventados(texto: string, fonte: string): string[] {
  const padrao = /R\$\s*[\d.,]+|\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b|\b\d+(?:[.,]\d+)?\s*%/g;
  const achados = texto.match(padrao) ?? [];
  const base = fonte.replace(/\s+/g, "");
  return achados.filter((a) => !base.includes(a.replace(/\s+/g, "")));
}

/** Follow-ups do Scribe: só o que veio das notas, sem duplicata, no máximo 5. */
export function limparFollowupsScribe(followups: string[], notas: string): string[] {
  const vistos = new Set<string>();
  const saida: string[] = [];
  for (const bruto of followups) {
    const f = String(bruto ?? "").trim();
    if (!f) continue;
    const chave = f.toLowerCase();
    if (vistos.has(chave)) continue;
    if (numerosInventados(f, notas).length > 0) continue;
    vistos.add(chave);
    saida.push(f);
    if (saida.length >= MAX_FOLLOWUPS_SCRIBE) break;
  }
  return saida;
}

/** Notas vazias ou o placeholder padrão: o Scribe não inventa reunião. */
export function notasVazias(notas: string): boolean {
  const n = notas.trim().toLowerCase();
  return !n || n === "reunião sem notas." || n === "reuniao sem notas.";
}

/** Campo ausente vira "não informado", nunca "undefined" nem texto inventado. */
export function valorOuNaoInformado(v: unknown): string {
  if (v === null || v === undefined) return NAO_INFORMADO;
  const s = String(v).trim();
  if (!s || s === "—" || s === "-" || s.toLowerCase() === "undefined" || s.toLowerCase() === "null") return NAO_INFORMADO;
  return s;
}

export interface MensagemHistorico {
  autor: "contato" | "robo" | "humano";
  texto: string;
  em: string;
}

/** Aceita lixo sem explodir: devolve só mensagens bem formadas. */
export function normalizarHistorico(raw: unknown): MensagemHistorico[] {
  if (!Array.isArray(raw)) return [];
  const saida: MensagemHistorico[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const m = item as Record<string, unknown>;
    const autor = m.autor === "contato" || m.autor === "robo" || m.autor === "humano" ? m.autor : null;
    const texto = typeof m.texto === "string" ? m.texto : null;
    const em = typeof m.em === "string" && !Number.isNaN(Date.parse(m.em)) ? m.em : null;
    if (!autor || texto === null || !em) continue;
    saida.push({ autor, texto, em });
  }
  return saida.sort((a, b) => Date.parse(a.em) - Date.parse(b.em));
}

/** Minutos desde a última mensagem (de qualquer autor) até `agora`. Null se não der para calcular. */
export function minutosDeSilencio(historico: MensagemHistorico[], agoraIso?: string): number | null {
  if (!agoraIso || historico.length === 0) return null;
  const agora = Date.parse(agoraIso);
  if (Number.isNaN(agora)) return null;
  const ultima = Date.parse(historico[historico.length - 1].em);
  return Math.max(0, Math.round((agora - ultima) / 60000));
}
