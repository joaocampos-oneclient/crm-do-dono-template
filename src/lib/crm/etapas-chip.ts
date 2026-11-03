/**
 * Índice do StageChip. Puro, sem "use client" — a ficha (RSC) precisa chamar isto
 * no servidor. crm-ui.tsx é client e não pode exportar função para o server.
 */
import { ETAPA_SLUGS, type EtapaSlug } from "@/lib/crm/domain";

export const STAGE_SLUGS = ETAPA_SLUGS;
export type StageIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export function indiceEtapa(slug: string | null | undefined): StageIndex {
  const i = (ETAPA_SLUGS as readonly string[]).indexOf(slug ?? "");
  return (i >= 0 && i <= 7 ? i : 0) as StageIndex;
}

/** Join PostgREST pode vir array, null ou incompleto — a ficha não pode quebrar. */
export function etapaFichaOuPadrao(etapa: unknown): {
  slug: EtapaSlug;
  nome: string;
  ordem: number;
  motivos_perda: string[];
  validacao?: string;
} {
  const raw = Array.isArray(etapa) ? etapa[0] : etapa;
  if (raw && typeof raw === "object") {
    const e = raw as Record<string, unknown>;
    const slug = typeof e.slug === "string" ? e.slug : "";
    if ((ETAPA_SLUGS as readonly string[]).includes(slug) && typeof e.nome === "string") {
      return {
        slug: slug as EtapaSlug,
        nome: e.nome,
        ordem: typeof e.ordem === "number" ? e.ordem : indiceEtapa(slug) + 1,
        motivos_perda: Array.isArray(e.motivos_perda) ? e.motivos_perda.filter((m): m is string => typeof m === "string") : [],
        validacao: typeof e.validacao === "string" ? e.validacao : undefined,
      };
    }
  }
  return { slug: "novo", nome: "Lead novo", ordem: 1, motivos_perda: [] };
}
