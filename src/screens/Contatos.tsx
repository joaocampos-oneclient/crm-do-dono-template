import * as React from "react";
import { Avatar, Badge, Button, Card, Checkbox, DataTable, DefList, Dropdown, EmptyState, FormRow, Input, List, ListRow, Modal, PageHead, Segmented, Select, Tabs, Textarea, Timeline } from "../ds";
import { useCRM } from "../app/crm";
import { etapaDe, playbookDe, proximaEtapa } from "../domain/funil";
import { acaoDaNota, dataHora, formatarReais, linkWhatsApp, oportunidadePrincipal, preencherTemplate, primeiroNome, proximasAcoes } from "../domain/rules";
import type { Briefing, ContatoCompleto, Oportunidade } from "../domain/types";
import { linhaDoTempo, rotuloEvento } from "../domain/visao";
import { PainelConversa } from "./Conversas";
import { BadgeEtapa, ChipTermometro, Dono, iniciais, nomeFunil, nomeOperador, nomeProduto, perguntar, Vazio } from "./partes";

/** Base de contatos: lista com busca e a ficha completa. */
export function Contatos() {
  const { contatos, rota, navegar } = useCRM();
  const [busca, setBusca] = React.useState("");
  const [novo, setNovo] = React.useState(false);
  const [filtro, setFiltro] = React.useState<"todos" | "lead" | "prospect" | "cliente">("todos");
  const c = rota.id ? contatos.find((x) => x.id === rota.id) : undefined;
  const lista = contatos.filter((x) => (filtro === "todos" || x.categoria === filtro) && (!busca || `${x.nome} ${x.empresa} ${x.telefone} ${x.email} ${x.segmento}`.toLowerCase().includes(busca.toLowerCase())));

  return (
    <>
      <PageHead eyebrow="Operação" title="Contatos" actions={<><Segmented name="cat" label="Categoria" value={filtro} onChange={setFiltro} options={[{ value: "todos", label: "Todos" }, { value: "lead", label: "Leads" }, { value: "prospect", label: "Prospects" }, { value: "cliente", label: "Clientes" }]} /><Button size="sm" onClick={() => setNovo(true)}>Novo contato</Button></>} />
      <div className={c ? "ds-split" : undefined}>
        <div style={{ display: "grid", gap: 10 }}>
          <Input label="Buscar" placeholder="nome, empresa, telefone, e-mail" value={busca} onChange={(e) => setBusca(e.target.value)} />
          <List>
            {lista.length === 0 && <EmptyState title="Nenhum contato" text="Mude o filtro ou cadastre um novo." />}
            {lista.map((x) => {
              const o = oportunidadePrincipal(x.oportunidades);
              return <ListRow key={x.id} onClick={() => navegar({ tela: "contatos", id: x.id })} leading={<Avatar initials={iniciais(x.nome)} />} title={x.nome} subtitle={`${x.empresa || "—"} · ${o ? (o.perdida ? "perdido" : etapaDe(o.etapa)?.nome) : "sem oportunidade"}`} trailing={<Badge tone={x.id === c?.id ? "solid" : "outline"}>{x.categoria}</Badge>} />;
            })}
          </List>
        </div>
        {c && <Ficha c={c} onFechar={() => navegar({ tela: "contatos" })} />}
      </div>
      <ModalContato open={novo} onClose={() => setNovo(false)} />
    </>
  );
}

function Ficha({ c, onFechar }: { c: ContatoCompleto; onFechar: () => void }) {
  const { estado, agora, despachar, operador, ligar } = useCRM();
  const [editando, setEditando] = React.useState(false);
  const [modal, setModal] = React.useState<null | "briefing" | "proposta" | "oferta" | "email" | "oportunidade" | "tarefa">(null);
  const o = oportunidadePrincipal(c.oportunidades);
  const e = o ? etapaDe(o.etapa) : null;
  const prox = o ? proximaEtapa(o.etapa) : null;
  const acoes = proximasAcoes(c, agora);
  const por = operador?.id ?? "sistema";

  const avancar = async () => {
    if (!o || !prox) return;
    if (prox.id === "briefing" && !o.briefing) { setModal("briefing"); return; }
    await despachar({ tipo: "moverEtapa", oportunidadeId: o.id, para: prox.id, por }, `Movido para "${prox.nome}".`);
  };
  const perder = async () => {
    if (!o) return;
    const motivo = perguntar(`Motivo da perda (ex.: ${e?.motivosPerda.join(", ")})`);
    if (!motivo) return;
    await despachar({ tipo: "marcarPerdida", oportunidadeId: o.id, motivo, por }, "Oportunidade perdida, com motivo.");
  };

  return (
    <Card style={{ padding: 16, display: "grid", gap: 14 }}>
      <div className="ds-wrap" style={{ justifyContent: "space-between" }}>
        <div className="ds-wrap">
          <Dono c={c} size={28} />
          <div>
            <h2 style={{ margin: 0 }}>{c.nome}</h2>
            <div className="ds-label">{c.empresa || "—"} · {c.segmento || "—"} · {c.cidade || "—"} · {c.telefone}{c.email ? ` · ${c.email}` : ""} · origem {nomeFunil(estado, c.origem)}</div>
          </div>
        </div>
        <div className="ds-wrap">
          <Badge tone="outline">{c.categoria}</Badge>
          <Button size="sm" variant="secondary" onClick={() => setEditando(true)}>Editar</Button>
          <Button size="sm" variant="secondary" onClick={onFechar}>Fechar</Button>
        </div>
      </div>

      <div className="ds-wrap">
        {o && <BadgeEtapa o={o} />}
        <Badge tone="soft">nota {c.nota ?? "—"} · {acaoDaNota(c.nota)}</Badge>
        <Badge tone="soft">no comando: {c.dono === "robo" ? estado.config.nomeRobo : nomeOperador(estado, c.operadorId)}</Badge>
        <ChipTermometro t={c.termometro} onClick={() => despachar({ tipo: "alternarTermometro", contatoId: c.id })} />
        {o && <Badge tone="fact">{nomeProduto(estado, o.produtoId)} · {formatarReais(o.valor)}</Badge>}
      </div>

      {acoes.length > 0 && (
        <Card tone="alt" style={{ padding: 12 }}>
          <div className="ds-label">Próximas ações sugeridas (a IA sugere, você decide)</div>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{acoes.map((a) => <li key={a.titulo}><strong>{a.titulo}</strong> · {a.porque}</li>)}</ul>
        </Card>
      )}

      <div className="ds-wrap">
        <Button size="sm" variant="secondary" onClick={() => ligar(c.id)}>Ligar</Button>
        {o && !o.perdida && prox && !prox.auto && <Button size="sm" variant="secondary" onClick={avancar}>Avançar para "{prox.nome}"</Button>}
        {o && !o.perdida && <Button size="sm" variant="secondary" onClick={() => setModal("briefing")}>{o.briefing ? "Editar briefing" : "Preencher briefing"}</Button>}
        {o && !o.perdida && o.briefing && <Button size="sm" variant="secondary" onClick={() => setModal("proposta")}>Gerar proposta</Button>}
        {o && !o.perdida && ["proposta", "oferta", "briefing"].includes(o.etapa) && <Button size="sm" onClick={() => setModal("oferta")}>Oferta com condição (link de pagamento)</Button>}
        <Dropdown label="Mais" items={[
          { id: "email", label: "Enviar e-mail", onSelect: () => setModal("email"), disabled: !c.email },
          { id: "tarefa", label: "Criar tarefa", onSelect: () => setModal("tarefa") },
          { id: "op", label: "Nova oportunidade (outro produto)", onSelect: () => setModal("oportunidade") },
          { id: "perder", label: "Marcar como perdida", onSelect: perder, danger: true, disabled: !o || o.perdida },
          { id: "reabrir", label: "Reabrir oportunidade", onSelect: () => o && despachar({ tipo: "reabrir", oportunidadeId: o.id, por }, "Reaberta."), disabled: !o || !o.perdida },
        ]} />
      </div>

      <Tabs label="Seções do contato" items={[
        { id: "conversa", label: `Conversa (${c.mensagens.length})`, panel: <PainelConversa c={c} compacto /> },
        { id: "canvas", label: "Canvas da etapa", panel: <Canvas c={c} o={o} /> },
        { id: "linha", label: "Linha do tempo", panel: <Timeline label="Linha do tempo" items={linhaDoTempo(estado, c).map((ev) => ({ time: rotuloEvento(ev).split(" · ")[0], tag: ev.tipo, text: ev.texto }))} /> },
        { id: "ligacoes", label: `Ligações (${c.ligacoes.length})`, panel: <Ligacoes c={c} /> },
        { id: "tarefas", label: `Tarefas (${c.tarefas.filter((t) => !t.feita).length})`, panel: <Tarefas c={c} /> },
        { id: "emails", label: `E-mails (${c.emails.length})`, panel: c.emails.length === 0 ? <Vazio>Nenhum e-mail. Use "Mais → Enviar e-mail" (precisa de e-mail cadastrado).</Vazio> : <div style={{ display: "grid", gap: 10 }}>{c.emails.map((m) => <div key={m.id}><div className="ds-label">{dataHora(m.em)} · {nomeOperador(estado, m.enviadoPor)}</div><strong>{m.assunto}</strong><pre className="ds-pre">{m.texto}</pre></div>)}</div> },
        { id: "pag", label: `Pagamentos (${c.pagamentos.length})`, panel: <Pagamentos c={c} /> },
        { id: "ops", label: `Oportunidades (${c.oportunidades.length})`, panel: <DataTable rowKey={(x) => x.id} rows={c.oportunidades} columns={[{ key: "p", header: "Produto", render: (x) => nomeProduto(estado, x.produtoId) }, { key: "v", header: "Valor", numeric: true, render: (x) => formatarReais(x.valor) }, { key: "e", header: "Etapa", render: (x) => <BadgeEtapa o={x} /> }, { key: "d", header: "Criada", render: (x) => dataHora(x.criadaEm) }]} /> },
      ]} />

      <ModalContato open={editando} onClose={() => setEditando(false)} contato={c} />
      {o && <ModalBriefing open={modal === "briefing"} onClose={() => setModal(null)} o={o} />}
      {o && <ModalProposta open={modal === "proposta"} onClose={() => setModal(null)} c={c} o={o} />}
      {o && <ModalOferta open={modal === "oferta"} onClose={() => setModal(null)} c={c} o={o} />}
      <ModalEmail open={modal === "email"} onClose={() => setModal(null)} c={c} />
      <ModalTarefa open={modal === "tarefa"} onClose={() => setModal(null)} c={c} />
      <ModalOportunidade open={modal === "oportunidade"} onClose={() => setModal(null)} c={c} />
    </Card>
  );
}

function Canvas({ c, o }: { c: ContatoCompleto; o: Oportunidade | null }) {
  const { estado } = useCRM();
  if (!o) return <Vazio>Sem oportunidade.</Vazio>;
  const e = etapaDe(o.etapa)!;
  const pb = playbookDe(o.etapa, estado.produtos.find((p) => p.id === o.produtoId));
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <DefList items={[["Objetivo", e.objetivo], ["Como validar", e.validacao], ["Prazo", e.prazoTexto], ["Meta de conversão (sua)", `${e.meta}%`], ["Quem move", e.auto ? "o sistema" : "você"], ["Motivos de perda", e.motivosPerda.join(" · ")]]} />
      {o.briefing ? <DefList items={[["Dor", o.briefing.dor], ["Meta", o.briefing.meta], ["Data", o.briefing.data]]} /> : <Vazio>Briefing ainda não preenchido.</Vazio>}
      {pb && (
        <Card tone="alt" style={{ padding: 12, display: "grid", gap: 6 }}>
          <div className="ds-label">Pergunta Matadora desta etapa</div>
          <strong>{preencherTemplate(pb.pergunta.replace(/\[(.+?)\]/g, "{$1}"), { nome: primeiroNome(c.nome), nota: String(c.nota ?? "—"), operador: nomeOperador(estado, c.operadorId), "o que você vende": nomeProduto(estado, o.produtoId), origem: nomeFunil(estado, c.origem) })}</strong>
          <div className="ds-label">Próximo passo: {pb.proximoPasso}</div>
        </Card>
      )}
    </div>
  );
}

function Ligacoes({ c }: { c: ContatoCompleto }) {
  const { estado } = useCRM();
  if (c.ligacoes.length === 0) return <EmptyState title="Nenhuma ligação registrada" text="Clique em Ligar. A ligação é gravada com aviso e a transcrição aparece aqui." />;
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {c.ligacoes.map((l) => (
        <div key={l.id} style={{ display: "grid", gap: 8 }}>
          <div className="ds-label">{dataHora(l.iniciouEm)} · {Math.round(l.duracaoSeg / 60)} min · {l.resultado} · {nomeOperador(estado, l.operadorId)}</div>
          {l.resumo && <p style={{ margin: 0 }}>{l.resumo}</p>}
          {l.trechos.length > 0 && <Timeline label="Transcrição" items={l.trechos.map((t) => ({ time: t.hora, tag: t.marca ?? (t.quem === "vendedor" ? "você" : "contato"), text: t.texto }))} />}
          {l.followups.length > 0 && <><div className="ds-label">Follow-ups</div><ul style={{ margin: 0, paddingLeft: 18 }}>{l.followups.map((f) => <li key={f.texto}>{f.texto} · {f.quando} (trecho {f.origem})</li>)}</ul></>}
          <div className="ds-label">Termômetro: você marcou {l.termometroVendedor}; a IA leu {l.termometroIA}. Vale o seu.</div>
        </div>
      ))}
    </div>
  );
}

function Tarefas({ c }: { c: ContatoCompleto }) {
  const { despachar, agora } = useCRM();
  if (c.tarefas.length === 0) return <Vazio>Nenhuma tarefa. Follow-ups de ligação viram tarefas sozinhos.</Vazio>;
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {c.tarefas.sort((a, b) => Number(a.feita) - Number(b.feita)).map((t) => (
        <Checkbox key={t.id} checked={t.feita} onChange={(e) => despachar({ tipo: "concluirTarefa", tarefaId: t.id, feita: e.target.checked })} label={<span style={{ textDecoration: t.feita ? "line-through" : undefined }}>{t.texto} <span className="ds-label">{t.venceEm ? `· vence ${dataHora(t.venceEm)}${!t.feita && Date.parse(t.venceEm) < Date.parse(agora) ? " · vencida" : ""}` : ""} · {t.origem}</span></span>} />
      ))}
    </div>
  );
}

function Pagamentos({ c }: { c: ContatoCompleto }) {
  const { despachar } = useCRM();
  if (c.pagamentos.length === 0) return <Vazio>Nenhum pagamento. Crie um link em "Oferta com condição".</Vazio>;
  return (
    <DataTable rowKey={(p) => p.id} rows={c.pagamentos} columns={[
      { key: "d", header: "Criado", render: (p) => dataHora(p.criadoEm) },
      { key: "m", header: "Método", render: (p) => p.metodo },
      { key: "v", header: "Valor", numeric: true, render: (p) => formatarReais(p.valor) },
      { key: "s", header: "Status", render: (p) => <Badge tone={p.status === "pago" ? "fact" : p.status === "pendente" ? "outline" : "dashed"}>{p.status}{p.pagoEm ? ` · ${dataHora(p.pagoEm)}` : ""}</Badge> },
      { key: "a", header: "", render: (p) => p.status === "pendente" ? <span className="ds-wrap"><Button size="sm" variant="secondary" onClick={() => despachar({ tipo: "confirmarPagamento", pagamentoId: p.id }, "Pagamento confirmado (simulado). Em produção vem do webhook.")}>Simular pago</Button><Button size="sm" variant="ghost" onClick={() => despachar({ tipo: "falharPagamento", pagamentoId: p.id })}>Simular falha</Button></span> : null },
    ]} />
  );
}

/* ---------------- Modais ---------------- */

export function ModalContato({ open, onClose, contato }: { open: boolean; onClose: () => void; contato?: ContatoCompleto }) {
  const { estado, despachar, navegar } = useCRM();
  const [f, setF] = React.useState({ nome: "", empresa: "", segmento: "", cidade: "", telefone: "", email: "", origem: estado.funis[0]?.id ?? "" });
  React.useEffect(() => { if (open) setF({ nome: contato?.nome ?? "", empresa: contato?.empresa ?? "", segmento: contato?.segmento ?? "", cidade: contato?.cidade ?? "", telefone: contato?.telefone ?? "", email: contato?.email ?? "", origem: contato?.origem ?? estado.funis[0]?.id ?? "" }); }, [open, contato, estado.funis]);
  const salvar = async () => {
    if (contato) { if (await despachar({ tipo: "salvarContato", contato: { id: contato.id, ...f } }, "Contato salvo.")) onClose(); return; }
    const novo = await despachar({ tipo: "criarLead", nome: f.nome, telefone: f.telefone, origem: f.origem, empresa: f.empresa, segmento: f.segmento, cidade: f.cidade, email: f.email, por: "manual" }, `Contato criado. ${estado.config.nomeRobo} abriu a conversa.`);
    if (novo) { onClose(); const criado = novo.contatos.find((x) => x.telefone === f.telefone); navegar({ tela: "contatos", id: criado?.id }); }
  };
  const campo = (k: keyof typeof f, label: string, type = "text") => <Input label={label} type={type} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />;
  return (
    <Modal open={open} onClose={onClose} title={contato ? "Editar contato" : "Novo contato"} footer={<Button onClick={salvar}>Salvar</Button>}>
      <FormRow>{campo("nome", "Nome")}{campo("telefone", "WhatsApp", "tel")}{campo("email", "E-mail", "email")}{campo("empresa", "Empresa")}{campo("segmento", "Segmento")}{campo("cidade", "Cidade")}
        <Select label="Funil de origem" value={f.origem} onChange={(e) => setF({ ...f, origem: e.target.value })}>{estado.funis.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</Select>
      </FormRow>
    </Modal>
  );
}

function ModalBriefing({ open, onClose, o }: { open: boolean; onClose: () => void; o: Oportunidade }) {
  const { despachar, operador } = useCRM();
  const [b, setB] = React.useState<Briefing>({ dor: "", meta: "", data: "" });
  React.useEffect(() => { if (open) setB(o.briefing ?? { dor: "", meta: "", data: "" }); }, [open, o.briefing]);
  return (
    <Modal open={open} onClose={onClose} title="Briefing: dor, meta e data" footer={<Button onClick={async () => { if (await despachar({ tipo: "salvarBriefing", oportunidadeId: o.id, briefing: b, por: operador?.id ?? "sistema" }, "Briefing salvo.")) onClose(); }}>Salvar</Button>}>
      <div style={{ display: "grid", gap: 10 }}>
        <Textarea label="Dor (nas palavras do contato)" rows={2} value={b.dor} onChange={(e) => setB({ ...b, dor: e.target.value })} />
        <Textarea label="Meta (o que muda se resolver)" rows={2} value={b.meta} onChange={(e) => setB({ ...b, meta: e.target.value })} />
        <Input label="Data (até quando precisa estar resolvido)" value={b.data} onChange={(e) => setB({ ...b, data: e.target.value })} placeholder="30/11" />
        <p className="ds-muted" style={{ margin: 0, fontSize: 13 }}>Com os três preenchidos, o card vai para "Briefing feito" sozinho.</p>
      </div>
    </Modal>
  );
}

function ModalProposta({ open, onClose, c, o }: { open: boolean; onClose: () => void; c: ContatoCompleto; o: Oportunidade }) {
  const { estado, despachar, operador } = useCRM();
  const produto = estado.produtos.find((p) => p.id === o.produtoId);
  const gerar = () => `${primeiroNome(c.nome)}, pelo que você me contou, a dor hoje é: ${o.briefing?.dor}. A meta é: ${o.briefing?.meta}, até ${o.briefing?.data}.\n\nProposta: ${produto?.nome}${produto?.descricao ? ` — ${produto.descricao}` : ""}. Começamos pela sua dor na primeira semana.\n\nInvestimento: ${formatarReais(o.valor)}${produto?.parcelas ? ` (${produto.parcelas})` : ""}.\n\nSe fizer sentido, te mando o passo a passo para começar. — ${operador?.nome ?? ""}`;
  const [texto, setTexto] = React.useState("");
  React.useEffect(() => { if (open) setTexto(gerar()); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const ultima = c.propostas.at(-1);
  const enviar = async (canal: "whatsapp" | "email") => {
    const por = operador?.id ?? "sistema";
    const novo = await despachar({ tipo: "gerarProposta", oportunidadeId: o.id, texto, por });
    if (!novo) return;
    const proposta = novo.propostas.filter((p) => p.oportunidadeId === o.id).at(-1)!;
    if (!(await despachar({ tipo: "enviarProposta", propostaId: proposta.id, canal, por }, canal === "whatsapp" ? "Proposta registrada e WhatsApp aberto com o texto." : "Proposta registrada e e-mail enviado (simulado)."))) return;
    onClose();
    if (canal === "whatsapp") window.open(linkWhatsApp(c.telefone, texto), "_blank", "noopener");
  };
  return (
    <Modal open={open} onClose={onClose} title="Gerar proposta a partir do briefing" footer={<span className="ds-wrap"><Button variant="secondary" onClick={() => enviar("email")} disabled={!c.email}>Salvar e enviar por e-mail</Button><Button onClick={() => enviar("whatsapp")}>Salvar e enviar por WhatsApp</Button></span>}>
      <div style={{ display: "grid", gap: 10 }}>
        <Textarea label="Texto da proposta (edite à vontade)" rows={10} value={texto} onChange={(e) => setTexto(e.target.value)} />
        {ultima && <div className="ds-label">Última proposta: {dataHora(ultima.criadaEm)}{ultima.abertaEm ? ` · aberta ${dataHora(ultima.abertaEm)}` : " · ainda não aberta"}</div>}
        <p className="ds-muted" style={{ margin: 0, fontSize: 13 }}>"Enviar por WhatsApp" abre o WhatsApp Web com o texto pronto e registra a proposta aqui. Quando o contato abrir o link da proposta, o sistema move o card para "Proposta aberta" (<code>registrarAberturaProposta</code>).</p>
      </div>
    </Modal>
  );
}

function ModalOferta({ open, onClose, c, o }: { open: boolean; onClose: () => void; c: ContatoCompleto; o: Oportunidade }) {
  const { estado, despachar, operador } = useCRM();
  const produto = estado.produtos.find((p) => p.id === o.produtoId);
  const [valor, setValor] = React.useState(String(o.valor));
  const [metodo, setMetodo] = React.useState<"pix" | "cartao" | "boleto">("pix");
  const [dias, setDias] = React.useState("3");
  const [condicao, setCondicao] = React.useState(produto?.gatilhos[0] ?? "");
  React.useEffect(() => { if (open) { setValor(String(o.valor)); setCondicao(produto?.gatilhos[0] ?? ""); } }, [open, o.valor, produto]);
  return (
    <Modal open={open} onClose={onClose} title="Oferta com condição e prazo" footer={<Button onClick={async () => { if (await despachar({ tipo: "criarLinkPagamento", oportunidadeId: o.id, valor: Number(valor), metodo, validadeDias: Number(dias), condicao, por: operador?.id ?? "sistema" }, "Link criado e enviado na conversa. Card em 'Oferta'.")) onClose(); }}>Criar link e enviar</Button>}>
      <div style={{ display: "grid", gap: 10 }}>
        <FormRow>
          <Input label="Valor (R$)" type="number" value={valor} onChange={(e) => setValor(e.target.value)} />
          <Select label="Método" value={metodo} onChange={(e) => setMetodo(e.target.value as typeof metodo)}><option value="pix">Pix</option><option value="cartao">Cartão</option><option value="boleto">Boleto</option></Select>
          <Input label="Validade (dias)" type="number" min={1} max={30} value={dias} onChange={(e) => setDias(e.target.value)} />
        </FormRow>
        <Select label="Condição verdadeira (gatilho cadastrado no produto)" value={condicao} onChange={(e) => setCondicao(e.target.value)}>
          <option value="">— escolher —</option>
          {(produto?.gatilhos ?? []).map((g) => <option key={g} value={g}>{g}</option>)}
        </Select>
        {(produto?.gatilhos.length ?? 0) === 0 && <p className="ds-muted" style={{ margin: 0 }}>Este produto não tem gatilhos cadastrados. Cadastre em Produtos e funis; condição inventada na hora não vale.</p>}
        <p className="ds-muted" style={{ margin: 0, fontSize: 13 }}>Para {primeiroNome(c.nome)}. Em produção, o link vem do provedor de pagamento (Stripe, Asaas, Pagar.me) e a confirmação chega por webhook em <code>POST /api/webhooks/pagamento</code>.</p>
      </div>
    </Modal>
  );
}

function ModalEmail({ open, onClose, c }: { open: boolean; onClose: () => void; c: ContatoCompleto }) {
  const { estado, despachar, operador } = useCRM();
  const templates = estado.templates.filter((t) => t.canal === "email");
  const o = oportunidadePrincipal(c.oportunidades);
  const vars = { nome: primeiroNome(c.nome), empresa: estado.config.nomeEmpresa, produto: o ? nomeProduto(estado, o.produtoId) : "", operador: operador?.nome ?? "", link: "https://exemplo.invalid/link" };
  const [assunto, setAssunto] = React.useState("");
  const [texto, setTexto] = React.useState("");
  return (
    <Modal open={open} onClose={onClose} title={`E-mail para ${c.email || "(sem e-mail)"}`} footer={<Button onClick={async () => { if (await despachar({ tipo: "enviarEmail", contatoId: c.id, assunto, texto, por: operador?.id ?? null }, "E-mail registrado (envio simulado).")) { onClose(); setAssunto(""); setTexto(""); } }}>Enviar</Button>}>
      <div style={{ display: "grid", gap: 10 }}>
        <Select label="Modelo de sugestão" value="" onChange={(e) => { const t = templates.find((x) => x.id === e.target.value); if (t) { setAssunto(preencherTemplate(t.assunto ?? "", vars)); setTexto(preencherTemplate(t.texto, vars)); } }}>
          <option value="">— escolher —</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </Select>
        <Input label="Assunto" value={assunto} onChange={(e) => setAssunto(e.target.value)} />
        <Textarea label="Texto" rows={8} value={texto} onChange={(e) => setTexto(e.target.value)} />
        <p className="ds-muted" style={{ margin: 0, fontSize: 13 }}>Envio real: adaptador de e-mail (Resend, SES) no servidor. Veja docs/integracoes.md.</p>
      </div>
    </Modal>
  );
}

function ModalTarefa({ open, onClose, c }: { open: boolean; onClose: () => void; c: ContatoCompleto }) {
  const { despachar, agora } = useCRM();
  const [texto, setTexto] = React.useState("");
  const [quando, setQuando] = React.useState(agora.slice(0, 16));
  return (
    <Modal open={open} onClose={onClose} title="Nova tarefa" footer={<Button onClick={async () => { if (await despachar({ tipo: "criarTarefa", contatoId: c.id, texto, venceEm: quando ? new Date(quando).toISOString() : null, origem: "manual" }, "Tarefa criada.")) { onClose(); setTexto(""); } }}>Criar</Button>}>
      <div style={{ display: "grid", gap: 10 }}>
        <Input label="O que fazer" value={texto} onChange={(e) => setTexto(e.target.value)} />
        <Input label="Quando" type="datetime-local" value={quando} onChange={(e) => setQuando(e.target.value)} />
      </div>
    </Modal>
  );
}

function ModalOportunidade({ open, onClose, c }: { open: boolean; onClose: () => void; c: ContatoCompleto }) {
  const { estado, despachar, operador } = useCRM();
  const [produtoId, setProdutoId] = React.useState(estado.produtos[0]?.id ?? "");
  return (
    <Modal open={open} onClose={onClose} title="Nova oportunidade para este contato" footer={<Button onClick={async () => { if (await despachar({ tipo: "criarOportunidade", contatoId: c.id, produtoId, por: operador?.id ?? "sistema" }, "Oportunidade criada em 'Lead novo'.")) onClose(); }}>Criar</Button>}>
      <Select label="Produto" value={produtoId} onChange={(e) => setProdutoId(e.target.value)}>{estado.produtos.filter((p) => p.ativo).map((p) => <option key={p.id} value={p.id}>{p.nome} · {formatarReais(p.valor)}</option>)}</Select>
      <p className="ds-muted" style={{ fontSize: 13 }}>Um contato pode ter várias oportunidades (ex.: comunidade e, depois, imersão). A categoria do contato é calculada pela melhor delas.</p>
    </Modal>
  );
}
