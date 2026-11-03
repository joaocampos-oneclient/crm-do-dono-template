"use client";

import { CrmLink as Link } from "./hash-nav";
import { useCrmRouter as useRouter } from "./hash-nav";
import { duracaoCurta, estaParado, ETAPA_SLUGS, formatarReais, minutosNaEtapa, type EtapaInfo } from "@/lib/crm/domain";
import { nomeEmExibicao } from "@/lib/crm/format";
import type { CardFunil, TaxasFunil } from "@/lib/crm/queries";
import { StageChip, type StageIndex } from "./crm-ui";
import { CrmEmpty } from "./empty";
import { CrmV3Page } from "./frame";
import { PageChrome } from "./page-chrome";

function indiceEtapa(slug: string): StageIndex {
  const i = (ETAPA_SLUGS as readonly string[]).indexOf(slug);
  return (i >= 0 && i <= 7 ? i : 0) as StageIndex;
}

export function FunilV3({
  etapas,
  cards,
  taxas,
  agora,
}: {
  etapas: EtapaInfo[];
  cards: CardFunil[];
  taxas: TaxasFunil;
  agora: string;
}) {
  const router = useRouter();
  const t0 = new Date(agora);
  const real = new Map(taxas.real.map((t) => [t.etapaId, t]));

  return (
    <CrmV3Page>
      <PageChrome
        label="Funil · Comunidade"
        title="Onde cada pessoa está."
        lede={
          <Link href="/funil?fila=trave" style={{ color: "var(--fg)", fontWeight: 600 }}>
            Ver quem bateu na trave
          </Link>
        }
      />

      <section style={{ display: "grid", gap: 10 }} aria-labelledby="h-taxas">
        <h2 id="h-taxas" style={{ margin: 0, font: "520 16px var(--font-sans)" }}>
          Taxa por etapa
        </h2>
        <div className="crm-v3-pills">
          {[1, 7, 14, 30].map((n) => (
            <button
              key={n}
              type="button"
              className={`crm-v3-pill${taxas.janelaDias === n ? " is-on" : ""}`}
              onClick={() => router.push(`/funil?janela=${n}`)}
            >
              {n === 1 ? "Hoje" : `${n} dias`}
            </button>
          ))}
        </div>
        <div className="crm-v3-taxas">
          {etapas
            .filter((e) => e.meta_taxa != null && e.ordem < etapas.length)
            .map((e) => {
              const r = real.get(e.id);
              const proxima = etapas.find((x) => x.ordem === e.ordem + 1);
              const pct = r?.taxa == null ? null : Math.round(r.taxa * 100);
              return (
                <div key={e.id} className="crm-v3-taxa">
                  <div className="crm-v3-taxa__top">
                    <span>
                      {e.nome}
                      {proxima ? ` → ${proxima.nome}` : ""}
                    </span>
                    <span className="crm-num">{pct == null ? "amostra pequena" : `${pct}%`}</span>
                  </div>
                  <div className="crm-v3-taxa__bar" aria-hidden>
                    <i style={{ width: pct == null ? "0%" : `${Math.min(100, pct)}%` }} />
                  </div>
                  <span className="crm-v3-taxa__n">{r?.entraram ?? 0} passaram</span>
                </div>
              );
            })}
        </div>
      </section>

      <section aria-labelledby="h-quadro" style={{ display: "grid", gap: 8, minWidth: 0 }}>
        <h2 id="h-quadro" style={{ margin: 0, font: "520 16px var(--font-sans)" }}>
          Quadro
        </h2>
        <p style={{ margin: 0, font: "400 12px var(--font-sans)", color: "var(--fg-2)" }}>
          Sem arrastar. Avanço só na ficha. Só lead — cliente da Comunidade não entra. Deslize para o lado para ver Oferta, Pago e Dentro.
        </p>
        {cards.length === 0 && (
          <CrmEmpty
            title="O funil está vazio"
            text="O CRM nasce sem lead. Abra a primeira oportunidade pelo botão + ou espere o Cláudio trazer alguém."
            actionHref="/"
            actionLabel="Voltar ao Hoje"
          />
        )}
        <div className="crm-v3-board-wrap">
          <div className="crm-v3-board" tabIndex={0} aria-label="Quadro do funil. Role para o lado para ver as últimas etapas.">
            {etapas.map((e) => {
              const dela = cards.filter((c) => c.etapaId === e.id);
              const soma = dela.reduce((s, c) => s + c.valorCentavos, 0);
              return (
                <div key={e.id} className={`crm-v3-col${dela.length === 0 ? " is-empty" : ""}`}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                    <StageChip stage={indiceEtapa(e.slug)} />
                    <span className="crm-num" style={{ font: "500 11px var(--font-mono)", color: "var(--fg-3)" }}>
                      {dela.length}
                      {dela.length > 0 ? ` · ${formatarReais(soma)}` : ""}
                    </span>
                  </div>
                  {dela.length === 0 && (
                    <p style={{ margin: 0, font: "400 12px var(--font-sans)", color: "var(--fg-3)" }}>
                      Ninguém aqui ainda
                    </p>
                  )}
                  {dela.map((c) => {
                    const desde = new Date(c.etapaDesde);
                    const parado = estaParado(e, desde, t0);
                    const detalhe = c.empresa ?? c.proximaAcao ?? duracaoCurta(minutosNaEtapa(desde, t0));
                    return (
                      <button
                        key={c.id}
                        type="button"
                        className="crm-v3-cardbtn"
                        onClick={() => router.push(`/contatos/${c.contatoId}`)}
                      >
                        <span
                          style={{
                            font: parado ? "600 14px var(--font-sans)" : "500 14px var(--font-sans)",
                            textDecoration: parado ? "underline" : "none",
                            color: "var(--fg)",
                          }}
                        >
                          {nomeEmExibicao(c.contatoNome)}
                        </span>
                        {detalhe ? (
                          <span style={{ font: "400 11px var(--font-sans)", color: "var(--fg-2)" }}>{detalhe}</span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </CrmV3Page>
  );
}

export function FunilTraveV3({ children }: { children: React.ReactNode }) {
  return (
    <CrmV3Page>
      <PageChrome
        label="Funil · Bateu na trave"
        title="Chegaram na oferta e não fecharam."
        lede={
          <Link href="/funil" style={{ color: "var(--fg)", fontWeight: 600 }}>
            Voltar ao funil
          </Link>
        }
      />
      {children}
    </CrmV3Page>
  );
}
