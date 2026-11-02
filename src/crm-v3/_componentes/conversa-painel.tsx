"use client";

import { useState } from "react";
import { Badge, Button, ChatBubble, Textarea, useToast } from "@/design-system-2027";
import { ROTULO_ALERTA } from "@/lib/crm/conversas-dominio";
import type { ConversaDetalhe, MensagemView } from "@/lib/crm/conversas";
import { dataHora } from "@/lib/crm/format";
import { useCRM } from "@/components/crm/provider";

export type OperadorPainel = { id: string; nome: string; slug?: string };

function autorDoBalao(a: MensagemView["autor"]): "lead" | "robo" | "humano" {
  if (a === "lead") return "lead";
  if (a === "claudio" || a === "sistema") return "robo";
  return "humano";
}

/**
 * Painel de conversa (leitura + composer local).
 * Takeover completo da produção fica para a próxima iteração; aqui o Assumir
 * marca handoff no estado demo.
 */
export function ConversaPainel({
  detalhe,
  exemplo,
  ligado,
  takeover = false,
  operadores = [],
}: {
  detalhe: ConversaDetalhe;
  exemplo: boolean;
  ligado: boolean;
  takeover?: boolean;
  operadores?: OperadorPainel[];
}) {
  const { despachar, operador } = useCRM();
  const toast = useToast();
  const [modo, setModo] = useState(detalhe.modo);
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function assumir() {
    if (exemplo) {
      toast.push("Exemplo ilustrativo: nada foi gravado.");
      setModo("humano");
      return;
    }
    setOcupado(true);
    await despachar(
      { tipo: "assumirConversa", contatoId: detalhe.contato.id, operadorId: operador?.id ?? "" },
      "Você assumiu a conversa",
    );
    setModo("humano");
    setOcupado(false);
  }

  async function enviar() {
    const t = texto.trim();
    if (!t) return;
    if (exemplo) {
      toast.push("Exemplo ilustrativo: nada foi enviado.");
      setTexto("");
      return;
    }
    if (!ligado && modo === "claudio") {
      toast.push("Cláudio ainda não está ligado neste ambiente.");
      return;
    }
    setOcupado(true);
    await despachar(
      {
        tipo: "enviarMensagem",
        contatoId: detalhe.contato.id,
        texto: t,
        operadorId: operador?.id ?? "",
      },
      "Mensagem enviada",
    );
    setTexto("");
    setOcupado(false);
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <header style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <strong style={{ font: "600 16px var(--font-sans)" }}>{detalhe.contato.nome}</strong>
        {detalhe.contato.empresa && (
          <span style={{ color: "var(--fg-2)", font: "400 13px var(--font-sans)" }}>{detalhe.contato.empresa}</span>
        )}
        <Badge tone={modo === "humano" ? "solid" : "dashed"}>{modo === "humano" ? "com humano" : "com Cláudio"}</Badge>
        {detalhe.handoff && (
          <Badge tone="outline">
            {detalhe.handoff.nivel ? ROTULO_ALERTA[detalhe.handoff.nivel] : "handoff"}
          </Badge>
        )}
        {modo === "claudio" && (
          <Button size="sm" onClick={assumir} loading={ocupado}>
            Assumir
          </Button>
        )}
        {takeover && operadores.length > 0 && (
          <span className="ds-muted" style={{ fontSize: 12 }}>
            {operadores.length} operadores
          </span>
        )}
      </header>

      <div style={{ display: "grid", gap: 8, maxHeight: 420, overflow: "auto", padding: "4px 0" }}>
        {detalhe.mensagens.map((m) => (
          <ChatBubble key={m.id} author={autorDoBalao(m.autor)} time={dataHora(m.em)} tag={m.aviso ? "aviso" : undefined}>
            {m.texto}
          </ChatBubble>
        ))}
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <Textarea
          label="Responder"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={3}
          placeholder={modo === "claudio" ? "Assuma para responder…" : "Escreva a mensagem"}
          disabled={modo === "claudio"}
        />
        <Button onClick={enviar} loading={ocupado} disabled={modo === "claudio" || !texto.trim()}>
          Enviar
        </Button>
      </div>
    </div>
  );
}
