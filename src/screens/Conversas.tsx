import * as React from "react";
import { Badge, Button, Card, ChatBubble, Dropdown, EmptyState, List, ListRow, Modal, PageHead, Segmented, Select, Textarea } from "../ds";
import { useCRM } from "../app/crm";
import { etapaDe } from "../domain/funil";
import { dataHora, horaDe, oportunidadePrincipal, preencherTemplate, primeiroNome } from "../domain/rules";
import type { ContatoCompleto, Mensagem } from "../domain/types";
import { Dono, nomeOperador } from "./partes";

const autorChat = (a: Mensagem["autor"]) => (a === "contato" ? "lead" : a);

/** Conversas: painel para assistir o Cláudio e os humanos trabalhando. Assumir, devolver, enviar, registrar ocorrência, notas. */
export function Conversas() {
  const { contatos, rota, navegar, estado } = useCRM();
  const [filtro, setFiltro] = React.useState<"todas" | "robo" | "humano" | "handoff">("todas");
  const lista = contatos
    .filter((c) => c.mensagens.length > 0)
    .filter((c) => filtro === "todas" || (filtro === "handoff" ? c.handoffPendente : c.dono === filtro))
    .sort((a, b) => Date.parse(b.mensagens.at(-1)!.em) - Date.parse(a.mensagens.at(-1)!.em));
  const aberto = rota.id ? contatos.find((c) => c.id === rota.id) : lista[0];

  return (
    <>
      <PageHead eyebrow="Operação" title="Conversas" actions={<Segmented name="filtro-conversas" label="Filtro" value={filtro} onChange={setFiltro} options={[{ value: "todas", label: "Todas" }, { value: "robo", label: `Com ${estado.config.nomeRobo}` }, { value: "humano", label: "Com humano" }, { value: "handoff", label: "Pediu humano" }]} />} />
      <div className="ds-split--wide ds-split">
        <List>
          {lista.length === 0 && <EmptyState title="Nenhuma conversa" text="Quando um lead chegar, o Cláudio abre a conversa e ela aparece aqui." />}
          {lista.map((c) => {
            const ult = c.mensagens.at(-1)!;
            return <ListRow key={c.id} onClick={() => navegar({ tela: "conversas", id: c.id })} className={aberto?.id === c.id ? "is-active" : undefined} leading={<Dono c={c} />} title={<span className="ds-wrap">{c.nome}{c.handoffPendente && <Badge tone="solid">pediu humano</Badge>}</span>} subtitle={`${ult.autor === "contato" ? "" : ult.autor === "robo" ? `${estado.config.nomeRobo}: ` : "Você: "}${ult.texto.slice(0, 70)}${ult.texto.length > 70 ? "…" : ""}`} trailing={<span className="ds-label">{horaDe(ult.em)}</span>} />;
          })}
        </List>
        {aberto ? <PainelConversa c={aberto} /> : <Card style={{ padding: 16 }}>Escolha uma conversa.</Card>}
      </div>
    </>
  );
}

export function PainelConversa({ c, compacto = false }: { c: ContatoCompleto; compacto?: boolean }) {
  const { estado, operador, despachar, abrirContato, ligar } = useCRM();
  const [texto, setTexto] = React.useState("");
  const [simulando, setSimulando] = React.useState(false);
  const [textoLead, setTextoLead] = React.useState("");
  const [selecionando, setSelecionando] = React.useState(false);
  const [selecionadas, setSelecionadas] = React.useState<Set<string>>(new Set());
  const [ocorrencia, setOcorrencia] = React.useState<null | { tipo: "problema" | "melhoria"; descricao: string }>(null);
  const [nota, setNota] = React.useState("");
  const caixa = React.useRef<HTMLDivElement>(null);
  const o = oportunidadePrincipal(c.oportunidades);
  const templates = estado.templates.filter((t) => t.canal === "whatsapp");
  const produto = estado.produtos.find((p) => p.id === o?.produtoId);
  const vars = { nome: primeiroNome(c.nome), empresa: estado.config.nomeEmpresa, produto: produto?.nome, operador: operador?.nome, link: "https://exemplo.invalid/link" };

  React.useEffect(() => { caixa.current?.scrollTo({ top: caixa.current.scrollHeight }); }, [c.mensagens.length]);

  const enviar = async () => {
    if (!texto.trim() || !operador) return;
    if (await despachar({ tipo: "enviarMensagem", contatoId: c.id, texto, operadorId: operador.id })) setTexto("");
  };
  const assumir = () => operador && despachar({ tipo: "assumirConversa", contatoId: c.id, operadorId: operador.id }, "Você assumiu. O contato foi avisado.");
  const devolver = () => operador && despachar({ tipo: "devolverConversa", contatoId: c.id, operadorId: operador.id }, `Conversa devolvida ao ${estado.config.nomeRobo}.`);
  const simularLead = async () => {
    if (!textoLead.trim()) return;
    if (await despachar({ tipo: "receberMensagem", contatoId: c.id, texto: textoLead })) { setTextoLead(""); setSimulando(false); }
  };
  const alternar = (id: string) => setSelecionadas((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const abrirOcorrencia = () => { setOcorrencia({ tipo: "melhoria", descricao: "" }); };
  const salvarOcorrencia = async () => {
    if (!ocorrencia) return;
    const trechos = c.mensagens.filter((m) => selecionadas.has(m.id)).map((m) => ({ autor: m.autor, texto: m.texto, em: m.em }));
    if (await despachar({ tipo: "registrarOcorrencia", contatoId: c.id, tipoOcorrencia: ocorrencia.tipo, descricao: ocorrencia.descricao, trechos, abertaPor: operador?.id ?? null }, "Ocorrência registrada. O dono recebe para melhorar o agente.")) {
      setOcorrencia(null); setSelecionando(false); setSelecionadas(new Set());
    }
  };
  const salvarNota = async () => {
    if (!nota.trim()) return;
    if (await despachar({ tipo: "adicionarNota", contatoId: c.id, texto: nota, autorId: operador?.id ?? null }, "Nota interna salva.")) setNota("");
  };

  return (
    <Card style={{ padding: 16, display: "grid", gap: 12 }}>
      <div className="ds-wrap" style={{ justifyContent: "space-between" }}>
        <div className="ds-wrap">
          <Dono c={c} size={26} />
          <div>
            <strong>{c.nome}</strong>
            <div className="ds-label">{c.empresa} · {o ? etapaDe(o.etapa)?.nome : ""} · nota {c.nota ?? "—"} · no comando: {c.dono === "robo" ? estado.config.nomeRobo : nomeOperador(estado, c.operadorId)}</div>
          </div>
        </div>
        <div className="ds-wrap">
          {c.dono === "robo" ? <Button size="sm" onClick={assumir}>Assumir</Button> : <Button size="sm" variant="secondary" onClick={devolver}>Devolver ao {estado.config.nomeRobo}</Button>}
          <Button size="sm" variant="secondary" onClick={() => ligar(c.id)}>Ligar</Button>
          {!compacto && <Button size="sm" variant="ghost" onClick={() => abrirContato(c.id)}>Ficha</Button>}
          <Dropdown label="Mais" items={[
            { id: "oc", label: selecionando ? "Cancelar seleção" : "Registrar ocorrência (selecionar trechos)", onSelect: () => { setSelecionando((v) => !v); setSelecionadas(new Set()); } },
            { id: "sim", label: "Simular mensagem do lead", onSelect: () => setSimulando(true) },
          ]} />
        </div>
      </div>

      {c.handoffPendente && <Badge tone="solid">Pediu humano · ninguém assumiu ainda</Badge>}

      <div ref={caixa} className="ds-chatbox">
        {c.mensagens.length === 0 && <EmptyState title="Sem mensagens ainda" text={`${estado.config.nomeRobo} abre a conversa assim que o lead chega.`} />}
        {c.mensagens.map((m) => (
          <ChatBubble key={m.id} author={autorChat(m.autor)} time={horaDe(m.em)} tag={m.aviso ? "aviso automático" : m.autor === "humano" ? nomeOperador(estado, m.operadorId) : undefined} selectable={selecionando} selected={selecionadas.has(m.id)} onToggle={() => alternar(m.id)}>{m.texto}</ChatBubble>
        ))}
      </div>

      {selecionando && (
        <div className="ds-wrap" style={{ justifyContent: "space-between" }}>
          <span className="ds-label">{selecionadas.size} trecho(s) marcado(s)</span>
          <Button size="sm" onClick={abrirOcorrencia} disabled={selecionadas.size === 0}>Registrar ocorrência</Button>
        </div>
      )}

      <div className="ds-composer">
        <Textarea label={c.dono === "robo" ? `Enviar como você (assume a conversa do ${estado.config.nomeRobo})` : "Mensagem"} rows={2} value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void enviar(); }} placeholder="Escreva e Ctrl+Enter para enviar" />
        <Button onClick={enviar} disabled={!texto.trim()}>Enviar</Button>
      </div>
      {templates.length > 0 && (
        <Select label="Template rápido" value="" onChange={(e) => { const t = templates.find((x) => x.id === e.target.value); if (t) setTexto(preencherTemplate(t.texto, vars)); }}>
          <option value="">— escolher template —</option>
          {templates.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </Select>
      )}

      <details>
        <summary className="ds-label" style={{ cursor: "pointer" }}>Notas internas ({c.notas.length})</summary>
        <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
          {c.notas.map((n) => <div key={n.id} style={{ fontSize: 14 }}><span className="ds-label">{dataHora(n.em)} · {nomeOperador(estado, n.autorId)}</span><div>{n.texto}</div></div>)}
          <div className="ds-composer">
            <Textarea rows={2} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota só para o time. O contato não vê." />
            <Button size="sm" variant="secondary" onClick={salvarNota} disabled={!nota.trim()}>Adicionar</Button>
          </div>
        </div>
      </details>

      <Modal open={simulando} onClose={() => setSimulando(false)} title="Simular mensagem do lead" footer={<Button onClick={simularLead}>Receber</Button>}>
        <p className="ds-muted" style={{ marginTop: 0 }}>Em produção, isto chega pelo webhook do WhatsApp (<code>POST /api/webhooks/whatsapp</code>). Aqui você digita no lugar do lead para ver o {estado.config.nomeRobo} responder.</p>
        <Textarea label="O lead escreve" rows={3} value={textoLead} onChange={(e) => setTextoLead(e.target.value)} placeholder='Ex.: "9. E quanto custa?"' />
      </Modal>

      <Modal open={!!ocorrencia} onClose={() => setOcorrencia(null)} title="Registrar ocorrência" footer={<Button onClick={salvarOcorrencia} disabled={!ocorrencia?.descricao.trim()}>Salvar</Button>}>
        {ocorrencia && (
          <div style={{ display: "grid", gap: 10 }}>
            <Segmented name="tipo-oc" label="Tipo" value={ocorrencia.tipo} onChange={(v) => setOcorrencia({ ...ocorrencia, tipo: v })} options={[{ value: "problema", label: "Problema" }, { value: "melhoria", label: "Melhoria" }]} />
            <Textarea label="O que aconteceu e o que deveria ter acontecido" rows={4} value={ocorrencia.descricao} onChange={(e) => setOcorrencia({ ...ocorrencia, descricao: e.target.value })} placeholder={`Ex.: ${estado.config.nomeRobo} foi muito seco; deveria ter conversado mais antes de passar.`} />
            <div className="ds-label">{selecionadas.size} trecho(s) vão junto. O dono recebe isto em Ocorrências.</div>
          </div>
        )}
      </Modal>
    </Card>
  );
}
