/**
 * Handoff de retorno do WhatsApp para o fluxo normal de atendimento (Cláudio ou Humano).
 * O Ember abre a porta; quando o lead responde:
 * 1) Se pediu opt-out -> registra bloqueio imediato e silencia;
 * 2) Atribui resposta (`respondeuEm`, `avancouEtapa = true`) ao item enviado;
 * 3) Se campanha entrega para Cláudio (com auto-reply ativo, sem preço e sem pedido de humano),
 *    dispara resposta assistida do Cláudio; caso contrário, marca handoff humano.
 */
import {
  detectarPedidoOptOut,
  mencionaPrecoComercial,
  type ItemFilaReciclador,
} from "@/domain/reciclador";
import { mencionaPreco, telefoneDigitos } from "@/domain/rules";
import { executarAgente } from "@/lib/agents";
import { temLlmKey } from "@/lib/agents/llm-store";
import { getWhatsAppProvider, newIdempotencyKey, resolveProviderId } from "@/lib/whatsapp";
import { effectiveApiKey, effectiveSessionId } from "@/lib/whatsapp/store";
import type { EnvioResultado } from "@/lib/whatsapp/types";
import { registrarOptOutReciclador } from "./engine";
import {
  carregarSnapshotReciclador,
  existeArquivoRecicladorLocal,
  marcarHandoffContatoCrm,
  temSupabaseReciclador,
  upsertItensFilaStore,
} from "./store";

function mesmoTelefone(a: string, b: string): boolean {
  const da = telefoneDigitos(a);
  const db = telefoneDigitos(b);
  if (!da || !db) return false;
  if (da === db) return true;
  const sa = da.slice(-11);
  const sb = db.slice(-11);
  return sa.length >= 10 && sa === sb;
}

function pediuAtendimentoHumano(texto: string): boolean {
  return /\b(?:humano|atendente|pessoa|vendedor|consultor|especialista|falar\s+com\s+algu[eé]m|me\s+liga|pode\s+me\s+ligar)\b/i.test(
    texto,
  );
}

function sessaoWhatsAppAtiva(): boolean {
  if (resolveProviderId() === "waha") {
    return Boolean(process.env.WAHA_BASE_URL?.trim());
  }
  return Boolean(effectiveApiKey() && effectiveSessionId());
}

export interface ResultadoHandoffReciclador {
  optOutRegistrado: boolean;
  itensAtribuidosIds: string[];
  handoffHumano: boolean;
  respostaClaudioEnviada: boolean;
}

export async function processarRespostaLeadReciclador(opts: {
  phoneDigits: string;
  contatoId?: string;
  texto: string;
  timestamp?: string;
  sendFn?: (args: {
    sessionId: string;
    to: string;
    text: string;
    idempotencyKey: string;
  }) => Promise<EnvioResultado>;
}): Promise<ResultadoHandoffReciclador> {
  const texto = (opts.texto ?? "").trim();
  const agora = opts.timestamp || new Date().toISOString();

  if (!texto || !opts.phoneDigits) {
    return {
      optOutRegistrado: false,
      itensAtribuidosIds: [],
      handoffHumano: false,
      respostaClaudioEnviada: false,
    };
  }

  // 1. Opt-out tem prioridade absoluta (mesmo que o contato ainda não estivesse numa campanha ativa)
  if (detectarPedidoOptOut(texto)) {
    await registrarOptOutReciclador({
      telefone: opts.phoneDigits,
      contatoId: opts.contatoId,
      motivo: "pedido_parar",
      evidencia: texto.slice(0, 280),
    });

    const snap = await carregarSnapshotReciclador();
    const enviadosDoLead = snap.itens.filter(
      (i) => i.status === "enviado" && mesmoTelefone(i.telefone, opts.phoneDigits),
    );
    if (enviadosDoLead.length > 0) {
      await upsertItensFilaStore(
        enviadosDoLead.map((i) => ({
          ...i,
          respondeuEm: i.respondeuEm ?? agora,
        })),
      );
    }

    return {
      optOutRegistrado: true,
      itensAtribuidosIds: enviadosDoLead.map((i) => i.id),
      handoffHumano: false,
      respostaClaudioEnviada: false,
    };
  }

  // Evita criar data/reciclador.json desnecessariamente quando não há opt-out nem campanhas salvas
  if (!temSupabaseReciclador() && !existeArquivoRecicladorLocal()) {
    return {
      optOutRegistrado: false,
      itensAtribuidosIds: [],
      handoffHumano: false,
      respostaClaudioEnviada: false,
    };
  }

  const snap = await carregarSnapshotReciclador();
  const enviadosCorrespondentes = snap.itens.filter(
    (i) => i.status === "enviado" && mesmoTelefone(i.telefone, opts.phoneDigits),
  );

  if (enviadosCorrespondentes.length === 0) {
    return {
      optOutRegistrado: false,
      itensAtribuidosIds: [],
      handoffHumano: false,
      respostaClaudioEnviada: false,
    };
  }

  // 2. Marca atribuição de resposta e avanço de etapa
  const itensAtualizados: ItemFilaReciclador[] = enviadosCorrespondentes.map((item) => ({
    ...item,
    respondeuEm: item.respondeuEm ?? agora,
    avancouEtapa: true,
    etapaAtual: item.etapaAtual === "novo" ? "conversa" : item.etapaAtual,
  }));
  await upsertItensFilaStore(itensAtualizados);

  // Seleciona o envio mais recente para decidir o destino (Cláudio vs Humano)
  const itemRecente = [...itensAtualizados].sort((a, b) => {
    const ta = a.processadoEm ? Date.parse(a.processadoEm) : 0;
    const tb = b.processadoEm ? Date.parse(b.processadoEm) : 0;
    return tb - ta;
  })[0];

  const campanha = snap.campanhas.find((c) => c.id === itemRecente.campanhaId) ?? null;
  const pediuPreco = mencionaPreco(texto) || mencionaPrecoComercial(texto);
  const pediuHumano = pediuAtendimentoHumano(texto);
  const autoClaudioHabilitado =
    Boolean(campanha?.cercas.autoResponderClaudio) || process.env.CRM_CLAUDIO_AUTO_REPLY === "1";

  // 3. Passagem ao Cláudio (quando elegível) ou handoff limpo ao humano
  if (
    campanha &&
    campanha.cercas.entregarPara === "claudio" &&
    autoClaudioHabilitado &&
    !pediuPreco &&
    !pediuHumano &&
    temLlmKey() &&
    (Boolean(opts.sendFn) || sessaoWhatsAppAtiva())
  ) {
    const resClaudio = await executarAgente("claudio", {
      contatoId: opts.contatoId ?? itemRecente.contatoId,
      oportunidadeId: itemRecente.oportunidadeId ?? undefined,
      contexto: {
        rascunho: `Oi, ${itemRecente.nomeContato}! Vi sua resposta ("${texto}"). De 0 a 10, organizar isso agora é prioridade na sua empresa?`,
      },
    });

    const payload = resClaudio.saida.payload;
    const textoClaudio = typeof payload.texto === "string" ? payload.texto.trim() : "";

    if (
      !payload.bloqueado &&
      textoClaudio &&
      !mencionaPreco(textoClaudio) &&
      !mencionaPrecoComercial(textoClaudio)
    ) {
      const sessionId = effectiveSessionId() ?? "default";
      const sendFn =
        opts.sendFn ??
        ((args: { sessionId: string; to: string; text: string; idempotencyKey: string }) =>
          getWhatsAppProvider().sendText(args));

      const envio = await sendFn({
        sessionId,
        to: telefoneDigitos(opts.phoneDigits),
        text: textoClaudio,
        idempotencyKey: newIdempotencyKey(),
      });

      if (envio.ok) {
        try {
          const { ingestWhatsAppMessage } = await import("@/lib/whatsapp/ingest");
          await ingestWhatsAppMessage({
            type: "message.sent",
            eventId: `claudio_handoff_${envio.id}`,
            sessionId,
            timestamp: agora,
            data: {
              id: envio.id,
              to: telefoneDigitos(opts.phoneDigits),
              text: textoClaudio,
              status: "sent",
            },
          });
        } catch {
          // nunca interrompe o fluxo de webhook
        }

        return {
          optOutRegistrado: false,
          itensAtribuidosIds: itensAtualizados.map((i) => i.id),
          handoffHumano: false,
          respostaClaudioEnviada: true,
        };
      }
    }
  }

  await marcarHandoffContatoCrm({
    contatoId: opts.contatoId ?? itemRecente.contatoId,
    phoneDigits: opts.phoneDigits,
    agoraIso: agora,
  });

  return {
    optOutRegistrado: false,
    itensAtribuidosIds: itensAtualizados.map((i) => i.id),
    handoffHumano: true,
    respostaClaudioEnviada: false,
  };
}
