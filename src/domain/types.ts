/**
 * Modelo de domínio do CRM. Tipos puros, sem dependência de tela, de banco ou de rede.
 *
 * Ideia central: Contato (a pessoa) 1 -> N Oportunidades (uma chance de venda de UM produto).
 * O estado é NORMALIZADO: um array por entidade, igual às tabelas em supabase/schema.sql.
 * Datas são sempre texto ISO (ex.: "2026-10-22T14:30:00.000Z"). Valores em reais (number).
 */
export type EtapaId =
  | "novo"
  | "conversa"
  | "handoff"
  | "briefing"
  | "proposta"
  | "oferta"
  | "pago"
  | "dentro"
  | "perdido";

/** Calculada pelas oportunidades. Ninguém edita. */
export type Categoria = "lead" | "prospect" | "cliente";
export type Termometro = "frio" | "morno" | "quente";
/** Quem está no comando da conversa: o robô (Cláudio) ou um humano. */
export type Dono = "robo" | "humano";
export type Autor = "contato" | "robo" | "humano";
/** Papel do operador. `leitura` e `bot` existem para dar acesso controlado a agentes (Grokbot, Cursor, navegador). */
export type Papel = "dono" | "vendedor" | "leitura" | "bot";
export type Periodo = "hoje" | "7d" | "30d";
export type Escopo = "leitura" | "escrita";

export interface Etapa {
  id: EtapaId;
  nome: string;
  objetivo: string;
  /** Critério que dá para checar. O card só anda quando isso aconteceu. */
  validacao: string;
  /** Minutos parado até o card apitar. 0 = sem prazo. */
  prazoMin: number;
  prazoTexto: string;
  /** Meta de conversão (%) escolhida pelo dono. Não é benchmark de terceiros. */
  meta: number;
  /** true = o sistema move o card (pagamento, login); ninguém arrasta. */
  auto: boolean;
  dono: Dono | "sistema";
  motivosPerda: string[];
}

export interface Operador {
  id: string;
  nome: string;
  papel: Papel;
  tipo: "humano" | "ia";
  email?: string;
  ativo: boolean;
}

export interface Produto {
  id: string;
  nome: string;
  valor: number;
  parcelas: string;
  descricao?: string;
  ativo: boolean;
  /** Condições verdadeiras de oferta (ex.: "bônus do evento até sexta"). Nunca inventadas na hora. */
  gatilhos: string[];
  /** Playbook próprio por etapa. Quando vazio, vale o PLAYBOOK padrão de src/domain/funil.ts. */
  playbook: PerguntaMatadora[];
}

/** Funil de ENTRADA: de onde o lead vem (perpétuo, live, evento...). Não confundir com as etapas do funil de venda. */
export interface Funil {
  id: string;
  nome: string;
  canal: string;
  produto: Produto["id"];
  ativo: boolean;
}

export interface Criativo {
  id: string;
  funilId: Funil["id"];
  nome: string;
  plataforma: string;
  ativo: boolean;
}

export interface GastoMidia {
  id: string;
  funilId: Funil["id"];
  criativoId: Criativo["id"] | null;
  /** Dia do gasto, "AAAA-MM-DD". */
  data: string;
  valor: number;
  /** Visitas à página naquele dia (para visita -> lead). */
  visitas: number;
}

export interface Mensagem {
  id: string;
  contatoId: string;
  autor: Autor;
  texto: string;
  em: string;
  /** Aviso automático de troca de atendente. */
  aviso?: boolean;
  operadorId?: string | null;
}

export interface Nota {
  id: string;
  contatoId: string;
  texto: string;
  autorId: string | null;
  em: string;
}

export interface Tarefa {
  id: string;
  contatoId: string;
  texto: string;
  venceEm: string | null;
  /** De onde veio: "ligação 10:15", "manual", "cláudio". */
  origem: string;
  feita: boolean;
  criadaEm: string;
}

export interface Briefing {
  dor: string;
  meta: string;
  data: string;
}

export interface TrechoLigacao {
  quem: "vendedor" | "contato";
  texto: string;
  hora: string;
  /** Marca do trecho (dor, meta, prazo, objeção, decisão) ou null. */
  marca: "dor" | "meta" | "prazo" | "objeção" | "decisão" | null;
}

export interface Ligacao {
  id: string;
  contatoId: string;
  operadorId: string | null;
  iniciouEm: string;
  duracaoSeg: number;
  resultado: "atendeu" | "caixa postal" | "não atende";
  /** Sem aviso, não grava. */
  avisoGravacaoDado: boolean;
  trechos: TrechoLigacao[];
  followups: { texto: string; quando: string; origem: string }[];
  resumo: string;
  /** O vendedor escolhe (obrigatório). A leitura da IA fica registrada ao lado. */
  termometroVendedor: Termometro;
  termometroIA: Termometro;
}

export interface Pagamento {
  id: string;
  oportunidadeId: string;
  valor: number;
  metodo: "pix" | "cartao" | "boleto";
  status: "pendente" | "pago" | "falhou" | "reembolsado";
  linkUrl: string | null;
  expiraEm: string | null;
  criadoEm: string;
  pagoEm: string | null;
}

export interface Proposta {
  id: string;
  oportunidadeId: string;
  texto: string;
  criadaEm: string;
  enviadaEm: string | null;
  enviadaPor: "whatsapp" | "email" | null;
  /** Quando o contato abriu. É este evento que move o card para "Proposta aberta". */
  abertaEm: string | null;
}

export interface Ocorrencia {
  id: string;
  contatoId: string;
  tipo: "problema" | "melhoria";
  descricao: string;
  /** Trechos da conversa marcados pelo vendedor. */
  trechos: { autor: Autor; texto: string; em: string }[];
  status: "aberta" | "em análise" | "resolvida";
  abertaPor: string | null;
  em: string;
  resposta: string | null;
}

export interface Template {
  id: string;
  nome: string;
  canal: "whatsapp" | "email";
  assunto: string | null;
  /** Variáveis: {nome}, {empresa}, {produto}, {operador}, {link}. */
  texto: string;
}

export interface Email {
  id: string;
  contatoId: string;
  assunto: string;
  texto: string;
  em: string;
  enviadoPor: string | null;
}

export interface ChaveApi {
  id: string;
  nome: string;
  /** A chave completa. No banco real, guarde só o hash; aqui é um CRM local. */
  chave: string;
  escopo: Escopo;
  operadorId: string | null;
  criadaEm: string;
  revogadaEm: string | null;
}

export interface Movimento {
  id: string;
  oportunidadeId: string;
  de: EtapaId | null;
  para: EtapaId;
  /** "robo" | "sistema" | id do operador. */
  por: string;
  em: string;
  motivo: string | null;
}

export interface Oportunidade {
  id: string;
  contatoId: string;
  produtoId: Produto["id"];
  valor: number;
  etapa: EtapaId;
  entrouNaEtapaEm: string;
  proximoPasso: string;
  briefing: Briefing | null;
  perdida: boolean;
  motivoPerda: string | null;
  criadaEm: string;
}

export interface Contato {
  id: string;
  nome: string;
  empresa: string;
  segmento: string;
  cidade: string;
  telefone: string;
  email: string;
  origem: Funil["id"];
  /** Nota 0 a 10 da Pergunta Matadora. null = ainda não deu. */
  nota: number | null;
  dono: Dono;
  /** Operador humano responsável (quando dono = humano). */
  operadorId: string | null;
  /** Handoff pendente: pediu humano e ninguém assumiu. */
  handoffPendente: boolean;
  handoffDesde: string | null;
  termometro: Termometro | null;
  criadoEm: string;
}

export interface PerguntaMatadora {
  etapa: EtapaId;
  pergunta: string;
  faixas: { de: number; ate: number; acao: string }[];
  complementares: { pergunta: string; porque: string }[];
  objecoes: { objecao: string; diga: string; nuncaDiga: string }[];
  condicao: string;
  proximoPasso: string;
}

export interface ConfigCRM {
  nomeEmpresa: string;
  nomeRobo: string;
  /** Operador IA que representa o robô (aparece em Operadores e nos avatares). */
  roboOperadorId: string;
}

/** Estado completo do CRM. É o que vai para o localStorage, para o arquivo JSON do servidor e, um dia, para as tabelas. */
export interface EstadoCRM {
  versao: number;
  config: ConfigCRM;
  operadores: Operador[];
  produtos: Produto[];
  funis: Funil[];
  criativos: Criativo[];
  gastos: GastoMidia[];
  contatos: Contato[];
  oportunidades: Oportunidade[];
  movimentos: Movimento[];
  mensagens: Mensagem[];
  notas: Nota[];
  tarefas: Tarefa[];
  ligacoes: Ligacao[];
  pagamentos: Pagamento[];
  propostas: Proposta[];
  ocorrencias: Ocorrencia[];
  templates: Template[];
  emails: Email[];
  chaves: ChaveApi[];
}

/** Visão montada de um contato com tudo que é dele. Só para tela; não é salva. */
export interface ContatoCompleto extends Contato {
  categoria: Categoria;
  oportunidades: Oportunidade[];
  mensagens: Mensagem[];
  notas: Nota[];
  tarefas: Tarefa[];
  ligacoes: Ligacao[];
  propostas: Proposta[];
  pagamentos: Pagamento[];
  emails: Email[];
  ocorrencias: Ocorrencia[];
  movimentos: Movimento[];
}

export const ESTADO_VERSAO = 2;
