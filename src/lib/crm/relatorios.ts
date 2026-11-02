/** Tipos de relatório alinhados ao CRM v3 de produção (Hoje / Placar). */

export type TipoMetaDiaria = "vendas_dia" | "conversas_dia" | "ofertas_dia" | "max_dias_sem_fechar";

export type Contagem = {
  vendas: number;
  conversas: number;
  ofertas: number;
};

export type LinhaTaxa = {
  etapaId: string;
  de: string;
  para: string;
  real: number | null;
  meta: number | null;
  baseline: number | null;
  n: number;
};

export interface Relatorio {
  geradoEm: string;
  janelaDias: number;
  hoje: Contagem;
  mes: Contagem;
  metas: Record<TipoMetaDiaria, number | null>;
  diasSemFechar: number | null;
  vendasDoMes: { n: number; receitaCentavos: number; maduras?: number; emGarantia?: number };
  previsao: { fimDoMes: number | null; receitaCentavos?: number | null };
  taxas: LinhaTaxa[];
  conta: { leadsPorDia: number | null };
  parado: Array<{ etapaId: string; nome: string; cards: number; minutos: number | null }>;
  perdas: Array<{ motivo: string; total: number }>;
  vendasDiretasDoMes: number;
  vendasNoFunilDoMes: number;
  comissao: null;
}
