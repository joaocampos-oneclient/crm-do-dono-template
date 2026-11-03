"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useCrmRouter as useRouter } from "./hash-nav";
import { Icon } from "./crm-ui";
import { itensDoPapel, type CrmPapelNav } from "./nav";
import { iniciarViewTransition } from "./motion";

export function CommandPalette({
  open,
  onClose,
  papel,
}: {
  open: boolean;
  onClose: () => void;
  papel: CrmPapelNav;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const itens = useMemo(() => {
    const n = q.trim().toLowerCase();
    return itensDoPapel(papel).filter((x) => !n || x.label.toLowerCase().includes(n));
  }, [papel, q]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
    if (open) {
      setQ("");
      setI(0);
    }
  }, [open]);

  function ir(href: string) {
    onClose();
    iniciarViewTransition(() => router.push(href));
  }

  return (
    <dialog
      ref={ref}
      className="crm-v3-cmd"
      aria-label="Buscar no CRM"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setI((n) => Math.min(itens.length - 1, n + 1));
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setI((n) => Math.max(0, n - 1));
        }
        if (e.key === "Enter" && itens[i]) ir(itens[i].href);
      }}
    >
      <div className="crm-v3-cmd__box">
        <input
          autoFocus
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setI(0);
          }}
          placeholder="Ir para uma tela ou buscar um nome"
          aria-label="Buscar"
        />
        {itens.map((item, idx) => (
          <button
            key={item.id}
            type="button"
            className="crm-v3-cmd__hit"
            data-active={idx === i ? "1" : "0"}
            onClick={() => ir(item.href)}
          >
            <Icon name={item.icon} size={16} />
            {item.label}
          </button>
        ))}
        {itens.length === 0 && (
          <p style={{ margin: 0, padding: 16, font: "400 13px var(--font-sans)", color: "var(--fg-2)" }}>
            Nada com esse nome. Tente Hoje, Funil, Leads ou o nome de uma pessoa em Buscar.
          </p>
        )}
        <button type="button" className="crm-v3-cmd__hit" onClick={() => ir("/buscar")}>
          <Icon name="search" size={16} />
          Buscar contato por nome
        </button>
      </div>
    </dialog>
  );
}
