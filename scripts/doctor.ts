#!/usr/bin/env tsx
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

function loadEnvLocal() {
  const p = resolve(process.cwd(), ".env.local");
  if (!existsSync(p)) return false;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return true;
}

type Check = { ok: boolean; nome: string; detalhe: string };

async function main() {
  const temEnv = loadEnvLocal();
  const checks: Check[] = [];

  checks.push({
    ok: existsSync(resolve("package.json")),
    nome: "package.json",
    detalhe: "raiz do projeto",
  });
  checks.push({
    ok: existsSync(resolve("crm.config.ts")),
    nome: "crm.config.ts",
    detalhe: "nome da empresa, produtos, funis, agentes",
  });
  checks.push({
    ok: temEnv || true,
    nome: ".env.local",
    detalhe: temEnv ? "encontrado" : "ausente (modo demo ok)",
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  checks.push({
    ok: Boolean(url && anon) || (!url && !anon),
    nome: "Supabase",
    detalhe: url && anon ? "URL + anon ok" : "não configurado (demo)",
  });

  if (url && anon) {
    try {
      const res = await fetch(`${url}/auth/v1/health`, { headers: { apikey: anon } });
      checks.push({ ok: res.ok || res.status === 404, nome: "Supabase alcançável", detalhe: `HTTP ${res.status}` });
    } catch (e) {
      checks.push({ ok: false, nome: "Supabase alcançável", detalhe: String(e) });
    }
  }

  const llmKey =
    process.env.CRM_LLM_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    (existsSync(resolve("data/llm-connection.json")) ? "ui" : "");
  checks.push({
    ok: true,
    nome: "Anthropic / Mastra",
    detalhe: llmKey
      ? llmKey === "ui"
        ? "chave via UI (data/llm-connection.json)"
        : "chave presente no env"
      : "ausente (agentes usam regras locais)",
  });

  const wpp = process.env.WPP_API_KEY;
  const provider = (process.env.WHATSAPP_PROVIDER ?? "wpp-engine").toLowerCase();
  checks.push({
    ok: true,
    nome: "WhatsApp",
    detalhe:
      provider === "waha"
        ? `provedor waha · ${process.env.WAHA_URL ?? "sem WAHA_URL"}`
        : wpp
          ? `WPP Engine · key ${wpp.slice(0, 12)}…`
          : "WPP Engine sem key (cole em Integrações ou WPP_API_KEY)",
  });

  checks.push({
    ok: existsSync(resolve("src/lib/mcp/tools.ts")),
    nome: "MCP tools",
    detalhe: "src/lib/mcp/tools.ts",
  });

  let falhas = 0;
  for (const c of checks) {
    console.log(`${c.ok ? "OK" : "FAIL"}  ${c.nome} — ${c.detalhe}`);
    if (!c.ok) falhas++;
  }
  console.log(falhas ? `\n${falhas} problema(s).` : "\nTudo certo. npm run dev");
  process.exit(falhas ? 1 : 0);
}

main();
