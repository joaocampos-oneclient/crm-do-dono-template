/**
 * Registro local das decisões automáticas dos agentes + marcadores de handoff (modo demo / single-node).
 * Arquivos em `data/` (ignorado pelo Git). Diretório pode ser trocado com AGENTES_DATA_DIR.
 * Privacidade: só telefone mascarado e os primeiros 80 caracteres do texto.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { mascararTelefoneReciclador } from "@/domain/reciclador";

export type TipoDecisaoAgente = "responder" | "handoff" | "silenciar" | "sugerir" | "enviar";

export interface EntradaLogAgente {
  id: string;
  em: string;
  origem: "auto-atendimento" | "pilot";
  decisao: TipoDecisaoAgente;
  motivo: string;
  telefone: string;
  trecho?: string;
}

const MAX_LOG = 500;

export function agentesDataDir(): string {
  return process.env.AGENTES_DATA_DIR?.trim() || resolve(process.cwd(), "data");
}

function arquivoLog(): string {
  return resolve(agentesDataDir(), "agentes-log.json");
}

function arquivoEstado(): string {
  return resolve(agentesDataDir(), "agentes-estado.json");
}

function lerJson<T>(file: string, vazio: T): T {
  try {
    if (!existsSync(file)) return vazio;
    return JSON.parse(readFileSync(file, "utf8")) as T;
  } catch {
    return vazio;
  }
}

function gravarJson(file: string, valor: unknown): void {
  mkdirSync(agentesDataDir(), { recursive: true });
  writeFileSync(file, JSON.stringify(valor, null, 2));
}

export function registrarDecisaoAgente(opts: {
  origem: EntradaLogAgente["origem"];
  decisao: TipoDecisaoAgente;
  motivo: string;
  telefone: string;
  texto?: string;
  em?: string;
}): EntradaLogAgente {
  const entrada: EntradaLogAgente = {
    id: crypto.randomUUID(),
    em: opts.em ?? new Date().toISOString(),
    origem: opts.origem,
    decisao: opts.decisao,
    motivo: opts.motivo,
    telefone: mascararTelefoneReciclador(opts.telefone),
    ...(opts.texto ? { trecho: opts.texto.slice(0, 80) } : {}),
  };
  try {
    const atual = lerJson<EntradaLogAgente[]>(arquivoLog(), []);
    atual.push(entrada);
    gravarJson(arquivoLog(), atual.slice(-MAX_LOG));
  } catch (e) {
    console.warn("[agentes/log]", e instanceof Error ? e.message : e);
  }
  return entrada;
}

export function lerLogAgentes(limite = 100): EntradaLogAgente[] {
  const todos = lerJson<EntradaLogAgente[]>(arquivoLog(), []);
  const n = Math.max(1, Math.min(MAX_LOG, Math.floor(limite) || 100));
  return todos.slice(-n).reverse();
}

type Estado = { handoffs: Record<string, string> };

const chaveTelefone = (digits: string) => digits.replace(/\D/g, "").slice(-11);

/** Marca (modo local) que o contato está esperando um humano. */
export function marcarHandoffLocal(phoneDigits: string, em: string): void {
  try {
    const est = lerJson<Estado>(arquivoEstado(), { handoffs: {} });
    est.handoffs[chaveTelefone(phoneDigits)] = em;
    gravarJson(arquivoEstado(), est);
  } catch (e) {
    console.warn("[agentes/estado]", e instanceof Error ? e.message : e);
  }
}

export function handoffLocalDesde(phoneDigits: string): string | null {
  const est = lerJson<Estado>(arquivoEstado(), { handoffs: {} });
  return est.handoffs[chaveTelefone(phoneDigits)] ?? null;
}
