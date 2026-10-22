/**
 * Contexto do CRM para as telas: estado, operador logado, `despachar` (com erro em toast),
 * relógio compartilhado e navegação por hash (#/funil, #/contatos/c1 ...).
 */
import * as React from "react";
import { useToast } from "../ds";
import { ErroDeRegra, type Comando } from "../domain/comandos";
import type { ContatoCompleto, EstadoCRM, Operador } from "../domain/types";
import { contatosCompletos, montarContato } from "../domain/visao";
import type { RepositorioCRM } from "../repo";

export type Tela = "demandas" | "hoje" | "funil" | "conversas" | "contatos" | "playbook" | "produtos" | "operadores" | "templates" | "relatorios" | "ocorrencias" | "integracoes";
export interface Rota { tela: Tela; id?: string }

const TELAS: Tela[] = ["demandas", "hoje", "funil", "conversas", "contatos", "playbook", "produtos", "operadores", "templates", "relatorios", "ocorrencias", "integracoes"];

export const lerRota = (hash: string): Rota => {
  const [tela, id] = hash.replace(/^#\/?/, "").split("/");
  return { tela: (TELAS as string[]).includes(tela) ? (tela as Tela) : "demandas", id: id || undefined };
};
export const paraHash = (r: Rota) => `#/${r.tela}${r.id ? `/${r.id}` : ""}`;

export interface CRM {
  estado: EstadoCRM;
  agora: string;
  repo: RepositorioCRM;
  operador: Operador | null;
  entrar: (id: string) => void;
  sair: () => void;
  /** Aplica um comando. Em erro de regra mostra o motivo e devolve null; em sucesso devolve o estado novo. */
  despachar: (cmd: Comando, avisoOk?: string) => Promise<EstadoCRM | null>;
  contatos: ContatoCompleto[];
  contato: (id: string) => ContatoCompleto | null;
  rota: Rota;
  navegar: (r: Rota) => void;
  abrirContato: (id: string) => void;
  /** Modais globais: discagem rápida e ligação. */
  ligar: (contatoId: string) => void;
  discar: () => void;
}

const Ctx = React.createContext<CRM | null>(null);
const CHAVE_OPERADOR = "crm-do-dono:operador";

export function useCRM(): CRM {
  const c = React.useContext(Ctx);
  if (!c) throw new Error("useCRM precisa estar dentro de <CRMProvider>.");
  return c;
}

export function CRMProvider({ repo, estadoInicial, children, aoLigar, aoDiscar }: { repo: RepositorioCRM; estadoInicial: EstadoCRM; children: React.ReactNode; aoLigar: (contatoId: string) => void; aoDiscar: () => void }) {
  const toast = useToast();
  const [estado, setEstado] = React.useState(estadoInicial);
  const [agora, setAgora] = React.useState(() => new Date().toISOString());
  const [rota, setRota] = React.useState<Rota>(() => lerRota(window.location.hash));
  const [operadorId, setOperadorId] = React.useState<string | null>(() => window.localStorage.getItem(CHAVE_OPERADOR));

  React.useEffect(() => repo.assinar(setEstado), [repo]);
  React.useEffect(() => {
    const t = setInterval(() => setAgora(new Date().toISOString()), 30000);
    return () => clearInterval(t);
  }, []);
  React.useEffect(() => {
    const on = () => setRota(lerRota(window.location.hash));
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  const navegar = React.useCallback((r: Rota) => { window.location.hash = paraHash(r); }, []);

  const despachar = React.useCallback(async (cmd: Comando, avisoOk?: string) => {
    try {
      const novo = await repo.despachar(cmd);
      setEstado(novo);
      setAgora(new Date().toISOString());
      if (avisoOk) toast.push(avisoOk);
      return novo;
    } catch (e) {
      toast.push(e instanceof ErroDeRegra ? e.message : `Não deu: ${(e as Error).message}`);
      return null;
    }
  }, [repo, toast]);

  const operador = estado.operadores.find((o) => o.id === operadorId && o.ativo && o.tipo === "humano") ?? null;
  const contatos = React.useMemo(() => contatosCompletos(estado), [estado]);

  const valor: CRM = {
    estado, agora, repo, operador,
    entrar: (id) => { window.localStorage.setItem(CHAVE_OPERADOR, id); setOperadorId(id); },
    sair: () => { window.localStorage.removeItem(CHAVE_OPERADOR); setOperadorId(null); },
    despachar,
    contatos,
    contato: (id) => montarContato(estado, id),
    rota, navegar,
    abrirContato: (id) => navegar({ tela: "contatos", id }),
    ligar: aoLigar,
    discar: aoDiscar,
  };
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
