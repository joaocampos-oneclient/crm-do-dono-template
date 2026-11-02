/**
 * Configuração do CRM — edite aqui (ou via MCP) para adaptar à sua empresa.
 * Nada aqui é específico da IA para Donos: os valores abaixo são o exemplo.
 */
export const crmConfig = {
  nomeEmpresa: "Minha empresa",
  nomeRobo: "Cláudio",
  /** URL pública do app (após o deploy na Vercel). */
  urlPublica: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",

  produtos: [
    {
      id: "produto-principal",
      nome: "Produto principal",
      valor: 2997,
      parcelas: "12x R$ 297",
      descricao: "Oferta principal do funil",
      ativo: true,
      gatilhos: ["bônus do evento até sexta"],
    },
  ],

  /** Funis de entrada (de onde o lead vem). Não confundir com as 8 etapas de venda. */
  funis: [
    { id: "perpetuo", nome: "Perpétuo", canal: "orgânico / indicação", produto: "produto-principal", ativo: true },
    { id: "live-semanal", nome: "Live semanal", canal: "live", produto: "produto-principal", ativo: true },
    { id: "imersao", nome: "Imersão", canal: "evento presencial / online", produto: "produto-principal", ativo: true },
  ],

  agentes: {
    claudio: { nome: "Cláudio", resumo: "Conversa com leads no WhatsApp. Nunca fala preço nem fecha." },
    scout: { nome: "Scout", resumo: "Analisa conversas e silêncio; encontra momento de compra e faz handoff." },
    scribe: { nome: "Scribe", resumo: "Resume reuniões e gera atividades / follow-ups." },
    ledger: { nome: "Ledger", resumo: "Monitora risco de cancelamento nos 7 primeiros dias. Nunca automático. Nunca cobra." },
    pilot: { nome: "Pilot", resumo: "Dispara follow-ups e atendimentos sem intervenção humana." },
    eco: { nome: "Eco", resumo: "Prepara briefing do lead antes da reunião." },
  },

  /** Cooldown mínimo entre mensagens automáticas do mesmo contato (horas). */
  cooldownMensagemHoras: 48,
  /** Teto anti-loop: dias sem avanço antes de pausar o Pilot. */
  tetoAntiLoopDias: 14,
} as const;

export type CrmConfig = typeof crmConfig;
