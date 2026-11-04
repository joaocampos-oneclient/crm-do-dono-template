/**
 * Schemas (zod) da saída JSON do LLM, um por agente.
 * Saída fora do schema nunca é "consertada" com String(undefined): o agente descarta
 * e cai nas regras locais, marcando `payload.llmInvalido = true`.
 */
import { z } from "zod";

const texto = z.string().trim().min(1);
const textoOpcional = z.string().trim().optional();

export const ClaudioSaidaSchema = z
  .object({
    bloqueado: z.boolean().default(false),
    motivo: textoOpcional,
    texto: textoOpcional,
    resumo: textoOpcional,
    acaoSugerida: textoOpcional,
  })
  .refine((v) => v.bloqueado || Boolean(v.texto), { message: "texto obrigatório quando não bloqueado" });

export const ScoutSaidaSchema = z.object({
  rotulo: texto,
  confianca: z.number().min(0).max(1),
  acao: z.enum(["aguardar", "retomar", "handoff", "nutrir", "ignorar"]),
  porque: texto,
  resumo: textoOpcional,
  acaoSugerida: textoOpcional,
  proximoPasso: textoOpcional,
});

export const ScribeSaidaSchema = z.object({
  resumo: texto,
  followups: z.array(z.string()).default([]),
  acaoSugerida: textoOpcional,
});

export const LedgerSaidaSchema = z.object({
  risco: z.boolean(),
  resumo: texto,
  acaoSugerida: textoOpcional,
});

export const PilotSaidaSchema = z.object({
  texto: texto,
  resumo: textoOpcional,
  acaoSugerida: textoOpcional,
});

export const EcoSaidaSchema = z.object({
  briefing: texto,
  resumo: textoOpcional,
  acaoSugerida: textoOpcional,
});

export type ClaudioSaida = z.infer<typeof ClaudioSaidaSchema>;
export type ScoutSaida = z.infer<typeof ScoutSaidaSchema>;
export type ScribeSaida = z.infer<typeof ScribeSaidaSchema>;
export type LedgerSaida = z.infer<typeof LedgerSaidaSchema>;
export type PilotSaida = z.infer<typeof PilotSaidaSchema>;
export type EcoSaida = z.infer<typeof EcoSaidaSchema>;

/** Valida o JSON do LLM; null se inválido (nunca lança). */
export function validarSaida<T extends z.ZodTypeAny>(schema: T, json: unknown): z.infer<T> | null {
  if (!json || typeof json !== "object") return null;
  const r = schema.safeParse(json);
  return r.success ? r.data : null;
}
