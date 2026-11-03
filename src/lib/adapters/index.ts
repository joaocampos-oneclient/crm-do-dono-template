/**
 * Adaptadores de integração. Em produção: WhatsApp (WAHA), e-mail (Resend), ligação (Twilio).
 * Sem chaves, tudo é simulado.
 */
import type { Ligacao, Termometro, TrechoLigacao } from "@/domain/types";

export type ResultadoEnvio = { ok: true; id: string } | { ok: false; erro: string };

const trechosDemo = (nome: string, dor?: string): TrechoLigacao[] => [
  { quem: "vendedor", texto: `Oi ${nome}, obrigado por atender.`, hora: "00:00", marca: null },
  { quem: "contato", texto: dor ? `Minha maior dor é ${dor}.` : "Quero entender melhor.", hora: "00:20", marca: "dor" },
  { quem: "vendedor", texto: "Qual a meta para os próximos 90 dias?", hora: "01:10", marca: "meta" },
  { quem: "contato", texto: "Quero decidir ainda este mês.", hora: "02:00", marca: "prazo" },
];

export const adapters = {
  async enviarWhatsApp(_para: string, _texto: string): Promise<ResultadoEnvio> {
    return { ok: true, id: `sim-${Date.now()}` };
  },
  async enviarEmail(_para: string, _assunto: string, _html: string): Promise<ResultadoEnvio> {
    return { ok: true, id: `sim-email-${Date.now()}` };
  },
  telefonia: {
    async ligar(_para: string, _opts?: { avisoDeGravacao?: boolean }): Promise<ResultadoEnvio> {
      return { ok: true, id: `sim-call-${Date.now()}` };
    },
  },
  transcricao: {
    async transcrever(
      _audioId: string,
      ctx: { nome: string; dor?: string; segmento?: string },
    ): Promise<{ trechos: TrechoLigacao[]; followups: Ligacao["followups"]; leituraIa: string; termometroIA: Termometro; resumo: string }> {
      return {
        trechos: trechosDemo(ctx.nome, ctx.dor),
        followups: [
          { texto: "Enviar resumo da ligação", quando: "hoje", origem: "trecho de dor" },
          { texto: "Marcar briefing", quando: "amanhã 10h", origem: "trecho de prazo" },
        ],
        leituraIa: "Contato engajado, com dor clara e prazo este mês. Termômetro sugerido: quente.",
        termometroIA: "quente" as const,
        resumo: "Ligação produtiva: dor clara, prazo este mês.",
      };
    },
  },
};
