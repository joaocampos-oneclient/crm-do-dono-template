/**
 * Repositório HTTP: fala com o servidor local (server/api.ts) ou com o mesmo servidor publicado.
 * O estado continua o mesmo; só muda onde ele mora (arquivo JSON do servidor, depois banco).
 * A chave vai no header x-api-key. Use uma chave de escopo "escrita" para o CRM.
 */
import type { Comando } from "../domain/comandos";
import type { EstadoCRM } from "../domain/types";
import type { RepositorioCRM } from "./index";

export function criarRepositorioHttp(baseUrl: string, chave: string, opts: { intervaloMs?: number } = {}): RepositorioCRM {
  const url = baseUrl.replace(/\/$/, "");
  const ouvintes = new Set<(e: EstadoCRM) => void>();
  let ultimaVersao = "";
  let timer: ReturnType<typeof setInterval> | null = null;

  const pedir = async <T,>(caminho: string, init?: RequestInit): Promise<T> => {
    const r = await fetch(`${url}${caminho}`, { ...init, headers: { "content-type": "application/json", "x-api-key": chave, ...(init?.headers ?? {}) } });
    if (!r.ok) {
      const corpo = await r.json().catch(() => ({}));
      throw new Error((corpo as { erro?: string }).erro ?? `Erro ${r.status} em ${caminho}`);
    }
    return r.json() as Promise<T>;
  };

  const ligarPolling = () => {
    if (timer || !ouvintes.size) return;
    timer = setInterval(async () => {
      try {
        const { versao } = await pedir<{ versao: string }>("/api/versao");
        if (versao !== ultimaVersao) {
          ultimaVersao = versao;
          const e = await pedir<EstadoCRM>("/api/estado");
          ouvintes.forEach((cb) => cb(e));
        }
      } catch { /* servidor fora: tenta de novo no próximo tique */ }
    }, opts.intervaloMs ?? 4000);
  };

  return {
    origem: "http",
    async carregar() {
      const e = await pedir<EstadoCRM>("/api/estado");
      ultimaVersao = await pedir<{ versao: string }>("/api/versao").then((v) => v.versao).catch(() => "");
      return e;
    },
    async despachar(comando: Comando) {
      const r = await pedir<{ estado: EstadoCRM; versao: string }>("/api/comandos", { method: "POST", body: JSON.stringify(comando) });
      ultimaVersao = r.versao;
      return r.estado;
    },
    assinar(cb) {
      ouvintes.add(cb);
      ligarPolling();
      return () => { ouvintes.delete(cb); if (!ouvintes.size && timer) { clearInterval(timer); timer = null; } };
    },
  };
}
