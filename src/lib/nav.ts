/**
 * Navegação Desktop v2 / Mobile 2 (decisões D1–D6).
 * Desktop: sidebar em 3 grupos. Mobile: Hoje · Funil · Conversas · Leads · Mais.
 */
import type { Tela } from "@/components/crm/provider";
export { TELA_PADRAO } from "@/components/crm/provider";

export type NavDef = { id: Tela; label: string; grupo: "Operação" | "Gestão" | "Configuração" };

/** Ordem e grupos do Desktop v2. */
export const NAV_DESKTOP: NavDef[] = [
  { id: "hoje", label: "Hoje", grupo: "Operação" },
  { id: "funil", label: "Funil", grupo: "Operação" },
  { id: "conversas", label: "Conversas", grupo: "Operação" },
  { id: "contatos", label: "Contatos", grupo: "Operação" },
  { id: "relance", label: "Relance", grupo: "Operação" },
  { id: "agentes", label: "Agentes", grupo: "Operação" },
  { id: "demandas", label: "Demandas", grupo: "Gestão" },
  { id: "relatorios", label: "Relatórios", grupo: "Gestão" },
  { id: "ocorrencias", label: "Ocorrências", grupo: "Gestão" },
  { id: "playbook", label: "Playbook", grupo: "Configuração" },
  { id: "produtos", label: "Produtos e funis", grupo: "Configuração" },
  { id: "operadores", label: "Operadores e chaves", grupo: "Configuração" },
  { id: "templates", label: "Templates", grupo: "Configuração" },
  { id: "integracoes", label: "Integrações", grupo: "Configuração" },
];

/** Abas Mobile 2 (5 itens). "contatos" aparece como Leads; "mais" abre o sheet. */
export const NAV_MOBILE_PRIMARY: { id: Tela | "mais"; label: string }[] = [
  { id: "hoje", label: "Hoje" },
  { id: "funil", label: "Funil" },
  { id: "conversas", label: "Conversas" },
  { id: "contatos", label: "Leads" },
  { id: "mais", label: "Mais" },
];

export const NAV_MOBILE_PRIMARY_IDS: Tela[] = ["hoje", "funil", "conversas", "contatos"];

export function telaNoMais(tela: Tela): boolean {
  return !NAV_MOBILE_PRIMARY_IDS.includes(tela);
}
