import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, rmSync } from "fs";
import { resolve } from "path";
import {
  ingestWhatsAppMessage,
  listLocalMessages,
  parseMessageData,
} from "@/lib/whatsapp/ingest";

const FILE = resolve(process.cwd(), "data/whatsapp-mensagens.json");

beforeEach(() => {
  if (existsSync(FILE)) rmSync(FILE);
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

afterEach(() => {
  if (existsSync(FILE)) rmSync(FILE);
});

describe("parseMessageData", () => {
  it("extrai texto e telefones do envelope flexível", () => {
    expect(
      parseMessageData({
        id: "wamid.1",
        from: "5562999990001@s.whatsapp.net",
        to: "5562888880000",
        text: "Oi, quero saber mais",
      }),
    ).toMatchObject({
      messageId: "wamid.1",
      from: "5562999990001@s.whatsapp.net",
      text: "Oi, quero saber mais",
    });
  });

  it("aceita content.text", () => {
    expect(parseMessageData({ id: "x", content: { text: "olá" } }).text).toBe("olá");
  });
});

describe("ingestWhatsAppMessage (local)", () => {
  it("cria contato e grava message.received", async () => {
    const r = await ingestWhatsAppMessage({
      type: "message.received",
      eventId: "evt_recv_1",
      sessionId: "sess_1",
      data: {
        id: "wamid.abc",
        from: "5562912345678",
        to: "5562000000000",
        text: "Quero entrar",
      },
    });
    expect(r.ok).toBe(true);
    expect(r.criadoContato).toBe(true);
    expect(r.contatoId).toBeTruthy();
    const msgs = listLocalMessages(r.contatoId);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].autor).toBe("contato");
    expect(msgs[0].texto).toBe("Quero entrar");
    expect(msgs[0].status).toBe("received");
    expect(msgs[0].externalId).toBe("wamid.abc");
  });

  it("atualiza status sent → delivered → read no mesmo external_id", async () => {
    const sent = await ingestWhatsAppMessage({
      type: "message.sent",
      eventId: "evt_sent",
      data: { id: "wamid.out", to: "5562911112222", from: "5562000000000", text: "Oi!" },
    });
    expect(sent.ok).toBe(true);
    expect(sent.criadoContato).toBe(true);

    const delivered = await ingestWhatsAppMessage({
      type: "message.delivered",
      eventId: "evt_deliv",
      data: { id: "wamid.out", to: "5562911112222" },
    });
    expect(delivered.atualizado).toBe(true);
    expect(delivered.mensagemId).toBe(sent.mensagemId);

    const read = await ingestWhatsAppMessage({
      type: "message.read",
      eventId: "evt_read",
      data: { id: "wamid.out", to: "5562911112222" },
    });
    expect(read.atualizado).toBe(true);
    const msgs = listLocalMessages(sent.contatoId);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].status).toBe("read");
  });

  it("reusa contato pelo telefone", async () => {
    const a = await ingestWhatsAppMessage({
      type: "message.received",
      eventId: "e1",
      data: { id: "m1", from: "556299887766", text: "1" },
    });
    const b = await ingestWhatsAppMessage({
      type: "message.received",
      eventId: "e2",
      data: { id: "m2", from: "556299887766", text: "2" },
    });
    expect(b.criadoContato).toBe(false);
    expect(b.contatoId).toBe(a.contatoId);
    expect(listLocalMessages(a.contatoId)).toHaveLength(2);
  });

  it("marca failed", async () => {
    const r = await ingestWhatsAppMessage({
      type: "message.failed",
      eventId: "evt_fail",
      data: { id: "wamid.fail", to: "5562987654321", text: "falhou" },
    });
    expect(r.ok).toBe(true);
    expect(listLocalMessages(r.contatoId!)[0].status).toBe("failed");
  });

  it("ignora evento sem telefone", async () => {
    const r = await ingestWhatsAppMessage({
      type: "message.received",
      eventId: "evt_vazio",
      data: { id: "x", text: "sem from" },
    });
    expect(r.ok).toBe(false);
    expect(r.skipped).toMatch(/telefone/);
  });
});
