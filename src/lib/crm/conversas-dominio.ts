/**
 * Regras puras das conversas: alerta de handoff parado, quem pode escrever e o resumo diário
 * de ocorrências. Sem banco e sem rede.
 */

export type NivelAlerta = "15min" | "4h" | "24h";

const MIN = 60_000;

/**
 * A pausa do Cláudio não expira. Em vez disso, o CRM avisa quando o handoff fica parado:
 * 15 min, 4 h e 24 h (depois disso, o aviso é diário). Devolve o nível mais alto já atingido.
 */
export function nivelAlertaHandoff(abertoEm: Date, agora: Date = new Date()): NivelAlerta | null {
  const min = (agora.getTime() - abertoEm.getTime()) / MIN;
  if (!Number.isFinite(min) || min < 15) return null;
  if (min < 4 * 60) return "15min";
  if (min < 24 * 60) return "4h";
  return "24h";
}

export const ROTULO_ALERTA: Record<NivelAlerta, string> = {
  "15min": "parado há mais de 15 min",
  "4h": "parado há mais de 4 h",
  "24h": "parado há mais de 24 h",
};

/** Só dá para escrever quando uma pessoa assumiu. Com o Cláudio no controle, não. */
export function podeEnviar(modo: "claudio" | "humano"): boolean {
  return modo === "humano";
}

export const TIPOS_OCORRENCIA = ["problema", "melhoria"] as const;
export type TipoOcorrencia = (typeof TIPOS_OCORRENCIA)[number];
export const ROTULO_OCORRENCIA: Record<TipoOcorrencia, string> = { problema: "Problema", melhoria: "Melhoria" };

export type OcorrenciaLinha = {
  tipo: TipoOcorrencia;
  porque: string;
  contato: string;
  trecho: string;
  quando: string; // ISO
  quem: string;
};

/** Dia (AAAA-MM-DD) → intervalo em UTC, no fuso de Brasília (UTC-3). */
export function intervaloDoDia(dia: string): { inicio: string; fim: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return null;
  const ini = new Date(`${dia}T03:00:00.000Z`);
  if (Number.isNaN(ini.getTime()) || ini.toISOString().slice(0, 10) !== dia) return null;
  return { inicio: ini.toISOString(), fim: new Date(ini.getTime() + 24 * 60 * MIN).toISOString() };
}

function hora(iso: string): string {
  const d = new Date(new Date(iso).getTime() - 3 * 60 * MIN);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/** Texto simples, pronto para colar numa conversa com quem cuida do Cláudio. */
export function resumoDiario(dia: string, linhas: OcorrenciaLinha[]): string {
  const cab = `Ocorrências do Cláudio · ${dia.split("-").reverse().join("/")}`;
  if (!linhas.length) return `${cab}\n\nNenhuma ocorrência marcada neste dia.\n`;
  const grupo = (tipo: TipoOcorrencia) => linhas.filter((l) => l.tipo === tipo);
  const bloco = (tipo: TipoOcorrencia) => {
    const g = grupo(tipo);
    if (!g.length) return "";
    const itens = g
      .map((l, i) => `${i + 1}. ${hora(l.quando)} · ${l.contato} · por ${l.quem}\n   Cláudio disse: "${l.trecho}"\n   Por quê: ${l.porque}`)
      .join("\n");
    return `${ROTULO_OCORRENCIA[tipo].toUpperCase()} (${g.length})\n${itens}\n`;
  };
  return [cab, "", bloco("problema"), bloco("melhoria")].filter((x, i) => i < 2 || x).join("\n").trimEnd() + "\n";
}
