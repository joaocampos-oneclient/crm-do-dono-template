import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  avaliarAutoAtendimento,
  contarRespostasAutomaticasSeguidas,
  extrairNotaDaResposta,
  humanoAssumiuNoHistorico,
  textoRoboSeguro,
} from "@/domain/agentes-auto";

const estado = vi.hoisted(() => ({ llm: true }));
const executar = vi.hoisted(() => vi.fn());

vi.mock("@/lib/agents", () => ({ executarAgente: executar }));
vi.mock("@/lib/agents/llm-store", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/lib/agents/llm-store")>();
  return { ...orig, temLlmKey: () => estado.llm };
});

import { processarMensagemRecebidaAgentes } from "@/lib/agents/auto";
import { lerLogAgentes, marcarHandoffLocal } from "@/lib/agents/log";
import { executarTickPilot, lerSugestoesPilot } from "@/lib/agents/pilot-tick";
import { ingestWhatsAppMessage } from "@/lib/whatsapp/ingest";

// Quarta-feira 12h em São Paulo (dentro da janela), quarta 00h (fora) e sábado 12h (fim de semana).
const QUARTA_12H = "2026-11-04T15:00:00.000Z";
const QUARTA_00H = "2026-11-04T03:00:00.000Z";
const SABADO_12H = "2026-11-07T15:00:00.000Z";

describe("avaliarAutoAtendimento (regras puras)", () => {
  const base = { texto: "Quero entender melhor como funciona", agora: QUARTA_12H };

  it("responde quando está tudo dentro dos freios", () => {
    expect(avaliarAutoAtendimento(base).decisao).toBe("responder");
  });

  it("opt-out registrado ou pedido de parar → silenciar", () => {
    expect(avaliarAutoAtendimento({ ...base, optOut: true }).decisao).toBe("silenciar");
    expect(avaliarAutoAtendimento({ ...base, texto: "Para de me mandar mensagem" }).decisao).toBe("silenciar");
  });

  it("recusa → silenciar", () => {
    expect(avaliarAutoAtendimento({ ...base, texto: "Não tenho interesse" }).decisao).toBe("silenciar");
  });

  it("humano assumiu ou handoff pendente → silenciar", () => {
    expect(avaliarAutoAtendimento({ ...base, humanoAssumiu: true }).decisao).toBe("silenciar");
    expect(avaliarAutoAtendimento({ ...base, handoffPendente: true }).decisao).toBe("silenciar");
  });

  it("preço, pedido de humano, nota 9+ e ação do Scout → handoff", () => {
    expect(avaliarAutoAtendimento({ ...base, texto: "Quanto custa? qual o preço?" }).decisao).toBe("handoff");
    expect(avaliarAutoAtendimento({ ...base, pediuPreco: true }).decisao).toBe("handoff");
    expect(avaliarAutoAtendimento({ ...base, texto: "Quero falar com um atendente" }).decisao).toBe("handoff");
    expect(avaliarAutoAtendimento({ ...base, pediuHumano: true }).decisao).toBe("handoff");
    expect(avaliarAutoAtendimento({ ...base, notaScout: 9 }).decisao).toBe("handoff");
    expect(avaliarAutoAtendimento({ ...base, notaScout: 8 }).decisao).toBe("responder");
    expect(avaliarAutoAtendimento({ ...base, acaoScout: "handoff" }).decisao).toBe("handoff");
  });

  it("fora da janela (madrugada ou fim de semana) → silenciar", () => {
    expect(avaliarAutoAtendimento({ ...base, agora: QUARTA_00H }).decisao).toBe("silenciar");
    expect(avaliarAutoAtendimento({ ...base, agora: SABADO_12H }).decisao).toBe("silenciar");
  });

  it("janela customizada é respeitada", () => {
    const janela = { apenasDiasUteis: false, janelaInicioHora: 0, janelaFimHora: 24 };
    expect(avaliarAutoAtendimento({ ...base, agora: SABADO_12H, janela }).decisao).toBe("responder");
  });

  it("anti-loop: a partir de maxSeguidas respostas vira handoff", () => {
    expect(avaliarAutoAtendimento({ ...base, autoRespostasSeguidas: 2 }).decisao).toBe("responder");
    expect(avaliarAutoAtendimento({ ...base, autoRespostasSeguidas: 3 }).decisao).toBe("handoff");
    expect(avaliarAutoAtendimento({ ...base, autoRespostasSeguidas: 1, maxSeguidas: 1 }).decisao).toBe("handoff");
  });

  it("Scout 'ignorar' → silenciar", () => {
    expect(avaliarAutoAtendimento({ ...base, acaoScout: "ignorar" }).decisao).toBe("silenciar");
  });

  it("opt-out vence qualquer handoff (proteção do contato primeiro)", () => {
    expect(avaliarAutoAtendimento({ ...base, optOut: true, pediuPreco: true }).decisao).toBe("silenciar");
  });
});

describe("helpers do domínio", () => {
  it("conta respostas automáticas desde o último humano, ignorando mensagens do contato", () => {
    expect(contarRespostasAutomaticasSeguidas([{ autor: "contato" }, { autor: "robo" }, { autor: "contato" }, { autor: "robo" }])).toBe(2);
    expect(contarRespostasAutomaticasSeguidas([{ autor: "robo" }, { autor: "humano" }, { autor: "contato" }])).toBe(0);
    expect(contarRespostasAutomaticasSeguidas([])).toBe(0);
  });

  it("humano assumiu quando o último remetente não-contato foi humano", () => {
    expect(humanoAssumiuNoHistorico([{ autor: "robo" }, { autor: "humano" }, { autor: "contato" }])).toBe(true);
    expect(humanoAssumiuNoHistorico([{ autor: "humano" }, { autor: "robo" }])).toBe(false);
    expect(humanoAssumiuNoHistorico([{ autor: "contato" }])).toBe(false);
  });

  it("extrai nota só quando a resposta é o número", () => {
    expect(extrairNotaDaResposta("9")).toBe(9);
    expect(extrairNotaDaResposta("nota 8")).toBe(8);
    expect(extrairNotaDaResposta("10/10")).toBe(10);
    expect(extrairNotaDaResposta("tenho 9 funcionários")).toBeNull();
    expect(extrairNotaDaResposta("11")).toBeNull();
  });

  it("revalida o texto do robô contra preço", () => {
    expect(textoRoboSeguro("Me conta mais sobre a sua operação").ok).toBe(true);
    expect(textoRoboSeguro("O valor do plano é R$ 99").ok).toBe(false);
    expect(textoRoboSeguro("  ").ok).toBe(false);
  });
});

describe("fluxo com arquivos locais", () => {
  let dir: string;
  const TEL = "5562999990001";

  const chegou = (texto: string, em: string, id: string) =>
    ingestWhatsAppMessage({
      type: "message.received",
      eventId: id,
      timestamp: em,
      data: { id, from: `${TEL}@s.whatsapp.net`, text: texto },
    });
  const enviou = (texto: string, em: string, id: string) =>
    ingestWhatsAppMessage({
      type: "message.sent",
      eventId: id,
      timestamp: em,
      data: { id, to: TEL, text: texto, status: "sent" },
    });

  const scoutNeutro = { saida: { payload: { acao: "nutrir" } } };
  const claudioOk = { saida: { payload: { texto: "Entendi. Me conta um pouco mais sobre a sua operação?" } } };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "agentes-auto-"));
    process.env.AGENTES_DATA_DIR = dir;
    process.env.WHATSAPP_LOCAL_FILE = join(dir, "msgs.json");
    process.env.RECICLADOR_DATA_FILE = join(dir, "reciclador.json");
    process.env.CRM_CLAUDIO_AUTO_REPLY = "1";
    delete process.env.CRM_PILOT_AUTO;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    estado.llm = true;
    executar.mockReset();
    executar.mockImplementation(async (slug: string) => (slug === "scout" ? scoutNeutro : claudioOk));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    delete process.env.AGENTES_DATA_DIR;
    delete process.env.WHATSAPP_LOCAL_FILE;
    delete process.env.RECICLADOR_DATA_FILE;
    delete process.env.CRM_CLAUDIO_AUTO_REPLY;
    delete process.env.CRM_PILOT_AUTO;
  });

  const enviosOk = () =>
    vi.fn(async (_args: { sessionId: string; to: string; text: string; idempotencyKey: string }) => ({
      ok: true as const,
      id: "wamid.out1",
    }));

  it("responde, envia pelo provider e registra a mensagem como robo", async () => {
    await chegou("Oi, quero organizar meus clientes", QUARTA_12H, "e1");
    const sendFn = enviosOk();
    const r = await processarMensagemRecebidaAgentes({ phoneDigits: TEL, texto: "Oi, quero organizar meus clientes", agora: QUARTA_12H, sendFn });
    expect(r).toMatchObject({ ativo: true, decisao: "responder", enviado: true });
    expect(sendFn).toHaveBeenCalledTimes(1);
    expect(sendFn.mock.calls[0][0]).toMatchObject({ to: TEL, text: "Entendi. Me conta um pouco mais sobre a sua operação?" });
    const gravado = JSON.parse(readFileSync(join(dir, "msgs.json"), "utf8")) as { mensagens: { autor: string }[] };
    expect(gravado.mensagens.some((m) => m.autor === "robo")).toBe(true);
    expect(lerLogAgentes(5)[0]).toMatchObject({ decisao: "responder", origem: "auto-atendimento" });
  });

  it("log só guarda telefone mascarado e trecho curto", async () => {
    await chegou("Oi", QUARTA_12H, "e1");
    await processarMensagemRecebidaAgentes({ phoneDigits: TEL, texto: "x".repeat(300), agora: QUARTA_12H, sendFn: enviosOk() });
    const l = lerLogAgentes(1)[0];
    expect(l.telefone).not.toContain("99999");
    expect(l.trecho!.length).toBeLessThanOrEqual(80);
  });

  it("preço no texto do contato → handoff, sem envio", async () => {
    await chegou("Qual o preço?", QUARTA_12H, "e1");
    const sendFn = enviosOk();
    const r = await processarMensagemRecebidaAgentes({ phoneDigits: TEL, texto: "Qual o preço?", agora: QUARTA_12H, sendFn });
    expect(r).toMatchObject({ decisao: "handoff", enviado: false });
    expect(sendFn).not.toHaveBeenCalled();
  });

  it("depois do handoff o robô fica calado até um humano responder", async () => {
    await chegou("Qual o preço?", QUARTA_12H, "e1");
    const sendFn = enviosOk();
    await processarMensagemRecebidaAgentes({ phoneDigits: TEL, texto: "Qual o preço?", agora: QUARTA_12H, sendFn });
    await chegou("Alguém aí?", "2026-11-04T15:05:00.000Z", "e2");
    const r2 = await processarMensagemRecebidaAgentes({ phoneDigits: TEL, texto: "Alguém aí?", agora: "2026-11-04T15:05:00.000Z", sendFn });
    expect(r2.decisao).toBe("silenciar");
    expect(sendFn).not.toHaveBeenCalled();
  });

  it("Cláudio que devolve preço é barrado e vira handoff", async () => {
    executar.mockImplementation(async (slug: string) =>
      slug === "scout" ? scoutNeutro : { saida: { payload: { texto: "Fica R$ 99 por mês" } } },
    );
    await chegou("Quero saber mais", QUARTA_12H, "e1");
    const sendFn = enviosOk();
    const r = await processarMensagemRecebidaAgentes({ phoneDigits: TEL, texto: "Quero saber mais", agora: QUARTA_12H, sendFn });
    expect(r.decisao).toBe("handoff");
    expect(sendFn).not.toHaveBeenCalled();
  });

  it("Cláudio bloqueado vira handoff", async () => {
    executar.mockImplementation(async (slug: string) =>
      slug === "scout" ? scoutNeutro : { saida: { payload: { bloqueado: true, motivo: "preco" } } },
    );
    await chegou("Quero saber mais", QUARTA_12H, "e1");
    const r = await processarMensagemRecebidaAgentes({ phoneDigits: TEL, texto: "Quero saber mais", agora: QUARTA_12H, sendFn: enviosOk() });
    expect(r.decisao).toBe("handoff");
  });

  it("fora da janela comercial → silêncio, sem envio", async () => {
    await chegou("Oi", QUARTA_00H, "e1");
    const sendFn = enviosOk();
    const r = await processarMensagemRecebidaAgentes({ phoneDigits: TEL, texto: "Oi", agora: QUARTA_00H, sendFn });
    expect(r.decisao).toBe("silenciar");
    expect(sendFn).not.toHaveBeenCalled();
  });

  it("anti-loop: depois de 3 respostas automáticas seguidas chama o humano", async () => {
    await chegou("1", "2026-11-04T14:00:00.000Z", "a1");
    await enviou("r1", "2026-11-04T14:01:00.000Z", "claudio_auto_1");
    await chegou("2", "2026-11-04T14:10:00.000Z", "a2");
    await enviou("r2", "2026-11-04T14:11:00.000Z", "claudio_auto_2");
    await chegou("3", "2026-11-04T14:20:00.000Z", "a3");
    await enviou("r3", "2026-11-04T14:21:00.000Z", "claudio_auto_3");
    await chegou("Sigo sem entender", "2026-11-04T14:30:00.000Z", "a4");
    const sendFn = enviosOk();
    const r = await processarMensagemRecebidaAgentes({ phoneDigits: TEL, texto: "Sigo sem entender", agora: QUARTA_12H, sendFn });
    expect(r.decisao).toBe("handoff");
    expect(r.motivo).toMatch(/anti-loop/);
    expect(sendFn).not.toHaveBeenCalled();
  });

  it("humano respondeu por último → robô não atravessa", async () => {
    await chegou("Oi", "2026-11-04T14:00:00.000Z", "a1");
    await enviou("Aqui é a Ana, vou te ajudar", "2026-11-04T14:05:00.000Z", "wamid.human1");
    await chegou("Beleza", "2026-11-04T14:10:00.000Z", "a2");
    const sendFn = enviosOk();
    const r = await processarMensagemRecebidaAgentes({ phoneDigits: TEL, texto: "Beleza", agora: QUARTA_12H, sendFn });
    expect(r.decisao).toBe("silenciar");
    expect(sendFn).not.toHaveBeenCalled();
  });

  it("opt-out → silêncio absoluto, sem chamar o Cláudio", async () => {
    await chegou("Para de me mandar mensagem", QUARTA_12H, "e1");
    const sendFn = enviosOk();
    const r = await processarMensagemRecebidaAgentes({ phoneDigits: TEL, texto: "Para de me mandar mensagem", agora: QUARTA_12H, sendFn });
    expect(r.decisao).toBe("silenciar");
    expect(executar.mock.calls.some(([slug]) => slug === "claudio")).toBe(false);
    expect(sendFn).not.toHaveBeenCalled();
  });

  it("opt-out registrado no Reciclador silencia mesmo com mensagem neutra", async () => {
    const { registrarOptOutReciclador } = await import("@/lib/reciclador/engine");
    await registrarOptOutReciclador({ telefone: TEL, motivo: "pedido_parar", evidencia: "pediu para parar" });
    await chegou("Quero saber mais", QUARTA_12H, "e1");
    const sendFn = enviosOk();
    const r = await processarMensagemRecebidaAgentes({ phoneDigits: TEL, texto: "Quero saber mais", agora: QUARTA_12H, sendFn });
    expect(r).toMatchObject({ decisao: "silenciar", motivo: expect.stringMatching(/opt-out/) });
    expect(sendFn).not.toHaveBeenCalled();
  });

  it("nota 9 vinda do contato → handoff", async () => {
    await chegou("9", QUARTA_12H, "e1");
    const r = await processarMensagemRecebidaAgentes({ phoneDigits: TEL, texto: "9", agora: QUARTA_12H, sendFn: enviosOk() });
    expect(r.decisao).toBe("handoff");
  });

  it("desabilitado sem CRM_CLAUDIO_AUTO_REPLY, sem chave LLM ou sem sessão: não faz nem registra nada", async () => {
    await chegou("Oi", QUARTA_12H, "e1");
    const sendFn = enviosOk();

    delete process.env.CRM_CLAUDIO_AUTO_REPLY;
    expect(await processarMensagemRecebidaAgentes({ phoneDigits: TEL, texto: "Oi", agora: QUARTA_12H, sendFn })).toMatchObject({ ativo: false, decisao: "desabilitado" });

    process.env.CRM_CLAUDIO_AUTO_REPLY = "1";
    estado.llm = false;
    expect(await processarMensagemRecebidaAgentes({ phoneDigits: TEL, texto: "Oi", agora: QUARTA_12H, sendFn })).toMatchObject({ ativo: false });

    estado.llm = true;
    delete process.env.WPP_API_KEY;
    delete process.env.WPP_SESSION_ID;
    expect(await processarMensagemRecebidaAgentes({ phoneDigits: TEL, texto: "Oi", agora: QUARTA_12H })).toMatchObject({ ativo: false });

    expect(sendFn).not.toHaveBeenCalled();
    expect(executar).not.toHaveBeenCalled();
    expect(lerLogAgentes()).toHaveLength(0);
  });

  it("falha de envio não reenvia nem lança", async () => {
    await chegou("Oi, quero saber mais", QUARTA_12H, "e1");
    const sendFn = vi.fn(async () => ({ ok: false as const, erro: "sessão caiu" }));
    const r = await processarMensagemRecebidaAgentes({ phoneDigits: TEL, texto: "Oi, quero saber mais", agora: QUARTA_12H, sendFn });
    expect(r).toMatchObject({ decisao: "silenciar", enviado: false });
    expect(sendFn).toHaveBeenCalledTimes(1);
  });

  it("marcador de handoff local expira quando um humano responde depois", async () => {
    await chegou("Oi", "2026-11-04T14:00:00.000Z", "a1");
    marcarHandoffLocal(TEL, "2026-11-04T14:01:00.000Z");
    await enviou("Ana: oi, tudo bem?", "2026-11-04T14:05:00.000Z", "wamid.h");
    await enviou("Passando o robô de novo", "2026-11-04T14:06:00.000Z", "claudio_auto_9"); // robô depois do humano
    await chegou("Ok", "2026-11-04T14:10:00.000Z", "a2");
    const sendFn = enviosOk();
    const r = await processarMensagemRecebidaAgentes({ phoneDigits: TEL, texto: "Ok", agora: QUARTA_12H, sendFn });
    expect(r.decisao).toBe("responder");
  });

  describe("tick do Pilot", () => {
    const AGORA = QUARTA_12H;
    const hoje = (dias: number) => new Date(Date.parse(AGORA) - dias * 86_400_000).toISOString();
    const pilotOk = { saida: { payload: { texto: "Oi, passando para retomar nosso papo. Quando fica bom pra você?" } } };

    beforeEach(() => {
      executar.mockImplementation(async () => pilotOk);
    });

    it("por padrão só sugere: salva sugestão e não envia", async () => {
      await chegou("Tenho interesse", hoje(3), "p1");
      const sendFn = enviosOk();
      const r = await executarTickPilot({ agora: AGORA, sendFn });
      expect(r).toMatchObject({ avaliados: 1, sugeridos: 1, enviados: 0, modo: "sugerir" });
      expect(sendFn).not.toHaveBeenCalled();
      const s = lerSugestoesPilot();
      expect(s).toHaveLength(1);
      expect(s[0].status).toBe("pendente");
      expect(s[0].telefoneMascarado).not.toContain("99999");
      // segundo tick não duplica a sugestão pendente
      const r2 = await executarTickPilot({ agora: AGORA, sendFn });
      expect(r2.sugeridos).toBe(0);
      expect(r2.motivos["ja_tem_sugestao_pendente"]).toBe(1);
    });

    it("CRM_PILOT_AUTO=1 com todos os pré-requisitos envia e registra como robo", async () => {
      process.env.CRM_PILOT_AUTO = "1";
      await chegou("Tenho interesse", hoje(3), "p1");
      const sendFn = enviosOk();
      const r = await executarTickPilot({ agora: AGORA, sendFn });
      expect(r).toMatchObject({ enviados: 1, sugeridos: 0, modo: "enviar" });
      expect(sendFn).toHaveBeenCalledTimes(1);
      expect(existsSync(join(dir, "pilot-sugestoes.json"))).toBe(false);
      expect(lerLogAgentes(1)[0]).toMatchObject({ origem: "pilot", decisao: "enviar" });
    });

    it("CRM_PILOT_AUTO=1 sem chave LLM ou fora da janela comercial continua só sugerindo", async () => {
      process.env.CRM_PILOT_AUTO = "1";
      await chegou("Tenho interesse", hoje(3), "p1");
      const sendFn = enviosOk();

      estado.llm = false;
      expect((await executarTickPilot({ agora: AGORA, sendFn })).enviados).toBe(0);

      estado.llm = true;
      const r = await executarTickPilot({ agora: QUARTA_00H, sendFn });
      expect(r.modo).toBe("sugerir");
      expect(sendFn).not.toHaveBeenCalled();
    });

    it("respeita cooldown de 48h, teto de 14 dias, parado menos de 1 dia e opt-out", async () => {
      process.env.CRM_PILOT_AUTO = "1";
      // cooldown: robô falou há 24h
      await chegou("Oi", hoje(3), "c1");
      await enviou("robô", hoje(1), "claudio_auto_c");
      const sendFn = enviosOk();
      const r1 = await executarTickPilot({ agora: AGORA, sendFn });
      expect(r1.motivos["cooldown_48h"]).toBe(1);

      rmSync(join(dir, "msgs.json"));
      await chegou("Oi", hoje(20), "t1");
      expect((await executarTickPilot({ agora: AGORA, sendFn })).motivos["parado_alem_do_teto_14_dias"]).toBe(1);

      rmSync(join(dir, "msgs.json"));
      await chegou("Oi", hoje(0.2), "n1");
      expect((await executarTickPilot({ agora: AGORA, sendFn })).motivos["parado_menos_de_1_dia"]).toBe(1);
      expect(sendFn).not.toHaveBeenCalled();
    });

    it("não segue contato com handoff pendente e respeita o limite por tick", async () => {
      await chegou("Oi", hoje(3), "h1");
      marcarHandoffLocal(TEL, hoje(2));
      expect((await executarTickPilot({ agora: AGORA })).motivos["handoff_pendente"]).toBe(1);

      rmSync(join(dir, "msgs.json"));
      rmSync(join(dir, "agentes-estado.json"));
      for (const n of ["5562911110001", "5562911110002", "5562911110003"]) {
        await ingestWhatsAppMessage({
          type: "message.received",
          eventId: `m_${n}`,
          timestamp: hoje(3),
          data: { id: `m_${n}`, from: n, text: "Oi" },
        });
      }
      const r = await executarTickPilot({ agora: AGORA, limite: 2 });
      expect(r.sugeridos).toBe(2);
    });

    it("Pilot bloqueado (preço/cooldown) não vira sugestão", async () => {
      executar.mockImplementation(async () => ({ saida: { payload: { bloqueado: true } } }));
      await chegou("Oi", hoje(3), "b1");
      const r = await executarTickPilot({ agora: AGORA });
      expect(r.sugeridos).toBe(0);
      expect(r.motivos["pilot_sem_texto_seguro"]).toBe(1);
    });
  });
});
