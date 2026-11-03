export const TIPOS_CONTATO = ["lead", "cliente"] as const;
export type TipoContato = (typeof TIPOS_CONTATO)[number];

export function tipoContatoValido(v: unknown): TipoContato {
  return v === "cliente" ? "cliente" : "lead";
}
