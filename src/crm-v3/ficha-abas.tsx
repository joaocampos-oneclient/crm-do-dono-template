"use client";

import { useState, type ReactNode } from "react";

export type FichaAba = { id: string; label: string; painel: ReactNode };

/** Abas da ficha. Painéis ficam montados (`hidden`) para Ligar não perder estado. */
export function FichaAbas({ abas }: { abas: FichaAba[] }) {
  const [ativa, setAtiva] = useState(abas[0]?.id ?? "resumo");
  return (
    <div className="crm-v3-ficha">
      <div className="crm-v3-pills" role="tablist" aria-label="Seções da ficha">
        {abas.map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            id={`ficha-tab-${a.id}`}
            aria-selected={ativa === a.id}
            aria-controls={`ficha-painel-${a.id}`}
            className={`crm-v3-pill${ativa === a.id ? " is-on" : ""}`}
            onClick={() => setAtiva(a.id)}
          >
            {a.label}
          </button>
        ))}
      </div>
      {abas.map((a) => (
        <div
          key={a.id}
          id={`ficha-painel-${a.id}`}
          role="tabpanel"
          aria-labelledby={`ficha-tab-${a.id}`}
          hidden={ativa !== a.id}
          className="crm-v3-ficha__painel"
        >
          {a.painel}
        </div>
      ))}
    </div>
  );
}
