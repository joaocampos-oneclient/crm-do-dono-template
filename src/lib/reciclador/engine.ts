/**
 * Motor operacional do Agente Ember / Relance (Reciclador de Oportunidades):
 * criação/gestão de campanhas, importação CSV com contexto, simulação segura,
 * tick autônomo com freios de ritmo/horário/sessão, opt-out e parada de emergência.
 */
import { crmConfig } from "@crm/config";
import {
  avaliarGuardrailsPosLlm,
  avaliarGuardrailsPreLlm,
  calcularMetricasCampanha,
  dentroDaJanelaHorario,
  mascararTelefoneReciclador,
  parseCsvLeadsComContexto,
  temContextoMinimo,
  type CampanhaReciclador,
  type DecisaoReciclador,
  type EntradaNovaCampanha,
  type IncidenteReciclador,
  type ItemFilaReciclador,
  type MetricasCampanhaReciclador,
  type OptOutRegistro,
  type ResultadoImportacaoCsv,
  type ResultadoSimulacaoReciclador,
  type ResultadoTickReciclador,
} from "@/domain/reciclador";
import { somarDias, telefoneDigitos } from "@/domain/rules";
import { executarAgente } from "@/lib/agents";
import { effectiveAgentLlmModel, temLlmKey } from "@/lib/agents/llm-store";
import { getWhatsAppProvider, newIdempotencyKey, resolveProviderId } from "@/lib/whatsapp";
import { ingestWhatsAppMessage } from "@/lib/whatsapp/ingest";
import { effectiveApiKey, effectiveSessionId } from "@/lib/whatsapp/store";
import type { EnvioResultado } from "@/lib/whatsapp/types";
import {
  carregarLeadsCrmParaReciclador,
  carregarSnapshotReciclador,
  defaultsCampanha,
  definirEmergenciaGlobalStore,
  inserirIncidenteStore,
  inserirOptOutStore,
  upsertCampanhaStore,
  upsertItensFilaStore,
  type LeadFonteCrm,
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

function sessaoWhatsAppPronta(): boolean {
  if (resolveProviderId() === "waha") {
    return Boolean(process.env.WAHA_BASE_URL?.trim());
  }
  return Boolean(effectiveApiKey() && effectiveSessionId());
}

async function registrarIncidente(
  campanhaId: string | null,
  tipo: IncidenteReciclador["tipo"],
  detalhe: string,
  em = new Date().toISOString(),
): Promise<IncidenteReciclador> {
  const inc: IncidenteReciclador = {
    id: crypto.randomUUID(),
    campanhaId,
    tipo,
    detalhe,
    em,
  };
  await inserirIncidenteStore(inc);
  return inc;
}

function montarItensDoCrmParaCampanha(opts: {
  campanha: CampanhaReciclador;
  leadsCrm: LeadFonteCrm[];
  itensExistentes: ItemFilaReciclador[];
  optOuts: OptOutRegistro[];
  agoraIso: string;
}): ItemFilaReciclador[] {
  const { campanha, leadsCrm, itensExistentes, optOuts, agoraIso } = opts;
  const agoraMs = Date.parse(agoraIso);
  const novos: ItemFilaReciclador[] = [];

  for (const lead of leadsCrm) {
    if (lead.etapa === "pago" || lead.etapa === "dentro") continue;
    if (campanha.filtro.etapas.length > 0 && !campanha.filtro.etapas.includes(lead.etapa)) {
      continue;
    }
    if (lead.horasParado < campanha.filtro.horasParadoMin) {
      continue;
    }

    const jaNaFila = itensExistentes.some((i) => mesmoTelefone(i.telefone, lead.telefone));
    if (jaNaFila) continue;

    const emOptOut = optOuts.some((o) => {
      if (!mesmoTelefone(o.telefoneDigitos, lead.telefone)) return false;
      if (!o.expiraEm) return true;
      const exp = Date.parse(o.expiraEm);
      return Number.isNaN(exp) || exp > agoraMs;
    });
    if (emOptOut) continue;

    const ctx = temContextoMinimo({
      mensagens: campanha.fontes.usarHistoricoMensagens ? lead.mensagens : [],
      notas: campanha.fontes.usarNotas ? lead.notas : [],
      briefing: lead.briefing,
    });

    if (campanha.filtro.apenasComContexto && !ctx.ok) {
      continue;
    }

    novos.push({
      id: crypto.randomUUID(),
      campanhaId: campanha.id,
      contatoId: lead.contatoId,
      oportunidadeId: lead.oportunidadeId,
      nomeContato: lead.nome,
      empresa: lead.empresa,
      telefone: lead.telefone,
      telefoneMascarado: mascararTelefoneReciclador(lead.telefone),
      etapaInicial: lead.etapa,
      etapaAtual: lead.etapa,
      contextoExtraido: ctx.contextoExtraido,
      fontesLidas: ctx.fontesLidas,
      status: ctx.ok ? "pendente" : "ignorado",
      decisao: ctx.ok ? null : "ignorar",
      motivo: ctx.ok
        ? "Selecionado do funil do CRM aguardando diagnóstico do Ember."
        : (ctx.motivo ?? "Sem contexto mínimo — calar é mais inteligente"),
      ganchoIdentificado: null,
      mensagemGerada: null,
      modeloUsado: null,
      custoTokens: 0,
      providerWhatsapp: null,
      messageIdWhatsapp: null,
      criadoEm: agoraIso,
      processadoEm: ctx.ok ? null : agoraIso,
      respondeuEm: null,
      avancouEtapa: false,
      virouVenda: false,
    });
  }

  return novos;
}

export async function listarEstadoReciclador(): Promise<{
  campanhas: CampanhaReciclador[];
  optOuts: OptOutRegistro[];
  incidentes: IncidenteReciclador[];
  emergenciaGlobal: boolean;
  metricasPorCampanha: Record<string, MetricasCampanhaReciclador>;
}> {
  const snap = await carregarSnapshotReciclador();
  const metricasPorCampanha: Record<string, MetricasCampanhaReciclador> = {};

  for (const camp of snap.campanhas) {
    const itensCamp = snap.itens.filter((i) => i.campanhaId === camp.id);
    const incCamp = snap.incidentes.filter((inc) => inc.campanhaId === camp.id || inc.campanhaId === null);
    metricasPorCampanha[camp.id] = calcularMetricasCampanha(itensCamp, incCamp.length);
  }

  return {
    campanhas: snap.campanhas,
    optOuts: snap.optOuts,
    incidentes: snap.incidentes,
    emergenciaGlobal: snap.emergenciaGlobal || snap.campanhas.some((c) => c.status === "emergencia"),
    metricasPorCampanha,
  };
}

export async function obterDetalheCampanha(id: string): Promise<{
  campanha: CampanhaReciclador | null;
  itens: ItemFilaReciclador[];
  metricas: MetricasCampanhaReciclador;
  incidentes: IncidenteReciclador[];
}> {
  const snap = await carregarSnapshotReciclador();
  const campanha = snap.campanhas.find((c) => c.id === id) ?? null;
  const itens = snap.itens.filter((i) => i.campanhaId === id);
  const incidentes = snap.incidentes.filter((inc) => inc.campanhaId === id || inc.campanhaId === null);
  const metricas = calcularMetricasCampanha(itens, incidentes.length);
  return { campanha, itens, metricas, incidentes };
}

export async function criarCampanhaReciclador(input: EntradaNovaCampanha): Promise<{
  campanha: CampanhaReciclador;
  itens: ItemFilaReciclador[];
  metricas: MetricasCampanhaReciclador;
}> {
  const agora = new Date().toISOString();
  const defs = defaultsCampanha();

  const campanha: CampanhaReciclador = {
    id: crypto.randomUUID(),
    nome: input.nome?.trim() || "Nova Campanha Relance",
    objetivo: input.objetivo?.trim() || "Reabrir leads parados com contexto real.",
    status: "rascunho",
    filtro: { ...defs.filtro, ...(input.filtro ?? {}) },
    fontes: { ...defs.fontes, ...(input.fontes ?? {}) },
    cercas: {
      ...defs.cercas,
      modeloLlm: effectiveAgentLlmModel("ember", input.cercas?.modeloLlm),
      ...(input.cercas ?? {}),
    },
    freios: { ...defs.freios, ...(input.freios ?? {}) },
    criadaEm: agora,
    atualizadaEm: agora,
  };

  await upsertCampanhaStore(campanha);

  let itens: ItemFilaReciclador[] = [];
  if (input.popularDoCrm !== false) {
    const [leadsCrm, snap] = await Promise.all([
      carregarLeadsCrmParaReciclador(agora),
      carregarSnapshotReciclador(),
    ]);
    itens = montarItensDoCrmParaCampanha({
      campanha,
      leadsCrm,
      itensExistentes: [],
      optOuts: snap.optOuts,
      agoraIso: agora,
    });
    await upsertItensFilaStore(itens);
  }

  return {
    campanha,
    itens,
    metricas: calcularMetricasCampanha(itens, 0),
  };
}

export type PatchCampanhaReciclador = Partial<CampanhaReciclador> & {
  acao?: "ativar" | "pausar" | "emergencia" | "retomar_emergencia" | "sincronizar_crm";
};

export async function atualizarCampanhaReciclador(
  id: string,
  patch: PatchCampanhaReciclador,
): Promise<{
  campanha: CampanhaReciclador | null;
  itens: ItemFilaReciclador[];
  metricas: MetricasCampanhaReciclador;
  incidentes: IncidenteReciclador[];
}> {
  const snap = await carregarSnapshotReciclador();
  const atual = snap.campanhas.find((c) => c.id === id);
  if (!atual) {
    return obterDetalheCampanha(id);
  }

  const agora = new Date().toISOString();
  let novoStatus = patch.status ?? atual.status;

  if (patch.acao === "ativar") {
    novoStatus = "ativa";
    await definirEmergenciaGlobalStore(false);
  } else if (patch.acao === "pausar") {
    novoStatus = "pausada";
  } else if (patch.acao === "emergencia") {
    novoStatus = "emergencia";
    await registrarIncidente(id, "parada_emergencia", `Parada de emergência acionada na campanha "${atual.nome}".`, agora);
  } else if (patch.acao === "retomar_emergencia") {
    novoStatus = "pausada";
    await definirEmergenciaGlobalStore(false);
  }

  const atualizada: CampanhaReciclador = {
    ...atual,
    nome: patch.nome !== undefined ? patch.nome.trim() || atual.nome : atual.nome,
    objetivo: patch.objetivo !== undefined ? patch.objetivo.trim() : atual.objetivo,
    status: novoStatus,
    filtro: patch.filtro ? { ...atual.filtro, ...patch.filtro } : atual.filtro,
    fontes: patch.fontes ? { ...atual.fontes, ...patch.fontes } : atual.fontes,
    cercas: patch.cercas ? { ...atual.cercas, ...patch.cercas } : atual.cercas,
    freios: patch.freios ? { ...atual.freios, ...patch.freios } : atual.freios,
    atualizadaEm: agora,
  };

  await upsertCampanhaStore(atualizada);

  if (patch.acao === "sincronizar_crm") {
    const leadsCrm = await carregarLeadsCrmParaReciclador(agora);
    const existentes = snap.itens.filter((i) => i.campanhaId === id);
    const novos = montarItensDoCrmParaCampanha({
      campanha: atualizada,
      leadsCrm,
      itensExistentes: existentes,
      optOuts: snap.optOuts,
      agoraIso: agora,
    });
    if (novos.length > 0) {
      await upsertItensFilaStore(novos);
    }
  }

  return obterDetalheCampanha(id);
}

export async function acionarParadaEmergenciaGlobal(motivo?: string): Promise<{
  pausadas: number;
  incidente: IncidenteReciclador;
}> {
  const agora = new Date().toISOString();
  const snap = await carregarSnapshotReciclador();
  await definirEmergenciaGlobalStore(true);

  let pausadas = 0;
  for (const camp of snap.campanhas) {
    if (camp.status === "ativa") {
      await upsertCampanhaStore({
        ...camp,
        status: "emergencia",
        atualizadaEm: agora,
      });
      pausadas++;
    }
  }

  const incidente = await registrarIncidente(
    null,
    "parada_emergencia",
    motivo?.trim() || "Parada de emergência global acionada pelo operador.",
    agora,
  );

  return { pausadas, incidente };
}

export async function registrarOptOutReciclador(input: {
  telefone: string;
  contatoId?: string;
  nomeContato?: string;
  motivo?: OptOutRegistro["motivo"];
  evidencia?: string;
  tema?: string;
  diasExpiracao?: number;
}): Promise<{ optOut: OptOutRegistro; itensBloqueados: number }> {
  const agora = new Date().toISOString();
  const digitos = telefoneDigitos(input.telefone);
  const motivo = input.motivo ?? "pedido_parar";
  const expiraEm =
    motivo === "recusa_recente"
      ? somarDias(agora, input.diasExpiracao ?? 30)
      : input.diasExpiracao
        ? somarDias(agora, input.diasExpiracao)
        : null;

  const optOut: OptOutRegistro = {
    id: crypto.randomUUID(),
    telefoneDigitos: digitos,
    telefoneMascarado: mascararTelefoneReciclador(input.telefone),
    contatoId: input.contatoId ?? null,
    nomeContato: input.nomeContato ?? null,
    motivo,
    evidencia: input.evidencia?.trim() || "Opt-out registrado.",
    tema: input.tema ?? null,
    registradoEm: agora,
    expiraEm,
  };

  await inserirOptOutStore(optOut);

  const snap = await carregarSnapshotReciclador();
  const bloqueados: ItemFilaReciclador[] = [];
  for (const item of snap.itens) {
    if (
      mesmoTelefone(item.telefone, digitos) &&
      (item.status === "pendente" || item.status === "simulado" || item.status === "adiado")
    ) {
      bloqueados.push({
        ...item,
        status: "bloqueado",
        decisao: "ignorar",
        motivo:
          motivo === "recusa_recente"
            ? "Bloqueado por recusa recente registrada."
            : "Bloqueado imediatamente por pedido de opt-out / não contato.",
        processadoEm: agora,
      });
    }
  }

  if (bloqueados.length > 0) {
    await upsertItensFilaStore(bloqueados);
  }

  return { optOut, itensBloqueados: bloqueados.length };
}

export async function importarCsvNaCampanha(
  campanhaId: string,
  csvText: string,
): Promise<ResultadoImportacaoCsv> {
  const snap = await carregarSnapshotReciclador();
  const campanha = snap.campanhas.find((c) => c.id === campanhaId);
  if (!campanha) {
    throw new Error("Campanha não encontrada para importação.");
  }

  const agora = new Date().toISOString();
  const agoraMs = Date.parse(agora);
  const parsed = parseCsvLeadsComContexto(csvText);

  let rejeitadosSemContexto = 0;
  let rejeitadosTelefoneInvalido = 0;
  let rejeitadosOptOut = 0;

  const detalhesRejeicao: Array<{ linha: number; nome: string; motivo: string }> = [];
  for (const r of parsed.rejeitadas) {
    if (r.tipo === "sem_contexto") rejeitadosSemContexto++;
    else rejeitadosTelefoneInvalido++;
    detalhesRejeicao.push({ linha: r.linha, nome: r.nome, motivo: r.motivo });
  }

  const existentesCampanha = snap.itens.filter((i) => i.campanhaId === campanhaId);
  const novosItens: ItemFilaReciclador[] = [];
  const telefonesAdicionadosNestaCarga = new Set<string>();

  for (const linha of parsed.aceitas) {
    const emOptOut = snap.optOuts.some((o) => {
      if (!mesmoTelefone(o.telefoneDigitos, linha.telefoneDigitos)) return false;
      if (!o.expiraEm) return true;
      const exp = Date.parse(o.expiraEm);
      return Number.isNaN(exp) || exp > agoraMs;
    });

    if (emOptOut) {
      rejeitadosOptOut++;
      detalhesRejeicao.push({
        linha: linha.linha,
        nome: linha.nome,
        motivo: "Contato na lista de opt-out / não contatar.",
      });
      continue;
    }

    if (
      telefonesAdicionadosNestaCarga.has(linha.telefoneDigitos) ||
      existentesCampanha.some((i) => mesmoTelefone(i.telefone, linha.telefoneDigitos))
    ) {
      detalhesRejeicao.push({
        linha: linha.linha,
        nome: linha.nome,
        motivo: "Telefone já presente na fila desta campanha.",
      });
      continue;
    }

    telefonesAdicionadosNestaCarga.add(linha.telefoneDigitos);
    novosItens.push({
      id: crypto.randomUUID(),
      campanhaId,
      contatoId: `csv-${linha.telefoneDigitos}`,
      oportunidadeId: null,
      nomeContato: linha.nome,
      empresa: linha.empresa,
      telefone: linha.telefone,
      telefoneMascarado: mascararTelefoneReciclador(linha.telefone),
      etapaInicial: linha.etapa,
      etapaAtual: linha.etapa,
      contextoExtraido: linha.contextoCombinado,
      fontesLidas: ["csv_importado"],
      status: "pendente",
      decisao: null,
      motivo: "Importado via CSV com contexto · aguardando diagnóstico.",
      ganchoIdentificado: null,
      mensagemGerada: null,
      modeloUsado: null,
      custoTokens: 0,
      providerWhatsapp: null,
      messageIdWhatsapp: null,
      criadoEm: agora,
      processadoEm: null,
      respondeuEm: null,
      avancouEtapa: false,
      virouVenda: false,
    });
  }

  if (novosItens.length > 0) {
    await upsertItensFilaStore(novosItens);
    await upsertCampanhaStore({ ...campanha, atualizadaEm: agora });
  }

  return {
    totalLinhas: parsed.totalLinhas,
    importados: novosItens.length,
    rejeitadosSemContexto,
    rejeitadosTelefoneInvalido,
    rejeitadosOptOut,
    itensCriadosIds: novosItens.map((i) => i.id),
    detalhesRejeicao,
  };
}

export async function simularCampanhaReciclador(
  campanhaId: string,
  limite = 3,
): Promise<ResultadoSimulacaoReciclador> {
  const agora = new Date().toISOString();
  const [snap, leadsCrm] = await Promise.all([
    carregarSnapshotReciclador(),
    carregarLeadsCrmParaReciclador(agora),
  ]);

  const campanha = snap.campanhas.find((c) => c.id === campanhaId);
  if (!campanha) {
    throw new Error("Campanha não encontrada para simulação.");
  }

  const itensCampanha = snap.itens.filter((i) => i.campanhaId === campanhaId);
  const candidatos = itensCampanha
    .filter((i) => i.status === "pendente" || i.status === "simulado")
    .slice(0, Math.max(1, limite));

  const chaveConfigurada = temLlmKey();
  let avisoLlm: string | null = null;
  const atualizados: ItemFilaReciclador[] = [];

  for (const item of candidatos) {
    const leadCrm = leadsCrm.find(
      (l) => l.contatoId === item.contatoId || mesmoTelefone(l.telefone, item.telefone),
    );
    const jaAbordado = itensCampanha.some(
      (outro) => outro.id !== item.id && outro.status === "enviado" && mesmoTelefone(outro.telefone, item.telefone),
    );

    const pre = avaliarGuardrailsPreLlm({
      agoraIso: agora,
      campanhaStatus: campanha.status === "emergencia" ? "emergencia" : undefined,
      emergenciaGlobal: snap.emergenciaGlobal,
      telefone: item.telefone,
      etapaAtual: leadCrm?.etapa ?? item.etapaAtual,
      jaAbordadoNaCampanha: jaAbordado,
      optOuts: snap.optOuts,
      mensagens: campanha.fontes.usarHistoricoMensagens ? (leadCrm?.mensagens ?? []) : [],
      notas: campanha.fontes.usarNotas ? (leadCrm?.notas ?? []) : [],
      briefing: leadCrm?.briefing ?? null,
      contextoImportado: item.fontesLidas.includes("csv_importado") ? item.contextoExtraido : undefined,
      cooldownRecusaDias: campanha.freios.cooldownRecusaDias,
      cooldownHorasAutomatica: crmConfig.cooldownMensagemHoras,
    });

    if (!pre.ok) {
      atualizados.push({
        ...item,
        status: pre.codigo === "sem_contexto" ? "ignorado" : "bloqueado",
        decisao: "ignorar",
        motivo: pre.motivo ?? "Bloqueado nos guardrails pré-LLM.",
        mensagemGerada: null,
        processadoEm: agora,
      });
      continue;
    }

    if (!chaveConfigurada) {
      avisoLlm =
        "Chave Anthropic não configurada. O Ember nunca usa mensagem genérica de fallback — configure a chave LLM em Agentes antes de ativar o envio real.";
      atualizados.push({
        ...item,
        contextoExtraido: pre.contextoExtraido || item.contextoExtraido,
        fontesLidas: pre.fontesLidas.length > 0 ? pre.fontesLidas : item.fontesLidas,
        status: "simulado",
        decisao: "adiar",
        motivo: "Elegível nos guardrails · configure chave LLM para o Ember redigir a abertura real.",
        ganchoIdentificado: (pre.contextoExtraido || item.contextoExtraido).slice(0, 160),
        mensagemGerada: null,
        modeloUsado: null,
        processadoEm: agora,
      });
      continue;
    }

    const resAgente = await executarAgente("ember", {
      contatoId: item.contatoId,
      oportunidadeId: item.oportunidadeId ?? undefined,
      contexto: {
        nome: item.nomeContato,
        empresa: item.empresa,
        etapa: leadCrm?.etapa ?? item.etapaAtual,
        objetivoCampanha: campanha.objetivo,
        contextoExtraido: pre.contextoExtraido || item.contextoExtraido,
        mensagens: campanha.fontes.usarHistoricoMensagens ? (leadCrm?.mensagens ?? []) : [],
        notas: campanha.fontes.usarNotas ? (leadCrm?.notas ?? []) : [],
        briefing: leadCrm?.briefing ?? null,
        baseConteudo: campanha.fontes.baseConteudo,
        novidadesMercado: campanha.fontes.novidadesMercado,
        tomMarca: campanha.cercas.tomMarca,
        proibirPreco: campanha.cercas.proibirPreco,
        temasProibidos: campanha.fontes.temasProibidos,
        modeloLlm: campanha.cercas.modeloLlm,
      },
    });

    const payload = resAgente.saida.payload;
    const decisao = (payload.decisao as DecisaoReciclador | undefined) ?? "ignorar";
    const motivo = String(payload.motivo ?? resAgente.saida.resumo);
    const modeloUsado = typeof payload.modeloUsado === "string" ? payload.modeloUsado : null;

    if (payload.bloqueado) {
      atualizados.push({
        ...item,
        contextoExtraido: pre.contextoExtraido || item.contextoExtraido,
        fontesLidas: pre.fontesLidas.length > 0 ? pre.fontesLidas : item.fontesLidas,
        status: "bloqueado",
        decisao: "ignorar",
        motivo,
        ganchoIdentificado: null,
        mensagemGerada: null,
        modeloUsado,
        custoTokens: item.custoTokens + resAgente.custoTokens,
        processadoEm: agora,
      });
      continue;
    }

    if (decisao === "ignorar" || decisao === "adiar") {
      atualizados.push({
        ...item,
        contextoExtraido: pre.contextoExtraido || item.contextoExtraido,
        fontesLidas: pre.fontesLidas.length > 0 ? pre.fontesLidas : item.fontesLidas,
        status: decisao === "ignorar" ? "ignorado" : "adiado",
        decisao,
        motivo,
        ganchoIdentificado: typeof payload.gancho === "string" ? payload.gancho : null,
        mensagemGerada: null,
        modeloUsado,
        custoTokens: item.custoTokens + resAgente.custoTokens,
        processadoEm: agora,
      });
      continue;
    }

    atualizados.push({
      ...item,
      contextoExtraido: pre.contextoExtraido || item.contextoExtraido,
      fontesLidas: pre.fontesLidas.length > 0 ? pre.fontesLidas : item.fontesLidas,
      status: "simulado",
      decisao: "abordar",
      motivo,
      ganchoIdentificado: typeof payload.gancho === "string" ? payload.gancho : null,
      mensagemGerada: typeof payload.texto === "string" ? payload.texto : null,
      modeloUsado,
      custoTokens: item.custoTokens + resAgente.custoTokens,
      processadoEm: agora,
    });
  }

  if (atualizados.length > 0) {
    await upsertItensFilaStore(atualizados);
    await upsertCampanhaStore({ ...campanha, atualizadaEm: agora });
  }

  return {
    campanhaId,
    processados: atualizados.length,
    itens: atualizados,
    avisoLlm,
  };
}

export interface OpcoesTickReciclador {
  campanhaId?: string;
  limite?: number;
  agoraIso?: string;
  ignorarJanela?: boolean;
  /** Injeção de transporte WhatsApp para testes unitários determinísticos. */
  sendFn?: (args: {
    sessionId: string;
    to: string;
    text: string;
    idempotencyKey: string;
  }) => Promise<EnvioResultado>;
}

export async function executarTickReciclador(
  opts: OpcoesTickReciclador = {},
): Promise<ResultadoTickReciclador> {
  const agora = opts.agoraIso ?? new Date().toISOString();
  const agoraMs = Date.parse(agora);
  const limite = Math.max(1, opts.limite ?? 5);

  const snap = await carregarSnapshotReciclador();

  if (snap.emergenciaGlobal) {
    return {
      executadoEm: agora,
      campanhasAvaliadas: 0,
      enviados: 0,
      ignorados: 0,
      adiados: 0,
      bloqueados: 0,
      erros: 0,
      pausadaPorIncidente: true,
      motivoPausa: "Parada de emergência global ativa.",
      itensProcessados: [],
    };
  }

  const campanhasAtivas = snap.campanhas.filter(
    (c) => c.status === "ativa" && (!opts.campanhaId || c.id === opts.campanhaId),
  );

  if (campanhasAtivas.length === 0) {
    return {
      executadoEm: agora,
      campanhasAvaliadas: 0,
      enviados: 0,
      ignorados: 0,
      adiados: 0,
      bloqueados: 0,
      erros: 0,
      pausadaPorIncidente: false,
      itensProcessados: [],
    };
  }

  if (!temLlmKey()) {
    await registrarIncidente(
      campanhasAtivas[0].id,
      "sem_llm",
      "Tick abortado: chave LLM ausente. O Ember nunca envia mensagens sem modelo real.",
      agora,
    );
    return {
      executadoEm: agora,
      campanhasAvaliadas: campanhasAtivas.length,
      enviados: 0,
      ignorados: 0,
      adiados: 0,
      bloqueados: 0,
      erros: 0,
      pausadaPorIncidente: false,
      motivoPausa: "Chave LLM não configurada.",
      itensProcessados: [],
    };
  }

  const leadsCrm = await carregarLeadsCrmParaReciclador(agora);

  let enviados = 0;
  let ignorados = 0;
  let adiados = 0;
  let bloqueados = 0;
  let erros = 0;
  let pausadaPorIncidente = false;
  let motivoPausa: string | undefined;
  const itensProcessados: ItemFilaReciclador[] = [];

  for (const campanha of campanhasAtivas) {
    if (!opts.ignorarJanela) {
      const janela = dentroDaJanelaHorario(agora, campanha.freios);
      if (!janela.ok) {
        motivoPausa = janela.motivo;
        continue;
      }
    }

    const whatsappConectado = Boolean(opts.sendFn) || sessaoWhatsAppPronta();
    if (!whatsappConectado) {
      await upsertCampanhaStore({
        ...campanha,
        status: "pausada",
        atualizadaEm: agora,
      });
      await registrarIncidente(
        campanha.id,
        "sessao_desconectada",
        "Sessão WhatsApp ausente ou desconectada ao rodar campanha ativa — campanha pausada automaticamente.",
        agora,
      );
      pausadaPorIncidente = true;
      motivoPausa = "Sessão WhatsApp desconectada — campanha pausada automaticamente.";
      continue;
    }

    const itensCampanha = snap.itens.filter((i) => i.campanhaId === campanha.id);
    const enviadosCampanha = itensCampanha.filter((i) => i.status === "enviado" && i.processadoEm);

    let enviadosUltimaHora = enviadosCampanha.filter((i) => {
      const t = Date.parse(i.processadoEm!);
      return !Number.isNaN(t) && agoraMs - t >= 0 && agoraMs - t < 3_600_000;
    }).length;

    let enviadosUltimas24h = enviadosCampanha.filter((i) => {
      const t = Date.parse(i.processadoEm!);
      return !Number.isNaN(t) && agoraMs - t >= 0 && agoraMs - t < 86_400_000;
    }).length;

    let ultimoEnvioMs = enviadosCampanha.reduce<number | null>((acc, i) => {
      const t = Date.parse(i.processadoEm!);
      if (Number.isNaN(t)) return acc;
      return acc === null || t > acc ? t : acc;
    }, null);

    if (enviadosUltimaHora >= campanha.freios.maxPorHora) {
      motivoPausa = `Teto por hora atingido (${campanha.freios.maxPorHora}/h).`;
      continue;
    }
    if (enviadosUltimas24h >= campanha.freios.maxPorDia) {
      motivoPausa = `Teto diário atingido (${campanha.freios.maxPorDia}/dia).`;
      continue;
    }
    if (
      ultimoEnvioMs !== null &&
      agoraMs - ultimoEnvioMs >= 0 &&
      agoraMs - ultimoEnvioMs < campanha.freios.espacamentoSegundos * 1000
    ) {
      motivoPausa = `Aguardando espaçamento mínimo de ${campanha.freios.espacamentoSegundos}s entre envios.`;
      continue;
    }

    const candidatos = itensCampanha.filter(
      (i) => i.status === "pendente" || i.status === "simulado",
    );

    let avaliadosNestaCampanha = 0;
    for (const item of candidatos) {
      if (avaliadosNestaCampanha >= limite) break;

      if (enviadosUltimaHora >= campanha.freios.maxPorHora) {
        motivoPausa = `Teto por hora atingido (${campanha.freios.maxPorHora}/h).`;
        break;
      }
      if (enviadosUltimas24h >= campanha.freios.maxPorDia) {
        motivoPausa = `Teto diário atingido (${campanha.freios.maxPorDia}/dia).`;
        break;
      }
      if (
        ultimoEnvioMs !== null &&
        agoraMs - ultimoEnvioMs >= 0 &&
        agoraMs - ultimoEnvioMs < campanha.freios.espacamentoSegundos * 1000
      ) {
        motivoPausa = `Espaçamento de ${campanha.freios.espacamentoSegundos}s aplicado após envio.`;
        break;
      }

      avaliadosNestaCampanha++;

      const leadCrm = leadsCrm.find(
        (l) => l.contatoId === item.contatoId || mesmoTelefone(l.telefone, item.telefone),
      );
      const jaAbordado =
        itensCampanha.some(
          (outro) =>
            outro.id !== item.id &&
            outro.status === "enviado" &&
            mesmoTelefone(outro.telefone, item.telefone),
        ) ||
        itensProcessados.some(
          (outro) => outro.status === "enviado" && mesmoTelefone(outro.telefone, item.telefone),
        );

      const pre = avaliarGuardrailsPreLlm({
        agoraIso: agora,
        campanhaStatus: campanha.status,
        emergenciaGlobal: snap.emergenciaGlobal,
        telefone: item.telefone,
        etapaAtual: leadCrm?.etapa ?? item.etapaAtual,
        jaAbordadoNaCampanha: jaAbordado,
        optOuts: snap.optOuts,
        mensagens: campanha.fontes.usarHistoricoMensagens ? (leadCrm?.mensagens ?? []) : [],
        notas: campanha.fontes.usarNotas ? (leadCrm?.notas ?? []) : [],
        briefing: leadCrm?.briefing ?? null,
        contextoImportado: item.fontesLidas.includes("csv_importado") ? item.contextoExtraido : undefined,
        cooldownRecusaDias: campanha.freios.cooldownRecusaDias,
        cooldownHorasAutomatica: crmConfig.cooldownMensagemHoras,
      });

      if (!pre.ok) {
        const ehIgnorado = pre.codigo === "sem_contexto";
        const atualizado: ItemFilaReciclador = {
          ...item,
          status: ehIgnorado ? "ignorado" : "bloqueado",
          decisao: "ignorar",
          motivo: pre.motivo ?? "Bloqueado pelos guardrails pré-LLM.",
          processadoEm: agora,
        };
        await upsertItensFilaStore([atualizado]);
        itensProcessados.push(atualizado);
        if (ehIgnorado) ignorados++;
        else bloqueados++;
        continue;
      }

      const resAgente = await executarAgente("ember", {
        contatoId: item.contatoId,
        oportunidadeId: item.oportunidadeId ?? undefined,
        contexto: {
          nome: item.nomeContato,
          empresa: item.empresa,
          etapa: leadCrm?.etapa ?? item.etapaAtual,
          objetivoCampanha: campanha.objetivo,
          contextoExtraido: pre.contextoExtraido || item.contextoExtraido,
          mensagens: campanha.fontes.usarHistoricoMensagens ? (leadCrm?.mensagens ?? []) : [],
          notas: campanha.fontes.usarNotas ? (leadCrm?.notas ?? []) : [],
          briefing: leadCrm?.briefing ?? null,
          baseConteudo: campanha.fontes.baseConteudo,
          novidadesMercado: campanha.fontes.novidadesMercado,
          tomMarca: campanha.cercas.tomMarca,
          proibirPreco: campanha.cercas.proibirPreco,
          temasProibidos: campanha.fontes.temasProibidos,
          modeloLlm: campanha.cercas.modeloLlm,
        },
      });

      const payload = resAgente.saida.payload;
      const decisao = (payload.decisao as DecisaoReciclador | undefined) ?? "ignorar";
      const motivo = String(payload.motivo ?? resAgente.saida.resumo);
      const modeloUsado = typeof payload.modeloUsado === "string" ? payload.modeloUsado : null;

      if (payload.bloqueado) {
        const atualizado: ItemFilaReciclador = {
          ...item,
          contextoExtraido: pre.contextoExtraido || item.contextoExtraido,
          fontesLidas: pre.fontesLidas.length > 0 ? pre.fontesLidas : item.fontesLidas,
          status: "bloqueado",
          decisao: "ignorar",
          motivo,
          modeloUsado,
          custoTokens: item.custoTokens + resAgente.custoTokens,
          processadoEm: agora,
        };
        await upsertItensFilaStore([atualizado]);
        itensProcessados.push(atualizado);
        bloqueados++;
        continue;
      }

      if (decisao === "ignorar" || decisao === "adiar") {
        const atualizado: ItemFilaReciclador = {
          ...item,
          contextoExtraido: pre.contextoExtraido || item.contextoExtraido,
          fontesLidas: pre.fontesLidas.length > 0 ? pre.fontesLidas : item.fontesLidas,
          status: decisao === "ignorar" ? "ignorado" : "adiado",
          decisao,
          motivo,
          ganchoIdentificado: typeof payload.gancho === "string" ? payload.gancho : null,
          modeloUsado,
          custoTokens: item.custoTokens + resAgente.custoTokens,
          processadoEm: agora,
        };
        await upsertItensFilaStore([atualizado]);
        itensProcessados.push(atualizado);
        if (decisao === "ignorar") ignorados++;
        else adiados++;
        continue;
      }

      const textoAbertura = typeof payload.texto === "string" ? payload.texto.trim() : "";
      const pos = avaliarGuardrailsPosLlm(
        textoAbertura,
        campanha.cercas,
        campanha.fontes.temasProibidos,
      );
      if (!pos.ok) {
        const atualizado: ItemFilaReciclador = {
          ...item,
          status: "bloqueado",
          decisao: "ignorar",
          motivo: pos.motivo ?? "Bloqueado nos guardrails pós-LLM.",
          modeloUsado,
          custoTokens: item.custoTokens + resAgente.custoTokens,
          processadoEm: agora,
        };
        await upsertItensFilaStore([atualizado]);
        itensProcessados.push(atualizado);
        bloqueados++;
        continue;
      }

      const sessionId = effectiveSessionId() ?? "default";
      const providerId = resolveProviderId();
      const sendFn =
        opts.sendFn ??
        ((args: { sessionId: string; to: string; text: string; idempotencyKey: string }) =>
          getWhatsAppProvider().sendText(args));

      let envio: EnvioResultado;
      try {
        envio = await sendFn({
          sessionId,
          to: telefoneDigitos(item.telefone),
          text: textoAbertura,
          idempotencyKey: newIdempotencyKey(),
        });
      } catch (e) {
        envio = {
          ok: false,
          erro: e instanceof Error ? e.message : "Falha inesperada no provedor WhatsApp.",
        };
      }

      if (!envio.ok) {
        const tipoIncidente: IncidenteReciclador["tipo"] =
          envio.retryAfterSec || /429|rate|limit/i.test(envio.erro)
            ? "rate_limit"
            : /desconect|disconnect|logged_out|banned|revoked|sess[aã]o/i.test(envio.erro)
              ? "sessao_desconectada"
              : "erro_envio";

        const atualizadoErro: ItemFilaReciclador = {
          ...item,
          contextoExtraido: pre.contextoExtraido || item.contextoExtraido,
          fontesLidas: pre.fontesLidas.length > 0 ? pre.fontesLidas : item.fontesLidas,
          status: "erro",
          decisao: "abordar",
          motivo: `Falha no envio WhatsApp: ${envio.erro}`,
          ganchoIdentificado: typeof payload.gancho === "string" ? payload.gancho : null,
          mensagemGerada: textoAbertura,
          modeloUsado,
          custoTokens: item.custoTokens + resAgente.custoTokens,
          providerWhatsapp: providerId,
          processadoEm: agora,
        };

        await upsertItensFilaStore([atualizadoErro]);
        await upsertCampanhaStore({
          ...campanha,
          status: "pausada",
          atualizadaEm: agora,
        });
        await registrarIncidente(
          campanha.id,
          tipoIncidente,
          `Campanha pausada automaticamente após falha no envio (${item.nomeContato}): ${envio.erro}`,
          agora,
        );

        itensProcessados.push(atualizadoErro);
        erros++;
        pausadaPorIncidente = true;
        motivoPausa = envio.erro;
        break;
      }

      const enviadoItem: ItemFilaReciclador = {
        ...item,
        contextoExtraido: pre.contextoExtraido || item.contextoExtraido,
        fontesLidas: pre.fontesLidas.length > 0 ? pre.fontesLidas : item.fontesLidas,
        status: "enviado",
        decisao: "abordar",
        motivo,
        ganchoIdentificado: typeof payload.gancho === "string" ? payload.gancho : null,
        mensagemGerada: textoAbertura,
        modeloUsado,
        custoTokens: item.custoTokens + resAgente.custoTokens,
        providerWhatsapp: providerId,
        messageIdWhatsapp: envio.id,
        processadoEm: agora,
      };

      await upsertItensFilaStore([enviadoItem]);
      itensProcessados.push(enviadoItem);
      enviados++;
      enviadosUltimaHora++;
      enviadosUltimas24h++;
      ultimoEnvioMs = agoraMs;

      try {
        await ingestWhatsAppMessage({
          type: "message.sent",
          eventId: `ember_sent_${enviadoItem.id}`,
          sessionId,
          timestamp: agora,
          data: {
            id: envio.id,
            to: telefoneDigitos(item.telefone),
            text: textoAbertura,
            status: "sent",
          },
        });
      } catch (e) {
        console.warn("[reciclador/tick] falha ao registrar message.sent local/sb:", e);
      }
    }
  }

  return {
    executadoEm: agora,
    campanhasAvaliadas: campanhasAtivas.length,
    enviados,
    ignorados,
    adiados,
    bloqueados,
    erros,
    pausadaPorIncidente,
    ...(motivoPausa ? { motivoPausa } : {}),
    itensProcessados,
  };
}
