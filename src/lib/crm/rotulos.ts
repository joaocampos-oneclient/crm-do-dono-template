import { MOTIVOS_PERDA } from "@/lib/crm/domain";

/**
 * Rótulos humanos (pt-BR) para códigos internos do CRM.
 * A tela nunca deve mostrar o slug cru (live_gratuita, numero_invalido, claudio).
 */

export const ROTULOS_ORIGEM: Record<string, string> = {
  anuncio: "Anúncio",
  grupo_whatsapp: "Grupo de WhatsApp",
  instagram_conteudo: "Instagram (conteúdo)",
  instagram_dm: "Instagram (direct)",
  stories: "Stories",
  live_gratuita: "Live gratuita",
  meet_comunidade: "Meet da comunidade",
  imersao: "Imersão",
  indicacao: "Indicação",
  outro: "Outro",
  aplicacao: "Aplicação",
  checkout: "Checkout",
  dm: "Direct",
  cofounder_gift: "Presente de co-founder",
  lead_magnet: "Isca",
  ig_dm: "Instagram (direct)",
  formulario: "Formulário",
  meta: "Meta Ads",
  google: "Google Ads",
  manual: "Manual",
  ligacao: "Ligação",
  "sem origem": "Sem origem",
  sem_origem: "Sem origem",
};

export const ROTULOS_FUNIL_ENTRADA: Record<string, string> = {
  semanal: "Live semanal",
  perpetuo: "Perpétuo",
  imersao: "Evento / imersão",
};

export const ROTULOS_AUTOR: Record<string, string> = {
  humano: "Humano",
  claudio: "Cláudio",
  sistema: "Sistema",
  nota: "Nota",
  ligacao: "Ligação",
  otavio: "Otávio",
  joao: "João",
};

export const ROTULOS_TIPO_CONTATO: Record<string, string> = {
  lead: "Lead",
  cliente: "Cliente",
};

export const ROTULOS_CATEGORIA: Record<string, string> = {
  lead: "Lead",
  prospect: "Em conversa",
  cliente: "Cliente",
};

export const ROTULO_VENDA_DIRETA = "Venda direta";
export const ROTULO_VENDA_FUNIL = "No funil";

/** Primeira letra maiúscula, underscores viram espaço. Fallback quando o código é novo. */
export function humanizarCodigo(codigo: string): string {
  const t = codigo.trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  if (!t) return codigo;
  return t.replace(/\p{L}+/gu, (p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase());
}

export function rotuloDe(mapa: Record<string, string>, codigo: string | null | undefined, vazio = "—"): string {
  if (codigo == null) return vazio;
  const k = String(codigo).trim();
  if (!k) return vazio;
  return mapa[k] ?? mapa[k.toLowerCase()] ?? humanizarCodigo(k);
}

export function rotuloOrigem(codigo: string | null | undefined): string {
  return rotuloDe(ROTULOS_ORIGEM, codigo, "Sem origem");
}

export function rotuloMotivo(codigo: string | null | undefined): string {
  if (codigo == null || !String(codigo).trim()) return "Sem motivo";
  const k = String(codigo).trim();
  if (k === "sem_motivo" || k === "sem motivo") return "Sem motivo";
  return MOTIVOS_PERDA[k] ?? humanizarCodigo(k);
}

export function rotuloAutor(codigo: string | null | undefined): string {
  return rotuloDe(ROTULOS_AUTOR, codigo);
}

export function rotuloFunilEntrada(codigo: string | null | undefined): string {
  return rotuloDe(ROTULOS_FUNIL_ENTRADA, codigo);
}

export function rotuloTipoContato(codigo: string | null | undefined): string {
  return rotuloDe(ROTULOS_TIPO_CONTATO, codigo, "Lead");
}

export function rotuloCategoria(codigo: string | null | undefined): string {
  return rotuloDe(ROTULOS_CATEGORIA, codigo, "Lead");
}

export const ROTULOS_STATUS_OPP: Record<string, string> = {
  aberta: "Aberta",
  ganha: "Ganha",
  perdida: "Perdida",
};

export function rotuloStatusOpp(codigo: string | null | undefined): string {
  return rotuloDe(ROTULOS_STATUS_OPP, codigo, "");
}

/** Cabeçalho da ficha: etapa + status reais, não o par fixo Lead · Em conversa. */
export function rotuloFichaCabecalho(opts: {
  etapaNome?: string | null;
  status?: string | null;
}): string {
  const etapa = String(opts.etapaNome ?? "").trim();
  const status = rotuloStatusOpp(opts.status);
  if (etapa && status) return `${etapa} · ${status}`;
  if (etapa) return etapa;
  if (status) return status;
  return "Sem oportunidade";
}
