import { useState } from "react";
import { Avatar, Badge, Button, Card, ChatBubble, EmptyState, List, ListRow, Segmented, Timeline } from "../ds";
import { adapters } from "../adapters";
import { etapaDe, proximaEtapa } from "../domain/funil";
import { acaoDaNota, avisoAssumir, avisoDevolver, categoria, estourouPrazo, proximasAcoes, proximoTermometro } from "../domain/rules";
import type { Contato } from "../domain/types";
import type { Ctx } from "./ctx";

const iniciais = (n: string) => n.split(" ").map((p) => p[0]).slice(0, 2).join("");
const autorChat = (a: "contato" | "robo" | "humano") => (a === "contato" ? "lead" : a);

export function Contatos(ctx: Ctx) {
  const { contatos, aberto, abrir, fechar } = ctx;
  const c = contatos.find((x) => x.id === aberto);
  return (
    <div style={{ display: "grid", gap: 16, gridTemplateColumns: c ? "minmax(0,320px) minmax(0,1fr)" : "1fr", alignItems: "start" }}>
      <List>
        {contatos.map((x) => (
          <ListRow
            key={x.id}
            onClick={() => abrir(x.id)}
            leading={<Avatar initials={iniciais(x.nome)} />}
            title={x.nome}
            subtitle={`${x.empresa} · ${etapaDe(x.oportunidades[0].etapa)?.nome}`}
            trailing={<Badge tone={x.id === aberto ? "solid" : "outline"}>{categoria(x)}</Badge>}
          />
        ))}
      </List>
      {c ? <Detalhe c={c} ctx={ctx} onFechar={fechar} /> : null}
    </div>
  );
}

function Detalhe({ c, ctx, onFechar }: { c: Contato; ctx: Ctx; onFechar: () => void }) {
  const [aba, setAba] = useState<"conversa" | "canvas" | "ligacoes">("conversa");
  const o = c.oportunidades[0];
  const e = etapaDe(o.etapa);
  const prox = proximaEtapa(o.etapa);
  const acoes = proximasAcoes(c);

  const assumir = () => {
    ctx.atualizar(c.id, (x) => ({
      ...x, dono: "humano", handoffPendente: false,
      mensagens: [...x.mensagens, { autor: "humano", aviso: true, hora: "agora", texto: avisoAssumir(x.nome.split(" ")[0], "o time comercial") }],
      oportunidades: x.oportunidades.map((p, i) => (i === 0 ? { ...p, etapa: "handoff", minutosNaEtapa: 0 } : p)),
    }));
    ctx.aviso("Você assumiu. O contato foi avisado (simulado).");
  };
  const devolver = () => {
    ctx.atualizar(c.id, (x) => ({
      ...x, dono: "robo",
      mensagens: [...x.mensagens, { autor: "robo", aviso: true, hora: "agora", texto: avisoDevolver(x.nome.split(" ")[0]) }],
    }));
    ctx.aviso("Conversa devolvida ao robô (simulado).");
  };
  const avancar = () => {
    if (!prox || !e) return;
    if (e.auto) return ctx.aviso(`"${prox.nome}" é movida pelo sistema, não por você.`);
    if (prox.id === "briefing" && !o.briefing) return ctx.aviso("Para avançar: preencha dor, meta e data no briefing.");
    ctx.atualizar(c.id, (x) => ({ ...x, oportunidades: x.oportunidades.map((p, i) => (i === 0 ? { ...p, etapa: prox.id, minutosNaEtapa: 0 } : p)) }));
  };
  const ligar = async () => {
    await adapters.telefonia.ligar(c.telefone, { avisoDeGravacao: true });
    ctx.aviso("Ligação simulada. Em produção, avisa da gravação e a transcrição cai aqui sozinha.");
  };
  const termometro = () => ctx.atualizar(c.id, (x) => ({ ...x, termometro: proximoTermometro(x.termometro) }));

  return (
    <Card style={{ padding: 16, display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0 }}>{c.nome}</h2>
          <div className="ds-label">{c.empresa} · {c.segmento} · {c.telefone}</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Badge tone="outline">{categoria(c)}</Badge>
          <Button size="sm" variant="secondary" onClick={onFechar}>Fechar</Button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Badge tone="solid">{e?.nome}</Badge>
        {estourouPrazo(o) && <Badge tone="outline">prazo vencido</Badge>}
        <Badge tone="soft">nota {c.nota ?? "—"} · {acaoDaNota(c.nota)}</Badge>
        <Badge tone="soft">dono: {c.dono === "robo" ? "robô" : "humano"}</Badge>
        <button type="button" className="ds-chip" onClick={termometro} aria-label="Alternar termômetro">termômetro: {c.termometro ?? "sem marca"}</button>
      </div>

      {acoes.length > 0 && (
        <Card tone="alt" style={{ padding: 12 }}>
          <div className="ds-label">Próximas ações sugeridas (a IA sugere, você decide)</div>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            {acoes.map((a) => <li key={a.titulo}><strong>{a.titulo}</strong> · {a.porque}</li>)}
          </ul>
        </Card>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {c.dono === "robo" ? <Button size="sm" onClick={assumir}>Assumir conversa</Button> : <Button size="sm" variant="secondary" onClick={devolver}>Devolver ao robô</Button>}
        <Button size="sm" variant="secondary" onClick={ligar}>Ligar (simulado)</Button>
        {prox && <Button size="sm" variant="secondary" onClick={avancar}>Avançar para "{prox.nome}"</Button>}
      </div>

      <Segmented name="aba-contato" label="Seção do contato" value={aba} onChange={setAba}
        options={[{ value: "conversa", label: "Conversa" }, { value: "canvas", label: "Canvas da etapa" }, { value: "ligacoes", label: `Ligações (${c.ligacoes.length})` }]} />

      {aba === "conversa" && (
        <div style={{ display: "grid", gap: 8 }}>
          {c.mensagens.length === 0 && <EmptyState title="Sem mensagens ainda" text="O robô abre a conversa assim que o lead chega." />}
          {c.mensagens.map((m, i) => (
            <ChatBubble key={i} author={autorChat(m.autor)} time={m.hora} tag={m.aviso ? "aviso automático" : undefined}>{m.texto}</ChatBubble>
          ))}
        </div>
      )}

      {aba === "canvas" && e && (
        <dl style={{ display: "grid", gap: 8, margin: 0 }}>
          {([["Objetivo", e.objetivo], ["Como validar", e.validacao], ["Prazo", e.prazoTexto], ["Meta de conversão (sua)", `${e.meta}%`], ["Quem move", e.auto ? "o sistema" : "você"], ["Motivos de perda", e.motivosPerda.join(" · ")]] as const).map(([k, v]) => (
            <div key={k}><dt className="ds-label">{k}</dt><dd style={{ margin: 0 }}>{v}</dd></div>
          ))}
          {o.briefing && <div><dt className="ds-label">Briefing</dt><dd style={{ margin: 0 }}>Dor: {o.briefing.dor}. Meta: {o.briefing.meta}. Data: {o.briefing.data}.</dd></div>}
        </dl>
      )}

      {aba === "ligacoes" && (
        c.ligacoes.length === 0 ? <EmptyState title="Nenhuma ligação registrada" text="Em produção, a ligação é gravada com aviso e a transcrição aparece aqui." /> :
        c.ligacoes.map((l) => (
          <div key={l.hora} style={{ display: "grid", gap: 10 }}>
            <div className="ds-label">Ligação {l.hora} · {l.duracao} · {l.resultado} · transcrição simulada</div>
            <Timeline label="Transcrição" items={l.trechos.map((t) => ({ time: t.hora, tag: t.marca ?? (t.quem === "vendedor" ? "você" : "contato"), text: t.texto }))} />
            <div className="ds-label">Follow-ups sugeridos</div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>{l.followups.map((f) => <li key={f.texto}>{f.texto} · {f.quando} (trecho {f.origem})</li>)}</ul>
            <div className="ds-label">Termômetro: você marcou {l.termometroVendedor}; a IA leu {l.termometroIA}. Vale o seu.</div>
          </div>
        ))
      )}
    </Card>
  );
}
