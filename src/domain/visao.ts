/**
 * Visões: montam dados prontos para tela a partir do estado normalizado. Só leitura.
 */
import { etapaDe } from "./funil";
import { categoria, dataHora } from "./rules";
import type { ContatoCompleto, EstadoCRM } from "./types";

const porData = <T extends { em: string }>(a: T, b: T) => Date.parse(a.em) - Date.parse(b.em);

export function montarContato(estado: EstadoCRM, contatoId: string): ContatoCompleto | null {
  const c = estado.contatos.find((x) => x.id === contatoId);
  if (!c) return null;
  const oportunidades = estado.oportunidades.filter((o) => o.contatoId === c.id);
  const opIds = new Set(oportunidades.map((o) => o.id));
  return {
    ...c,
    categoria: categoria(oportunidades),
    oportunidades,
    mensagens: estado.mensagens.filter((m) => m.contatoId === c.id).sort(porData),
    notas: estado.notas.filter((n) => n.contatoId === c.id).sort(porData),
    tarefas: estado.tarefas.filter((t) => t.contatoId === c.id),
    ligacoes: estado.ligacoes.filter((l) => l.contatoId === c.id),
    propostas: estado.propostas.filter((p) => opIds.has(p.oportunidadeId)),
    pagamentos: estado.pagamentos.filter((p) => opIds.has(p.oportunidadeId)),
    emails: estado.emails.filter((e) => e.contatoId === c.id).sort(porData),
    ocorrencias: estado.ocorrencias.filter((o) => o.contatoId === c.id),
    movimentos: estado.movimentos.filter((m) => opIds.has(m.oportunidadeId)).sort(porData),
  };
}

export const contatosCompletos = (estado: EstadoCRM): ContatoCompleto[] =>
  estado.contatos.map((c) => montarContato(estado, c.id)!).sort((a, b) => Date.parse(b.criadoEm) - Date.parse(a.criadoEm));

export interface EventoLinha { em: string; tipo: string; texto: string }

/** Linha do tempo do contato: tudo que aconteceu, em ordem. */
export function linhaDoTempo(estado: EstadoCRM, c: ContatoCompleto): EventoLinha[] {
  const nome = (id: string | null | undefined) => estado.operadores.find((o) => o.id === id)?.nome ?? (id === "robo" ? estado.config.nomeRobo : id === "sistema" ? "sistema" : id ?? "");
  const ev: EventoLinha[] = [];
  ev.push({ em: c.criadoEm, tipo: "entrada", texto: `Entrou pelo funil ${estado.funis.find((f) => f.id === c.origem)?.nome ?? c.origem}.` });
  for (const m of c.movimentos) ev.push({ em: m.em, tipo: "etapa", texto: `${m.de ? `${etapaDe(m.de)?.nome ?? m.de} → ` : ""}${m.para === "perdido" ? "Perdido" : etapaDe(m.para)?.nome} · por ${nome(m.por)}${m.motivo ? ` · ${m.motivo}` : ""}` });
  for (const m of c.mensagens.filter((x) => x.aviso)) ev.push({ em: m.em, tipo: "troca", texto: m.texto });
  for (const l of c.ligacoes) ev.push({ em: l.iniciouEm, tipo: "ligação", texto: `Ligação (${l.resultado}, ${Math.round(l.duracaoSeg / 60)} min) · termômetro ${l.termometroVendedor} · por ${nome(l.operadorId)}` });
  for (const n of c.notas) ev.push({ em: n.em, tipo: "nota", texto: `${n.texto} · ${nome(n.autorId)}` });
  for (const p of c.propostas) { ev.push({ em: p.criadaEm, tipo: "proposta", texto: "Proposta gerada." }); if (p.enviadaEm) ev.push({ em: p.enviadaEm, tipo: "proposta", texto: `Proposta enviada por ${p.enviadaPor}.` }); if (p.abertaEm) ev.push({ em: p.abertaEm, tipo: "proposta", texto: "Contato abriu a proposta." }); }
  for (const p of c.pagamentos) { ev.push({ em: p.criadoEm, tipo: "pagamento", texto: `Link de pagamento (${p.metodo}) criado.` }); if (p.pagoEm) ev.push({ em: p.pagoEm, tipo: "pagamento", texto: `Pagamento confirmado.` }); }
  for (const e of c.emails) ev.push({ em: e.em, tipo: "e-mail", texto: `E-mail: ${e.assunto}` });
  for (const o of c.ocorrencias) ev.push({ em: o.em, tipo: "ocorrência", texto: `${o.tipo}: ${o.descricao}` });
  return ev.sort(porData);
}

export const rotuloEvento = (e: EventoLinha) => `${dataHora(e.em)} · ${e.tipo}`;
