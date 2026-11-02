"use client";

import { useState } from "react";
import {
  AgentBadge,
  AgentGlyph,
  ApprovalCard,
  Avatar,
  BottomBar,
  Button,
  Icon,
  KpiCard,
  ModeSelector,
  NewFieldMark,
  SegmentBar,
  Sheet,
  Sparkline,
  StageChip,
  Thermometer,
  TimelineItem,
  type AgentMode,
  type TabId,
} from "./crm-ui";
import { CrmV3Page } from "./frame";

function Bloco({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ display: "grid", gap: 12, minWidth: 0 }}>
      <h3 className="crm-label" style={{ margin: 0 }}>
        {title}
      </h3>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", minWidth: 0 }}>{children}</div>
    </section>
  );
}

/** Vitrine das 16 peças do crm-ui. Dados de mentira. Some em produção com /especimes. */
export function CrmV3Especimes() {
  const [modo, setModo] = useState<AgentMode>("suggest");
  const [aba, setAba] = useState<TabId>("today");
  const [sheet, setSheet] = useState(false);

  return (
    <CrmV3Page>
      <header style={{ display: "grid", gap: 8 }}>
        <p className="crm-label" style={{ margin: 0 }}>
          CRM v3
        </p>
        <h2 style={{ margin: 0, font: "520 28px/1.1 var(--font-sans)", letterSpacing: "-.025em" }}>Peças do export</h2>
        <p style={{ margin: 0, font: "400 14px var(--font-sans)", color: "var(--fg-2)" }}>
          Dados ilustrativos. Flag CRM_V3 desligada não troca o CRM em produção.
        </p>
      </header>

      <Bloco title="Ícones">
        {(["today", "funnel", "chat", "leads", "clients", "search", "phone", "more"] as const).map((n) => (
          <span key={n} style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--fg)" }}>
            <Icon name={n} label={n} />
            <span className="crm-label">{n}</span>
          </span>
        ))}
      </Bloco>

      <Bloco title="Agentes">
        <AgentGlyph agent="claudio" />
        <AgentGlyph agent="scout" />
        <AgentGlyph agent="scribe" />
        <AgentGlyph agent="ledger" />
        <AgentGlyph agent="pilot" />
        <AgentGlyph agent="echo" />
        <AgentBadge owner="claudio" />
        <AgentBadge owner="joao" />
        <Avatar initials="OT" />
      </Bloco>

      <Bloco title="Botões e etapa">
        <Button>Primário</Button>
        <Button variant="secondary">Secundário</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Perder</Button>
        <Button loading aria-label="Carregando">
          Carregando
        </Button>
        <StageChip stage={0} />
        <StageChip stage={6} />
        <StageChip stage={2} lost />
        <Thermometer value="quente" />
        <SegmentBar total={8} filled={3} label="3 de 8 etapas" />
        <NewFieldMark />
      </Bloco>

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
        <KpiCard label="Vendas hoje" value="0" caption="exemplo ilustrativo" chart={<Sparkline values={[1, 2, 1, 3, 2, 4]} />} />
        <KpiCard label="Previsão" value="—" isNew caption="Não informado" />
      </div>

      <ApprovalCard
        item={{
          kind: "handoff",
          author: "claudio",
          title: "Assumir a conversa",
          lead: "Exemplo ilustrativo · João da Silva",
          context: ["Nicho · serviços", "Cidade · SP"],
          preview: "O dono respondeu a pergunta-assassina com 8.",
          source: "handoff real",
          sla: "SLA 15 min",
        }}
        onPrimary={() => undefined}
        onSkip={() => undefined}
      />

      <Bloco title="Modo do agente">
        <div style={{ width: "100%", maxWidth: 420 }}>
          <ModeSelector agent="ledger" value={modo} onChange={setModo} />
        </div>
      </Bloco>

      <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
        <TimelineItem who="claudio" author="Cláudio" action="registrou a nota" detail="Pergunta-assassina: 8" time="09:12" tag="CHAT" />
        <TimelineItem who="joao" author="João" action="assumiu a conversa" time="09:18" tag="HUMANO" />
      </ul>

      <Button variant="secondary" onClick={() => setSheet(true)}>
        Abrir sheet
      </Button>
      <Sheet open={sheet} onClose={() => setSheet(false)} title="Exemplo">
        <p style={{ margin: "0 0 12px", font: "500 16px var(--font-sans)" }}>Sheet sólido, sem vidro.</p>
        <Button onClick={() => setSheet(false)}>Fechar</Button>
      </Sheet>

      <div style={{ height: 96 }} aria-hidden />
      <BottomBar active={aba} badges={{ today: 2 }} onSelect={setAba} />
    </CrmV3Page>
  );
}
