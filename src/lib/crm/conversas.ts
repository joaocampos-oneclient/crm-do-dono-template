/** Tipos de conversa v3 (sem I/O). */
import type { NivelAlerta, TipoOcorrencia } from "@/lib/crm/conversas-dominio";

export type Modo = "claudio" | "humano";
export type Autor = "lead" | "claudio" | "team" | "sistema";

export interface ConversaResumo {
  contatoId: string;
  nome: string;
  empresa: string | null;
  ultimaTexto: string;
  ultimaEm: string;
  ultimaAutor: Autor;
  modo: Modo;
  responsavelNome: string | null;
  handoff: { abertoEm: string; nivel: NivelAlerta | null; slaAte: string | null } | null;
}

export interface MensagemView {
  id: string;
  autor: Autor;
  direcao: "in" | "out";
  texto: string;
  midia: { tipo: string; duracao_s?: number; transcricao?: string } | null;
  aviso: boolean;
  em: string;
  ocorrencias: TipoOcorrencia[];
}

export interface HandoffView {
  abertoEm: string;
  nivel: NivelAlerta | null;
  slaAte: string | null;
  nota: number | null;
  faixa: string | null;
  oQueFalta: string | null;
  motivo: string | null;
  humanoDestino: string | null;
  status: string;
}

export interface ResponsavelView {
  id: string;
  nome: string;
}

export interface ConversaDetalhe {
  contato: { id: string; nome: string; empresa: string | null };
  modo: Modo;
  desde: string | null;
  responsavel: ResponsavelView | null;
  mensagens: MensagemView[];
  handoff: HandoffView | null;
}
