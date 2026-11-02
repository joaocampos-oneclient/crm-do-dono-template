"use client";

import * as React from "react";
import { Badge, Button, Card, PageHead, Segmented } from "@/ds";
import { crmConfig } from "@crm/config";

type Modo = "sugerir" | "perguntar" | "automatico";
type Resultado = { resumo: string; acaoSugerida?: string; requerAprovacao?: boolean };

const SLUGS = Object.keys(crmConfig.agentes) as (keyof typeof crmConfig.agentes)[];

export function Agentes() {
  const [modos, setModos] = React.useState<Record<string, Modo>>(() =>
    Object.fromEntries(SLUGS.map((s) => [s, s === "claudio" ? "automatico" : s === "ledger" ? "sugerir" : "sugerir"])),
  );
  const [saidas, setSaidas] = React.useState<Record<string, Resultado | string>>({});
  const [busy, setBusy] = React.useState<string | null>(null);
  const [llm, setLlm] = React.useState<{ configurada: boolean; mascara: string | null } | null>(null);

  React.useEffect(() => {
    void fetch("/api/agents/llm")
      .then((r) => r.json())
      .then((j) => setLlm({ configurada: Boolean(j.configurada), mascara: j.mascara ?? null }))
      .catch(() => setLlm(null));
  }, []);

  const rodar = async (slug: string) => {
    setBusy(slug);
    try {
      const contexto =
        slug === "scout"
          ? { textoConversas: "Quero entrar, quanto custa?", minutosSilencio: 30, nota: 9, pediuPreco: true }
          : slug === "ledger"
            ? { logins7d: 1, diasDesdePagamento: 3 }
            : slug === "eco"
              ? { nome: "Renata", dor: "time comercial bagunçado", meta: "dobrar vendas", nota: 9 }
              : slug === "pilot"
                ? { horasDesdeUltimaAutomatica: 60, diasParado: 2, textoFollowup: "Posso te mandar um material útil?" }
                : slug === "scribe"
                  ? { notasReuniao: "Falou de dor no funil e pediu proposta até sexta." }
                  : { rascunho: "Oi! Posso te fazer uma pergunta rápida?" };
      const res = await fetch(`/api/agents/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contexto }),
      });
      const json = await res.json();
      setSaidas((s) => ({ ...s, [slug]: json.saida ?? json }));
    } catch (e) {
      setSaidas((s) => ({ ...s, [slug]: String(e) }));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHead eyebrow="Equipe" title="Agentes">
        <p className="ds-muted" style={{ margin: "4px 0 0" }}>
          Seis agentes. Três modos: sugerir, perguntar, automático. Ledger nunca fica automático e nunca cobra. Cláudio nunca fala preço.{" "}
          {llm?.configurada ? (
            <>LLM Anthropic ativo{llm.mascara ? <> (<code>{llm.mascara}</code>)</> : null} via Mastra.</>
          ) : (
            <>Sem chave: regras locais. Configure em <a href="#/integracoes">Integrações</a>.</>
          )}
        </p>
      </PageHead>
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
        {SLUGS.map((slug) => {
          const a = crmConfig.agentes[slug];
          const out = saidas[slug];
          return (
            <Card key={slug} style={{ padding: 16, display: "grid", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <strong>{a.nome}</strong>
                <Badge tone="soft">{slug}</Badge>
              </div>
              <p className="ds-muted" style={{ margin: 0, fontSize: 14 }}>{a.resumo}</p>
              <Segmented
                name={`modo-${slug}`}
                label={`Modo de ${a.nome}`}
                value={modos[slug]}
                onChange={(v) => {
                  if (slug === "ledger" && v === "automatico") return;
                  setModos((m) => ({ ...m, [slug]: v as Modo }));
                }}
                options={[
                  { value: "sugerir", label: "Sugerir" },
                  { value: "perguntar", label: "Perguntar" },
                  { value: "automatico", label: "Auto", disabled: slug === "ledger" },
                ]}
              />
              <Button size="sm" onClick={() => rodar(slug)} disabled={busy === slug}>
                {busy === slug ? "Rodando…" : "Executar exemplo"}
              </Button>
              {out && (
                <pre className="ds-pre" style={{ margin: 0, maxHeight: 160, overflow: "auto", fontSize: 12 }}>
                  {typeof out === "string" ? out : JSON.stringify(out, null, 2)}
                </pre>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}
