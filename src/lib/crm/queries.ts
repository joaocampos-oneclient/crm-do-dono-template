/**
 * Tipos de view-model do CRM v3 (portados do ia-para-donos).
 * Sem I/O — o template alimenta via adapters a partir de EstadoCRM.
 */
import type { Categoria, EtapaInfo, TaxaEtapa } from "@/lib/crm/domain";
import type { TipoContato } from "@/lib/crm/tipo-contato";

export type { EtapaInfo };

export interface CardFunil {
  id: string;
  etapaId: string;
  etapaDesde: string;
  contatoId: string;
  contatoNome: string;
  empresa: string | null;
  nota: number | null;
  valorCentavos: number;
  proximaAcao: string | null;
  bateuNaTrave: boolean;
  dono: "claudio" | "otavio";
}

export interface TaxasFunil {
  janelaDias: number;
  real: TaxaEtapa[];
  baseline: TaxaEtapa[];
}

export interface ContatoLinha {
  id: string;
  nome: string;
  empresa: string | null;
  whatsapp: string | null;
  email: string | null;
  origem: string | null;
  dono: "claudio" | "otavio";
  tipo: TipoContato;
  categoria: Categoria;
  criadoEm: string;
}

export type FiltroTipoContato = TipoContato | "todos";

export function filtroTipoContato(v: unknown): FiltroTipoContato {
  if (v === "todos") return "todos";
  return v === "cliente" ? "cliente" : "lead";
}

export interface Hoje {
  tarefas: Array<{
    id: string;
    titulo: string;
    vence_em: string | null;
    contato: { id: string; nome: string } | null;
  }>;
  paradas: Array<{
    id: string;
    contatoId: string;
    contatoNome: string;
    etapaNome: string;
    etapaSlug: string;
    minutos: number;
  }>;
  handoffsPendentes: Array<{ id: string; nome: string; desde: string; slaAte: string | null }>;
}

export interface Demanda {
  dias: number;
  porOrigem: Array<{ origem: string; n: number }>;
  porDia: Array<{ dia: string; n: number }>;
  total: number;
}
