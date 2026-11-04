import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const auto = vi.hoisted(() =>
  vi.fn(async (_opts: { phoneDigits: string; texto: string }) => ({
    ativo: true,
    decisao: "silenciar",
    motivo: "x",
    enviado: false,
  })),
);
vi.mock("@/lib/agents/auto", () => ({ processarMensagemRecebidaAgentes: auto }));

import { ingestWhatsAppMessage } from "@/lib/whatsapp/ingest";

describe("webhook → auto-atendimento (ligação no ingest)", () => {
  let dir: string;
  const TEL = "5562999990002";
  const receber = (texto: string, id: string) =>
    ingestWhatsAppMessage({
      type: "message.received",
      eventId: id,
      data: { id, from: `${TEL}@s.whatsapp.net`, text: texto },
    });

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "agentes-wiring-"));
    process.env.WHATSAPP_LOCAL_FILE = join(dir, "msgs.json");
    process.env.RECICLADOR_DATA_FILE = join(dir, "reciclador.json");
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    auto.mockClear();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    delete process.env.WHATSAPP_LOCAL_FILE;
    delete process.env.RECICLADOR_DATA_FILE;
  });

  it("mensagem recebida comum chama o auto-atendimento uma vez", async () => {
    await receber("Quero saber mais", "w1");
    expect(auto).toHaveBeenCalledTimes(1);
    expect(auto.mock.calls[0][0]).toMatchObject({ phoneDigits: "5562999990002", texto: "Quero saber mais" });
  });

  it("opt-out é tratado pelo Reciclador e o auto-atendimento não roda", async () => {
    await receber("Para de me mandar mensagem", "w2");
    expect(auto).not.toHaveBeenCalled();
  });

  it("mensagens enviadas e status não chamam o auto-atendimento", async () => {
    await ingestWhatsAppMessage({
      type: "message.sent",
      eventId: "w3",
      data: { id: "w3", to: TEL, text: "Oi", status: "sent" },
    });
    expect(auto).not.toHaveBeenCalled();
  });

  it("falha no auto-atendimento nunca derruba o webhook", async () => {
    auto.mockRejectedValueOnce(new Error("boom"));
    const r = await receber("Oi", "w4");
    expect(r.ok).toBe(true);
  });

  it("eventId de agente grava a mensagem como robo", async () => {
    await ingestWhatsAppMessage({
      type: "message.sent",
      eventId: "claudio_auto_x",
      data: { id: "x", to: TEL, text: "Resposta do Cláudio", status: "sent" },
    });
    const { listLocalMessages } = await import("@/lib/whatsapp/ingest");
    expect(listLocalMessages().find((m) => m.texto === "Resposta do Cláudio")?.autor).toBe("robo");
  });
});
