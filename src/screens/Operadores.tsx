import * as React from "react";
import { Badge, Button, Card, DataTable, FormRow, Input, Modal, Orb, PageHead, Section, Select, Switch } from "../ds";
import { useCRM } from "../app/crm";
import { dataHora } from "../domain/rules";
import type { Escopo, Operador, Papel } from "../domain/types";
import { nomeOperador } from "./partes";

/** Operadores (humanos e IA) e chaves de API. As chaves dão os três níveis de acesso para agentes: leitura, escrita, navegador. */
export function Operadores() {
  const { estado, despachar, operador } = useCRM();
  const [editando, setEditando] = React.useState<Partial<Operador> | null>(null);
  const [novaChave, setNovaChave] = React.useState<{ nome: string; escopo: Escopo; operadorId: string } | null>(null);
  const [mostrar, setMostrar] = React.useState<Record<string, boolean>>({});

  return (
    <>
      <PageHead eyebrow="Configuração" title="Operadores e chaves" />
      <Section title="Operadores" aside={<Button size="sm" onClick={() => setEditando({})}>Novo operador</Button>}>
        <DataTable rowKey={(o) => o.id} rows={estado.operadores} columns={[
          { key: "n", header: "Nome", render: (o) => <span className="ds-wrap">{o.tipo === "ia" ? <Orb size={18} /> : null}{o.nome}{!o.ativo && <Badge tone="dashed">inativo</Badge>}{o.id === operador?.id && <Badge tone="fact">você</Badge>}</span> },
          { key: "t", header: "Tipo", render: (o) => (o.tipo === "ia" ? <span className="ds-tag-ia">IA</span> : "humano") },
          { key: "p", header: "Papel", render: (o) => o.papel },
          { key: "e", header: "E-mail", render: (o) => o.email ?? "—" },
          { key: "c", header: "Conversas", numeric: true, render: (o) => estado.contatos.filter((c) => (o.id === estado.config.roboOperadorId ? c.dono === "robo" : c.operadorId === o.id)).length },
          { key: "a", header: "", render: (o) => <span className="ds-wrap"><Button size="sm" variant="secondary" onClick={() => setEditando(o)}>Editar</Button>{o.ativo && <Button size="sm" variant="ghost" onClick={() => despachar({ tipo: "removerOperador", operadorId: o.id }, "Operador desativado.")}>Desativar</Button>}</span> },
        ]} />
        <Card tone="alt" style={{ padding: 12 }}>
          <div className="ds-label">Papéis</div>
          <p style={{ margin: "4px 0 0", fontSize: 14 }}><strong>dono</strong>: tudo. <strong>vendedor</strong>: opera o funil. <strong>leitura</strong>: só lê (para o Grokbot consultar). <strong>bot</strong>: usuário de testes para um agente abrir o CRM no navegador e clicar. Login real por papel: docs/banco-de-dados.md.</p>
        </Card>
      </Section>

      <Section title="Chaves de API" aside={<Button size="sm" onClick={() => setNovaChave({ nome: "", escopo: "leitura", operadorId: estado.operadores.find((o) => o.papel === "leitura")?.id ?? "" })}>Nova chave</Button>}>
        <DataTable rowKey={(k) => k.id} rows={estado.chaves} columns={[
          { key: "n", header: "Nome", render: (k) => k.nome },
          { key: "e", header: "Escopo", render: (k) => <Badge tone={k.escopo === "escrita" ? "solid" : "outline"}>{k.escopo}</Badge> },
          { key: "o", header: "Operador", render: (k) => nomeOperador(estado, k.operadorId) },
          { key: "k", header: "Chave", render: (k) => <span className="ds-wrap"><code>{mostrar[k.id] ? k.chave : `${k.chave.slice(0, 14)}…`}</code><Button size="sm" variant="ghost" onClick={() => setMostrar({ ...mostrar, [k.id]: !mostrar[k.id] })}>{mostrar[k.id] ? "ocultar" : "mostrar"}</Button><Button size="sm" variant="ghost" onClick={() => navigator.clipboard?.writeText(k.chave)}>copiar</Button></span> },
          { key: "d", header: "Criada", render: (k) => dataHora(k.criadaEm) },
          { key: "s", header: "", render: (k) => k.revogadaEm ? <Badge tone="dashed">revogada</Badge> : <Button size="sm" variant="ghost" onClick={() => despachar({ tipo: "revogarChaveApi", chaveId: k.id }, "Chave revogada.")}>Revogar</Button> },
        ]} />
        <p className="ds-muted" style={{ margin: 0, fontSize: 13 }}>As chaves de exemplo (<code>…exemplo_troque_esta_chave</code>) servem para testar localmente. Antes de publicar, revogue e crie as suas. Escopo <strong>leitura</strong> só consulta; <strong>escrita</strong> cria leads, move cards, envia mensagens. Como usar: <a href="#/integracoes">Integrações</a>.</p>
      </Section>

      <ModalOperador o={editando} onClose={() => setEditando(null)} />
      <Modal open={!!novaChave} onClose={() => setNovaChave(null)} title="Nova chave de API" footer={<Button onClick={async () => { if (novaChave && await despachar({ tipo: "criarChaveApi", nome: novaChave.nome, escopo: novaChave.escopo, operadorId: novaChave.operadorId || null }, "Chave criada. Copie e guarde.")) setNovaChave(null); }}>Criar</Button>}>
        {novaChave && (
          <FormRow>
            <Input label="Nome (para que serve)" value={novaChave.nome} onChange={(e) => setNovaChave({ ...novaChave, nome: e.target.value })} placeholder="Grokbot leitura, Meta Ads webhook…" />
            <Select label="Escopo" value={novaChave.escopo} onChange={(e) => setNovaChave({ ...novaChave, escopo: e.target.value as Escopo })}><option value="leitura">leitura</option><option value="escrita">escrita</option></Select>
            <Select label="Operador (quem assina as ações)" value={novaChave.operadorId} onChange={(e) => setNovaChave({ ...novaChave, operadorId: e.target.value })}><option value="">—</option>{estado.operadores.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}</Select>
          </FormRow>
        )}
      </Modal>
    </>
  );
}

function ModalOperador({ o, onClose }: { o: Partial<Operador> | null; onClose: () => void }) {
  const { despachar } = useCRM();
  const [v, setV] = React.useState({ nome: "", papel: "vendedor" as Papel, tipo: "humano" as Operador["tipo"], email: "", ativo: true });
  React.useEffect(() => { if (o) setV({ nome: o.nome ?? "", papel: o.papel ?? "vendedor", tipo: o.tipo ?? "humano", email: o.email ?? "", ativo: o.ativo ?? true }); }, [o]);
  return (
    <Modal open={!!o} onClose={onClose} title={o?.id ? "Editar operador" : "Novo operador"} footer={<Button onClick={async () => { if (await despachar({ tipo: "salvarOperador", operador: { id: o?.id, ...v, email: v.email || undefined } }, "Operador salvo.")) onClose(); }}>Salvar</Button>}>
      <FormRow>
        <Input label="Nome" value={v.nome} onChange={(e) => setV({ ...v, nome: e.target.value })} />
        <Input label="E-mail" type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
        <Select label="Papel" value={v.papel} onChange={(e) => setV({ ...v, papel: e.target.value as Papel })}><option value="dono">dono</option><option value="vendedor">vendedor</option><option value="leitura">leitura</option><option value="bot">bot</option></Select>
        <Select label="Tipo" value={v.tipo} onChange={(e) => setV({ ...v, tipo: e.target.value as Operador["tipo"] })}><option value="humano">humano</option><option value="ia">IA</option></Select>
      </FormRow>
      <Switch checked={v.ativo} onChange={(e) => setV({ ...v, ativo: e.target.checked })} label="Ativo" />
    </Modal>
  );
}
