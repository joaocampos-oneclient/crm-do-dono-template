/**
 * Repositório: onde o estado mora. O CRM fala só com esta interface.
 *
 *  - `local`: localStorage do navegador (padrão; roda sem servidor e sem banco).
 *  - `http`: servidor local em server/ (API + arquivo JSON), quando VITE_API_URL está definido.
 *  - `supabase`: ainda não existe. docs/banco-de-dados.md explica como escrever um seguindo esta interface.
 *
 * Toda mudança é um Comando (src/domain/comandos.ts). O repositório só aplica e persiste.
 */
import type { Comando } from "../domain/comandos";
import type { EstadoCRM } from "../domain/types";

export interface RepositorioCRM {
  origem: "local" | "http";
  carregar(): Promise<EstadoCRM>;
  despachar(comando: Comando): Promise<EstadoCRM>;
  /** Avisa quando o estado mudou por fora (outra aba, webhook no servidor). */
  assinar(cb: (estado: EstadoCRM) => void): () => void;
}

export const gerarId = (): string => {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

export const agoraIso = () => new Date().toISOString();
