/**
 * Cláudio: o assistente de IA que qualifica leads. Versão por REGRAS, sem modelo de linguagem.
 * Ele segue o Playbook: faz a Pergunta Matadora, lê a nota, decide (nutrir / convidar / handoff)
 * e nunca fala de preço. Um LLM pode substituir a redação (server/claudio.ts), mas as decisões
 * continuam passando por estas funções.
 */
import { playbookDe } from "./funil";
import { acaoDaNota, deveFazerHandoff, mencionaPreco, preencherTemplate, primeiroNome } from "./rules";
import type { Contato, Funil, Mensagem, Oportunidade, Produto } from "./types";

export interface ContextoClaudio {
  contato: Contato;
  oportunidade: Oportunidade | null;
  mensagens: Mensagem[];
  produto: Produto | null;
  funil: Funil | null;
  /** Nome do humano que recebe o handoff. */
  nomeOperador: string;
  nomeEmpresa: string;
}

export type AcaoClaudio = "perguntar" | "nutrir" | "convidar" | "handoff" | "encerrar" | "silencio";

export interface DecisaoClaudio {
  acao: AcaoClaudio;
  resposta: string | null;
  nota: number | null;
  motivo: string;
  sinais: { pediuPreco: boolean; pediuHumano: boolean; quisEntrar: boolean; pediuParar: boolean };
}

const POR_EXTENSO: Record<string, number> = { zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, três: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10 };

/** Extrai uma nota 0-10 do texto. Sem número claro devolve null: a nota nunca é inventada. */
export function extrairNota(texto: string): number | null {
  const t = texto.toLowerCase();
  const m = t.match(/(?:nota\s*)?(?:é|eh|seria|dou|daria)?\s*\b(10|[0-9])\b(?!\s*(?:%|h\b|horas|dias|mil|k\b|reais|anos|pessoas|funcion))/);
  if (m) return Number(m[1]);
  for (const [palavra, n] of Object.entries(POR_EXTENSO)) {
    if (new RegExp(`\\b${palavra}\\b`).test(t) && /nota|prioridade|de 0 a 10|diria|dou/.test(t)) return n;
  }
  return null;
}

export const lerSinais = (texto: string) => ({
  pediuPreco: mencionaPreco(texto) || /quanto (custa|é|fica|sai)|qual o valor/i.test(texto),
  pediuHumano: /falar com (uma pessoa|algu[ée]m|humano|atendente|gente|voc[êe]s)|quero uma pessoa|me liga|pode me ligar|atendente/i.test(texto),
  quisEntrar: /quero (entrar|fechar|contratar|come[çc]ar|assinar)|como (fa[çc]o|eu fa[çc]o) para (entrar|contratar)|bora fechar|vamos fechar/i.test(texto),
  pediuParar: /n[ãa]o (quero|tenho interesse)|para de (mandar|me mandar)|me (tira|remove)|sair da lista|pare/i.test(texto),
});

const jaPerguntou = (mensagens: Mensagem[]) => mensagens.some((m) => m.autor === "robo" && /0 a 10/.test(m.texto));

/**
 * Decide a próxima fala do Cláudio a partir da mensagem do lead.
 * Regras, em ordem: pediu parar > pediu humano/preço/entrar > nota > ainda sem nota.
 */
export function claudioResponde(ctx: ContextoClaudio, textoDoLead: string): DecisaoClaudio {
  const { contato, mensagens, produto, funil } = ctx;
  const nome = primeiroNome(contato.nome);
  const sinais = lerSinais(textoDoLead);
  const notaLida = extrairNota(textoDoLead);
  const nota = notaLida ?? contato.nota;
  const vars = {
    nome,
    empresa: ctx.nomeEmpresa,
    produto: produto?.nome ?? "o que oferecemos",
    operador: ctx.nomeOperador,
    origem: funil?.nome ?? "nosso conteúdo",
    "o que você vende": produto?.nome ?? "isso",
  };

  if (sinais.pediuParar) {
    return { acao: "encerrar", resposta: `Tudo bem, ${nome}. Não vou mais te escrever. Se mudar de ideia, é só mandar um oi.`, nota, motivo: "Pediu para parar. LGPD: respeitar e registrar.", sinais };
  }

  if (deveFazerHandoff({ nota, pediuPreco: sinais.pediuPreco, pediuHumano: sinais.pediuHumano, quisEntrar: sinais.quisEntrar })) {
    const porque = sinais.pediuPreco ? "perguntou de valor (só o humano fala de preço)" : sinais.pediuHumano ? "pediu para falar com uma pessoa" : sinais.quisEntrar ? "quer entrar" : `nota ${nota}`;
    return {
      acao: "handoff",
      resposta: `Faz sentido, ${nome}. Vou te passar para ${ctx.nomeOperador}, que cuida disso. Em instantes ${ctx.nomeOperador} fala com você por aqui.`,
      nota,
      motivo: `Handoff: ${porque}.`,
      sinais,
    };
  }

  if (notaLida !== null) {
    const acao = acaoDaNota(notaLida);
    if (acao === "nutrir") {
      return { acao: "nutrir", resposta: `Entendi, ${nome}. Então não é o momento de forçar nada. Vou te mandar um conteúdo curto sobre ${vars.produto} e, quando virar prioridade, me chama por aqui. Combinado?`, nota: notaLida, motivo: `Nota ${notaLida}: nutrir. Não gasta vendedor.`, sinais };
    }
    if (acao === "convidar") {
      const convite = funil?.id === "live" ? "a próxima aula aberta é na quarta às 14h" : "temos uma aula aberta toda quarta às 14h";
      return { acao: "convidar", resposta: `Boa, ${nome}. Como está quase lá, ${convite}: vou te mostrar na prática como ${vars.produto} funciona. Quer o lembrete?`, nota: notaLida, motivo: `Nota ${notaLida}: convidar para momento coletivo.`, sinais };
    }
  }

  if (!jaPerguntou(mensagens)) {
    const pb = playbookDe("conversa", produto);
    const pergunta = preencherTemplate(pb?.pergunta.replace(/\[(.+?)\]/g, "{$1}") ?? "De 0 a 10, isso é prioridade agora?", vars);
    return { acao: "perguntar", resposta: `${nome}, obrigado por responder. ${pergunta}`, nota, motivo: "Ainda sem nota: fazer a Pergunta Matadora.", sinais };
  }

  const pb = playbookDe("conversa", produto);
  const complementar = pb?.complementares[Math.min(1, (pb.complementares.length || 1) - 1)]?.pergunta ?? "Isso dói agora ou é um projeto para um dia?";
  return {
    acao: "perguntar",
    resposta: `Entendi. Só para eu te ajudar certo: de 0 a 10, quanto isso é prioridade agora? ${complementar}`,
    nota,
    motivo: "Resposta sem número claro: perguntar de novo. A nota nunca é inventada.",
    sinais,
  };
}

/** Primeira mensagem do Cláudio quando o lead chega. */
export function claudioAbreConversa(ctx: Pick<ContextoClaudio, "contato" | "funil" | "produto" | "nomeEmpresa">) {
  const nome = primeiroNome(ctx.contato.nome);
  const origem = ctx.funil ? ` Vi que você chegou por ${ctx.funil.nome.toLowerCase()}.` : "";
  return `Oi, ${nome}! Aqui é o Cláudio, assistente de IA da ${ctx.nomeEmpresa}.${origem} Posso te fazer uma pergunta rápida para te ajudar melhor?`;
}

/** Trava final: qualquer texto do robô passa por aqui antes de sair. */
export function sanitizarFalaDoRobo(texto: string): { ok: boolean; texto: string; motivo?: string } {
  if (mencionaPreco(texto)) return { ok: false, texto: "Sobre valores, quem fala é uma pessoa do time. Vou te passar para ela.", motivo: "Fala do robô mencionava preço; substituída." };
  return { ok: true, texto };
}
