/**
 * Tick do Pilot: encontra contatos parados e prepara follow-up.
 * Padrão: SÓ SUGERE (salva em data/pilot-sugestoes.json). Envia apenas com CRM_PILOT_AUTO=1
 * + chave Anthropic + sessão WhatsApp + janela comercial + cooldown + sem opt-out/handoff.
 * Sugestões ficam só no arquivo local (não há tabela no Supabase para isso ainda).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { JANELA_AUTO_PADRAO, textoRoboSeguro } from "@/domain/agentes-auto";
import { dentroDaJanelaHorario, mascararTelefoneReciclador } from "@/domain/reciclador";
import type { FreiosCampanhaReciclador } from "@/domain/reciclador-types";
import { podeRoboEnviar, telefoneDigitos } from "@/domain/rules";
import { executarAgente } from "@/lib/agents";
import { temLlmKey } from "@/lib/agents/llm-store";
import { agentesDataDir, handoffLocalDesde, registrarDecisaoAgente } from "@/lib/agents/log";
import { contatoEmOptOut, type SendFn } from "@/lib/agents/auto";
import { getWhatsAppProvider, newIdempotencyKey } from "@/lib/whatsapp";
import { carregarHistoricoContato, ingestWhatsAppMessage, listarContatosBasicos } from "@/lib/whatsapp/ingest";
import { sessaoWhatsAppAtiva } from "@/lib/whatsapp/sessao";
import { effectiveSessionId } from "@/lib/whatsapp/store";

export const PILOT_MIN_DIAS = 1;
export const PILOT_MAX_DIAS = 14;
export const PILOT_LIMITE_PADRAO = 5;

export interface SugestaoPilot {
  id: string;
  criadaEm: string;
  contatoId: string;
  nome: string;
  telefoneMascarado: string;
  diasParado: number;
  texto: string;
  status: "pendente" | "enviada" | "descartada";
}

export interface ResultadoTickPilot {
  avaliados: number;
  sugeridos: number;
  enviados: number;
  ignorados: number;
  motivos: Record<string, number>;
  modo: "sugerir" | "enviar";
}

function arquivoSugestoes(): string {
  return resolve(agentesDataDir(), "pilot-sugestoes.json");
}

export function lerSugestoesPilot(): SugestaoPilot[] {
  try {
    const f = arquivoSugestoes();
    if (!existsSync(f)) return [];
    return JSON.parse(readFileSync(f, "utf8")) as SugestaoPilot[];
  } catch {
    return [];
  }
}

function gravarSugestoes(lista: SugestaoPilot[]): void {
  mkdirSync(agentesDataDir(), { recursive: true });
  writeFileSync(arquivoSugestoes(), JSON.stringify(lista.slice(-500), null, 2));
}

const horasEntre = (deIso: string, ateIso: string) => (Date.parse(ateIso) - Date.parse(deIso)) / 3_600_000;

export async function executarTickPilot(opts: {
  limite?: number;
  agora?: string;
  ignorarJanela?: boolean;
  sendFn?: SendFn;
} = {}): Promise<ResultadoTickPilot> {
  const agora = opts.agora ?? new Date().toISOString();
  const limite = Math.max(1, Math.floor(opts.limite ?? PILOT_LIMITE_PADRAO));
  const querEnviar = process.env.CRM_PILOT_AUTO === "1";

  const resultado: ResultadoTickPilot = {
    avaliados: 0,
    sugeridos: 0,
    enviados: 0,
    ignorados: 0,
    motivos: {},
    modo: "sugerir",
  };
  const ignorar = (motivo: string) => {
    resultado.ignorados += 1;
    resultado.motivos[motivo] = (resultado.motivos[motivo] ?? 0) + 1;
  };

  // Envio só com todos os pré-requisitos; senão cai para "sugerir" (nunca envia por engano).
  let podeEnviar = false;
  if (querEnviar) {
    if (!temLlmKey()) resultado.motivos["auto_sem_chave_llm"] = 1;
    else if (!opts.sendFn && !sessaoWhatsAppAtiva()) resultado.motivos["auto_sem_sessao_whatsapp"] = 1;
    else podeEnviar = true;
  }
  const dentroJanela = dentroDaJanelaHorario(agora, JANELA_AUTO_PADRAO as FreiosCampanhaReciclador).ok;
  const enviarAgora = podeEnviar && (dentroJanela || opts.ignorarJanela === true);
  if (podeEnviar && !enviarAgora) resultado.motivos["fora_da_janela_comercial_so_sugere"] = 1;
  resultado.modo = enviarAgora ? "enviar" : "sugerir";

  const sugestoes = lerSugestoesPilot();
  const pendentes = new Set(sugestoes.filter((s) => s.status === "pendente").map((s) => s.contatoId));
  const contatos = await listarContatosBasicos(200);
  let acionados = 0;

  for (const c of contatos) {
    if (acionados >= limite) break;
    resultado.avaliados += 1;

    if (pendentes.has(c.id)) {
      ignorar("ja_tem_sugestao_pendente");
      continue;
    }
    const phone = telefoneDigitos(c.telefoneDigitos);
    const historico = await carregarHistoricoContato({ contatoId: c.id, phoneDigits: phone, limite: 20 });
    const msgs = historico.mensagens;
    if (msgs.length === 0) {
      ignorar("sem_conversa");
      continue;
    }
    const ultima = msgs[msgs.length - 1];
    const diasParado = horasEntre(ultima.em, agora) / 24;
    if (diasParado < PILOT_MIN_DIAS) {
      ignorar("parado_menos_de_1_dia");
      continue;
    }
    if (diasParado >= PILOT_MAX_DIAS) {
      ignorar("parado_alem_do_teto_14_dias");
      continue;
    }
    if (await contatoEmOptOut(phone, agora)) {
      ignorar("opt_out");
      continue;
    }
    if (historico.handoffPendente || historico.donoHumano) {
      ignorar("humano_no_comando");
      continue;
    }
    const handoffLocal = handoffLocalDesde(phone);
    const ultimaHumano = [...msgs].reverse().find((m) => m.autor === "humano");
    if (handoffLocal && !(ultimaHumano && Date.parse(ultimaHumano.em) > Date.parse(handoffLocal))) {
      ignorar("handoff_pendente");
      continue;
    }
    const ultimaRobo = [...msgs].reverse().find((m) => m.autor === "robo");
    const horasDesdeRobo = ultimaRobo ? horasEntre(ultimaRobo.em, agora) : null;
    if (horasDesdeRobo !== null && horasDesdeRobo < 48) {
      ignorar("cooldown_48h");
      continue;
    }

    const execucao = await executarAgente("pilot", {
      contatoId: c.id,
      contexto: {
        horasDesdeUltimaAutomatica: horasDesdeRobo,
        diasParado: Math.floor(diasParado),
        nome: c.nome,
        textoFollowup: `Oi ${c.nome.split(/\s+/)[0]}, passando para retomar nosso papo. Quando fica bom pra você?`,
        historico: msgs.slice(-10).map((m) => ({ autor: m.autor, texto: m.texto })),
      },
    });
    const payload = execucao.saida.payload;
    const texto = typeof payload.texto === "string" ? payload.texto.trim() : "";
    if (payload.bloqueado || payload.cooldown || payload.pausado || !texto) {
      ignorar(payload.pausado ? "pilot_pausado" : payload.cooldown ? "pilot_cooldown" : "pilot_sem_texto_seguro");
      continue;
    }
    const seguro = textoRoboSeguro(texto);
    if (!seguro.ok) {
      ignorar("texto_inseguro");
      continue;
    }

    if (enviarAgora) {
      // CRM_PILOT_AUTO=1 equivale à aprovação humana; a trava de preço e o cooldown continuam em código.
      const pode = podeRoboEnviar(texto, true, horasDesdeRobo);
      if (!pode.ok) {
        ignorar("trava_podeRoboEnviar");
        continue;
      }
      const sessionId = effectiveSessionId() ?? "default";
      const sendFn: SendFn = opts.sendFn ?? ((args) => getWhatsAppProvider().sendText(args));
      const envio = await sendFn({ sessionId, to: phone, text: texto, idempotencyKey: newIdempotencyKey() });
      if (!envio.ok) {
        ignorar("envio_falhou");
        registrarDecisaoAgente({ origem: "pilot", decisao: "silenciar", motivo: `Envio falhou: ${envio.erro}`, telefone: phone, texto, em: agora });
        continue;
      }
      try {
        await ingestWhatsAppMessage({
          type: "message.sent",
          eventId: `pilot_${envio.id}`,
          sessionId,
          timestamp: agora,
          data: { id: envio.id, to: phone, text: texto, status: "sent" },
        });
      } catch {
        // o envio já aconteceu
      }
      resultado.enviados += 1;
      acionados += 1;
      registrarDecisaoAgente({ origem: "pilot", decisao: "enviar", motivo: `Follow-up após ${Math.floor(diasParado)} dia(s) parado.`, telefone: phone, texto, em: agora });
      continue;
    }

    sugestoes.push({
      id: crypto.randomUUID(),
      criadaEm: agora,
      contatoId: c.id,
      nome: c.nome,
      telefoneMascarado: mascararTelefoneReciclador(phone),
      diasParado: Math.floor(diasParado),
      texto,
      status: "pendente",
    });
    pendentes.add(c.id);
    resultado.sugeridos += 1;
    acionados += 1;
    registrarDecisaoAgente({ origem: "pilot", decisao: "sugerir", motivo: `Sugestão de follow-up (${Math.floor(diasParado)} dia(s) parado).`, telefone: phone, texto, em: agora });
  }

  if (resultado.sugeridos > 0) gravarSugestoes(sugestoes);
  return resultado;
}
