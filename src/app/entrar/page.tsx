"use client";

import * as React from "react";
import { Button, Card, Input } from "@/ds";

export default function EntrarPage() {
  const [email, setEmail] = React.useState("");
  const [msg, setMsg] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const j = await res.json();
      setMsg(j.message ?? (res.ok ? "Link enviado. Confira o e-mail." : "Não deu."));
    } catch (err) {
      setMsg(String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ds-gate">
      <Card className="ds-gate__card">
        <div className="ds-label">CRM do dono</div>
        <h1 style={{ margin: 0 }}>Entrar</h1>
        <p className="ds-muted">Link mágico no e-mail. Sem senha.</p>
        <form onSubmit={enviar} style={{ display: "grid", gap: 12 }}>
          <Input label="E-mail" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit" disabled={busy}>{busy ? "Enviando…" : "Receber link"}</Button>
        </form>
        {msg && <p className="ds-muted">{msg}</p>}
        <p className="ds-muted" style={{ fontSize: 13 }}>
          Sem Supabase? Use a home em modo demo: <a href="/">abrir CRM</a>.
        </p>
      </Card>
    </div>
  );
}
