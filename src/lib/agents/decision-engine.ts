/**
 * DecisionEngine: Jev (token próprio) com fallback para Haiku/regras.
 * Sem token, o CRM roda e avisa no Hoje.
 */
import { z } from "zod";

export const DecisaoSchema = z.object({
  rotulo: z.string(),
  confianca: z.number().min(0).max(1),
  acao: z.enum(["aguardar", "retomar", "handoff", "nutrir", "ignorar"]),
  porque: z.string(),
});
export type Decisao = z.infer<typeof DecisaoSchema>;

export type DecisionInput = {
  textoConversas: string;
  minutosSilencio: number;
  nota: number | null;
  pediuPreco?: boolean;
  pediuHumano?: boolean;
};

export function temJev(): boolean {
  return Boolean(process.env.JEV_API_KEY || process.env.TYPESAFE_JEV_TOKEN);
}

/**
 * Classificador determinístico (substitui Jev quando não há token).
 * Regras simples e auditáveis — nunca fala preço, nunca fecha.
 */
export function decidirLocal(input: DecisionInput): Decisao & { usadoJev: boolean } {
  if (input.pediuHumano || input.pediuPreco || (input.nota !== null && input.nota >= 9)) {
    return {
      rotulo: "momento de compra",
      confianca: 0.9,
      acao: "handoff",
      porque: "Pedido de humano/preço ou nota 9–10.",
      usadoJev: false,
    };
  }
  if (input.minutosSilencio >= 60 * 24 && input.minutosSilencio < 60 * 72) {
    return {
      rotulo: "silêncio retomável",
      confianca: 0.7,
      acao: "retomar",
      porque: "Silêncio entre 1 e 3 dias — Scout sugere retomada.",
      usadoJev: false,
    };
  }
  if (input.minutosSilencio >= 60 * 72) {
    return {
      rotulo: "frio",
      confianca: 0.6,
      acao: "nutrir",
      porque: "Silêncio longo — nutrir, não pressionar.",
      usadoJev: false,
    };
  }
  if (/comprar|fechar|parcel|desconto|entrar agora/i.test(input.textoConversas)) {
    return {
      rotulo: "intenção alta",
      confianca: 0.85,
      acao: "handoff",
      porque: "Sinais de compra no texto.",
      usadoJev: false,
    };
  }
  return {
    rotulo: "acompanhar",
    confianca: 0.5,
    acao: "aguardar",
    porque: "Sem sinal forte ainda.",
    usadoJev: false,
  };
}

/** Chama Jev se houver token; senão usa regras locais. */
export async function decidir(input: DecisionInput): Promise<Decisao & { usadoJev: boolean }> {
  if (!temJev()) return decidirLocal(input);
  try {
    const base = process.env.JEV_API_URL ?? "https://api.typesafe.ai";
    const key = process.env.JEV_API_KEY || process.env.TYPESAFE_JEV_TOKEN!;
    const res = await fetch(`${base}/v1/decide`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ task: "crm-scout", input }),
    });
    if (!res.ok) return decidirLocal(input);
    const json = await res.json();
    const parsed = DecisaoSchema.safeParse(json);
    if (!parsed.success) return decidirLocal(input);
    return { ...parsed.data, usadoJev: true };
  } catch {
    return decidirLocal(input);
  }
}
