/**
 * Modelo de domínio do CRM. Tipos puros, sem dependência de tela ou de banco.
 * Contato = a pessoa. Oportunidade = uma chance de venda de UM produto para essa pessoa.
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
export type Dono = "robo" | "humano";
export type Autor = "contato" | "robo" | "humano";

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

export interface Produto {
  id: string;
  nome: string;
  valor: number;
  parcelas: string;
}

export interface Funil {
  id: string;
  nome: string;
  canal: string;
  produto: Produto["id"];
}

export interface Mensagem {
  autor: Autor;
  texto: string;
  hora: string;
  /** Aviso automático de troca de atendente. */
  aviso?: boolean;
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
  hora: string;
  duracao: string;
  resultado: "atendeu" | "caixa postal" | "não atende";
  trechos: TrechoLigacao[];
  followups: { texto: string; quando: string; origem: string }[];
  /** O vendedor escolhe (obrigatório). A leitura da IA fica registrada ao lado. */
  termometroVendedor: Termometro;
  termometroIA: Termometro;
}

export interface Oportunidade {
  id: string;
  produtoId: Produto["id"];
  valor: number;
  etapa: EtapaId;
  /** Minutos na etapa atual. */
  minutosNaEtapa: number;
  proximoPasso: string;
  briefing: Briefing | null;
  motivoPerda: string | null;
}

export interface Contato {
  id: string;
  nome: string;
  empresa: string;
  segmento: string;
  cidade: string;
  telefone: string;
  origem: Funil["id"];
  /** Nota 0 a 10 da Pergunta Matadora. null = ainda não deu. */
  nota: number | null;
  dono: Dono;
  /** Handoff pendente: pediu humano e ninguém assumiu. */
  handoffPendente: boolean;
  handoffMin: number;
  termometro: Termometro | null;
  mensagens: Mensagem[];
  notas: string[];
  ligacoes: Ligacao[];
  oportunidades: Oportunidade[];
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
