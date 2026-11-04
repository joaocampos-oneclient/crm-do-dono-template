/**
 * Contratos compartilhados do Agente Ember / Relance (Reciclador de Oportunidades).
 * Puro TypeScript (zero dependência de runtime/banco/rede).
 */
import type { EtapaId } from "./types";

export type StatusCampanhaReciclador =
  | "rascunho"
  | "ativa"
  | "pausada"
  | "emergencia"
  | "concluida";

export type DecisaoReciclador = "abordar" | "adiar" | "ignorar";

export type StatusItemReciclador =
  | "pendente"
  | "simulado"
  | "enviado"
  | "adiado"
  | "ignorado"
  | "bloqueado"
  | "erro";

export type DestinoAtendimentoReciclador = "claudio" | "humano";

export interface FiltroCampanhaReciclador {
  etapas: EtapaId[];
  /** Horas sem movimento mínimo para considerar na fila (0 = qualquer). */
  horasParadoMin: number;
  apenasComContexto: boolean;
}

export interface FontesCampanhaReciclador {
  usarHistoricoMensagens: boolean;
  usarNotas: boolean;
  /** Conteúdo/blog/materiais colados pelo dono para usar como gancho real. */
  baseConteudo: string;
  /** Novidades/sinais de mercado fornecidos pelo dono (sem busca cega na web no v1). */
  novidadesMercado: string;
  temasProibidos: string[];
}

export interface CercasCampanhaReciclador {
  /** Default true: herda a regra de nunca falar preço/condição na abertura. */
  proibirPreco: boolean;
  tomMarca: string;
  /** Modelo forte dedicado ao Ember (ex.: "claude-sonnet-4-5"). */
  modeloLlm: string;
  entregarPara: DestinoAtendimentoReciclador;
  /** Se true e entregarPara === "claudio", webhook pode disparar resposta automática do Cláudio. */
  autoResponderClaudio: boolean;
}

export interface FreiosCampanhaReciclador {
  maxPorHora: number;
  maxPorDia: number;
  espacamentoSegundos: number;
  /** Hora de início (0–23) no fuso do negócio (default 9). */
  janelaInicioHora: number;
  /** Hora de fim (1–24) no fuso do negócio (default 18). */
  janelaFimHora: number;
  apenasDiasUteis: boolean;
  /** Dias para bloquear quem recusou recentemente. */
  cooldownRecusaDias: number;
}

export interface CampanhaReciclador {
  id: string;
  nome: string;
  objetivo: string;
  status: StatusCampanhaReciclador;
  filtro: FiltroCampanhaReciclador;
  fontes: FontesCampanhaReciclador;
  cercas: CercasCampanhaReciclador;
  freios: FreiosCampanhaReciclador;
  criadaEm: string;
  atualizadaEm: string;
}

export interface ItemFilaReciclador {
  id: string;
  campanhaId: string;
  contatoId: string;
  oportunidadeId: string | null;
  nomeContato: string;
  empresa: string;
  telefone: string;
  telefoneMascarado: string;
  etapaInicial: EtapaId;
  etapaAtual: EtapaId;
  /** Resumo factual extraído do histórico, notas, briefing ou CSV importado. */
  contextoExtraido: string;
  fontesLidas: string[];
  status: StatusItemReciclador;
  decisao: DecisaoReciclador | null;
  motivo: string;
  ganchoIdentificado: string | null;
  mensagemGerada: string | null;
  modeloUsado: string | null;
  custoTokens: number;
  providerWhatsapp: string | null;
  messageIdWhatsapp: string | null;
  criadoEm: string;
  processadoEm: string | null;
  respondeuEm: string | null;
  avancouEtapa: boolean;
  virouVenda: boolean;
}

export interface OptOutRegistro {
  id: string;
  telefoneDigitos: string;
  telefoneMascarado: string;
  contatoId: string | null;
  nomeContato: string | null;
  motivo: "pedido_parar" | "recusa_recente" | "manual";
  evidencia: string;
  tema: string | null;
  registradoEm: string;
  expiraEm: string | null;
}

export interface IncidenteReciclador {
  id: string;
  campanhaId: string | null;
  tipo: "sessao_desconectada" | "erro_envio" | "parada_emergencia" | "rate_limit" | "sem_llm";
  detalhe: string;
  em: string;
}

export interface MetricasCampanhaReciclador {
  totalFila: number;
  pendentes: number;
  simulados: number;
  enviados: number;
  adiados: number;
  ignorados: number;
  bloqueados: number;
  erros: number;
  respostas: number;
  avancosEtapa: number;
  vendasAtribuidas: number;
  /** Formatação honesta: se enviados < 10, retorna "n=X · amostra pequena". */
  taxaRespostaTexto: string;
  taxaAvancoTexto: string;
  motivosBloqueio: Array<{ motivo: string; contagem: number }>;
  incidentes: number;
}

export interface EntradaNovaCampanha {
  nome: string;
  objetivo: string;
  filtro?: Partial<FiltroCampanhaReciclador>;
  fontes?: Partial<FontesCampanhaReciclador>;
  cercas?: Partial<CercasCampanhaReciclador>;
  freios?: Partial<FreiosCampanhaReciclador>;
  popularDoCrm?: boolean;
}

export interface ResultadoImportacaoCsv {
  totalLinhas: number;
  importados: number;
  rejeitadosSemContexto: number;
  rejeitadosTelefoneInvalido: number;
  rejeitadosOptOut: number;
  itensCriadosIds: string[];
  detalhesRejeicao: Array<{ linha: number; nome: string; motivo: string }>;
}

export interface ResultadoSimulacaoReciclador {
  campanhaId: string;
  processados: number;
  itens: ItemFilaReciclador[];
  avisoLlm: string | null;
}

export interface ResultadoTickReciclador {
  executadoEm: string;
  campanhasAvaliadas: number;
  enviados: number;
  ignorados: number;
  adiados: number;
  bloqueados: number;
  erros: number;
  pausadaPorIncidente: boolean;
  motivoPausa?: string;
  itensProcessados: ItemFilaReciclador[];
}
