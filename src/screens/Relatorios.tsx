import * as React from "react";
import { Card, DataTable, Input, MetricBar, PageHead, Section, StatCard, StatGrid } from "../ds";
import { useCRM } from "../app/crm";
import { ETAPAS } from "../domain/funil";
import { conversaoPorEtapa, relatorio, taxasReais, valorPorEtapa } from "../domain/metricas";
import { contaReversa, formatarReais } from "../domain/rules";

/** Relatórios: vendas, receita, projeção, ticket médio, funil de conversão contra a SUA meta e conta reversa com taxas reais. */
export function Relatorios() {
  const { estado, agora } = useCRM();
  const r = React.useMemo(() => relatorio(estado, agora), [estado, agora]);
  const conv = React.useMemo(() => conversaoPorEtapa(estado), [estado]);
  const taxas = React.useMemo(() => taxasReais(estado), [estado]);
  const valores = React.useMemo(() => valorPorEtapa(estado), [estado]);
  const [vendasDia, setVendasDia] = React.useState("1");
  const rev = contaReversa(Number(vendasDia) || 1, taxas);
  const reais = (v: number | null) => (v === null ? "—" : formatarReais(Math.round(v)));
  const motivos = Object.entries(estado.oportunidades.filter((o) => o.perdida).reduce<Record<string, number>>((acc, o) => { const k = o.motivoPerda ?? "sem motivo"; acc[k] = (acc[k] ?? 0) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <PageHead eyebrow="Gestão" title="Relatórios" />
      <StatGrid>
        <StatCard label="Vendas hoje" value={r.vendasHoje} />
        <StatCard label="Vendas no mês" value={r.vendasMes} />
        <StatCard label="Receita no mês" value={reais(r.receitaMes)} />
        <StatCard label="Projeção do mês" value={reais(r.projecaoMes)} hint="linear, pela média diária" />
        <StatCard label="Ticket médio" value={reais(r.ticketMedio)} />
        <StatCard label="Receita total" value={reais(r.receitaTotal)} />
        <StatCard label="Ocorrências abertas" value={r.ocorrenciasAbertas} />
        <StatCard label="Tarefas vencidas" value={r.tarefasVencidas} />
      </StatGrid>

      <Section title="Do lead à venda, no mês">
        <StatGrid>
          <StatCard label="Leads entraram" value={r.leadsMes} />
          <StatCard label={`Conversaram com ${estado.config.nomeRobo}`} value={r.conversouComClaudio} />
          <StatCard label="Passaram ao humano" value={r.passouParaHumano} />
          <StatCard label="Briefings" value={r.briefings} />
          <StatCard label="Propostas abertas" value={r.propostasAbertas} />
          <StatCard label="Ofertas" value={r.ofertas} />
          <StatCard label="Vendas" value={r.vendasMes} />
        </StatGrid>
      </Section>

      <Section title="Conversão por etapa contra a sua meta">
        <Card style={{ padding: 16, display: "grid", gap: 12 }}>
          {conv.map((c) => <MetricBar key={c.de.id} label={`${c.de.nome} → ${c.para.nome}`} value={c.taxa === null ? 0 : Math.round(c.taxa * 100)} meta={c.de.meta} baseline={Math.max(c.de.meta - 20, 0)} n={c.base} />)}
          <p className="ds-muted" style={{ margin: 0, fontSize: 13 }}>Com menos de 10 na base, o número não vira porcentagem: amostra pequena ainda não significa nada.</p>
        </Card>
      </Section>

      <div className="ds-grid-2">
        <Section title="Valor em aberto por etapa">
          <DataTable rowKey={(e) => e.id} rows={ETAPAS.filter((e) => !["pago", "dentro"].includes(e.id))} columns={[{ key: "e", header: "Etapa", render: (e) => e.nome }, { key: "n", header: "Cards", numeric: true, render: (e) => valores.get(e.id)!.n }, { key: "v", header: "Valor", numeric: true, render: (e) => formatarReais(valores.get(e.id)!.valor) }]} />
        </Section>
        <Section title="Motivos de perda">
          {motivos.length === 0 ? <p className="ds-muted">Nenhuma perda registrada.</p> : <DataTable rowKey={(m) => m[0]} rows={motivos} columns={[{ key: "m", header: "Motivo", render: (m) => m[0] }, { key: "n", header: "Vezes", numeric: true, render: (m) => m[1] }]} />}
        </Section>
      </div>

      <Section title="Conta reversa com as suas taxas reais">
        <Card tone="alt" style={{ padding: 16, display: "grid", gap: 10 }}>
          <div style={{ maxWidth: 220 }}><Input label="Vendas por dia que você quer" type="number" min={1} value={vendasDia} onChange={(e) => setVendasDia(e.target.value)} /></div>
          <p style={{ margin: 0 }}>
            Para <span className="ds-num">{vendasDia}</span> venda(s) por dia: <span className="ds-num">{rev.ofertas}</span> ofertas, <span className="ds-num">{rev.handoffs}</span> handoffs, <span className="ds-num">{rev.conversas}</span> conversas, <span className="ds-num">{rev.leads}</span> leads novos por dia.
          </p>
          <div className="ds-label">Taxas usadas (reais, dos seus movimentos): lead→conversa {(taxas.leadParaConversa * 100).toFixed(0)}% · conversa→handoff {(taxas.conversaParaHandoff * 100).toFixed(0)}% · handoff→oferta {(taxas.handoffParaOferta * 100).toFixed(0)}% · oferta→venda {(taxas.ofertaParaVenda * 100).toFixed(0)}%</div>
        </Card>
      </Section>
    </>
  );
}
