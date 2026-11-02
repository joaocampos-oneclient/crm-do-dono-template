#!/usr/bin/env tsx
/**
 * MCP via stdio para Cursor local (alternativa ao HTTP /api/mcp/crm).
 */
import { callTool, listToolsForNivel } from "../src/lib/mcp/tools";
import { estadoExemplo } from "../src/data/exemplo";

const nivel = (process.env.CRM_MCP_NIVEL as "leitura" | "escrita" | "admin") || "escrita";
const estado = estadoExemplo();
const ctx = {
  nivel,
  estado,
  audit: (e: string, d: Record<string, unknown>) => console.error("[audit]", e, JSON.stringify(d)),
};

async function handle(msg: { id?: unknown; method?: string; params?: Record<string, unknown> }) {
  if (msg.method === "initialize") {
    return {
      jsonrpc: "2.0",
      id: msg.id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "crm-do-dono-stdio", version: "1.0.0" },
      },
    };
  }
  if (msg.method === "tools/list") {
    return {
      jsonrpc: "2.0",
      id: msg.id,
      result: {
        tools: listToolsForNivel(nivel).map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: { type: "object" },
        })),
      },
    };
  }
  if (msg.method === "tools/call") {
    const name = String(msg.params?.name ?? "");
    const args = msg.params?.arguments ?? {};
    const result = await callTool(name, args, ctx);
    return { jsonrpc: "2.0", id: msg.id, result };
  }
  return { jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: "unknown" } };
}

let buf = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", async (chunk) => {
  buf += chunk;
  const parts = buf.split("\n");
  buf = parts.pop() ?? "";
  for (const line of parts) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      const res = await handle(msg);
      process.stdout.write(JSON.stringify(res) + "\n");
    } catch (e) {
      process.stderr.write(String(e) + "\n");
    }
  }
});
