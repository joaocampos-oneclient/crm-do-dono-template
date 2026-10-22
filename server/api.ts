/**
 * API do CRM (Hono). Roda local com `npm run dev:server` e publica igual (docs/deploy.md).
 *
 * Autenticação: header `x-api-key` (ou `Authorization: Bearer`). A chave vem de Operadores e chaves
 * (escopo leitura ou escrita) ou da variável CRM_API_KEY (chave mestra de escrita).
 * CRM_SEM_AUTH=1 desliga a autenticação (só para desenvolvimento local).
 *
 * Toda escrita é um Comando (src/domain/comandos.ts). Depois de cada comando, o servidor dispara os
 * EFEITOS: mensagens novas do robô/humano saem pelo adaptador de WhatsApp; e-mails pelo de e-mail.
 */
import { Hono, type Context, type Next } from "hono";
import { cors } from "hono/cors";
import { COMANDOS_DE_SISTEMA, ErroDeRegra, type Comando, type RespostaRobo } from "../src/domain/comandos";
import { claudioResponde, type ContextoClaudio } from "../src/domain/claudio";
import { chaveAtiva, configMcp, promptGrokbot } from "../src/domain/integracao";
import { conversaoPorEtapa, painelDemandas, relatorio, valorPorEtapa } from "../src/domain/metricas";
import { ETAPAS } from "../src/domain/funil";
import { oportunidadePrincipal, telefoneDigitos } from "../src/domain/rules";
import type { Escopo, EstadoCRM, Periodo } from "../src/domain/types";
import { contatosCompletos, linhaDoTempo, montarContato } from "../src/domain/visao";
import { adaptadoresLocais, type AdaptadoresServidor } from "./adapters";
import { configLLMDoAmbiente, redigirComLLM, type ConfigLLM } from "./claudio";
import type { Store } from "./store";

export interface DepsApi {
  store: Store;
  adaptadores?: AdaptadoresServidor;
  llm?: ConfigLLM | null;
  chaveMestra?: string | null;
  semAuth?: boolean;
  /** URL pública da API, usada nos textos de integração. */
  urlPublica?: string;
}

type Vars = { escopo: Escopo; operadorId: string | null };

export function criarApi(deps: DepsApi) {
  const { store } = deps;
  const adaptadores = deps.adaptadores ?? adaptadoresLocais();
  const llm = deps.llm === undefined ? configLLMDoAmbiente() : deps.llm;
  const app = new Hono<{ Variables: Vars }>();

  app.use("*", cors({ origin: (o) => o ?? "*", allowHeaders: ["content-type", "x-api-key", "authorization"] }));

  const autenticar = async (c: Context<{ Variables: Vars }>, next: Next) => {
    if (c.req.path === "/api/saude") return next();
    const bruta = c.req.header("x-api-key") ?? c.req.header("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    if (deps.semAuth) { c.set("escopo", "escrita"); c.set("operadorId", null); return next(); }
    if (deps.chaveMestra && bruta === deps.chaveMestra) { c.set("escopo", "escrita"); c.set("operadorId", null); return next(); }
    const k = store.estado().chaves.find((x) => x.chave === bruta && !x.revogadaEm);
    if (!k) return c.json({ erro: "Chave de API ausente, inválida ou revogada. Crie uma em Operadores e chaves." }, 401);
    c.set("escopo", k.escopo); c.set("operadorId", k.operadorId);
    return next();
  };
  app.use("/api/*", autenticar);

  const exigirEscrita = (c: Context<{ Variables: Vars }>) => (c.get("escopo") === "escrita" ? null : c.json({ erro: "Esta operação exige chave de escopo 'escrita'." }, 403));

  /** Aplica o comando e dispara efeitos (saídas por WhatsApp / e-mail). */
  const executar = async (cmd: Comando) => {
    const antes = store.estado();
    const depois = await store.despachar(cmd);
    await efeitos(antes, depois, adaptadores);
    return depois;
  };

  const erro = (c: Context, e: unknown) => {
    if (e instanceof ErroDeRegra) return c.json({ erro: e.message }, 422);
    return c.json({ erro: (e as Error).message ?? "erro" }, 500);
  };

  // ---------- leitura ----------
  app.get("/api/saude", (c) => c.json({ ok: true, versao: store.versao(), persistencia: store.caminho ? "arquivo" : "memória", llm: !!llm }));
  app.get("/api/versao", (c) => c.json({ versao: store.versao() }));
  app.get("/api/estado", (c) => c.json(store.estado()));

  app.get("/api/contatos", (c) => {
    const q = (c.req.query("busca") ?? "").toLowerCase();
    const cat = c.req.query("categoria");
    const lista = contatosCompletos(store.estado()).filter((x) => (!cat || x.categoria === cat) && (!q || `${x.nome} ${x.empresa} ${x.telefone} ${x.email}`.toLowerCase().includes(q)));
    return c.json(lista.map((x) => ({ id: x.id, nome: x.nome, empresa: x.empresa, telefone: x.telefone, email: x.email, categoria: x.categoria, dono: x.dono, operadorId: x.operadorId, nota: x.nota, handoffPendente: x.handoffPendente, etapa: oportunidadePrincipal(x.oportunidades)?.etapa ?? null, origem: x.origem, criadoEm: x.criadoEm })));
  });
  app.get("/api/contatos/:id", (c) => {
    const x = montarContato(store.estado(), c.req.param("id"));
    if (!x) return c.json({ erro: "Contato não encontrado" }, 404);
    return c.json({ ...x, linhaDoTempo: linhaDoTempo(store.estado(), x) });
  });
  app.get("/api/funil", (c) => {
    const e = store.estado();
    const valores = valorPorEtapa(e);
    return c.json({
      etapas: ETAPAS.map((et) => ({ id: et.id, nome: et.nome, meta: et.meta, auto: et.auto, cards: valores.get(et.id)!.n, valor: valores.get(et.id)!.valor, oportunidades: e.oportunidades.filter((o) => o.etapa === et.id && !o.perdida).map((o) => ({ id: o.id, contatoId: o.contatoId, contato: e.contatos.find((x) => x.id === o.contatoId)?.nome, valor: o.valor, entrouNaEtapaEm: o.entrouNaEtapaEm })) })),
      conversao: conversaoPorEtapa(e).map((x) => ({ de: x.de.id, para: x.para.id, base: x.base, seguinte: x.seguinte, taxa: x.taxa })),
    });
  });
  app.get("/api/metricas/demandas", (c) => {
    const periodo = (c.req.query("periodo") ?? "7d") as Periodo;
    if (!["hoje", "7d", "30d"].includes(periodo)) return c.json({ erro: "periodo deve ser hoje, 7d ou 30d" }, 400);
    return c.json(painelDemandas(store.estado(), periodo, new Date().toISOString()));
  });
  app.get("/api/metricas/relatorio", (c) => c.json(relatorio(store.estado(), new Date().toISOString())));
  app.get("/api/tarefas", (c) => c.json(store.estado().tarefas.filter((t) => c.req.query("todas") === "1" || !t.feita)));
  app.get("/api/ocorrencias", (c) => c.json(store.estado().ocorrencias.filter((o) => c.req.query("todas") === "1" || o.status !== "resolvida")));
  app.get("/api/saidas", (c) => c.json(adaptadores.saidas()));
  app.get("/api/integracoes/prompt-grokbot", (c) => {
    const e = store.estado();
    const url = deps.urlPublica ?? new URL(c.req.url).origin;
    return c.text(promptGrokbot(e, { apiUrl: url, chaveLeitura: chaveAtiva(e, "leitura"), chaveEscrita: c.get("escopo") === "escrita" ? chaveAtiva(e, "escrita") : null }));
  });
  app.get("/api/integracoes/mcp.json", (c) => c.text(configMcp({ apiUrl: deps.urlPublica ?? new URL(c.req.url).origin, chaveLeitura: chaveAtiva(store.estado(), "leitura"), chaveEscrita: null, caminhoRepo: process.cwd() }), 200, { "content-type": "application/json" }));

  // ---------- escrita ----------
  app.post("/api/comandos", async (c) => {
    const cmd = (await c.req.json()) as Comando;
    if (!cmd?.tipo) return c.json({ erro: "Comando sem tipo" }, 400);
    if (c.get("escopo") !== "escrita" && !COMANDOS_DE_SISTEMA.includes(cmd.tipo)) return c.json({ erro: `O comando '${cmd.tipo}' exige chave de escrita.` }, 403);
    if (cmd.tipo === "substituirEstado" && c.get("escopo") !== "escrita") return c.json({ erro: "proibido" }, 403);
    try {
      const estado = await executar(cmd);
      return c.json({ estado, versao: store.versao() });
    } catch (e) { return erro(c, e); }
  });

  /** Webhook universal de lead. Aceita o formato simples e o `field_data` do Meta Lead Ads. */
  app.post("/api/leads", async (c) => {
    const neg = exigirEscrita(c); if (neg) return neg;
    const corpo = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const lead = normalizarLead(corpo, store.estado());
    if (!lead.nome || !lead.telefone) return c.json({ erro: "Informe nome e telefone (ou field_data do Meta com full_name e phone_number)." }, 400);
    try {
      const jaExistia = store.estado().contatos.some((x) => telefoneDigitos(x.telefone) === telefoneDigitos(lead.telefone));
      const estado = await executar({ tipo: "criarLead", ...lead, por: "webhook" });
      const contato = estado.contatos.find((x) => telefoneDigitos(x.telefone) === telefoneDigitos(lead.telefone))!;
      const o = oportunidadePrincipal(estado.oportunidades.filter((x) => x.contatoId === contato.id));
      return c.json({ ok: true, contatoId: contato.id, oportunidadeId: o?.id ?? null, etapa: o?.etapa ?? null, novo: !jaExistia }, 201);
    } catch (e) { return erro(c, e); }
  });

  /** Mensagem recebida do WhatsApp. Cria o lead se não existir; o robô responde; a resposta volta no corpo e sai pelo adaptador. */
  app.post("/api/webhooks/whatsapp", async (c) => {
    const neg = exigirEscrita(c); if (neg) return neg;
    const { telefone, texto, nome, origem } = (await c.req.json().catch(() => ({}))) as { telefone?: string; texto?: string; nome?: string; origem?: string };
    if (!telefone || !texto) return c.json({ erro: "Informe telefone e texto." }, 400);
    try {
      let estado = store.estado();
      let contato = estado.contatos.find((x) => telefoneDigitos(x.telefone) === telefoneDigitos(telefone));
      if (!contato) {
        estado = await executar({ tipo: "criarLead", nome: nome ?? `WhatsApp ${telefone}`, telefone, origem: origem ?? estado.funis[0]?.id ?? "", abrirConversa: false, por: "whatsapp" });
        contato = estado.contatos.find((x) => telefoneDigitos(x.telefone) === telefoneDigitos(telefone))!;
      }
      const antes = estado.mensagens.length;
      let respostaRobo: RespostaRobo | undefined;
      if (llm && contato.dono === "robo") {
        const ctx = contextoClaudio(estado, contato.id);
        const r = ctx ? await redigirComLLM(llm, ctx, texto) : null;
        if (r) respostaRobo = r;
      }
      estado = await executar({ tipo: "receberMensagem", contatoId: contato.id, texto, respostaRobo });
      const novas = estado.mensagens.slice(antes).filter((m) => m.contatoId === contato!.id && m.autor !== "contato");
      const atual = estado.contatos.find((x) => x.id === contato!.id)!;
      return c.json({ ok: true, contatoId: contato.id, respostas: novas.map((m) => m.texto), dono: atual.dono, handoffPendente: atual.handoffPendente, nota: atual.nota });
    } catch (e) { return erro(c, e); }
  });

  /** Confirmação de pagamento vinda do provedor. */
  app.post("/api/webhooks/pagamento", async (c) => {
    const neg = exigirEscrita(c); if (neg) return neg;
    const { pagamentoId, status } = (await c.req.json().catch(() => ({}))) as { pagamentoId?: string; status?: string };
    if (!pagamentoId || !status) return c.json({ erro: "Informe pagamentoId e status (pago | falhou)." }, 400);
    try {
      const estado = await executar(status === "pago" ? { tipo: "confirmarPagamento", pagamentoId } : { tipo: "falharPagamento", pagamentoId });
      const p = estado.pagamentos.find((x) => x.id === pagamentoId)!;
      const o = estado.oportunidades.find((x) => x.id === p.oportunidadeId)!;
      return c.json({ ok: true, status: p.status, etapa: o.etapa });
    } catch (e) { return erro(c, e); }
  });

  /** Abertura de proposta (pixel/link rastreado). */
  app.post("/api/webhooks/proposta-aberta", async (c) => {
    const { propostaId } = (await c.req.json().catch(() => ({}))) as { propostaId?: string };
    if (!propostaId) return c.json({ erro: "Informe propostaId." }, 400);
    try { await executar({ tipo: "registrarAberturaProposta", propostaId }); return c.json({ ok: true }); } catch (e) { return erro(c, e); }
  });

  /** Humano envia mensagem (assume a conversa se o robô estava no comando). */
  app.post("/api/conversas/:id/mensagem", async (c) => {
    const neg = exigirEscrita(c); if (neg) return neg;
    const { texto, operadorId } = (await c.req.json().catch(() => ({}))) as { texto?: string; operadorId?: string };
    const op = operadorId ?? c.get("operadorId") ?? store.estado().operadores.find((o) => o.tipo === "humano" && o.ativo)?.id;
    if (!texto || !op) return c.json({ erro: "Informe texto (e operadorId, se a chave não tiver operador)." }, 400);
    try { await executar({ tipo: "enviarMensagem", contatoId: c.req.param("id"), texto, operadorId: op }); return c.json({ ok: true }); } catch (e) { return erro(c, e); }
  });

  app.notFound((c) => c.json({ erro: `Rota não encontrada: ${c.req.method} ${c.req.path}` }, 404));
  return app;
}

/** Depois de um comando: tudo que o CRM registrou como saída é enviado pelos adaptadores. */
export async function efeitos(antes: EstadoCRM, depois: EstadoCRM, ad: AdaptadoresServidor) {
  if (depois === antes) return;
  const idsAntes = new Set(antes.mensagens.map((m) => m.id));
  for (const m of depois.mensagens) {
    if (idsAntes.has(m.id) || m.autor === "contato") continue;
    const c = depois.contatos.find((x) => x.id === m.contatoId);
    if (c) await ad.whatsapp.enviar(c.telefone, m.texto);
  }
  const emailsAntes = new Set(antes.emails.map((e) => e.id));
  for (const e of depois.emails) {
    if (emailsAntes.has(e.id)) continue;
    const c = depois.contatos.find((x) => x.id === e.contatoId);
    if (c?.email) await ad.email.enviar(c.email, e.assunto, e.texto);
  }
}

export function contextoClaudio(estado: EstadoCRM, contatoId: string): ContextoClaudio | null {
  const contato = estado.contatos.find((c) => c.id === contatoId);
  if (!contato) return null;
  const o = oportunidadePrincipal(estado.oportunidades.filter((x) => x.contatoId === contatoId));
  const vendedor = estado.operadores.find((x) => x.tipo === "humano" && x.ativo && x.papel === "vendedor") ?? estado.operadores.find((x) => x.tipo === "humano" && x.ativo);
  return {
    contato,
    oportunidade: o,
    mensagens: estado.mensagens.filter((m) => m.contatoId === contatoId),
    produto: estado.produtos.find((p) => p.id === o?.produtoId) ?? null,
    funil: estado.funis.find((f) => f.id === contato.origem) ?? null,
    nomeOperador: vendedor?.nome ?? "uma pessoa do time",
    nomeEmpresa: estado.config.nomeEmpresa,
  };
}

/** Converte payloads comuns (simples, Meta Lead Ads field_data, Typeform-like) para o comando criarLead. */
export function normalizarLead(corpo: Record<string, unknown>, estado: EstadoCRM) {
  const s = (k: string) => (typeof corpo[k] === "string" ? (corpo[k] as string).trim() : "");
  let nome = s("nome") || s("name") || s("full_name");
  let telefone = s("telefone") || s("phone") || s("phone_number") || s("whatsapp");
  let email = s("email");
  let empresa = s("empresa") || s("company") || s("company_name");
  const fd = corpo.field_data as { name: string; values: string[] }[] | undefined;
  if (Array.isArray(fd)) {
    const v = (n: string) => fd.find((f) => f.name === n)?.values?.[0] ?? "";
    nome ||= v("full_name") || v("nome");
    telefone ||= v("phone_number") || v("telefone") || v("whatsapp");
    email ||= v("email");
    empresa ||= v("company_name") || v("empresa");
  }
  const origemBruta = s("origem") || s("funil") || s("source") || s("utm_source");
  const origem = estado.funis.find((f) => f.id === origemBruta || f.nome.toLowerCase() === origemBruta.toLowerCase())?.id ?? estado.funis[0]?.id ?? "";
  return {
    nome, telefone, email, empresa, origem,
    segmento: s("segmento") || s("segment"),
    cidade: s("cidade") || s("city"),
    produtoId: s("produtoId") || undefined,
    mensagemInicial: s("mensagemInicial") || s("mensagem") || s("message") || undefined,
  };
}

/** Só para testes: resposta das regras sem LLM. */
export const responderSemLLM = (estado: EstadoCRM, contatoId: string, texto: string) => {
  const ctx = contextoClaudio(estado, contatoId);
  return ctx ? claudioResponde(ctx, texto) : null;
};
