/**
 * DADOS DE EXEMPLO ILUSTRATIVO. Nomes, empresas, telefones e valores são inventados.
 * Troque pelos seus quando ligar o banco. Nunca suba dado real de cliente num projeto de teste.
 */
import type { Contato, Funil, Produto } from "../domain/types";

export const PRODUTOS: Produto[] = [
  { id: "p1", nome: "Programa de acompanhamento (exemplo)", valor: 2400, parcelas: "12x R$ 240" },
];

export const FUNIS: Funil[] = [
  { id: "perpetuo", nome: "Perpétuo", canal: "Anúncio + formulário", produto: "p1" },
  { id: "live", nome: "Live semanal", canal: "Aula aberta", produto: "p1" },
  { id: "evento", nome: "Evento", canal: "Evento presencial", produto: "p1" },
];

export const CONTATOS: Contato[] = [
  {
    id: "c1", nome: "Mariana Rocha", empresa: "Clínica Exemplo Vida", segmento: "Saúde", cidade: "Cidade Exemplo", telefone: "(00) 90000-0001",
    origem: "perpetuo", nota: 9, dono: "robo", handoffPendente: true, handoffMin: 22, termometro: null,
    mensagens: [
      { autor: "contato", texto: "Oi, vi o anúncio. Perco paciente no WhatsApp toda semana.", hora: "09:02" },
      { autor: "robo", texto: "Entendi. Colocar um atendimento organizado para funcionar na clínica é prioridade agora? De 0 a 10, qual a nota?", hora: "09:03" },
      { autor: "contato", texto: "9. E quanto custa?", hora: "09:05" },
    ],
    notas: [],
    ligacoes: [],
    oportunidades: [{ id: "o1", produtoId: "p1", valor: 2400, etapa: "handoff", minutosNaEtapa: 22, proximoPasso: "Assumir e ligar para o briefing", briefing: null, motivoPerda: null }],
  },
  {
    id: "c2", nome: "Paulo Mendes", empresa: "Mendes Engenharia (exemplo)", segmento: "Serviços", cidade: "Cidade Exemplo", telefone: "(00) 90000-0002",
    origem: "live", nota: 10, dono: "humano", handoffPendente: false, handoffMin: 0, termometro: "quente",
    mensagens: [
      { autor: "contato", texto: "Participei da aula de ontem. Quero entender o próximo passo.", hora: "08:30" },
      { autor: "humano", texto: "Paulo, aqui é do time comercial. Vamos marcar 10 minutos hoje?", hora: "08:41" },
    ],
    notas: ["Decide sozinho. Quer organizar a fila de orçamentos."],
    ligacoes: [
      {
        hora: "10:15", duracao: "09:42", resultado: "atendeu", termometroVendedor: "quente", termometroIA: "quente",
        trechos: [
          { quem: "vendedor", texto: "Paulo, antes de tudo: esta ligação está sendo gravada para registro. Tudo bem?", hora: "00:04", marca: null },
          { quem: "contato", texto: "Tudo bem. Hoje os orçamentos ficam espalhados no e-mail e eu perco o prazo de resposta.", hora: "00:21", marca: "dor" },
          { quem: "contato", texto: "Quero responder todo orçamento em até um dia útil, até o fim do mês.", hora: "01:10", marca: "meta" },
          { quem: "contato", texto: "Preciso resolver antes de 30 de novembro, quando fecha o trimestre.", hora: "02:02", marca: "prazo" },
          { quem: "contato", texto: "Meu receio é a equipe não usar a ferramenta nova.", hora: "04:30", marca: "objeção" },
          { quem: "contato", texto: "Pode mandar a proposta. Se fizer sentido, eu fecho esta semana.", hora: "08:55", marca: "decisão" },
        ],
        followups: [
          { texto: "Enviar a proposta com a dor e a meta do briefing", quando: "hoje", origem: "08:55" },
          { texto: "Mostrar como a equipe usa no dia a dia (exemplo ilustrativo)", quando: "amanhã", origem: "04:30" },
        ],
      },
    ],
    oportunidades: [{ id: "o2", produtoId: "p1", valor: 2400, etapa: "briefing", minutosNaEtapa: 90, proximoPasso: "Enviar proposta", briefing: { dor: "Orçamentos espalhados, prazo de resposta perdido", meta: "Responder em até 1 dia útil", data: "30/11" }, motivoPerda: null }],
  },
  {
    id: "c3", nome: "Ana Beatriz Lima", empresa: "Studio Lima (exemplo)", segmento: "Beleza", cidade: "Cidade Exemplo", telefone: "(00) 90000-0003",
    origem: "perpetuo", nota: 7, dono: "robo", handoffPendente: false, handoffMin: 0, termometro: null,
    mensagens: [{ autor: "robo", texto: "Ana, a próxima aula aberta é quinta. Quer o lembrete?", hora: "ontem" }],
    notas: [], ligacoes: [],
    oportunidades: [{ id: "o3", produtoId: "p1", valor: 2400, etapa: "conversa", minutosNaEtapa: 1700, proximoPasso: "Convidar para a aula aberta", briefing: null, motivoPerda: null }],
  },
  {
    id: "c4", nome: "Carlos Teixeira", empresa: "Teixeira Móveis (exemplo)", segmento: "Varejo", cidade: "Cidade Exemplo", telefone: "(00) 90000-0004",
    origem: "evento", nota: 8, dono: "humano", handoffPendente: false, handoffMin: 0, termometro: "morno",
    mensagens: [{ autor: "humano", texto: "Carlos, a proposta está no link. Qualquer dúvida me chama aqui.", hora: "ontem" }],
    notas: ["Abriu a proposta 2 vezes."], ligacoes: [],
    oportunidades: [{ id: "o4", produtoId: "p1", valor: 2400, etapa: "proposta", minutosNaEtapa: 3100, proximoPasso: "Fazer a oferta com prazo", briefing: { dor: "Vendedores sem rotina de follow-up", meta: "Dobrar retorno de orçamentos", data: "15/12" }, motivoPerda: null }],
  },
  {
    id: "c5", nome: "Renata Souza", empresa: "Souza Contabilidade (exemplo)", segmento: "Serviços", cidade: "Cidade Exemplo", telefone: "(00) 90000-0005",
    origem: "live", nota: 9, dono: "humano", handoffPendente: false, handoffMin: 0, termometro: "quente",
    mensagens: [{ autor: "humano", texto: "Renata, o link de pagamento vale até sexta.", hora: "ontem" }],
    notas: [], ligacoes: [],
    oportunidades: [{ id: "o5", produtoId: "p1", valor: 2400, etapa: "oferta", minutosNaEtapa: 600, proximoPasso: "Follow-up sem pressão", briefing: { dor: "Cobrança manual", meta: "Automatizar lembretes", data: "10/11" }, motivoPerda: null }],
  },
  {
    id: "c6", nome: "Fábio Antunes", empresa: "Antunes Auto (exemplo)", segmento: "Serviços", cidade: "Cidade Exemplo", telefone: "(00) 90000-0006",
    origem: "perpetuo", nota: null, dono: "robo", handoffPendente: false, handoffMin: 0, termometro: null,
    mensagens: [], notas: [], ligacoes: [],
    oportunidades: [{ id: "o6", produtoId: "p1", valor: 2400, etapa: "novo", minutosNaEtapa: 3, proximoPasso: "Robô abre a conversa", briefing: null, motivoPerda: null }],
  },
  {
    id: "c7", nome: "Letícia Fernandes", empresa: "Fernandes Pet (exemplo)", segmento: "Varejo", cidade: "Cidade Exemplo", telefone: "(00) 90000-0007",
    origem: "evento", nota: 10, dono: "humano", handoffPendente: false, handoffMin: 0, termometro: "quente",
    mensagens: [{ autor: "humano", texto: "Letícia, bem-vinda. Seu plano de entrada sai hoje.", hora: "hoje" }],
    notas: [], ligacoes: [],
    oportunidades: [{ id: "o7", produtoId: "p1", valor: 2400, etapa: "pago", minutosNaEtapa: 120, proximoPasso: "Plano de entrada", briefing: { dor: "Fila de atendimento", meta: "Atender em 5 min", data: "01/12" }, motivoPerda: null }],
  },
];

export const TEXTO_EXEMPLO = "exemplo ilustrativo";
