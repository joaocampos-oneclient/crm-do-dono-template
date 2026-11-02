import { crmConfig } from "@crm/config";
import { decidir } from "./decision-engine";
import { mencionaPreco } from "@/domain/rules";
import type { AgenteSlug, ExecucaoEntrada, ResultadoAgente } from "./types";
import { ExecucaoSaida } from "./types";

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
    default: {
      const _x: never = slug;
      throw new Error(`Agente desconhecido: ${_x}`);
    }
  }
}

async function claudio(entrada: ExecucaoEntrada): Promise<ResultadoAgente> {
  const rascunho = String(entrada.contexto.rascunho ?? "Oi! Posso te fazer uma pergunta rápida para te ajudar melhor?");
  if (mencionaPreco(rascunho)) {
    return {
      custoTokens: 0,
      usadoJev: false,
      saida: ExecucaoSaida.parse({
        resumo: "Bloqueado: Cláudio nunca fala preço.",
        acaoSugerida: "Reescrever sem preço e deixar o humano fechar.",
        requerAprovacao: true,
        payload: { bloqueado: true, motivo: "preco" },
      }),
    };
  }
  return {
    custoTokens: 0,
    usadoJev: false,
    saida: ExecucaoSaida.parse({
      resumo: `${cfg.claudio.nome} pronto para enviar.`,
      acaoSugerida: "Enviar mensagem (sem preço).",
      requerAprovacao: false,
      payload: { texto: rascunho },
    }),
  };
}

async function scout(entrada: ExecucaoEntrada): Promise<ResultadoAgente> {
  const texto = String(entrada.contexto.textoConversas ?? "");
  const minutosSilencio = Number(entrada.contexto.minutosSilencio ?? 0);
  const nota = entrada.contexto.nota == null ? null : Number(entrada.contexto.nota);
  const d = await decidir({
    textoConversas: texto,
    minutosSilencio,
    nota,
    pediuPreco: Boolean(entrada.contexto.pediuPreco),
    pediuHumano: Boolean(entrada.contexto.pediuHumano),
  });
  return {
    custoTokens: d.usadoJev ? 1 : 0,
    usadoJev: d.usadoJev,
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
  return {
    custoTokens: 0,
    usadoJev: false,
    saida: ExecucaoSaida.parse({
      resumo: "Scribe gerou resumo e follow-ups.",
      acaoSugerida: "Criar tarefas a partir do resumo.",
      requerAprovacao: true,
      payload: {
        resumo: notas.slice(0, 500),
        followups: ["Enviar resumo ao contato", "Atualizar briefing", "Agendar próximo passo"],
      },
    }),
  };
}

async function ledger(entrada: ExecucaoEntrada): Promise<ResultadoAgente> {
  const logins7d = Number(entrada.contexto.logins7d ?? 0);
  const diasDesdePagamento = Number(entrada.contexto.diasDesdePagamento ?? 0);
  const risco = diasDesdePagamento <= 7 && logins7d < 2;
  return {
    custoTokens: 0,
    usadoJev: false,
    saida: ExecucaoSaida.parse({
      resumo: risco ? "Ledger: risco de cancelamento (menos de 2 logins em 7 dias)." : "Ledger: saúde ok.",
      acaoSugerida: risco ? "Cláudio envia link de login / conteúdo novo (sem cobrar)." : "Monitorar.",
      requerAprovacao: true,
      payload: { risco, logins7d, diasDesdePagamento, nuncaCobra: true, nuncaAutomatico: true },
    }),
  };
}

async function pilot(entrada: ExecucaoEntrada): Promise<ResultadoAgente> {
  const horasDesdeUltima = entrada.contexto.horasDesdeUltimaAutomatica == null
    ? null
    : Number(entrada.contexto.horasDesdeUltimaAutomatica);
  const diasParado = Number(entrada.contexto.diasParado ?? 0);
  if (diasParado >= crmConfig.tetoAntiLoopDias) {
    return {
      custoTokens: 0,
      usadoJev: false,
      saida: ExecucaoSaida.parse({
        resumo: "Pilot pausado pelo teto anti-loop.",
        acaoSugerida: "Revisar manualmente.",
        requerAprovacao: true,
        payload: { pausado: true },
      }),
    };
  }
  if (horasDesdeUltima !== null && horasDesdeUltima < crmConfig.cooldownMensagemHoras) {
    return {
      custoTokens: 0,
      usadoJev: false,
      saida: ExecucaoSaida.parse({
        resumo: "Pilot em cooldown de 48h.",
        acaoSugerida: "Aguardar.",
        requerAprovacao: false,
        payload: { cooldown: true },
      }),
    };
  }
  const texto = String(entrada.contexto.textoFollowup ?? "Passando para retomar nosso papo. Quando fica bom pra você?");
  if (mencionaPreco(texto)) {
    return {
      custoTokens: 0,
      usadoJev: false,
      saida: ExecucaoSaida.parse({
        resumo: "Pilot bloqueado: texto menciona preço.",
        requerAprovacao: true,
        payload: { bloqueado: true },
      }),
    };
  }
  return {
    custoTokens: 0,
    usadoJev: false,
    saida: ExecucaoSaida.parse({
      resumo: "Pilot: follow-up pronto.",
      acaoSugerida: "Enviar após aprovação.",
      requerAprovacao: true,
      payload: { texto },
    }),
  };
}

async function eco(entrada: ExecucaoEntrada): Promise<ResultadoAgente> {
  const nome = String(entrada.contexto.nome ?? "Lead");
  const dor = String(entrada.contexto.dor ?? "não informada");
  const meta = String(entrada.contexto.meta ?? "não informada");
  const nota = entrada.contexto.nota ?? "—";
  const briefing = [
    `Briefing · ${nome}`,
    `Dor: ${dor}`,
    `Meta: ${meta}`,
    `Nota da Pergunta Matadora: ${nota}`,
    `Não repetir perguntas já respondidas ao ${cfg.claudio.nome}.`,
  ].join("\n");
  return {
    custoTokens: 0,
    usadoJev: false,
    saida: ExecucaoSaida.parse({
      resumo: `Eco preparou briefing de ${nome}.`,
      acaoSugerida: "Abrir na reunião.",
      requerAprovacao: false,
      payload: { briefing },
    }),
  };
}

export { cfg as agentesConfig };
