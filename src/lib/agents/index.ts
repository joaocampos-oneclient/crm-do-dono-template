import { crmConfig } from "@crm/config";
import { decidir } from "./decision-engine";
import { mencionaPreco } from "@/domain/rules";
import { avaliarGuardrailsPosLlm, mencionaPrecoComercial } from "@/domain/reciclador";
import type { AgenteSlug, ExecucaoEntrada, ResultadoAgente } from "./types";
import { ExecucaoSaida } from "./types";
import { effectiveAgentLlmModel, gerarComLlm, parseJsonDaResposta, temLlmKey } from "./llm";

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

async function claudio(entrada: ExecucaoEntrada): Promise<ResultadoAgente> {
  const rascunho = String(entrada.contexto.rascunho ?? "Oi! Posso te fazer uma pergunta rápida para te ajudar melhor?");
  if (mencionaPreco(rascunho)) {
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

  const llm = await gerarComLlm({
    slug: "claudio",
    prompt: `Rascunho do operador/robô:\n${rascunho}\n\nMelhore se preciso, sem inventar preço. Responda em JSON.`,
  });
  if (llm) {
    const json = parseJsonDaResposta(llm.text);
    if (json?.bloqueado || (typeof json?.texto === "string" && mencionaPreco(String(json.texto)))) {
      return {
        custoTokens: llm.tokens,
        usadoJev: false,
        usadoLlm: true,
        saida: ExecucaoSaida.parse({
          resumo: String(json?.resumo ?? "Bloqueado: Cláudio nunca fala preço."),
          acaoSugerida: String(json?.acaoSugerida ?? "Reescrever sem preço."),
          requerAprovacao: true,
          payload: { bloqueado: true, motivo: "preco", viaLlm: true },
        }),
      };
    }
    const texto = typeof json?.texto === "string" ? json.texto : llm.text;
    if (mencionaPreco(texto)) {
      return baseRegras({
        custoTokens: llm.tokens,
        saida: ExecucaoSaida.parse({
          resumo: "Bloqueado: Cláudio nunca fala preço (LLM).",
          acaoSugerida: "Reescrever sem preço.",
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
        resumo: String(json?.resumo ?? `${cfg.claudio.nome} (LLM) pronto para enviar.`),
        acaoSugerida: String(json?.acaoSugerida ?? "Enviar mensagem (sem preço)."),
        requerAprovacao: false,
        payload: { texto, viaLlm: true },
      }),
    };
  }

  return baseRegras({
    custoTokens: 0,
    saida: ExecucaoSaida.parse({
      resumo: `${cfg.claudio.nome} pronto para enviar.`,
      acaoSugerida: "Enviar mensagem (sem preço).",
      requerAprovacao: false,
      payload: { texto: rascunho },
    }),
  });
}

async function scout(entrada: ExecucaoEntrada): Promise<ResultadoAgente> {
  const texto = String(entrada.contexto.textoConversas ?? "");
  const minutosSilencio = Number(entrada.contexto.minutosSilencio ?? 0);
  const nota = entrada.contexto.nota == null ? null : Number(entrada.contexto.nota);
  const pediuPreco = Boolean(entrada.contexto.pediuPreco);
  const pediuHumano = Boolean(entrada.contexto.pediuHumano);

  const llm = await gerarComLlm({
    slug: "scout",
    prompt: JSON.stringify({ textoConversas: texto, minutosSilencio, nota, pediuPreco, pediuHumano }),
  });
  if (llm) {
    const json = parseJsonDaResposta(llm.text);
    const acao = String(json?.acao ?? "");
    if (["aguardar", "retomar", "handoff", "nutrir", "ignorar"].includes(acao)) {
      const payload = {
        rotulo: String(json?.rotulo ?? acao),
        confianca: Number(json?.confianca ?? 0.7),
        acao,
        porque: String(json?.porque ?? json?.acaoSugerida ?? ""),
        usadoJev: false,
        viaLlm: true,
      };
      return {
        custoTokens: llm.tokens,
        usadoJev: false,
        usadoLlm: true,
        saida: ExecucaoSaida.parse({
          resumo: String(json?.resumo ?? `Scout: ${payload.rotulo} (${payload.acao})`),
          acaoSugerida: payload.porque,
          requerAprovacao: acao === "handoff" || acao === "retomar",
          payload,
        }),
      };
    }
  }

  const d = await decidir({ textoConversas: texto, minutosSilencio, nota, pediuPreco, pediuHumano });
  return {
    custoTokens: d.usadoJev ? 1 : 0,
    usadoJev: d.usadoJev,
    usadoLlm: false,
    saida: ExecucaoSaida.parse({
      resumo: `Scout: ${d.rotulo} (${d.acao})`,
      acaoSugerida: d.porque,
      requerAprovacao: d.acao === "handoff" || d.acao === "retomar",
      payload: d,
    }),
  };
}

async function scribe(entrada: ExecucaoEntrada): Promise<ResultadoAgente> {
  const notas = String(entrada.contexto.notasReuniao ?? "Reunião sem notas.");
  const llm = await gerarComLlm({
    slug: "scribe",
    prompt: `Notas da reunião:\n${notas}`,
  });
  if (llm) {
    const json = parseJsonDaResposta(llm.text);
    const followups = Array.isArray(json?.followups)
      ? json!.followups.map(String)
      : ["Enviar resumo ao contato", "Atualizar briefing", "Agendar próximo passo"];
    return {
      custoTokens: llm.tokens,
      usadoJev: false,
      usadoLlm: true,
      saida: ExecucaoSaida.parse({
        resumo: String(json?.resumo ?? "Scribe (LLM) gerou resumo e follow-ups."),
        acaoSugerida: String(json?.acaoSugerida ?? "Criar tarefas a partir do resumo."),
        requerAprovacao: true,
        payload: { resumo: String(json?.resumo ?? llm.text.slice(0, 500)), followups, viaLlm: true },
      }),
    };
  }
  return baseRegras({
    custoTokens: 0,
    saida: ExecucaoSaida.parse({
      resumo: "Scribe gerou resumo e follow-ups.",
      acaoSugerida: "Criar tarefas a partir do resumo.",
      requerAprovacao: true,
      payload: {
        resumo: notas.slice(0, 500),
        followups: ["Enviar resumo ao contato", "Atualizar briefing", "Agendar próximo passo"],
      },
    }),
  });
}

async function ledger(entrada: ExecucaoEntrada): Promise<ResultadoAgente> {
  const logins7d = Number(entrada.contexto.logins7d ?? 0);
  const diasDesdePagamento = Number(entrada.contexto.diasDesdePagamento ?? 0);
  const risco = diasDesdePagamento <= 7 && logins7d < 2;

  const llm = await gerarComLlm({
    slug: "ledger",
    prompt: JSON.stringify({ logins7d, diasDesdePagamento }),
  });
  if (llm) {
    const json = parseJsonDaResposta(llm.text);
    const riscoLlm = typeof json?.risco === "boolean" ? json.risco : risco;
    return {
      custoTokens: llm.tokens,
      usadoJev: false,
      usadoLlm: true,
      saida: ExecucaoSaida.parse({
        resumo: String(json?.resumo ?? (riscoLlm ? "Ledger: risco de cancelamento." : "Ledger: saúde ok.")),
        acaoSugerida: String(
          json?.acaoSugerida ??
            (riscoLlm ? "Cláudio envia link de login / conteúdo novo (sem cobrar)." : "Monitorar."),
        ),
        requerAprovacao: true,
        payload: {
          risco: riscoLlm,
          logins7d,
          diasDesdePagamento,
          nuncaCobra: true,
          nuncaAutomatico: true,
          viaLlm: true,
        },
      }),
    };
  }

  return baseRegras({
    custoTokens: 0,
    saida: ExecucaoSaida.parse({
      resumo: risco ? "Ledger: risco de cancelamento (menos de 2 logins em 7 dias)." : "Ledger: saúde ok.",
      acaoSugerida: risco ? "Cláudio envia link de login / conteúdo novo (sem cobrar)." : "Monitorar.",
      requerAprovacao: true,
      payload: { risco, logins7d, diasDesdePagamento, nuncaCobra: true, nuncaAutomatico: true },
    }),
  });
}

async function pilot(entrada: ExecucaoEntrada): Promise<ResultadoAgente> {
  const horasDesdeUltima =
    entrada.contexto.horasDesdeUltimaAutomatica == null
      ? null
      : Number(entrada.contexto.horasDesdeUltimaAutomatica);
  const diasParado = Number(entrada.contexto.diasParado ?? 0);
  if (diasParado >= crmConfig.tetoAntiLoopDias) {
    return baseRegras({
      custoTokens: 0,
      saida: ExecucaoSaida.parse({
        resumo: "Pilot pausado pelo teto anti-loop.",
        acaoSugerida: "Revisar manualmente.",
        requerAprovacao: true,
        payload: { pausado: true },
      }),
    });
  }
  if (horasDesdeUltima !== null && horasDesdeUltima < crmConfig.cooldownMensagemHoras) {
    return baseRegras({
      custoTokens: 0,
      saida: ExecucaoSaida.parse({
        resumo: "Pilot em cooldown de 48h.",
        acaoSugerida: "Aguardar.",
        requerAprovacao: false,
        payload: { cooldown: true },
      }),
    });
  }
  const texto = String(
    entrada.contexto.textoFollowup ?? "Passando para retomar nosso papo. Quando fica bom pra você?",
  );
  if (mencionaPreco(texto)) {
    return baseRegras({
      custoTokens: 0,
      saida: ExecucaoSaida.parse({
        resumo: "Pilot bloqueado: texto menciona preço.",
        requerAprovacao: true,
        payload: { bloqueado: true },
      }),
    });
  }

  const llm = await gerarComLlm({
    slug: "pilot",
    prompt: JSON.stringify({ textoFollowup: texto, horasDesdeUltima, diasParado }),
  });
  if (llm) {
    const json = parseJsonDaResposta(llm.text);
    const out = typeof json?.texto === "string" ? json.texto : texto;
    if (mencionaPreco(out)) {
      return baseRegras({
        custoTokens: llm.tokens,
        saida: ExecucaoSaida.parse({
          resumo: "Pilot bloqueado: LLM mencionou preço.",
          requerAprovacao: true,
          payload: { bloqueado: true, viaLlm: true },
        }),
      });
    }
    return {
      custoTokens: llm.tokens,
      usadoJev: false,
      usadoLlm: true,
      saida: ExecucaoSaida.parse({
        resumo: String(json?.resumo ?? "Pilot: follow-up pronto (LLM)."),
        acaoSugerida: String(json?.acaoSugerida ?? "Enviar após aprovação."),
        requerAprovacao: true,
        payload: { texto: out, viaLlm: true },
      }),
    };
  }

  return baseRegras({
    custoTokens: 0,
    saida: ExecucaoSaida.parse({
      resumo: "Pilot: follow-up pronto.",
      acaoSugerida: "Enviar após aprovação.",
      requerAprovacao: true,
      payload: { texto },
    }),
  });
}

async function eco(entrada: ExecucaoEntrada): Promise<ResultadoAgente> {
  const nome = String(entrada.contexto.nome ?? "Lead");
  const dor = String(entrada.contexto.dor ?? "não informada");
  const meta = String(entrada.contexto.meta ?? "não informada");
  const nota = entrada.contexto.nota ?? "—";

  const llm = await gerarComLlm({
    slug: "eco",
    prompt: JSON.stringify({ nome, dor, meta, nota }),
  });
  if (llm) {
    const json = parseJsonDaResposta(llm.text);
    const briefing =
      typeof json?.briefing === "string"
        ? json.briefing
        : [
            `Briefing · ${nome}`,
            `Dor: ${dor}`,
            `Meta: ${meta}`,
            `Nota da Pergunta Matadora: ${nota}`,
            llm.text.slice(0, 400),
          ].join("\n");
    return {
      custoTokens: llm.tokens,
      usadoJev: false,
      usadoLlm: true,
      saida: ExecucaoSaida.parse({
        resumo: String(json?.resumo ?? `Eco (LLM) preparou briefing de ${nome}.`),
        acaoSugerida: String(json?.acaoSugerida ?? "Abrir na reunião."),
        requerAprovacao: false,
        payload: { briefing, viaLlm: true },
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
    custoTokens: 0,
    saida: ExecucaoSaida.parse({
      resumo: `Eco preparou briefing de ${nome}.`,
      acaoSugerida: "Abrir na reunião.",
      requerAprovacao: false,
      payload: { briefing },
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
