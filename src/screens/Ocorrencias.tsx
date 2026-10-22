import * as React from "react";
import { Badge, Button, Card, ChatBubble, EmptyState, PageHead, Segmented, Textarea } from "../ds";
import { useCRM } from "../app/crm";
import { dataHora, horaDe } from "../domain/rules";
import type { Ocorrencia } from "../domain/types";
import { nomeOperador } from "./partes";

/** Ocorrências: o vendedor marca onde o agente errou ou pode melhorar; o dono responde e resolve. É daqui que o Cláudio evolui. */
export function Ocorrencias() {
  const { estado, despachar, contato, abrirContato } = useCRM();
  const [filtro, setFiltro] = React.useState<"abertas" | "todas">("abertas");
  const [resposta, setResposta] = React.useState<Record<string, string>>({});
  const lista = estado.ocorrencias.filter((o) => filtro === "todas" || o.status !== "resolvida").sort((a, b) => Date.parse(b.em) - Date.parse(a.em));
  const mudar = (o: Ocorrencia, status: Ocorrencia["status"]) => despachar({ tipo: "atualizarOcorrencia", ocorrenciaId: o.id, status, resposta: resposta[o.id] || undefined }, `Ocorrência ${status}.`);

  return (
    <>
      <PageHead eyebrow="Gestão" title="Ocorrências" actions={<Segmented name="f-oc" label="Filtro" value={filtro} onChange={setFiltro} options={[{ value: "abertas", label: "Abertas" }, { value: "todas", label: "Todas" }]} />}>
        <p className="ds-muted" style={{ margin: "4px 0 0" }}>Cada ocorrência é um pedido de melhoria no agente ou no processo. Leia os trechos, ajuste o playbook (ou o prompt) e resolva.</p>
      </PageHead>
      {lista.length === 0 && <EmptyState title="Nenhuma ocorrência" text="Na conversa: Mais → Registrar ocorrência." />}
      {lista.map((o) => {
        const c = contato(o.contatoId);
        return (
          <Card key={o.id} style={{ padding: 16, display: "grid", gap: 10 }}>
            <div className="ds-wrap" style={{ justifyContent: "space-between" }}>
              <div className="ds-wrap"><Badge tone={o.tipo === "problema" ? "solid" : "outline"}>{o.tipo}</Badge><Badge tone={o.status === "resolvida" ? "fact" : "soft"}>{o.status}</Badge><span className="ds-label">{dataHora(o.em)} · por {nomeOperador(estado, o.abertaPor)} · contato <a href="#" onClick={(e) => { e.preventDefault(); abrirContato(o.contatoId); }}>{c?.nome}</a></span></div>
            </div>
            <p style={{ margin: 0 }}>{o.descricao}</p>
            {o.trechos.length > 0 && <div style={{ display: "grid", gap: 6 }}>{o.trechos.map((t, i) => <ChatBubble key={i} author={t.autor === "contato" ? "lead" : t.autor} time={horaDe(t.em)}>{t.texto}</ChatBubble>)}</div>}
            {o.resposta && <Card tone="alt" style={{ padding: 10 }}><div className="ds-label">Resposta do dono</div>{o.resposta}</Card>}
            {o.status !== "resolvida" && (
              <>
                <Textarea label="Resposta / o que foi ajustado" rows={2} value={resposta[o.id] ?? ""} onChange={(e) => setResposta({ ...resposta, [o.id]: e.target.value })} />
                <div className="ds-actions ds-actions--end">
                  {o.status === "aberta" && <Button size="sm" variant="secondary" onClick={() => mudar(o, "em análise")}>Em análise</Button>}
                  <Button size="sm" onClick={() => mudar(o, "resolvida")}>Resolver</Button>
                </div>
              </>
            )}
          </Card>
        );
      })}
    </>
  );
}
