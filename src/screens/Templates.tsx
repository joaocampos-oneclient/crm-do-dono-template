import * as React from "react";
import { Badge, Button, DataTable, FormRow, Input, Modal, PageHead, Select, Textarea } from "../ds";
import { useCRM } from "../app/crm";
import { preencherTemplate } from "../domain/rules";
import type { Template } from "../domain/types";

/** Templates de WhatsApp e e-mail com variáveis. Aparecem como "template rápido" na conversa e como "modelo de sugestão" no e-mail. */
export function Templates() {
  const { estado, despachar } = useCRM();
  const [t, setT] = React.useState<Partial<Template> | null>(null);
  const exemplo = { nome: "Mariana", empresa: estado.config.nomeEmpresa, produto: estado.produtos[0]?.nome ?? "produto", operador: "Otávio", link: "https://exemplo.invalid/link" };
  return (
    <>
      <PageHead eyebrow="Configuração" title="Templates" actions={<Button size="sm" onClick={() => setT({})}>Novo template</Button>}>
        <p className="ds-muted" style={{ margin: "4px 0 0" }}>Variáveis: <code>{"{nome}"}</code> <code>{"{empresa}"}</code> <code>{"{produto}"}</code> <code>{"{operador}"}</code> <code>{"{link}"}</code>. Templates do robô passam pela trava de preço: não escreva valor neles.</p>
      </PageHead>
      <DataTable rowKey={(x) => x.id} rows={estado.templates} columns={[
        { key: "n", header: "Nome", render: (x) => x.nome },
        { key: "c", header: "Canal", render: (x) => <Badge tone="outline">{x.canal}</Badge> },
        { key: "p", header: "Prévia", render: (x) => <span style={{ whiteSpace: "pre-wrap" }}>{x.assunto ? <strong>{preencherTemplate(x.assunto, exemplo)}<br /></strong> : null}{preencherTemplate(x.texto, exemplo).slice(0, 160)}{x.texto.length > 160 ? "…" : ""}</span> },
        { key: "a", header: "", render: (x) => <span className="ds-wrap"><Button size="sm" variant="secondary" onClick={() => setT(x)}>Editar</Button><Button size="sm" variant="ghost" onClick={() => despachar({ tipo: "removerTemplate", templateId: x.id }, "Template removido.")}>Remover</Button></span> },
      ]} />
      <ModalTemplate t={t} onClose={() => setT(null)} />
    </>
  );
}

function ModalTemplate({ t, onClose }: { t: Partial<Template> | null; onClose: () => void }) {
  const { despachar } = useCRM();
  const [v, setV] = React.useState({ nome: "", canal: "whatsapp" as Template["canal"], assunto: "", texto: "" });
  React.useEffect(() => { if (t) setV({ nome: t.nome ?? "", canal: t.canal ?? "whatsapp", assunto: t.assunto ?? "", texto: t.texto ?? "" }); }, [t]);
  return (
    <Modal open={!!t} onClose={onClose} title={t?.id ? "Editar template" : "Novo template"} footer={<Button onClick={async () => { if (await despachar({ tipo: "salvarTemplate", template: { id: t?.id, nome: v.nome, canal: v.canal, assunto: v.canal === "email" ? v.assunto : null, texto: v.texto } }, "Template salvo.")) onClose(); }}>Salvar</Button>}>
      <div style={{ display: "grid", gap: 10 }}>
        <FormRow>
          <Input label="Nome" value={v.nome} onChange={(e) => setV({ ...v, nome: e.target.value })} />
          <Select label="Canal" value={v.canal} onChange={(e) => setV({ ...v, canal: e.target.value as Template["canal"] })}><option value="whatsapp">WhatsApp</option><option value="email">E-mail</option></Select>
        </FormRow>
        {v.canal === "email" && <Input label="Assunto" value={v.assunto} onChange={(e) => setV({ ...v, assunto: e.target.value })} />}
        <Textarea label="Texto" rows={6} value={v.texto} onChange={(e) => setV({ ...v, texto: e.target.value })} />
      </div>
    </Modal>
  );
}
