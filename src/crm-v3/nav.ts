import type { IconName, TabId } from "./crm-ui";

export type CrmPapelNav = "gestor" | "vendedor" | "trafego";

export type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: IconName;
  tab?: TabId;
  badgeKey?: "today" | "chat" | "work";
  gestor?: boolean;
};

export const NAV_CASA: NavItem[] = [
  { id: "hoje", label: "Hoje", href: "/", icon: "today", tab: "today", badgeKey: "today" },
  { id: "funil", label: "Funil", href: "/funil", icon: "funnel", tab: "funnel" },
  { id: "conversas", label: "Conversas", href: "/conversas", icon: "chat", tab: "chat", badgeKey: "chat" },
  { id: "leads", label: "Leads", href: "/leads", icon: "leads", tab: "leads" },
  { id: "clientes", label: "Clientes", href: "/clientes", icon: "clients" },
];

export const NAV_TRABALHO: NavItem[] = [
  { id: "trabalho", label: "Trabalho", href: "/trabalho", icon: "work", badgeKey: "work" },
  { id: "agentes", label: "Agentes", href: "/agentes", icon: "agents" },
];

export const NAV_NUMEROS: NavItem[] = [
  { id: "demanda", label: "Demanda", href: "/demanda", icon: "demand" },
  { id: "placar", label: "Placar", href: "/placar", icon: "score" },
  { id: "metas", label: "Metas", href: "/config/metas", icon: "goals", gestor: true },
];

export const NAV_CONFIG: NavItem[] = [
  { id: "sessao", label: "Sessão fechada", href: "/config/sessao-fechada", icon: "work", gestor: true },
  { id: "ocorrencias", label: "Ocorrências", href: "/config/ocorrencias", icon: "bell", gestor: true },
  { id: "integrar", label: "Integrar ao GrokBot", href: "/config/integrar", icon: "agents", gestor: true },
];

export const NAV_TRAFEGO: NavItem[] = [
  { id: "demanda", label: "Demanda", href: "/demanda", icon: "demand" },
  { id: "placar", label: "Placar", href: "/placar", icon: "score" },
];

const MOBILE_TABS: NavItem[] = [
  NAV_CASA[0],
  NAV_CASA[1],
  NAV_CASA[2],
  NAV_CASA[3],
];

export function itensDoPapel(papel: CrmPapelNav): NavItem[] {
  if (papel === "trafego") return NAV_TRAFEGO;
  const all = [...NAV_CASA, ...NAV_TRABALHO, ...NAV_NUMEROS, ...NAV_CONFIG];
  return papel === "gestor" ? all : all.filter((i) => !i.gestor);
}

export function gruposDoPapel(papel: CrmPapelNav): Array<{ id: string; label?: string; itens: NavItem[] }> {
  if (papel === "trafego") return [{ id: "numeros", itens: NAV_TRAFEGO }];
  const cfg = papel === "gestor" ? NAV_CONFIG : [];
  const nums = papel === "gestor" ? NAV_NUMEROS : NAV_NUMEROS.filter((i) => !i.gestor);
  return [
    { id: "casa", itens: NAV_CASA },
    { id: "trabalho", itens: NAV_TRABALHO },
    { id: "numeros", itens: nums },
    ...(cfg.length ? [{ id: "config", label: "Configuração", itens: cfg }] : []),
  ];
}

export function tabsMobile(papel: CrmPapelNav): NavItem[] {
  if (papel === "trafego") return NAV_TRAFEGO;
  return MOBILE_TABS;
}

export function maisMobile(papel: CrmPapelNav): NavItem[] {
  const ids = new Set(tabsMobile(papel).map((i) => i.id));
  return itensDoPapel(papel).filter((i) => !ids.has(i.id));
}

export function idAtivo(itens: NavItem[], pathBruto: string): string {
  const path = pathBruto.replace(/^\/crm(?=\/|$)/, "") || "/";
  if (path === "/") return "hoje";
  const hit = itens
    .filter((i) => i.href !== "/")
    .sort((a, b) => b.href.length - a.href.length)
    .find((i) => path === i.href || path.startsWith(`${i.href}/`));
  return hit?.id ?? "";
}

export const ROTULO_PAPEL: Record<CrmPapelNav, string> = {
  gestor: "gestor",
  vendedor: "vendedor",
  trafego: "tráfego",
};
