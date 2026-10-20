import { Card, MetricBar } from "../ds";
import { ETAPAS } from "../domain/funil";
import { contaReversa } from "../domain/rules";
import type { Ctx } from "./ctx";

/** Números: conversão por etapa contra a SUA meta. Com amostra pequena, o número não aparece como porcentagem. */
export function Metricas({ contatos }: Ctx) {
  const idx = (id: string) => ETAPAS.findIndex((e) => e.id === id);
  const passaram = (id: string) => contatos.filter((c) => idx(c.oportunidades[0].etapa) >= idx(id)).length;
  const etapas = ETAPAS.slice(0, 5);
  const rev = contaReversa(1, { leadParaConversa: 0.5, conversaParaHandoff: 0.3, handoffParaOferta: 0.6, ofertaParaVenda: 0.4 });
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Card style={{ padding: 16, display: "grid", gap: 12 }}>
        <div className="ds-label">Conversão para a etapa seguinte · exemplo ilustrativo</div>
        {etapas.map((e, i) => {
          const base = passaram(e.id);
          const prox = passaram(ETAPAS[i + 1].id);
          return <MetricBar key={e.id} label={`${e.nome} → ${ETAPAS[i + 1].nome}`} value={base ? Math.round((prox / base) * 100) : 0} meta={e.meta} baseline={Math.max(e.meta - 20, 0)} n={base} />;
        })}
      </Card>
      <Card tone="alt" style={{ padding: 16 }}>
        <div className="ds-label">Conta reversa · exemplo ilustrativo (taxas inventadas, use as suas)</div>
        <p style={{ margin: "6px 0 0" }}>
          Para 1 venda por dia: <span className="ds-num">{rev.ofertas}</span> ofertas, <span className="ds-num">{rev.handoffs}</span> handoffs, <span className="ds-num">{rev.conversas}</span> conversas, <span className="ds-num">{rev.leads}</span> leads novos.
        </p>
      </Card>
    </div>
  );
}
