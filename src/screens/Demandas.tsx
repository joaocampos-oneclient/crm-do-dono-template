import * as React from "react";
import { Badge, Button, Card, DataTable, Input, Modal, PageHead, Section, Segmented, Select, StatCard, StatGrid } from "../ds";
import { useCRM } from "../app/crm";
import { painelDemandas, variacao, type Demanda } from "../domain/metricas";
import { formatarReais } from "../domain/rules";
import type { Periodo } from "../domain/types";
import { nomeFunil, Vazio } from "./partes";

const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toFixed(1)}%`);
const reais = (v: number | null) => (v === null ? "—" : formatarReais(Math.round(v)));

/** Demandas: a primeira tela do dia. Quantos leads, quanto custou, quanto virou venda. Por período e por funil de entrada. */
export function Demandas() {
  const { estado, agora, despachar } = useCRM();
  const [periodo, setPeriodo] = React.useState<Periodo>("7d");
  const [lancando, setLancando] = React.useState(false);
  const p = React.useMemo(() => painelDemandas(estado, periodo, agora), [estado, periodo, agora]);
  const delta = (k: keyof Demanda) => variacao(Number(p.atual[k] ?? 0), Number(p.anterior[k] ?? 0));
  const criativosAtivos = estado.criativos.filter((c) => c.ativo);

  return (
    <>
      <PageHead eyebrow="Geração de demanda" title="Demandas" actions={
        <>
          <Segmented name="periodo" label="Período" value={periodo} onChange={setPeriodo} options={[{ value: "hoje", label: "Hoje" }, { value: "7d", label: "7 dias" }, { value: "30d", label: "30 dias" }]} />
          <Button size="sm" variant="secondary" onClick={() => setLancando(true)}>Lançar gasto de mídia</Button>
        </>
      }>
        <p className="ds-muted" style={{ margin: "4px 0 0" }}>Comparado com o período anterior de mesmo tamanho. Leads = contatos novos; qualificados = passaram ao humano; vendas = pagamento confirmado.</p>
      </PageHead>

      <StatGrid>
        <StatCard label="Leads" value={p.atual.leads} delta={delta("leads")} tone={(delta("leads") ?? 0) >= 0 ? "good" : "bad"} />
        <StatCard label="Qualificados" value={p.atual.qualificados} delta={delta("qualificados")} tone={(delta("qualificados") ?? 0) >= 0 ? "good" : "bad"} />
        <StatCard label="Ofertas" value={p.atual.ofertas} delta={delta("ofertas")} />
        <StatCard label="Vendas" value={p.atual.vendas} delta={delta("vendas")} tone={(delta("vendas") ?? 0) >= 0 ? "good" : "bad"} />
        <StatCard label="Receita" value={reais(p.atual.receita)} delta={delta("receita")} />
        <StatCard label="Gasto em mídia" value={reais(p.atual.gasto)} delta={delta("gasto")} tone={(delta("gasto") ?? 0) <= 0 ? "good" : "bad"} />
        <StatCard label="Custo por lead" value={reais(p.atual.cpl)} hint={p.atual.cpl === null ? "sem gasto ou sem lead" : undefined} />
        <StatCard label="Custo por venda" value={reais(p.atual.cpv)} hint={p.atual.cpv === null ? "sem venda no período" : undefined} />
        <StatCard label="Visita → lead" value={pct(p.atual.visitaParaLead)} hint={`${p.atual.visitas} visitas`} />
        <StatCard label="Lead → venda" value={pct(p.atual.leadParaVenda)} />
      </StatGrid>

      <Section title="Por funil de entrada" aside={<a href="#/produtos" className="ds-label">editar funis</a>}>
        <div className="ds-grid-2">
          {p.porFunil.map(({ funil, atual, anterior }) => (
            <Card key={funil.id} style={{ padding: 14, display: "grid", gap: 10 }}>
              <div className="ds-wrap" style={{ justifyContent: "space-between" }}>
                <div><strong>{funil.nome}</strong><div className="ds-label">{funil.canal}</div></div>
                <Badge tone="outline">{atual.leads} leads {variacao(atual.leads, anterior.leads) !== null ? `· ${variacao(atual.leads, anterior.leads)! >= 0 ? "▲" : "▼"} ${Math.abs(variacao(atual.leads, anterior.leads)!)}%` : ""}</Badge>
              </div>
              <DataTable
                caption={undefined}
                rowKey={(r) => r.k}
                columns={[{ key: "k", header: "", render: (r) => r.k }, { key: "v", header: "", render: (r) => r.v, numeric: true }]}
                rows={[
                  { k: "Qualificados", v: atual.qualificados },
                  { k: "Ofertas", v: atual.ofertas },
                  { k: "Vendas", v: atual.vendas },
                  { k: "Gasto", v: reais(atual.gasto) },
                  { k: "Custo por lead", v: reais(atual.cpl) },
                  { k: "Custo por venda", v: reais(atual.cpv) },
                  { k: "Lead → venda", v: pct(atual.leadParaVenda) },
                ]}
              />
            </Card>
          ))}
        </div>
      </Section>

      <Section title="Criativos ativos" aside={<a href="#/produtos" className="ds-label">gerenciar</a>}>
        {criativosAtivos.length === 0 ? <Vazio>Nenhum criativo cadastrado. Cadastre em Produtos e funis para acompanhar gasto por criativo.</Vazio> : (
          <DataTable
            rowKey={(c) => c.id}
            columns={[
              { key: "nome", header: "Criativo", render: (c) => c.nome },
              { key: "funil", header: "Funil", render: (c) => nomeFunil(estado, c.funilId) },
              { key: "plat", header: "Plataforma", render: (c) => c.plataforma },
              { key: "gasto", header: "Gasto no período", numeric: true, render: (c) => reais(estado.gastos.filter((g) => g.criativoId === c.id && dentroPeriodo(g.data, periodo, agora)).reduce((s, g) => s + g.valor, 0)) },
            ]}
            rows={criativosAtivos}
          />
        )}
      </Section>

      <ModalGasto open={lancando} onClose={() => setLancando(false)} onSalvar={async (g) => { if (await despachar({ tipo: "lancarGasto", gasto: g }, "Gasto lançado.")) setLancando(false); }} />
    </>
  );
}

const dentroPeriodo = (dia: string, periodo: Periodo, agora: string) => {
  const dias = periodo === "hoje" ? 1 : periodo === "7d" ? 7 : 30;
  const inicio = new Date(Date.parse(agora) - (dias - 1) * 86400000).toISOString().slice(0, 10);
  return dia >= inicio && dia <= agora.slice(0, 10);
};

function ModalGasto({ open, onClose, onSalvar }: { open: boolean; onClose: () => void; onSalvar: (g: { funilId: string; criativoId: string | null; data: string; valor: number; visitas: number }) => void }) {
  const { estado, agora } = useCRM();
  const [funilId, setFunilId] = React.useState(estado.funis[0]?.id ?? "");
  const [criativoId, setCriativoId] = React.useState<string>("");
  const [data, setData] = React.useState(agora.slice(0, 10));
  const [valor, setValor] = React.useState("");
  const [visitas, setVisitas] = React.useState("");
  const criativos = estado.criativos.filter((c) => c.funilId === funilId);
  return (
    <Modal open={open} onClose={onClose} title="Lançar gasto de mídia" footer={<Button onClick={() => onSalvar({ funilId, criativoId: criativoId || null, data, valor: Number(valor || 0), visitas: Number(visitas || 0) })}>Salvar</Button>}>
      <div style={{ display: "grid", gap: 10 }}>
        <Select label="Funil" value={funilId} onChange={(e) => { setFunilId(e.target.value); setCriativoId(""); }}>{estado.funis.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}</Select>
        <Select label="Criativo (opcional)" value={criativoId} onChange={(e) => setCriativoId(e.target.value)}><option value="">— sem criativo —</option>{criativos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</Select>
        <Input label="Dia" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        <Input label="Valor gasto (R$)" type="number" min={0} step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} />
        <Input label="Visitas à página" type="number" min={0} value={visitas} onChange={(e) => setVisitas(e.target.value)} help="Opcional. Serve para visita → lead." />
        <p className="ds-muted" style={{ margin: 0, fontSize: 13 }}>Em produção isto vem sozinho da API do Meta/Google (docs/integracoes.md). Aqui você lança à mão.</p>
      </div>
    </Modal>
  );
}
