/**
 * Persistência dual do Agente Ember / Relance (Reciclador de Oportunidades):
 * - Supabase (`crm_reciclador_*`) quando `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` existem;
 * - Arquivo local JSON (`data/reciclador.json` ou `RECICLADOR_DATA_FILE`) em modo demo/local/testes.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { estadoExemplo } from "@/data/exemplo";
import {
  mascararTelefoneReciclador,
  temContextoMinimo,
  type CampanhaReciclador,
  type CercasCampanhaReciclador,
  type FiltroCampanhaReciclador,
  type FontesCampanhaReciclador,
  type FreiosCampanhaReciclador,
  type IncidenteReciclador,
  type ItemFilaReciclador,
  type OptOutRegistro,
} from "@/domain/reciclador";
import { minutosEntre, oportunidadePrincipal, telefoneDigitos } from "@/domain/rules";
import type { EtapaId } from "@/domain/types";
import { effectiveAgentLlmModel } from "@/lib/agents/llm-store";
import { listLocalMessages } from "@/lib/whatsapp/ingest";

export interface RecicladorSnapshot {
  emergenciaGlobal: boolean;
  campanhas: CampanhaReciclador[];
  itens: ItemFilaReciclador[];
  optOuts: OptOutRegistro[];
  incidentes: IncidenteReciclador[];
}

export interface LeadFonteCrm {
  contatoId: string;
  oportunidadeId: string | null;
  nome: string;
  empresa: string;
  telefone: string;
  etapa: EtapaId;
  horasParado: number;
  mensagens: Array<{ autor: string; texto: string; em?: string }>;
  notas: string[];
  briefing: { dor?: string; meta?: string } | null;
}

export function recicladorDataFile(): string {
  return process.env.RECICLADOR_DATA_FILE?.trim() || resolve(process.cwd(), "data/reciclador.json");
}

export function existeArquivoRecicladorLocal(): boolean {
  return existsSync(recicladorDataFile());
}

export function temSupabaseReciclador(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function withSupabaseAdmin<T>(fn: (sb: any) => Promise<T>): Promise<T | null> {
  if (!temSupabaseReciclador()) return null;
  try {
    const { createServiceClient } = await import("@/lib/supabase/server");
    const sb = createServiceClient();
    return await fn(sb);
  } catch (e) {
    console.warn("[reciclador/store] fallback local:", e instanceof Error ? e.message : e);
    return null;
  }
}

export function defaultsCampanha(): {
  filtro: FiltroCampanhaReciclador;
  fontes: FontesCampanhaReciclador;
  cercas: CercasCampanhaReciclador;
  freios: FreiosCampanhaReciclador;
} {
  return {
    filtro: {
      etapas: ["conversa", "handoff", "briefing", "proposta", "oferta"],
      horasParadoMin: 48,
      apenasComContexto: true,
    },
    fontes: {
      usarHistoricoMensagens: true,
      usarNotas: true,
      baseConteudo:
        "Playbook prático de organização comercial no WhatsApp: triagem com pergunta matadora, follow-up sem pressão e handoff no momento certo.",
      novidadesMercado: "",
      temasProibidos: [],
    },
    cercas: {
      proibirPreco: true,
      tomMarca: "Consultivo, direto, humano, zero intimidade falsa e zero clichê de vendedor.",
      modeloLlm: effectiveAgentLlmModel("ember"),
      entregarPara: "claudio",
      autoResponderClaudio: true,
    },
    freios: {
      maxPorHora: 8,
      maxPorDia: 30,
      espacamentoSegundos: 120,
      janelaInicioHora: 9,
      janelaFimHora: 18,
      apenasDiasUteis: true,
      cooldownRecusaDias: 30,
    },
  };
}

function extrairLeadsDoEstadoExemplo(agoraIso: string): LeadFonteCrm[] {
  const crm = estadoExemplo(agoraIso);
  const localWa = listLocalMessages();

  return crm.contatos.map((c) => {
    const ops = crm.oportunidades.filter((o) => o.contatoId === c.id);
    const op = oportunidadePrincipal(ops);
    const etapa: EtapaId = op ? (op.perdida ? "perdido" : op.etapa) : "novo";
    const refIso = op?.entrouNaEtapaEm ?? c.criadoEm;
    const horasParado = Math.round(minutosEntre(refIso, agoraIso) / 60);

    const msgsCrm = crm.mensagens
      .filter((m) => m.contatoId === c.id && !m.aviso)
      .map((m) => ({ autor: m.autor, texto: m.texto, em: m.em }));

    const digitosCrm = telefoneDigitos(c.telefone);
    const msgsWa = localWa
      .filter((m) => {
        if (m.contatoId === c.id) return true;
        const fromDig = m.waFrom ? telefoneDigitos(m.waFrom.replace(/@.*/, "")) : "";
        const toDig = m.waTo ? telefoneDigitos(m.waTo.replace(/@.*/, "")) : "";
        return (fromDig && fromDig === digitosCrm) || (toDig && toDig === digitosCrm);
      })
      .map((m) => ({ autor: m.autor, texto: m.texto, em: m.em }));

    const notas = crm.notas.filter((n) => n.contatoId === c.id).map((n) => n.texto);
    const ligacoesResumo = crm.ligacoes
      .filter((l) => l.contatoId === c.id && l.resumo)
      .map((l) => `Ligação: ${l.resumo}`);

    return {
      contatoId: c.id,
      oportunidadeId: op?.id ?? null,
      nome: c.nome,
      empresa: c.empresa,
      telefone: c.telefone,
      etapa,
      horasParado,
      mensagens: [...msgsCrm, ...msgsWa],
      notas: [...notas, ...ligacoesResumo],
      briefing: op?.briefing ?? null,
    };
  });
}

export async function carregarLeadsCrmParaReciclador(agoraIso = new Date().toISOString()): Promise<LeadFonteCrm[]> {
  const viaSb = await withSupabaseAdmin(async (sb) => {
    const [contatosRes, opsRes, msgsRes, notasRes] = await Promise.all([
      sb.from("crm_contatos").select("id, nome, empresa, telefone, criado_em"),
      sb
        .from("crm_oportunidades")
        .select("id, contato_id, etapa_id, entrou_na_etapa_em, briefing, perdida"),
      sb.from("crm_mensagens").select("contato_id, autor, texto, aviso_automatico, em").order("em", { ascending: true }),
      sb.from("crm_notas").select("contato_id, texto"),
    ]);

    if (contatosRes.error) throw contatosRes.error;
    const contatos = Array.isArray(contatosRes.data) ? contatosRes.data : [];
    const ops = Array.isArray(opsRes.data) ? opsRes.data : [];
    const msgs = Array.isArray(msgsRes.data) ? msgsRes.data : [];
    const notas = Array.isArray(notasRes.data) ? notasRes.data : [];

    return contatos.map((c: Record<string, unknown>) => {
      const cid = String(c.id);
      const cOps = ops.filter((o: Record<string, unknown>) => String(o.contato_id) === cid);
      const opViva =
        cOps.find((o: Record<string, unknown>) => !o.perdida) ?? cOps[cOps.length - 1] ?? null;
      const etapa = (
        opViva ? (opViva.perdida ? "perdido" : String(opViva.etapa_id || "novo")) : "novo"
      ) as EtapaId;
      const refIso = String(opViva?.entrou_na_etapa_em ?? c.criado_em ?? agoraIso);
      const horasParado = Math.round(minutosEntre(refIso, agoraIso) / 60);

      const cMsgs = msgs
        .filter(
          (m: Record<string, unknown>) => String(m.contato_id) === cid && !m.aviso_automatico,
        )
        .map((m: Record<string, unknown>) => ({
          autor: String(m.autor ?? "contato"),
          texto: String(m.texto ?? ""),
          em: typeof m.em === "string" ? m.em : undefined,
        }));

      const cNotas = notas
        .filter((n: Record<string, unknown>) => String(n.contato_id) === cid)
        .map((n: Record<string, unknown>) => String(n.texto ?? ""));

      const rawBriefing = opViva?.briefing as { dor?: string; meta?: string } | null | undefined;

      return {
        contatoId: cid,
        oportunidadeId: opViva ? String(opViva.id) : null,
        nome: String(c.nome ?? "Contato"),
        empresa: String(c.empresa ?? ""),
        telefone: String(c.telefone ?? ""),
        etapa,
        horasParado,
        mensagens: cMsgs,
        notas: cNotas,
        briefing: rawBriefing ?? null,
      } satisfies LeadFonteCrm;
    });
  });

  if (viaSb) return viaSb;
  return extrairLeadsDoEstadoExemplo(agoraIso);
}

function criarSeedLocal(agoraIso = new Date().toISOString()): RecicladorSnapshot {
  if (process.env.RECICLADOR_SKIP_SEED === "1") {
    return {
      emergenciaGlobal: false,
      campanhas: [],
      itens: [],
      optOuts: [],
      incidentes: [],
    };
  }

  const campanhaId = "camp-seed-relance-01";
  const defs = defaultsCampanha();
  const campanha: CampanhaReciclador = {
    id: campanhaId,
    nome: "Reativação Funil Parado",
    objetivo: "Reabrir oportunidades paradas com dor mapeada no CRM e entregar quem responder ao Cláudio.",
    status: "rascunho",
    filtro: {
      etapas: ["conversa", "handoff", "briefing", "proposta", "oferta", "perdido"],
      horasParadoMin: 48,
      apenasComContexto: false,
    },
    fontes: defs.fontes,
    cercas: defs.cercas,
    freios: defs.freios,
    criadaEm: agoraIso,
    atualizadaEm: agoraIso,
  };

  const leads = extrairLeadsDoEstadoExemplo(agoraIso);
  // Seleciona leads parados >= 48h que não sejam clientes ativos (pago/dentro)
  const candidatos = leads.filter(
    (l) => l.etapa !== "pago" && l.etapa !== "dentro" && l.horasParado >= 48,
  );

  const itens: ItemFilaReciclador[] = candidatos.map((lead, idx) => {
    const ctx = temContextoMinimo({
      mensagens: lead.mensagens,
      notas: lead.notas,
      briefing: lead.briefing,
    });
    const semContexto = !ctx.ok;
    return {
      id: `item-seed-${idx + 1}-${lead.contatoId}`,
      campanhaId,
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
      status: semContexto ? "ignorado" : "pendente",
      decisao: semContexto ? "ignorar" : null,
      motivo: semContexto
        ? (ctx.motivo ?? "Sem contexto mínimo — calar é mais inteligente")
        : "Na fila aguardando simulação ou disparo.",
      ganchoIdentificado: null,
      mensagemGerada: null,
      modeloUsado: null,
      custoTokens: 0,
      providerWhatsapp: null,
      messageIdWhatsapp: null,
      criadoEm: agoraIso,
      processadoEm: semContexto ? agoraIso : null,
      respondeuEm: null,
      avancouEtapa: false,
      virouVenda: false,
    };
  });

  return {
    emergenciaGlobal: false,
    campanhas: [campanha],
    itens,
    optOuts: [],
    incidentes: [],
  };
}

function carregarLocal(): RecicladorSnapshot {
  const file = recicladorDataFile();
  if (!existsSync(file)) {
    const seed = criarSeedLocal();
    salvarLocal(seed);
    return seed;
  }
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as Partial<RecicladorSnapshot>;
    return {
      emergenciaGlobal: Boolean(parsed.emergenciaGlobal),
      campanhas: Array.isArray(parsed.campanhas) ? parsed.campanhas : [],
      itens: Array.isArray(parsed.itens) ? parsed.itens : [],
      optOuts: Array.isArray(parsed.optOuts) ? parsed.optOuts : [],
      incidentes: Array.isArray(parsed.incidentes) ? parsed.incidentes : [],
    };
  } catch {
    const seed = criarSeedLocal();
    salvarLocal(seed);
    return seed;
  }
}

function salvarLocal(snap: RecicladorSnapshot): void {
  const file = recicladorDataFile();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(snap, null, 2));
}

// Mapeadores Supabase <-> Domínio
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowParaCampanha(r: any): CampanhaReciclador {
  const defs = defaultsCampanha();
  return {
    id: String(r.id),
    nome: String(r.nome ?? ""),
    objetivo: String(r.objetivo ?? ""),
    status: r.status,
    filtro: { ...defs.filtro, ...(r.filtro ?? {}) },
    fontes: { ...defs.fontes, ...(r.fontes ?? {}) },
    cercas: { ...defs.cercas, ...(r.cercas ?? {}) },
    freios: { ...defs.freios, ...(r.freios ?? {}) },
    criadaEm: String(r.criada_em ?? new Date().toISOString()),
    atualizadaEm: String(r.atualizada_em ?? new Date().toISOString()),
  };
}

function campanhaParaRow(c: CampanhaReciclador) {
  return {
    id: c.id,
    nome: c.nome,
    objetivo: c.objetivo,
    status: c.status,
    filtro: c.filtro,
    fontes: c.fontes,
    cercas: c.cercas,
    freios: c.freios,
    criada_em: c.criadaEm,
    atualizada_em: c.atualizadaEm,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowParaItem(r: any): ItemFilaReciclador {
  return {
    id: String(r.id),
    campanhaId: String(r.campanha_id),
    contatoId: String(r.contato_id),
    oportunidadeId: r.oportunidade_id ? String(r.oportunidade_id) : null,
    nomeContato: String(r.nome_contato ?? ""),
    empresa: String(r.empresa ?? ""),
    telefone: String(r.telefone ?? ""),
    telefoneMascarado: String(r.telefone_mascarado ?? mascararTelefoneReciclador(String(r.telefone ?? ""))),
    etapaInicial: (r.etapa_inicial ?? "conversa") as EtapaId,
    etapaAtual: (r.etapa_atual ?? "conversa") as EtapaId,
    contextoExtraido: String(r.contexto_extraido ?? ""),
    fontesLidas: Array.isArray(r.fontes_lidas) ? r.fontes_lidas.map(String) : [],
    status: r.status,
    decisao: r.decisao ?? null,
    motivo: String(r.motivo ?? ""),
    ganchoIdentificado: r.gancho_identificado ?? null,
    mensagemGerada: r.mensagem_gerada ?? null,
    modeloUsado: r.modelo_usado ?? null,
    custoTokens: Number(r.custo_tokens ?? 0),
    providerWhatsapp: r.provider_whatsapp ?? null,
    messageIdWhatsapp: r.message_id_whatsapp ?? null,
    criadoEm: String(r.criado_em ?? new Date().toISOString()),
    processadoEm: r.processado_em ?? null,
    respondeuEm: r.respondeu_em ?? null,
    avancouEtapa: Boolean(r.avancou_etapa),
    virouVenda: Boolean(r.virou_venda),
  };
}

function itemParaRow(i: ItemFilaReciclador) {
  return {
    id: i.id,
    campanha_id: i.campanhaId,
    contato_id: i.contatoId,
    oportunidade_id: i.oportunidadeId,
    nome_contato: i.nomeContato,
    empresa: i.empresa,
    telefone: i.telefone,
    telefone_digitos: telefoneDigitos(i.telefone),
    telefone_mascarado: i.telefoneMascarado,
    etapa_inicial: i.etapaInicial,
    etapa_atual: i.etapaAtual,
    contexto_extraido: i.contextoExtraido,
    fontes_lidas: i.fontesLidas,
    status: i.status,
    decisao: i.decisao,
    motivo: i.motivo,
    gancho_identificado: i.ganchoIdentificado,
    mensagem_gerada: i.mensagemGerada,
    modelo_usado: i.modeloUsado,
    custo_tokens: i.custoTokens,
    provider_whatsapp: i.providerWhatsapp,
    message_id_whatsapp: i.messageIdWhatsapp,
    criado_em: i.criadoEm,
    processado_em: i.processadoEm,
    respondeu_em: i.respondeuEm,
    avancou_etapa: i.avancouEtapa,
    virou_venda: i.virouVenda,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowParaOptOut(r: any): OptOutRegistro {
  return {
    id: String(r.id),
    telefoneDigitos: String(r.telefone_digitos),
    telefoneMascarado: String(r.telefone_mascarado),
    contatoId: r.contato_id ? String(r.contato_id) : null,
    nomeContato: r.nome_contato ? String(r.nome_contato) : null,
    motivo: r.motivo,
    evidencia: String(r.evidencia ?? ""),
    tema: r.tema ? String(r.tema) : null,
    registradoEm: String(r.registrado_em ?? new Date().toISOString()),
    expiraEm: r.expira_em ? String(r.expira_em) : null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowParaIncidente(r: any): IncidenteReciclador {
  return {
    id: String(r.id),
    campanhaId: r.campanha_id ? String(r.campanha_id) : null,
    tipo: r.tipo,
    detalhe: String(r.detalhe ?? ""),
    em: String(r.em ?? new Date().toISOString()),
  };
}

export async function carregarSnapshotReciclador(): Promise<RecicladorSnapshot> {
  const viaSb = await withSupabaseAdmin(async (sb) => {
    const [campRes, filaRes, optRes, incRes] = await Promise.all([
      sb.from("crm_reciclador_campanhas").select("*").order("criada_em", { ascending: false }),
      sb.from("crm_reciclador_fila").select("*").order("criado_em", { ascending: true }),
      sb.from("crm_reciclador_optouts").select("*").order("registrado_em", { ascending: false }),
      sb.from("crm_reciclador_incidentes").select("*").order("em", { ascending: false }).limit(200),
    ]);
    if (campRes.error) throw campRes.error;
    if (filaRes.error) throw filaRes.error;
    if (optRes.error) throw optRes.error;
    if (incRes.error) throw incRes.error;

    const campanhas = (campRes.data ?? []).map(rowParaCampanha);
    const itens = (filaRes.data ?? []).map(rowParaItem);
    const optOuts = (optRes.data ?? []).map(rowParaOptOut);
    const incidentes = (incRes.data ?? []).map(rowParaIncidente);

    return {
      emergenciaGlobal: campanhas.some((c: CampanhaReciclador) => c.status === "emergencia"),
      campanhas,
      itens,
      optOuts,
      incidentes,
    } satisfies RecicladorSnapshot;
  });

  if (viaSb) return viaSb;
  return carregarLocal();
}

export async function upsertCampanhaStore(campanha: CampanhaReciclador): Promise<void> {
  const viaSb = await withSupabaseAdmin(async (sb) => {
    const { error } = await sb.from("crm_reciclador_campanhas").upsert(campanhaParaRow(campanha));
    if (error) throw error;
    return true;
  });
  if (viaSb) return;

  const snap = carregarLocal();
  const idx = snap.campanhas.findIndex((c) => c.id === campanha.id);
  if (idx >= 0) snap.campanhas[idx] = campanha;
  else snap.campanhas.unshift(campanha);
  salvarLocal(snap);
}

export async function upsertItensFilaStore(novosOuAtualizados: ItemFilaReciclador[]): Promise<void> {
  if (novosOuAtualizados.length === 0) return;

  const viaSb = await withSupabaseAdmin(async (sb) => {
    const { error } = await sb
      .from("crm_reciclador_fila")
      .upsert(novosOuAtualizados.map(itemParaRow));
    if (error) throw error;
    return true;
  });
  if (viaSb) return;

  const snap = carregarLocal();
  for (const item of novosOuAtualizados) {
    const idx = snap.itens.findIndex((x) => x.id === item.id);
    if (idx >= 0) snap.itens[idx] = item;
    else snap.itens.push(item);
  }
  salvarLocal(snap);
}

export async function inserirOptOutStore(optOut: OptOutRegistro): Promise<void> {
  const viaSb = await withSupabaseAdmin(async (sb) => {
    const { error } = await sb.from("crm_reciclador_optouts").upsert(
      {
        id: optOut.id,
        telefone_digitos: optOut.telefoneDigitos,
        telefone_mascarado: optOut.telefoneMascarado,
        contato_id: optOut.contatoId,
        nome_contato: optOut.nomeContato,
        motivo: optOut.motivo,
        evidencia: optOut.evidencia,
        tema: optOut.tema,
        registrado_em: optOut.registradoEm,
        expira_em: optOut.expiraEm,
      },
      { onConflict: "telefone_digitos" },
    );
    if (error) throw error;
    return true;
  });
  if (viaSb) return;

  const snap = carregarLocal();
  const idx = snap.optOuts.findIndex((o) => o.telefoneDigitos === optOut.telefoneDigitos);
  if (idx >= 0) snap.optOuts[idx] = optOut;
  else snap.optOuts.unshift(optOut);
  salvarLocal(snap);
}

export async function inserirIncidenteStore(incidente: IncidenteReciclador): Promise<void> {
  const viaSb = await withSupabaseAdmin(async (sb) => {
    const { error } = await sb.from("crm_reciclador_incidentes").insert({
      id: incidente.id,
      campanha_id: incidente.campanhaId,
      tipo: incidente.tipo,
      detalhe: incidente.detalhe,
      em: incidente.em,
    });
    if (error) throw error;
    return true;
  });
  if (viaSb) return;

  const snap = carregarLocal();
  snap.incidentes.unshift(incidente);
  salvarLocal(snap);
}

export async function definirEmergenciaGlobalStore(ativa: boolean): Promise<void> {
  if (temSupabaseReciclador()) {
    // Em Supabase o estado de emergência reflete o status das campanhas ("emergencia").
    return;
  }
  const snap = carregarLocal();
  snap.emergenciaGlobal = ativa;
  salvarLocal(snap);
}

export async function marcarHandoffContatoCrm(opts: {
  contatoId?: string;
  phoneDigits: string;
  agoraIso: string;
}): Promise<boolean> {
  const viaSb = await withSupabaseAdmin(async (sb) => {
    if (opts.contatoId) {
      const { error } = await sb
        .from("crm_contatos")
        .update({ handoff_pendente: true, handoff_desde: opts.agoraIso })
        .eq("id", opts.contatoId);
      if (!error) return true;
    }
    const suffix = opts.phoneDigits.slice(-11);
    const { error } = await sb
      .from("crm_contatos")
      .update({ handoff_pendente: true, handoff_desde: opts.agoraIso })
      .ilike("telefone_digitos", `%${suffix}`);
    if (error) throw error;
    return true;
  });
  return Boolean(viaSb);
}
