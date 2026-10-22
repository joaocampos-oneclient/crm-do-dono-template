/**
 * Adaptadores do NAVEGADOR: a porta entre as telas e o mundo de fora (telefonia, transcrição).
 * No template são SIMULADOS (mock.ts). As integrações de servidor (WhatsApp, e-mail, pagamento)
 * ficam em server/adapters/, porque precisam de segredo e não podem rodar no navegador.
 * Troque UMA integração por vez e teste antes da próxima.
 */
import type { Termometro, TrechoLigacao } from "../domain/types";

export interface TelefoniaAdapter {
  /** Só liga depois do aviso de gravação. */
  ligar(telefone: string, opts: { avisoDeGravacao: true }): Promise<{ ligacaoId: string }>;
}

export interface TranscricaoAdapter {
  transcrever(ligacaoId: string, contexto: { nome: string; dor?: string; segmento?: string }): Promise<{
    trechos: TrechoLigacao[];
    resumo: string;
    termometroIA: Termometro;
    followups: { texto: string; quando: string }[];
  }>;
}

export interface Adapters {
  telefonia: TelefoniaAdapter;
  transcricao: TranscricaoAdapter;
}

import { mockAdapters } from "./mock";

/** Troque aqui, um por vez: { ...mockAdapters, telefonia: minhaTelefoniaReal } */
export const adapters: Adapters = mockAdapters;
