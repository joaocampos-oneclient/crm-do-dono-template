import * as React from "react";
import { Badge, Button, DataTable, FormRow, Input, Modal, PageHead, Section, Select, Switch, Textarea } from "../ds";
import { useCRM } from "../app/crm";
import { ETAPAS, PLAYBOOK } from "../domain/funil";
import { formatarReais } from "../domain/rules";
import type { Criativo, EtapaId, Funil, PerguntaMatadora, Produto } from "../domain/types";
import { nomeFunil, nomeProduto } from "./partes";

/** Produtos (o que você vende, com gatilhos e playbook próprio), funis de entrada e criativos. */
export function Produtos() {
  const { estado, despachar } = useCRM();
  const [produto, setProduto] = React.useState<Partial<Produto> | null>(null);
  const [funil, setFunil] = React.useState<Partial<Funil> | null>(null);
  const [criativo, setCriativo] = React.useState<Partial<Criativo> | null>(null);
  const [playbookDe, setPlaybookDe] = React.useState<Produto | null>(null);

  return (
    <>
      <PageHead eyebrow="Configuração" title="Produtos e funis" />
      <Section title="Produtos" aside={<Button size="sm" onClick={() => setProduto({})}>Novo produto</Button>}>
        <DataTable rowKey={(p) => p.id} rows={estado.produtos} columns={[
          { key: "n", header: "Produto", render: (p) => <span className="ds-wrap">{p.nome}{!p.ativo && <Badge tone="dashed">inativo</Badge>}</span> },
          { key: "v", header: "Valor", numeric: true, render: (p) => `${formatarReais(p.valor)}${p.parcelas ? ` · ${p.parcelas}` : ""}` },
          { key: "g", header: "Gatilhos (condições de oferta)", render: (p) => p.gatilhos.length ? p.gatilhos.join(" · ") : <span className="ds-muted">nenhum</span> },
          { key: "pb", header: "Playbook", render: (p) => p.playbook.length ? `${p.playbook.length} etapa(s) própria(s)` : "padrão" },
          { key: "a", header: "", render: (p) => <span className="ds-wrap"><Button size="sm" variant="secondary" onClick={() => setProduto(p)}>Editar</Button><Button size="sm" variant="ghost" onClick={() => setPlaybookDe(p)}>Playbook</Button><Button size="sm" variant="ghost" onClick={() => despachar({ tipo: "removerProduto", produtoId: p.id }, "Produto removido ou desativado.")}>Remover</Button></span> },
        ]} />
      </Section>

      <Section title="Funis de entrada (de onde o lead vem)" aside={<Button size="sm" onClick={() => setFunil({})}>Novo funil</Button>}>
        <DataTable rowKey={(f) => f.id} rows={estado.funis} columns={[
          { key: "n", header: "Funil", render: (f) => <span className="ds-wrap">{f.nome}{!f.ativo && <Badge tone="dashed">inativo</Badge>}</span> },
          { key: "c", header: "Canal", render: (f) => f.canal },
          { key: "p", header: "Produto padrão", render: (f) => nomeProduto(estado, f.produto) },
          { key: "id", header: "id (use no webhook)", render: (f) => <code>{f.id}</code> },
          { key: "a", header: "", render: (f) => <Button size="sm" variant="secondary" onClick={() => setFunil(f)}>Editar</Button> },
        ]} />
      </Section>

      <Section title="Criativos" aside={<Button size="sm" onClick={() => setCriativo({})}>Novo criativo</Button>}>
        <DataTable rowKey={(c) => c.id} rows={estado.criativos} columns={[
          { key: "n", header: "Criativo", render: (c) => <span className="ds-wrap">{c.nome}{!c.ativo && <Badge tone="dashed">pausado</Badge>}</span> },
          { key: "f", header: "Funil", render: (c) => nomeFunil(estado, c.funilId) },
          { key: "p", header: "Plataforma", render: (c) => c.plataforma },
          { key: "a", header: "", render: (c) => <span className="ds-wrap"><Button size="sm" variant="secondary" onClick={() => setCriativo(c)}>Editar</Button><Button size="sm" variant="ghost" onClick={() => despachar({ tipo: "salvarCriativo", criativo: { ...c, ativo: !c.ativo } })}>{c.ativo ? "Pausar" : "Ativar"}</Button></span> },
        ]} />
      </Section>

      <ModalProduto p={produto} onClose={() => setProduto(null)} />
      <ModalFunil f={funil} onClose={() => setFunil(null)} />
      <ModalCriativo c={criativo} onClose={() => setCriativo(null)} />
      <ModalPlaybook p={playbookDe} onClose={() => setPlaybookDe(null)} />
    </>
  );
}

function ModalProduto({ p, onClose }: { p: Partial<Produto> | null; onClose: () => void }) {
  const { despachar } = useCRM();
  const [f, setF] = React.useState({ nome: "", valor: "", parcelas: "", descricao: "", gatilhos: "", ativo: true });
  React.useEffect(() => { if (p) setF({ nome: p.nome ?? "", valor: String(p.valor ?? ""), parcelas: p.parcelas ?? "", descricao: p.descricao ?? "", gatilhos: (p.gatilhos ?? []).join("\n"), ativo: p.ativo ?? true }); }, [p]);
  return (
    <Modal open={!!p} onClose={onClose} title={p?.id ? "Editar produto" : "Novo produto"} footer={<Button onClick={async () => { if (await despachar({ tipo: "salvarProduto", produto: { id: p?.id, nome: f.nome, valor: Number(f.valor), parcelas: f.parcelas, descricao: f.descricao, ativo: f.ativo, gatilhos: f.gatilhos.split("\n").map((s) => s.trim()).filter(Boolean) } }, "Produto salvo.")) onClose(); }}>Salvar</Button>}>
      <div style={{ display: "grid", gap: 10 }}>
        <FormRow>
          <Input label="Nome" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} />
          <Input label="Valor (R$)" type="number" value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} />
          <Input label="Parcelas (texto)" value={f.parcelas} onChange={(e) => setF({ ...f, parcelas: e.target.value })} placeholder="12x R$ 197" />
        </FormRow>
        <Textarea label="Descrição curta (entra na proposta)" rows={2} value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} />
        <Textarea label="Gatilhos: condições verdadeiras de oferta, uma por linha" rows={3} value={f.gatilhos} onChange={(e) => setF({ ...f, gatilhos: e.target.value })} help="Ex.: 'Sessão fechada de quinta: entra até sexta'. A oferta só aceita condição cadastrada aqui." />
        <Switch checked={f.ativo} onChange={(e) => setF({ ...f, ativo: e.target.checked })} label="Ativo" />
      </div>
    </Modal>
  );
}

function ModalFunil({ f, onClose }: { f: Partial<Funil> | null; onClose: () => void }) {
  const { estado, despachar } = useCRM();
  const [v, setV] = React.useState({ nome: "", canal: "", produto: estado.produtos[0]?.id ?? "", ativo: true });
  React.useEffect(() => { if (f) setV({ nome: f.nome ?? "", canal: f.canal ?? "", produto: f.produto ?? estado.produtos[0]?.id ?? "", ativo: f.ativo ?? true }); }, [f, estado.produtos]);
  return (
    <Modal open={!!f} onClose={onClose} title={f?.id ? "Editar funil de entrada" : "Novo funil de entrada"} footer={<Button onClick={async () => { if (await despachar({ tipo: "salvarFunil", funil: { id: f?.id, ...v } }, "Funil salvo.")) onClose(); }}>Salvar</Button>}>
      <FormRow>
        <Input label="Nome" value={v.nome} onChange={(e) => setV({ ...v, nome: e.target.value })} placeholder="Perpétuo, Live semanal, Indicação…" />
        <Input label="Canal" value={v.canal} onChange={(e) => setV({ ...v, canal: e.target.value })} placeholder="Anúncio + formulário" />
        <Select label="Produto padrão" value={v.produto} onChange={(e) => setV({ ...v, produto: e.target.value })}>{estado.produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</Select>
      </FormRow>
      <Switch checked={v.ativo} onChange={(e) => setV({ ...v, ativo: e.target.checked })} label="Ativo" />
      <p className="ds-muted" style={{ fontSize: 13 }}>O id do funil (gerado do nome) é o que você manda no campo <code>origem</code> do webhook de lead.</p>
    </Modal>
  );
}

function ModalCriativo({ c, onClose }: { c: Partial<Criativo> | null; onClose: () => void }) {
  const { estado, despachar } = useCRM();
  const [v, setV] = React.useState({ nome: "", funilId: estado.funis[0]?.id ?? "", plataforma: "Meta Ads", ativo: true });
  React.useEffect(() => { if (c) setV({ nome: c.nome ?? "", funilId: c.funilId ?? estado.funis[0]?.id ?? "", plataforma: c.plataforma ?? "Meta Ads", ativo: c.ativo ?? true }); }, [c, estado.funis]);
  return (
    <Modal open={!!c} onClose={onClose} title={c?.id ? "Editar criativo" : "Novo criativo"} footer={<Button onClick={async () => { if (await despachar({ tipo: "salvarCriativo", criativo: { id: c?.id, ...v } }, "Criativo salvo.")) onClose(); }}>Salvar</Button>}>
      <FormRow>
        <Input label="Nome" value={v.nome} onChange={(e) => setV({ ...v, nome: e.target.value })} />
        <Select label="Funil" value={v.funilId} onChange={(e) => setV({ ...v, funilId: e.target.value })}>{estado.funis.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}</Select>
        <Select label="Plataforma" value={v.plataforma} onChange={(e) => setV({ ...v, plataforma: e.target.value })}><option>Meta Ads</option><option>Google Ads</option><option>TikTok Ads</option><option>Orgânico</option><option>Outro</option></Select>
      </FormRow>
    </Modal>
  );
}

function ModalPlaybook({ p, onClose }: { p: Produto | null; onClose: () => void }) {
  const { despachar } = useCRM();
  const [etapa, setEtapa] = React.useState<EtapaId>("conversa");
  const [v, setV] = React.useState<PerguntaMatadora | null>(null);
  React.useEffect(() => {
    if (!p) return;
    const base = p.playbook.find((x) => x.etapa === etapa) ?? PLAYBOOK.find((x) => x.etapa === etapa)!;
    setV(JSON.parse(JSON.stringify(base)));
  }, [p, etapa]);
  if (!p || !v) return null;
  const salvar = async () => {
    const playbook = [...p.playbook.filter((x) => x.etapa !== etapa), v];
    if (await despachar({ tipo: "salvarProduto", produto: { ...p, playbook } }, `Playbook de "${p.nome}" salvo para a etapa.`)) onClose();
  };
  const restaurar = async () => {
    const playbook = p.playbook.filter((x) => x.etapa !== etapa);
    if (await despachar({ tipo: "salvarProduto", produto: { ...p, playbook } }, "Etapa voltou ao playbook padrão.")) onClose();
  };
  const lista = (k: "complementares" | "objecoes") => v[k].map((x) => Object.values(x).join(" | ")).join("\n");
  return (
    <Modal open onClose={onClose} title={`Playbook próprio · ${p.nome}`} footer={<span className="ds-wrap"><Button variant="ghost" onClick={restaurar}>Usar o padrão nesta etapa</Button><Button onClick={salvar}>Salvar etapa</Button></span>}>
      <div style={{ display: "grid", gap: 10 }}>
        <Select label="Etapa" value={etapa} onChange={(e) => setEtapa(e.target.value as EtapaId)}>{ETAPAS.map((e) => <option key={e.id} value={e.id}>{e.nome}{p.playbook.some((x) => x.etapa === e.id) ? " · própria" : ""}</option>)}</Select>
        <Textarea label="Pergunta Matadora" rows={2} value={v.pergunta} onChange={(e) => setV({ ...v, pergunta: e.target.value })} />
        <Textarea label="Faixas: de | até | ação (uma por linha)" rows={3} value={v.faixas.map((f) => `${f.de} | ${f.ate} | ${f.acao}`).join("\n")} onChange={(e) => setV({ ...v, faixas: e.target.value.split("\n").filter(Boolean).map((l) => { const [de, ate, ...r] = l.split("|"); return { de: Number(de), ate: Number(ate), acao: r.join("|").trim() }; }) })} />
        <Textarea label="Complementares: pergunta | porquê" rows={3} value={lista("complementares")} onChange={(e) => setV({ ...v, complementares: e.target.value.split("\n").filter(Boolean).map((l) => { const [pergunta, porque = ""] = l.split("|"); return { pergunta: pergunta.trim(), porque: porque.trim() }; }) })} />
        <Textarea label="Objeções: objeção | diga | nunca diga" rows={3} value={lista("objecoes")} onChange={(e) => setV({ ...v, objecoes: e.target.value.split("\n").filter(Boolean).map((l) => { const [objecao, diga = "", nuncaDiga = ""] = l.split("|"); return { objecao: objecao.trim(), diga: diga.trim(), nuncaDiga: nuncaDiga.trim() }; }) })} />
        <Input label="Condição" value={v.condicao} onChange={(e) => setV({ ...v, condicao: e.target.value })} />
        <Input label="Próximo passo" value={v.proximoPasso} onChange={(e) => setV({ ...v, proximoPasso: e.target.value })} />
      </div>
    </Modal>
  );
}
