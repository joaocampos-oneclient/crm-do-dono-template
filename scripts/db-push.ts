#!/usr/bin/env tsx
/**
 * Empilha o SQL das migrations e imprime instruções.
 * Preferência: `npx supabase db push` com o projeto linkado.
 */
import { readFileSync, readdirSync, writeFileSync } from "fs";
import { resolve, join } from "path";

const dir = resolve("supabase/migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const bundled = files.map((f) => `-- ===== ${f} =====\n` + readFileSync(join(dir, f), "utf8")).join("\n\n");
const out = resolve("supabase/all.sql");
writeFileSync(out, bundled);
console.log(`Gerado ${out} (${files.length} migrations).`);
console.log("Cole no SQL Editor do Supabase ou: npx supabase db push");
