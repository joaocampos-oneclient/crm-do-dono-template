/**
 * Auto-atendimento dos agentes no WhatsApp (Scout + Cláudio). SEMPRE opt-in:
 *   CRM_CLAUDIO_AUTO_REPLY=1  +  chave Anthropic  +  sessão WhatsApp ativa.
 * Nunca lança erro para o webhook. Cada decisão vai para o log local (telefone mascarado).
 */
import {
  avaliarAutoAtendimento,
  contarRespostasAutomaticasSeguidas,
  extrairNotaDaResposta,
  humanoAssumiuNoHistorico,
  pediuAtendimentoHumano,
  pediuPrecoNaMensagem,
  textoRoboSeguro,
  type DecisaoAutoAtendimento,
} from "@/domain/agentes-auto";
import { telefoneDigitos } from "@/domain/rules";
import { executarAgente } from "@/lib/agents";
import { temLlmKey } from "@/lib/agents/llm-store";
import { handoffLocalDesde, marcarHandoffLocal, registrarDecisaoAgente } from "@/lib/agents/log";
import {
  carregarSnapshotReciclador,
  existeArquivoRecicladorLocal,
  marcarHandoffContatoCrm,
  temSupabaseReciclador,
} from "@/lib/reciclador/store";
import { getWhatsAppProvider, newIdempotencyKey } from "@/lib/whatsapp";
import { carregarHistoricoContato, ingestWhatsAppMessage } from "@/lib/whatsapp/ingest";
import { sessaoWhatsAppAtiva } from "@/lib/whatsapp/sessao";
import { effectiveSessionId } from "@/lib/whatsapp/store";
import type { EnvioResultado } from "@/lib/whatsapp/types";

export type SendFn = (args: {
  sessionId: string;
  to: string;
  text: string;
  idempotencyKey: string;
}) => Promise<EnvioResultado>;

export interface ResultadoAutoAgentes {
  /** false quando o auto-atendimento está desligado ou sem pré-requisitos (nada foi feito nem registrado). */
  ativo: boolean;
  decisao: DecisaoAutoAtendimento | "desabilitado";
  motivo: string;
  enviado: boolean;
}

export function autoAtendimentoHabilitado(): { ok: boolean; motivo?: string } {
  if (process.env.CRM_CLAUDIO_AUTO_REPLY !== "1") {
    return { ok: false, motivo: "CRM_CLAUDIO_AUTO_REPLY não está ligado." };
  }
  if (!temLlmKey()) return { ok: false, motivo: "Sem chave Anthropic: o Cláudio não responde sem IA." };
  return { ok: true };
}

/** Contato está no registro de opt-out (Reciclador) e o registro ainda vale? Não cria arquivo se não existir. */
export async function contatoEmOptOut(phoneDigits: string, agoraIso = new Date().toISOString()): Promise<boolean> {
  try {
    if (!temSupabaseReciclador() && !existeArquivoRecicladorLocal()) return false;
    const snap = await carregarSnapshotReciclador();
    const sufixo = telefoneDigitos(phoneDigits).slice(-11);
    return snap.optOuts.some(
      (o) =>
        o.telefoneDigitos.slice(-11) === sufixo && (!o.expiraEm || Date.parse(o.expiraEm) > Date.parse(agoraIso)),
    );
  } catch {
    return false;
  }
}

function rascunhoDoClaudio(ultimaMensagem: string, jaPerguntouNota: boolean): string {
  if (jaPerguntouNota) {
    return `Entendi: "${ultimaMensagem.slice(0, 160)}". Me conta um pouco mais pra eu te ajudar do jeito certo?`;
  }
  return `Entendi: "${ultimaMensagem.slice(0, 160)}". De 0 a 10, resolver isso agora é prioridade na sua empresa?`;
}

export async function processarMensagemRecebidaAgentes(opts: {
  phoneDigits: string;
  contatoId?: string;
  texto: string;
  timestamp?: string;
  /** Instante usado para a janela comercial (padrão: agora). */
  agora?: string;
  sendFn?: SendFn;
}): Promise<ResultadoAutoAgentes> {
  const desligado = (motivo: string): ResultadoAutoAgentes => ({
    ativo: false,
    decisao: "desabilitado",
    motivo,
    enviado: false,
  });

  try {
    const hab = autoAtendimentoHabilitado();
    if (!hab.ok) return desligado(hab.motivo ?? "desabilitado");
    if (!opts.sendFn && !sessaoWhatsAppAtiva()) return desligado("Sessão WhatsApp sem credenciais.");

    const texto = (opts.texto ?? "").trim();
    const phone = telefoneDigitos(opts.phoneDigits);
    if (!texto || !phone) return desligado("Mensagem vazia ou sem telefone.");

    const agora = opts.agora ?? new Date().toISOString();
    const registrar = (decisao: DecisaoAutoAtendimento, motivo: string, enviado = false): ResultadoAutoAgentes => {
      registrarDecisaoAgente({
        origem: "auto-atendimento",
        decisao,
        motivo,
        telefone: phone,
        texto,
        em: agora,
      });
      return { ativo: true, decisao, motivo, enviado };
    };

    const [historico, optOut] = await Promise.all([
      carregarHistoricoContato({ contatoId: opts.contatoId, phoneDigits: phone, limite: 20 }),
      contatoEmOptOut(phone, agora),
    ]);
    const msgs = historico.mensagens;
    const contatoId = historico.contatoId ?? opts.contatoId;
    const ultimaRobo = [...msgs].reverse().find((m) => m.autor === "robo");
    const ultimaHumano = [...msgs].reverse().find((m) => m.autor === "humano");

    // Handoff local pendente só vale até um humano responder depois dele.
    const handoffLocal = handoffLocalDesde(phone);
    const handoffLocalPendente =
      handoffLocal !== null && !(ultimaHumano && Date.parse(ultimaHumano.em) > Date.parse(handoffLocal));

    const humanoAssumiu = historico.donoHumano || humanoAssumiuNoHistorico(msgs);
    const nota = extrairNotaDaResposta(texto);
    const pediuPreco = pediuPrecoNaMensagem(texto);
    const pediuHumano = pediuAtendimentoHumano(texto);

    // Scout classifica a conversa (LLM ou regras locais).
    let acaoScout: string | null = null;
    try {
      const ultimaEm = msgs.length > 0 ? msgs[msgs.length - 1].em : agora;
      const scout = await executarAgente("scout", {
        contatoId,
        contexto: {
          textoConversas: msgs.map((m) => `${m.autor}: ${m.texto}`).join("\n").slice(-4000) || texto,
          minutosSilencio: Math.max(0, Math.round((Date.parse(agora) - Date.parse(ultimaEm)) / 60000)),
          nota,
          pediuPreco,
          pediuHumano,
        },
      });
      const acao = scout.saida.payload.acao;
      acaoScout = typeof acao === "string" ? acao : null;
    } catch (e) {
      console.warn("[agentes/auto scout]", e instanceof Error ? e.message : e);
    }

    const avaliacao = avaliarAutoAtendimento({
      texto,
      agora,
      optOut,
      humanoAssumiu,
      handoffPendente: historico.handoffPendente || handoffLocalPendente,
      autoRespostasSeguidas: contarRespostasAutomaticasSeguidas(msgs),
      ultimaRespostaRoboEm: ultimaRobo?.em ?? null,
      pediuPreco,
      pediuHumano,
      notaScout: nota,
      acaoScout,
    });

    if (avaliacao.decisao === "silenciar") return registrar("silenciar", avaliacao.motivo);

    if (avaliacao.decisao === "handoff") {
      marcarHandoffLocal(phone, agora);
      await marcarHandoffContatoCrm({ contatoId, phoneDigits: phone, agoraIso: agora });
      return registrar("handoff", avaliacao.motivo);
    }

    // Responder: Cláudio redige; o texto final é revalidado antes de qualquer envio.
    const jaPerguntouNota = msgs.some((m) => m.autor === "robo" && /de 0 a 10/i.test(m.texto));
    const claudio = await executarAgente("claudio", {
      contatoId,
      contexto: {
        rascunho: rascunhoDoClaudio(texto, jaPerguntouNota),
        nome: historico.nome,
        historico: msgs.slice(-10).map((m) => ({ autor: m.autor, texto: m.texto })),
      },
    });
    const payload = claudio.saida.payload;
    const textoClaudio = typeof payload.texto === "string" ? payload.texto.trim() : "";
    const seguro = textoRoboSeguro(textoClaudio);
    if (payload.bloqueado || !seguro.ok) {
      marcarHandoffLocal(phone, agora);
      await marcarHandoffContatoCrm({ contatoId, phoneDigits: phone, agoraIso: agora });
      return registrar("handoff", `Cláudio não gerou texto seguro (${seguro.motivo ?? "bloqueado"}): passa ao humano.`);
    }

    const sessionId = effectiveSessionId() ?? "default";
    const sendFn: SendFn = opts.sendFn ?? ((args) => getWhatsAppProvider().sendText(args));
    const envio = await sendFn({
      sessionId,
      to: phone,
      text: textoClaudio,
      idempotencyKey: newIdempotencyKey(),
    });

    if (!envio.ok) {
      return registrar("silenciar", `Envio falhou (${envio.erro}); nada foi reenviado.`);
    }

    try {
      await ingestWhatsAppMessage({
        type: "message.sent",
        eventId: `claudio_auto_${envio.id}`,
        sessionId,
        timestamp: agora,
        data: { id: envio.id, to: phone, text: textoClaudio, status: "sent" },
      });
    } catch {
      // o envio já aconteceu; nunca interrompe o webhook
    }
    return registrar("responder", avaliacao.motivo, true);
  } catch (e) {
    console.warn("[agentes/auto]", e instanceof Error ? e.message : e);
    return { ativo: true, decisao: "silenciar", motivo: "Erro interno; nada foi enviado.", enviado: false };
  }
}
