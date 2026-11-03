"use client";

import { CrmLink as Link } from "./hash-nav";
import { useState } from "react";
import { useCrmRouter as useRouter } from "./hash-nav";
import { dataHora, nomeEmExibicao } from "@/lib/crm/format";
import { duracaoCurta, formatarReais } from "@/lib/crm/domain";
import type { Hoje } from "@/lib/crm/queries";
import type { Relatorio } from "@/lib/crm/relatorios";
import { agruparParados, notificacoesInApp, type GrupoParado as GrupoParadoDados } from "@/lib/crm/notificacoes";
import {
  AgentGlyph,
  ApprovalCard,
  KpiCard,
  NewFieldMark,
  Sparkline,
  type Approval,
  type Owner,
} from "./crm-ui";
import { CrmEmpty } from "./empty";
import { CrmV3Page } from "./frame";

const TZ = "America/Sao_Paulo";

function horaBrasilia(d = new Date()): number {
  const p = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "numeric", hour12: false }).format(d);
  return Number(p);
}

function saudacao(d = new Date()): string {
  const h = horaBrasilia(d);
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function relogio(d = new Date()): string {
  const w = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, weekday: "short" }).format(d).replace(".", "");
  const dm = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit" }).format(d);
  const hm = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(d);
  return `${w} ${dm} · ${hm}`;
}

function pct(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${Math.round(n * 100)}%`;
}

export type HojeKpi = {
  label: string;
  value: string;
  unit?: string;
  caption?: string;
  isNew?: boolean;
  chart?: number[];
};

export type MeetItem = {
  hora: string;
  nome: string;
  detalhe: string;
  status: string;
};

export type FeedItem = {
  who: Owner | "sistema";
  texto: string;
  tempo: string;
  live?: boolean;
};

function GrupoParado({ grupo }: { grupo: GrupoParadoDados }) {
  const [aberto, setAberto] = useState(false);
  const preview = grupo.itens.slice(0, 2);
  const visiveis = aberto ? grupo.itens : preview;
  const resto = grupo.n - preview.length;
  return (
    <div className="crm-v3-surface" style={{ display: "grid", gap: 8, padding: 14 }}>
      <p style={{ margin: 0, font: "520 14px var(--font-sans)" }}>
        {grupo.n} parado{grupo.n === 1 ? "" : "s"} em {grupo.etapaNome}
      </p>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
        {visiveis.map((p) => (
          <li key={p.id}>
            <Link
              href={`/contatos/${p.contatoId}`}
              style={{ font: "500 14px var(--font-sans)", color: "var(--fg)", textDecoration: "underline" }}
            >
              {nomeEmExibicao(p.contatoNome)}
            </Link>
            <span style={{ font: "400 12px var(--font-sans)", color: "var(--fg-2)" }}>
              {" · "}parado há {duracaoCurta(p.minutos)}
            </span>
          </li>
        ))}
      </ul>
      {resto > 0 && (
        <button type="button" className="crm-v3-pill" onClick={() => setAberto((v) => !v)}>
          {aberto ? "ver menos" : `ver mais · ${resto}`}
        </button>
      )}
    </div>
  );
}

export function HojeV3({
  primeiroNome,
  hoje,
  relatorio,
  kpis: kpisProp,
  meets: meetsProp,
  feed: feedProp,
  subtitle,
  agora,
}: {
  primeiroNome: string;
  hoje: Hoje;
  relatorio?: Relatorio | null;
  kpis?: HojeKpi[];
  meets?: MeetItem[];
  feed?: FeedItem[];
  subtitle?: string;
  agora?: string;
}) {
  const router = useRouter();
  const avisos = notificacoesInApp(hoje);
  const gruposParados = agruparParados(hoje.paradas);
  const vazio = hoje.tarefas.length + hoje.paradas.length + hoje.handoffsPendentes.length === 0;
  const precisa = hoje.handoffsPendentes.length + hoje.tarefas.length;
  const agoraDate = agora ? new Date(agora) : new Date();

  const kpis: HojeKpi[] =
    kpisProp ??
    [
      {
        label: "Vendas / mês",
        value: relatorio ? String(relatorio.mes.vendas) : "—",
        caption: relatorio?.metas.vendas_dia != null
          ? `meta ${relatorio.metas.vendas_dia}/dia`
          : "meta não definida",
        chart: relatorio ? [relatorio.hoje.vendas, relatorio.mes.vendas, relatorio.previsao.fimDoMes ?? 0] : [0, 0, 0],
      },
      {
        label: "Handoff / pagou",
        value: relatorio ? pct(relatorio.taxas.find((t) => /handoff/i.test(t.de) && /pago|oferta/i.test(t.para))?.real ?? null) : "—",
        caption: relatorio ? `n ${relatorio.taxas[0]?.n ?? 0}` : "sem amostra",
        chart: relatorio ? [relatorio.hoje.vendas, relatorio.mes.vendas] : undefined,
      },
      {
        label: "Cobertura",
        value: relatorio?.previsao.fimDoMes != null ? String(relatorio.previsao.fimDoMes) : "—",
        caption: relatorio ? "previsão de vendas no fim do mês" : "Não informado",
        isNew: true,
      },
      {
        label: "Próximo Meet",
        value: "—",
        caption: "sem Meet na agenda",
        isNew: true,
      },
    ];

  const meets = meetsProp ?? [];
  const feed = feedProp ?? [];

  const lede =
    subtitle ??
    (vazio
      ? "Nada pediu você ainda hoje. O funil e as conversas continuam no lugar de sempre."
      : `Enquanto você estava fora: ${hoje.handoffsPendentes.length} handoff${hoje.handoffsPendentes.length === 1 ? "" : "s"} e ${hoje.tarefas.length} tarefa${hoje.tarefas.length === 1 ? "" : "s"}. ${precisa} precis${precisa === 1 ? "a" : "am"} de você.`);

  return (
    <CrmV3Page>
      <div className="crm-v3-hoje">
        <div className="crm-v3-hoje__main">
          <div className="crm-v3-hello">
            <div style={{ display: "grid", gap: 8 }}>
              <h1 className="crm-v3-display">
                {saudacao(agoraDate)}, {primeiroNome}.
              </h1>
              <p className="crm-v3-lede">{lede}</p>
            </div>
            <time dateTime={agoraDate.toISOString()}>{relogio(agoraDate)}</time>
          </div>

          <div className="crm-v3-kpis">
            {kpis.map((k) => (
              <KpiCard
                key={k.label}
                label={k.label}
                value={k.value}
                unit={k.unit}
                caption={k.caption}
                isNew={k.isNew}
                chart={k.chart && k.chart.length > 1 ? <Sparkline values={k.chart} /> : undefined}
              />
            ))}
          </div>

          {avisos.length > 0 && (
            <section style={{ display: "grid", gap: 8 }} aria-labelledby="h-avisos">
              <h2 id="h-avisos" style={{ margin: 0, font: "520 16px var(--font-sans)" }}>
                Avisos
              </h2>
              <ul className="crm-v3-list">
                {avisos.map((n) => (
                  <li key={`${n.tipo}-${n.url}`}>
                    <Link href={n.url}>
                      <span style={{ display: "grid", gap: 2 }}>
                        <span className="crm-label">{n.tipo === "handoff" ? "Handoff" : "Parado"}</span>
                        <span style={{ font: "500 15px var(--font-sans)" }}>{n.titulo}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section style={{ display: "grid", gap: 12 }} aria-labelledby="h-handoff">
            <div className="crm-v3-section-head">
              <h2 id="h-handoff">Precisa de você{precisa ? ` · ${precisa}` : ""}</h2>
              <span className="crm-label">J K navega · Enter aprova</span>
            </div>

            {vazio && (
              <CrmEmpty
                title="Nada pendente"
                text="Sem tarefa para hoje, handoff esperando nem card parado. Use o botão + para abrir uma oportunidade."
                actionHref="/funil"
                actionLabel="Ver o funil"
              />
            )}

            {hoje.handoffsPendentes.map((h) => {
              const item: Approval = {
                kind: "handoff",
                author: "claudio",
                title: "Assumir a conversa",
                lead: nomeEmExibicao(h.nome),
                context: [`Desde ${dataHora(h.desde)}`],
                preview: "Handoff real do Cláudio. Sem execução de agente nesta tela.",
                source: "crm_handoffs",
                sla: h.slaAte ? `SLA ${dataHora(h.slaAte)}` : "SEM SLA",
              };
              return (
                <article key={h.id} className="crm-v3-approval is-handoff">
                  <ApprovalCard
                    item={item}
                    onPrimary={() => router.push(`/conversas?c=${h.id}`)}
                    onSkip={() => router.push(`/contatos/${h.id}`)}
                  />
                  <aside className="crm-v3-approval__ctx">
                    <p className="crm-label">Contexto</p>
                    <p>Handoff aberto desde {dataHora(h.desde)}. Assumir avisa o contato que uma pessoa está falando.</p>
                    <Link href={`/contatos/${h.id}`} style={{ font: "500 13px var(--font-sans)", color: "var(--fg)" }}>
                      Abrir a ficha
                    </Link>
                  </aside>
                </article>
              );
            })}

            {hoje.tarefas.map((t) => (
              <article key={t.id} className="crm-v3-approval">
                <ApprovalCard
                  item={{
                    kind: "suggestion",
                    author: "scribe",
                    title: t.titulo,
                    lead: t.contato ? nomeEmExibicao(t.contato.nome) : "Sem contato",
                    source: "crm_tarefas",
                    confidence: 0,
                  }}
                  onPrimary={() => router.push(t.contato ? `/contatos/${t.contato.id}` : "/")}
                  onSkip={() => router.push("/trabalho")}
                />
                <aside className="crm-v3-approval__ctx">
                  <p className="crm-label">Tarefa</p>
                  <p>
                    {t.contato ? nomeEmExibicao(t.contato.nome) : "Sem contato"}
                    {t.vence_em ? ` · vence ${dataHora(t.vence_em)}` : ""}
                  </p>
                </aside>
              </article>
            ))}
          </section>

          {gruposParados.length > 0 && (
            <section style={{ display: "grid", gap: 8 }} aria-labelledby="h-paradas">
              <h2 id="h-paradas" style={{ margin: 0, font: "520 16px var(--font-sans)" }}>
                Cards parados · {hoje.paradas.length}
              </h2>
              <p className="crm-v3-lede">
                Passaram do prazo da etapa real. Quanto mais tempo parado, menor a chance de fechar.
              </p>
              {gruposParados.map((g) => (
                <GrupoParado key={g.etapaSlug || g.etapaNome} grupo={g} />
              ))}
            </section>
          )}
        </div>

        <aside className="crm-v3-hoje__side">
          <section className="crm-v3-meet" aria-labelledby="h-meets">
            <div className="crm-v3-section-head">
              <h2 id="h-meets">Meets{meets.length ? ` · ${meets.length}` : ""}</h2>
              <NewFieldMark />
            </div>
            {meets.length === 0 ? (
              <p style={{ margin: "8px 0 12px", font: "400 13px var(--font-sans)", color: "var(--fg-2)" }}>
                Sem Meet marcado. Echo prepara o brief quando houver um.
              </p>
            ) : (
              <ul>
                {meets.map((m) => (
                  <li key={`${m.hora}-${m.nome}`}>
                    <span className="crm-num" style={{ font: "500 12px var(--font-mono)", color: "var(--fg-3)" }}>
                      {m.hora}
                    </span>
                    <div>
                      <div style={{ font: "500 13px var(--font-sans)" }}>{m.nome}</div>
                      <div style={{ font: "400 12px var(--font-sans)", color: "var(--fg-2)" }}>{m.detalhe}</div>
                    </div>
                    <span className="crm-label">{m.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {feed.length > 0 && (
            <section className="crm-v3-feed" aria-labelledby="h-feed">
              <div className="crm-v3-section-head">
                <h2 id="h-feed">Atividade ao vivo</h2>
                <NewFieldMark />
              </div>
              <ul>
                {feed.map((f, i) => (
                  <li key={`${f.texto}-${i}`}>
                    <span className={`crm-v3-dot${f.live ? " is-live" : ""}`} />
                    <div>
                      <div style={{ font: "400 13px var(--font-sans)" }}>{f.texto}</div>
                    </div>
                    <time style={{ font: "400 11px var(--font-mono)", color: "var(--fg-3)" }}>{f.tempo}</time>
                    {f.who !== "sistema" && (
                      <span style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}>
                        <AgentGlyph
                          agent={
                            f.who === "scout" || f.who === "scribe" || f.who === "ledger" || f.who === "pilot" || f.who === "echo" || f.who === "claudio"
                              ? f.who
                              : "claudio"
                          }
                        />
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </CrmV3Page>
  );
}
