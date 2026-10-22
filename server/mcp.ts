/**
 * Servidor MCP do CRM (stdio). É o que o Grokbot, o Cursor ou qualquer cliente MCP usa para
 * "conversar com o CRM": resumo do dia, métricas, contatos, funil e, com chave de escrita, ações.
 *
 * Ele NÃO acessa o arquivo de dados diretamente: fala com a API (um único processo escreve).
 *   CRM_API_URL=http://localhost:8787   CRM_API_KEY=crm_leitura_...  (ou de escrita)
 *
 * Configuração no Cursor (.cursor/mcp.json) e no Grokbot: veja a tela Integrações ou docs/grokbot.md.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ETAPAS } from "../src/domain/funil";
import { formatarReais } from "../src/domain/rules";
import type { Comando } from "../src/domain/comandos";
import type { PainelDemandas, Relatorio } from "../src/domain/metricas";
import type { EtapaId } from "../src/domain/types";

const API = (process.env.CRM_API_URL ?? "http://localhost:8787").replace(/\/$/, "");
const CHAVE = process.env.CRM_API_KEY ?? "";
const ESCRITA = CHAVE.startsWith("crm_escrita_") || process.env.CRM_MCP_ESCRITA === "1";

async function api<T>(caminho: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${API}${caminho}`, { ...init, headers: { "content-type": "application/json", "x-api-key": CHAVE, ...(init?.headers ?? {}) } });
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((corpo as { erro?: string }).erro ?? `HTTP ${r.status}`);
  return corpo as T;
}
const comando = (cmd: Comando) => api<{ estado: unknown; versao: string }>("/api/comandos", { method: "POST", body: JSON.stringify(cmd) });
const texto = (t: string) => ({ content: [{ type: "text" as const, text: t }] });
const erro = (e: unknown) => ({ content: [{ type: "text" as const, text: `Erro: ${(e as Error).message}` }], isError: true });

export function criarServidorMcp() {
  const server = new McpServer({ name: "crm-do-dono", version: "1.0.0" });

  server.registerTool("resumo_do_dia", { title: "Resumo do dia", description: "Quantas vendas hoje, receita do mês, projeção, handoffs pendentes, tarefas vencidas e ocorrências abertas. Comece por aqui." }, async () => {
    try {
      const [r, d, contatos] = await Promise.all([api<Relatorio>("/api/metricas/relatorio"), api<PainelDemandas>("/api/metricas/demandas?periodo=hoje"), api<{ nome: string; handoffPendente: boolean }[]>("/api/contatos")]);
      const pendentes = contatos.filter((c) => c.handoffPendente).map((c) => c.nome);
      return texto([
        `Vendas hoje: ${r.vendasHoje} · Leads hoje: ${d.atual.leads} · Gasto hoje: ${formatarReais(d.atual.gasto)}`,
        `Mês: ${r.vendasMes} vendas · receita ${formatarReais(r.receitaMes)} · projeção ${r.projecaoMes ? formatarReais(Math.round(r.projecaoMes)) : "—"} · ticket médio ${r.ticketMedio ? formatarReais(Math.round(r.ticketMedio)) : "—"}`,
        `Pediram humano e ninguém assumiu: ${pendentes.length ? pendentes.join(", ") : "ninguém"}`,
        `Tarefas vencidas: ${r.tarefasVencidas} · Ocorrências abertas: ${r.ocorrenciasAbertas}`,
      ].join("\n"));
    } catch (e) { return erro(e); }
  });

  server.registerTool("buscar_metricas", { title: "Métricas de demanda", description: "Leads, qualificados, ofertas, vendas, gasto, CPL, CPV por período (hoje, 7d, 30d) e por funil de entrada.", inputSchema: { periodo: z.enum(["hoje", "7d", "30d"]).default("7d") } }, async ({ periodo }) => {
    try {
      const p = await api<PainelDemandas>(`/api/metricas/demandas?periodo=${periodo}`);
      const linha = (d: PainelDemandas["atual"]) => `leads ${d.leads} · qualificados ${d.qualificados} · ofertas ${d.ofertas} · vendas ${d.vendas} · receita ${formatarReais(d.receita)} · gasto ${formatarReais(d.gasto)} · CPL ${d.cpl ? formatarReais(Math.round(d.cpl)) : "—"} · CPV ${d.cpv ? formatarReais(Math.round(d.cpv)) : "—"}`;
      return texto([`Período ${periodo}: ${linha(p.atual)}`, `Anterior: ${linha(p.anterior)}`, ...p.porFunil.map((f) => `- ${f.funil.nome}: ${linha(f.atual)}`)].join("\n"));
    } catch (e) { return erro(e); }
  });

  server.registerTool("listar_contatos", { title: "Listar contatos", description: "Lista contatos com etapa, dono e nota. Filtre por texto ou categoria.", inputSchema: { busca: z.string().optional(), categoria: z.enum(["lead", "prospect", "cliente"]).optional() } }, async ({ busca, categoria }) => {
    try {
      const q = new URLSearchParams(); if (busca) q.set("busca", busca); if (categoria) q.set("categoria", categoria);
      const lista = await api<{ id: string; nome: string; empresa: string; categoria: string; etapa: string | null; dono: string; nota: number | null; handoffPendente: boolean }[]>(`/api/contatos?${q}`);
      return texto(lista.map((c) => `${c.id} · ${c.nome} (${c.empresa || "—"}) · ${c.categoria} · etapa ${c.etapa ?? "—"} · dono ${c.dono} · nota ${c.nota ?? "—"}${c.handoffPendente ? " · PEDIU HUMANO" : ""}`).join("\n") || "Nenhum contato.");
    } catch (e) { return erro(e); }
  });

  server.registerTool("ver_contato", { title: "Ver contato", description: "Ficha completa: oportunidades, últimas mensagens, notas, tarefas, ligações e linha do tempo.", inputSchema: { contatoId: z.string() } }, async ({ contatoId }) => {
    try {
      const c = await api<Record<string, unknown> & { nome: string; empresa: string; telefone: string; categoria: string; nota: number | null; dono: string; oportunidades: { etapa: string; valor: number; perdida: boolean; briefing: unknown }[]; mensagens: { autor: string; texto: string; em: string }[]; notas: { texto: string }[]; tarefas: { texto: string; feita: boolean; venceEm: string | null }[]; linhaDoTempo: { em: string; tipo: string; texto: string }[] }>(`/api/contatos/${contatoId}`);
      return texto([
        `${c.nome} · ${c.empresa} · ${c.telefone} · ${c.categoria} · nota ${c.nota ?? "—"} · dono ${c.dono}`,
        `Oportunidades: ${c.oportunidades.map((o) => `${o.perdida ? "perdida" : o.etapa} (${formatarReais(o.valor)})${o.briefing ? " · briefing ok" : ""}`).join("; ")}`,
        `Últimas mensagens:`, ...c.mensagens.slice(-8).map((m) => `  [${m.em.slice(11, 16)}] ${m.autor}: ${m.texto}`),
        `Notas: ${c.notas.map((n) => n.texto).join(" | ") || "—"}`,
        `Tarefas abertas: ${c.tarefas.filter((t) => !t.feita).map((t) => t.texto).join(" | ") || "—"}`,
        `Linha do tempo (últimos 6): ${c.linhaDoTempo.slice(-6).map((e) => `${e.em.slice(0, 16)} ${e.tipo}: ${e.texto}`).join(" / ")}`,
      ].join("\n"));
    } catch (e) { return erro(e); }
  });

  server.registerTool("listar_funil", { title: "Funil de venda", description: "Cards e valor em aberto por etapa, com conversão entre etapas." }, async () => {
    try {
      const f = await api<{ etapas: { nome: string; cards: number; valor: number; oportunidades: { contato: string }[] }[]; conversao: { de: string; para: string; base: number; taxa: number | null }[] }>("/api/funil");
      return texto([...f.etapas.map((e) => `${e.nome}: ${e.cards} card(s) · ${formatarReais(e.valor)}${e.oportunidades.length ? ` · ${e.oportunidades.map((o) => o.contato).join(", ")}` : ""}`), "Conversão:", ...f.conversao.map((c) => `  ${c.de} → ${c.para}: ${c.taxa === null ? "—" : `${Math.round(c.taxa * 100)}%`} (n=${c.base})`)].join("\n"));
    } catch (e) { return erro(e); }
  });

  server.registerTool("listar_tarefas", { title: "Tarefas abertas", description: "Tarefas não feitas, com vencimento." }, async () => {
    try { const t = await api<{ id: string; contatoId: string; texto: string; venceEm: string | null; origem: string }[]>("/api/tarefas"); return texto(t.map((x) => `${x.id} · ${x.texto} · vence ${x.venceEm ?? "—"} · contato ${x.contatoId} · ${x.origem}`).join("\n") || "Nenhuma."); } catch (e) { return erro(e); }
  });

  server.registerTool("listar_ocorrencias", { title: "Ocorrências abertas", description: "Problemas e melhorias reportados pelos vendedores sobre o agente." }, async () => {
    try { const o = await api<{ id: string; tipo: string; status: string; descricao: string; contatoId: string }[]>("/api/ocorrencias"); return texto(o.map((x) => `${x.id} · ${x.tipo} · ${x.status} · ${x.descricao} · contato ${x.contatoId}`).join("\n") || "Nenhuma."); } catch (e) { return erro(e); }
  });

  if (ESCRITA) {
    server.registerTool("criar_lead", { title: "Criar lead", description: "Cria contato + oportunidade; o Cláudio abre a conversa.", inputSchema: { nome: z.string(), telefone: z.string(), origem: z.string().describe("id do funil de entrada"), empresa: z.string().optional(), email: z.string().optional() } }, async (a) => {
      try { const r = await api<{ contatoId: string; etapa: string }>("/api/leads", { method: "POST", body: JSON.stringify(a) }); return texto(`Lead criado: ${r.contatoId} em ${r.etapa}.`); } catch (e) { return erro(e); }
    });
    server.registerTool("mover_etapa", { title: "Mover etapa", description: `Move uma oportunidade. Etapas: ${ETAPAS.map((e) => e.id).join(", ")}. Pular/voltar exige motivo. Etapas automáticas só o sistema move.`, inputSchema: { oportunidadeId: z.string(), para: z.enum(ETAPAS.map((e) => e.id) as [string, ...string[]]), motivo: z.string().optional() } }, async ({ oportunidadeId, para, motivo }) => {
      try { await comando({ tipo: "moverEtapa", oportunidadeId, para: para as EtapaId, por: "mcp", motivo }); return texto(`Movido para ${para}.`); } catch (e) { return erro(e); }
    });
    server.registerTool("adicionar_nota", { title: "Adicionar nota interna", inputSchema: { contatoId: z.string(), texto: z.string() } }, async ({ contatoId, texto: t }) => {
      try { await comando({ tipo: "adicionarNota", contatoId, texto: t, autorId: null }); return texto("Nota adicionada."); } catch (e) { return erro(e); }
    });
    server.registerTool("criar_tarefa", { title: "Criar tarefa", inputSchema: { contatoId: z.string(), texto: z.string(), venceEm: z.string().datetime().optional() } }, async ({ contatoId, texto: t, venceEm }) => {
      try { await comando({ tipo: "criarTarefa", contatoId, texto: t, venceEm: venceEm ?? null, origem: "mcp" }); return texto("Tarefa criada."); } catch (e) { return erro(e); }
    });
    server.registerTool("enviar_mensagem", { title: "Enviar mensagem como humano", description: "Assume a conversa (se o robô estava) e envia. Nunca fale de preço sem autorização do dono.", inputSchema: { contatoId: z.string(), texto: z.string(), operadorId: z.string().optional() } }, async ({ contatoId, texto: t, operadorId }) => {
      try { await api(`/api/conversas/${contatoId}/mensagem`, { method: "POST", body: JSON.stringify({ texto: t, operadorId }) }); return texto("Mensagem enviada."); } catch (e) { return erro(e); }
    });
    server.registerTool("assumir_conversa", { title: "Assumir conversa", inputSchema: { contatoId: z.string(), operadorId: z.string() } }, async ({ contatoId, operadorId }) => {
      try { await comando({ tipo: "assumirConversa", contatoId, operadorId }); return texto("Conversa assumida; contato avisado."); } catch (e) { return erro(e); }
    });
  }
  return server;
}

if (process.argv[1] && /mcp\.(ts|js)$/.test(process.argv[1])) {
  const server = criarServidorMcp();
  await server.connect(new StdioServerTransport());
  console.error(`MCP crm-do-dono conectado · API ${API} · escopo ${ESCRITA ? "escrita" : "leitura"}`);
}
