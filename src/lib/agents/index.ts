import { crmConfig } from "@crm/config";
import { decidir } from "./decision-engine";
import { detectarPedidoOptOut } from "@/domain/reciclador";
import {
  avaliarPilotPre,
  limparFollowupsScribe,
  mencionaPrecoOuCondicao,
  minutosDeSilencio,
  normalizarHistorico,
  notasVazias,
  numerosInventados,
  pediuAtendimentoHumano,
  textoDeCobranca,
  valorOuNaoInformado,
} from "@/domain/agentes-guardrails";
import { deveFazerHandoff, mencionaPreco } from "@/domain/rules";
import type { AgenteSlug, ExecucaoEntrada, ResultadoAgente } from "./types";
import { ExecucaoSaida } from "./types";
import { effectiveAgentLlmModel, gerarComLlm, parseJsonDaResposta, temLlmKey } from "./llm";
import type { LlmGenerateResult } from "./llm";
import {
  ClaudioSaidaSchema,
  EcoSaidaSchema,
  LedgerSaidaSchema,
  PilotSaidaSchema,
  ScoutSaidaSchema,
  ScribeSaidaSchema,
  validarSaida,
} from "./schemas";
import type { z } from "zod";
import { avaliarGuardrailsPosLlm, mencionaPrecoComercial } from "@/domain/reciclador";

const cfg = crmConfig.agentes;

export async function executarAgente(slug: AgenteSlug, entrada: ExecucaoEntrada): Promise<ResultadoAgente> {
  switch (slug) {
    case "claudio":
      return claudio(entrada);
    case "scout":
      return scout(entrada);
    case "scribe":
      return scribe(entrada);
    case "ledger":
      return ledger(entrada);
    case "pilot":
      return pilot(entrada);
    case "eco":
      return eco(entrada);
    case "ember":
      return ember(entrada);
    default: {
      const _x: never = slug;
      throw new Error(`Agente desconhecido: ${_x}`);
    }
  }
}

function baseRegras(parcial: Omit<ResultadoAgente, "usadoLlm" | "usadoJev"> & { usadoJev?: boolean }): ResultadoAgente {
  return { usadoJev: false, usadoLlm: false, ...parcial };
}

/** Chama o LLM e valida o JSON contra o schema. `invalido` = o modelo respondeu, mas fora do contrato. */
async function chamarLlmValidado<S extends z.ZodTypeAny>(
  slug: AgenteSlug,
  prompt: string,
  schema: S,
): Promise<{ llm: LlmGenerateResult | null; dados: z.infer<S> | null; invalido: boolean }> {
  const llm = await gerarComLlm({ slug, prompt });
  if (!llm) return { llm: null, dados: null, invalido: false };
  const dados = validarSaida(schema, parseJsonDaResposta(llm.text));
  return { llm, dados, invalido: dados === null };
}

/** Tokens gastos mesmo quando a resposta foi descartada (custo é custo). */
const tokensDe = (llm: LlmGenerateResult | null) => llm?.tokens ?? 0;

const ctxTexto = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

// ───────────────────────── Cláudio ─────────────────────────

async function claudio(entrada: ExecucaoEntrada): Promise<ResultadoAgente> {
  const rascunho = String(entrada.contexto.rascunho ?? "Oi! Posso te fazer uma pergunta rápida para te ajudar melhor?");
  const ultimaDoContato = ctxTexto(entrada.contexto.ultimaMensagemContato);

  if (ultimaDoContato && detectarPedidoOptOut(ultimaDoContato)) {
    return baseRegras({
      custoTokens: 0,
      saida: ExecucaoSaida.parse({
        resumo: "Bloqueado: o contato pediu para parar.",
        acaoSugerida: "Não enviar. Registrar opt-out.",
        requerAprovacao: true,
        payload: { bloqueado: true, motivo: "opt_out" },
      }),
    });
  }

  if (mencionaPrecoOuCondicao(rascunho)) {
    return baseRegras({
      custoTokens: 0,
      saida: ExecucaoSaida.parse({
        resumo: "Bloqueado: Cláudio nunca fala preço.",
        acaoSugerida: "Reescrever sem preço e deixar o humano fechar.",
        requerAprovacao: true,
        payload: { bloqueado: true, motivo: "preco" },
      }),
    });
  }

  const { llm, dados, invalido } = await chamarLlmValidado(
    "claudio",
    `Rascunho do operador/robô:\n${rascunho}\n${ultimaDoContato ? `\nÚltima mensagem do contato:\n${ultimaDoContato}\n` : ""}\nMelhore se preciso, sem inventar preço. Responda em JSON.`,
    ClaudioSaidaSchema,
  );

  if (llm && dados) {
    if (dados.bloqueado || (dados.texto && mencionaPrecoOuCondicao(dados.texto))) {
      return {
        custoTokens: llm.tokens,
        usadoJev: false,
        usadoLlm: true,
        saida: ExecucaoSaida.parse({
          resumo: dados.resumo ?? "Bloqueado: Cláudio nunca fala preço.",
          acaoSugerida: dados.acaoSugerida ?? "Reescrever sem preço.",
          requerAprovacao: true,
          payload: { bloqueado: true, motivo: dados.bloqueado ? (dados.motivo ?? "preco") : "preco", viaLlm: true },
        }),
      };
    }
    return {
      custoTokens: llm.tokens,
      usadoJev: false,
      usadoLlm: true,
      saida: ExecucaoSaida.parse({
        resumo: dados.resumo ?? `${cfg.claudio.nome} (LLM) pronto para enviar.`,
        acaoSugerida: dados.acaoSugerida ?? "Enviar mensagem (sem preço).",
        requerAprovacao: false,
        payload: { texto: dados.texto, viaLlm: true },
      }),
    };
  }

  return baseRegras({
    custoTokens: tokensDe(llm),
    saida: ExecucaoSaida.parse({
      resumo: `${cfg.claudio.nome} pronto para enviar.`,
      acaoSugerida: "Enviar mensagem (sem preço).",
      requerAprovacao: false,
      payload: invalido ? { texto: rascunho, llmInvalido: true } : { texto: rascunho },
    }),
  });
}

// ───────────────────────── Scout ─────────────────────────

const PROXIMO_PASSO: Record<string, string> = {
  aguardar: "Aguardar a resposta e revisar em 24 horas.",
  retomar: "Preparar um follow-up sem preço (Pilot) e aprovar o envio.",
  handoff: "Passar a conversa para um humano agora.",
  nutrir: "Enviar conteúdo útil, sem pressionar.",
  ignorar: "Não contatar.",
};

async function scout(entrada: ExecucaoEntrada): Promise<ResultadoAgente> {
  const ctx = entrada.contexto;
  const historico = normalizarHistorico(ctx.mensagens);
  const textoHistorico = historico.map((m) => `${m.autor}: ${m.texto}`).join("\n");
  const texto = [String(ctx.textoConversas ?? ""), textoHistorico].filter(Boolean).join("\n");

  const calculado = minutosDeSilencio(historico, ctxTexto(ctx.agora) ?? undefined);
  const minutosSilencio = calculado ?? Number(ctx.minutosSilencio ?? 0);
  const nota = ctx.nota == null ? null : Number(ctx.nota);

  const ultimaDoContato =
    [...historico].reverse().find((m) => m.autor === "contato")?.texto ?? ctxTexto(ctx.ultimaMensagemContato) ?? "";
  const pediuPreco = ctx.pediuPreco === undefined ? mencionaPreco(ultimaDoContato) : Boolean(ctx.pediuPreco);
  const pediuHumano = ctx.pediuHumano === undefined ? pediuAtendimentoHumano(ultimaDoContato) : Boolean(ctx.pediuHumano);
  const pediuParar = Boolean(ultimaDoContato) && detectarPedidoOptOut(ultimaDoContato);

  const entradaDecisao = { textoConversas: texto, minutosSilencio, nota, pediuPreco, pediuHumano };

  /** Regras duras vencem o modelo: handoff por gatilho objetivo, silêncio absoluto em opt-out. */
  const aplicarRegrasDuras = (d: { acao: string; porque: string }) => {
    if (pediuParar) {
      return { acao: "ignorar", porque: "Contato pediu para parar.", corrigido: d.acao !== "ignorar" };
    }
    if (deveFazerHandoff({ nota, pediuPreco, pediuHumano }) && d.acao !== "handoff") {
      return { acao: "handoff", porque: "Gatilho objetivo: pediu preço/humano ou nota 9–10.", corrigido: true };
    }
    return { acao: d.acao, porque: d.porque, corrigido: false };
  };

  const { llm, dados, invalido } = await chamarLlmValidado("scout", JSON.stringify(entradaDecisao), ScoutSaidaSchema);

  if (llm && dados) {
    const d = aplicarRegrasDuras(dados);
    const proximoPasso = d.corrigido ? PROXIMO_PASSO[d.acao] : (dados.proximoPasso ?? PROXIMO_PASSO[d.acao]);
    const payload = {
      rotulo: dados.rotulo,
      confianca: dados.confianca,
      acao: d.acao,
      porque: d.porque,
      proximoPasso,
      minutosSilencio,
      acaoCorrigida: d.corrigido,
      usadoJev: false,
      viaLlm: true,
    };
    return {
      custoTokens: llm.tokens,
      usadoJev: false,
      usadoLlm: true,
      saida: ExecucaoSaida.parse({
        resumo: dados.resumo ?? `Scout: ${payload.rotulo} (${payload.acao})`,
        acaoSugerida: d.porque,
        requerAprovacao: d.acao === "handoff" || d.acao === "retomar",
        payload,
      }),
    };
  }

  const base = await decidir(entradaDecisao);
  const d = aplicarRegrasDuras(base);
  const payload = {
    ...base,
    acao: d.acao,
    porque: d.porque,
    proximoPasso: PROXIMO_PASSO[d.acao],
    minutosSilencio,
    ...(d.corrigido ? { acaoCorrigida: true } : {}),
    ...(invalido ? { llmInvalido: true } : {}),
  };
  return {
    custoTokens: base.usadoJev ? 1 : tokensDe(llm),
    usadoJev: base.usadoJev,
    usadoLlm: false,
    saida: ExecucaoSaida.parse({
      resumo: `Scout: ${base.rotulo} (${d.acao})`,
      acaoSugerida: d.porque,
      requerAprovacao: d.acao === "handoff" || d.acao === "retomar",
      payload,
    }),
  };
}

// ───────────────────────── Scribe ─────────────────────────

async function scribe(entrada: ExecucaoEntrada): Promise<ResultadoAgente> {
  const notas = String(entrada.contexto.notasReuniao ?? "").trim();

  if (notasVazias(notas)) {
    return baseRegras({
      custoTokens: 0,
      saida: ExecucaoSaida.parse({
        resumo: "Sem notas: nada a resumir.",
        acaoSugerida: "Cole as notas da reunião para gerar o resumo e os follow-ups.",
        requerAprovacao: true,
        payload: { resumo: "Sem notas", followups: [] },
      }),
    });
  }

  const { llm, dados, invalido } = await chamarLlmValidado("scribe", `Notas da reunião:\n${notas}`, ScribeSaidaSchema);
  const inventou = Boolean(dados) && numerosInventados(dados!.resumo, notas).length > 0;

  if (llm && dados && !inventou) {
    return {
      custoTokens: llm.tokens,
      usadoJev: false,
      usadoLlm: true,
      saida: ExecucaoSaida.parse({
        resumo: "Scribe (LLM) gerou resumo e follow-ups.",
        acaoSugerida: dados.acaoSugerida ?? "Criar tarefas a partir do resumo.",
        requerAprovacao: true,
        payload: { resumo: dados.resumo, followups: limparFollowupsScribe(dados.followups, notas), viaLlm: true },
      }),
    };
  }

  // Regras locais: resumo = início das notas; follow-ups só de linhas que já são tarefa.
  const linhasTarefa = notas
    .split(/\n+/)
    .map((l) => l.replace(/^[\s\-*•\d.)]+/, "").trim())
    .filter((l) => /^(?:enviar|marcar|agendar|ligar|retornar|mandar|revisar|preparar|confirmar|pedir|criar|atualizar)\b/i.test(l));
  return baseRegras({
    custoTokens: tokensDe(llm),
    saida: ExecucaoSaida.parse({
      resumo: "Scribe gerou resumo e follow-ups.",
      acaoSugerida: "Criar tarefas a partir do resumo.",
      requerAprovacao: true,
      payload: {
        resumo: notas.slice(0, 500),
        followups: limparFollowupsScribe(linhasTarefa, notas),
        ...(invalido || inventou ? { llmInvalido: true } : {}),
      },
    }),
  });
}

// ───────────────────────── Ledger ─────────────────────────

const LEDGER_ACAO_PADRAO = "Cláudio envia o link de acesso e um conteúdo novo, só para ajudar a começar.";

async function ledger(entrada: ExecucaoEntrada): Promise<ResultadoAgente> {
  const logins7d = Number(entrada.contexto.logins7d ?? 0);
  const diasDesdePagamento = Number(entrada.contexto.diasDesdePagamento ?? 0);
  const risco = diasDesdePagamento <= 7 && logins7d < 2;
  const fixos = { logins7d, diasDesdePagamento, nuncaCobra: true, nuncaAutomatico: true };

  const regras = (extra: Record<string, unknown> = {}, tokens = 0) =>
    baseRegras({
      custoTokens: tokens,
      saida: ExecucaoSaida.parse({
        resumo: risco ? "Ledger: risco de cancelamento (menos de 2 logins em 7 dias)." : "Ledger: saúde ok.",
        acaoSugerida: risco ? LEDGER_ACAO_PADRAO : "Monitorar.",
        requerAprovacao: true,
        payload: { risco, ...fixos, ...extra },
      }),
    });

  const { llm, dados, invalido } = await chamarLlmValidado(
    "ledger",
    JSON.stringify({ logins7d, diasDesdePagamento }),
    LedgerSaidaSchema,
  );

  if (llm && dados) {
    if (textoDeCobranca(`${dados.resumo} ${dados.acaoSugerida ?? ""}`)) {
      return regras({ bloqueado: true, motivo: "cobranca", viaLlm: true }, llm.tokens);
    }
    return {
      custoTokens: llm.tokens,
      usadoJev: false,
      usadoLlm: true,
      saida: ExecucaoSaida.parse({
        resumo: dados.resumo,
        acaoSugerida: dados.acaoSugerida ?? (dados.risco ? LEDGER_ACAO_PADRAO : "Monitorar."),
        requerAprovacao: true,
        payload: { risco: dados.risco, ...fixos, viaLlm: true },
      }),
    };
  }
  return regras(invalido ? { llmInvalido: true } : {}, tokensDe(llm));
}

// ───────────────────────── Pilot ─────────────────────────

async function pilot(entrada: ExecucaoEntrada): Promise<ResultadoAgente> {
  const ctx = entrada.contexto;
  const horasDesdeUltima = ctx.horasDesdeUltimaAutomatica == null ? null : Number(ctx.horasDesdeUltimaAutomatica);
  const diasParado = Number(ctx.diasParado ?? 0);
  const ultimaDoContato = ctxTexto(ctx.ultimaMensagemContato);

  const pre = avaliarPilotPre({
    horasDesdeUltimaAutomatica: horasDesdeUltima,
    diasParado,
    ultimaMensagemContato: ultimaDoContato,
    cooldownHoras: crmConfig.cooldownMensagemHoras,
    tetoDias: crmConfig.tetoAntiLoopDias,
  });
  if (!pre.ok) {
    const porBloqueio = {
      teto_anti_loop: { resumo: "Pilot pausado pelo teto anti-loop.", acao: "Revisar manualmente.", aprov: true, extra: { pausado: true } },
      cooldown: { resumo: "Pilot em cooldown de 48h.", acao: "Aguardar.", aprov: false, extra: { cooldown: true } },
      opt_out: { resumo: "Pilot bloqueado: o contato pediu para parar.", acao: "Não enviar. Registrar opt-out.", aprov: true, extra: { bloqueado: true } },
      recusa_recente: { resumo: "Pilot bloqueado: o contato recusou recentemente.", acao: "Não insistir.", aprov: true, extra: { bloqueado: true } },
    }[pre.bloqueio];
    return baseRegras({
      custoTokens: 0,
      saida: ExecucaoSaida.parse({
        resumo: porBloqueio.resumo,
        acaoSugerida: porBloqueio.acao,
        requerAprovacao: porBloqueio.aprov,
        payload: { ...porBloqueio.extra, motivo: pre.bloqueio },
      }),
    });
  }

  const texto = String(ctx.textoFollowup ?? "Passando para retomar nosso papo. Quando fica bom pra você?");
  if (mencionaPrecoOuCondicao(texto)) {
    return baseRegras({
      custoTokens: 0,
      saida: ExecucaoSaida.parse({
        resumo: "Pilot bloqueado: texto menciona preço.",
        requerAprovacao: true,
        payload: { bloqueado: true, motivo: "preco" },
      }),
    });
  }

  const { llm, dados, invalido } = await chamarLlmValidado(
    "pilot",
    JSON.stringify({ textoFollowup: texto, horasDesdeUltima, diasParado, ultimaMensagemContato: ultimaDoContato }),
    PilotSaidaSchema,
  );

  if (llm && dados) {
    if (mencionaPrecoOuCondicao(dados.texto)) {
      return baseRegras({
        custoTokens: llm.tokens,
        saida: ExecucaoSaida.parse({
          resumo: "Pilot bloqueado: LLM mencionou preço.",
          requerAprovacao: true,
          payload: { bloqueado: true, motivo: "preco", viaLlm: true },
        }),
      });
    }
    return {
      custoTokens: llm.tokens,
      usadoJev: false,
      usadoLlm: true,
      saida: ExecucaoSaida.parse({
        resumo: dados.resumo ?? "Pilot: follow-up pronto (LLM).",
        acaoSugerida: dados.acaoSugerida ?? "Enviar após aprovação.",
        requerAprovacao: true,
        payload: { texto: dados.texto, viaLlm: true },
      }),
    };
  }

  return baseRegras({
    custoTokens: tokensDe(llm),
    saida: ExecucaoSaida.parse({
      resumo: "Pilot: follow-up pronto.",
      acaoSugerida: "Enviar após aprovação.",
      requerAprovacao: true,
      payload: invalido ? { texto, llmInvalido: true } : { texto },
    }),
  });
}

// ───────────────────────── Eco ─────────────────────────

async function eco(entrada: ExecucaoEntrada): Promise<ResultadoAgente> {
  const nome = valorOuNaoInformado(entrada.contexto.nome);
  const dor = valorOuNaoInformado(entrada.contexto.dor);
  const meta = valorOuNaoInformado(entrada.contexto.meta);
  const nota = valorOuNaoInformado(entrada.contexto.nota);
  const fonte = JSON.stringify({ nome, dor, meta, nota });

  const { llm, dados, invalido } = await chamarLlmValidado("eco", fonte, EcoSaidaSchema);
  const inventou = Boolean(dados) && (numerosInventados(dados!.briefing, fonte).length > 0 || mencionaPrecoOuCondicao(dados!.briefing));

  if (llm && dados && !inventou) {
    return {
      custoTokens: llm.tokens,
      usadoJev: false,
      usadoLlm: true,
      saida: ExecucaoSaida.parse({
        resumo: dados.resumo ?? `Eco (LLM) preparou briefing de ${nome}.`,
        acaoSugerida: dados.acaoSugerida ?? "Abrir na reunião.",
        requerAprovacao: false,
        payload: { briefing: dados.briefing, viaLlm: true },
      }),
    };
  }

  const briefing = [
    `Briefing · ${nome}`,
    `Dor: ${dor}`,
    `Meta: ${meta}`,
    `Nota da Pergunta Matadora: ${nota}`,
    `Não repetir perguntas já respondidas ao ${cfg.claudio.nome}.`,
  ].join("\n");
  return baseRegras({
    custoTokens: tokensDe(llm),
    saida: ExecucaoSaida.parse({
      resumo: `Eco preparou briefing de ${nome}.`,
      acaoSugerida: "Abrir na reunião.",
      requerAprovacao: false,
      payload: invalido || inventou ? { briefing, llmInvalido: true } : { briefing },
    }),
  });
}

async function ember(entrada: ExecucaoEntrada): Promise<ResultadoAgente> {
  if (!temLlmKey()) {
    return baseRegras({
      custoTokens: 0,
      saida: ExecucaoSaida.parse({
        resumo: "Ember bloqueado: sem chave LLM configurada (nunca usa fallback estático).",
        acaoSugerida: "Configurar chave Anthropic para habilitar o Ember.",
        requerAprovacao: false,
        payload: {
          decisao: "ignorar",
          enviado: false,
          bloqueado: true,
          motivo: "sem_llm_configurado",
        },
      }),
    });
  }

  const ctx = entrada.contexto ?? {};
  const nome = String(ctx.nome ?? ctx.nomeContato ?? "Lead");
  const empresa = String(ctx.empresa ?? "");
  const etapa = String(ctx.etapa ?? ctx.etapaAtual ?? "conversa");
  const objetivoCampanha = String(ctx.objetivoCampanha ?? ctx.objetivo ?? "Reabrir conversa com contexto real.");
  const contextoExtraido = String(ctx.contextoExtraido ?? "");
  const baseConteudo = String(ctx.baseConteudo ?? "");
  const novidadesMercado = String(ctx.novidadesMercado ?? "");
  const tomMarca = String(ctx.tomMarca ?? "Direto, consultivo, sem intimidade forçada.");
  const proibirPreco = ctx.proibirPreco !== false;
  const temasProibidos = Array.isArray(ctx.temasProibidos) ? ctx.temasProibidos.map(String) : [];
  const modelOverride =
    typeof ctx.modeloLlm === "string" && ctx.modeloLlm.trim()
      ? ctx.modeloLlm.trim()
      : typeof ctx.modelOverride === "string" && ctx.modelOverride.trim()
        ? ctx.modelOverride.trim()
        : undefined;

  const prompt = JSON.stringify(
    {
      lead: { nome, empresa, etapa },
      objetivoCampanha,
      contextoHistorico: contextoExtraido,
      mensagens: ctx.mensagens ?? [],
      notas: ctx.notas ?? [],
      briefing: ctx.briefing ?? null,
      baseConteudoNegocio: baseConteudo,
      novidadesMercado,
      regras: {
        tomMarca,
        proibirPreco,
        temasProibidos,
      },
    },
    null,
    2,
  );

  const llm = await gerarComLlm({
    slug: "ember",
    prompt,
    modelOverride,
  });

  if (!llm) {
    return baseRegras({
      custoTokens: 0,
      saida: ExecucaoSaida.parse({
        resumo: "Ember bloqueado: falha ou resposta vazia do LLM.",
        acaoSugerida: "Verificar chave/modelo LLM antes de tentar novamente.",
        requerAprovacao: false,
        payload: {
          decisao: "ignorar",
          enviado: false,
          bloqueado: true,
          motivo: "resposta_llm_invalida",
        },
      }),
    });
  }

  const json = parseJsonDaResposta(llm.text);
  const decisao = String(json?.decisao ?? "");
  if (!json || !["abordar", "adiar", "ignorar"].includes(decisao)) {
    return baseRegras({
      custoTokens: llm.tokens,
      saida: ExecucaoSaida.parse({
        resumo: "Ember bloqueado: JSON de resposta do LLM inválido.",
        acaoSugerida: "Não enviar quando o diagnóstico do modelo é ambíguo.",
        requerAprovacao: false,
        payload: {
          decisao: "ignorar",
          enviado: false,
          bloqueado: true,
          motivo: "resposta_llm_invalida",
        },
      }),
    });
  }

  const modeloUsado = llm.modelId ?? effectiveAgentLlmModel("ember", modelOverride);
  const motivo = String(json.motivo ?? "").trim() || "Diagnóstico concluído pelo Ember.";
  const gancho = typeof json.gancho === "string" && json.gancho.trim() ? json.gancho.trim() : null;

  if (decisao === "adiar" || decisao === "ignorar") {
    return {
      custoTokens: llm.tokens,
      usadoJev: false,
      usadoLlm: true,
      saida: ExecucaoSaida.parse({
        resumo: String(json.resumo ?? `Ember decidiu ${decisao}: ${motivo}`),
        acaoSugerida: decisao === "adiar" ? "Aguardar novo sinal antes de abordar." : "Manter em silêncio.",
        requerAprovacao: false,
        payload: {
          decisao,
          enviado: false,
          bloqueado: false,
          motivo,
          gancho,
          texto: null,
          modeloUsado,
          viaLlm: true,
        },
      }),
    };
  }

  const texto = typeof json.texto === "string" ? json.texto.trim() : "";
  if (!texto) {
    return baseRegras({
      custoTokens: llm.tokens,
      saida: ExecucaoSaida.parse({
        resumo: "Ember bloqueado: decidiu abordar mas devolveu texto vazio.",
        acaoSugerida: "Descartar envio sem mensagem válida.",
        requerAprovacao: false,
        payload: {
          decisao: "ignorar",
          enviado: false,
          bloqueado: true,
          motivo: "resposta_llm_invalida",
        },
      }),
    });
  }

  if (proibirPreco && mencionaPrecoComercial(texto)) {
    return {
      custoTokens: llm.tokens,
      usadoJev: false,
      usadoLlm: true,
      saida: ExecucaoSaida.parse({
        resumo: "Ember bloqueado: abertura mencionou preço ou condição comercial.",
        acaoSugerida: "Manter abertura focada no diagnóstico, sem oferta de preço.",
        requerAprovacao: false,
        payload: {
          decisao: "ignorar",
          enviado: false,
          bloqueado: true,
          motivo: "Bloqueado: abertura menciona preço, desconto ou condição comercial.",
          codigoBloqueio: "menciona_preco",
          modeloUsado,
          viaLlm: true,
        },
      }),
    };
  }

  const posCheck = avaliarGuardrailsPosLlm(texto, { proibirPreco }, temasProibidos);
  if (!posCheck.ok) {
    return {
      custoTokens: llm.tokens,
      usadoJev: false,
      usadoLlm: true,
      saida: ExecucaoSaida.parse({
        resumo: `Ember bloqueado nos freios pós-LLM: ${posCheck.motivo}`,
        acaoSugerida: "Revisar cercas ou contexto do lead.",
        requerAprovacao: false,
        payload: {
          decisao: "ignorar",
          enviado: false,
          bloqueado: true,
          motivo: posCheck.motivo ?? "bloqueado_guardrail",
          codigoBloqueio: posCheck.codigo,
          modeloUsado,
          viaLlm: true,
        },
      }),
    };
  }

  return {
    custoTokens: llm.tokens,
    usadoJev: false,
    usadoLlm: true,
    saida: ExecucaoSaida.parse({
      resumo: String(json.resumo ?? `Ember preparou abertura para ${nome}.`),
      acaoSugerida: "Disparar primeira mensagem e entregar resposta ao atendimento.",
      requerAprovacao: false,
      payload: {
        decisao: "abordar",
        bloqueado: false,
        motivo,
        gancho,
        texto,
        modeloUsado,
        viaLlm: true,
      },
    }),
  };
}

export { cfg as agentesConfig };
