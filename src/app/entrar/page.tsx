"use client";

import * as React from "react";
import { Button, Card, Input } from "@/ds";

/**
 * Gate público — fiel ao CRM em produção (crm.iaparadonos.com/entrar).
 * Magic link; sem senha. Demo local continua em /.
 */
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
    <div className="ds-gate ds-gate--login">
      <div className="ds-gate__eyebrow ds-label">CRM · IA para Donos</div>
      <Card className="ds-gate__card ds-gate__card--login">
        <h1 className="ds-gate__title">Entrar no CRM.</h1>
        <p className="ds-gate__lead">
          Link por e-mail, sem senha. Só operadores liberados entram.
        </p>
        <form onSubmit={enviar} className="ds-gate__form">
          <Input
            label="E-mail"
            type="email"
            required
            autoComplete="email"
            placeholder="voce@iaparadonos.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button type="submit" block disabled={busy}>
            {busy ? "Enviando…" : "Receber link de entrada"}
          </Button>
        </form>
        {msg && <p className="ds-muted" style={{ margin: 0 }}>{msg}</p>}
        <p className="ds-muted" style={{ margin: 0, fontSize: 13 }}>
          Sem Supabase? <a href="/">Abrir CRM em modo demo</a>.
        </p>
      </Card>
    </div>
  );
}
