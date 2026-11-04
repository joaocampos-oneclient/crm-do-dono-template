import type { NextRequest } from "next/server";

/**
 * Autorização das rotas automáticas dos agentes (tick do Pilot, log).
 * Mesmo esquema do tick do Reciclador: `Authorization: Bearer $CRON_SECRET`.
 * Sem CRON_SECRET: liberado só fora de produção (demo local); em produção, nega.
 * POST do mesmo domínio (botão na UI) também passa quando há CRON_SECRET.
 */
export function requisicaoAgentesAutorizada(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) return process.env.NODE_ENV !== "production";

  if ((req.headers.get("authorization") ?? "") === `Bearer ${cronSecret}`) return true;

  if (req.method === "POST") {
    if (req.headers.get("sec-fetch-site") === "same-origin") return true;
    const host = req.headers.get("host");
    const origin = req.headers.get("origin");
    const referer = req.headers.get("referer");
    if (host && ((origin && origin.includes(host)) || (referer && referer.includes(host)))) return true;
  }
  return false;
}
