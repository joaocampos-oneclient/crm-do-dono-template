/**
 * Escolhe o repositório pelo ambiente:
 *  - VITE_API_URL definido -> servidor (server/), com VITE_API_KEY.
 *  - senão -> localStorage.
 */
import { criarRepositorioHttp } from "./http";
import { criarRepositorioLocal } from "./local";
import type { RepositorioCRM } from "./index";

export function criarRepositorio(): RepositorioCRM {
  const api = import.meta.env.VITE_API_URL as string | undefined;
  const chave = (import.meta.env.VITE_API_KEY as string | undefined) ?? "";
  if (api) return criarRepositorioHttp(api, chave);
  const canal = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("crm-do-dono") : null;
  return criarRepositorioLocal(window.localStorage, { canal });
}
