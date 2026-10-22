/**
 * Repositório local: guarda o estado inteiro no localStorage.
 * Serve para rodar sem servidor e sem banco. Limites: um navegador, ~5 MB, sem multiusuário.
 * Quando passar disso, suba o servidor (server/) ou ligue o Supabase (docs/banco-de-dados.md).
 */
import { estadoExemplo } from "../data/exemplo";
import { aplicar, type Comando } from "../domain/comandos";
import { ESTADO_VERSAO, type EstadoCRM } from "../domain/types";
import { agoraIso, gerarId, type RepositorioCRM } from "./index";

export const CHAVE_ESTADO = "crm-do-dono:estado";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function criarRepositorioLocal(storage: StorageLike, opts: { seed?: () => EstadoCRM; canal?: BroadcastChannel | null } = {}): RepositorioCRM {
  const seed = opts.seed ?? (() => estadoExemplo(agoraIso()));
  const ouvintes = new Set<(e: EstadoCRM) => void>();
  let cache: EstadoCRM | null = null;

  const ler = (): EstadoCRM => {
    if (cache) return cache;
    try {
      const bruto = storage.getItem(CHAVE_ESTADO);
      if (bruto) {
        const e = JSON.parse(bruto) as EstadoCRM;
        if (e.versao === ESTADO_VERSAO) { cache = e; return e; }
      }
    } catch { /* storage corrompido: recomeça do exemplo */ }
    cache = seed();
    storage.setItem(CHAVE_ESTADO, JSON.stringify(cache));
    return cache;
  };

  const gravar = (e: EstadoCRM) => {
    cache = e;
    storage.setItem(CHAVE_ESTADO, JSON.stringify(e));
    opts.canal?.postMessage("mudou");
  };

  opts.canal?.addEventListener("message", () => {
    cache = null;
    const e = ler();
    ouvintes.forEach((cb) => cb(e));
  });

  return {
    origem: "local",
    async carregar() { return ler(); },
    async despachar(comando: Comando) {
      const novo = aplicar(ler(), comando, { agora: agoraIso(), novoId: gerarId });
      gravar(novo);
      return novo;
    },
    assinar(cb) { ouvintes.add(cb); return () => ouvintes.delete(cb); },
  };
}

/** Apaga tudo e volta ao exemplo. Use com cuidado. */
export function apagarEstadoLocal(storage: StorageLike) {
  storage.removeItem(CHAVE_ESTADO);
}
