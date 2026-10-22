/**
 * Sobe a API local: `npm run dev:server` (porta 8787).
 *
 * Variáveis (todas opcionais; veja .env.example):
 *   PORT=8787                    porta
 *   CRM_DADOS=server/data/crm.json   arquivo de persistência ("memoria" para não gravar)
 *   CRM_API_KEY=...              chave mestra de escrita (além das chaves de Operadores e chaves)
 *   CRM_SEM_AUTH=1               desliga autenticação (só desenvolvimento)
 *   CRM_URL_PUBLICA=https://...  URL que aparece nos textos de integração
 *   LLM_API_KEY / LLM_BASE_URL / LLM_MODEL   liga o Cláudio com modelo de linguagem
 */
import { serve } from "@hono/node-server";
import { resolve } from "node:path";
import { criarApi } from "./api";
import { criarStore } from "./store";

const porta = Number(process.env.PORT ?? 8787);
const dados = process.env.CRM_DADOS === "memoria" ? null : resolve(process.env.CRM_DADOS ?? "server/data/crm.json");
const store = criarStore(dados);
const app = criarApi({
  store,
  chaveMestra: process.env.CRM_API_KEY ?? null,
  semAuth: process.env.CRM_SEM_AUTH === "1",
  urlPublica: process.env.CRM_URL_PUBLICA ?? `http://localhost:${porta}`,
});

serve({ fetch: app.fetch, port: porta }, () => {
  const e = store.estado();
  const leitura = e.chaves.find((k) => k.escopo === "leitura" && !k.revogadaEm)?.chave;
  const escrita = e.chaves.find((k) => k.escopo === "escrita" && !k.revogadaEm)?.chave;
  console.log(`CRM do dono · API em http://localhost:${porta}`);
  console.log(`  dados: ${dados ?? "memória (some ao reiniciar)"}`);
  console.log(`  auth: ${process.env.CRM_SEM_AUTH === "1" ? "DESLIGADA" : "por chave (x-api-key)"}`);
  if (leitura) console.log(`  chave de leitura: ${leitura}`);
  if (escrita) console.log(`  chave de escrita: ${escrita}`);
  console.log(`  LLM: ${process.env.LLM_API_KEY ? `ligado (${process.env.LLM_MODEL ?? "gpt-4o-mini"})` : "desligado (Cláudio por regras)"}`);
  console.log(`  teste: curl http://localhost:${porta}/api/saude`);
});
