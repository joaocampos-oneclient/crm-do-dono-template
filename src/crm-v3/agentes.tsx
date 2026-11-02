"use client";

import { useState } from "react";
import { AgentGlyph, ModeSelector, NewFieldMark, type AgentId, type AgentMode } from "./crm-ui";
import { CrmV3Page } from "./frame";
import { PageChrome } from "./page-chrome";

const TIME: Array<{ id: AgentId; nome: string; faz: string }> = [
  { id: "scout", nome: "Scout", faz: "Procura sinais e quem voltar a falar." },
  { id: "scribe", nome: "Scribe", faz: "Resume ligação e escreve o follow-up." },
  { id: "ledger", nome: "Ledger", faz: "Olha número. Nunca automático e nunca cobra." },
  { id: "pilot", nome: "Pilot", faz: "Sugere o próximo passo no funil." },
  { id: "echo", nome: "Echo", faz: "Prepara o brief do Meet." },
];

/** Modos locais: ainda não gravam. Sem migration e sem flag nova do Cláudio. */
export function AgentesV3() {
  const [modos, setModos] = useState<Record<AgentId, AgentMode>>({
    scout: "suggest",
    scribe: "ask",
    ledger: "suggest",
    pilot: "ask",
    echo: "suggest",
  });

  return (
    <CrmV3Page>
      <PageChrome
        label="Agentes"
        title="O time que trabalha com você."
        lede="Modos ainda não gravam no banco. Ledger nunca fica em Automático e nunca cobra."
      />
      <div style={{ display: "grid", gap: 12 }}>
        {TIME.map((a) => (
          <div key={a.id} className="crm-v3-surface">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <AgentGlyph agent={a.id} />
              <strong style={{ font: "600 15px var(--font-sans)" }}>{a.nome}</strong>
              <span style={{ color: "var(--fg-2)", font: "400 13px var(--font-sans)" }}>{a.faz}</span>
              <NewFieldMark />
            </div>
            <ModeSelector agent={a.id} value={modos[a.id]} onChange={(m) => setModos((s) => ({ ...s, [a.id]: m }))} />
          </div>
        ))}
      </div>
    </CrmV3Page>
  );
}
