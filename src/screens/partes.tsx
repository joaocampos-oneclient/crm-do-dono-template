/** Peças pequenas compartilhadas pelas telas. */
import * as React from "react";
import { Avatar, Badge, Orb, Tooltip } from "../ds";
import { etapaDe } from "../domain/funil";
import { estourouPrazo, formatarTempo, minutosNaEtapa } from "../domain/rules";
import type { ContatoCompleto, EstadoCRM, Oportunidade, Termometro } from "../domain/types";
import { useCRM } from "../app/crm";

export const iniciais = (n: string) => n.split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

/** Quem está no comando: orbe roxo = Cláudio; avatar = humano. */
export function Dono({ c, size = 22 }: { c: Pick<ContatoCompleto, "dono" | "operadorId">; size?: number }) {
  const { estado } = useCRM();
  if (c.dono === "robo") return <Tooltip text={`${estado.config.nomeRobo} está no comando`}><span style={{ display: "inline-flex" }}><Orb size={size} label={estado.config.nomeRobo} /></span></Tooltip>;
  const op = estado.operadores.find((o) => o.id === c.operadorId);
  return <Tooltip text={`${op?.nome ?? "humano"} está no comando`}><span style={{ display: "inline-flex" }}><Avatar initials={iniciais(op?.nome ?? "H")} tone="ink" label={op?.nome} /></span></Tooltip>;
}

export function BadgeEtapa({ o }: { o: Oportunidade }) {
  const { agora } = useCRM();
  const e = etapaDe(o.etapa);
  if (o.perdida) return <Badge tone="dashed">perdido · {o.motivoPerda}</Badge>;
  return <span className="ds-wrap"><Badge tone="solid">{e?.nome}</Badge>{estourouPrazo(o, agora) && <Badge tone="outline">vencido · {formatarTempo(minutosNaEtapa(o, agora))}</Badge>}</span>;
}

export function ChipTermometro({ t, onClick }: { t: Termometro | null; onClick?: () => void }) {
  const rotulo = `termômetro: ${t ?? "sem marca"}`;
  return onClick ? <button type="button" className="ds-chip" onClick={onClick} aria-label={`Alternar ${rotulo}`}>{rotulo}</button> : <span className="ds-chip">{rotulo}</span>;
}

export const nomeOperador = (estado: EstadoCRM, id: string | null | undefined) => estado.operadores.find((o) => o.id === id)?.nome ?? (id === "robo" ? estado.config.nomeRobo : id === "sistema" ? "sistema" : "—");

export const nomeFunil = (estado: EstadoCRM, id: string) => estado.funis.find((f) => f.id === id)?.nome ?? id;
export const nomeProduto = (estado: EstadoCRM, id: string) => estado.produtos.find((p) => p.id === id)?.nome ?? id;

/** Pergunta um texto curto. Devolve null se cancelou. Simples de propósito: troque por um Modal quando quiser. */
export const perguntar = (msg: string, padrao = "") => {
  const r = window.prompt(msg, padrao);
  return r === null ? null : r.trim();
};

export function Vazio({ children }: { children: React.ReactNode }) {
  return <p className="ds-muted" style={{ margin: 0 }}>{children}</p>;
}
