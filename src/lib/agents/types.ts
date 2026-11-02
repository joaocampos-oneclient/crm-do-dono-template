import { z } from "zod";

export const ModoAgente = z.enum(["sugerir", "perguntar", "automatico"]);
export type ModoAgente = z.infer<typeof ModoAgente>;

export const AgenteSlug = z.enum(["claudio", "scout", "scribe", "ledger", "pilot", "eco"]);
export type AgenteSlug = z.infer<typeof AgenteSlug>;

export const ExecucaoEntrada = z.object({
  contatoId: z.string().optional(),
  oportunidadeId: z.string().optional(),
  contexto: z.record(z.unknown()).default({}),
});
export type ExecucaoEntrada = z.infer<typeof ExecucaoEntrada>;

export const ExecucaoSaida = z.object({
  resumo: z.string(),
  acaoSugerida: z.string().optional(),
  requerAprovacao: z.boolean().default(true),
  payload: z.record(z.unknown()).default({}),
});
export type ExecucaoSaida = z.infer<typeof ExecucaoSaida>;

export type ResultadoAgente = {
  saida: ExecucaoSaida;
  custoTokens: number;
  usadoJev: boolean;
};
