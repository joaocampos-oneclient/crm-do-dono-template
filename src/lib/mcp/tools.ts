/**
 * Catálogo MCP-first: cada ação de tela tem ferramenta correspondente.
 * Guardrails: Cláudio nunca fala preço; Ledger nunca automático; PII mascarada na leitura.
 */
import { z } from "zod";
import { ETAPAS } from "@/domain/funil";
import { mencionaPreco, categoria, acaoDaNota } from "@/domain/rules";
import { relatorio } from "@/domain/metricas";
import type { EstadoCRM } from "@/domain/types";
import { crmConfig } from "@crm/config";
import { executarAgente } from "@/lib/agents";
import { AgenteSlug } from "@/lib/agents/types";
import { temLlmKey } from "@/lib/agents/llm-store";
import type { CrmMcpNivel } from "./niveis";
import { nivelPodeAdmin, nivelPodeEscrever } from "./niveis";

export type McpToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

export type McpTool = {
  name: string;
  description: string;
  nivelMinimo: CrmMcpNivel;
  inputSchema: z.ZodTypeAny;
  handler: (args: unknown, ctx: McpCtx) => Promise<McpToolResult>;
};

export type McpCtx = {
  nivel: CrmMcpNivel;
  /** Estado em memória (demo) ou bridge para Supabase. */
  estado: unknown;
  audit: (evento: string, detalhe: Record<string, unknown>) => void;
};

const ok = (data: unknown): McpToolResult => ({
  content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }],
});
const err = (msg: string): McpToolResult => ({
  content: [{ type: "text", text: msg }],
  isError: true,
});

function mascararTelefone(t: string): string {
  const d = t.replace(/\D/g, "");
  if (d.length < 4) return "***";
  return `***${d.slice(-4)}`;
}

export const MCP_TOOLS: McpTool[] = [
  {
    name: "crm_mapa_telas",
    description: "Mapa das telas do CRM e arquivos correspondentes (para edição via Cursor).",
    nivelMinimo: "leitura",
    inputSchema: z.object({}),
    async handler() {
      return ok({
        telas: [
          { id: "hoje", arquivo: "src/screens/Hoje.tsx", job: "fila do dia" },
          { id: "funil", arquivo: "src/screens/FunilKanban.tsx", job: "kanban de oportunidades" },
          { id: "conversas", arquivo: "src/screens/Conversas.tsx", job: "espelho WhatsApp" },
          { id: "contatos", arquivo: "src/screens/Contatos.tsx", job: "leads e clientes" },
          { id: "demandas", arquivo: "src/screens/Demandas.tsx", job: "CPL e funis de entrada" },
          { id: "agentes", arquivo: "src/screens/Agentes.tsx", job: "6 agentes e modos" },
          { id: "integracoes", arquivo: "src/screens/Integracoes.tsx", job: "MCP, WhatsApp, tokens" },
        ],
        regras: "src/domain/rules.ts",
        funil: "src/domain/funil.ts",
        config: "crm.config.ts",
        agentes: "src/lib/agents/",
        mcp: "src/lib/mcp/",
      });
    },
  },
  {
    name: "crm_regras_negocio",
    description: "Lista as regras inegociáveis (preço, handoff, amostra, Ledger).",
    nivelMinimo: "leitura",
    inputSchema: z.object({}),
    async handler() {
      return ok([
        "Cláudio nunca fala preço, desconto, parcela ou condição (trava em código).",
        "Handoff: nota 9–10, pediu preço, pediu humano ou quis entrar.",
        "Assumir/devolver gera aviso automático ao contato.",
        "Ledger nunca fica em Automático e nunca cobra.",
        "Amostra < 10 não vira porcentagem.",
        "Cooldown 48h entre mensagens automáticas; teto anti-loop 14 dias.",
      ]);
    },
  },
  {
    name: "crm_contatos_listar",
    description: "Lista contatos com telefone mascarado.",
    nivelMinimo: "leitura",
    inputSchema: z.object({
      categoria: z.enum(["lead", "prospect", "cliente"]).optional(),
      limite: z.number().int().min(1).max(100).default(20),
    }),
    async handler(args, ctx) {
      const a = z.object({ categoria: z.enum(["lead", "prospect", "cliente"]).optional(), limite: z.number().default(20) }).parse(args);
      const estado = ctx.estado as {
        contatos: { id: string; nome: string; empresa: string; telefone: string }[];
        oportunidades: { contatoId: string; etapa: string; perdida?: boolean }[];
      };
      const lista = (estado.contatos ?? [])
        .map((c) => {
          const ops = (estado.oportunidades ?? []).filter((o) => o.contatoId === c.id);
          return {
            id: c.id,
            nome: c.nome,
            empresa: c.empresa,
            telefone: mascararTelefone(c.telefone),
            categoria: categoria(ops as never),
          };
        })
        .filter((c) => !a.categoria || c.categoria === a.categoria)
        .slice(0, a.limite);
      return ok(lista);
    },
  },
  {
    name: "crm_contatos_buscar",
    description: "Busca contato por nome, empresa ou telefone.",
    nivelMinimo: "leitura",
    inputSchema: z.object({ q: z.string().min(1) }),
    async handler(args, ctx) {
      const { q } = z.object({ q: z.string() }).parse(args);
      const estado = ctx.estado as { contatos: { id: string; nome: string; empresa: string; telefone: string }[] };
      const qq = q.toLowerCase();
      const hits = (estado.contatos ?? [])
        .filter((c) => c.nome.toLowerCase().includes(qq) || c.empresa.toLowerCase().includes(qq) || c.telefone.includes(q))
        .slice(0, 10)
        .map((c) => ({ id: c.id, nome: c.nome, empresa: c.empresa, telefone: mascararTelefone(c.telefone) }));
      return ok(hits);
    },
  },
  {
    name: "crm_funil_resumo",
    description: "Resumo do funil de venda (contagem por etapa).",
    nivelMinimo: "leitura",
    inputSchema: z.object({}),
    async handler(_args, ctx) {
      const estado = ctx.estado as { oportunidades: { etapa: string; perdida?: boolean }[] };
      const contagem: Record<string, number> = {};
      for (const e of ETAPAS) contagem[e.id] = 0;
      for (const o of estado.oportunidades ?? []) {
        if (o.perdida) continue;
        contagem[o.etapa] = (contagem[o.etapa] ?? 0) + 1;
      }
      return ok({ etapas: ETAPAS.map((e) => ({ id: e.id, nome: e.nome, meta: e.meta, cards: contagem[e.id] ?? 0 })), funisEntrada: crmConfig.funis });
    },
  },
  {
    name: "crm_oportunidade_ver",
    description: "Detalhe de uma oportunidade.",
    nivelMinimo: "leitura",
    inputSchema: z.object({ id: z.string() }),
    async handler(args, ctx) {
      const { id } = z.object({ id: z.string() }).parse(args);
      const estado = ctx.estado as { oportunidades: { id: string }[] };
      const o = (estado.oportunidades ?? []).find((x) => x.id === id);
      return o ? ok(o) : err("Oportunidade não encontrada.");
    },
  },
  {
    name: "crm_oportunidade_mover",
    description: "Move oportunidade de etapa (exige validação da etapa).",
    nivelMinimo: "escrita",
    inputSchema: z.object({ id: z.string(), para: z.string(), motivo: z.string().optional() }),
    async handler(args, ctx) {
      if (!nivelPodeEscrever(ctx.nivel)) return err("Token só de leitura.");
      const a = z.object({ id: z.string(), para: z.string(), motivo: z.string().optional() }).parse(args);
      ctx.audit("crm_oportunidade_mover", a);
      return ok({ status: "ok", ...a, aviso: "No modo demo a mudança passa pelo despachar da UI; com Supabase grava crm_movimentos." });
    },
  },
  {
    name: "crm_nota_adicionar",
    description: "Adiciona nota interna a um contato.",
    nivelMinimo: "escrita",
    inputSchema: z.object({ contatoId: z.string(), texto: z.string().min(1) }),
    async handler(args, ctx) {
      if (!nivelPodeEscrever(ctx.nivel)) return err("Token só de leitura.");
      const a = z.object({ contatoId: z.string(), texto: z.string() }).parse(args);
      ctx.audit("crm_nota_adicionar", a);
      return ok({ status: "ok", ...a });
    },
  },
  {
    name: "crm_tarefa_followup",
    description: "Cria tarefa de follow-up.",
    nivelMinimo: "escrita",
    inputSchema: z.object({ contatoId: z.string(), titulo: z.string(), venceEm: z.string().optional() }),
    async handler(args, ctx) {
      if (!nivelPodeEscrever(ctx.nivel)) return err("Token só de leitura.");
      const a = z.object({ contatoId: z.string(), titulo: z.string(), venceEm: z.string().optional() }).parse(args);
      ctx.audit("crm_tarefa_followup", a);
      return ok({ status: "ok", ...a });
    },
  },
  {
    name: "crm_conversa_assumir",
    description: "Humano assume a conversa (aviso automático ao contato).",
    nivelMinimo: "escrita",
    inputSchema: z.object({ contatoId: z.string() }),
    async handler(args, ctx) {
      if (!nivelPodeEscrever(ctx.nivel)) return err("Token só de leitura.");
      const a = z.object({ contatoId: z.string() }).parse(args);
      ctx.audit("crm_conversa_assumir", a);
      return ok({ status: "ok", aviso: "Daí pra frente quem fala é o humano. A IA não atende mais até devolver." });
    },
  },
  {
    name: "crm_conversa_devolver",
    description: "Devolve a conversa ao Cláudio (aviso automático).",
    nivelMinimo: "escrita",
    inputSchema: z.object({ contatoId: z.string() }),
    async handler(args, ctx) {
      if (!nivelPodeEscrever(ctx.nivel)) return err("Token só de leitura.");
      const a = z.object({ contatoId: z.string() }).parse(args);
      ctx.audit("crm_conversa_devolver", a);
      return ok({ status: "ok", aviso: "Cláudio reassumiu." });
    },
  },
  {
    name: "crm_ocorrencia_registrar",
    description: "Registra ocorrência (problema ou melhoria) do Cláudio.",
    nivelMinimo: "escrita",
    inputSchema: z.object({
      contatoId: z.string(),
      tipo: z.enum(["problema", "melhoria"]),
      texto: z.string(),
    }),
    async handler(args, ctx) {
      if (!nivelPodeEscrever(ctx.nivel)) return err("Token só de leitura.");
      const a = z.object({ contatoId: z.string(), tipo: z.enum(["problema", "melhoria"]), texto: z.string() }).parse(args);
      ctx.audit("crm_ocorrencia_registrar", a);
      return ok({ status: "ok", ...a });
    },
  },
  {
    name: "crm_agentes_listar",
    description: "Lista os 6 agentes e modos.",
    nivelMinimo: "leitura",
    inputSchema: z.object({}),
    async handler() {
      return ok(Object.entries(crmConfig.agentes).map(([slug, a]) => ({ slug, ...a })));
    },
  },
  {
    name: "crm_agente_executar",
    description: "Executa um agente (scout, scribe, ledger, pilot, eco, claudio).",
    nivelMinimo: "escrita",
    inputSchema: z.object({
      slug: AgenteSlug,
      contatoId: z.string().optional(),
      contexto: z.record(z.unknown()).optional(),
    }),
    async handler(args, ctx) {
      if (!nivelPodeEscrever(ctx.nivel)) return err("Token só de leitura.");
      const a = z.object({ slug: AgenteSlug, contatoId: z.string().optional(), contexto: z.record(z.unknown()).optional() }).parse(args);
      if (a.slug === "claudio" && a.contexto?.rascunho && mencionaPreco(String(a.contexto.rascunho))) {
        return err("Cláudio nunca fala preço.");
      }
      const r = await executarAgente(a.slug, { contatoId: a.contatoId, contexto: a.contexto ?? {} });
      ctx.audit("crm_agente_executar", { slug: a.slug, resumo: r.saida.resumo });
      return ok(r);
    },
  },
  {
    name: "crm_agente_modo",
    description: "Troca o modo de um agente (sugerir | perguntar | automatico). Ledger não aceita automatico.",
    nivelMinimo: "admin",
    inputSchema: z.object({
      slug: AgenteSlug,
      modo: z.enum(["sugerir", "perguntar", "automatico"]),
    }),
    async handler(args, ctx) {
      if (!nivelPodeAdmin(ctx.nivel)) return err("Só admin.");
      const a = z.object({ slug: AgenteSlug, modo: z.enum(["sugerir", "perguntar", "automatico"]) }).parse(args);
      if (a.slug === "ledger" && a.modo === "automatico") return err("Ledger nunca fica em Automático.");
      ctx.audit("crm_agente_modo", a);
      return ok({ status: "ok", ...a });
    },
  },
  {
    name: "crm_aprovacao_decidir",
    description: "Aprova ou rejeita item da fila de aprovações.",
    nivelMinimo: "escrita",
    inputSchema: z.object({ id: z.string(), decisao: z.enum(["aprovada", "rejeitada"]) }),
    async handler(args, ctx) {
      if (!nivelPodeEscrever(ctx.nivel)) return err("Token só de leitura.");
      const a = z.object({ id: z.string(), decisao: z.enum(["aprovada", "rejeitada"]) }).parse(args);
      ctx.audit("crm_aprovacao_decidir", a);
      return ok({ status: "ok", ...a });
    },
  },
  {
    name: "crm_metricas_funis",
    description: "Métricas por funil de entrada (perpétuo, live, imersão) e CPL.",
    nivelMinimo: "leitura",
    inputSchema: z.object({ periodo: z.enum(["hoje", "7d", "30d"]).default("7d") }),
    async handler(args) {
      const { periodo } = z.object({ periodo: z.enum(["hoje", "7d", "30d"]).default("7d") }).parse(args);
      return ok({
        periodo,
        funis: crmConfig.funis.map((f) => ({
          id: f.id,
          nome: f.nome,
          leads: null,
          cpl: null,
          aviso: "Com dados reais, CPL = gasto / leads. Amostra < 10 não vira %.",
        })),
      });
    },
  },
  {
    name: "crm_acao_da_nota",
    description: "Diz o que fazer com uma nota 0–10 da Pergunta Matadora.",
    nivelMinimo: "leitura",
    inputSchema: z.object({ nota: z.number().nullable() }),
    async handler(args) {
      const { nota } = z.object({ nota: z.number().nullable() }).parse(args);
      return ok({ nota, acao: acaoDaNota(nota) });
    },
  },
  {
    name: "crm_farol_funil",
    description: "Sugere/aplica farol vermelho em oportunidades com problema (ex.: Cláudio).",
    nivelMinimo: "escrita",
    inputSchema: z.object({
      criterio: z.string().default("problema com o Cláudio"),
      aplicar: z.boolean().default(false),
    }),
    async handler(args, ctx) {
      if (!nivelPodeEscrever(ctx.nivel)) return err("Token só de leitura.");
      const a = z.object({ criterio: z.string(), aplicar: z.boolean() }).parse(args);
      ctx.audit("crm_farol_funil", a);
      return ok({
        status: a.aplicar ? "aplicado" : "plano",
        criterio: a.criterio,
        mudanca: "Em src/screens/FunilKanban.tsx, cards com ocorrência aberta do tipo problema ganham classe ds-farol-vermelho (borda tinta, negrito).",
        arquivos: ["src/screens/FunilKanban.tsx", "src/design-system-2027/tokens/crm.css"],
      });
    },
  },

  // --- Dia a dia do dono ---
  {
    name: "crm_hoje",
    description: "Resumo da fila de Hoje: handoffs, tarefas vencidas, leads novos e o que fazer agora.",
    nivelMinimo: "leitura",
    inputSchema: z.object({}),
    async handler(_args, ctx) {
      const estado = ctx.estado as EstadoCRM;
      const agora = new Date().toISOString();
      const handoffs = (estado.contatos ?? []).filter((c) => c.handoffPendente);
      const tarefasVencidas = (estado.tarefas ?? []).filter(
        (t) => !t.feita && t.venceEm && Date.parse(t.venceEm) < Date.parse(agora),
      );
      const leadsNovos = (estado.oportunidades ?? []).filter((o) => !o.perdida && o.etapa === "novo");
      const ocorrencias = (estado.ocorrencias ?? []).filter((o) => o.status !== "resolvida");
      return ok({
        agora,
        handoffs: handoffs.map((c) => ({ id: c.id, nome: c.nome, desde: c.handoffDesde })),
        tarefasVencidas: tarefasVencidas.map((t) => ({
          id: t.id,
          contatoId: t.contatoId,
          texto: t.texto,
          venceEm: t.venceEm,
        })),
        leadsNovos: leadsNovos.length,
        ocorrenciasAbertas: ocorrencias.length,
        llm: temLlmKey() ? "anthropic" : "regras locais",
        proximoPasso:
          handoffs.length > 0
            ? `Assumir ${handoffs[0].nome} (handoff pendente).`
            : tarefasVencidas.length > 0
              ? `Concluir ou reagendar: ${tarefasVencidas[0].texto}`
              : leadsNovos.length > 0
                ? "Abrir leads novos no funil e iniciar conversa."
                : "Fila limpa — olhar placar e follow-ups.",
      });
    },
  },
  {
    name: "crm_handoffs_listar",
    description: "Lista contatos com handoff pendente (pediu humano / preço / nota alta).",
    nivelMinimo: "leitura",
    inputSchema: z.object({}),
    async handler(_args, ctx) {
      const estado = ctx.estado as EstadoCRM;
      const lista = (estado.contatos ?? [])
        .filter((c) => c.handoffPendente)
        .map((c) => ({
          id: c.id,
          nome: c.nome,
          empresa: c.empresa,
          telefone: mascararTelefone(c.telefone),
          nota: c.nota,
          desde: c.handoffDesde,
          dono: c.dono,
        }));
      return ok({ total: lista.length, handoffs: lista });
    },
  },
  {
    name: "crm_tarefas_listar",
    description: "Lista tarefas abertas (opcional: só vencidas).",
    nivelMinimo: "leitura",
    inputSchema: z.object({
      soVencidas: z.boolean().default(false),
      limite: z.number().int().min(1).max(100).default(30),
    }),
    async handler(args, ctx) {
      const a = z.object({ soVencidas: z.boolean().default(false), limite: z.number().default(30) }).parse(args);
      const estado = ctx.estado as EstadoCRM;
      const agora = Date.now();
      const lista = (estado.tarefas ?? [])
        .filter((t) => !t.feita)
        .filter((t) => !a.soVencidas || (t.venceEm && Date.parse(t.venceEm) < agora))
        .slice(0, a.limite)
        .map((t) => {
          const c = estado.contatos.find((x) => x.id === t.contatoId);
          return {
            id: t.id,
            contatoId: t.contatoId,
            contato: c?.nome ?? t.contatoId,
            texto: t.texto,
            venceEm: t.venceEm,
            origem: t.origem,
            vencida: Boolean(t.venceEm && Date.parse(t.venceEm) < agora),
          };
        });
      return ok({ total: lista.length, tarefas: lista });
    },
  },
  {
    name: "crm_tarefas_concluir",
    description: "Marca uma tarefa como feita.",
    nivelMinimo: "escrita",
    inputSchema: z.object({ id: z.string(), feita: z.boolean().default(true) }),
    async handler(args, ctx) {
      if (!nivelPodeEscrever(ctx.nivel)) return err("Token só de leitura.");
      const a = z.object({ id: z.string(), feita: z.boolean().default(true) }).parse(args);
      const estado = ctx.estado as EstadoCRM;
      const t = estado.tarefas?.find((x) => x.id === a.id);
      if (!t) return err("Tarefa não encontrada.");
      ctx.audit("crm_tarefas_concluir", a);
      return ok({ status: "ok", id: a.id, feita: a.feita, texto: t.texto });
    },
  },
  {
    name: "crm_contato_criar",
    description: "Cria lead/contato (telefone único). No demo, instrui o despacho da UI.",
    nivelMinimo: "escrita",
    inputSchema: z.object({
      nome: z.string().min(1),
      telefone: z.string().min(8),
      empresa: z.string().optional(),
      origem: z.string().optional(),
    }),
    async handler(args, ctx) {
      if (!nivelPodeEscrever(ctx.nivel)) return err("Token só de leitura.");
      const a = z
        .object({
          nome: z.string(),
          telefone: z.string(),
          empresa: z.string().optional(),
          origem: z.string().optional(),
        })
        .parse(args);
      ctx.audit("crm_contato_criar", { ...a, telefone: mascararTelefone(a.telefone) });
      return ok({
        status: "ok",
        ...a,
        telefone: mascararTelefone(a.telefone),
        aviso: "Com Supabase grava crm_contatos + oportunidade em 'novo'. No demo use a tela Contatos ou POST /api/leads.",
      });
    },
  },
  {
    name: "crm_contato_ver",
    description: "Visão completa de um contato (oportunidades, últimas mensagens, tarefas).",
    nivelMinimo: "leitura",
    inputSchema: z.object({ id: z.string() }),
    async handler(args, ctx) {
      const { id } = z.object({ id: z.string() }).parse(args);
      const estado = ctx.estado as EstadoCRM;
      const c = estado.contatos.find((x) => x.id === id);
      if (!c) return err("Contato não encontrado.");
      const ops = estado.oportunidades.filter((o) => o.contatoId === id);
      const msgs = estado.mensagens.filter((m) => m.contatoId === id).slice(-10);
      const tarefas = estado.tarefas.filter((t) => t.contatoId === id && !t.feita);
      return ok({
        id: c.id,
        nome: c.nome,
        empresa: c.empresa,
        telefone: mascararTelefone(c.telefone),
        nota: c.nota,
        dono: c.dono,
        handoffPendente: c.handoffPendente,
        categoria: categoria(ops as never),
        oportunidades: ops.map((o) => ({ id: o.id, etapa: o.etapa, valor: o.valor, perdida: o.perdida })),
        ultimasMensagens: msgs.map((m) => ({ autor: m.autor, texto: m.texto.slice(0, 120), em: m.em })),
        tarefasAbertas: tarefas.map((t) => ({ id: t.id, texto: t.texto, venceEm: t.venceEm })),
      });
    },
  },
  {
    name: "crm_mensagens_listar",
    description: "Últimas mensagens de um contato (telefone mascarado no contexto).",
    nivelMinimo: "leitura",
    inputSchema: z.object({ contatoId: z.string(), limite: z.number().int().min(1).max(50).default(20) }),
    async handler(args, ctx) {
      const a = z.object({ contatoId: z.string(), limite: z.number().default(20) }).parse(args);
      const estado = ctx.estado as EstadoCRM;
      const msgs = estado.mensagens
        .filter((m) => m.contatoId === a.contatoId)
        .sort((x, y) => Date.parse(x.em) - Date.parse(y.em))
        .slice(-a.limite)
        .map((m) => ({ id: m.id, autor: m.autor, texto: m.texto, em: m.em, aviso: m.aviso }));
      return ok({ contatoId: a.contatoId, total: msgs.length, mensagens: msgs });
    },
  },
  {
    name: "crm_mensagem_enviar",
    description: "Envia mensagem WhatsApp a um contato (usa WPP Engine se configurado).",
    nivelMinimo: "escrita",
    inputSchema: z.object({
      contatoId: z.string(),
      texto: z.string().min(1),
      comoRobo: z.boolean().default(false),
    }),
    async handler(args, ctx) {
      if (!nivelPodeEscrever(ctx.nivel)) return err("Token só de leitura.");
      const a = z
        .object({ contatoId: z.string(), texto: z.string(), comoRobo: z.boolean().default(false) })
        .parse(args);
      if (a.comoRobo && mencionaPreco(a.texto)) return err("Cláudio nunca fala preço.");
      const estado = ctx.estado as EstadoCRM;
      const c = estado.contatos.find((x) => x.id === a.contatoId);
      if (!c) return err("Contato não encontrado.");
      ctx.audit("crm_mensagem_enviar", { contatoId: a.contatoId, chars: a.texto.length, comoRobo: a.comoRobo });
      try {
        const { getWhatsAppProvider, resolveProviderId, newIdempotencyKey } = await import("@/lib/whatsapp");
        const { effectiveApiKey, effectiveSessionId } = await import("@/lib/whatsapp/store");
        const sessionId = effectiveSessionId();
        if (!effectiveApiKey() || !sessionId) {
          return ok({
            status: "simulado",
            contatoId: a.contatoId,
            para: mascararTelefone(c.telefone),
            texto: a.texto,
            aviso: "Sem WPP_API_KEY/sessão — mensagem não saiu; configure em Integrações › WhatsApp.",
          });
        }
        const provider = getWhatsAppProvider();
        const r = await provider.sendText({
          sessionId,
          to: c.telefone,
          text: a.texto,
          idempotencyKey: newIdempotencyKey(),
        });
        if (!r.ok) return err(r.erro);
        return ok({
          status: "enviado",
          provider: resolveProviderId(),
          contatoId: a.contatoId,
          messageId: r.id,
        });
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  },
  {
    name: "crm_placar",
    description: "Placar do dono: vendas hoje/mês, receita, tarefas vencidas, ocorrências.",
    nivelMinimo: "leitura",
    inputSchema: z.object({}),
    async handler(_args, ctx) {
      const estado = ctx.estado as EstadoCRM;
      const agora = new Date().toISOString();
      return ok(relatorio(estado, agora));
    },
  },
  {
    name: "crm_leads_esfriando",
    description: "Leads em conversa/handoff sem movimento recente (risco de esfriar).",
    nivelMinimo: "leitura",
    inputSchema: z.object({ horas: z.number().default(48), limite: z.number().default(20) }),
    async handler(args, ctx) {
      const a = z.object({ horas: z.number().default(48), limite: z.number().default(20) }).parse(args);
      const estado = ctx.estado as EstadoCRM;
      const corte = Date.now() - a.horas * 3600_000;
      const etapasRisco = new Set(["novo", "conversa", "handoff", "briefing", "proposta", "oferta"]);
      const frios = estado.oportunidades
        .filter((o) => !o.perdida && etapasRisco.has(o.etapa))
        .filter((o) => Date.parse(o.entrouNaEtapaEm) < corte)
        .slice(0, a.limite)
        .map((o) => {
          const c = estado.contatos.find((x) => x.id === o.contatoId);
          return {
            oportunidadeId: o.id,
            etapa: o.etapa,
            horasParado: Math.round((Date.now() - Date.parse(o.entrouNaEtapaEm)) / 3600_000),
            contato: c ? { id: c.id, nome: c.nome, telefone: mascararTelefone(c.telefone) } : null,
          };
        });
      return ok({ criterioHoras: a.horas, total: frios.length, leads: frios });
    },
  },
  {
    name: "crm_ocorrencias_listar",
    description: "Lista ocorrências do Cláudio (problema/melhoria).",
    nivelMinimo: "leitura",
    inputSchema: z.object({
      status: z.enum(["aberta", "resolvida", "todas"]).default("aberta"),
      limite: z.number().default(20),
    }),
    async handler(args, ctx) {
      const a = z
        .object({ status: z.enum(["aberta", "resolvida", "todas"]).default("aberta"), limite: z.number().default(20) })
        .parse(args);
      const estado = ctx.estado as EstadoCRM;
      const lista = (estado.ocorrencias ?? [])
        .filter((o) => a.status === "todas" || (a.status === "resolvida" ? o.status === "resolvida" : o.status !== "resolvida"))
        .slice(0, a.limite)
        .map((o) => ({
          id: o.id,
          contatoId: o.contatoId,
          tipo: o.tipo,
          descricao: o.descricao,
          status: o.status,
          em: o.em,
        }));
      return ok({ total: lista.length, ocorrencias: lista });
    },
  },
  {
    name: "crm_whatsapp_status",
    description: "Status da conexão WhatsApp (WPP Engine / WAHA) e se LLM está configurado.",
    nivelMinimo: "leitura",
    inputSchema: z.object({}),
    async handler() {
      try {
        const { resolveProviderId } = await import("@/lib/whatsapp");
        const { effectiveApiKey, effectiveSessionId, loadConnection } = await import("@/lib/whatsapp/store");
        const conn = loadConnection();
        return ok({
          provider: resolveProviderId(),
          conectado: Boolean(effectiveApiKey()),
          sessionId: effectiveSessionId(),
          phone: conn?.phone ?? null,
          llm: temLlmKey() ? "configurado" : "regras locais",
        });
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  },
  {
    name: "crm_llm_status",
    description: "Se a chave Anthropic do membro está configurada (agentes Mastra vs regras).",
    nivelMinimo: "leitura",
    inputSchema: z.object({}),
    async handler() {
      const { mascaraChave, effectiveLlmApiKey, effectiveLlmModel } = await import("@/lib/agents/llm-store");
      const key = effectiveLlmApiKey();
      return ok({
        configurada: Boolean(key),
        mascara: mascaraChave(key),
        model: effectiveLlmModel(),
        modo: key ? "mastra+anthropic" : "regras locais",
      });
    },
  },
];

export function listToolsForNivel(nivel: CrmMcpNivel): McpTool[] {
  const ordem = { leitura: 0, escrita: 1, admin: 2 } as const;
  return MCP_TOOLS.filter((t) => ordem[nivel] >= ordem[t.nivelMinimo]);
}

export async function callTool(name: string, args: unknown, ctx: McpCtx): Promise<McpToolResult> {
  const tool = MCP_TOOLS.find((t) => t.name === name);
  if (!tool) return err(`Ferramenta desconhecida: ${name}`);
  const ordem = { leitura: 0, escrita: 1, admin: 2 } as const;
  if (ordem[ctx.nivel] < ordem[tool.nivelMinimo]) return err(`Nível ${ctx.nivel} não cobre ${name}.`);
  try {
    return await tool.handler(args, ctx);
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
}
