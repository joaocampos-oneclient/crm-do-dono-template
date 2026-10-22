import { Badge, Button, Card, List, ListRow, PageHead } from "../ds";
import { useCRM } from "../app/crm";
import { etapaDe } from "../domain/funil";
import { dataHora, estourouPrazo, oportunidadePrincipal, proximasAcoes } from "../domain/rules";
import { Dono } from "./partes";

/** Tela "Hoje": o que fazer agora, em ordem. É a tela que o time abre de manhã. */
export function Hoje() {
  const { contatos, agora, abrirContato, estado, despachar } = useCRM();
  const handoffs = contatos.filter((c) => c.handoffPendente);
  const vencidos = contatos.filter((c) => c.oportunidades.some((o) => estourouPrazo(o, agora)) && !c.handoffPendente);
  const demais = contatos.filter((c) => !c.handoffPendente && !vencidos.includes(c) && proximasAcoes(c, agora).length);
  const tarefas = estado.tarefas.filter((t) => !t.feita && t.venceEm && Date.parse(t.venceEm) < Date.parse(agora) + 86400000).sort((a, b) => Date.parse(a.venceEm!) - Date.parse(b.venceEm!));

  const bloco = (titulo: string, lista: typeof contatos, tom?: "solid") => (
    <Card style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <strong>{titulo}</strong>
        <Badge tone={tom ?? "soft"}>{lista.length}</Badge>
      </div>
      {lista.length === 0 ? <p style={{ margin: 0, opacity: 0.7 }}>Nada aqui agora.</p> : (
        <List>
          {lista.map((c) => {
            const [a] = proximasAcoes(c, agora);
            const o = oportunidadePrincipal(c.oportunidades);
            return <ListRow key={c.id} onClick={() => abrirContato(c.id)} leading={<Dono c={c} />} title={`${c.nome} · ${c.empresa}`} subtitle={a ? `${a.titulo} — ${a.porque}` : o ? etapaDe(o.etapa)?.nome : ""} trailing={<Badge tone="outline">{c.categoria}</Badge>} />;
          })}
        </List>
      )}
    </Card>
  );

  return (
    <>
      <PageHead eyebrow="Operação" title="Hoje"><p className="ds-muted" style={{ margin: "4px 0 0" }}>Em ordem: quem pediu humano, prazos vencidos, tarefas de hoje, demais ações. A IA sugere, você decide.</p></PageHead>
      {bloco("Pediu humano e ninguém assumiu", handoffs, "solid")}
      {bloco("Prazo vencido na etapa", vencidos)}
      <Card style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><strong>Tarefas vencidas e de hoje</strong><Badge>{tarefas.length}</Badge></div>
        {tarefas.length === 0 ? <p style={{ margin: 0, opacity: 0.7 }}>Nenhuma tarefa para hoje.</p> : (
          <div style={{ display: "grid", gap: 6 }}>
            {tarefas.map((t) => {
              const c = contatos.find((x) => x.id === t.contatoId);
              const vencida = Date.parse(t.venceEm!) < Date.parse(agora);
              return (
                <div key={t.id} className="ds-wrap" style={{ justifyContent: "space-between", padding: "8px 10px", border: "1px solid var(--line)", borderRadius: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div>{t.texto}</div>
                    <div className="ds-label"><a href={`#/contatos/${t.contatoId}`}>{c?.nome ?? ""}</a> · vence {dataHora(t.venceEm!)} · origem: {t.origem}</div>
                  </div>
                  <span className="ds-wrap"><Badge tone={vencida ? "solid" : "soft"}>{vencida ? "vencida" : "hoje"}</Badge><Button size="sm" variant="ghost" onClick={() => despachar({ tipo: "concluirTarefa", tarefaId: t.id }, "Tarefa concluída.")}>Feita</Button></span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
      {bloco("Próximas ações", demais)}
    </>
  );
}
