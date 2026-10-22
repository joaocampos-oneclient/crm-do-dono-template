import * as React from "react";
import { Badge, Kanban, KanbanCard, KanbanColumn, PageHead, Segmented } from "../ds";
import { useCRM } from "../app/crm";
import { ETAPAS, etapaDe, indiceEtapa } from "../domain/funil";
import { valorPorEtapa } from "../domain/metricas";
import { estourouPrazo, formatarReais, formatarTempo, minutosNaEtapa } from "../domain/rules";
import type { EtapaId } from "../domain/types";
import { Dono, nomeFunil, perguntar } from "./partes";

/**
 * Funil de venda: um quadro, 8 etapas. Arraste o card para mover. As etapas automáticas
 * (proposta aberta, pago, dentro) o sistema move. Pular ou voltar etapa pede motivo.
 */
export function FunilKanban() {
  const { estado, contatos, agora, abrirContato, despachar, operador } = useCRM();
  const [filtroFunil, setFiltroFunil] = React.useState<string>("todos");
  const [filtroProduto, setFiltroProduto] = React.useState<string>("todos");
  const [arrastando, setArrastando] = React.useState<string | null>(null);
  const [sobre, setSobre] = React.useState<EtapaId | null>(null);
  const valores = React.useMemo(() => valorPorEtapa(estado), [estado]);

  const cards = contatos.flatMap((c) => c.oportunidades.filter((o) => !o.perdida && (filtroFunil === "todos" || c.origem === filtroFunil) && (filtroProduto === "todos" || o.produtoId === filtroProduto)).map((o) => ({ c, o })));
  const perdidos = contatos.flatMap((c) => c.oportunidades.filter((o) => o.perdida).map((o) => ({ c, o })));

  const soltar = async (para: EtapaId) => {
    setSobre(null);
    if (!arrastando || !operador) return;
    const o = estado.oportunidades.find((x) => x.id === arrastando);
    setArrastando(null);
    if (!o || o.etapa === para) return;
    const alvo = etapaDe(para)!;
    if (alvo.auto) { await despachar({ tipo: "moverEtapa", oportunidadeId: o.id, para, por: operador.id }); return; }
    const pula = indiceEtapa(para) > indiceEtapa(o.etapa) + 1;
    const volta = indiceEtapa(para) < indiceEtapa(o.etapa);
    let motivo: string | undefined;
    if (pula || volta) {
      const r = perguntar(`${volta ? "Voltar" : "Pular"} para "${alvo.nome}". Qual o motivo? (fica no histórico)`);
      if (r === null || !r) return;
      motivo = r;
    }
    await despachar({ tipo: "moverEtapa", oportunidadeId: o.id, para, por: operador.id, motivo }, `Movido para "${alvo.nome}".`);
  };

  return (
    <>
      <PageHead eyebrow="Operação" title="Funil de venda" actions={
        <>
          <Segmented name="funil" label="Funil de entrada" value={filtroFunil} onChange={setFiltroFunil} options={[{ value: "todos", label: "Todos" }, ...estado.funis.map((f) => ({ value: f.id, label: f.nome }))]} />
          {estado.produtos.length > 1 && <Segmented name="produto" label="Produto" value={filtroProduto} onChange={setFiltroProduto} options={[{ value: "todos", label: "Todos os produtos" }, ...estado.produtos.filter((p) => p.ativo).map((p) => ({ value: p.id, label: p.nome }))]} />}
        </>
      }>
        <p className="ds-muted" style={{ margin: "4px 0 0" }}>Arraste para mover. Bolinha roxa = {estado.config.nomeRobo} no comando; avatar = humano. Valor em aberto por etapa embaixo do título.</p>
      </PageHead>
      <div style={{ overflowX: "auto" }}>
        <Kanban>
          {ETAPAS.map((e) => {
            const col = cards.filter((x) => x.o.etapa === e.id);
            const v = valores.get(e.id)!;
            return (
              <KanbanColumn
                key={e.id}
                title={e.nome}
                count={String(col.length)}
                over={sobre === e.id}
                meta={<span>{e.auto ? "automática" : `meta ${e.meta}%`} · <span className="ds-kcol__sum">{formatarReais(v.valor)}</span></span>}
                onDragOver={(ev) => { ev.preventDefault(); if (sobre !== e.id) setSobre(e.id); }}
                onDragLeave={() => setSobre((s) => (s === e.id ? null : s))}
                onDrop={(ev) => { ev.preventDefault(); void soltar(e.id); }}
              >
                {col.map(({ c, o }) => (
                  <KanbanCard
                    key={o.id}
                    title={c.nome}
                    subtitle={`${c.empresa}${estado.produtos.length > 1 ? ` · ${estado.produtos.find((p) => p.id === o.produtoId)?.nome ?? ""}` : ""}`}
                    meta={<span className="ds-wrap" style={{ marginTop: 4 }}><Dono c={c} size={18} />{c.handoffPendente && <Badge tone="solid">pediu humano</Badge>}{c.termometro && <Badge tone="soft">{c.termometro}</Badge>}</span>}
                    footerLeft={`${nomeFunil(estado, c.origem)}${c.nota !== null ? ` · nota ${c.nota}` : ""} · ${formatarReais(o.valor)}`}
                    time={formatarTempo(minutosNaEtapa(o, agora))}
                    late={estourouPrazo(o, agora)}
                    dragging={arrastando === o.id}
                    draggable
                    onDragStart={(ev) => { setArrastando(o.id); ev.dataTransfer.effectAllowed = "move"; ev.dataTransfer.setData("text/plain", o.id); }}
                    onDragEnd={() => { setArrastando(null); setSobre(null); }}
                    onClick={() => abrirContato(c.id)}
                  />
                ))}
              </KanbanColumn>
            );
          })}
          <KanbanColumn title="Perdidos" count={String(perdidos.length)} meta="com motivo">
            {perdidos.map(({ c, o }) => <KanbanCard key={o.id} title={c.nome} subtitle={o.motivoPerda ?? ""} footerLeft={`era: ${etapaDe(o.etapa)?.nome}`} time="" onClick={() => abrirContato(c.id)} />)}
          </KanbanColumn>
        </Kanban>
      </div>
    </>
  );
}
