// @ts-nocheck
"use client";

import { useState } from "react";
import { ConversasV3 } from "./conversas";
import { AgentBadge, AgentGlyph, Avatar, Button, ModeSelector, NewFieldMark, StageChip, type AgentMode } from "./crm-ui";
import { CrmEmpty } from "./empty";
import { FunilV3 } from "./funil";
import { HojeV3 } from "./hoje";
import { ListaContatosV3 } from "./lista-contatos";
import {
  MOCK_APPROVALS,
  MOCK_CARDS,
  MOCK_CLIENTES,
  MOCK_DEMANDA,
  MOCK_ETAPAS,
  MOCK_FEED,
  MOCK_HOJE,
  MOCK_HOJE_VAZIO,
  MOCK_KPIS,
  MOCK_LEADS,
  MOCK_MEETS,
  MOCK_SUBTITLE,
  MOCK_TAXAS,
} from "./mock";
import { NumerosV3 } from "./numeros";
import { PageChrome } from "./page-chrome";
import { ApprovalCard } from "./crm-ui";
import { FichaAbas } from "./ficha-abas";

const AGORA = "2026-10-25T09:12:00-03:00";

function HojeMock({ vazio }: { vazio?: boolean }) {
  const hoje = vazio ? MOCK_HOJE_VAZIO : MOCK_HOJE;
  return (
    <>
      <HojeV3
        primeiroNome="João"
        hoje={hoje}
        kpis={vazio ? MOCK_KPIS.map((k) => ({ ...k, value: "0", chart: [0, 0, 0] })) : MOCK_KPIS}
        meets={vazio ? [] : MOCK_MEETS}
        feed={vazio ? [] : MOCK_FEED}
        subtitle={vazio ? undefined : MOCK_SUBTITLE}
        agora={AGORA}
      />
      {!vazio && (
        <div style={{ display: "none" }} aria-hidden>
          {MOCK_APPROVALS.map((item, i) => (
            <ApprovalCard key={i} item={item} onPrimary={() => undefined} onSkip={() => undefined} />
          ))}
        </div>
      )}
    </>
  );
}

function Tabela({ rows, cols }: { cols: string[]; rows: string[][] }) {
  return (
    <div className="crm-v3-surface" style={{ overflowX: "auto" }}>
      <table className="crm-v3-table">
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className={j > 0 ? "num" : undefined}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AgentesMock() {
  const [modos, setModos] = useState<Record<string, AgentMode>>({
    scout: "auto",
    scribe: "ask",
    ledger: "suggest",
    pilot: "ask",
    echo: "suggest",
  });
  return (
    <div className="crm-v3-page">
      <PageChrome
        label="Agentes"
        title="O time que trabalha com você."
        lede="Modos ainda não gravam no banco. Ledger nunca fica em Automático e nunca cobra."
      />
      <div style={{ display: "grid", gap: 12 }}>
        {(
          [
            ["scout", "Scout", "Procura sinais"],
            ["scribe", "Scribe", "Resume e escreve"],
            ["ledger", "Ledger", "Olha número"],
            ["pilot", "Pilot", "Sugere o próximo passo"],
            ["echo", "Echo", "Prepara o Meet"],
          ] as const
        ).map(([id, nome, faz]) => (
          <div key={id} className="crm-v3-surface">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <AgentGlyph agent={id} />
              <strong style={{ font: "600 15px var(--font-sans)" }}>{nome}</strong>
              <span style={{ color: "var(--fg-2)", font: "400 13px var(--font-sans)" }}>{faz}</span>
              <NewFieldMark />
            </div>
            <ModeSelector agent={id} value={modos[id]} onChange={(m) => setModos((s) => ({ ...s, [id]: m }))} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function VisualScreen({ tela }: { tela: string }) {
  switch (tela) {
    case "hoje":
      return <HojeMock />;
    case "hoje-vazio":
      return <HojeMock vazio />;
    case "funil":
      return <FunilV3 etapas={MOCK_ETAPAS} cards={MOCK_CARDS} taxas={MOCK_TAXAS} agora={AGORA} />;
    case "funil-vazio":
      return (
        <FunilV3
          etapas={MOCK_ETAPAS}
          cards={[]}
          taxas={{ ...MOCK_TAXAS, real: MOCK_TAXAS.real.map((t) => ({ ...t, taxa: null, entraram: 0, avancaram: 0 })) }}
          agora={AGORA}
        />
      );
    case "conversas":
      return (
        <ConversasV3
          lista={[
            {
              contatoId: "c-marcio",
              nome: "Márcio Teles",
              empresa: "Padaria Bom alimento",
              ultimaTexto: "quanto fica pra entrar?",
              ultimaAutor: "lead",
              ultimaEm: AGORA,
              modo: "claudio",
              responsavelNome: null,
              handoff: { abertoEm: AGORA, nivel: "15min", slaAte: AGORA },
            },
            {
              contatoId: "c-renata",
              nome: "Renata Moura",
              empresa: "Studio Lumière",
              ultimaTexto: "mandei o resumo",
              ultimaAutor: "otavio",
              ultimaEm: AGORA,
              modo: "humano",
              responsavelNome: "Otávio",
              handoff: null,
            },
          ]}
          detalhe={null}
          exemplo
          ligado
        />
      );
    case "conversas-vazio":
      return <ConversasV3 lista={[]} detalhe={null} exemplo={false} ligado={false} />;
    case "leads":
      return (
        <ListaContatosV3
          label="Leads"
          titulo="Leads de venda."
          tipo="lead"
          q=""
          revelou={false}
          contatos={MOCK_LEADS}
          vazioTitulo="Nenhum lead ainda"
          vazioTexto="O CRM nasce vazio."
        />
      );
    case "clientes":
      return (
        <ListaContatosV3
          label="Clientes"
          titulo="Clientes da Comunidade."
          tipo="cliente"
          q=""
          revelou={false}
          contatos={MOCK_CLIENTES}
          vazioTitulo="Nenhum cliente ainda"
          vazioTexto="Quem compra entra aqui."
        />
      );
    case "demanda":
      return (
        <NumerosV3 label="Demanda · últimos 14 dias" title={`${MOCK_DEMANDA.total} contatos novos.`} kpis={[{ label: "Entraram", value: "48", chart: MOCK_DEMANDA.porDia }]}>
          <Tabela cols={["Origem", "Contatos"]} rows={MOCK_DEMANDA.porOrigem.map((r) => [r.origem, String(r.total)])} />
        </NumerosV3>
      );
    case "placar":
      return (
        <NumerosV3
          label="Placar"
          title="Onde a gente está."
          kpis={[
            { label: "Vendas hoje", value: "0", chart: [0, 1, 0] },
            { label: "Conversas hoje", value: "3", chart: [1, 2, 3] },
            { label: "Ofertas hoje", value: "1", chart: [0, 1, 1] },
          ]}
        >
          <Tabela
            cols={["", "Hoje", "Meta do dia", "No mês"]}
            rows={[
              ["Vendas", "0", "2", "14"],
              ["Conversas", "3", "8", "61"],
              ["Ofertas", "1", "3", "19"],
            ]}
          />
        </NumerosV3>
      );
    case "metas":
      return (
        <NumerosV3 label="Configuração · Metas" title="O que a gente persegue." lede="As metas de partida são do PRD e valem até você mudar.">
          <div className="crm-v3-surface">
            <p style={{ margin: 0, font: "400 14px var(--font-sans)" }}>Vendas por dia · 2</p>
            <p style={{ margin: 0, font: "400 14px var(--font-sans)" }}>Conversas por dia · 8</p>
            <p style={{ margin: 0, font: "400 14px var(--font-sans)", color: "var(--fg-3)" }}>Ofertas por dia · não definida</p>
          </div>
        </NumerosV3>
      );
    case "sessao-fechada":
      return (
        <NumerosV3 label="Configuração · Sessão fechada" title="Quem a gente chama esta semana.">
          <CrmEmpty title="Ninguém na fila" text="Quando alguém bater na trave, aparece aqui para a sessão." />
        </NumerosV3>
      );
    case "ocorrencias":
      return (
        <NumerosV3 label="Configuração · Ocorrências do Cláudio" title="O que a equipe marcou.">
          <CrmEmpty title="Nenhuma ocorrência neste dia" text="As marcações feitas nas conversas aparecem aqui." />
        </NumerosV3>
      );
    case "integrar":
      return (
        <NumerosV3 label="Configuração · GrokBot" title="Integrar ao GrokBot" lede="Cole a URL e o prompt no GrokBot. Cada operador tem o próprio token.">
          <div className="crm-v3-surface">
            <p className="crm-label">URL do MCP</p>
            <p style={{ margin: 0, font: "400 13px var(--font-mono)" }}>https://crm.iaparadonos.com/api/mcp/crm</p>
            <Button variant="secondary">Gerar token de leitura</Button>
          </div>
        </NumerosV3>
      );
    case "contato":
      return (
        <div className="crm-v3-page">
          <header style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <Avatar initials="MT" size={44} />
            <div>
              <h1 className="crm-v3-display">Márcio Teles</h1>
              <p className="crm-v3-lede">Padaria Bom alimento · Anápolis</p>
            </div>
            <StageChip stage={2} />
            <AgentBadge owner="claudio" />
          </header>
          <p className="crm-label" style={{ margin: 0 }}>Lead · Em conversa</p>
          <FichaAbas
            abas={[
              {
                id: "resumo",
                label: "Resumo",
                painel: (
                  <div className="crm-v3-surface">
                    <h2 style={{ margin: 0, font: "520 18px var(--font-sans)" }}>Handoff</h2>
                    <p style={{ margin: 0, font: "400 13px var(--font-sans)", color: "var(--fg-2)" }}>
                      Nesta etapa desde 25/10 06:25. Assumir avisa o contato que uma pessoa está falando.
                    </p>
                  </div>
                ),
              },
              {
                id: "contato",
                label: "Contato",
                painel: (
                  <div className="crm-v3-surface">
                    <h2 style={{ margin: 0, font: "520 18px var(--font-sans)" }}>Contato</h2>
                    <p style={{ margin: 0, font: "400 13px var(--font-sans)", color: "var(--fg-2)" }}>
                      WhatsApp +55 62 9••••-4421 · E-mail m••••@padaria.com
                    </p>
                    <p style={{ margin: 0, font: "400 12px var(--font-sans)", color: "var(--fg-3)" }}>
                      Contato completo só na busca por nome.
                    </p>
                  </div>
                ),
              },
              {
                id: "qualificacao",
                label: "Qualificação",
                painel: (
                  <div className="crm-v3-surface">
                    <h2 style={{ margin: 0, font: "520 18px var(--font-sans)" }}>Nota que o lead se deu</h2>
                    <p className="crm-num" style={{ margin: 0, font: "500 28px var(--font-mono)" }}>8</p>
                    <p style={{ margin: 0, font: "400 13px var(--font-sans)", color: "var(--fg-2)" }}>
                      Ainda sem classificação automática
                    </p>
                  </div>
                ),
              },
              {
                id: "negocio",
                label: "Negócio",
                painel: (
                  <div className="crm-v3-surface">
                    <h2 style={{ margin: 0, font: "520 18px var(--font-sans)" }}>Negócio</h2>
                    {["Nicho", "Cidade / UF", "Faturamento", "Objeção principal"].map((c) => (
                      <div key={c} style={{ display: "flex", gap: 8, alignItems: "center", font: "400 13px var(--font-sans)" }}>
                        <span style={{ minWidth: 140 }}>{c}</span>
                        <NewFieldMark />
                        <span style={{ color: "var(--fg-3)" }}>Não informado</span>
                      </div>
                    ))}
                  </div>
                ),
              },
            ]}
          />
        </div>
      );
    case "trabalho":
      return (
        <div className="crm-v3-page">
          <PageChrome label="Trabalho" title="O que está na sua fila." lede="Tarefas abertas do dia. Concluir continua na ficha." />
          <ul className="crm-v3-list">
            {MOCK_HOJE.tarefas.map((t) => (
              <li key={t.id} style={{ padding: 14 }}>
                <div style={{ font: "500 15px var(--font-sans)" }}>{t.titulo}</div>
                <div style={{ font: "400 12px var(--font-sans)", color: "var(--fg-2)" }}>{t.contato?.nome}</div>
              </li>
            ))}
          </ul>
        </div>
      );
    case "agentes":
      return <AgentesMock />;
    default:
      return <HojeMock />;
  }
}

export const TELAS_VISUAL = [
  "hoje",
  "hoje-vazio",
  "funil",
  "funil-vazio",
  "conversas",
  "conversas-vazio",
  "leads",
  "clientes",
  "demanda",
  "placar",
  "metas",
  "sessao-fechada",
  "ocorrencias",
  "integrar",
  "contato",
  "trabalho",
  "agentes",
] as const;
