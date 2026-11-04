/**
 * Ingestão de eventos message.* do WPP Engine → contato + crm_mensagens.
 * Funciona com Supabase (quando configurado) ou arquivo local (demo).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { telefoneDigitos } from "@/domain/rules";

export type MessageEventType =
  | "message.received"
  | "message.sent"
  | "message.delivered"
  | "message.read"
  | "message.failed";

export type IngestResult = {
  ok: boolean;
  contatoId?: string;
  mensagemId?: string;
  criadoContato?: boolean;
  atualizado?: boolean;
  skipped?: string;
  erro?: string;
};

type LocalMsg = {
  id: string;
  contatoId: string;
  autor: "contato" | "robo" | "humano";
  texto: string;
  em: string;
  externalId?: string;
  status?: string;
  waFrom?: string;
  waTo?: string;
  sessionId?: string;
  eventId?: string;
};

type LocalContato = {
  id: string;
  nome: string;
  telefone: string;
  telefoneDigitos: string;
  empresa: string;
  criadoEm: string;
};

type LocalDb = { contatos: LocalContato[]; mensagens: LocalMsg[] };

function localFile(): string {
  return process.env.WHATSAPP_LOCAL_FILE?.trim() || resolve(process.cwd(), "data/whatsapp-mensagens.json");
}

function loadLocal(): LocalDb {
  try {
    const file = localFile();
    if (!existsSync(file)) return { contatos: [], mensagens: [] };
    return JSON.parse(readFileSync(file, "utf8")) as LocalDb;
  } catch {
    return { contatos: [], mensagens: [] };
  }
}

function saveLocal(db: LocalDb) {
  const file = localFile();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(db, null, 2));
}

function novoId() {
  return crypto.randomUUID();
}

/** Extrai telefone e texto do payload flexível do Engine. */
export function parseMessageData(data: unknown): {
  messageId?: string;
  from?: string;
  to?: string;
  text?: string;
  status?: string;
} {
  if (!data || typeof data !== "object") return {};
  const d = data as Record<string, unknown>;
  const content = (d.content && typeof d.content === "object" ? d.content : d) as Record<string, unknown>;
  const text =
    typeof d.text === "string"
      ? d.text
      : typeof content.text === "string"
        ? content.text
        : typeof d.body === "string"
          ? d.body
          : undefined;
  return {
    messageId: typeof d.message_id === "string" ? d.message_id : typeof d.id === "string" ? d.id : undefined,
    from: typeof d.from === "string" ? d.from : typeof d.wa_from === "string" ? d.wa_from : undefined,
    to: typeof d.to === "string" ? d.to : typeof d.wa_to === "string" ? d.wa_to : undefined,
    text,
    status: typeof d.status === "string" ? d.status : undefined,
  };
}

/** Prefixos de eventId das mensagens enviadas pelos agentes (Cláudio, Pilot, Ember). */
const PREFIXOS_EVENTO_ROBO = ["claudio_", "agente_", "pilot_", "ember_"];

function autorDe(type: MessageEventType, eventId = ""): "contato" | "humano" | "robo" {
  if (type === "message.received") return "contato";
  if (PREFIXOS_EVENTO_ROBO.some((p) => eventId.startsWith(p))) return "robo";
  return "humano"; // enviadas pelo CRM / operador → humano
}

function telefoneDoEvento(type: MessageEventType, from?: string, to?: string): string | null {
  // received: from = lead; sent/delivered/read/failed: to = lead
  const raw = type === "message.received" ? from : to ?? from;
  if (!raw) return null;
  const digits = telefoneDigitos(raw.replace(/@.*/, ""));
  return digits || null;
}

async function withSupabase<T>(fn: (sb: ReturnType<typeof import("@/lib/supabase/server").createServiceClient>) => Promise<T>): Promise<T | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    const { createServiceClient } = await import("@/lib/supabase/server");
    return await fn(createServiceClient());
  } catch {
    return null;
  }
}

async function upsertContatoLocal(phoneDigits: string, nomeHint?: string): Promise<{ id: string; criado: boolean }> {
  const db = loadLocal();
  const existing = db.contatos.find((c) => c.telefoneDigitos === phoneDigits || c.telefoneDigitos.endsWith(phoneDigits.slice(-11)));
  if (existing) return { id: existing.id, criado: false };
  const id = novoId();
  db.contatos.push({
    id,
    nome: nomeHint || `WhatsApp ${phoneDigits.slice(-4)}`,
    telefone: `+${phoneDigits}`,
    telefoneDigitos: phoneDigits,
    empresa: "",
    criadoEm: new Date().toISOString(),
  });
  saveLocal(db);
  return { id, criado: true };
}

async function upsertContatoSupabase(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  phoneDigits: string,
  nomeHint?: string,
): Promise<{ id: string; criado: boolean } | null> {
  const { data: found } = await sb
    .from("crm_contatos")
    .select("id")
    .eq("telefone_digitos", phoneDigits)
    .maybeSingle();
  if (found?.id) return { id: found.id as string, criado: false };

  // tenta sufixo BR
  const suffix = phoneDigits.slice(-11);
  const { data: foundList } = await sb
    .from("crm_contatos")
    .select("id, telefone_digitos")
    .ilike("telefone_digitos", `%${suffix}`)
    .limit(1);
  const found2 = Array.isArray(foundList) ? foundList[0] : null;
  if (found2?.id) return { id: found2.id as string, criado: false };

  const { data: funilList } = await sb.from("crm_funis").select("id").eq("ativo", true).limit(1);
  const funil = Array.isArray(funilList) ? funilList[0] : null;
  const { data: produtoList } = await sb.from("crm_produtos").select("id, valor_centavos").eq("ativo", true).limit(1);
  const produto = Array.isArray(produtoList) ? produtoList[0] : null;

  const { data: criado, error } = await sb
    .from("crm_contatos")
    .insert({
      nome: nomeHint || `WhatsApp ${phoneDigits.slice(-4)}`,
      telefone: `+${phoneDigits}`,
      empresa: "",
      funil_origem_id: funil?.id ?? null,
      dono: "robo",
    })
    .select("id")
    .single();
  if (error || !criado) return null;

  if (produto?.id) {
    await sb.from("crm_oportunidades").insert({
      contato_id: criado.id,
      produto_id: produto.id,
      etapa_id: "novo",
      valor_centavos: produto.valor_centavos ?? 0,
    });
  }
  return { id: criado.id as string, criado: true };
}

/**
 * Persiste ou atualiza status de uma mensagem WhatsApp.
 */
export async function ingestWhatsAppMessage(opts: {
  type: MessageEventType;
  eventId: string;
  sessionId?: string;
  data: unknown;
  timestamp?: string;
}): Promise<IngestResult> {
  const parsed = parseMessageData(opts.data);
  const phone = telefoneDoEvento(opts.type, parsed.from, parsed.to);
  if (!phone) return { ok: false, skipped: "sem telefone no evento" };

  const externalId = parsed.messageId || opts.eventId;
  const status = opts.type.replace("message.", "") as "received" | "sent" | "delivered" | "read" | "failed";
  const texto = parsed.text?.trim() || (status === "received" ? "(mídia ou texto vazio)" : `(status ${status})`);
  const em = opts.timestamp || new Date().toISOString();
  const autor = autorDe(opts.type, opts.eventId);

  // Supabase
  const viaSb = await withSupabase(async (sb) => {
    const contato = await upsertContatoSupabase(sb, phone);
    if (!contato) throw new Error("falha ao upsert contato");

    const { data: existing } = await sb.from("crm_mensagens").select("id").eq("external_id", externalId).maybeSingle();

    if (existing?.id) {
      await sb
        .from("crm_mensagens")
        .update({
          status,
          wa_from: parsed.from ?? null,
          wa_to: parsed.to ?? null,
          session_id: opts.sessionId ?? null,
          event_id: opts.eventId,
          ...(parsed.text && status === "received" ? { texto: parsed.text } : {}),
        })
        .eq("id", existing.id);
      await sb.from("crm_whatsapp_eventos").upsert({
        event_id: opts.eventId,
        tipo: opts.type,
        session_id: opts.sessionId ?? null,
        payload: opts.data ?? {},
      });
      return { ok: true, contatoId: contato.id, mensagemId: existing.id, atualizado: true, criadoContato: contato.criado } satisfies IngestResult;
    }

    if (status !== "received" && status !== "sent") {
      // delivered/read/failed sem mensagem prévia: cria stub mínimo
    }

    const { data: msg, error } = await sb
      .from("crm_mensagens")
      .insert({
        contato_id: contato.id,
        autor,
        texto,
        external_id: externalId,
        status,
        wa_from: parsed.from ?? null,
        wa_to: parsed.to ?? null,
        session_id: opts.sessionId ?? null,
        event_id: opts.eventId,
        em,
      })
      .select("id")
      .single();
    if (error) throw error;

    await sb.from("crm_whatsapp_eventos").upsert({
      event_id: opts.eventId,
      tipo: opts.type,
      session_id: opts.sessionId ?? null,
      payload: opts.data ?? {},
    });

    return {
      ok: true,
      contatoId: contato.id,
      mensagemId: msg.id,
      criadoContato: contato.criado,
    } satisfies IngestResult;
  });

  const notificarReciclador = async (contatoId?: string) => {
    if (opts.type !== "message.received" || !parsed.text?.trim()) return;
    let recicladorAgiu = false;
    try {
      const { processarRespostaLeadReciclador } = await import("@/lib/reciclador/handoff");
      const r = await processarRespostaLeadReciclador({
        phoneDigits: phone,
        contatoId,
        texto: parsed.text.trim(),
        timestamp: em,
      });
      recicladorAgiu =
        r.optOutRegistrado || r.itensAtribuidosIds.length > 0 || r.handoffHumano || r.respostaClaudioEnviada;
    } catch (e) {
      console.warn("[whatsapp/ingest -> reciclador]", e instanceof Error ? e.message : e);
    }
    // Auto-atendimento (opt-in): só depois do Reciclador e só se ele não tratou a mensagem.
    if (recicladorAgiu) return;
    try {
      const { processarMensagemRecebidaAgentes } = await import("@/lib/agents/auto");
      await processarMensagemRecebidaAgentes({
        phoneDigits: phone,
        contatoId,
        texto: parsed.text.trim(),
        timestamp: em,
      });
    } catch (e) {
      console.warn("[whatsapp/ingest -> agentes]", e instanceof Error ? e.message : e);
    }
  };

  if (viaSb) {
    await notificarReciclador(viaSb.contatoId);
    return viaSb;
  }

  // Local file fallback (recarrega depois do upsert — o upsert grava o arquivo)
  const { id: contatoId, criado } = await upsertContatoLocal(phone);
  const db = loadLocal();
  const existing = db.mensagens.find((m) => m.externalId === externalId);
  if (existing) {
    existing.status = status;
    existing.waFrom = parsed.from;
    existing.waTo = parsed.to;
    existing.sessionId = opts.sessionId;
    existing.eventId = opts.eventId;
    if (parsed.text && status === "received") existing.texto = parsed.text;
    saveLocal(db);
    await notificarReciclador(contatoId);
    return { ok: true, contatoId, mensagemId: existing.id, atualizado: true, criadoContato: criado };
  }

  const mensagemId = novoId();
  db.mensagens.push({
    id: mensagemId,
    contatoId,
    autor,
    texto,
    em,
    externalId,
    status,
    waFrom: parsed.from,
    waTo: parsed.to,
    sessionId: opts.sessionId,
    eventId: opts.eventId,
  });
  saveLocal(db);
  await notificarReciclador(contatoId);
  return { ok: true, contatoId, mensagemId, criadoContato: criado };
}

export function listLocalMessages(contatoId?: string): LocalMsg[] {
  const db = loadLocal();
  return contatoId ? db.mensagens.filter((m) => m.contatoId === contatoId) : db.mensagens;
}

export type MensagemHistorico = { autor: "contato" | "robo" | "humano"; texto: string; em: string };

export type HistoricoContato = {
  contatoId?: string;
  nome?: string;
  mensagens: MensagemHistorico[];
  /** Supabase: crm_contatos.handoff_pendente. Local: sempre false (use o marcador local). */
  handoffPendente: boolean;
  /** Supabase: crm_contatos.dono === "humano". */
  donoHumano: boolean;
};

/**
 * Últimas mensagens de um contato (mais antigas primeiro), por id ou telefone.
 * Supabase quando configurado; senão arquivo local.
 */
export async function carregarHistoricoContato(opts: {
  contatoId?: string;
  phoneDigits?: string;
  limite?: number;
}): Promise<HistoricoContato> {
  const limite = Math.max(1, Math.min(200, opts.limite ?? 20));
  const suffix = opts.phoneDigits ? opts.phoneDigits.replace(/\D/g, "").slice(-11) : "";

  const viaSb = await withSupabase(async (sb) => {
    let contato: { id: string; nome?: string; handoff_pendente?: boolean; dono?: string } | null = null;
    if (opts.contatoId) {
      const { data } = await sb
        .from("crm_contatos")
        .select("id,nome,handoff_pendente,dono")
        .eq("id", opts.contatoId)
        .maybeSingle();
      contato = data ?? null;
    }
    if (!contato && suffix) {
      const { data } = await sb
        .from("crm_contatos")
        .select("id,nome,handoff_pendente,dono")
        .ilike("telefone_digitos", `%${suffix}`)
        .limit(1)
        .maybeSingle();
      contato = data ?? null;
    }
    if (!contato) return null;
    const { data: msgs } = await sb
      .from("crm_mensagens")
      .select("autor,texto,em")
      .eq("contato_id", contato.id)
      .order("em", { ascending: false })
      .limit(limite);
    const mensagens = ((msgs ?? []) as MensagemHistorico[]).slice().reverse();
    return {
      contatoId: contato.id,
      nome: contato.nome,
      mensagens,
      handoffPendente: Boolean(contato.handoff_pendente),
      donoHumano: contato.dono === "humano",
    } satisfies HistoricoContato;
  });
  if (viaSb) return viaSb;

  const db = loadLocal();
  const contato = db.contatos.find(
    (c) => (opts.contatoId && c.id === opts.contatoId) || (suffix && c.telefoneDigitos.endsWith(suffix)),
  );
  if (!contato) return { mensagens: [], handoffPendente: false, donoHumano: false };
  const mensagens = db.mensagens
    .filter((m) => m.contatoId === contato.id && !m.texto.startsWith("(status "))
    .sort((a, b) => Date.parse(a.em) - Date.parse(b.em))
    .slice(-limite)
    .map((m) => ({ autor: m.autor, texto: m.texto, em: m.em }));
  return { contatoId: contato.id, nome: contato.nome, mensagens, handoffPendente: false, donoHumano: false };
}

export type ContatoBasico = { id: string; nome: string; telefoneDigitos: string };

/** Contatos conhecidos (para o tick do Pilot). Supabase quando configurado; senão arquivo local. */
export async function listarContatosBasicos(limite = 200): Promise<ContatoBasico[]> {
  const viaSb = await withSupabase(async (sb) => {
    const { data } = await sb
      .from("crm_contatos")
      .select("id,nome,telefone_digitos")
      .not("telefone_digitos", "is", null)
      .limit(limite);
    return ((data ?? []) as { id: string; nome: string; telefone_digitos: string }[]).map((c) => ({
      id: c.id,
      nome: c.nome,
      telefoneDigitos: c.telefone_digitos,
    }));
  });
  if (viaSb) return viaSb;
  return loadLocal()
    .contatos.slice(0, limite)
    .map((c) => ({ id: c.id, nome: c.nome, telefoneDigitos: c.telefoneDigitos }));
}
