import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { callTool, listToolsForNivel, MCP_TOOLS } from "@/lib/mcp/tools";
import { nivelValido, type CrmMcpNivel } from "@/lib/mcp/niveis";
import { estadoExemplo } from "@/data/exemplo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Sessao = { nivel: CrmMcpNivel; nome: string };

/** Tokens de demo via env: CRM_MCP_TOKEN_LEITURA / ESCRITA / ADMIN (valor em texto claro). */
function autenticar(req: NextRequest): Sessao | null {
  const auth = req.headers.get("authorization") ?? "";
  const raw = auth.startsWith("Bearer ") ? auth.slice(7).trim() : req.headers.get("x-crm-mcp-token")?.trim();
  if (!raw) return null;
  const mapa: { env: string; nivel: CrmMcpNivel; nome: string }[] = [
    { env: "CRM_MCP_TOKEN_ADMIN", nivel: "admin", nome: "admin" },
    { env: "CRM_MCP_TOKEN_ESCRITA", nivel: "escrita", nome: "escrita" },
    { env: "CRM_MCP_TOKEN_LEITURA", nivel: "leitura", nome: "leitura" },
  ];
  for (const m of mapa) {
    const v = process.env[m.env];
    if (v && v === raw) return { nivel: m.nivel, nome: m.nome };
  }
  // Fallback demos estáveis para onboarding (documentados no .env.example)
  if (raw === "crm_demo_leitura") return { nivel: "leitura", nome: "demo-leitura" };
  if (raw === "crm_demo_escrita") return { nivel: "escrita", nome: "demo-escrita" };
  if (raw === "crm_demo_admin") return { nivel: "admin", nome: "demo-admin" };
  return null;
}

function audit(evento: string, detalhe: Record<string, unknown>) {
  console.info("[mcp]", evento, JSON.stringify(detalhe));
}

/** JSON-RPC mínimo compatível com clientes MCP HTTP. */
export async function POST(req: NextRequest) {
  const sessao = autenticar(req);
  if (!sessao) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const method = (body as { method?: string }).method;
  const id = (body as { id?: string | number }).id ?? null;
  const params = (body as { params?: Record<string, unknown> }).params ?? {};

  const estado = estadoExemplo();
  const ctx = { nivel: sessao.nivel, estado, audit };

  if (method === "initialize") {
    return NextResponse.json({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {}, resources: {}, prompts: {} },
        serverInfo: { name: "crm-do-dono", version: "1.0.0" },
      },
    });
  }

  if (method === "tools/list") {
    const tools = listToolsForNivel(sessao.nivel).map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: { type: "object" },
    }));
    return NextResponse.json({ jsonrpc: "2.0", id, result: { tools } });
  }

  if (method === "tools/call") {
    const name = String(params.name ?? "");
    const args = (params.arguments ?? {}) as unknown;
    const result = await callTool(name, args, ctx);
    return NextResponse.json({ jsonrpc: "2.0", id, result });
  }

  if (method === "resources/list") {
    return NextResponse.json({
      jsonrpc: "2.0",
      id,
      result: {
        resources: [
          { uri: "crm://mapa-telas", name: "Mapa de telas", mimeType: "application/json" },
          { uri: "crm://regras", name: "Regras de negócio", mimeType: "text/plain" },
        ],
      },
    });
  }

  if (method === "prompts/list") {
    return NextResponse.json({
      jsonrpc: "2.0",
      id,
      result: {
        prompts: [
          { name: "resumo_do_dia", description: "Resumo do que fazer hoje" },
          { name: "quem_esfria", description: "Quem está esfriando no funil" },
          { name: "criar_agente", description: "Como criar um agente novo" },
          { name: "farol_vermelho", description: "Farol vermelho no funil" },
        ],
      },
    });
  }

  if (method === "ping") {
    return NextResponse.json({ jsonrpc: "2.0", id, result: {} });
  }

  // Atalho REST: { "tool": "crm_funil_resumo", "arguments": {} }
  if ((body as { tool?: string }).tool) {
    const name = String((body as { tool: string }).tool);
    const args = (body as { arguments?: unknown }).arguments ?? {};
    const result = await callTool(name, args, ctx);
    return NextResponse.json({ ok: !result.isError, result, nivel: sessao.nivel });
  }

  return NextResponse.json({ jsonrpc: "2.0", id, error: { code: -32601, message: `Método desconhecido: ${method}` } });
}

export async function GET(req: NextRequest) {
  const sessao = autenticar(req);
  if (!sessao) {
    return NextResponse.json({
      name: "crm-do-dono MCP",
      auth: "Bearer <token> ou x-crm-mcp-token",
      demos: ["crm_demo_leitura", "crm_demo_escrita", "crm_demo_admin"],
      tools: MCP_TOOLS.map((t) => t.name),
    });
  }
  return NextResponse.json({
    ok: true,
    nivel: sessao.nivel,
    tools: listToolsForNivel(sessao.nivel).map((t) => t.name),
    hash: createHash("sha256").update(sessao.nome).digest("hex").slice(0, 8),
  });
}
