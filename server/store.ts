/**
 * Store do servidor: o mesmo EstadoCRM, persistido num arquivo JSON (server/data/crm.json).
 * Um processo, um arquivo, escritas em fila. É o suficiente para uma operação pequena rodando local.
 * Para multiusuário e escala, troque por Postgres/Supabase seguindo docs/banco-de-dados.md:
 * a interface (carregar / despachar / versao) continua a mesma.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync, renameSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { estadoExemplo } from "../src/data/exemplo";
import { aplicar, type Comando } from "../src/domain/comandos";
import { ESTADO_VERSAO, type EstadoCRM } from "../src/domain/types";

export interface Store {
  estado(): EstadoCRM;
  versao(): string;
  despachar(cmd: Comando): Promise<EstadoCRM>;
  caminho: string | null;
}

export function criarStore(caminho: string | null, seed: () => EstadoCRM = () => estadoExemplo(new Date().toISOString())): Store {
  let estado: EstadoCRM;
  let versao = 0;
  let fila: Promise<unknown> = Promise.resolve();

  if (caminho && existsSync(caminho)) {
    try {
      const lido = JSON.parse(readFileSync(caminho, "utf8")) as EstadoCRM;
      estado = lido.versao === ESTADO_VERSAO ? lido : seed();
    } catch { estado = seed(); }
  } else {
    estado = seed();
  }
  const gravar = () => {
    if (!caminho) return;
    mkdirSync(dirname(caminho), { recursive: true });
    const tmp = `${caminho}.tmp`;
    writeFileSync(tmp, JSON.stringify(estado, null, 2));
    renameSync(tmp, caminho);
  };
  gravar();

  return {
    caminho,
    estado: () => estado,
    versao: () => String(versao),
    despachar(cmd) {
      const p = fila.then(() => {
        estado = aplicar(estado, cmd, { agora: new Date().toISOString(), novoId: randomUUID });
        versao += 1;
        gravar();
        return estado;
      });
      fila = p.catch(() => undefined);
      return p;
    },
  };
}
