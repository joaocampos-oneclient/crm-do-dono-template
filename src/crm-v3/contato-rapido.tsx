"use client";

import { Badge, Button } from "@/design-system-2027";
import { useCRM } from "@/components/crm/provider";
import { dataHora, iniciais, nomeEmExibicao } from "@/lib/crm/format";
import { formatarReais } from "@/lib/crm/domain";
import { oportunidadePrincipal } from "@/domain/rules";
import { Avatar } from "./crm-ui";
import { CrmEmpty } from "./empty";
import { CrmV3Page } from "./frame";
import { CrmLink as Link } from "./hash-nav";
import { PageChrome } from "./page-chrome";

/** Ficha enxuta enquanto o FichaV3 completo (com todos os painéis) é portado. */
export function ContatoRapido({ contatoId }: { contatoId: string }) {
  const { contato, ligar } = useCRM();
  const c = contato(contatoId);
  if (!c) {
    return (
      <CrmV3Page>
        <CrmEmpty title="Contato não encontrado" text="Volte à lista de leads." actionHref="/leads" actionLabel="Ver leads" />
      </CrmV3Page>
    );
  }
  const o = oportunidadePrincipal(c.oportunidades);
  return (
    <CrmV3Page>
      <PageChrome
        label="Contato"
        title={nomeEmExibicao(c.nome)}
        lede={c.empresa || undefined}
      >
        <p style={{ margin: 0 }}>
          <Link href="/leads" style={{ color: "var(--fg)", fontWeight: 600 }}>
            Voltar aos leads
          </Link>
        </p>
      </PageChrome>

      <div className="crm-v3-surface" style={{ display: "grid", gap: 12, padding: 16 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Avatar initials={iniciais(c.nome)} size={48} ink />
          <div style={{ display: "grid", gap: 4 }}>
            <strong style={{ font: "600 18px var(--font-sans)" }}>{c.nome}</strong>
            <span style={{ color: "var(--fg-2)", font: "400 13px var(--font-sans)" }}>
              {c.telefone}
              {c.email ? ` · ${c.email}` : ""}
            </span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <Badge tone="outline">{c.categoria}</Badge>
              <Badge tone={c.dono === "humano" ? "solid" : "dashed"}>
                {c.dono === "humano" ? "humano" : "Cláudio"}
              </Badge>
              {c.nota != null && <Badge tone="fact">nota {c.nota}</Badge>}
            </div>
          </div>
        </div>

        {o && (
          <div style={{ display: "grid", gap: 4 }}>
            <span className="crm-label">Oportunidade</span>
            <span>
              {o.etapa} · {formatarReais(Math.round(o.valor * 100))}
            </span>
            <span style={{ color: "var(--fg-2)", font: "400 12px var(--font-sans)" }}>
              Desde {dataHora(o.entrouNaEtapaEm)} · {o.proximoPasso}
            </span>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button variant="secondary" onClick={() => ligar(c.id)}>
            Ligar
          </Button>
          <Button variant="secondary" onClick={() => { window.location.hash = `#/conversas?c=${c.id}`; }}>
            Conversas
          </Button>
        </div>

        {c.mensagens.slice(-5).length > 0 && (
          <div style={{ display: "grid", gap: 6 }}>
            <span className="crm-label">Últimas mensagens</span>
            {c.mensagens.slice(-5).map((m) => (
              <p key={m.id} style={{ margin: 0, font: "400 13px var(--font-sans)" }}>
                <span style={{ color: "var(--fg-3)" }}>{dataHora(m.em)} · </span>
                {m.texto}
              </p>
            ))}
          </div>
        )}
      </div>
    </CrmV3Page>
  );
}
