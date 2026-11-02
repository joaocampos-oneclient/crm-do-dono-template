/**
 * Notificações in-app mínimas do CRM v3.
 * Derivadas de handoff aberto e card parado — sem tabela nova (crm_notificacoes fica no PR-O).
 */
import type { Hoje } from "@/lib/crm/queries";
import { nomeEmExibicao } from "@/lib/crm/format";

export type NotificacaoInApp = {
  tipo: "handoff" | "parado";
  titulo: string;
  url: string;
};

export type GrupoParado = {
  etapaNome: string;
  etapaSlug: string;
  n: number;
  itens: Hoje["paradas"];
};

export function notificacoesInApp(hoje: Pick<Hoje, "handoffsPendentes" | "paradas">): NotificacaoInApp[] {
  const handoffs = hoje.handoffsPendentes.map((h) => ({
    tipo: "handoff" as const,
    titulo: `Handoff: ${nomeEmExibicao(h.nome)}`,
    url: `/conversas?c=${h.id}`,
  }));
  return handoffs;
}

/** Agrupa cards parados pela etapa real (slug), não por um índice de chip. */
export function agruparParados(paradas: Hoje["paradas"]): GrupoParado[] {
  const mapa = new Map<string, GrupoParado>();
  for (const p of paradas) {
    const chave = p.etapaSlug || p.etapaNome;
    const g = mapa.get(chave);
    if (g) {
      g.n += 1;
      g.itens.push(p);
    } else {
      mapa.set(chave, { etapaNome: p.etapaNome, etapaSlug: p.etapaSlug, n: 1, itens: [p] });
    }
  }
  return [...mapa.values()].sort((a, b) => b.n - a.n);
}
