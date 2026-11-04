"use client";

import * as React from "react";
import { useCRM } from "@/components/crm/provider";
import {
  cardsFunilDe,
  contatosLinhaDe,
  conversaDetalheDe,
  conversasDe,
  etapasV3,
  hojeDe,
  relatorioDe,
  taxasFunilDe,
} from "@/lib/crm/adapters";
import { AgentesV3 } from "./agentes";
import { RelanceV3 } from "./relance";
import { ConversasV3 } from "./conversas";
import { CrmEmpty } from "./empty";
import { FunilTraveV3, FunilV3 } from "./funil";
import { pathSemQuery, queryDoHash, useCrmPath } from "./hash-nav";
import { HojeV3 } from "./hoje";
import { ListaContatosV3 } from "./lista-contatos";
import { CrmV3Page } from "./frame";
import { PageChrome } from "./page-chrome";
import { CrmV3Shell, type CrmV3Badges } from "./shell";
import { ContatoRapido } from "./contato-rapido";
import { IntegracoesV3 } from "./integracoes-v3";

function papelNav(papel: string): "gestor" | "vendedor" | "trafego" {
  if (papel === "dono" || papel === "gestor") return "gestor";
  if (papel === "trafego") return "trafego";
  return "vendedor";
}

function Placeholder({ label, title, text }: { label: string; title: string; text: string }) {
  return (
    <CrmV3Page>
      <PageChrome label={label} title={title} lede={text} />
      <CrmEmpty title="Em breve neste template" text={text} actionHref="/" actionLabel="Voltar ao Hoje" />
    </CrmV3Page>
  );
}

/** Monta a casca CRM v3 + telas prioritárias a partir do EstadoCRM. */
export function CrmV3App() {
  const { estado, agora, operador, contatos } = useCRM();
  const path = useCrmPath();
  const base = pathSemQuery(path);
  const q = queryDoHash(path);

  const hoje = React.useMemo(() => hojeDe(estado, agora), [estado, agora]);
  const etapas = React.useMemo(() => etapasV3(), []);
  const badges: CrmV3Badges = {
    today: hoje.handoffsPendentes.length + hoje.tarefas.length || undefined,
    chat: contatos.filter((c) => c.handoffPendente).length || undefined,
  };

  const papel = papelNav(operador?.papel ?? "vendedor");
  const nome = operador?.nome ?? "Operador";

  let tela: React.ReactNode = null;

  if (base === "/" || base === "/hoje") {
    tela = (
      <HojeV3
        primeiroNome={nome.split(" ")[0] ?? nome}
        hoje={hoje}
        relatorio={relatorioDe(estado, agora)}
        agora={agora}
      />
    );
  } else if (base === "/funil") {
    if (q.get("fila") === "trave") {
      const trave = cardsFunilDe(estado, agora).filter((c) => c.bateuNaTrave);
      tela = (
        <FunilTraveV3>
          {trave.length === 0 ? (
            <CrmEmpty title="Ninguém bateu na trave" text="Quando alguém chegar em Oferta e parar, aparece aqui." />
          ) : (
            <ul className="crm-v3-list">
              {trave.map((c) => (
                <li key={c.id}>
                  <a href={`#/contatos/${c.contatoId}`}>{c.contatoNome}</a>
                </li>
              ))}
            </ul>
          )}
        </FunilTraveV3>
      );
    } else {
      const janela = Number(q.get("janela") ?? 7);
      const dias = [1, 7, 14, 30].includes(janela) ? janela : 7;
      tela = (
        <FunilV3
          etapas={etapas}
          cards={cardsFunilDe(estado, agora)}
          taxas={taxasFunilDe(estado, etapas, dias)}
          agora={agora}
        />
      );
    }
  } else if (base === "/conversas") {
    const lista = conversasDe(estado);
    const cId = q.get("c");
    const detalhe = cId ? conversaDetalheDe(estado, cId) : null;
    tela = (
      <ConversasV3
        lista={lista}
        detalhe={detalhe}
        exemplo={false}
        ligado={true}
        takeover={false}
        operadores={estado.operadores.filter((o) => o.tipo === "humano" && o.ativo).map((o) => ({ id: o.id, nome: o.nome }))}
      />
    );
  } else if (base === "/leads" || base === "/contatos") {
    const busca = (q.get("q") ?? "").trim().toLowerCase();
    let lista = contatosLinhaDe(estado, "lead");
    if (busca) lista = lista.filter((c) => c.nome.toLowerCase().includes(busca));
    tela = (
      <ListaContatosV3
        label="Leads"
        titulo="Quem ainda não comprou."
        tipo="lead"
        q={q.get("q") ?? ""}
        revelou={!!busca}
        contatos={lista}
        vazioTitulo="Nenhum lead"
        vazioTexto="Abra uma oportunidade pelo + ou espere o WhatsApp trazer alguém."
      />
    );
  } else if (base === "/clientes") {
    const busca = (q.get("q") ?? "").trim().toLowerCase();
    let lista = contatosLinhaDe(estado, "cliente");
    if (busca) lista = lista.filter((c) => c.nome.toLowerCase().includes(busca));
    tela = (
      <ListaContatosV3
        label="Clientes"
        titulo="Quem já está dentro."
        tipo="cliente"
        q={q.get("q") ?? ""}
        revelou={!!busca}
        contatos={lista}
        vazioTitulo="Nenhum cliente ainda"
        vazioTexto="Quando alguém pagar e passar da garantia, aparece aqui."
      />
    );
  } else if (base.startsWith("/contatos/")) {
    const id = base.slice("/contatos/".length);
    tela = <ContatoRapido contatoId={id} />;
  } else if (base === "/relance") {
    tela = <RelanceV3 />;
  } else if (base === "/agentes") {
    tela = <AgentesV3 />;
  } else if (base === "/trabalho") {
    tela = (
      <Placeholder
        label="Trabalho"
        title="Fila de trabalho do time."
        text="Tarefas e follow-ups do dia. Use Hoje enquanto esta tela ganha o porte completo."
      />
    );
  } else if (base === "/demanda") {
    tela = (
      <Placeholder
        label="Demanda"
        title="De onde vêm os leads."
        text="Placar de origem e criativos entra na próxima leva."
      />
    );
  } else if (base === "/placar" || base === "/relatorios") {
    const r = relatorioDe(estado, agora);
    tela = (
      <CrmV3Page>
        <PageChrome label="Placar" title="Números do mês." lede="Agregados sem PII — igual à produção." />
        <div className="crm-v3-surface" style={{ display: "grid", gap: 8, padding: 16 }}>
          <p style={{ margin: 0 }}>Vendas no mês: <strong>{r.mes.vendas}</strong></p>
          <p style={{ margin: 0 }}>Ofertas abertas: <strong>{r.mes.ofertas}</strong></p>
          <p style={{ margin: 0 }}>Conversas ativas: <strong>{r.mes.conversas}</strong></p>
          <p style={{ margin: 0 }}>Dias sem fechar: <strong>{r.diasSemFechar ?? "—"}</strong></p>
        </div>
      </CrmV3Page>
    );
  } else if (base === "/config/metas" || base === "/config/sessao-fechada" || base === "/config/ocorrencias") {
    const titulo =
      base.includes("metas") ? "Metas" : base.includes("sessao") ? "Sessão fechada" : "Ocorrências";
    tela = <Placeholder label={titulo} title={titulo} text="Configuração avançada: porte incremental na próxima leva." />;
  } else if (base === "/config/integrar" || base === "/integracoes") {
    tela = <IntegracoesV3 />;
  } else if (base === "/buscar") {
    tela = (
      <ListaContatosV3
        label="Busca"
        titulo="Buscar por nome."
        tipo="lead"
        q={q.get("q") ?? ""}
        revelou
        contatos={contatosLinhaDe(estado, "lead").concat(contatosLinhaDe(estado, "cliente")).filter((c) => {
          const busca = (q.get("q") ?? "").trim().toLowerCase();
          return !busca || c.nome.toLowerCase().includes(busca);
        })}
        vazioTitulo="Nada encontrado"
        vazioTexto="Digite o nome completo ou parcial."
      />
    );
  } else {
    tela = <Placeholder label="CRM" title="Tela em porte" text={`Rota ${base} ainda não portada.`} />;
  }

  return (
    <div className="ds-root crm-v3-root" data-crm-v3="">
      <CrmV3Shell papel={papel} nome={nome} ligacaoLigada badges={badges}>
        {tela}
      </CrmV3Shell>
    </div>
  );
}
