import type { Adapters } from "./index";

/**
 * Tudo aqui é simulação. Nenhuma ligação é feita, nenhum áudio é gravado.
 * A transcrição é montada a partir do contexto do contato para a demo fazer sentido.
 */
export const mockAdapters: Adapters = {
  telefonia: {
    async ligar(_telefone) {
      await new Promise((r) => setTimeout(r, 300));
      return { ligacaoId: `sim-${Date.now()}` };
    },
  },
  transcricao: {
    async transcrever(_id, ctx) {
      await new Promise((r) => setTimeout(r, 600));
      const dor = ctx.dor ?? `o atendimento ${ctx.segmento ? `na área de ${ctx.segmento.toLowerCase()}` : ""} está desorganizado`;
      return {
        trechos: [
          { quem: "vendedor", texto: `${ctx.nome}, antes de tudo: esta ligação está sendo gravada para registro. Tudo bem?`, hora: "00:04", marca: null },
          { quem: "contato", texto: "Tudo bem.", hora: "00:09", marca: null },
          { quem: "vendedor", texto: "Me conta: o que te fez responder o anúncio?", hora: "00:15", marca: null },
          { quem: "contato", texto: `Hoje ${dor}. Perco tempo e perco cliente.`, hora: "00:31", marca: "dor" },
          { quem: "contato", texto: "Queria resolver isso até o fim do mês que vem, no máximo.", hora: "01:40", marca: "prazo" },
          { quem: "contato", texto: "Se funcionar, quero que a equipe use sem eu ficar cobrando.", hora: "02:20", marca: "meta" },
          { quem: "contato", texto: "Minha dúvida é se minha equipe vai usar.", hora: "03:05", marca: "objeção" },
          { quem: "contato", texto: "Manda a proposta que eu olho hoje ainda.", hora: "04:10", marca: "decisão" },
        ],
        resumo: `${ctx.nome} confirmou a dor (${dor}), tem prazo (fim do mês que vem) e pediu proposta. Objeção: adoção pela equipe.`,
        termometroIA: "quente",
        followups: [
          { texto: "Enviar a proposta com a dor e a meta do briefing", quando: "hoje" },
          { texto: "Mostrar como a equipe usa no dia a dia", quando: "amanhã" },
        ],
      };
    },
  },
};
