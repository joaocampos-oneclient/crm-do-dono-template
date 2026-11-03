/**
 * Escolhe o repositório:
 *  - NEXT_PUBLIC_API_URL definido → servidor HTTP
 *  - senão → localStorage (modo demo, zero config)
 */
import { criarRepositorioHttp } from "./http";
import { criarRepositorioLocal } from "./local";
import type { RepositorioCRM } from "./index";

export function criarRepositorio(): RepositorioCRM {
  const api = process.env.NEXT_PUBLIC_API_URL;
  const chave = process.env.NEXT_PUBLIC_API_KEY ?? "";
  if (api) return criarRepositorioHttp(api, chave);
  if (typeof window === "undefined") {
    throw new Error("criarRepositorio() no servidor exige NEXT_PUBLIC_API_URL ou uso só no cliente.");
  }
  return criarRepositorioLocal(window.localStorage);
}
