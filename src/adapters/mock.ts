import type { Adapters } from "./index";

/** Tudo aqui é simulação. Nada sai do navegador. Nenhuma mensagem é enviada, nenhuma ligação é feita. */
export const mockAdapters: Adapters = {
  whatsapp: {
    async enviar(_telefone, texto) {
      console.info("[simulado] WhatsApp enviaria:", texto);
      return { ok: true, id: `sim-${Date.now()}` };
    },
  },
  pagamento: {
    async criarLink({ validadeDias }) {
      const exp = new Date(Date.now() + validadeDias * 86400000).toISOString().slice(0, 10);
      return { url: "https://exemplo.invalid/pagamento (simulado)", expiraEm: exp };
    },
  },
  telefonia: {
    async ligar(_telefone) {
      return { ligacaoId: "sim-ligacao-1" };
    },
  },
  transcricao: {
    async transcrever() {
      return { trechos: [{ quem: "contato", texto: "Transcrição simulada. Em produção vem de um serviço de transcrição em português.", hora: "00:00" }] };
    },
  },
  copiloto: {
    async sugerir() {
      return [{ titulo: "Sugestão simulada", porque: "Em produção, uma IA lê a ficha e sugere a próxima ação. O humano decide." }];
    },
  },
};
