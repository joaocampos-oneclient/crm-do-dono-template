/**
 * ESTADO DE EXEMPLO ILUSTRATIVO. Nomes, empresas, telefones e valores são inventados.
 * É gerado em função de `agora` para a demo ficar viva (prazos, períodos, comparação com semana anterior).
 * Troque pelos seus dados quando for usar de verdade. Nunca suba dado real de cliente num projeto de teste.
 */
import { ESTADO_VERSAO, type Contato, type EstadoCRM, type EtapaId, type GastoMidia, type Ligacao, type Mensagem, type Movimento, type Oportunidade } from "../domain/types";

export const IDS = {
  dono: "op-dono",
  otavio: "op-otavio",
  claudio: "op-claudio",
  leitura: "op-leitura",
  bot: "op-bot",
  comunidade: "p-comunidade",
  imersao: "p-imersao",
  mentoria: "p-mentoria",
  diagnostico: "p-diagnostico",
  chaveLeitura: "crm_leitura_exemplo_troque_esta_chave",
  chaveEscrita: "crm_escrita_exemplo_troque_esta_chave",
};

export function estadoExemplo(agoraIso = new Date().toISOString()): EstadoCRM {
  const agora = Date.parse(agoraIso);
  const ha = (min: number) => new Date(agora - min * 60000).toISOString();
  const dia = (d: number) => new Date(agora - d * 86400000).toISOString().slice(0, 10);
  let n = 0;
  const id = (p: string) => `${p}${++n}`;

  const movimentos: Movimento[] = [];
  const mensagens: Mensagem[] = [];
  const oportunidades: Oportunidade[] = [];
  const contatos: Contato[] = [];
  const ligacoes: Ligacao[] = [];

  /** Cria contato + oportunidade com histórico de movimentos coerente até a etapa atual. */
  const lead = (c: Omit<Contato, "criadoEm" | "handoffDesde" | "operadorId"> & { operadorId?: string | null }, etapa: EtapaId, opts: { produto?: string; valor?: number; criadoHaMin: number; naEtapaHaMin: number; briefing?: Oportunidade["briefing"]; perdida?: string; handoffHaMin?: number }) => {
    const criadoEm = ha(opts.criadoHaMin);
    const contato: Contato = { ...c, operadorId: c.operadorId ?? null, criadoEm, handoffDesde: opts.handoffHaMin !== undefined ? ha(opts.handoffHaMin) : null };
    contatos.push(contato);
    const prod = opts.produto ?? IDS.comunidade;
    const valor = opts.valor ?? (prod === IDS.comunidade ? 1997 : prod === IDS.imersao ? 4970 : prod === IDS.mentoria ? 12000 : 2500);
    const o: Oportunidade = { id: id("o"), contatoId: contato.id, produtoId: prod, valor, etapa, entrouNaEtapaEm: ha(opts.naEtapaHaMin), proximoPasso: "", briefing: opts.briefing ?? null, perdida: !!opts.perdida, motivoPerda: opts.perdida ?? null, criadaEm: criadoEm };
    oportunidades.push(o);
    const ordem: EtapaId[] = ["novo", "conversa", "handoff", "briefing", "proposta", "oferta", "pago", "dentro"];
    const ate = ordem.indexOf(etapa);
    const passo = (opts.criadoHaMin - opts.naEtapaHaMin) / Math.max(1, ate);
    for (let i = 0; i <= ate; i++) {
      const por = i <= 2 ? (i === 2 ? "robo" : i === 0 ? "sistema" : "robo") : i === 4 || i >= 6 ? "sistema" : IDS.otavio;
      movimentos.push({ id: id("m"), oportunidadeId: o.id, de: i === 0 ? null : ordem[i - 1], para: ordem[i], por, em: ha(Math.round(opts.criadoHaMin - passo * i)), motivo: null });
    }
    if (opts.perdida) movimentos.push({ id: id("m"), oportunidadeId: o.id, de: etapa, para: "perdido", por: IDS.otavio, em: ha(Math.max(1, opts.naEtapaHaMin - 30)), motivo: opts.perdida });
    return { contato, o };
  };
  const msg = (contatoId: string, autor: Mensagem["autor"], texto: string, haMin: number, extra: Partial<Mensagem> = {}) => mensagens.push({ id: id("msg"), contatoId, autor, texto, em: ha(haMin), ...extra });

  // 1. Mariana: pediu humano, ninguém assumiu (handoff pendente)
  const mariana = lead({ id: "c1", nome: "Mariana Rocha", empresa: "Clínica Exemplo Vida", segmento: "Saúde", cidade: "Goiânia", telefone: "(62) 90000-0001", email: "mariana@exemplo.com", origem: "perpetuo", nota: 9, dono: "robo", handoffPendente: true, termometro: null }, "handoff", { criadoHaMin: 95, naEtapaHaMin: 22, handoffHaMin: 22 });
  msg("c1", "robo", "Oi, Mariana! Aqui é o Cláudio, assistente de IA da IA para Donos. Vi que você chegou pelo anúncio. Posso te fazer uma pergunta rápida para te ajudar melhor?", 94);
  msg("c1", "contato", "Oi, vi o anúncio. Perco paciente no WhatsApp toda semana.", 60);
  msg("c1", "robo", "Entendi. Colocar um atendimento organizado para funcionar na clínica é prioridade agora? De 0 a 10, qual a nota?", 59);
  msg("c1", "contato", "9. E quanto custa?", 23);
  msg("c1", "robo", "Faz sentido, Mariana. Vou te passar para Otávio, que cuida disso. Em instantes Otávio fala com você por aqui.", 22);

  // 2. Paulo: briefing feito, ligação com transcrição
  lead({ id: "c2", nome: "Paulo Mendes", empresa: "Mendes Engenharia", segmento: "Serviços", cidade: "Anápolis", telefone: "(62) 90000-0002", email: "paulo@exemplo.com", origem: "live", nota: 10, dono: "humano", operadorId: IDS.otavio, handoffPendente: false, termometro: "quente" }, "briefing", { criadoHaMin: 60 * 26, naEtapaHaMin: 90, briefing: { dor: "Orçamentos espalhados, prazo de resposta perdido", meta: "Responder em até 1 dia útil", data: "30/11" } });
  msg("c2", "contato", "Participei da aula de ontem. Quero entender o próximo passo.", 60 * 25);
  msg("c2", "robo", "Que bom, Paulo! De 0 a 10, colocar isso para funcionar na sua empresa é prioridade agora?", 60 * 25 + 1);
  msg("c2", "contato", "10. Quero falar com alguém hoje.", 60 * 24);
  msg("c2", "robo", "Faz sentido, Paulo. Vou te passar para Otávio, que cuida disso.", 60 * 24 + 1);
  msg("c2", "humano", "Oi Paulo, daqui pra frente quem fala com você é Otávio. O assistente de IA não atende mais esta conversa.", 60 * 23, { aviso: true, operadorId: IDS.otavio });
  msg("c2", "humano", "Paulo, aqui é o Otávio. Vamos marcar 10 minutos hoje?", 60 * 23 - 1, { operadorId: IDS.otavio });
  msg("c2", "contato", "Pode ser às 10h15.", 60 * 22);
  ligacoes.push({
    id: "l1", contatoId: "c2", operadorId: IDS.otavio, iniciouEm: ha(60 * 4), duracaoSeg: 582, resultado: "atendeu", avisoGravacaoDado: true, termometroVendedor: "quente", termometroIA: "quente",
    resumo: "Paulo decide sozinho. Dor clara em orçamentos espalhados. Quer resolver antes de 30/11. Receio: adoção pela equipe.",
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
      { texto: "Mostrar como a equipe usa no dia a dia", quando: "amanhã", origem: "04:30" },
    ],
  });

  // 3. Ana: nota 7, convidada para a live
  lead({ id: "c3", nome: "Ana Beatriz Lima", empresa: "Studio Lima", segmento: "Beleza", cidade: "Goiânia", telefone: "(62) 90000-0003", email: "", origem: "perpetuo", nota: 7, dono: "robo", handoffPendente: false, termometro: null }, "conversa", { criadoHaMin: 60 * 30, naEtapaHaMin: 60 * 28 });
  msg("c3", "robo", "Oi, Ana! Aqui é o Cláudio. De 0 a 10, colocar isso para funcionar no seu estúdio é prioridade agora?", 60 * 29);
  msg("c3", "contato", "Acho que 7. Tô correndo com outras coisas.", 60 * 28);
  msg("c3", "robo", "Boa, Ana. Como está quase lá, a próxima aula aberta é na quarta às 14h: vou te mostrar na prática. Quer o lembrete?", 60 * 28 - 1);

  // 4. Carlos: proposta aberta, prazo estourado
  lead({ id: "c4", nome: "Carlos Teixeira", empresa: "Teixeira Móveis", segmento: "Varejo", cidade: "Aparecida", telefone: "(62) 90000-0004", email: "carlos@exemplo.com", origem: "evento", nota: 8, dono: "humano", operadorId: IDS.otavio, handoffPendente: false, termometro: "morno" }, "proposta", { criadoHaMin: 60 * 24 * 6, naEtapaHaMin: 60 * 52, briefing: { dor: "Vendedores sem rotina de follow-up", meta: "Dobrar retorno de orçamentos", data: "15/12" } });
  msg("c4", "humano", "Carlos, a proposta está no link. Qualquer dúvida me chama aqui.", 60 * 53, { operadorId: IDS.otavio });

  // 5. Renata: oferta com link de pagamento pendente
  const renata = lead({ id: "c5", nome: "Renata Souza", empresa: "Souza Contabilidade", segmento: "Serviços", cidade: "Goiânia", telefone: "(62) 90000-0005", email: "renata@exemplo.com", origem: "live", nota: 9, dono: "humano", operadorId: IDS.otavio, handoffPendente: false, termometro: "quente" }, "oferta", { criadoHaMin: 60 * 24 * 4, naEtapaHaMin: 60 * 10, briefing: { dor: "Cobrança manual", meta: "Automatizar lembretes", data: "10/11" } });
  msg("c5", "humano", "Renata, segue o link para Pix: https://pagamento.exemplo/ab12cd34 · Condição: bônus da sessão fechada, válida até sexta.", 60 * 10, { operadorId: IDS.otavio });

  // 6. Fábio: lead novo, Cláudio acabou de abrir
  lead({ id: "c6", nome: "Fábio Antunes", empresa: "Antunes Auto", segmento: "Serviços", cidade: "Trindade", telefone: "(62) 90000-0006", email: "", origem: "perpetuo", nota: null, dono: "robo", handoffPendente: false, termometro: null }, "novo", { criadoHaMin: 3, naEtapaHaMin: 3 });
  msg("c6", "robo", "Oi, Fábio! Aqui é o Cláudio, assistente de IA da IA para Donos. Vi que você chegou pelo anúncio. Posso te fazer uma pergunta rápida para te ajudar melhor?", 3);

  // 7. Letícia: pagou hoje
  const leticia = lead({ id: "c7", nome: "Letícia Fernandes", empresa: "Fernandes Pet", segmento: "Varejo", cidade: "Goiânia", telefone: "(62) 90000-0007", email: "leticia@exemplo.com", origem: "evento", nota: 10, dono: "humano", operadorId: IDS.otavio, handoffPendente: false, termometro: "quente" }, "pago", { criadoHaMin: 60 * 24 * 9, naEtapaHaMin: 120, briefing: { dor: "Fila de atendimento", meta: "Atender em 5 min", data: "01/12" } });
  msg("c7", "humano", "Letícia, bem-vinda. Seu plano de entrada sai hoje.", 100, { operadorId: IDS.otavio });

  // 8. Marcos: logística, conversa que o Otávio assumiu e devolveu
  lead({ id: "c8", nome: "Marcos Vieira", empresa: "Vieira Logística", segmento: "Logística", cidade: "Senador Canedo", telefone: "(62) 90000-0008", email: "marcos@exemplo.com", origem: "perpetuo", nota: 9, dono: "robo", handoffPendente: false, termometro: "morno" }, "handoff", { criadoHaMin: 60 * 24 * 2, naEtapaHaMin: 60 * 20 });
  msg("c8", "robo", "Oi, Marcos, aqui é o Cláudio da IA para Donos. Vi que você baixou o diagnóstico. Posso te fazer uma pergunta rápida?", 60 * 47);
  msg("c8", "contato", "Pode.", 60 * 46);
  msg("c8", "robo", "Colocar IA para rodar na sua empresa é prioridade agora? De 0 a 10?", 60 * 46 + 1);
  msg("c8", "contato", "9. Minha dor é rastreio de cargas e cliente ligando toda hora perguntando onde está. Queria falar com uma pessoa.", 60 * 21);
  msg("c8", "robo", "Faz sentido. Vou te passar para o Otávio, que cuida disso.", 60 * 20);
  msg("c8", "humano", "Oi Marcos, daqui pra frente quem fala com você é Otávio. O assistente de IA não atende mais esta conversa.", 60 * 19, { aviso: true, operadorId: IDS.otavio });
  msg("c8", "humano", "Olá, Marcos. Sou o Otávio. Te ligo em 5 minutos?", 60 * 19 - 1, { operadorId: IDS.otavio });
  msg("c8", "robo", "Marcos, a conversa voltou para o Cláudio, nosso assistente de IA. Se quiser falar com uma pessoa, é só pedir.", 60 * 17, { aviso: true });
  ligacoes.push({
    id: "l2", contatoId: "c8", operadorId: IDS.otavio, iniciouEm: ha(60 * 18), duracaoSeg: 312, resultado: "atendeu", avisoGravacaoDado: true, termometroVendedor: "morno", termometroIA: "quente",
    resumo: "Marcos tem dor forte em rastreio de carga. Quer ver um exemplo antes de decidir. Sócio participa da decisão.",
    trechos: [
      { quem: "vendedor", texto: "Marcos, esta ligação é gravada para registro, tudo bem?", hora: "00:03", marca: null },
      { quem: "contato", texto: "Cliente liga toda hora perguntando onde está a carga. Perco a manhã nisso.", hora: "00:40", marca: "dor" },
      { quem: "contato", texto: "Queria que o cliente recebesse a posição sozinho, sem me ligar.", hora: "01:30", marca: "meta" },
      { quem: "contato", texto: "Meu sócio precisa ver junto.", hora: "03:10", marca: "objeção" },
    ],
    followups: [{ texto: "Marcar conversa com Marcos e o sócio", quando: "amanhã", origem: "03:10" }],
  });

  // 9-12. Mais leads para dar volume às métricas
  lead({ id: "c9", nome: "Juliana Prado", empresa: "Prado Arquitetura", segmento: "Serviços", cidade: "Goiânia", telefone: "(62) 90000-0009", email: "", origem: "live", nota: null, dono: "robo", handoffPendente: false, termometro: null }, "novo", { criadoHaMin: 60 * 5, naEtapaHaMin: 60 * 5 });
  msg("c9", "robo", "Oi, Juliana! Aqui é o Cláudio. Vi que você se inscreveu na live de quarta. Posso te fazer uma pergunta rápida?", 60 * 5);
  lead({ id: "c10", nome: "Ricardo Alves", empresa: "Alves Distribuidora", segmento: "Atacado", cidade: "Rio Verde", telefone: "(64) 90000-0010", email: "ricardo@exemplo.com", origem: "perpetuo", nota: 4, dono: "robo", handoffPendente: false, termometro: null }, "conversa", { criadoHaMin: 60 * 24 * 3, naEtapaHaMin: 60 * 24 * 3 - 30 });
  msg("c10", "robo", "Ricardo, de 0 a 10, isso é prioridade agora?", 60 * 24 * 3 - 20);
  msg("c10", "contato", "Uns 4. Talvez ano que vem.", 60 * 24 * 3 - 30);
  msg("c10", "robo", "Entendi, Ricardo. Então não é o momento de forçar nada. Vou te mandar um conteúdo curto e, quando virar prioridade, me chama por aqui.", 60 * 24 * 3 - 31);
  lead({ id: "c11", nome: "Sônia Carvalho", empresa: "Carvalho Imóveis", segmento: "Imobiliário", cidade: "Goiânia", telefone: "(62) 90000-0011", email: "sonia@exemplo.com", origem: "evento", nota: 9, dono: "humano", operadorId: IDS.otavio, handoffPendente: false, termometro: "frio" }, "oferta", { criadoHaMin: 60 * 24 * 12, naEtapaHaMin: 60 * 24 * 5, briefing: { dor: "Leads esfriam sem follow-up", meta: "Responder em 10 min", data: "20/11" }, perdida: "preço" });
  lead({ id: "c12", nome: "Henrique Dias", empresa: "Dias Academia", segmento: "Fitness", cidade: "Goiânia", telefone: "(62) 90000-0012", email: "henrique@exemplo.com", origem: "perpetuo", nota: 10, dono: "humano", operadorId: IDS.otavio, handoffPendente: false, termometro: "quente" }, "dentro", { criadoHaMin: 60 * 24 * 20, naEtapaHaMin: 60 * 24 * 11, briefing: { dor: "Renovação manual de planos", meta: "Renovar sem ligar", data: "01/11" } });
  lead({ id: "c13", nome: "Beatriz Nunes", empresa: "Nunes Odonto", segmento: "Saúde", cidade: "Anápolis", telefone: "(62) 90000-0013", email: "", origem: "perpetuo", nota: 8, dono: "robo", handoffPendente: false, termometro: null }, "conversa", { criadoHaMin: 60 * 24 * 10, naEtapaHaMin: 60 * 24 * 10 - 60 });
  lead({ id: "c14", nome: "Tiago Barros", empresa: "Barros Transportes", segmento: "Logística", cidade: "Catalão", telefone: "(64) 90000-0014", email: "", origem: "live", nota: 10, dono: "humano", operadorId: IDS.otavio, handoffPendente: false, termometro: "quente" }, "pago", { criadoHaMin: 60 * 24 * 16, naEtapaHaMin: 60 * 24 * 9, briefing: { dor: "Cotação demorada", meta: "Cotar em 1 h", data: "30/10" }, produto: IDS.imersao });

  // Gastos de mídia dos últimos 30 dias (perpétuo todo dia; live em dias alternados; evento em 3 dias)
  const gastos: GastoMidia[] = [];
  for (let d = 0; d < 30; d++) {
    gastos.push({ id: id("g"), funilId: "perpetuo", criativoId: d % 2 ? "cr1" : "cr2", data: dia(d), valor: 35 + (d * 7) % 20, visitas: 40 + (d * 13) % 25 });
    if (d % 2 === 0) gastos.push({ id: id("g"), funilId: "live", criativoId: "cr3", data: dia(d), valor: 22 + (d * 5) % 12, visitas: 25 + (d * 11) % 20 });
    if (d === 2 || d === 9 || d === 16) gastos.push({ id: id("g"), funilId: "evento", criativoId: null, data: dia(d), valor: 120, visitas: 60 });
  }

  const estado: EstadoCRM = {
    versao: ESTADO_VERSAO,
    config: { nomeEmpresa: "IA para Donos", nomeRobo: "Cláudio", roboOperadorId: IDS.claudio },
    operadores: [
      { id: IDS.dono, nome: "João (dono)", papel: "dono", tipo: "humano", email: "dono@exemplo.com", ativo: true },
      { id: IDS.otavio, nome: "Otávio", papel: "vendedor", tipo: "humano", email: "otavio@exemplo.com", ativo: true },
      { id: IDS.claudio, nome: "Cláudio", papel: "vendedor", tipo: "ia", ativo: true },
      { id: IDS.leitura, nome: "Grokbot (leitura)", papel: "leitura", tipo: "ia", ativo: true },
      { id: IDS.bot, nome: "Bot de testes (navegador)", papel: "bot", tipo: "ia", ativo: true },
    ],
    produtos: [
      { id: IDS.comunidade, nome: "Comunidade IA para Donos", valor: 1997, parcelas: "12x R$ 197", descricao: "Encontros semanais, templates e suporte no grupo.", ativo: true, gatilhos: ["Sessão fechada de quinta: entra até sexta e participa", "Bônus do evento: diagnóstico do João (3 dias)"], playbook: [] },
      { id: IDS.imersao, nome: "Imersão presencial", valor: 4970, parcelas: "10x R$ 497", descricao: "Dois dias presenciais, turma pequena.", ativo: true, gatilhos: ["Vaga com desconto de lote até o fim do mês"], playbook: [] },
      { id: IDS.mentoria, nome: "Mentoria individual", valor: 12000, parcelas: "12x R$ 1.000", descricao: "Um a um, 6 meses.", ativo: true, gatilhos: ["Só 2 vagas por trimestre"], playbook: [] },
      { id: IDS.diagnostico, nome: "Diagnóstico presencial", valor: 2500, parcelas: "à vista", descricao: "Meio dia na sua empresa.", ativo: true, gatilhos: [], playbook: [] },
    ],
    funis: [
      { id: "perpetuo", nome: "Perpétuo", canal: "Anúncio + formulário", produto: IDS.comunidade, ativo: true },
      { id: "live", nome: "Live semanal", canal: "Aula aberta de quarta, 14h", produto: IDS.comunidade, ativo: true },
      { id: "evento", nome: "Evento quinzenal", canal: "Evento presencial ou live especial", produto: IDS.comunidade, ativo: true },
    ],
    criativos: [
      { id: "cr1", funilId: "perpetuo", nome: "Vídeo · 'Perco paciente no WhatsApp'", plataforma: "Meta Ads", ativo: true },
      { id: "cr2", funilId: "perpetuo", nome: "Imagem · Diagnóstico gratuito", plataforma: "Meta Ads", ativo: true },
      { id: "cr3", funilId: "live", nome: "Convite · Aula de quarta", plataforma: "Meta Ads", ativo: true },
      { id: "cr4", funilId: "perpetuo", nome: "Busca · 'CRM com IA'", plataforma: "Google Ads", ativo: false },
    ],
    gastos,
    contatos,
    oportunidades,
    movimentos,
    mensagens,
    notas: [
      { id: "n1", contatoId: "c2", texto: "Decide sozinho. Quer organizar a fila de orçamentos.", autorId: IDS.otavio, em: ha(60 * 22) },
      { id: "n2", contatoId: "c4", texto: "Abriu a proposta 2 vezes.", autorId: IDS.otavio, em: ha(60 * 30) },
      { id: "n3", contatoId: "c8", texto: "Marcos tem dores fortes em logística. Sócio decide junto.", autorId: IDS.otavio, em: ha(60 * 17) },
    ],
    tarefas: [
      { id: "t1", contatoId: "c2", texto: "Enviar a proposta com a dor e a meta do briefing", venceEm: ha(-60 * 3), origem: "ligação 10:15", feita: false, criadaEm: ha(60 * 4) },
      { id: "t2", contatoId: "c2", texto: "Mostrar como a equipe usa no dia a dia", venceEm: ha(-60 * 26), origem: "ligação 10:15", feita: false, criadaEm: ha(60 * 4) },
      { id: "t3", contatoId: "c8", texto: "Marcar conversa com Marcos e o sócio", venceEm: ha(-60 * 20), origem: "ligação", feita: false, criadaEm: ha(60 * 17) },
      { id: "t4", contatoId: "c5", texto: "Perguntar se precisa de ajuda com o Pix", venceEm: ha(60), origem: "manual", feita: false, criadaEm: ha(60 * 9) },
      { id: "t5", contatoId: "c7", texto: "Enviar plano de entrada", venceEm: ha(-60 * 5), origem: "manual", feita: false, criadaEm: ha(100) },
    ],
    ligacoes,
    pagamentos: [
      { id: "pg1", oportunidadeId: renata.o.id, valor: 1997, metodo: "pix", status: "pendente", linkUrl: "https://pagamento.exemplo/ab12cd34", expiraEm: ha(-60 * 24 * 2), criadoEm: ha(60 * 10), pagoEm: null },
      { id: "pg2", oportunidadeId: leticia.o.id, valor: 1997, metodo: "cartao", status: "pago", linkUrl: "https://pagamento.exemplo/ef56gh78", expiraEm: null, criadoEm: ha(60 * 26), pagoEm: ha(120) },
      { id: "pg3", oportunidadeId: oportunidades.find((o) => o.contatoId === "c12")!.id, valor: 1997, metodo: "pix", status: "pago", linkUrl: null, expiraEm: null, criadoEm: ha(60 * 24 * 12), pagoEm: ha(60 * 24 * 11) },
      { id: "pg4", oportunidadeId: oportunidades.find((o) => o.contatoId === "c14")!.id, valor: 4970, metodo: "cartao", status: "pago", linkUrl: null, expiraEm: null, criadoEm: ha(60 * 24 * 9 + 30), pagoEm: ha(60 * 24 * 9) },
      { id: "pg5", oportunidadeId: oportunidades.find((o) => o.contatoId === "c14")!.id, valor: 4970, metodo: "cartao", status: "falhou", linkUrl: null, expiraEm: null, criadoEm: ha(60 * 24 * 9 + 60), pagoEm: null },
    ],
    propostas: [
      { id: "pr1", oportunidadeId: oportunidades.find((o) => o.contatoId === "c4")!.id, texto: "Carlos, pelo que você me contou, a dor é vendedores sem rotina de follow-up e a meta é dobrar o retorno de orçamentos até 15/12. Proposta: Comunidade IA para Donos, com o playbook de follow-up implantado na primeira semana.", criadaEm: ha(60 * 55), enviadaEm: ha(60 * 53), enviadaPor: "whatsapp", abertaEm: ha(60 * 52) },
      { id: "pr2", oportunidadeId: renata.o.id, texto: "Renata, a dor é cobrança manual; a meta, lembretes automáticos até 10/11. Proposta: Comunidade + template de cobrança.", criadaEm: ha(60 * 24 * 2), enviadaEm: ha(60 * 24 * 2), enviadaPor: "whatsapp", abertaEm: ha(60 * 24 * 2 - 40) },
    ],
    ocorrencias: [
      { id: "oc1", contatoId: "c8", tipo: "melhoria", descricao: "Cláudio foi muito seco. Deveria ter conversado um pouco mais antes de passar.", trechos: [{ autor: "robo", texto: "Faz sentido. Vou te passar para o Otávio, que cuida disso.", em: ha(60 * 20) }], status: "aberta", abertaPor: IDS.otavio, em: ha(60 * 17), resposta: null },
    ],
    templates: [
      { id: "tp1", nome: "Convite para a sessão fechada", canal: "whatsapp", assunto: null, texto: "{nome}, quinta às 19h tem a sessão fechada da {empresa}. Vou te mostrar na prática como {produto} resolve o que você me contou. Posso te mandar o link?" },
      { id: "tp2", nome: "Follow-up sem pressão", canal: "whatsapp", assunto: null, texto: "{nome}, passando para saber se ficou alguma dúvida sobre a proposta. Se preferir, te ligo em 5 minutos." },
      { id: "tp3", nome: "Convite para sessão fechada (e-mail)", canal: "email", assunto: "Convite: sessão fechada de quinta", texto: "Olá, {nome}.\n\nQuinta-feira às 19h fazemos uma sessão fechada para quem está decidindo entrar na {empresa}. Vou mostrar como {produto} funciona no dia a dia.\n\nQuer participar? Responda este e-mail que eu mando o link.\n\n{operador}" },
      { id: "tp4", nome: "Proposta enviada (e-mail)", canal: "email", assunto: "Sua proposta · {empresa}", texto: "Olá, {nome}.\n\nSegue a proposta que combinamos. Qualquer dúvida, me chama no WhatsApp.\n\n{operador}" },
    ],
    emails: [
      { id: "e1", contatoId: "c4", assunto: "Sua proposta · IA para Donos", texto: "Olá, Carlos. Segue a proposta que combinamos.", em: ha(60 * 53), enviadoPor: IDS.otavio },
    ],
    chaves: [
      { id: "k1", nome: "Grokbot · leitura (exemplo)", chave: IDS.chaveLeitura, escopo: "leitura", operadorId: IDS.leitura, criadaEm: ha(60 * 24 * 3), revogadaEm: null },
      { id: "k2", nome: "Integrações · escrita (exemplo)", chave: IDS.chaveEscrita, escopo: "escrita", operadorId: IDS.dono, criadaEm: ha(60 * 24 * 3), revogadaEm: null },
    ],
  };
  void mariana;
  return estado;
}

/** Estado vazio, só com o mínimo para começar do zero. */
export function estadoVazio(agoraIso = new Date().toISOString()): EstadoCRM {
  const base = estadoExemplo(agoraIso);
  return {
    ...base,
    contatos: [], oportunidades: [], movimentos: [], mensagens: [], notas: [], tarefas: [], ligacoes: [], pagamentos: [], propostas: [], ocorrencias: [], emails: [], gastos: [],
    criativos: [],
    operadores: base.operadores.filter((o) => [IDS.dono, IDS.claudio].includes(o.id)),
    chaves: [],
  };
}
