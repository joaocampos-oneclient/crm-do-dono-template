"use client";

import { useState } from "react";
import { BottomSheet, Button, Input, useToast } from "@/design-system-2027";
import { useCRM } from "@/components/crm/provider";
import { irPara } from "../hash-nav";

/** Botão "+": cria lead/oportunidade no estado local. */
export function NovaOportunidade({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  const { despachar, estado } = useCRM();
  const toast = useToast();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const campo = (k: string) => String(f.get(k) ?? "").trim();
    const nome = campo("nome");
    if (!nome) {
      setErro("Nome é obrigatório.");
      return;
    }
    setEnviando(true);
    setErro(null);
    const produtoId = estado.produtos.find((p) => p.ativo)?.id ?? estado.produtos[0]?.id;
    const antes = new Set(estado.contatos.map((c) => c.id));
    const novo = await despachar(
      {
        tipo: "criarLead",
        nome,
        telefone: campo("whatsapp") || "sem-telefone",
        empresa: campo("empresa") || undefined,
        email: campo("email") || undefined,
        origem: campo("origem") || "manual",
        produtoId,
        abrirConversa: false,
      },
      "Oportunidade criada",
    );
    setEnviando(false);
    if (!novo) {
      setErro("Não foi possível criar. Veja o toast.");
      return;
    }
    const criado = novo.contatos.find((c) => !antes.has(c.id)) ?? novo.contatos[novo.contatos.length - 1];
    const opp = criado ? novo.oportunidades.find((o) => o.contatoId === criado.id && !o.perdida) : null;
    if (opp && opp.etapa !== "handoff") {
      await despachar({
        tipo: "moverEtapa",
        oportunidadeId: opp.id,
        para: "handoff",
        por: "sistema",
        forcar: true,
      });
    }
    toast.push("Oportunidade criada em Handoff");
    aoFechar();
    if (criado) irPara(`/contatos/${criado.id}`);
  }

  return (
    <BottomSheet
      open={aberto}
      onClose={aoFechar}
      title="Nova oportunidade"
      footer={
        <Button type="submit" form="form-nova-oportunidade" loading={enviando} block>
          Criar em Handoff
        </Button>
      }
    >
      <form id="form-nova-oportunidade" onSubmit={enviar} style={{ display: "grid", gap: 16 }}>
        <Input name="nome" label="Nome" required />
        <Input name="empresa" label="Empresa" />
        <Input name="whatsapp" label="WhatsApp" placeholder="+55…" />
        <Input name="email" label="E-mail" type="email" />
        <Input name="origem" label="Origem" placeholder="manual, indicação…" defaultValue="manual" />
        {erro && (
          <p role="alert" style={{ margin: 0, color: "var(--fg)", font: "500 13px var(--font-sans)" }}>
            {erro}
          </p>
        )}
      </form>
    </BottomSheet>
  );
}
