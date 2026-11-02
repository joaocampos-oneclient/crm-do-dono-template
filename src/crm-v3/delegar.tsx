"use client";

import { AgentGlyph, Button, Sheet, type AgentId } from "./crm-ui";

const AGENTES: Array<{ id: AgentId; nome: string; faz: string }> = [
  { id: "scout", nome: "Scout", faz: "Procura sinais e quem voltar a falar." },
  { id: "scribe", nome: "Scribe", faz: "Resume ligação e escreve o follow-up." },
  { id: "ledger", nome: "Ledger", faz: "Olha número. Nunca automático e nunca cobra." },
  { id: "pilot", nome: "Pilot", faz: "Sugere o próximo passo no funil." },
  { id: "echo", nome: "Echo", faz: "Prepara o brief do Meet." },
];

export function DelegarSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Delegar">
      <p className="crm-label" style={{ margin: "0 0 8px" }}>
        Delegar
      </p>
      <h2 style={{ margin: "0 0 8px", font: "520 22px var(--font-sans)" }}>Quem pega a próxima?</h2>
      <p style={{ margin: "0 0 16px", font: "400 13px var(--font-sans)", color: "var(--fg-2)" }}>
        A fila de delegação ainda não grava no banco. Isto mostra o time e o que cada um faz.
      </p>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
        {AGENTES.map((a) => (
          <li
            key={a.id}
            style={{
              display: "grid",
              gridTemplateColumns: "18px 1fr",
              gap: 10,
              padding: 12,
              background: "var(--bg-2)",
              borderRadius: 12,
            }}
          >
            <AgentGlyph agent={a.id} size={14} />
            <div>
              <strong style={{ font: "600 14px var(--font-sans)" }}>{a.nome}</strong>
              <div style={{ font: "400 12px var(--font-sans)", color: "var(--fg-2)" }}>{a.faz}</div>
            </div>
          </li>
        ))}
      </ul>
      <div style={{ marginTop: 16 }}>
        <Button variant="secondary" onClick={onClose}>
          Fechar
        </Button>
      </div>
    </Sheet>
  );
}
