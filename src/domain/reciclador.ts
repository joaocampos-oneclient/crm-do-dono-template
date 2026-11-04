/**
 * Domínio puro e guardrails determinísticos do Agente Ember / Relance (Reciclador de Oportunidades).
 * Zero dependência de banco, rede ou filesystem — roda idêntico em servidor, cliente e testes.
 */
import type {
  CercasCampanhaReciclador,
  FreiosCampanhaReciclador,
  ItemFilaReciclador,
  MetricasCampanhaReciclador,
  OptOutRegistro,
  StatusCampanhaReciclador,
} from "./reciclador-types";
import { taxaOuAviso, telefoneDigitos } from "./rules";
import type { EtapaId } from "./types";

export * from "./reciclador-types";

function normalizarTexto(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function apenasDigitos(t: string): string {
  return t.replace(/\D/g, "");
}

function mesmoTelefone(a: string, b: string): boolean {
  const da = telefoneDigitos(a);
  const db = telefoneDigitos(b);
  if (!da || !db) return false;
  if (da === db) return true;
  const sa = da.slice(-11);
  const sb = db.slice(-11);
  return sa.length >= 10 && sa === sb;
}

/** Mascara telefone preservando DDD (quando disponível) e os 4 dígitos finais. */
export function mascararTelefoneReciclador(t: string): string {
  const d = apenasDigitos(t);
  if (!d) return "—";
  if (d.length < 6) return "***";
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) {
    return `(${d.slice(2, 4)}) •••••-${d.slice(-4)}`;
  }
  if (d.length === 10 || d.length === 11) {
    return `(${d.slice(0, 2)}) •••••-${d.slice(-4)}`;
  }
  return `•••${d.slice(-4)}`;
}

/**
 * Detecta oferta comercial ou preço explícito na mensagem de abertura,
 * sem falso-positivo em frases neutras como "gerar valor na sua rotina" ou "condição da equipe".
 */
export function mencionaPrecoComercial(texto: string): boolean {
  if (!texto) return false;
  if (/R\$\s*\d?/i.test(texto)) return true;

  const norm = normalizarTexto(texto);
  const padroes: RegExp[] = [
    /\b\d+[\d.,]*\s*(?:reais|real)\b/,
    /\b\d+\s*x\s*(?:de\s*)?\d+/,
    /\bprec(?:o|os)\b/,
    /\bdescontos?\b/,
    /\bparcel(?:a|as|ado|ada|amento|amos|ar)\b/,
    /\bcupons?\b|\bcupom\b/,
    /\bcheckout\b/,
    /\bboletos?\b/,
    /\bmensalidades?\b/,
    /\bcondic(?:ao|oes)\s+(?:especial|especiais|exclusiva|comercial|imperdivel|de\s+pagamento)\b/,
    /\bofertas?\s+(?:especial|especiais|exclusiva|relampago|imperdivel|da\s+semana|do\s+mes)\b/,
    /\bvalor\s+(?:de|do\s+plano|da\s+mensalidade|da\s+parcela|total|promocional|a\s+vista)\b/,
    /\binvestimento\s+de\b(?!\s+tempo\b)/,
    /\bpix\b/,
  ];

  return padroes.some((rx) => rx.test(norm));
}

/** Detecta pedido explícito de opt-out / descadastro / bloqueio (LGPD). */
export function detectarPedidoOptOut(texto: string): boolean {
  const norm = normalizarTexto(texto);
  if (!norm) return false;

  if (/^(?:stop|parar|sair|descadastrar|cancelar|opt-?out)$/.test(norm)) {
    return true;
  }

  const padroes: RegExp[] = [
    /\bnao\s+me\s+procur/,
    /\bnao\s+me\s+mand(?:e|a)\b/,
    /\bnao\s+mand(?:e|a)\s+mais\b/,
    /\bpar(?:e|a|em)\s+de\s+(?:me\s+)?(?:mandar|enviar|escrever|chamar|ligar)\b/,
    /\bparar\s+de\s+receber\b/,
    /\bsair\s+da\s+lista\b/,
    /\b(?:me\s+)?tir(?:a|e|em)\s+(?:meu\s+nome\s+|meu\s+numero\s+)?da\s+lista\b/,
    /\bremov(?:a|er)\s+(?:meu\s+numero|da\s+lista|meu\s+contato)\b/,
    /\bexclu(?:a|ir)\s+meu\s+(?:numero|contato)\b/,
    /\bdescadastr/,
    /\bnao\s+quero\s+(?:mais\s+)?(?:contato|receber|mensagen)/,
    /\bnao\s+entre\s+mais\s+em\s+contato\b/,
    /\bopt-?out\b/,
    /\bvou\s+(?:te\s+)?bloquear\b/,
  ];

  if (padroes.some((rx) => rx.test(norm))) return true;

  // "bloqueado" como sinal de bloqueio de contato, evitando falso-positivo óbvio ("cartão bloqueado")
  if (/\bbloquead[oa]\b/.test(norm) && !/\b(?:cartao|acesso|painel|login|cadastro)\s+bloquead[oa]\b/.test(norm)) {
    return true;
  }

  return false;
}

/** Detecta recusa comercial explícita no histórico recente. */
export function detectarRecusaRecente(texto: string): boolean {
  const norm = normalizarTexto(texto);
  if (!norm) return false;

  const padroes: RegExp[] = [
    /\bnao\s+tenho\s+interesse\b/,
    /\bsem\s+interesse\b/,
    /\bzero\s+interesse\b/,
    /\bja\s+(?:fechei|contratei|resolvi|escolhi|fechamos|resolvemos)\b/,
    /\bfechei\s+com\s+outr/,
    /\bagora\s+nao\b/,
    /\bn(?:esse|este)\s+momento\s+nao\b/,
    /\btalvez\s+ano\s+que\s+vem\b/,
    /\bso\s+ano\s+que\s+vem\b/,
    /\bdeixa\s+pro?\s+ano\s+que\s+vem\b/,
    /\bnao\s+faz\s+sentido\s+agora\b/,
    /\bnao\s+vou\s+seguir\b/,
  ];

  return padroes.some((rx) => rx.test(norm));
}

function mensagemTrivial(texto: string): boolean {
  const norm = normalizarTexto(texto).replace(/[?!.,;:…\-_/\\()[\]"']+/g, " ").replace(/\s+/g, " ").trim();
  if (!norm) return true;
  return /^(?:oi+|ola+|opa+|e\s+ai|bom\s+dia|boa\s+tarde|boa\s+noite|tudo\s+bem|td\s+bem|tudo\s+certo|ok+|sim|pode|claro|perfeito|obrigad[oa]|valeu|amem|👍|🙏|\d{1,2})$/.test(
    norm,
  );
}

function mensagemAvisoTroca(texto: string): boolean {
  const norm = normalizarTexto(texto);
  return (
    norm.includes("daqui pra frente quem fala com voce e") ||
    norm.includes("a conversa voltou para o claudio")
  );
}

/**
 * Exige matéria-prima real (>= 20 caracteres de substância não-trivial).
 * Nome + telefone sozinhos ou um único "oi" bloqueiam o envio ("calar é mais inteligente").
 */
export function temContextoMinimo(opts: {
  mensagens: Array<{ autor: string; texto: string }>;
  notas: string[];
  briefing?: { dor?: string; meta?: string } | null;
  contextoImportado?: string;
}): { ok: boolean; contextoExtraido: string; fontesLidas: string[]; motivo?: string } {
  const fontesLidas: string[] = [];
  const blocosSubstancia: string[] = [];
  const resumoPartes: string[] = [];

  // 1. Mensagens substantivas do contato (e mensagens humanas de contexto, ignorando saudação robótica fria)
  const msgsContato = (opts.mensagens ?? [])
    .filter((m) => m.autor === "contato" && m.texto && !mensagemTrivial(m.texto) && m.texto.trim() !== "(mídia ou texto vazio)")
    .map((m) => m.texto.trim());

  const msgsHumano = (opts.mensagens ?? [])
    .filter(
      (m) =>
        m.autor === "humano" &&
        m.texto &&
        !mensagemTrivial(m.texto) &&
        !mensagemAvisoTroca(m.texto) &&
        m.texto.trim().length >= 25,
    )
    .map((m) => m.texto.trim());

  if (msgsContato.length > 0 || msgsHumano.length > 0) {
    fontesLidas.push("historico_mensagens");
    const trechos = [...msgsContato.slice(-4), ...msgsHumano.slice(-2)];
    blocosSubstancia.push(trechos.join(" "));
    resumoPartes.push(`Conversa: ${trechos.join(" · ")}`);
  }

  // 2. Notas manuais do CRM
  const notasLimpa = (opts.notas ?? []).map((n) => n.trim()).filter((n) => n.length >= 5);
  if (notasLimpa.length > 0) {
    fontesLidas.push("notas_crm");
    blocosSubstancia.push(notasLimpa.join(" "));
    resumoPartes.push(`Notas: ${notasLimpa.join(" · ")}`);
  }

  // 3. Briefing estruturado
  const dor = opts.briefing?.dor?.trim();
  const meta = opts.briefing?.meta?.trim();
  const dorValida = dor && normalizarTexto(dor) !== "nao informada" ? dor : "";
  const metaValida = meta && normalizarTexto(meta) !== "nao informada" ? meta : "";
  if (dorValida || metaValida) {
    fontesLidas.push("briefing");
    const partesBriefing = [dorValida, metaValida].filter(Boolean);
    blocosSubstancia.push(partesBriefing.join(" "));
    resumoPartes.push(
      `Briefing: ${[dorValida ? `dor "${dorValida}"` : "", metaValida ? `meta "${metaValida}"` : ""].filter(Boolean).join(", ")}`,
    );
  }

  // 4. Contexto importado (ex.: CSV com histórico/observações)
  const imp = opts.contextoImportado?.trim() ?? "";
  if (imp && !mensagemTrivial(imp)) {
    fontesLidas.push("csv_importado");
    blocosSubstancia.push(imp);
    resumoPartes.push(`Importado: ${imp}`);
  }

  const substanciaTotal = blocosSubstancia.join(" ").replace(/\s+/g, " ").trim();
  if (substanciaTotal.length < 20) {
    return {
      ok: false,
      contextoExtraido: "",
      fontesLidas: [],
      motivo: "Sem contexto mínimo — calar é mais inteligente",
    };
  }

  return {
    ok: true,
    contextoExtraido: resumoPartes.join(" | ").slice(0, 900),
    fontesLidas,
  };
}

/** Verifica se o instante `agoraIso` cai dentro dos dias úteis e janela de horário da campanha. */
export function dentroDaJanelaHorario(
  agoraIso: string,
  freios: FreiosCampanhaReciclador,
  timeZone = "America/Sao_Paulo",
): { ok: boolean; motivo?: string } {
  const data = new Date(agoraIso);
  if (Number.isNaN(data.getTime())) {
    return { ok: false, motivo: "Horário inválido para verificação de janela." };
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "numeric",
    hour12: false,
  }).formatToParts(data);

  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const rawHour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const hour = rawHour === 24 ? 0 : rawHour;

  if (freios.apenasDiasUteis && (weekday === "Sat" || weekday === "Sun")) {
    return {
      ok: false,
      motivo: "Fora dos dias úteis configurados na campanha.",
    };
  }

  if (hour < freios.janelaInicioHora || hour >= freios.janelaFimHora) {
    return {
      ok: false,
      motivo: `Fora da janela de horário (${freios.janelaInicioHora}h–${freios.janelaFimHora}h).`,
    };
  }

  return { ok: true };
}

export type CodigoBloqueioPreLlm =
  | "parada_emergencia"
  | "cliente_ativo"
  | "ja_abordado"
  | "opt_out"
  | "opt_out_historico"
  | "recusa_recente"
  | "cooldown_48h"
  | "sem_contexto";

export interface EntradaGuardrailsPreLlm {
  agoraIso: string;
  campanhaStatus?: StatusCampanhaReciclador;
  emergenciaGlobal?: boolean;
  telefone: string;
  etapaAtual?: EtapaId;
  jaAbordadoNaCampanha?: boolean;
  optOuts?: OptOutRegistro[];
  mensagens?: Array<{ autor: string; texto: string; em?: string }>;
  notas?: string[];
  briefing?: { dor?: string; meta?: string } | null;
  contextoImportado?: string;
  cooldownRecusaDias?: number;
  cooldownHorasAutomatica?: number;
}

export interface ResultadoGuardrailPreLlm {
  ok: boolean;
  codigo?: CodigoBloqueioPreLlm;
  motivo?: string;
  contextoExtraido: string;
  fontesLidas: string[];
}

/**
 * Guardrails duros ANTES de chamar o modelo:
 * emergência -> cliente ativo -> idempotência -> opt-out -> recusa recente -> cooldown 48h -> contexto mínimo.
 */
export function avaliarGuardrailsPreLlm(opts: EntradaGuardrailsPreLlm): ResultadoGuardrailPreLlm {
  const agoraMs = Date.parse(opts.agoraIso);

  if (opts.emergenciaGlobal || opts.campanhaStatus === "emergencia") {
    return {
      ok: false,
      codigo: "parada_emergencia",
      motivo: "Parada de emergência ativa.",
      contextoExtraido: "",
      fontesLidas: [],
    };
  }

  if (opts.etapaAtual === "pago" || opts.etapaAtual === "dentro") {
    return {
      ok: false,
      codigo: "cliente_ativo",
      motivo: "Contato já é cliente ativo (pago/dentro).",
      contextoExtraido: "",
      fontesLidas: [],
    };
  }

  if (opts.jaAbordadoNaCampanha) {
    return {
      ok: false,
      codigo: "ja_abordado",
      motivo: "Lead já recebeu abertura nesta campanha.",
      contextoExtraido: "",
      fontesLidas: [],
    };
  }

  // Lista explícita de opt-out / recusa registrada
  const optAtivo = (opts.optOuts ?? []).find((o) => {
    if (!mesmoTelefone(o.telefoneDigitos, opts.telefone)) return false;
    if (!o.expiraEm) return true;
    const expMs = Date.parse(o.expiraEm);
    return Number.isNaN(expMs) || expMs > agoraMs;
  });

  if (optAtivo) {
    if (optAtivo.motivo === "recusa_recente") {
      return {
        ok: false,
        codigo: "recusa_recente",
        motivo: "Recusa recente registrada para este contato.",
        contextoExtraido: "",
        fontesLidas: [],
      };
    }
    return {
      ok: false,
      codigo: "opt_out",
      motivo: "Contato bloqueado por opt-out / lista de não contatar.",
      contextoExtraido: "",
      fontesLidas: [],
    };
  }

  const mensagens = opts.mensagens ?? [];

  // Opt-out presente nas mensagens do lead
  const pediuOptOutNoHistorico = mensagens.some(
    (m) => m.autor === "contato" && detectarPedidoOptOut(m.texto),
  );
  if (pediuOptOutNoHistorico) {
    return {
      ok: false,
      codigo: "opt_out_historico",
      motivo: "Lead pediu para não ser contatado no histórico.",
      contextoExtraido: "",
      fontesLidas: [],
    };
  }

  // Recusa dentro de cooldownRecusaDias
  const cooldownRecusaDias = opts.cooldownRecusaDias ?? 30;
  const janelaRecusaMs = cooldownRecusaDias * 86_400_000;
  const recusouRecentemente = mensagens.some((m) => {
    if (m.autor !== "contato" || !detectarRecusaRecente(m.texto)) return false;
    if (!m.em) return true;
    const msgMs = Date.parse(m.em);
    if (Number.isNaN(msgMs) || Number.isNaN(agoraMs)) return true;
    return agoraMs - msgMs <= janelaRecusaMs;
  });

  if (recusouRecentemente) {
    return {
      ok: false,
      codigo: "recusa_recente",
      motivo: `Lead recusou o tema recentemente (janela de ${cooldownRecusaDias} dias).`,
      contextoExtraido: "",
      fontesLidas: [],
    };
  }

  // Cooldown mínimo de 48h desde a última mensagem enviada (robo ou humano)
  const cooldownHoras = opts.cooldownHorasAutomatica ?? 48;
  if (cooldownHoras > 0 && !Number.isNaN(agoraMs)) {
    const limiteCooldownMs = cooldownHoras * 3_600_000;
    const outboundRecente = mensagens.some((m) => {
      if (m.autor !== "robo" && m.autor !== "humano") return false;
      if (!m.em) return false;
      const msgMs = Date.parse(m.em);
      if (Number.isNaN(msgMs)) return false;
      const diff = agoraMs - msgMs;
      return diff >= 0 && diff < limiteCooldownMs;
    });
    if (outboundRecente) {
      return {
        ok: false,
        codigo: "cooldown_48h",
        motivo: `Mensagem enviada nas últimas ${cooldownHoras}h (cooldown anti-insistência).`,
        contextoExtraido: "",
        fontesLidas: [],
      };
    }
  }

  // Contexto mínimo
  const ctx = temContextoMinimo({
    mensagens: mensagens.map((m) => ({ autor: m.autor, texto: m.texto })),
    notas: opts.notas ?? [],
    briefing: opts.briefing,
    contextoImportado: opts.contextoImportado,
  });

  if (!ctx.ok) {
    return {
      ok: false,
      codigo: "sem_contexto",
      motivo: ctx.motivo ?? "Sem contexto mínimo — calar é mais inteligente",
      contextoExtraido: "",
      fontesLidas: [],
    };
  }

  return {
    ok: true,
    contextoExtraido: ctx.contextoExtraido,
    fontesLidas: ctx.fontesLidas,
  };
}

export type CodigoBloqueioPosLlm =
  | "texto_vazio"
  | "texto_longo"
  | "menciona_preco"
  | "tema_proibido"
  | "cliche_generico";

export interface ResultadoGuardrailPosLlm {
  ok: boolean;
  codigo?: CodigoBloqueioPosLlm;
  motivo?: string;
}

const PADROES_ANTI_CLICHE: RegExp[] = [
  /\boi,?\s*tudo\s+bem\??\s*aqui\s+e\b/,
  /\boi,?\s*tudo\s+bem\??\s*sou\b/,
  /\bola,?\s*tudo\s+bem\??\s*(?:aqui\s+e|sou)\b/,
  /\bpassando\s+(?:aqui\s+)?(?:para|pra)\b/,
  /\bcondicao\s+especial\s+(?:esse|este|nesse|neste)\s+mes\b/,
  /\boi,?\s*sumid[oa]\b/,
];

/**
 * Guardrails duros DEPOIS do LLM redigir a primeira mensagem:
 * tamanho, preço comercial, temas proibidos e filtro anti-clichê.
 */
export function avaliarGuardrailsPosLlm(
  texto: string,
  cercas: Pick<CercasCampanhaReciclador, "proibirPreco">,
  temasProibidos: string[] = [],
): ResultadoGuardrailPosLlm {
  const limpo = texto.trim();
  if (!limpo) {
    return {
      ok: false,
      codigo: "texto_vazio",
      motivo: "Mensagem gerada está vazia.",
    };
  }

  if (limpo.length > 650) {
    return {
      ok: false,
      codigo: "texto_longo",
      motivo: "Mensagem excedeu 650 caracteres para abertura de WhatsApp.",
    };
  }

  if (cercas.proibirPreco !== false && mencionaPrecoComercial(limpo)) {
    return {
      ok: false,
      codigo: "menciona_preco",
      motivo: "Bloqueado: abertura menciona preço, desconto ou condição comercial.",
    };
  }

  const normTexto = normalizarTexto(limpo);

  for (const tema of temasProibidos) {
    const normTema = normalizarTexto(tema);
    if (normTema && normTexto.includes(normTema)) {
      return {
        ok: false,
        codigo: "tema_proibido",
        motivo: `Bloqueado: mensagem toca em tema proibido ("${tema.trim()}").`,
      };
    }
  }

  if (PADROES_ANTI_CLICHE.some((rx) => rx.test(normTexto))) {
    return {
      ok: false,
      codigo: "cliche_generico",
      motivo: "Bloqueado pelo filtro anti-clichê: abertura genérica sem cheiro de negócio.",
    };
  }

  return { ok: true };
}

export interface LinhaCsvAceita {
  linha: number;
  nome: string;
  telefone: string;
  telefoneDigitos: string;
  empresa: string;
  contexto: string;
  notas: string;
  contextoCombinado: string;
  etapa: EtapaId;
}

export interface LinhaCsvRejeitada {
  linha: number;
  nome: string;
  tipo: "sem_contexto" | "telefone_invalido";
  motivo: string;
}

export interface ParseCsvRecicladorResult {
  totalLinhas: number;
  aceitas: LinhaCsvAceita[];
  rejeitadas: LinhaCsvRejeitada[];
}

function detectarDelimitador(primeiraLinha: string): "," | ";" {
  let virgulas = 0;
  let pontoVirgulas = 0;
  let emAspas = false;
  for (let i = 0; i < primeiraLinha.length; i++) {
    const ch = primeiraLinha[i];
    if (ch === '"') emAspas = !emAspas;
    else if (!emAspas && ch === ",") virgulas++;
    else if (!emAspas && ch === ";") pontoVirgulas++;
  }
  return pontoVirgulas > virgulas ? ";" : ",";
}

function parseLinhasCsv(texto: string, delim: "," | ";"): string[][] {
  const linhas: string[][] = [];
  let atual: string[] = [];
  let campo = "";
  let emAspas = false;

  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (emAspas) {
      if (ch === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i++;
        } else {
          emAspas = false;
        }
      } else {
        campo += ch;
      }
      continue;
    }

    if (ch === '"') {
      emAspas = true;
    } else if (ch === delim) {
      atual.push(campo.trim());
      campo = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && texto[i + 1] === "\n") i++;
      atual.push(campo.trim());
      campo = "";
      if (atual.some((c) => c.length > 0)) {
        linhas.push(atual);
      }
      atual = [];
    } else {
      campo += ch;
    }
  }

  if (campo.length > 0 || atual.length > 0) {
    atual.push(campo.trim());
    if (atual.some((c) => c.length > 0)) {
      linhas.push(atual);
    }
  }

  return linhas;
}

const ETAPAS_VALIDAS: EtapaId[] = [
  "novo",
  "conversa",
  "handoff",
  "briefing",
  "proposta",
  "oferta",
  "pago",
  "dentro",
  "perdido",
];

function mapearEtapaCsv(bruto: string): EtapaId {
  const norm = normalizarTexto(bruto);
  const encontrada = ETAPAS_VALIDAS.find((e) => e === norm);
  return encontrada ?? "conversa";
}

/**
 * Faz o parse de CSV (`,` ou `;`) exigindo telefone válido (>= 10 dígitos)
 * e contexto/notas reais (>= 15 caracteres) — rejeitando listas frias só de telefone.
 */
export function parseCsvLeadsComContexto(csv: string): ParseCsvRecicladorResult {
  const limpo = csv.replace(/^\uFEFF/, "").trim();
  if (!limpo) {
    return { totalLinhas: 0, aceitas: [], rejeitadas: [] };
  }

  const primeiraLinha = limpo.split(/\r?\n/)[0] ?? "";
  const delim = detectarDelimitador(primeiraLinha);
  const matriz = parseLinhasCsv(limpo, delim);
  if (matriz.length === 0) {
    return { totalLinhas: 0, aceitas: [], rejeitadas: [] };
  }

  const cabecalhoNorm = matriz[0].map(normalizarTexto);
  const pareceCabecalho = cabecalhoNorm.some((c) =>
    ["nome", "lead", "contato", "cliente", "telefone", "celular", "whatsapp", "fone", "contexto", "historico", "notas", "observacoes"].includes(c),
  );

  const acharIndice = (nomes: string[], fallback: number): number => {
    if (!pareceCabecalho) return fallback;
    return cabecalhoNorm.findIndex((col) => nomes.some((n) => col === n || col.includes(n)));
  };

  const idxNome = acharIndice(["nome", "lead", "contato", "cliente", "name"], 0);
  const idxTel = acharIndice(["telefone", "celular", "whatsapp", "fone", "tel", "phone", "numero"], 1);
  const idxEmpresa = acharIndice(["empresa", "negocio", "clinica", "loja", "company"], -1);
  const idxContexto = acharIndice(["contexto", "historico", "conversa", "resumo", "dor", "context"], 2);
  const idxNotas = acharIndice(["notas", "nota", "observacoes", "observacao", "obs", "notes"], 3);
  const idxEtapa = acharIndice(["etapa", "fase", "stage", "status_funil"], -1);

  const dados = pareceCabecalho ? matriz.slice(1) : matriz;
  const offsetLinha = pareceCabecalho ? 2 : 1;

  const aceitas: LinhaCsvAceita[] = [];
  const rejeitadas: LinhaCsvRejeitada[] = [];

  dados.forEach((cols, idx) => {
    const numLinha = idx + offsetLinha;
    const nome = (idxNome >= 0 ? cols[idxNome] : "")?.trim() || `Lead linha ${numLinha}`;
    const telBruto = (idxTel >= 0 ? cols[idxTel] : "")?.trim() || "";
    const empresa = (idxEmpresa >= 0 ? cols[idxEmpresa] : "")?.trim() || "";
    const contexto = (idxContexto >= 0 ? cols[idxContexto] : "")?.trim() || "";
    const notas = (idxNotas >= 0 ? cols[idxNotas] : "")?.trim() || "";
    const etapaBruta = (idxEtapa >= 0 ? cols[idxEtapa] : "")?.trim() || "";

    const digitosBrutos = apenasDigitos(telBruto);
    if (digitosBrutos.length < 10 || digitosBrutos.length > 15) {
      rejeitadas.push({
        linha: numLinha,
        nome,
        tipo: "telefone_invalido",
        motivo: "Telefone ausente ou inválido (mínimo 10 dígitos).",
      });
      return;
    }

    const combinado = [contexto, notas].filter(Boolean).join(" · ").replace(/\s+/g, " ").trim();
    if (combinado.length < 15 || mensagemTrivial(combinado)) {
      rejeitadas.push({
        linha: numLinha,
        nome,
        tipo: "sem_contexto",
        motivo: "Lista fria rejeitada: informe pelo menos 15 caracteres de contexto ou histórico real.",
      });
      return;
    }

    aceitas.push({
      linha: numLinha,
      nome,
      telefone: telBruto,
      telefoneDigitos: telefoneDigitos(telBruto),
      empresa,
      contexto,
      notas,
      contextoCombinado: combinado,
      etapa: mapearEtapaCsv(etapaBruta),
    });
  });

  return {
    totalLinhas: dados.length,
    aceitas,
    rejeitadas,
  };
}

/** Calcula métricas reais da campanha usando `taxaOuAviso` (sem inventar percentual com n < 10). */
export function calcularMetricasCampanha(
  itens: ItemFilaReciclador[],
  incidentesCount: number,
): MetricasCampanhaReciclador {
  let pendentes = 0;
  let simulados = 0;
  let enviados = 0;
  let adiados = 0;
  let ignorados = 0;
  let bloqueados = 0;
  let erros = 0;
  let respostas = 0;
  let avancosEtapa = 0;
  let vendasAtribuidas = 0;

  const contagemMotivos = new Map<string, number>();

  for (const item of itens) {
    switch (item.status) {
      case "pendente":
        pendentes++;
        break;
      case "simulado":
        simulados++;
        break;
      case "enviado":
        enviados++;
        break;
      case "adiado":
        adiados++;
        break;
      case "ignorado":
        ignorados++;
        break;
      case "bloqueado":
        bloqueados++;
        break;
      case "erro":
        erros++;
        break;
    }

    if (item.respondeuEm) respostas++;
    if (item.avancouEtapa) avancosEtapa++;
    if (item.virouVenda || (item.status === "enviado" && (item.etapaAtual === "pago" || item.etapaAtual === "dentro"))) {
      vendasAtribuidas++;
    }

    if ((item.status === "bloqueado" || item.status === "ignorado") && item.motivo?.trim()) {
      const chave = item.motivo.trim();
      contagemMotivos.set(chave, (contagemMotivos.get(chave) ?? 0) + 1);
    }
  }

  const motivosBloqueio = Array.from(contagemMotivos.entries())
    .map(([motivo, contagem]) => ({ motivo, contagem }))
    .sort((a, b) => b.contagem - a.contagem);

  return {
    totalFila: itens.length,
    pendentes,
    simulados,
    enviados,
    adiados,
    ignorados,
    bloqueados,
    erros,
    respostas,
    avancosEtapa,
    vendasAtribuidas,
    taxaRespostaTexto: taxaOuAviso(respostas, enviados, 10),
    taxaAvancoTexto: taxaOuAviso(avancosEtapa, enviados, 10),
    motivosBloqueio,
    incidentes: incidentesCount,
  };
}
