"use client";

import * as React from "react";
import { Badge, Button, Card, Input } from "@/ds";

type Info = {
  provider: string;
  label: string;
  signupUrl: string;
  consoleUrl: string;
  connected: boolean;
  sessionId: string | null;
  oauthReady: boolean;
};

type SessionView = {
  sessionId: string;
  status: string;
  qr?: string | null;
  qrExpiresAt?: string | null;
  telefone?: string | null;
  coldWarning?: boolean;
  detalhe?: string;
};

export function WhatsAppOnboarding({ compact = false }: { compact?: boolean }) {
  const [info, setInfo] = React.useState<Info | null>(null);
  const [apiKey, setApiKey] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [session, setSession] = React.useState<SessionView | null>(null);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const loadInfo = React.useCallback(async () => {
    const res = await fetch("/api/whatsapp?action=info");
    const j = await res.json();
    setInfo(j);
    if (j.sessionId) {
      const st = await fetch(`/api/whatsapp?session=${encodeURIComponent(j.sessionId)}`);
      setSession(await st.json());
    }
  }, []);

  React.useEffect(() => {
    loadInfo().catch(() => undefined);
  }, [loadInfo]);

  React.useEffect(() => {
    if (!session?.sessionId) return;
    if (session.status !== "qr" && session.status !== "pending" && session.status !== "pairing") return;
    const t = setInterval(async () => {
      const res = await fetch("/api/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "refresh_qr", sessionId: session.sessionId }),
      });
      const j = await res.json();
      if (j.ok) {
        setSession((s) => (s ? { ...s, qr: j.qr, qrExpiresAt: j.expiresAt } : s));
      }
      const st = await fetch(`/api/whatsapp?session=${encodeURIComponent(session.sessionId)}`);
      setSession(await st.json());
    }, 8000);
    return () => clearInterval(t);
  }, [session?.sessionId, session?.status]);

  const criarConta = () => {
    const url = info?.signupUrl || info?.consoleUrl || "https://wpp-engine.oneclient.com.br";
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const integrar = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "bootstrap", apiKey, phone }),
      });
      const j = await res.json();
      if (!j.ok) {
        setMsg(j.erro ?? "Não deu para integrar.");
        return;
      }
      setSession(j.session);
      setMsg(j.aviso ?? "WhatsApp conectando. Escaneie o QR.");
      await loadInfo();
    } catch (e) {
      setMsg(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={{ padding: 16, display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <div>
          <strong>WhatsApp · {info?.label ?? "WPP Engine"}</strong>
          <p className="ds-muted" style={{ margin: "4px 0 0", fontSize: 14 }}>
            Provedor padrão do CRM. Cole a key uma vez; o CRM cria a sessão, mostra o QR e registra o webhook sozinho.
          </p>
        </div>
        <Badge tone={info?.connected ? "solid" : "outline"}>
          {session?.status === "conectado" ? "conectado" : info?.connected ? "key ok" : "não conectado"}
        </Badge>
      </div>

      <div className="ds-wrap" style={{ gap: 8 }}>
        <Button variant="secondary" onClick={criarConta}>
          Criar conta no WPP Engine
        </Button>
        <Button variant="ghost" onClick={() => loadInfo()}>
          Atualizar status
        </Button>
      </div>

      {!compact && (
        <p className="ds-muted" style={{ margin: 0, fontSize: 13 }}>
          No console: signup + checkout → emite a key <code>wae_live_…</code> (uma por tenant). Não existe criar tenant pela API pública.
          OAuth sem colar token vem depois — a interface já está prevista.
        </p>
      )}

      <div className="ds-formrow">
        <Input
          label="API key do WPP Engine"
          type="password"
          placeholder="wae_live_…"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          help="Cola uma vez. Guardamos localmente / em env; não precisa copiar de novo."
        />
        <Input
          label="Telefone da sessão (E.164)"
          placeholder="+5511999999999"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>

      <Button onClick={integrar} disabled={busy || !apiKey || !phone}>
        {busy ? "Integrando…" : "Integrar meu WhatsApp"}
      </Button>

      {msg && <p className="ds-muted" style={{ margin: 0 }}>{msg}</p>}

      {session?.coldWarning && (
        <p style={{ margin: 0, fontSize: 13 }}>
          <Badge tone="dashed">cold</Badge>{" "}
          Número novo: aqueça aos poucos. Limite 5000 msgs/dia · 1 sessão no self-service. Multi-operador e atribuição ficam neste CRM.
        </p>
      )}

      {session?.qr && (session.status === "qr" || session.status === "pending" || session.status === "pairing") && (
        <div style={{ display: "grid", gap: 8, justifyItems: "start" }}>
          <span className="ds-label">Escaneie o QR no WhatsApp · status {session.status}</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={session.qr.startsWith("data:") || session.qr.startsWith("http") ? session.qr : `data:image/png;base64,${session.qr}`}
            alt="QR Code WhatsApp"
            width={220}
            height={220}
            style={{ borderRadius: 12, background: "#fff" }}
          />
          {session.qrExpiresAt && (
            <span className="ds-muted" style={{ fontSize: 12 }}>
              Expira em {session.qrExpiresAt}
            </span>
          )}
        </div>
      )}

      {session?.status === "conectado" && (
        <p style={{ margin: 0 }}>
          Conectado{session.telefone ? ` · ${session.telefone}` : ""} · sessão <code>{session.sessionId}</code>
        </p>
      )}
    </Card>
  );
}
