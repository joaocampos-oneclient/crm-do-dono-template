"use client";

import { useMemo, useState } from "react";
import { BottomSheet, Button, Input } from "@/design-system-2027";
import { useCRM } from "@/components/crm/provider";

/** Discagem rápida: busca contatos do estado local e dispara ligação. */
export function DiscagemRapida({ aberta, aoFechar }: { aberta: boolean; aoFechar: () => void }) {
  const { contatos, ligar } = useCRM();
  const [q, setQ] = useState("");
  const lista = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return [];
    return contatos
      .filter((c) => c.nome.toLowerCase().includes(t) || (c.telefone ?? "").includes(t))
      .slice(0, 8);
  }, [contatos, q]);

  return (
    <BottomSheet open={aberta} onClose={aoFechar} title="Ligar">
      <div style={{ display: "grid", gap: 12 }}>
        <Input
          label="Buscar contato"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nome ou WhatsApp"
        />
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
          {lista.map((c) => (
            <li key={c.id}>
              <Button
                variant="secondary"
                block
                onClick={() => {
                  aoFechar();
                  ligar(c.id);
                }}
              >
                {c.nome}
                {c.telefone ? ` · ${c.telefone}` : ""}
              </Button>
            </li>
          ))}
        </ul>
        {q.trim().length >= 2 && lista.length === 0 && (
          <p className="ds-muted" style={{ margin: 0 }}>
            Nenhum contato com esse nome.
          </p>
        )}
      </div>
    </BottomSheet>
  );
}
