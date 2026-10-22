import type { Etapa, EtapaId, PerguntaMatadora, Produto } from "./types";

/**
 * Funil de VENDA (serviço de ciclo longo: robô qualifica, humano fecha, sistema confirma).
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
export const indiceEtapa = (id: EtapaId) => ETAPAS.findIndex((e) => e.id === id);

export const proximaEtapa = (id: EtapaId) => {
  const i = indiceEtapa(id);
  return i < 0 ? null : (ETAPAS[i + 1] ?? null);
};

/** Etapas em que o contato já é "prospect" (conversou com humano e tem briefing) ou "cliente". */
export const ETAPAS_PROSPECT: EtapaId[] = ["briefing", "proposta", "oferta"];
export const ETAPAS_CLIENTE: EtapaId[] = ["pago", "dentro"];

/**
 * Playbook padrão: uma Pergunta Matadora por etapa.
 * Ficha da etapa: pergunta, respostas por faixa, complementares (com o porquê), objeções, condição, próximo passo.
 * Um Produto pode ter o seu próprio (campo `playbook`); quando não tem, vale este.
 */
export const PLAYBOOK: PerguntaMatadora[] = [
  {
    etapa: "novo",
    pergunta: "Você baixou/entrou por [origem]. Posso te fazer uma pergunta rápida para te ajudar melhor?",
    faixas: [
      { de: 0, ate: 10, acao: "Qualquer resposta move para 'Em conversa'. Silêncio por 1 dia: segunda tentativa; 3 tentativas sem resposta: perdido." },
    ],
    complementares: [
      { pergunta: "Qual o nome da sua empresa e o que ela faz?", porque: "Confirma que é empresa e preenche a ficha." },
      { pergunta: "Você é quem cuida de vendas/atendimento aí?", porque: "Começa a descobrir quem decide." },
    ],
    objecoes: [
      { objecao: "Quem é você?", diga: "Sou o assistente de IA do [empresa]. Se preferir, chamo uma pessoa agora.", nuncaDiga: "Sou uma pessoa." },
      { objecao: "Não pedi contato", diga: "Entendi. Você entrou por [origem]; se não quiser, encerro aqui e não falo mais.", nuncaDiga: "Mas é rapidinho." },
    ],
    condicao: "Nenhuma. Nesta etapa não existe oferta.",
    proximoPasso: "Fazer a Pergunta Matadora da etapa seguinte.",
  },
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
  {
    etapa: "handoff",
    pergunta: "Oi, [nome], aqui é [operador]. Vi que você deu nota [nota]. Podemos falar 10 minutos hoje? Que horário é melhor?",
    faixas: [
      { de: 0, ate: 10, acao: "Qualquer horário aceito vira tarefa com data. Sem resposta em 2 h: ligar." },
    ],
    complementares: [
      { pergunta: "O que te fez dar essa nota?", porque: "Abre a dor com as palavras do contato." },
      { pergunta: "Quem mais participa dessa decisão?", porque: "Evita proposta para quem não decide." },
    ],
    objecoes: [
      { objecao: "Me manda por escrito", diga: "Mando sim. Antes, 3 perguntas para a proposta sair certa: posso?", nuncaDiga: "Segue o PDF genérico." },
      { objecao: "Quanto custa?", diga: "Depende do que você precisa. Em 10 minutos eu te digo o número certo.", nuncaDiga: "A partir de R$ X." },
    ],
    condicao: "Nenhuma. O humano ainda está entendendo.",
    proximoPasso: "Ligação ou reunião marcada com data e hora. Resultado vira briefing.",
  },
  {
    etapa: "briefing",
    pergunta: "Se isso estivesse resolvido daqui a 90 dias, o que estaria diferente na sua empresa?",
    faixas: [
      { de: 0, ate: 10, acao: "Preenche dor, meta e data. Sem os três, o card não anda para proposta." },
    ],
    complementares: [
      { pergunta: "Qual o custo de deixar como está por mais 6 meses?", porque: "Dimensiona a dor em dinheiro." },
      { pergunta: "Até quando isso precisa estar funcionando?", porque: "A data do contato manda no prazo da proposta." },
      { pergunta: "O que já tentou e não deu certo?", porque: "Evita propor o que já falhou." },
    ],
    objecoes: [
      { objecao: "Não sei dizer meta", diga: "Então vamos pelo contrário: o que não pode continuar acontecendo?", nuncaDiga: "Depois a gente vê." },
    ],
    condicao: "Nenhuma. Oferta só depois da proposta.",
    proximoPasso: "Proposta gerada com a dor, a meta e a data do briefing, enviada no mesmo dia.",
  },
  {
    etapa: "proposta",
    pergunta: "Você abriu a proposta. O que ficou mais claro e o que ficou faltando?",
    faixas: [
      { de: 0, ate: 10, acao: "Qualquer resposta vira ajuste na proposta ou oferta com condição." },
    ],
    complementares: [
      { pergunta: "Isso resolve a dor que você me contou?", porque: "Confirma o encaixe antes de falar de condição." },
      { pergunta: "O que precisaria acontecer para você começar esta semana?", porque: "Revela a objeção real." },
    ],
    objecoes: [
      { objecao: "Vou pensar", diga: "Combinado. O que falta para você ter certeza?", nuncaDiga: "Mas a oferta acaba hoje." },
      { objecao: "Está caro", diga: "Comparado com o quê? Me ajuda a entender o parâmetro.", nuncaDiga: "Dou um desconto." },
    ],
    condicao: "Ainda não. A condição entra na etapa seguinte, com prazo.",
    proximoPasso: "Oferta com uma condição verdadeira e prazo de 3 dias.",
  },
  {
    etapa: "oferta",
    pergunta: "A condição [gatilho] vale até [data]. Prefere Pix ou cartão?",
    faixas: [
      { de: 0, ate: 10, acao: "Pagou: o sistema move. Passou do prazo: uma última mensagem sem pressão e perdido com motivo." },
    ],
    complementares: [
      { pergunta: "Falta alguma informação para você decidir?", porque: "Fecha lacuna antes do prazo acabar." },
      { pergunta: "Quer que eu te ajude com a forma de pagamento?", porque: "Ajuda em vez de apertar." },
    ],
    objecoes: [
      { objecao: "Preciso do sócio", diga: "Faz sentido. Quer marcar com os dois ainda dentro do prazo?", nuncaDiga: "Depois eu falo só com você." },
      { objecao: "Estende o prazo?", diga: "A condição tem data porque é verdadeira. Depois dela, vale o valor normal.", nuncaDiga: "Estendo sim, sem problema." },
    ],
    condicao: "Obrigatória: gatilho cadastrado no produto, com validade. Link de pagamento com a mesma validade.",
    proximoPasso: "Pagamento confirmado pelo sistema.",
  },
  {
    etapa: "pago",
    pergunta: "Bem-vindo! Qual o melhor dia para o seu plano de entrada?",
    faixas: [
      { de: 0, ate: 10, acao: "Data marcada vira tarefa. Primeiro acesso move para 'Dentro'." },
    ],
    complementares: [
      { pergunta: "Quem da sua equipe vai usar junto?", porque: "Reduz reembolso por falta de uso." },
    ],
    objecoes: [
      { objecao: "Quero reembolso", diga: "Claro, está na garantia. Antes, posso entender o que não atendeu?", nuncaDiga: "Não é possível." },
    ],
    condicao: "Nenhuma. Já pagou.",
    proximoPasso: "Primeiro acesso e plano de entrada feitos.",
  },
  {
    etapa: "dentro",
    pergunta: "Primeira semana: o que já funcionou e o que travou?",
    faixas: [
      { de: 0, ate: 10, acao: "Travou: tarefa de suporte. Funcionou: pedir indicação." },
    ],
    complementares: [
      { pergunta: "Conhece alguém com o mesmo problema que você tinha?", porque: "Indicação é o lead mais barato." },
    ],
    objecoes: [],
    condicao: "Nenhuma.",
    proximoPasso: "Contato vira cliente ativo. Indicações entram como lead novo com origem 'indicação'.",
  },
];

export const playbookDe = (etapa: EtapaId, produto?: Produto | null) =>
  produto?.playbook.find((p) => p.etapa === etapa) ?? PLAYBOOK.find((p) => p.etapa === etapa) ?? null;
