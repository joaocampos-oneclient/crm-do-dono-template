/**
 * Adaptadores: a porta entre o CRM e o mundo de fora.
 * No template, todos são SIMULADOS (mock). Para ligar o real, crie uma implementação nova
 * (ex.: whatsapp.zapi.ts) com a mesma interface e troque a linha em `adapters` no final.
 * Troque UMA integração por vez e teste antes da próxima.
 */
export interface WhatsAppAdapter {
  enviar(telefone: string, texto: string): Promise<{ ok: boolean; id: string }>;
}

export interface PagamentoAdapter {
  criarLink(opts: { contatoId: string; valor: number; validadeDias: number }): Promise<{ url: string; expiraEm: string }>;
}

export interface TelefoniaAdapter {
  /** Só liga depois do aviso de gravação. */
  ligar(telefone: string, opts: { avisoDeGravacao: true }): Promise<{ ligacaoId: string }>;
}

export interface TranscricaoAdapter {
  transcrever(ligacaoId: string): Promise<{ trechos: { quem: "vendedor" | "contato"; texto: string; hora: string }[] }>;
}

export interface CopilotoAdapter {
  sugerir(contexto: string): Promise<{ titulo: string; porque: string }[]>;
}

export interface Adapters {
  whatsapp: WhatsAppAdapter;
  pagamento: PagamentoAdapter;
  telefonia: TelefoniaAdapter;
  transcricao: TranscricaoAdapter;
  copiloto: CopilotoAdapter;
}

import { mockAdapters } from "./mock";

/** Troque aqui, um por vez: { ...mockAdapters, whatsapp: meuWhatsAppReal } */
export const adapters: Adapters = mockAdapters;
