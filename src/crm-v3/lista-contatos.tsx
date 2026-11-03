"use client";

import { CrmLink as Link, irPara } from "./hash-nav";
import { iniciais, nomeEmExibicao } from "@/lib/crm/format";
import { rotuloOrigem } from "@/lib/crm/rotulos";
import type { ContatoLinha } from "@/lib/crm/queries";
import { Avatar, Button } from "./crm-ui";
import { CrmEmpty } from "./empty";
import { CrmV3Page } from "./frame";
import { PageChrome } from "./page-chrome";

export function ListaContatosV3({
  titulo,
  label,
  tipo,
  q,
  revelou,
  contatos,
  vazioTitulo,
  vazioTexto,
}: {
  titulo: string;
  label: string;
  tipo: "lead" | "cliente";
  q: string;
  revelou: boolean;
  contatos: Array<ContatoLinha & { mascarado?: boolean }>;
  vazioTitulo: string;
  vazioTexto: string;
}) {
  const action = tipo === "cliente" ? "/clientes" : label === "Busca" ? "/buscar" : "/leads";
  return (
    <CrmV3Page>
      <PageChrome
        label={label}
        title={titulo}
        lede={
          revelou
            ? "Busca por nome: contato completo nesta lista."
            : "WhatsApp e e-mail mascarados. Contato completo só na busca por nome."
        }
      >
        <p style={{ margin: 0, font: "400 13px var(--font-sans)" }}>
          <Link href="/buscar" style={{ color: "var(--fg)", fontWeight: 600 }}>
            Buscar por nome
          </Link>
          {" · "}
          <Link href={tipo === "cliente" ? "/leads" : "/clientes"} style={{ color: "var(--fg)", fontWeight: 600 }}>
            {tipo === "cliente" ? "Ver leads" : "Ver clientes"}
          </Link>
        </p>
      </PageChrome>

      <form
        role="search"
        style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const termo = String(fd.get("q") ?? "").trim();
          irPara(termo ? `${action}?q=${encodeURIComponent(termo)}` : action);
        }}
      >
        <input
          name="q"
          defaultValue={q}
          placeholder="Nome da pessoa"
          aria-label="Buscar por nome"
          style={{
            flex: "1 1 220px",
            minHeight: 44,
            padding: "0 12px",
            borderRadius: 12,
            border: "1px solid var(--hairline-2)",
            background: "var(--surface)",
            color: "var(--fg)",
            font: "400 14px var(--font-sans)",
          }}
        />
        <Button type="submit" variant="secondary">
          Buscar
        </Button>
      </form>

      {contatos.length === 0 ? (
        <CrmEmpty title={vazioTitulo} text={vazioTexto} />
      ) : (
        <ul className="crm-v3-list">
          {contatos.map((c) => (
            <li key={c.id}>
              <Link href={`/contatos/${c.id}`}>
                <Avatar initials={iniciais(c.nome)} />
                <span style={{ minWidth: 0, display: "grid", gap: 2 }}>
                  <span style={{ font: "500 15px var(--font-sans)" }}>{nomeEmExibicao(c.nome)}</span>
                  <span style={{ font: "400 12px var(--font-sans)", color: "var(--fg-2)" }}>
                    {[c.empresa, c.whatsapp, c.email, c.origem ? rotuloOrigem(c.origem) : null].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </CrmV3Page>
  );
}
