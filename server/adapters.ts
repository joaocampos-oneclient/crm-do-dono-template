/**
 * Adaptadores do SERVIDOR: WhatsApp, e-mail, pagamento. Aqui é onde entram as credenciais
 * (por isso não rodam no navegador). No template, todos são LOCAIS: registram o que fariam
 * num log em memória, visível em GET /api/saidas. Como trocar por Z-API/Evolution, Resend e
 * Stripe/Asaas: docs/integracoes.md.
 */
export interface Saida { em: string; canal: "whatsapp" | "email" | "pagamento" | "llm"; para: string; resumo: string; detalhe?: unknown }

export interface AdaptadoresServidor {
  whatsapp: { enviar(telefone: string, texto: string): Promise<{ ok: boolean; id: string }> };
  email: { enviar(para: string, assunto: string, texto: string): Promise<{ ok: boolean; id: string }> };
  pagamento: { criarLink(opts: { valor: number; metodo: string; validadeDias: number; referencia: string }): Promise<{ url: string }> };
  saidas(): Saida[];
}

export function adaptadoresLocais(): AdaptadoresServidor {
  const log: Saida[] = [];
  const registrar = (s: Omit<Saida, "em">) => { log.push({ em: new Date().toISOString(), ...s }); if (log.length > 500) log.shift(); };
  return {
    whatsapp: {
      async enviar(telefone, texto) {
        registrar({ canal: "whatsapp", para: telefone, resumo: texto.slice(0, 120) });
        return { ok: true, id: `local-wa-${Date.now()}` };
      },
    },
    email: {
      async enviar(para, assunto, texto) {
        registrar({ canal: "email", para, resumo: assunto, detalhe: texto });
        return { ok: true, id: `local-mail-${Date.now()}` };
      },
    },
    pagamento: {
      async criarLink({ referencia }) {
        registrar({ canal: "pagamento", para: referencia, resumo: "link local (simulado)" });
        return { url: `https://pagamento.exemplo/${referencia.slice(0, 8)}` };
      },
    },
    saidas: () => [...log].reverse(),
  };
}
