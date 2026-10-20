import type { Contato } from "../domain/types";

export interface Ctx {
  contatos: Contato[];
  atualizar: (id: string, fn: (c: Contato) => Contato) => void;
  abrir: (id: string) => void;
  aberto: string | null;
  fechar: () => void;
  aviso: (texto: string) => void;
}
