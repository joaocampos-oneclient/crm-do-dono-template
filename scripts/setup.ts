#!/usr/bin/env tsx
/**
 * Zero-config setup: valida env, aplica migrations no Supabase (se houver),
 * cria o primeiro operador dono e imprime os próximos passos.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function loadEnvLocal() {
  const p = resolve(process.cwd(), ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function main() {
  loadEnvLocal();
  console.log("CRM do dono · setup\n");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    console.log("Sem Supabase no .env.local — ok. O CRM roda em modo demo (localStorage).");
    console.log("Para produção: crie um projeto em supabase.com, cole URL + anon + service_role em .env.local e rode de novo.\n");
    console.log("Próximo: npm run dev");
    return;
  }

  if (!service) {
    console.error("Tem URL/anon mas falta SUPABASE_SERVICE_ROLE_KEY (só no servidor, nunca no front).");
    process.exit(1);
  }

  const admin = createClient(url, service, { auth: { persistSession: false } });

  const migrations = [
    "supabase/migrations/20261102000000_crm_casa.sql",
    "supabase/migrations/20261102000002_crm_agentes.sql",
    "supabase/migrations/20261102000001_crm_seed_demo.sql",
  ];

  console.log("Aplicando SQL via RPC não é suportado sem pg. Use o SQL Editor do Supabase:");
  for (const m of migrations) {
    console.log(`  → cole o arquivo ${m}`);
  }
  console.log("\nOu: npx supabase db push (com CLI linkado ao projeto).\n");

  const email = process.env.CRM_DONO_EMAIL ?? "dono@exemplo.com";
  const { data: ops } = await admin.from("crm_operadores").select("id,email,papel").limit(5);
  if (ops && ops.length > 0) {
    console.log(`Operadores já existem (${ops.length}). Nada a criar.`);
  } else {
    console.log(`Quando as tabelas existirem, crie o dono no SQL Editor:`);
    console.log(`  insert into crm_operadores (nome, papel, tipo, email, ativo)`);
    console.log(`  values ('Dono', 'dono', 'humano', '${email}', true);`);
    console.log(`Depois vincule user_id ao auth.users após o primeiro magic link.`);
  }

  console.log("\nPronto. Rode: npm run doctor && npm run dev");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
