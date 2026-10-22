import { beforeEach, describe, expect, it } from "vitest";
import { estadoExemplo, IDS } from "../src/data/exemplo";
import { criarApi, normalizarLead } from "../server/api";
import { adaptadoresLocais } from "../server/adapters";
import { criarStore, type Store } from "../server/store";

const AGORA = "2026-10-22T12:00:00.000Z";
let store: Store;
let app: ReturnType<typeof criarApi>;
let adaptadores: ReturnType<typeof adaptadoresLocais>;

const req = (caminho: string, init: RequestInit & { chave?: string | null; json?: unknown } = {}) => {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (init.chave !== null) headers["x-api-key"] = init.chave ?? IDS.chaveEscrita;
  return app.request(caminho, { ...init, headers, body: init.json !== undefined ? JSON.stringify(init.json) : init.body });
};

beforeEach(() => {
  store = criarStore(null, () => estadoExemplo(AGORA));
  adaptadores = adaptadoresLocais();
  app = criarApi({ store, adaptadores, llm: null, urlPublica: "http://localhost:8787" });
});

describe("autenticação e escopos", () => {
  it("saúde é pública; o resto exige chave", async () => {
    expect((await req("/api/saude", { chave: null })).status).toBe(200);
    expect((await req("/api/estado", { chave: null })).status).toBe(401);
    expect((await req("/api/estado", { chave: "errada" })).status).toBe(401);
  });
  it("chave de leitura lê mas não escreve", async () => {
    expect((await req("/api/metricas/relatorio", { chave: IDS.chaveLeitura })).status).toBe(200);
    const r = await req("/api/leads", { method: "POST", chave: IDS.chaveLeitura, json: { nome: "X", telefone: "62999990000" } });
    expect(r.status).toBe(403);
  });
  it("chave revogada para de funcionar", async () => {
    await store.despachar({ tipo: "revogarChaveApi", chaveId: "k1" });
    expect((await req("/api/estado", { chave: IDS.chaveLeitura })).status).toBe(401);
  });
  it("chave mestra do ambiente escreve", async () => {
    app = criarApi({ store, adaptadores, llm: null, chaveMestra: "mestra" });
    const r = await req("/api/leads", { method: "POST", chave: "mestra", json: { nome: "Y", telefone: "62999990001", origem: "live" } });
    expect(r.status).toBe(201);
  });
});

describe("webhook de lead", () => {
  it("cria lead, abre conversa com o Cláudio e manda WhatsApp pelo adaptador", async () => {
    const r = await req("/api/leads", { method: "POST", json: { nome: "Lead Webhook", telefone: "62999990002", origem: "perpetuo", empresa: "ACME" } });
    expect(r.status).toBe(201);
    const j = await r.json();
    expect(j.etapa).toBe("novo");
    expect(j.novo).toBe(true);
    const saidas = adaptadores.saidas();
    expect(saidas[0].canal).toBe("whatsapp");
    expect(saidas[0].resumo).toMatch(/Lead/);
  });
  it("aceita o formato field_data do Meta Lead Ads", () => {
    const l = normalizarLead({ field_data: [{ name: "full_name", values: ["Maria"] }, { name: "phone_number", values: ["+5562999990003"] }, { name: "email", values: ["m@x.com"] }], utm_source: "Live semanal" }, store.estado());
    expect(l.nome).toBe("Maria");
    expect(l.telefone).toBe("+5562999990003");
    expect(l.origem).toBe("live");
  });
  it("telefone repetido não duplica", async () => {
    const antes = store.estado().contatos.length;
    const r = await req("/api/leads", { method: "POST", json: { nome: "Mariana", telefone: "(62) 90000-0001", origem: "perpetuo" } });
    expect((await r.json()).novo).toBe(false);
    expect(store.estado().contatos.length).toBe(antes);
  });
  it("valida corpo", async () => {
    expect((await req("/api/leads", { method: "POST", json: { nome: "Sem telefone" } })).status).toBe(400);
  });
});

describe("webhook do WhatsApp", () => {
  it("lead responde, Cláudio devolve a resposta no corpo e envia pelo adaptador", async () => {
    const r = await req("/api/webhooks/whatsapp", { method: "POST", json: { telefone: "(62) 90000-0006", texto: "pode perguntar" } });
    const j = await r.json();
    expect(j.respostas[0]).toMatch(/0 a 10/);
    expect(adaptadores.saidas().some((s) => s.canal === "whatsapp" && /0 a 10/.test(s.resumo))).toBe(true);
  });
  it("número desconhecido vira lead e a nota 9 vira handoff", async () => {
    const r = await req("/api/webhooks/whatsapp", { method: "POST", json: { telefone: "62988880000", texto: "9. quero falar com alguém", nome: "Novo" } });
    const j = await r.json();
    expect(j.handoffPendente).toBe(true);
    expect(j.nota).toBe(9);
  });
  it("com humano no comando, o robô não responde", async () => {
    const r = await req("/api/webhooks/whatsapp", { method: "POST", json: { telefone: "(62) 90000-0002", texto: "oi" } });
    expect((await r.json()).respostas).toEqual([]);
  });
});

describe("pagamento e comandos", () => {
  it("webhook de pagamento move para pago", async () => {
    const r = await req("/api/webhooks/pagamento", { method: "POST", json: { pagamentoId: "pg1", status: "pago" } });
    expect((await r.json()).etapa).toBe("pago");
  });
  it("POST /api/comandos aplica e devolve versão; erro de regra vira 422", async () => {
    const v0 = store.versao();
    const r = await req("/api/comandos", { method: "POST", json: { tipo: "adicionarNota", contatoId: "c1", texto: "via API", autorId: null } });
    expect(r.status).toBe(200);
    expect((await r.json()).versao).not.toBe(v0);
    const r2 = await req("/api/comandos", { method: "POST", json: { tipo: "marcarPerdida", oportunidadeId: "o1", motivo: "", por: IDS.otavio } });
    expect(r2.status).toBe(422);
  });
  it("mensagem humana pela API assume a conversa e sai pelo WhatsApp", async () => {
    const r = await req("/api/conversas/c1/mensagem", { method: "POST", json: { texto: "Oi Mariana, sou o Otávio", operadorId: IDS.otavio } });
    expect(r.status).toBe(200);
    expect(store.estado().contatos.find((c) => c.id === "c1")!.dono).toBe("humano");
    expect(adaptadores.saidas().filter((s) => s.canal === "whatsapp").length).toBe(2);
  });
});

describe("leituras", () => {
  it("contatos, ficha, funil, métricas e prompt do Grokbot", async () => {
    const contatos = await (await req("/api/contatos?categoria=cliente", { chave: IDS.chaveLeitura })).json();
    expect(contatos.length).toBeGreaterThan(0);
    const ficha = await (await req("/api/contatos/c2", { chave: IDS.chaveLeitura })).json();
    expect(ficha.linhaDoTempo.length).toBeGreaterThan(0);
    const funil = await (await req("/api/funil", { chave: IDS.chaveLeitura })).json();
    expect(funil.etapas.length).toBe(8);
    const d = await (await req("/api/metricas/demandas?periodo=30d", { chave: IDS.chaveLeitura })).json();
    expect(d.atual.leads).toBeGreaterThan(0);
    const prompt = await (await req("/api/integracoes/prompt-grokbot", { chave: IDS.chaveLeitura })).text();
    expect(prompt).toMatch(/resumo_do_dia/);
    expect(prompt).toMatch(/http:\/\/localhost:8787/);
  });
});
