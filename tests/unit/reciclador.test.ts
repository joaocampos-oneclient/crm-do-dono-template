import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { Agent } from "@mastra/core/agent";
import {
  avaliarGuardrailsPosLlm,
  avaliarGuardrailsPreLlm,
  calcularMetricasCampanha,
  dentroDaJanelaHorario,
  detectarPedidoOptOut,
  detectarRecusaRecente,
  mascararTelefoneReciclador,
  mencionaPrecoComercial,
  parseCsvLeadsComContexto,
  temContextoMinimo,
} from "@/domain/reciclador";
import { executarAgente } from "@/lib/agents";
import {
  effectiveAgentLlmModel,
  saveAgentLlmModel,
} from "@/lib/agents/llm-store";
import {
  acionarParadaEmergenciaGlobal,
  atualizarCampanhaReciclador,
  criarCampanhaReciclador,
  executarTickReciclador,
  importarCsvNaCampanha,
  listarEstadoReciclador,
  obterDetalheCampanha,
  processarRespostaLeadReciclador,
  registrarOptOutReciclador,
  simularCampanhaReciclador,
} from "@/lib/reciclador";
import { ingestWhatsAppMessage } from "@/lib/whatsapp/ingest";

let tempDir = "";

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "crm-reciclador-test-"));
  process.env.RECICLADOR_DATA_FILE = join(tempDir, "reciclador.json");
  process.env.CRM_LLM_CONNECTION_FILE = join(tempDir, "llm.json");
  process.env.WHATSAPP_LOCAL_FILE = join(tempDir, "whatsapp-mensagens.json");
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.CRM_LLM_API_KEY;
  delete process.env.CRM_LLM_MODEL;
  delete process.env.CRM_EMBER_MODEL;
  delete process.env.WPP_API_KEY;
  delete process.env.WPP_SESSION_ID;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

afterEach(() => {
  vi.restoreAllMocks();
  if (tempDir && existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
  delete process.env.RECICLADOR_DATA_FILE;
  delete process.env.CRM_LLM_CONNECTION_FILE;
  delete process.env.WHATSAPP_LOCAL_FILE;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.CRM_LLM_API_KEY;
  delete process.env.CRM_LLM_MODEL;
  delete process.env.CRM_EMBER_MODEL;
  delete process.env.WPP_API_KEY;
  delete process.env.WPP_SESSION_ID;
});

describe("domínio puro & guardrails (reciclador)", () => {
  it("mascara telefone preservando DDD e 4 dígitos finais", () => {
    expect(mascararTelefoneReciclador("(62) 99123-4567")).toBe("(62) •••••-4567");
    expect(mascararTelefoneReciclador("+55 11 98888-0001")).toBe("(11) •••••-0001");
    expect(mascararTelefoneReciclador("")).toBe("—");
  });

  it("mencionaPrecoComercial bloqueia preços e ofertas reais sem falso-positivo em frases neutras", () => {
    expect(mencionaPrecoComercial("O plano sai por R$ 297 por mês")).toBe(true);
    expect(mencionaPrecoComercial("Custa 1997 reais à vista")).toBe(true);
    expect(mencionaPrecoComercial("Temos uma condição especial com desconto no pix")).toBe(true);
    expect(mencionaPrecoComercial("Parcelamos em 12x no checkout ou boleto")).toBe(true);
    expect(mencionaPrecoComercial("O valor de entrada caiu hoje")).toBe(true);
    expect(mencionaPrecoComercial("Com um investimento de 500 você já começa")).toBe(true);

    // Frases de negócio neutras NÃO podem ser bloqueadas
    expect(mencionaPrecoComercial("Publiquei um passo a passo para gerar valor na sua rotina")).toBe(false);
    expect(mencionaPrecoComercial("Como está a condição da equipe para absorver a triagem?")).toBe(false);
    expect(mencionaPrecoComercial("Faz sentido eu te mandar o resumo que gravei ontem?")).toBe(false);
  });

  it("detectarPedidoOptOut reconhece pedidos variados de descadastro com e sem acento", () => {
    expect(detectarPedidoOptOut("Por favor, não me procure mais")).toBe(true);
    expect(detectarPedidoOptOut("nao me procure")).toBe(true);
    expect(detectarPedidoOptOut("Pare de mandar mensagem")).toBe(true);
    expect(detectarPedidoOptOut("Quero sair da lista / descadastrar")).toBe(true);
    expect(detectarPedidoOptOut("Me tira da lista por gentileza")).toBe(true);
    expect(detectarPedidoOptOut("Não quero contato")).toBe(true);
    expect(detectarPedidoOptOut("bloqueado")).toBe(true);

    expect(detectarPedidoOptOut("Ainda tenho interesse, me chama amanhã")).toBe(false);
    expect(detectarPedidoOptOut("Meu cartão bloqueado atrasou a compra")).toBe(false);
  });

  it("detectarRecusaRecente identifica negativas comerciais explícitas", () => {
    expect(detectarRecusaRecente("Obrigado, mas não tenho interesse")).toBe(true);
    expect(detectarRecusaRecente("ja fechei com outra consultoria")).toBe(true);
    expect(detectarRecusaRecente("Já resolvi internamente")).toBe(true);
    expect(detectarRecusaRecente("Agora não consigo olhar isso")).toBe(true);
    expect(detectarRecusaRecente("Talvez ano que vem")).toBe(true);

    expect(detectarRecusaRecente("Qual o próximo passo pra gente conversar?")).toBe(false);
  });

  it("temContextoMinimo exige substância real ('calar é feature') e rejeita 'oi' isolado ou só robô", () => {
    const vazio = temContextoMinimo({
      mensagens: [
        { autor: "robo", texto: "Oi! Aqui é o Cláudio, posso te fazer uma pergunta rápida?" },
        { autor: "contato", texto: "oi" },
      ],
      notas: [],
      briefing: null,
    });
    expect(vazio.ok).toBe(false);
    expect(vazio.motivo).toMatch(/Sem contexto mínimo — calar é mais inteligente/);

    const rico = temContextoMinimo({
      mensagens: [
        { autor: "contato", texto: "Perco paciente no WhatsApp toda semana porque demoro a responder." },
      ],
      notas: ["Dona da clínica decide sozinha"],
      briefing: { dor: "Demora no WhatsApp", meta: "Responder em 5 min" },
    });
    expect(rico.ok).toBe(true);
    expect(rico.fontesLidas).toEqual(["historico_mensagens", "notas_crm", "briefing"]);
    expect(rico.contextoExtraido).toMatch(/Perco paciente/);
  });

  it("dentroDaJanelaHorario respeita dias úteis e janela configurada em America/Sao_Paulo", () => {
    const freios = {
      maxPorHora: 8,
      maxPorDia: 30,
      espacamentoSegundos: 120,
      janelaInicioHora: 9,
      janelaFimHora: 18,
      apenasDiasUteis: true,
      cooldownRecusaDias: 30,
    };

    // Quarta-feira 14h BRT (17:00 UTC)
    expect(dentroDaJanelaHorario("2026-11-04T17:00:00.000Z", freios).ok).toBe(true);
    // Quarta-feira 21h BRT (00:00 UTC do dia seguinte) -> fora da janela
    expect(dentroDaJanelaHorario("2026-11-05T00:00:00.000Z", freios).ok).toBe(false);
    // Sábado 11h BRT (14:00 UTC) -> fim de semana bloqueado
    expect(dentroDaJanelaHorario("2026-11-07T14:00:00.000Z", freios).ok).toBe(false);
  });

  it("avaliarGuardrailsPreLlm bloqueia emergência, cliente ativo, opt-out, recusa recente e cooldown 48h", () => {
    const agora = "2026-11-04T15:00:00.000Z";

    expect(
      avaliarGuardrailsPreLlm({
        agoraIso: agora,
        emergenciaGlobal: true,
        telefone: "62999990001",
        notas: ["Contexto longo suficiente para passar"],
      }).codigo,
    ).toBe("parada_emergencia");

    expect(
      avaliarGuardrailsPreLlm({
        agoraIso: agora,
        telefone: "62999990001",
        etapaAtual: "pago",
        notas: ["Contexto longo suficiente para passar"],
      }).codigo,
    ).toBe("cliente_ativo");

    expect(
      avaliarGuardrailsPreLlm({
        agoraIso: agora,
        telefone: "62999990001",
        mensagens: [
          {
            autor: "contato",
            texto: "Já fechei com outro fornecedor semana passada",
            em: "2026-11-01T15:00:00.000Z",
          },
        ],
      }).codigo,
    ).toBe("recusa_recente");

    expect(
      avaliarGuardrailsPreLlm({
        agoraIso: agora,
        telefone: "62999990001",
        mensagens: [
          {
            autor: "contato",
            texto: "Minha equipe perde prazos de orçamento toda semana.",
            em: "2026-10-25T15:00:00.000Z",
          },
          {
            autor: "robo",
            texto: "Te mandei um áudio ontem.",
            em: "2026-11-03T20:00:00.000Z", // < 48h
          },
        ],
      }).codigo,
    ).toBe("cooldown_48h");
  });

  it("avaliarGuardrailsPosLlm bloqueia clichês genéricos, temas proibidos e preços", () => {
    expect(
      avaliarGuardrailsPosLlm(
        "Oi, tudo bem? Aqui é o João da Empresa X, queria falar sobre gestão.",
        { proibirPreco: true },
      ),
    ).toMatchObject({ ok: false, codigo: "cliche_generico" });

    expect(
      avaliarGuardrailsPosLlm(
        "Maria, passando para saber se conseguiu ver a proposta.",
        { proibirPreco: true },
      ),
    ).toMatchObject({ ok: false, codigo: "cliche_generico" });

    expect(
      avaliarGuardrailsPosLlm(
        "Carlos, lembra que falamos de consultoria tributária? Saiu uma nota hoje.",
        { proibirPreco: true },
        ["consultoria tributaria"],
      ),
    ).toMatchObject({ ok: false, codigo: "tema_proibido" });

    expect(
      avaliarGuardrailsPosLlm(
        "Maria, na última conversa você comentou que o fechamento do mês virava correria de planilha. Gravei um passo a passo curto sobre isso — faz sentido te mandar o link?",
        { proibirPreco: true },
      ),
    ).toEqual({ ok: true });
  });

  it("parseCsvLeadsComContexto aceita linhas ricas (`;` ou `,`) e rejeita lista fria só com telefone", () => {
    const csv = [
      "nome;whatsapp;empresa;contexto;notas;etapa",
      'Maria Silva;(62) 99111-2222;Clínica Vida;"Reclamou que perde pacientes no WhatsApp toda segunda";Pediu retorno em novembro;conversa',
      "João Frio;(62) 99333-4444;Loja X;;;novo",
      "Sem Tel;123;Empresa Y;Tem contexto longo suficiente mas telefone inválido;;conversa",
    ].join("\n");

    const parsed = parseCsvLeadsComContexto(csv);
    expect(parsed.totalLinhas).toBe(3);
    expect(parsed.aceitas).toHaveLength(1);
    expect(parsed.aceitas[0].nome).toBe("Maria Silva");
    expect(parsed.aceitas[0].telefoneDigitos).toBe("5562991112222");
    expect(parsed.rejeitadas).toHaveLength(2);
    expect(parsed.rejeitadas.find((r) => r.nome === "João Frio")?.tipo).toBe("sem_contexto");
    expect(parsed.rejeitadas.find((r) => r.nome === "Sem Tel")?.tipo).toBe("telefone_invalido");
  });

  it("calcularMetricasCampanha não inventa porcentagem quando enviados < 10", () => {
    const m = calcularMetricasCampanha(
      [
        {
          id: "1",
          campanhaId: "c",
          contatoId: "ct1",
          oportunidadeId: null,
          nomeContato: "Ana",
          empresa: "",
          telefone: "62999990001",
          telefoneMascarado: "(62) •••••-0001",
          etapaInicial: "conversa",
          etapaAtual: "conversa",
          contextoExtraido: "ctx",
          fontesLidas: ["notas_crm"],
          status: "enviado",
          decisao: "abordar",
          motivo: "ok",
          ganchoIdentificado: "dor",
          mensagemGerada: "msg",
          modeloUsado: "claude-sonnet-4-5",
          custoTokens: 100,
          providerWhatsapp: "wpp-engine",
          messageIdWhatsapp: "w1",
          criadoEm: "2026-11-04T10:00:00Z",
          processadoEm: "2026-11-04T10:05:00Z",
          respondeuEm: "2026-11-04T10:15:00Z",
          avancouEtapa: true,
          virouVenda: false,
        },
      ],
      0,
    );
    expect(m.enviados).toBe(1);
    expect(m.respostas).toBe(1);
    expect(m.taxaRespostaTexto).toBe("n=1 · amostra pequena");
  });
});

describe("agente ember & modelo LLM dedicado", () => {
  it("prioriza override -> CRM_EMBER_MODEL -> agentModels.ember -> claude-sonnet-4-5", () => {
    expect(effectiveAgentLlmModel("ember")).toBe("claude-sonnet-4-5");
    expect(effectiveAgentLlmModel("claudio")).toBe("claude-haiku-4-5");

    saveAgentLlmModel("ember", "claude-sonnet-4-5-20250929");
    expect(effectiveAgentLlmModel("ember")).toBe("claude-sonnet-4-5-20250929");

    process.env.CRM_EMBER_MODEL = "claude-opus-4-1";
    expect(effectiveAgentLlmModel("ember")).toBe("claude-opus-4-1");
    expect(effectiveAgentLlmModel("ember", "modelo-campanha-custom")).toBe("modelo-campanha-custom");
  });

  it("NUNCA usa fallback genérico quando não há chave LLM configurada", async () => {
    const res = await executarAgente("ember", {
      contexto: {
        nome: "Carlos",
        contextoExtraido: "Carlos abriu a proposta 2 vezes e quer organizar follow-up.",
      },
    });
    expect(res.usadoLlm).toBe(false);
    expect(res.saida.requerAprovacao).toBe(false);
    expect(res.saida.payload).toMatchObject({
      decisao: "ignorar",
      enviado: false,
      bloqueado: true,
      motivo: "sem_llm_configurado",
    });
  });

  it("bloqueia quando o LLM tenta mencionar preço na primeira mensagem", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-valid-key-1234567890";
    vi.spyOn(Agent.prototype, "generate").mockResolvedValueOnce({
      text: JSON.stringify({
        decisao: "abordar",
        motivo: "Tem dor clara",
        gancho: "Follow-up",
        texto: "Carlos, consigo liberar um desconto especial de R$ 200 hoje no pix. Topa?",
        resumo: "Tentou mandar preço",
      }),
      usage: { totalTokens: 120 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const res = await executarAgente("ember", {
      contexto: {
        nome: "Carlos",
        contextoExtraido: "Dor em rotina de follow-up comercial",
        proibirPreco: true,
      },
    });

    expect(res.usadoLlm).toBe(true);
    expect(res.saida.payload.bloqueado).toBe(true);
    expect(res.saida.payload.decisao).toBe("ignorar");
  });
});

describe("motor de campanhas, simulação, tick e handoff de respostas", () => {
  it("semeia campanha inicial 'Reativação Funil Parado' com contatos reais e 1 ignorado sem contexto", async () => {
    const estado = await listarEstadoReciclador();
    expect(estado.campanhas.length).toBeGreaterThanOrEqual(1);
    const seed = estado.campanhas[0];
    expect(seed.nome).toBe("Reativação Funil Parado");
    expect(seed.status).toBe("rascunho");

    const det = await obterDetalheCampanha(seed.id);
    expect(det.itens.length).toBeGreaterThanOrEqual(3);
    expect(det.itens.some((i) => i.status === "pendente" && i.contextoExtraido.length >= 20)).toBe(true);
    expect(det.itens.some((i) => i.status === "ignorado")).toBe(true);
  });

  it("cria campanha, importa CSV filtrando frios e simula sem disparar WhatsApp", async () => {
    const { campanha } = await criarCampanhaReciclador({
      nome: "Campanha Outubro",
      objetivo: "Retomar leads de evento",
      popularDoCrm: false,
    });

    const csv = [
      "nome,telefone,empresa,contexto",
      "Helena Costa,62988776655,Costa Contábil,Pediu material da live sobre cobrança recorrente mas parou na agenda",
      "Lead Frio,62988770000,Sem História,",
    ].join("\n");

    const imp = await importarCsvNaCampanha(campanha.id, csv);
    expect(imp.importados).toBe(1);
    expect(imp.rejeitadosSemContexto).toBe(1);

    // Simulação sem chave LLM gera aviso claro e nunca envia
    const simSemLlm = await simularCampanhaReciclador(campanha.id, 3);
    expect(simSemLlm.processados).toBe(1);
    expect(simSemLlm.avisoLlm).toMatch(/Chave Anthropic/i);
    expect(simSemLlm.itens[0].status).toBe("simulado");
    expect(simSemLlm.itens[0].messageIdWhatsapp).toBeNull();

    // Com chave LLM gera abertura real personalizada
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-valid-key-1234567890";
    vi.spyOn(Agent.prototype, "generate").mockResolvedValueOnce({
      text: JSON.stringify({
        decisao: "abordar",
        motivo: "Pediu material de cobrança recorrente na live",
        gancho: "Material da live sobre cobrança recorrente",
        texto:
          "Helena, você chegou a pedir o material da live sobre cobrança recorrente e acabamos parando ali. Ainda está olhando como automatizar essa frente no escritório ou já resolveu?",
        resumo: "Abertura pronta para Helena",
      }),
      usage: { totalTokens: 185 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const simComLlm = await simularCampanhaReciclador(campanha.id, 3);
    expect(simComLlm.avisoLlm).toBeNull();
    expect(simComLlm.itens[0].decisao).toBe("abordar");
    expect(simComLlm.itens[0].mensagemGerada).toMatch(/Helena/);
    expect(simComLlm.itens[0].status).toBe("simulado");
  });

  it("respeita espaçamento e teto por hora no tick autônomo", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-valid-key-1234567890";

    const { campanha } = await criarCampanhaReciclador({
      nome: "Ritmo Controlado",
      objetivo: "Testar freios de ritmo",
      popularDoCrm: false,
      freios: {
        maxPorHora: 2,
        maxPorDia: 10,
        espacamentoSegundos: 120,
        janelaInicioHora: 9,
        janelaFimHora: 18,
        apenasDiasUteis: true,
        cooldownRecusaDias: 30,
      },
    });

    await importarCsvNaCampanha(
      campanha.id,
      [
        "nome,telefone,contexto",
        "Lead Um,62981110001,Comentou na imersão que perde todos os prazos de retorno no WhatsApp",
        "Lead Dois,62981110002,Pediu diagnóstico para organizar quatro vendedores externos em outubro",
        "Lead Tres,62981110003,Assistiu aula inteira sobre funil perpétuo e perguntou sobre implantação",
      ].join("\n"),
    );
    await atualizarCampanhaReciclador(campanha.id, { acao: "ativar" });

    vi.spyOn(Agent.prototype, "generate").mockImplementation(async () => ({
      text: JSON.stringify({
        decisao: "abordar",
        motivo: "Contexto forte",
        gancho: "Dor operacional",
        texto:
          "Vi sua anotação sobre organizar o retorno dos leads no WhatsApp sem depender de planilha. Montei um roteiro curto disso — faz sentido eu te mandar por aqui?",
        resumo: "Abertura gerada",
      }),
      usage: { totalTokens: 140 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any);

    const enviadosMock: string[] = [];
    const sendFn = vi.fn(async ({ to }: { to: string }) => {
      enviadosMock.push(to);
      return { ok: true as const, id: `wamid.${enviadosMock.length}` };
    });

    // Tick 1 às 14:00:00 BRT -> envia apenas 1 por causa do espacamentoSegundos=120
    const t1 = await executarTickReciclador({
      campanhaId: campanha.id,
      agoraIso: "2026-11-04T17:00:00.000Z",
      sendFn,
    });
    expect(t1.enviados).toBe(1);

    // Tick 2 apenas 30s depois -> bloqueado pelo espaçamento de 120s
    const t2 = await executarTickReciclador({
      campanhaId: campanha.id,
      agoraIso: "2026-11-04T17:00:30.000Z",
      sendFn,
    });
    expect(t2.enviados).toBe(0);
    expect(t2.motivoPausa).toMatch(/espaçamento/i);

    // Tick 3 após 3 minutos (14:03 BRT) -> envia o 2º item
    const t3 = await executarTickReciclador({
      campanhaId: campanha.id,
      agoraIso: "2026-11-04T17:03:00.000Z",
      sendFn,
    });
    expect(t3.enviados).toBe(1);

    // Tick 4 após 10 minutos (14:13 BRT) -> bate no teto maxPorHora=2 e envia 0!
    const t4 = await executarTickReciclador({
      campanhaId: campanha.id,
      agoraIso: "2026-11-04T17:13:00.000Z",
      sendFn,
    });
    expect(t4.enviados).toBe(0);
    expect(t4.motivoPausa).toMatch(/Teto por hora/i);
    expect(enviadosMock).toHaveLength(2);
  });

  it("auto-pausa campanha e registra incidente quando o envio WhatsApp falha ou sessão cai", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-valid-key-1234567890";

    const { campanha } = await criarCampanhaReciclador({
      nome: "Teste Falha Provedor",
      objetivo: "Validar auto-pausa",
      popularDoCrm: false,
    });
    await importarCsvNaCampanha(
      campanha.id,
      [
        "nome,telefone,contexto",
        "Pedro Rocha,62982223333,Explicou na reunião que perdia orçamentos por falta de rotina comercial",
      ].join("\n"),
    );
    await atualizarCampanhaReciclador(campanha.id, { acao: "ativar" });

    // 1) Sem sessão WhatsApp nem sendFn -> auto-pausa por sessao_desconectada
    const tickSemSessao = await executarTickReciclador({
      campanhaId: campanha.id,
      agoraIso: "2026-11-04T17:00:00.000Z",
    });
    expect(tickSemSessao.pausadaPorIncidente).toBe(true);
    let det = await obterDetalheCampanha(campanha.id);
    expect(det.campanha?.status).toBe("pausada");
    expect(det.incidentes.some((i) => i.tipo === "sessao_desconectada")).toBe(true);

    // 2) Reativa e injeta sendFn que devolve erro de rate-limit -> auto-pausa + incidente rate_limit
    await atualizarCampanhaReciclador(campanha.id, { acao: "ativar" });
    vi.spyOn(Agent.prototype, "generate").mockResolvedValueOnce({
      text: JSON.stringify({
        decisao: "abordar",
        motivo: "Dor clara em orçamentos",
        gancho: "Orçamentos sem rotina",
        texto:
          "Pedro, na nossa conversa você comentou que os orçamentos ficavam sem acompanhamento. Ainda está buscando arrumar esse fluxo ou já estruturou por aí?",
        resumo: "Abertura Pedro",
      }),
      usage: { totalTokens: 150 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const tickFalha = await executarTickReciclador({
      campanhaId: campanha.id,
      agoraIso: "2026-11-04T17:05:00.000Z",
      sendFn: async () => ({ ok: false, erro: "HTTP 429 rate limit exceeded", retryAfterSec: 60 }),
    });
    expect(tickFalha.erros).toBe(1);
    expect(tickFalha.pausadaPorIncidente).toBe(true);

    det = await obterDetalheCampanha(campanha.id);
    expect(det.campanha?.status).toBe("pausada");
    expect(det.incidentes.some((i) => i.tipo === "rate_limit")).toBe(true);
  });

  it("atribui resposta do lead, aciona Cláudio sem preço e honra opt-out via ingestWhatsAppMessage", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-valid-key-1234567890";

    const { campanha } = await criarCampanhaReciclador({
      nome: "Handoff Cláudio",
      objetivo: "Entregar respostas ao Cláudio",
      popularDoCrm: false,
      cercas: {
        proibirPreco: true,
        tomMarca: "Direto",
        modeloLlm: "claude-sonnet-4-5",
        entregarPara: "claudio",
        autoResponderClaudio: true,
      },
    });

    await importarCsvNaCampanha(
      campanha.id,
      [
        "nome,telefone,contexto",
        "Luciana Melo,62984445555,Comentou que perdia vendas por demora na triagem de leads da clínica",
        "Roberto Optout,62984446666,Participou do workshop presencial e pediu diagnóstico de equipe",
      ].join("\n"),
    );
    await atualizarCampanhaReciclador(campanha.id, { acao: "ativar" });

    // Envia abertura para Luciana (Roberto permanece pendente na fila)
    vi.spyOn(Agent.prototype, "generate").mockResolvedValueOnce({
      text: JSON.stringify({
        decisao: "abordar",
        motivo: "Dor na triagem",
        gancho: "Triagem da clínica",
        texto:
          "Luciana, você tinha comentado sobre a demora na triagem dos pacientes pelo WhatsApp. Ainda é um gargalo aí na clínica ou já conseguiu organizar?",
        resumo: "Abertura Luciana",
      }),
      usage: { totalTokens: 130 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const tick = await executarTickReciclador({
      campanhaId: campanha.id,
      limite: 1,
      agoraIso: "2026-11-04T17:00:00.000Z",
      sendFn: async () => ({ ok: true, id: "wamid.luciana.1" }),
    });
    expect(tick.enviados).toBe(1);

    // Luciana responde positivamente -> atribui respondeuEm, avancouEtapa=true e Cláudio envia follow-up sem preço
    vi.spyOn(Agent.prototype, "generate").mockResolvedValueOnce({
      text: JSON.stringify({
        bloqueado: false,
        texto: "Que bom te ouvir, Luciana! De 0 a 10, resolver essa triagem ainda este mês é prioridade pra você?",
        resumo: "Cláudio qualificou Luciana",
      }),
      usage: { totalTokens: 90 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const enviosClaudio: string[] = [];
    const handoff = await processarRespostaLeadReciclador({
      phoneDigits: "5562984445555",
      texto: "Ainda é um gargalo sim, continua uma correria!",
      timestamp: "2026-11-04T17:12:00.000Z",
      sendFn: async ({ text }) => {
        enviosClaudio.push(text);
        return { ok: true, id: "wamid.claudio.1" };
      },
    });

    expect(handoff.respostaClaudioEnviada).toBe(true);
    expect(handoff.handoffHumano).toBe(false);
    expect(enviosClaudio[0]).toMatch(/0 a 10/);

    // Roberto manda opt-out pelo webhook do WhatsApp -> bloqueia imediatamente seu item pendente na fila!
    await ingestWhatsAppMessage({
      type: "message.received",
      eventId: "evt_optout_roberto",
      timestamp: "2026-11-04T17:15:00.000Z",
      data: {
        id: "wamid.roberto.opt",
        from: "5562984446666@s.whatsapp.net",
        text: "Por favor pare de mandar mensagens, me tira da lista",
      },
    });

    const det = await obterDetalheCampanha(campanha.id);
    const itemLuciana = det.itens.find((i) => i.nomeContato === "Luciana Melo");
    const itemRoberto = det.itens.find((i) => i.nomeContato === "Roberto Optout");
    expect(itemLuciana?.respondeuEm).toBe("2026-11-04T17:12:00.000Z");
    expect(itemLuciana?.avancouEtapa).toBe(true);
    expect(itemRoberto?.status).toBe("bloqueado");

    const estadoFinal = await listarEstadoReciclador();
    expect(estadoFinal.optOuts.some((o) => o.telefoneDigitos === "5562984446666")).toBe(true);

    // Parada de emergência global congela campanhas ativas
    const emerg = await acionarParadaEmergenciaGlobal("Teste de botão de pânico");
    expect(emerg.pausadas).toBe(1);
    const aposEmerg = await listarEstadoReciclador();
    expect(aposEmerg.emergenciaGlobal).toBe(true);
  });
});
