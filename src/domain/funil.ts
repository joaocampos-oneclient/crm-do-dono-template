import type { Etapa, EtapaId, PerguntaMatadora } from "./types";

/**
 * Funil de exemplo (serviço de ciclo longo: robô qualifica, humano fecha, sistema confirma).
 * Troque pelas etapas do SEU negócio. Três etapas já bastam para começar.
 * As metas abaixo são números de exemplo: defina as suas e revise depois de 30 dias com o dado real.
 */
export const ETAPAS: Etapa[] = [
  { id: "novo", nome: "Lead novo", objetivo: "Chegou de qualquer origem", validacao: "nome + WhatsApp + origem gravados", prazoMin: 5, prazoTexto: "5 min", meta: 70, auto: false, dono: "robo", motivosPerda: ["número inválido", "duplicado"] },
  { id: "conversa", nome: "Em conversa", objetivo: "Despertar interesse e qualificar", validacao: "respondeu e deu nota de 0 a 10", prazoMin: 1440, prazoTexto: "1 dia", meta: 35, auto: false, dono: "robo", motivosPerda: ["não respondeu (3 tentativas)", "não quer mais contato"] },
  { id: "handoff", nome: "Handoff", objetivo: "O humano assume", validacao: "o humano respondeu no mesmo chat", prazoMin: 120, prazoTexto: "2 h", meta: 80, auto: false, dono: "humano", motivosPerda: ["não é quem decide", "curioso sem negócio", "sem orçamento"] },
  { id: "briefing", nome: "Briefing feito", objetivo: "Entender dor, meta e data", validacao: "dor, meta e data na ficha", prazoMin: 2880, prazoTexto: "2 dias", meta: 80, auto: false, dono: "humano", motivosPerda: ["sumiu", "sem meta"] },
  { id: "proposta", nome: "Proposta aberta", objetivo: "Mostrar a solução com a dor dele", validacao: "o contato abriu a proposta", prazoMin: 2880, prazoTexto: "2 dias", meta: 85, auto: true, dono: "humano", motivosPerda: ["não abriu", "vou pensar"] },
  { id: "oferta", nome: "Oferta com condição", objetivo: "Decisão com prazo", validacao: "link de pagamento enviado, com condição e validade", prazoMin: 2880, prazoTexto: "2 dias", meta: 45, auto: false, dono: "humano", motivosPerda: ["preço", "sem tempo", "sócio", "vou pensar"] },
  { id: "pago", nome: "Pago", objetivo: "Pagamento confirmado", validacao: "pedido pago", prazoMin: 0, prazoTexto: "—", meta: 95, auto: true, dono: "sistema", motivosPerda: ["pix expirou", "cartão recusado"] },
  { id: "dentro", nome: "Dentro", objetivo: "Entrou e passou da garantia", validacao: "primeiro acesso e plano de entrada", prazoMin: 10080, prazoTexto: "7 dias", meta: 100, auto: true, dono: "sistema", motivosPerda: ["reembolso"] },
];

export const etapaDe = (id: EtapaId) => ETAPAS.find((e) => e.id === id);

export const proximaEtapa = (id: EtapaId) => {
  const i = ETAPAS.findIndex((e) => e.id === id);
  return i < 0 ? null : (ETAPAS[i + 1] ?? null);
};

/**
 * Playbook de exemplo: uma Pergunta Matadora por etapa (aqui, só a primeira está completa).
 * Ficha da etapa: pergunta, respostas por faixa, complementares (com o porquê), objeções, condição, próximo passo.
 */
export const PLAYBOOK: PerguntaMatadora[] = [
  {
    etapa: "conversa",
    pergunta: "Colocar [o que você vende] para funcionar na sua empresa é prioridade agora? De 0 a 10, qual a nota?",
    faixas: [
      { de: 0, ate: 6, acao: "Nutre com conteúdo. Não gasta vendedor." },
      { de: 7, ate: 8, acao: "Convida para um momento coletivo (live, aula, evento) ou conteúdo gravado." },
      { de: 9, ate: 10, acao: "Passa para o humano na hora, com a ponte pronta." },
    ],
    complementares: [
      { pergunta: "De 0 a 10, quão satisfeito você está com o que usa hoje?", porque: "Mostra quanto existe de dor real." },
      { pergunta: "Isso dói agora ou é um projeto para um dia?", porque: "Separa urgência de curiosidade." },
      { pergunta: "A decisão é só sua ou tem sócio?", porque: "Se não decide, o card não anda." },
    ],
    objecoes: [
      { objecao: "Está caro", diga: "Qual valor você achou que seria? Entendo o parâmetro antes de falar de número.", nuncaDiga: "Dou um desconto." },
      { objecao: "Não tenho tempo", diga: "Por isso o passo é pequeno: um projeto por vez, com data combinada.", nuncaDiga: "É rapidinho." },
      { objecao: "Vou pensar", diga: "Combinado. O que falta para você ter certeza?", nuncaDiga: "Mas a oferta acaba hoje." },
      { objecao: "Preciso falar com meu sócio", diga: "Faz sentido. Quer marcar uma conversa com os dois?", nuncaDiga: "Depois eu falo só com você." },
    ],
    condicao: "Uma condição verdadeira, com prazo (3 dias é um bom padrão), cadastrada antes. Nunca inventada na hora.",
    proximoPasso: "Termina com um passo combinado, com data, que o contato aceitou.",
  },
];
