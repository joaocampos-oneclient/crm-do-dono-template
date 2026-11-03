export const CRM_MCP_NIVEIS = ["leitura", "escrita", "admin"] as const;
export type CrmMcpNivel = (typeof CRM_MCP_NIVEIS)[number];

export const ROTULO_NIVEL: Record<CrmMcpNivel, string> = {
  leitura: "Só leitura",
  escrita: "Leitura + mudanças (Cursor / GrokBot)",
  admin: "Admin (tokens, operadores, config)",
};

export function nivelValido(v: unknown): v is CrmMcpNivel {
  return typeof v === "string" && (CRM_MCP_NIVEIS as readonly string[]).includes(v);
}

export function nivelPodeEscrever(nivel: CrmMcpNivel): boolean {
  return nivel === "escrita" || nivel === "admin";
}

export function nivelPodeAdmin(nivel: CrmMcpNivel): boolean {
  return nivel === "admin";
}
