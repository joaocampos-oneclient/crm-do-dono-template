"use client";

/**
 * Relance · Agente Ember — Reciclador de Oportunidades (CRM v3).
 * Tela isolada de campanha: escava contexto real conversa por conversa,
 * dispara a primeira mensagem sob freios rígidos e devolve a conversa ao atendimento.
 */
import * as React from "react";
import type { EtapaId } from "@/domain/types";
import type {
  CampanhaReciclador,
  DestinoAtendimentoReciclador,
  EntradaNovaCampanha,
  IncidenteReciclador,
  ItemFilaReciclador,
  MetricasCampanhaReciclador,
  OptOutRegistro,
  ResultadoImportacaoCsv,
  ResultadoSimulacaoReciclador,
  ResultadoTickReciclador,
  StatusCampanhaReciclador,
  StatusItemReciclador,
} from "@/domain/reciclador-types";
import {
  AgentGlyph,
  Button,
  Icon,
  indiceEtapa,
  KpiCard,
  StageChip,
  type StageIndex,
} from "./crm-ui";
import { CrmV3Page } from "./frame";
import { PageChrome } from "./page-chrome";

type AbaRelance = "fila" | "intencao" | "csv" | "optout";
type FiltroFila = "todos" | StatusItemReciclador;

interface EstadoLlm {
  configurada: boolean;
  mascara: string | null;
  model: string;
  emberModel: string;
}

interface EstadoWhatsapp {
  conectado: boolean;
  statusTexto: string;
  detalhe: string | null;
}

const ETAPAS_OPCOES: Array<{ id: EtapaId; rotulo: string }> = [
  { id: "novo", rotulo: "Novo" },
  { id: "conversa", rotulo: "Cláudio / Conversa" },
  { id: "handoff", rotulo: "Handoff" },
  { id: "briefing", rotulo: "Briefing" },
  { id: "proposta", rotulo: "Proposta" },
  { id: "oferta", rotulo: "Oferta" },
  { id: "perdido", rotulo: "Perdido" },
];

const MODELOS_SUGERIDOS = [
  { id: "claude-sonnet-4-5", rotulo: "Claude Sonnet 4.5 (recomendado)" },
  { id: "claude-sonnet-4-6", rotulo: "Claude Sonnet 4.6" },
  { id: "claude-opus-4-6", rotulo: "Claude Opus 4.6" },
] as const;

const CSV_EXEMPLO_FICTICIO = [
  "nome,telefone,empresa,contexto,notas,etapa",
  'Marina Costa,+5511988112233,Estúdio Lume,"Pediu diagnóstico em setembro, travou quando o sócio viajou","Reclamou de retrabalho manual no fechamento mensal",briefing',
  'Carlos Mendes,+5511977223344,Mendes Log,"Participou da imersão ao vivo e pediu material de apoio","Time comercial enxuto com três vendedores",conversa',
  'Contato Sem Histórico,+5511966334455,Lista Fria,"","",novo',
].join("\n");

function stageDeEtapa(etapa: EtapaId): StageIndex {
  if (etapa === "conversa") return indiceEtapa("claudio");
  if (etapa === "perdido") return 0;
  return indiceEtapa(etapa);
}

function formatarDataCurta(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function rotuloStatusCampanha(s: StatusCampanhaReciclador): string {
  const mapa: Record<StatusCampanhaReciclador, string> = {
    rascunho: "Rascunho",
    ativa: "Ativa · envio automático",
    pausada: "Pausada",
    emergencia: "Congelada · emergência",
    concluida: "Concluída",
  };
  return mapa[s] ?? s;
}

function classeStatusCampanha(s: StatusCampanhaReciclador): string {
  if (s === "ativa") return "crm-relance-badge crm-relance-badge--ok";
  if (s === "emergencia") return "crm-relance-badge crm-relance-badge--danger";
  if (s === "rascunho" || s === "pausada") return "crm-relance-badge crm-relance-badge--ember";
  return "crm-relance-badge";
}

function rotuloStatusItem(s: StatusItemReciclador): string {
  const mapa: Record<StatusItemReciclador, string> = {
    pendente: "Pendente",
    simulado: "Simulado (dry-run)",
    enviado: "Enviado",
    adiado: "Adiado",
    ignorado: "Ignorado",
    bloqueado: "Bloqueado",
    erro: "Erro de envio",
  };
  return mapa[s] ?? s;
}

function classeStatusItem(s: StatusItemReciclador): string {
  if (s === "enviado") return "crm-relance-badge crm-relance-badge--ok";
  if (s === "simulado") return "crm-relance-badge crm-relance-badge--ember";
  if (s === "erro" || s === "bloqueado") return "crm-relance-badge crm-relance-badge--danger";
  return "crm-relance-badge";
}

function rotuloMotivoOptOut(m: OptOutRegistro["motivo"]): string {
  if (m === "pedido_parar") return "Pedido direto de não contato";
  if (m === "recusa_recente") return "Recusa recente em janela de proteção";
  return "Bloqueio manual da operação";
}

function rotuloTipoIncidente(t: IncidenteReciclador["tipo"]): string {
  const mapa: Record<IncidenteReciclador["tipo"], string> = {
    sessao_desconectada: "Sessão WhatsApp desconectada",
    erro_envio: "Falha no disparo",
    parada_emergencia: "Parada de emergência",
    rate_limit: "Limite de ritmo atingido",
    sem_llm: "IA ausente ou indisponível",
  };
  return mapa[t] ?? t;
}

const METRICAS_VAZIAS: MetricasCampanhaReciclador = {
  totalFila: 0,
  pendentes: 0,
  simulados: 0,
  enviados: 0,
  adiados: 0,
  ignorados: 0,
  bloqueados: 0,
  erros: 0,
  respostas: 0,
  avancosEtapa: 0,
  vendasAtribuidas: 0,
  taxaRespostaTexto: "Sem disparos ainda",
  taxaAvancoTexto: "Sem disparos ainda",
  motivosBloqueio: [],
  incidentes: 0,
};

export function RelanceV3() {
  const [carregando, setCarregando] = React.useState(true);
  const [ocupado, setOcupado] = React.useState<string | null>(null);
  const [aviso, setAviso] = React.useState<{ tom: "ok" | "alerta" | "erro"; texto: string } | null>(null);

  // Estado global do endpoint /api/reciclador
  const [campanhas, setCampanhas] = React.useState<CampanhaReciclador[]>([]);
  const [optOuts, setOptOuts] = React.useState<OptOutRegistro[]>([]);
  const [incidentesGlobais, setIncidentesGlobais] = React.useState<IncidenteReciclador[]>([]);
  const [emergenciaGlobal, setEmergenciaGlobal] = React.useState(false);

  // Campanha selecionada e detalhes de /api/reciclador/[id]
  const [campanhaId, setCampanhaId] = React.useState<string | null>(null);
  const [campanhaDetalhe, setCampanhaDetalhe] = React.useState<CampanhaReciclador | null>(null);
  const [itens, setItens] = React.useState<ItemFilaReciclador[]>([]);
  const [metricas, setMetricas] = React.useState<MetricasCampanhaReciclador>(METRICAS_VAZIAS);
  const [incidentesCampanha, setIncidentesCampanha] = React.useState<IncidenteReciclador[]>([]);

  // Prontidão LLM + WhatsApp
  const [llm, setLlm] = React.useState<EstadoLlm>({
    configurada: false,
    mascara: null,
    model: "claude-haiku-4-5",
    emberModel: "claude-sonnet-4-5",
  });
  const [modeloEmberInput, setModeloEmberInput] = React.useState("claude-sonnet-4-5");
  const [wpp, setWpp] = React.useState<EstadoWhatsapp>({
    conectado: false,
    statusTexto: "Verificando canal",
    detalhe: null,
  });

  // Navegação interna da tela
  const [aba, setAba] = React.useState<AbaRelance>("fila");
  const [filtroFila, setFiltroFila] = React.useState<FiltroFila>("todos");
  const [painelNovaAberto, setPainelNovaAberto] = React.useState(false);
  const [cicloAutoAtivo, setCicloAutoAtivo] = React.useState(false);
  const [ignorarJanelaManual, setIgnorarJanelaManual] = React.useState(false);
  const [ultimoTick, setUltimoTick] = React.useState<ResultadoTickReciclador | null>(null);
  const [ultimaSimulacao, setUltimaSimulacao] = React.useState<ResultadoSimulacaoReciclador | null>(null);

  // Formulário "+ Nova campanha"
  const [novaNome, setNovaNome] = React.useState("");
  const [novaObjetivo, setNovaObjetivo] = React.useState("");
  const [novaEtapas, setNovaEtapas] = React.useState<EtapaId[]>([
    "conversa",
    "handoff",
    "briefing",
    "proposta",
    "oferta",
    "perdido",
  ]);
  const [novaHorasParado, setNovaHorasParado] = React.useState(72);
  const [novaApenasComContexto, setNovaApenasComContexto] = React.useState(true);
  const [novaProibirPreco, setNovaProibirPreco] = React.useState(true);
  const [novaEntregarPara, setNovaEntregarPara] = React.useState<DestinoAtendimentoReciclador>("claudio");
  const [novaAutoClaudio, setNovaAutoClaudio] = React.useState(true);
  const [novaPopularDoCrm, setNovaPopularDoCrm] = React.useState(true);

  // Formulário Tab 2 — Intenção, Conteúdo e Freios
  const [editObjetivo, setEditObjetivo] = React.useState("");
  const [editEtapas, setEditEtapas] = React.useState<EtapaId[]>([]);
  const [editHorasParado, setEditHorasParado] = React.useState(72);
  const [editApenasContexto, setEditApenasContexto] = React.useState(true);
  const [editUsarHistorico, setEditUsarHistorico] = React.useState(true);
  const [editUsarNotas, setEditUsarNotas] = React.useState(true);
  const [editBaseConteudo, setEditBaseConteudo] = React.useState("");
  const [editNovidadesMercado, setEditNovidadesMercado] = React.useState("");
  const [editTemasProibidos, setEditTemasProibidos] = React.useState("");
  const [editTomMarca, setEditTomMarca] = React.useState("");
  const [editProibirPreco, setEditProibirPreco] = React.useState(true);
  const [editModeloCampanha, setEditModeloCampanha] = React.useState("claude-sonnet-4-5");
  const [editEntregarPara, setEditEntregarPara] = React.useState<DestinoAtendimentoReciclador>("claudio");
  const [editAutoClaudio, setEditAutoClaudio] = React.useState(true);
  const [editMaxHora, setEditMaxHora] = React.useState(8);
  const [editMaxDia, setEditMaxDia] = React.useState(30);
  const [editEspacamentoSeg, setEditEspacamentoSeg] = React.useState(45);
  const [editJanelaInicio, setEditJanelaInicio] = React.useState(9);
  const [editJanelaFim, setEditJanelaFim] = React.useState(18);
  const [editDiasUteis, setEditDiasUteis] = React.useState(true);
  const [editCooldownDias, setEditCooldownDias] = React.useState(30);

  // Formulário Tab 3 — Importar CSV com contexto
  const [csvTexto, setCsvTexto] = React.useState("");
  const [csvEhExemplo, setCsvEhExemplo] = React.useState(false);
  const [resultadoCsv, setResultadoCsv] = React.useState<ResultadoImportacaoCsv | null>(null);

  // Formulário Tab 4 — Opt-out manual
  const [optTelefone, setOptTelefone] = React.useState("");
  const [optNome, setOptNome] = React.useState("");
  const [optEvidencia, setOptEvidencia] = React.useState("");

  const sincronizarFormEdicao = React.useCallback((c: CampanhaReciclador) => {
    setEditObjetivo(c.objetivo);
    setEditEtapas(c.filtro.etapas);
    setEditHorasParado(c.filtro.horasParadoMin);
    setEditApenasContexto(c.filtro.apenasComContexto);
    setEditUsarHistorico(c.fontes.usarHistoricoMensagens);
    setEditUsarNotas(c.fontes.usarNotas);
    setEditBaseConteudo(c.fontes.baseConteudo);
    setEditNovidadesMercado(c.fontes.novidadesMercado);
    setEditTemasProibidos(c.fontes.temasProibidos.join("\n"));
    setEditTomMarca(c.cercas.tomMarca);
    setEditProibirPreco(c.cercas.proibirPreco);
    setEditModeloCampanha(c.cercas.modeloLlm);
    setEditEntregarPara(c.cercas.entregarPara);
    setEditAutoClaudio(c.cercas.autoResponderClaudio);
    setEditMaxHora(c.freios.maxPorHora);
    setEditMaxDia(c.freios.maxPorDia);
    setEditEspacamentoSeg(c.freios.espacamentoSegundos);
    setEditJanelaInicio(c.freios.janelaInicioHora);
    setEditJanelaFim(c.freios.janelaFimHora);
    setEditDiasUteis(c.freios.apenasDiasUteis);
    setEditCooldownDias(c.freios.cooldownRecusaDias);
  }, []);

  const carregarProntidao = React.useCallback(async () => {
    try {
      const [resLlm, resWpp] = await Promise.all([
        fetch("/api/agents/llm").catch(() => null),
        fetch("/api/whatsapp").catch(() => null),
      ]);

      if (resLlm && resLlm.ok) {
        const j = await resLlm.json();
        const ember = typeof j.emberModel === "string" && j.emberModel.trim() ? j.emberModel.trim() : "claude-sonnet-4-5";
        setLlm({
          configurada: Boolean(j.configurada),
          mascara: j.mascara ?? null,
          model: j.model ?? "claude-haiku-4-5",
          emberModel: ember,
        });
        setModeloEmberInput(ember);
      }

      if (resWpp && resWpp.ok) {
        const w = await resWpp.json();
        const rawStatus = String(w.status ?? "").toLowerCase();
        const conectado =
          Boolean(w.connected) ||
          rawStatus === "connected" ||
          rawStatus === "ready" ||
          rawStatus === "open" ||
          rawStatus === "working";
        const statusTexto = conectado
          ? "Conectado e pronto"
          : rawStatus === "qr" || rawStatus === "pending"
            ? "Aguardando leitura de QR"
            : "Sem sessão ativa";
        const partes = [w.provider, w.phone, w.sessionId].filter(Boolean);
        setWpp({
          conectado,
          statusTexto,
          detalhe: partes.length ? partes.join(" · ") : null,
        });
      } else {
        setWpp({
          conectado: false,
          statusTexto: "Sem resposta do canal",
          detalhe: null,
        });
      }
    } catch {
      /* mantém estado anterior sem quebrar tela */
    }
  }, []);

  const carregarCampanhaDetalhe = React.useCallback(
    async (id: string, sincronizarCampos = false) => {
      const res = await fetch(`/api/reciclador/${encodeURIComponent(id)}`);
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        return;
      }
      const camp = json.campanha as CampanhaReciclador;
      setCampanhaDetalhe(camp);
      setCampanhas((prev) => prev.map((c) => (c.id === camp.id ? camp : c)));
      setItens(Array.isArray(json.itens) ? (json.itens as ItemFilaReciclador[]) : []);
      setMetricas((json.metricas as MetricasCampanhaReciclador) ?? METRICAS_VAZIAS);
      setIncidentesCampanha(Array.isArray(json.incidentes) ? (json.incidentes as IncidenteReciclador[]) : []);
      if (sincronizarCampos) {
        sincronizarFormEdicao(camp);
      }
    },
    [sincronizarFormEdicao],
  );

  const carregarVisaoGeral = React.useCallback(
    async (idPreferido?: string | null, sincronizarCampos = false) => {
      const res = await fetch("/api/reciclador");
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.erro ?? "Falha ao carregar dados do Relance.");
      }
      const lista = Array.isArray(json.campanhas) ? (json.campanhas as CampanhaReciclador[]) : [];
      setCampanhas(lista);
      setOptOuts(Array.isArray(json.optOuts) ? (json.optOuts as OptOutRegistro[]) : []);
      setIncidentesGlobais(Array.isArray(json.incidentes) ? (json.incidentes as IncidenteReciclador[]) : []);
      setEmergenciaGlobal(Boolean(json.emergenciaGlobal));

      if (lista.length === 0) {
        setPainelNovaAberto(true);
        setCampanhaId(null);
        setCampanhaDetalhe(null);
        setItens([]);
        setMetricas(METRICAS_VAZIAS);
        return;
      }

      const alvoId =
        idPreferido && lista.some((c) => c.id === idPreferido)
          ? idPreferido
          : campanhaId && lista.some((c) => c.id === campanhaId)
            ? campanhaId
            : lista[0].id;

      setCampanhaId(alvoId);
      await carregarCampanhaDetalhe(alvoId, sincronizarCampos);
    },
    [campanhaId, carregarCampanhaDetalhe],
  );

  React.useEffect(() => {
    let ativo = true;
    (async () => {
      setCarregando(true);
      try {
        await Promise.all([carregarProntidao(), carregarVisaoGeral(null, true)]);
      } catch (e) {
        if (ativo) {
          setAviso({ tom: "erro", texto: (e as Error).message });
        }
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
    // Carregamento inicial único
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selecionarCampanha = async (id: string) => {
    setCampanhaId(id);
    setResultadoCsv(null);
    setUltimaSimulacao(null);
    setUltimoTick(null);
    setOcupado("selecionar");
    try {
      await carregarCampanhaDetalhe(id, true);
    } finally {
      setOcupado(null);
    }
  };

  // Ciclo automático na aba a cada 60 segundos
  const executarTick = React.useCallback(
    async (silencioso = false) => {
      if (!campanhaId) return;
      if (!silencioso) setOcupado("tick");
      try {
        const res = await fetch("/api/reciclador/tick", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            campanhaId,
            ignorarJanela: silencioso ? false : ignorarJanelaManual,
          }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) {
          setAviso({ tom: "erro", texto: json?.erro ?? "Não foi possível processar o lote agora." });
          if (silencioso) setCicloAutoAtivo(false);
          return;
        }
        const r = json.resultado as ResultadoTickReciclador;
        setUltimoTick(r);
        if (r.pausadaPorIncidente) {
          setCicloAutoAtivo(false);
          setAviso({
            tom: "alerta",
            texto: r.motivoPausa
              ? `Campanha pausada automaticamente por proteção: ${r.motivoPausa}`
              : "Campanha pausada automaticamente por sinal de risco no canal.",
          });
        } else if (!silencioso) {
          setAviso({
            tom: "ok",
            texto: `Lote processado: ${r.enviados} enviados, ${r.ignorados} ignorados, ${r.bloqueados} bloqueados, ${r.adiados} adiados.`,
          });
        }
        await carregarVisaoGeral(campanhaId, false);
      } catch (e) {
        setAviso({ tom: "erro", texto: (e as Error).message });
        if (silencioso) setCicloAutoAtivo(false);
      } finally {
        if (!silencioso) setOcupado(null);
      }
    },
    [campanhaId, carregarVisaoGeral, ignorarJanelaManual],
  );

  React.useEffect(() => {
    if (!cicloAutoAtivo || !campanhaId || emergenciaGlobal || campanhaDetalhe?.status === "emergencia") {
      return;
    }
    const timer = window.setInterval(() => {
      void executarTick(true);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [cicloAutoAtivo, campanhaId, emergenciaGlobal, campanhaDetalhe?.status, executarTick]);

  const acionarEmergenciaGlobal = async () => {
    setOcupado("emergencia_global");
    setCicloAutoAtivo(false);
    try {
      const res = await fetch("/api/reciclador", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acao: "emergencia_global",
          motivo: "Parada imediata acionada pelo painel do Relance",
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setAviso({ tom: "erro", texto: json?.erro ?? "Falha ao acionar parada de emergência." });
        return;
      }
      setAviso({
        tom: "alerta",
        texto: "Parada de emergência ativada. Todos os envios automáticos foram congelados imediatamente.",
      });
      await carregarVisaoGeral(campanhaId, false);
    } catch (e) {
      setAviso({ tom: "erro", texto: (e as Error).message });
    } finally {
      setOcupado(null);
    }
  };

  const salvarModeloEmber = async () => {
    const modeloLimpo = modeloEmberInput.trim();
    if (!modeloLimpo) return;
    setOcupado("salvar_modelo");
    try {
      const res = await fetch("/api/agents/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emberModel: modeloLimpo }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        setAviso({ tom: "erro", texto: json?.erro ?? "Não foi possível salvar o modelo do Ember." });
        return;
      }
      setEditModeloCampanha(modeloLimpo);
      await carregarProntidao();
      if (campanhaDetalhe) {
        await fetch(`/api/reciclador/${encodeURIComponent(campanhaDetalhe.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cercas: { ...campanhaDetalhe.cercas, modeloLlm: modeloLimpo },
          }),
        }).catch(() => null);
        await carregarCampanhaDetalhe(campanhaDetalhe.id, false);
      }
      setAviso({ tom: "ok", texto: `Modelo dedicado do Ember atualizado para ${modeloLimpo}.` });
    } catch (e) {
      setAviso({ tom: "erro", texto: (e as Error).message });
    } finally {
      setOcupado(null);
    }
  };

  const criarCampanha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaNome.trim() || !novaObjetivo.trim()) {
      setAviso({ tom: "alerta", texto: "Preencha o nome e o objetivo em uma frase antes de criar a campanha." });
      return;
    }
    setOcupado("criar");
    try {
      const payload: EntradaNovaCampanha = {
        nome: novaNome.trim(),
        objetivo: novaObjetivo.trim(),
        popularDoCrm: novaPopularDoCrm,
        filtro: {
          etapas: novaEtapas.length ? novaEtapas : ["conversa", "briefing", "proposta"],
          horasParadoMin: Math.max(0, Number(novaHorasParado) || 0),
          apenasComContexto: novaApenasComContexto,
        },
        cercas: {
          proibirPreco: novaProibirPreco,
          modeloLlm: modeloEmberInput.trim() || llm.emberModel || "claude-sonnet-4-5",
          entregarPara: novaEntregarPara,
          autoResponderClaudio: novaEntregarPara === "claudio" ? novaAutoClaudio : false,
        },
      };
      const res = await fetch("/api/reciclador", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "criar", campanha: payload }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setAviso({ tom: "erro", texto: json?.erro ?? "Não foi possível criar a campanha." });
        return;
      }
      const criada = json.campanha as CampanhaReciclador;
      setNovaNome("");
      setNovaObjetivo("");
      setPainelNovaAberto(false);
      setAba("fila");
      setAviso({ tom: "ok", texto: `Campanha "${criada.nome}" criada em modo rascunho. Simule em 3 leads antes de ligar o envio.` });
      await carregarVisaoGeral(criada.id, true);
    } catch (err) {
      setAviso({ tom: "erro", texto: (err as Error).message });
    } finally {
      setOcupado(null);
    }
  };

  const executarAcaoCampanha = async (
    acao: "ativar" | "pausar" | "emergencia" | "retomar_emergencia" | "sincronizar_crm",
  ) => {
    if (!campanhaDetalhe) return;
    setOcupado(acao);
    if (acao === "pausar" || acao === "emergencia") {
      setCicloAutoAtivo(false);
    }
    try {
      const res = await fetch(`/api/reciclador/${encodeURIComponent(campanhaDetalhe.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setAviso({ tom: "erro", texto: json?.erro ?? "Ação recusada pelas travas da campanha." });
        return;
      }
      const mensagensAcao: Record<typeof acao, string> = {
        ativar: "Envio automático ativado sob os freios configurados.",
        pausar: "Campanha pausada. Nenhum disparo novo sairá até você reativar.",
        emergencia: "Campanha congelada em parada de emergência.",
        retomar_emergencia: "Emergência encerrada. A campanha voltou para estado pausado por segurança.",
        sincronizar_crm: "Fila sincronizada com os contatos elegíveis do CRM.",
      };
      setAviso({ tom: acao === "emergencia" ? "alerta" : "ok", texto: mensagensAcao[acao] });
      await carregarVisaoGeral(campanhaDetalhe.id, false);
    } catch (e) {
      setAviso({ tom: "erro", texto: (e as Error).message });
    } finally {
      setOcupado(null);
    }
  };

  const simularTresLeads = async () => {
    if (!campanhaDetalhe) return;
    setOcupado("simular");
    try {
      const res = await fetch(`/api/reciclador/${encodeURIComponent(campanhaDetalhe.id)}/simular`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limite: 3 }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setAviso({ tom: "erro", texto: json?.erro ?? "Falha ao simular aberturas." });
        return;
      }
      const r = json.resultado as ResultadoSimulacaoReciclador;
      setUltimaSimulacao(r);
      setAba("fila");
      setFiltroFila(r.processados > 0 ? "simulado" : "todos");
      setAviso({
        tom: r.avisoLlm ? "alerta" : "ok",
        texto: r.avisoLlm
          ? `Simulação concluída (${r.processados} avaliados). ${r.avisoLlm}`
          : `Simulação concluída em ${r.processados} leads sem disparar nada no WhatsApp.`,
      });
      await carregarCampanhaDetalhe(campanhaDetalhe.id, false);
    } catch (e) {
      setAviso({ tom: "erro", texto: (e as Error).message });
    } finally {
      setOcupado(null);
    }
  };

  const salvarIntencaoEFreios = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campanhaDetalhe) return;
    setOcupado("salvar_config");
    try {
      const temas = editTemasProibidos
        .split(/[\n,]+/)
        .map((t) => t.trim())
        .filter(Boolean);

      const body: Partial<CampanhaReciclador> = {
        objetivo: editObjetivo.trim() || campanhaDetalhe.objetivo,
        filtro: {
          etapas: editEtapas.length ? editEtapas : campanhaDetalhe.filtro.etapas,
          horasParadoMin: Math.max(0, Number(editHorasParado) || 0),
          apenasComContexto: editApenasContexto,
        },
        fontes: {
          usarHistoricoMensagens: editUsarHistorico,
          usarNotas: editUsarNotas,
          baseConteudo: editBaseConteudo,
          novidadesMercado: editNovidadesMercado,
          temasProibidos: temas,
        },
        cercas: {
          proibirPreco: editProibirPreco,
          tomMarca: editTomMarca,
          modeloLlm: editModeloCampanha.trim() || "claude-sonnet-4-5",
          entregarPara: editEntregarPara,
          autoResponderClaudio: editEntregarPara === "claudio" ? editAutoClaudio : false,
        },
        freios: {
          maxPorHora: Math.max(1, Number(editMaxHora) || 1),
          maxPorDia: Math.max(1, Number(editMaxDia) || 1),
          espacamentoSegundos: Math.max(5, Number(editEspacamentoSeg) || 5),
          janelaInicioHora: Math.min(23, Math.max(0, Number(editJanelaInicio) || 0)),
          janelaFimHora: Math.min(24, Math.max(1, Number(editJanelaFim) || 18)),
          apenasDiasUteis: editDiasUteis,
          cooldownRecusaDias: Math.max(1, Number(editCooldownDias) || 1),
        },
      };

      const res = await fetch(`/api/reciclador/${encodeURIComponent(campanhaDetalhe.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setAviso({ tom: "erro", texto: json?.erro ?? "Não foi possível salvar os ajustes da campanha." });
        return;
      }
      setAviso({ tom: "ok", texto: "Intenção, fontes e freios atualizados nesta campanha." });
      await carregarCampanhaDetalhe(campanhaDetalhe.id, true);
    } catch (err) {
      setAviso({ tom: "erro", texto: (err as Error).message });
    } finally {
      setOcupado(null);
    }
  };

  const importarCsv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campanhaDetalhe) return;
    if (!csvTexto.trim()) {
      setAviso({ tom: "alerta", texto: "Cole um CSV ou escolha um arquivo antes de importar." });
      return;
    }
    setOcupado("importar_csv");
    try {
      const res = await fetch(`/api/reciclador/${encodeURIComponent(campanhaDetalhe.id)}/importar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvTexto }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setAviso({ tom: "erro", texto: json?.erro ?? "Falha ao processar o CSV." });
        return;
      }
      const r = json.resultado as ResultadoImportacaoCsv;
      setResultadoCsv(r);
      setAviso({
        tom: "ok",
        texto: `CSV avaliado: ${r.importados} entraram na fila e ${r.rejeitadosSemContexto} sem contexto foram barrados.`,
      });
      await carregarCampanhaDetalhe(campanhaDetalhe.id, false);
    } catch (err) {
      setAviso({ tom: "erro", texto: (err as Error).message });
    } finally {
      setOcupado(null);
    }
  };

  const lerArquivoCsv = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    const texto = await file.text();
    setCsvTexto(texto);
    setCsvEhExemplo(false);
    setResultadoCsv(null);
  };

  const registrarOptOutManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!optTelefone.trim()) {
      setAviso({ tom: "alerta", texto: "Informe o telefone que nunca deve receber mensagens do Relance." });
      return;
    }
    setOcupado("optout");
    try {
      const res = await fetch("/api/reciclador", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acao: "optout",
          telefone: optTelefone.trim(),
          nomeContato: optNome.trim() || undefined,
          evidencia: optEvidencia.trim() || "Adicionado manualmente pelo painel de proteção",
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setAviso({ tom: "erro", texto: json?.erro ?? "Não foi possível registrar o bloqueio." });
        return;
      }
      setOptTelefone("");
      setOptNome("");
      setOptEvidencia("");
      setAviso({ tom: "ok", texto: "Número incluído na lista permanente de não contato e removido de filas pendentes." });
      await carregarVisaoGeral(campanhaId, false);
    } catch (err) {
      setAviso({ tom: "erro", texto: (err as Error).message });
    } finally {
      setOcupado(null);
    }
  };

  const alternarEtapaLista = (lista: EtapaId[], setLista: (v: EtapaId[]) => void, etapa: EtapaId) => {
    if (lista.includes(etapa)) {
      setLista(lista.filter((x) => x !== etapa));
    } else {
      setLista([...lista, etapa]);
    }
  };

  const itensFiltrados = React.useMemo(() => {
    if (filtroFila === "todos") return itens;
    return itens.filter((i) => i.status === filtroFila);
  }, [itens, filtroFila]);

  const incidentesUnificados = React.useMemo(() => {
    const mapa = new Map<string, IncidenteReciclador>();
    for (const inc of incidentesCampanha) mapa.set(inc.id, inc);
    for (const inc of incidentesGlobais) mapa.set(inc.id, inc);
    return Array.from(mapa.values()).sort((a, b) => b.em.localeCompare(a.em));
  }, [incidentesCampanha, incidentesGlobais]);

  const emEmergencia = emergenciaGlobal || campanhaDetalhe?.status === "emergencia";

  return (
    <CrmV3Page>
      <PageChrome
        label="Relance · Agente Ember"
        title="Seus leads com história merecem uma abertura que reabre o jogo."
        lede="Garimpo conversa por conversa, sem aprovar mensagem por mensagem e sem forçar envio quando faltar contexto."
        aside={
          <Button
            variant="danger"
            loading={ocupado === "emergencia_global"}
            onClick={acionarEmergenciaGlobal}
            style={{ flex: "none" }}
          >
            Parada de emergência
          </Button>
        }
      />

      {emEmergencia && (
        <section className="crm-relance-emergency-bar" role="status">
          <div style={{ display: "grid", gap: 4 }}>
            <strong style={{ font: "600 14px var(--font-sans)" }}>
              Parada de emergência ativa — nenhum disparo automático sai deste CRM.
            </strong>
            <span style={{ font: "400 13px var(--font-sans)", color: "var(--fg-2)" }}>
              Revise os incidentes recentes e o canal de WhatsApp antes de liberar novamente a campanha.
            </span>
          </div>
          {campanhaDetalhe && (
            <Button
              variant="secondary"
              loading={ocupado === "retomar_emergencia"}
              onClick={() => executarAcaoCampanha("retomar_emergencia")}
            >
              Retomar da emergência
            </Button>
          )}
        </section>
      )}

      {aviso && (
        <div
          role="status"
          style={{
            background:
              aviso.tom === "erro"
                ? "linear-gradient(var(--live-wash), var(--live-wash)), var(--surface)"
                : aviso.tom === "alerta"
                  ? "linear-gradient(var(--ember-wash), var(--ember-wash)), var(--surface)"
                  : "linear-gradient(var(--verde-wash), var(--verde-wash)), var(--surface)",
            border: "1px solid var(--hairline-2)",
            borderRadius: "var(--r-sm)",
            padding: "10px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            font: "400 13px/1.4 var(--font-sans)",
          }}
        >
          <span>{aviso.texto}</span>
          <button
            type="button"
            onClick={() => setAviso(null)}
            aria-label="Fechar aviso"
            style={{
              border: 0,
              background: "transparent",
              color: "var(--fg-2)",
              cursor: "pointer",
              padding: 4,
              display: "inline-flex",
            }}
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      )}

      {/* Faixa de Prontidão e Risco */}
      <section className="crm-relance-banner" aria-label="Prontidão e responsabilidade operacional">
        <div className="crm-relance-banner__card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, font: "600 13.5px var(--font-sans)" }}>
              <AgentGlyph agent="ember" size={15} />
              Motor de raciocínio do Ember
            </span>
            <span className={llm.configurada ? "crm-relance-badge crm-relance-badge--ok" : "crm-relance-badge crm-relance-badge--ember"}>
              {llm.configurada
                ? `Configurada${llm.mascara ? ` · ${llm.mascara}` : ""}`
                : "Pendente — Ember nunca dispara texto genérico sem IA"}
            </span>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <select
              aria-label="Modelos recomendados para o Ember"
              className="crm-relance-select"
              style={{ flex: "1 1 210px" }}
              value={MODELOS_SUGERIDOS.some((m) => m.id === modeloEmberInput) ? modeloEmberInput : "custom"}
              onChange={(e) => {
                if (e.target.value !== "custom") {
                  setModeloEmberInput(e.target.value);
                }
              }}
            >
              {MODELOS_SUGERIDOS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.rotulo}
                </option>
              ))}
              <option value="custom">Outro ID de modelo Anthropic</option>
            </select>
            <input
              type="text"
              aria-label="ID exato do modelo do Ember"
              className="crm-relance-input"
              style={{ flex: "1 1 170px", fontFamily: "var(--font-mono)", fontSize: 12.5 }}
              value={modeloEmberInput}
              onChange={(e) => setModeloEmberInput(e.target.value)}
              placeholder="claude-sonnet-4-5"
            />
            <Button
              variant="secondary"
              loading={ocupado === "salvar_modelo"}
              onClick={salvarModeloEmber}
              style={{ minHeight: 40, padding: "0 14px" }}
            >
              Salvar modelo
            </Button>
          </div>

          <p className="crm-relance-field__help">
            Modelo forte apenas na descoberta e na primeira mensagem. Quem responde segue no atendimento normal ({llm.model}).{" "}
            {!llm.configurada && (
              <a href="#/config/integrar" style={{ color: "var(--fg)", fontWeight: 500 }}>
                Configurar chave Anthropic em Integrações
              </a>
            )}
          </p>
        </div>

        <div className="crm-relance-banner__card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <strong style={{ font: "600 13.5px var(--font-sans)" }}>Canal WhatsApp e trava legal</strong>
            <span className={wpp.conectado ? "crm-relance-badge crm-relance-badge--ok" : "crm-relance-badge crm-relance-badge--ember"}>
              {wpp.statusTexto}
            </span>
          </div>
          {wpp.detalhe && (
            <span style={{ font: "400 11.5px var(--font-mono)", color: "var(--fg-3)" }}>{wpp.detalhe}</span>
          )}
          <p className="crm-relance-field__help" style={{ color: "var(--fg-2)" }}>
            Envio sem aprovação por mensagem exige freios ativos. Uso indevido em WhatsApp não oficial gera risco real de bloqueio do número. Base legal e opt-out imediato são responsabilidade da operação.
          </p>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: "auto" }}>
            <a href="#/config/integrar" style={{ font: "500 12px var(--font-sans)", color: "var(--fg)" }}>
              Verificar sessão do WhatsApp
            </a>
            <button
              type="button"
              onClick={() => setAba("optout")}
              style={{
                border: 0,
                background: "transparent",
                padding: 0,
                font: "500 12px var(--font-sans)",
                color: "var(--fg-2)",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Lista de não contatar ({optOuts.length})
            </button>
          </div>
        </div>
      </section>

      {/* Seletor de Campanhas + Painel Colapsável Nova Campanha */}
      <section className="crm-v3-surface" aria-label="Campanhas do Relance">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div className="crm-v3-pills" role="list" aria-label="Selecionar campanha">
            {campanhas.map((c) => {
              const selecionada = c.id === campanhaId;
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`crm-v3-pill${selecionada ? " is-on" : ""}`}
                  aria-current={selecionada ? "true" : undefined}
                  onClick={() => selecionarCampanha(c.id)}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      marginRight: 8,
                      background:
                        c.status === "ativa"
                          ? "var(--verde)"
                          : c.status === "emergencia"
                            ? "var(--live)"
                            : "var(--ag-ember, #d97706)",
                    }}
                  />
                  {c.nome}
                </button>
              );
            })}
            {!carregando && campanhas.length === 0 && (
              <span style={{ font: "400 13px var(--font-sans)", color: "var(--fg-2)", padding: "6px 0" }}>
                Nenhuma campanha criada ainda. Comece definindo a intenção abaixo.
              </span>
            )}
          </div>

          <Button
            variant={painelNovaAberto ? "ghost" : "secondary"}
            onClick={() => setPainelNovaAberto((v) => !v)}
            style={{ minHeight: 38, padding: "0 14px" }}
          >
            {painelNovaAberto ? "Fechar criação" : "+ Nova campanha"}
          </Button>
        </div>

        {painelNovaAberto && (
          <form
            onSubmit={criarCampanha}
            style={{
              borderTop: "1px solid var(--hairline)",
              paddingTop: 14,
              marginTop: 4,
              display: "grid",
              gap: 14,
            }}
          >
            <div className="crm-relance-grid">
              <div className="crm-relance-field">
                <label htmlFor="nova-campanha-nome">Nome da campanha</label>
                <input
                  id="nova-campanha-nome"
                  className="crm-relance-input"
                  value={novaNome}
                  onChange={(e) => setNovaNome(e.target.value)}
                  placeholder="Ex.: Diagnósticos parados de setembro"
                  required
                />
              </div>
              <div className="crm-relance-field">
                <label htmlFor="nova-campanha-horas">Horas mínimas sem movimento no CRM</label>
                <input
                  id="nova-campanha-horas"
                  type="number"
                  min={0}
                  className="crm-relance-input"
                  value={novaHorasParado}
                  onChange={(e) => setNovaHorasParado(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="crm-relance-field">
              <label htmlFor="nova-campanha-objetivo">Objetivo em uma frase (sem prompt longo)</label>
              <input
                id="nova-campanha-objetivo"
                className="crm-relance-input"
                value={novaObjetivo}
                onChange={(e) => setNovaObjetivo(e.target.value)}
                placeholder="Ex.: Retomar quem já contou a dor no comercial e oferecer um diagnóstico rápido de 15 minutos"
                required
              />
            </div>

            <div className="crm-relance-field">
              <span className="crm-relance-field__label">Etapas elegíveis do funil</span>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {ETAPAS_OPCOES.map((et) => (
                  <label key={et.id} className="crm-relance-check">
                    <input
                      type="checkbox"
                      checked={novaEtapas.includes(et.id)}
                      onChange={() => alternarEtapaLista(novaEtapas, setNovaEtapas, et.id)}
                    />
                    {et.rotulo}
                  </label>
                ))}
              </div>
            </div>

            <div className="crm-relance-grid">
              <div className="crm-relance-field">
                <span className="crm-relance-field__label">Passagem de bastão quando o lead responder</span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className={`crm-v3-pill${novaEntregarPara === "claudio" ? " is-on" : ""}`}
                    onClick={() => setNovaEntregarPara("claudio")}
                  >
                    Entregar ao Cláudio
                  </button>
                  <button
                    type="button"
                    className={`crm-v3-pill${novaEntregarPara === "humano" ? " is-on" : ""}`}
                    onClick={() => setNovaEntregarPara("humano")}
                  >
                    Entregar a humano
                  </button>
                </div>
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                <label className="crm-relance-check">
                  <input
                    type="checkbox"
                    checked={novaProibirPreco}
                    onChange={(e) => setNovaProibirPreco(e.target.checked)}
                  />
                  Proibir preço ou condição na abertura (mesma cerca do Cláudio)
                </label>
                <label className="crm-relance-check">
                  <input
                    type="checkbox"
                    checked={novaApenasComContexto}
                    onChange={(e) => setNovaApenasComContexto(e.target.checked)}
                  />
                  Barrar contatos sem histórico ou nota real
                </label>
                {novaEntregarPara === "claudio" && (
                  <label className="crm-relance-check">
                    <input
                      type="checkbox"
                      checked={novaAutoClaudio}
                      onChange={(e) => setNovaAutoClaudio(e.target.checked)}
                    />
                    Permitir que o Cláudio assuma automaticamente a resposta
                  </label>
                )}
                <label className="crm-relance-check">
                  <input
                    type="checkbox"
                    checked={novaPopularDoCrm}
                    onChange={(e) => setNovaPopularDoCrm(e.target.checked)}
                  />
                  Puxar contatos elegíveis do CRM ao criar
                </label>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              {campanhas.length > 0 && (
                <Button variant="ghost" onClick={() => setPainelNovaAberto(false)}>
                  Cancelar
                </Button>
              )}
              <Button type="submit" loading={ocupado === "criar"}>
                Criar campanha
              </Button>
            </div>
          </form>
        )}
      </section>

      {/* Corpo da Campanha Selecionada */}
      {campanhaDetalhe && (
        <>
          {/* Barra de Operação da Campanha */}
          <section className="crm-relance-toolbar" aria-label="Controles da campanha selecionada">
            <div style={{ display: "grid", gap: 3, marginRight: "auto", minWidth: 220, flex: "1 1 260px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <strong style={{ font: "600 15px var(--font-sans)" }}>{campanhaDetalhe.nome}</strong>
                <span className={classeStatusCampanha(campanhaDetalhe.status)}>
                  {rotuloStatusCampanha(campanhaDetalhe.status)}
                </span>
              </div>
              <span style={{ font: "400 12.5px var(--font-sans)", color: "var(--fg-2)" }}>
                {campanhaDetalhe.objetivo}
              </span>
            </div>

            <Button
              variant="secondary"
              loading={ocupado === "simular"}
              onClick={simularTresLeads}
            >
              Simular em 3 leads
            </Button>

            {campanhaDetalhe.status === "emergencia" ? (
              <Button
                variant="primary"
                loading={ocupado === "retomar_emergencia"}
                onClick={() => executarAcaoCampanha("retomar_emergencia")}
              >
                Retomar da emergência
              </Button>
            ) : campanhaDetalhe.status === "ativa" ? (
              <Button
                variant="secondary"
                loading={ocupado === "pausar"}
                onClick={() => executarAcaoCampanha("pausar")}
              >
                Pausar campanha
              </Button>
            ) : (
              <Button
                variant="primary"
                disabled={emergenciaGlobal}
                loading={ocupado === "ativar"}
                onClick={() => executarAcaoCampanha("ativar")}
              >
                Ativar envio automático
              </Button>
            )}

            <Button
              variant="secondary"
              disabled={emEmergencia}
              loading={ocupado === "tick"}
              onClick={() => executarTick(false)}
            >
              Processar lote agora
            </Button>

            <Button
              variant="ghost"
              loading={ocupado === "sincronizar_crm"}
              onClick={() => executarAcaoCampanha("sincronizar_crm")}
            >
              Sincronizar fila do CRM
            </Button>

            <div
              style={{
                width: "100%",
                borderTop: "1px solid var(--hairline)",
                paddingTop: 10,
                marginTop: 4,
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
                <label className="crm-relance-check">
                  <input
                    type="checkbox"
                    checked={cicloAutoAtivo}
                    disabled={emEmergencia}
                    onChange={(e) => setCicloAutoAtivo(e.target.checked)}
                  />
                  Ciclo automático nesta aba (a cada 60s)
                </label>
                <label className="crm-relance-check" style={{ color: "var(--fg-2)" }}>
                  <input
                    type="checkbox"
                    checked={ignorarJanelaManual}
                    onChange={(e) => setIgnorarJanelaManual(e.target.checked)}
                  />
                  Ignorar janela de horário no lote manual
                </label>
              </div>

              <span style={{ font: "400 11.5px var(--font-mono)", color: "var(--fg-3)" }}>
                Ritmo: até {campanhaDetalhe.freios.maxPorHora}/h · {campanhaDetalhe.freios.maxPorDia}/dia · janela{" "}
                {campanhaDetalhe.freios.janelaInicioHora}h–{campanhaDetalhe.freios.janelaFimHora}h
                {ultimoTick ? ` · último ciclo ${formatarDataCurta(ultimoTick.executadoEm)}` : ""}
              </span>
            </div>
          </section>

          {/* Navegação das 4 Abas */}
          <div className="crm-relance-tabs" role="tablist" aria-label="Visões da campanha">
            {(
              [
                ["fila", `Fila e Auditoria (${metricas.totalFila})`],
                ["intencao", "Intenção e Freios"],
                ["csv", "Importar CSV com contexto"],
                ["optout", `Não contatar / Opt-out (${optOuts.length})`],
              ] as const
            ).map(([id, rotulo]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={aba === id}
                className="crm-relance-tab"
                onClick={() => setAba(id)}
              >
                {rotulo}
              </button>
            ))}
          </div>

          {/* ABA 1 — Métricas + Fila e Auditoria */}
          {aba === "fila" && (
            <div style={{ display: "grid", gap: 16 }}>
              <div className="crm-relance-kpis">
                <KpiCard
                  label="Na fila"
                  value={String(metricas.totalFila)}
                  caption={`${metricas.pendentes} pendentes · ${metricas.simulados} simulados`}
                />
                <KpiCard
                  label="Abordados"
                  value={String(metricas.enviados)}
                  caption="aberturas enviadas"
                />
                <KpiCard
                  label="Poupados / Ignorados"
                  value={String(metricas.ignorados + metricas.bloqueados)}
                  caption={`${metricas.ignorados} ignorados · ${metricas.bloqueados} bloqueados — calar é proteção`}
                />
                <KpiCard
                  label="Respostas"
                  value={String(metricas.respostas)}
                  caption={metricas.taxaRespostaTexto}
                />
                <KpiCard
                  label="Avanço no funil"
                  value={String(metricas.avancosEtapa)}
                  caption={metricas.taxaAvancoTexto}
                />
                <KpiCard
                  label="Vendas atribuídas"
                  value={String(metricas.vendasAtribuidas)}
                  caption="atribuição simples à campanha"
                />
                <KpiCard
                  label="Incidentes"
                  value={String(metricas.incidentes)}
                  caption={metricas.erros > 0 ? `${metricas.erros} falhas de disparo` : "trilha de segurança"}
                />
              </div>

              {metricas.motivosBloqueio.length > 0 && (
                <div className="crm-v3-surface" style={{ padding: "12px 16px" }}>
                  <span className="crm-label">Motivos mais comuns para segurar o disparo</span>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {metricas.motivosBloqueio.map((m) => (
                      <span key={m.motivo} className="crm-relance-badge">
                        {m.motivo} · {m.contagem}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {ultimaSimulacao?.avisoLlm && (
                <div className="crm-v3-surface" style={{ borderLeft: "2px solid var(--ag-ember, #d97706)" }}>
                  <strong style={{ font: "600 13px var(--font-sans)" }}>Observação da última simulação</strong>
                  <p style={{ margin: 0, font: "400 13px var(--font-sans)", color: "var(--fg-2)" }}>
                    {ultimaSimulacao.avisoLlm}
                  </p>
                </div>
              )}

              <div className="crm-v3-pills" role="group" aria-label="Filtrar fila por status">
                {(
                  [
                    ["todos", `Todos (${itens.length})`],
                    ["simulado", `Simulados (${itens.filter((i) => i.status === "simulado").length})`],
                    ["enviado", `Enviados (${itens.filter((i) => i.status === "enviado").length})`],
                    ["ignorado", `Ignorados (${itens.filter((i) => i.status === "ignorado").length})`],
                    ["bloqueado", `Bloqueados (${itens.filter((i) => i.status === "bloqueado").length})`],
                    ["adiado", `Adiados (${itens.filter((i) => i.status === "adiado").length})`],
                    ["pendente", `Pendentes (${itens.filter((i) => i.status === "pendente").length})`],
                  ] as const
                ).map(([fId, rotulo]) => (
                  <button
                    key={fId}
                    type="button"
                    className={`crm-v3-pill${filtroFila === fId ? " is-on" : ""}`}
                    onClick={() => setFiltroFila(fId)}
                  >
                    {rotulo}
                  </button>
                ))}
              </div>

              {itensFiltrados.length === 0 ? (
                <div className="crm-v3-surface" style={{ padding: 24 }}>
                  <strong style={{ font: "600 15px var(--font-sans)" }}>
                    Nenhum lead neste recorte da fila.
                  </strong>
                  <p style={{ margin: 0, font: "400 13.5px/1.5 var(--font-sans)", color: "var(--fg-2)" }}>
                    Use Sincronizar fila do CRM para buscar contatos com conversa parada ou importe um CSV com contexto real.
                  </p>
                </div>
              ) : (
                <ul className="crm-relance-audit-list">
                  {itensFiltrados.map((item) => (
                    <li key={item.id} className="crm-relance-audit-row">
                      <header
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 10,
                          flexWrap: "wrap",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          {item.contatoId ? (
                            <a
                              href={`#/contatos/${item.contatoId}`}
                              style={{ font: "600 15px var(--font-sans)", color: "var(--fg)", textDecoration: "none" }}
                            >
                              {item.nomeContato}
                            </a>
                          ) : (
                            <strong style={{ font: "600 15px var(--font-sans)" }}>{item.nomeContato}</strong>
                          )}
                          {item.empresa && (
                            <span style={{ font: "400 13px var(--font-sans)", color: "var(--fg-2)" }}>
                              · {item.empresa}
                            </span>
                          )}
                          <span style={{ font: "400 12px var(--font-mono)", color: "var(--fg-3)" }}>
                            {item.telefoneMascarado}
                          </span>
                          <StageChip
                            stage={stageDeEtapa(item.etapaAtual)}
                            lost={item.etapaAtual === "perdido"}
                          />
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <span className={classeStatusItem(item.status)}>
                            {rotuloStatusItem(item.status)}
                          </span>
                          {item.decisao && (
                            <span
                              className={
                                item.decisao === "abordar"
                                  ? "crm-relance-badge crm-relance-badge--ember"
                                  : "crm-relance-badge"
                              }
                            >
                              decisão: {item.decisao}
                            </span>
                          )}
                          {item.respondeuEm && (
                            <span className="crm-relance-badge crm-relance-badge--ok">Respondeu</span>
                          )}
                          {item.avancouEtapa && (
                            <span className="crm-relance-badge crm-relance-badge--ok">Avançou etapa</span>
                          )}
                          {item.virouVenda && (
                            <span className="crm-relance-badge crm-relance-badge--ok">Venda atribuída</span>
                          )}
                        </div>
                      </header>

                      <div style={{ font: "400 13px/1.45 var(--font-sans)", color: "var(--fg)" }}>
                        <strong style={{ fontWeight: 500, color: "var(--fg-2)" }}>Motivo registrado: </strong>
                        {item.motivo || "Na fila aguardando leitura do Ember."}
                      </div>

                      {item.contextoExtraido && (
                        <div style={{ font: "400 12.5px/1.45 var(--font-sans)", color: "var(--fg-2)" }}>
                          <strong style={{ fontWeight: 500 }}>Matéria-prima lida: </strong>
                          {item.contextoExtraido}
                        </div>
                      )}

                      {item.fontesLidas.length > 0 && (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                          <span className="crm-label" style={{ marginRight: 4 }}>
                            Fontes
                          </span>
                          {item.fontesLidas.map((f) => (
                            <span key={f} className="crm-relance-badge">
                              {f}
                            </span>
                          ))}
                        </div>
                      )}

                      {(item.ganchoIdentificado || item.mensagemGerada) && (
                        <div className="crm-relance-quote">
                          {item.ganchoIdentificado && (
                            <div
                              style={{
                                font: "500 11.5px/1.4 var(--font-mono)",
                                color: "var(--fg-2)",
                                marginBottom: item.mensagemGerada ? 6 : 0,
                              }}
                            >
                              Gancho: {item.ganchoIdentificado}
                            </div>
                          )}
                          {item.mensagemGerada && <div>{item.mensagemGerada}</div>}
                        </div>
                      )}

                      <footer
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 12,
                          font: "400 11px var(--font-mono)",
                          color: "var(--fg-3)",
                        }}
                      >
                        <span>
                          {item.processadoEm
                            ? `Avaliado em ${formatarDataCurta(item.processadoEm)}`
                            : `Na fila desde ${formatarDataCurta(item.criadoEm)}`}
                        </span>
                        {item.modeloUsado && <span>Modelo: {item.modeloUsado}</span>}
                        {item.custoTokens > 0 && <span>{item.custoTokens} tokens</span>}
                        {item.providerWhatsapp && <span>Canal: {item.providerWhatsapp}</span>}
                        {item.respondeuEm && <span>Resposta em {formatarDataCurta(item.respondeuEm)}</span>}
                      </footer>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* ABA 2 — Intenção, Conteúdo e Freios */}
          {aba === "intencao" && (
            <form onSubmit={salvarIntencaoEFreios} style={{ display: "grid", gap: 16 }}>
              <div className="crm-v3-surface" style={{ gap: 14 }}>
                <span className="crm-label">Intenção e filtro de entrada</span>
                <div className="crm-relance-field">
                  <label htmlFor="edit-objetivo">Objetivo da campanha em uma frase</label>
                  <input
                    id="edit-objetivo"
                    className="crm-relance-input"
                    value={editObjetivo}
                    onChange={(e) => setEditObjetivo(e.target.value)}
                  />
                </div>

                <div className="crm-relance-grid">
                  <div className="crm-relance-field">
                    <span className="crm-relance-field__label">Etapas consideradas no sincronismo do CRM</span>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {ETAPAS_OPCOES.map((et) => (
                        <label key={et.id} className="crm-relance-check">
                          <input
                            type="checkbox"
                            checked={editEtapas.includes(et.id)}
                            onChange={() => alternarEtapaLista(editEtapas, setEditEtapas, et.id)}
                          />
                          {et.rotulo}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: 10 }}>
                    <div className="crm-relance-field">
                      <label htmlFor="edit-horas-parado">Horas mínimas parado na etapa</label>
                      <input
                        id="edit-horas-parado"
                        type="number"
                        min={0}
                        className="crm-relance-input"
                        value={editHorasParado}
                        onChange={(e) => setEditHorasParado(Number(e.target.value))}
                      />
                    </div>
                    <label className="crm-relance-check">
                      <input
                        type="checkbox"
                        checked={editApenasContexto}
                        onChange={(e) => setEditApenasContexto(e.target.checked)}
                      />
                      Exigir contexto mínimo (conversa, briefing ou nota) para entrar na fila
                    </label>
                  </div>
                </div>
              </div>

              <div className="crm-v3-surface" style={{ gap: 14 }}>
                <span className="crm-label">Fontes reais e cercas de marca</span>
                <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
                  <label className="crm-relance-check">
                    <input
                      type="checkbox"
                      checked={editUsarHistorico}
                      onChange={(e) => setEditUsarHistorico(e.target.checked)}
                    />
                    Ler histórico de mensagens do CRM
                  </label>
                  <label className="crm-relance-check">
                    <input
                      type="checkbox"
                      checked={editUsarNotas}
                      onChange={(e) => setEditUsarNotas(e.target.checked)}
                    />
                    Ler notas e briefings comerciais
                  </label>
                </div>

                <div className="crm-relance-grid">
                  <div className="crm-relance-field">
                    <label htmlFor="edit-base-conteudo">Base de conteúdo e argumentos reais do negócio</label>
                    <textarea
                      id="edit-base-conteudo"
                      className="crm-relance-textarea"
                      value={editBaseConteudo}
                      onChange={(e) => setEditBaseConteudo(e.target.value)}
                      placeholder="Artigos publicados, materiais práticos, diagnósticos ou teses que o Ember pode oferecer como gancho verdadeiro."
                    />
                  </div>
                  <div className="crm-relance-field">
                    <label htmlFor="edit-novidades">Novidades de mercado relevantes ao seu cliente</label>
                    <textarea
                      id="edit-novidades"
                      className="crm-relance-textarea"
                      value={editNovidadesMercado}
                      onChange={(e) => setEditNovidadesMercado(e.target.value)}
                      placeholder="Mudanças do setor, prazos fiscais, sazonalidade ou fatos concretos informados por você."
                    />
                  </div>
                </div>

                <div className="crm-relance-grid">
                  <div className="crm-relance-field">
                    <label htmlFor="edit-tom-marca">Tom da marca na abertura</label>
                    <textarea
                      id="edit-tom-marca"
                      className="crm-relance-textarea"
                      value={editTomMarca}
                      onChange={(e) => setEditTomMarca(e.target.value)}
                      placeholder="Direto, elegante, sem intimidade fingida e com uma pergunta simples de responder."
                    />
                  </div>
                  <div className="crm-relance-field">
                    <label htmlFor="edit-temas-proibidos">Temas ou termos proibidos (um por linha ou separados por vírgula)</label>
                    <textarea
                      id="edit-temas-proibidos"
                      className="crm-relance-textarea"
                      value={editTemasProibidos}
                      onChange={(e) => setEditTemasProibidos(e.target.value)}
                      placeholder="promoção relâmpago&#10;últimas vagas&#10;desconto"
                    />
                  </div>
                </div>

                <div className="crm-relance-grid">
                  <div className="crm-relance-field">
                    <label htmlFor="edit-modelo-campanha">Modelo da IA nesta campanha</label>
                    <input
                      id="edit-modelo-campanha"
                      className="crm-relance-input"
                      style={{ fontFamily: "var(--font-mono)" }}
                      value={editModeloCampanha}
                      onChange={(e) => setEditModeloCampanha(e.target.value)}
                    />
                  </div>

                  <div style={{ display: "grid", gap: 8 }}>
                    <label className="crm-relance-check">
                      <input
                        type="checkbox"
                        checked={editProibirPreco}
                        onChange={(e) => setEditProibirPreco(e.target.checked)}
                      />
                      Proibir menção a preço, valor ou parcelamento na primeira mensagem
                    </label>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{ font: "500 12px var(--font-sans)" }}>Entregar resposta para:</span>
                      <button
                        type="button"
                        className={`crm-v3-pill${editEntregarPara === "claudio" ? " is-on" : ""}`}
                        onClick={() => setEditEntregarPara("claudio")}
                        style={{ minHeight: 32, fontSize: 12 }}
                      >
                        Cláudio
                      </button>
                      <button
                        type="button"
                        className={`crm-v3-pill${editEntregarPara === "humano" ? " is-on" : ""}`}
                        onClick={() => setEditEntregarPara("humano")}
                        style={{ minHeight: 32, fontSize: 12 }}
                      >
                        Humano
                      </button>
                    </div>
                    {editEntregarPara === "claudio" && (
                      <label className="crm-relance-check">
                        <input
                          type="checkbox"
                          checked={editAutoClaudio}
                          onChange={(e) => setEditAutoClaudio(e.target.checked)}
                        />
                        Cláudio responde automaticamente assim que o lead retornar
                      </label>
                    )}
                  </div>
                </div>
              </div>

              <div className="crm-v3-surface" style={{ gap: 14 }}>
                <span className="crm-label">Freios anti-bloqueio e respeito ao lead</span>
                <div className="crm-relance-grid-3">
                  <div className="crm-relance-field">
                    <label htmlFor="freio-max-hora">Máximo de envios por hora</label>
                    <input
                      id="freio-max-hora"
                      type="number"
                      min={1}
                      className="crm-relance-input"
                      value={editMaxHora}
                      onChange={(e) => setEditMaxHora(Number(e.target.value))}
                    />
                  </div>
                  <div className="crm-relance-field">
                    <label htmlFor="freio-max-dia">Máximo de envios por dia</label>
                    <input
                      id="freio-max-dia"
                      type="number"
                      min={1}
                      className="crm-relance-input"
                      value={editMaxDia}
                      onChange={(e) => setEditMaxDia(Number(e.target.value))}
                    />
                  </div>
                  <div className="crm-relance-field">
                    <label htmlFor="freio-espacamento">Espaçamento mínimo (segundos)</label>
                    <input
                      id="freio-espacamento"
                      type="number"
                      min={5}
                      className="crm-relance-input"
                      value={editEspacamentoSeg}
                      onChange={(e) => setEditEspacamentoSeg(Number(e.target.value))}
                    />
                  </div>
                  <div className="crm-relance-field">
                    <label htmlFor="freio-inicio">Hora inicial (0–23h)</label>
                    <input
                      id="freio-inicio"
                      type="number"
                      min={0}
                      max={23}
                      className="crm-relance-input"
                      value={editJanelaInicio}
                      onChange={(e) => setEditJanelaInicio(Number(e.target.value))}
                    />
                  </div>
                  <div className="crm-relance-field">
                    <label htmlFor="freio-fim">Hora limite (1–24h)</label>
                    <input
                      id="freio-fim"
                      type="number"
                      min={1}
                      max={24}
                      className="crm-relance-input"
                      value={editJanelaFim}
                      onChange={(e) => setEditJanelaFim(Number(e.target.value))}
                    />
                  </div>
                  <div className="crm-relance-field">
                    <label htmlFor="freio-cooldown">Quarentena após recusa (dias)</label>
                    <input
                      id="freio-cooldown"
                      type="number"
                      min={1}
                      className="crm-relance-input"
                      value={editCooldownDias}
                      onChange={(e) => setEditCooldownDias(Number(e.target.value))}
                    />
                  </div>
                </div>

                <label className="crm-relance-check">
                  <input
                    type="checkbox"
                    checked={editDiasUteis}
                    onChange={(e) => setEditDiasUteis(e.target.checked)}
                  />
                  Disparar somente em dias úteis (segunda a sexta)
                </label>

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <Button type="submit" loading={ocupado === "salvar_config"}>
                    Salvar intenção e freios
                  </Button>
                </div>
              </div>
            </form>
          )}

          {/* ABA 3 — Importar CSV com contexto */}
          {aba === "csv" && (
            <div style={{ display: "grid", gap: 16 }}>
              <form onSubmit={importarCsv} className="crm-v3-surface" style={{ gap: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ display: "grid", gap: 4 }}>
                    <span className="crm-label">Importação protegida</span>
                    <strong style={{ font: "600 15px var(--font-sans)" }}>
                      Lista com história entra. Lista fria só com telefone fica na porta.
                    </strong>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setCsvTexto(CSV_EXEMPLO_FICTICIO);
                      setCsvEhExemplo(true);
                      setResultadoCsv(null);
                    }}
                  >
                    Preencher exemplo de CSV
                  </Button>
                </div>

                <p className="crm-relance-field__help">
                  Cabeçalho esperado: <code>nome,telefone,empresa,contexto,notas,etapa</code>. Linhas sem{" "}
                  <code>contexto</code> nem <code>notas</code> são rejeitadas de propósito para impedir disparo genérico.
                </p>

                {csvEhExemplo && (
                  <span className="crm-relance-badge crm-relance-badge--ember" style={{ justifySelf: "start" }}>
                    Dados fictícios de exemplo carregados — inclui 1 contato sem histórico para demonstrar o bloqueio
                  </span>
                )}

                <div className="crm-relance-field">
                  <label htmlFor="csv-upload">Selecionar arquivo .csv do computador (opcional)</label>
                  <input
                    id="csv-upload"
                    type="file"
                    accept=".csv,text/csv"
                    onChange={lerArquivoCsv}
                    className="crm-relance-input"
                  />
                </div>

                <div className="crm-relance-field">
                  <label htmlFor="csv-conteudo">Conteúdo CSV</label>
                  <textarea
                    id="csv-conteudo"
                    className="crm-relance-textarea"
                    style={{ minHeight: 150, fontFamily: "var(--font-mono)", fontSize: 12.5 }}
                    value={csvTexto}
                    onChange={(e) => {
                      setCsvTexto(e.target.value);
                      setCsvEhExemplo(false);
                    }}
                    placeholder="nome,telefone,empresa,contexto,notas,etapa"
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  {csvTexto && (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setCsvTexto("");
                        setCsvEhExemplo(false);
                        setResultadoCsv(null);
                      }}
                    >
                      Limpar
                    </Button>
                  )}
                  <Button type="submit" loading={ocupado === "importar_csv"}>
                    Importar para esta campanha
                  </Button>
                </div>
              </form>

              {resultadoCsv && (
                <section className="crm-v3-surface" style={{ gap: 12 }} aria-label="Relatório da importação CSV">
                  <span className="crm-label">Relatório da importação</span>
                  <div className="crm-relance-grid-3">
                    <KpiCard
                      label="Importados na fila"
                      value={String(resultadoCsv.importados)}
                      caption={`de ${resultadoCsv.totalLinhas} linhas lidas`}
                    />
                    <KpiCard
                      label="Barrados sem contexto"
                      value={String(resultadoCsv.rejeitadosSemContexto)}
                      caption="telefone sem história não entra"
                    />
                    <KpiCard
                      label="Opt-out ou telefone inválido"
                      value={String(resultadoCsv.rejeitadosOptOut + resultadoCsv.rejeitadosTelefoneInvalido)}
                      caption={`${resultadoCsv.rejeitadosOptOut} opt-out · ${resultadoCsv.rejeitadosTelefoneInvalido} telefone inválido`}
                    />
                  </div>

                  {resultadoCsv.detalhesRejeicao.length > 0 && (
                    <div style={{ overflowX: "auto" }}>
                      <table className="crm-v3-table">
                        <thead>
                          <tr>
                            <th>Linha</th>
                            <th>Contato</th>
                            <th>Motivo da recusa</th>
                          </tr>
                        </thead>
                        <tbody>
                          {resultadoCsv.detalhesRejeicao.map((r, idx) => (
                            <tr key={`${r.linha}-${idx}`}>
                              <td className="num">{r.linha}</td>
                              <td>{r.nome || "—"}</td>
                              <td>{r.motivo}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              )}
            </div>
          )}

          {/* ABA 4 — Lista de não contatar (Opt-out) e Incidentes */}
          {aba === "optout" && (
            <div className="crm-relance-grid">
              <div style={{ display: "grid", gap: 14 }}>
                <form onSubmit={registrarOptOutManual} className="crm-v3-surface" style={{ gap: 12 }}>
                  <span className="crm-label">Bloqueio imediato (Opt-out)</span>
                  <strong style={{ font: "600 15px var(--font-sans)" }}>
                    Adicionar número à lista permanente de não contato
                  </strong>
                  <p className="crm-relance-field__help">
                    Vale para todas as campanhas do Ember. Se o número estiver pendente em alguma fila, é bloqueado na hora.
                  </p>

                  <div className="crm-relance-field">
                    <label htmlFor="opt-telefone">Telefone (com DDD)</label>
                    <input
                      id="opt-telefone"
                      className="crm-relance-input"
                      value={optTelefone}
                      onChange={(e) => setOptTelefone(e.target.value)}
                      placeholder="+55 11 99999-9999"
                      required
                    />
                  </div>
                  <div className="crm-relance-field">
                    <label htmlFor="opt-nome">Nome do contato (opcional)</label>
                    <input
                      id="opt-nome"
                      className="crm-relance-input"
                      value={optNome}
                      onChange={(e) => setOptNome(e.target.value)}
                      placeholder="Ex.: Roberto Almeida"
                    />
                  </div>
                  <div className="crm-relance-field">
                    <label htmlFor="opt-evidencia">Motivo ou evidência registrada</label>
                    <input
                      id="opt-evidencia"
                      className="crm-relance-input"
                      value={optEvidencia}
                      onChange={(e) => setOptEvidencia(e.target.value)}
                      placeholder="Ex.: Pediu por áudio para não receber mensagens comerciais"
                    />
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <Button type="submit" variant="secondary" loading={ocupado === "optout"}>
                      Bloquear número permanentemente
                    </Button>
                  </div>
                </form>

                <div className="crm-v3-surface" style={{ gap: 10 }}>
                  <span className="crm-label">Números protegidos ({optOuts.length})</span>
                  {optOuts.length === 0 ? (
                    <p className="crm-relance-field__help">
                      Nenhum opt-out registrado até agora. Pedidos de parada nas conversas também entram aqui automaticamente.
                    </p>
                  ) : (
                    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
                      {optOuts.map((o) => (
                        <li
                          key={o.id}
                          style={{
                            borderTop: "1px solid var(--hairline)",
                            paddingTop: 8,
                            display: "grid",
                            gap: 4,
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                            <strong style={{ font: "500 13px var(--font-sans)" }}>
                              {o.nomeContato ? `${o.nomeContato} · ` : ""}
                              <span style={{ fontFamily: "var(--font-mono)" }}>{o.telefoneMascarado}</span>
                            </strong>
                            <span className="crm-relance-badge">{rotuloMotivoOptOut(o.motivo)}</span>
                          </div>
                          {o.evidencia && (
                            <span style={{ font: "400 12px var(--font-sans)", color: "var(--fg-2)" }}>
                              {o.evidencia}
                            </span>
                          )}
                          <span style={{ font: "400 11px var(--font-mono)", color: "var(--fg-3)" }}>
                            Registrado em {formatarDataCurta(o.registradoEm)}
                            {o.expiraEm ? ` · protegido até ${formatarDataCurta(o.expiraEm)}` : " · permanente"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="crm-v3-surface" style={{ gap: 10 }}>
                <span className="crm-label">Trilha de incidentes ({incidentesUnificados.length})</span>
                <strong style={{ font: "600 15px var(--font-sans)" }}>
                  Eventos de freio, sessão e paradas registradas
                </strong>
                {incidentesUnificados.length === 0 ? (
                  <p className="crm-relance-field__help">
                    Nenhum incidente operacional registrado. Se a sessão do WhatsApp cair ou estourar limite, o Ember pausa a campanha e registra aqui.
                  </p>
                ) : (
                  <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 10 }}>
                    {incidentesUnificados.map((inc) => (
                      <li
                        key={inc.id}
                        style={{
                          borderTop: "1px solid var(--hairline)",
                          paddingTop: 10,
                          display: "grid",
                          gap: 4,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                          <span
                            className={
                              inc.tipo === "parada_emergencia" || inc.tipo === "erro_envio" || inc.tipo === "sessao_desconectada"
                                ? "crm-relance-badge crm-relance-badge--danger"
                                : "crm-relance-badge crm-relance-badge--ember"
                            }
                          >
                            {rotuloTipoIncidente(inc.tipo)}
                          </span>
                          <time style={{ font: "400 11px var(--font-mono)", color: "var(--fg-3)" }}>
                            {formatarDataCurta(inc.em)}
                          </time>
                        </div>
                        <span style={{ font: "400 12.5px/1.45 var(--font-sans)", color: "var(--fg)" }}>
                          {inc.detalhe}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </CrmV3Page>
  );
}
