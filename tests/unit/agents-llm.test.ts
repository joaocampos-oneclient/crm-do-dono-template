import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { executarAgente } from "@/lib/agents";
import { __setLlmGeneratorForTests } from "@/lib/agents/llm";
import {
  limparFollowupsScribe,
  minutosDeSilencio,
  normalizarHistorico,
  numerosInventados,
  textoDeCobranca,
  valorOuNaoInformado,
} from "@/domain/agentes-guardrails";

/** Faz o "modelo" responder exatamente `texto` (sem chave, sem rede). */
function modeloResponde(texto: string, tokens = 7) {
  __setLlmGeneratorForTests(async () => ({ text: texto, tokens }));
}

beforeEach(() => __setLlmGeneratorForTests(null));
afterEach(() => __setLlmGeneratorForTests(null));

describe("Cláudio com LLM", () => {
  it("caminho feliz usa o texto do modelo", async () => {
    modeloResponde('{"bloqueado":false,"texto":"Oi, Ana! De 0 a 10, o quanto isso é prioridade agora?","resumo":"ok"}');
    const r = await executarAgente("claudio", { contexto: { rascunho: "Oi!" } });
    expect(r.usadoLlm).toBe(true);
    expect(r.custoTokens).toBe(7);
    expect(r.saida.payload.texto).toMatch(/De 0 a 10/);
    expect(r.saida.payload.bloqueado).toBeUndefined();
  });

  it("saída inválida cai nas regras com llmInvalido", async () => {
    modeloResponde('{"bloqueado":false}');
    const r = await executarAgente("claudio", { contexto: { rascunho: "Oi, tudo bem?" } });
    expect(r.usadoLlm).toBe(false);
    expect(r.saida.payload.llmInvalido).toBe(true);
    expect(r.saida.payload.texto).toBe("Oi, tudo bem?");
    expect(r.custoTokens).toBe(7);
  });

  it("texto sem JSON também é inválido (nunca explode)", async () => {
    modeloResponde("claro, aqui está a mensagem");
    const r = await executarAgente("claudio", { contexto: { rascunho: "Oi" } });
    expect(r.saida.payload.llmInvalido).toBe(true);
  });

  it("bloqueia preço vindo do modelo", async () => {
    modeloResponde('{"bloqueado":false,"texto":"Fecha hoje por R$ 297 em 3x"}');
    const r = await executarAgente("claudio", { contexto: { rascunho: "Oi!" } });
    expect(r.saida.payload.bloqueado).toBe(true);
    expect(r.saida.payload.motivo).toBe("preco");
    expect(r.saida.requerAprovacao).toBe(true);
  });

  it("bloqueia oferta comercial disfarçada", async () => {
    modeloResponde('{"bloqueado":false,"texto":"Tenho uma condição especial de pagamento pra você"}');
    const r = await executarAgente("claudio", { contexto: { rascunho: "Oi!" } });
    expect(r.saida.payload.bloqueado).toBe(true);
  });

  it("não chama o modelo quando o contato pediu para parar", async () => {
    let chamou = false;
    __setLlmGeneratorForTests(async () => {
      chamou = true;
      return { text: '{"bloqueado":false,"texto":"oi"}', tokens: 1 };
    });
    const r = await executarAgente("claudio", {
      contexto: { rascunho: "Oi!", ultimaMensagemContato: "Por favor não me mande mais mensagens" },
    });
    expect(chamou).toBe(false);
    expect(r.saida.payload.motivo).toBe("opt_out");
  });
});

describe("Scout com LLM", () => {
  const ok = '{"rotulo":"interessado","confianca":0.8,"acao":"nutrir","porque":"Perguntou sobre o diagnóstico","proximoPasso":"Enviar um exemplo"}';

  it("caminho feliz", async () => {
    modeloResponde(ok);
    const r = await executarAgente("scout", { contexto: { textoConversas: "quero entender", nota: 5 } });
    expect(r.usadoLlm).toBe(true);
    expect(r.saida.payload.acao).toBe("nutrir");
    expect(r.saida.payload.proximoPasso).toBe("Enviar um exemplo");
  });

  it("saída inválida (ação desconhecida) cai nas regras", async () => {
    modeloResponde('{"rotulo":"x","confianca":0.8,"acao":"vender","porque":"y"}');
    const r = await executarAgente("scout", { contexto: { textoConversas: "oi", minutosSilencio: 5 } });
    expect(r.usadoLlm).toBe(false);
    expect(r.saida.payload.llmInvalido).toBe(true);
    expect(r.saida.payload.acao).toBe("aguardar");
  });

  it("regra dura vence o modelo: pediu humano → handoff", async () => {
    modeloResponde(ok);
    const r = await executarAgente("scout", {
      contexto: {
        mensagens: [{ autor: "contato", texto: "Quero falar com um atendente", em: "2026-11-04T10:00:00Z" }],
      },
    });
    expect(r.saida.payload.acao).toBe("handoff");
    expect(r.saida.payload.acaoCorrigida).toBe(true);
    expect(r.saida.payload.proximoPasso).toMatch(/humano/i);
  });

  it("opt-out vence tudo: ignorar", async () => {
    modeloResponde('{"rotulo":"quente","confianca":0.9,"acao":"retomar","porque":"x"}');
    const r = await executarAgente("scout", {
      contexto: { mensagens: [{ autor: "contato", texto: "pare de me mandar mensagem", em: "2026-11-04T10:00:00Z" }] },
    });
    expect(r.saida.payload.acao).toBe("ignorar");
  });

  it("calcula minutosSilencio pelo histórico e agora", async () => {
    const r = await executarAgente("scout", {
      contexto: {
        agora: "2026-11-05T12:00:00Z",
        mensagens: [{ autor: "robo", texto: "Oi!", em: "2026-11-04T06:00:00Z" }],
      },
    });
    expect(r.saida.payload.minutosSilencio).toBe(30 * 60);
    expect(r.saida.payload.acao).toBe("retomar");
    expect(String(r.saida.payload.proximoPasso)).toMatch(/follow-up/i);
  });
});

describe("Scribe com LLM", () => {
  const notas = "Falamos do estoque. Marcar retorno quinta. Enviar proposta revisada.";

  it("caminho feliz limita a 5 follow-ups", async () => {
    modeloResponde(
      JSON.stringify({
        resumo: "Conversa sobre estoque.",
        followups: ["Marcar retorno quinta", "Enviar proposta revisada", "a", "b", "c", "d", "e"],
      }),
    );
    const r = await executarAgente("scribe", { contexto: { notasReuniao: notas } });
    expect(r.usadoLlm).toBe(true);
    expect((r.saida.payload.followups as string[]).length).toBe(5);
  });

  it("descarta follow-up com valor que não está nas notas", async () => {
    modeloResponde('{"resumo":"Ok.","followups":["Cobrar R$ 500 até sexta","Marcar retorno quinta"]}');
    const r = await executarAgente("scribe", { contexto: { notasReuniao: notas } });
    expect(r.saida.payload.followups).toEqual(["Marcar retorno quinta"]);
  });

  it("saída inválida cai nas regras e só usa linhas de tarefa das notas", async () => {
    modeloResponde("não sei");
    const r = await executarAgente("scribe", { contexto: { notasReuniao: "Falamos de estoque.\n- Enviar proposta revisada" } });
    expect(r.usadoLlm).toBe(false);
    expect(r.saida.payload.llmInvalido).toBe(true);
    expect(r.saida.payload.followups).toEqual(["Enviar proposta revisada"]);
  });

  it("sem notas não inventa nada e nem chama o modelo", async () => {
    let chamou = false;
    __setLlmGeneratorForTests(async () => {
      chamou = true;
      return { text: "{}", tokens: 1 };
    });
    const r = await executarAgente("scribe", { contexto: {} });
    expect(chamou).toBe(false);
    expect(r.saida.payload.followups).toEqual([]);
  });
});

describe("Ledger com LLM", () => {
  it("caminho feliz mantém nuncaCobra e requer aprovação", async () => {
    modeloResponde('{"risco":true,"resumo":"Poucos logins.","acaoSugerida":"Enviar o link de login."}');
    const r = await executarAgente("ledger", { contexto: { logins7d: 1, diasDesdePagamento: 2 } });
    expect(r.usadoLlm).toBe(true);
    expect(r.saida.requerAprovacao).toBe(true);
    expect(r.saida.payload.nuncaCobra).toBe(true);
    expect(r.saida.payload.nuncaAutomatico).toBe(true);
  });

  it("saída inválida cai nas regras", async () => {
    modeloResponde('{"risco":"talvez"}');
    const r = await executarAgente("ledger", { contexto: { logins7d: 0, diasDesdePagamento: 1 } });
    expect(r.usadoLlm).toBe(false);
    expect(r.saida.payload.llmInvalido).toBe(true);
    expect(r.saida.payload.risco).toBe(true);
  });

  it.each([
    "Lembrar o cliente do pagamento",
    "Enviar o boleto de novo",
    "Cobrar a mensalidade atrasada",
    "Avisar que a fatura venceu",
  ])("bloqueia texto de cobrança: %s", async (acao) => {
    modeloResponde(JSON.stringify({ risco: true, resumo: "Risco.", acaoSugerida: acao }));
    const r = await executarAgente("ledger", { contexto: { logins7d: 0, diasDesdePagamento: 1 } });
    expect(r.saida.payload.bloqueado).toBe(true);
    expect(r.saida.payload.motivo).toBe("cobranca");
    expect(r.saida.requerAprovacao).toBe(true);
    expect(textoDeCobranca(String(r.saida.acaoSugerida))).toBe(false);
  });

  it("textos padrão do Ledger nunca parecem cobrança", async () => {
    const r = await executarAgente("ledger", { contexto: { logins7d: 0, diasDesdePagamento: 1 } });
    expect(textoDeCobranca(`${r.saida.resumo} ${r.saida.acaoSugerida}`)).toBe(false);
  });
});

describe("Pilot com LLM", () => {
  const base = { horasDesdeUltimaAutomatica: 100, diasParado: 3, textoFollowup: "Ficou pendente aquele ajuste." };

  it("caminho feliz exige aprovação", async () => {
    modeloResponde('{"texto":"Ana, ficou pendente o ajuste do estoque. Quer um exemplo?"}');
    const r = await executarAgente("pilot", { contexto: base });
    expect(r.usadoLlm).toBe(true);
    expect(r.saida.requerAprovacao).toBe(true);
    expect(r.saida.payload.texto).toMatch(/estoque/);
  });

  it("saída inválida cai nas regras", async () => {
    modeloResponde('{"texto":""}');
    const r = await executarAgente("pilot", { contexto: base });
    expect(r.usadoLlm).toBe(false);
    expect(r.saida.payload.llmInvalido).toBe(true);
    expect(r.saida.payload.texto).toBe(base.textoFollowup);
  });

  it("bloqueia preço vindo do modelo", async () => {
    modeloResponde('{"texto":"Hoje tem desconto de 20% pra você"}');
    const r = await executarAgente("pilot", { contexto: base });
    expect(r.saida.payload.bloqueado).toBe(true);
    expect(r.saida.payload.motivo).toBe("preco");
  });

  it("opt-out do contato: não chama o modelo e não envia", async () => {
    let chamou = false;
    __setLlmGeneratorForTests(async () => {
      chamou = true;
      return { text: '{"texto":"oi"}', tokens: 1 };
    });
    const r = await executarAgente("pilot", {
      contexto: { ...base, ultimaMensagemContato: "Parar. Não quero mais contato." },
    });
    expect(chamou).toBe(false);
    expect(r.saida.payload.motivo).toBe("opt_out");
    expect(r.saida.payload.bloqueado).toBe(true);
  });

  it("recusa recente bloqueia", async () => {
    const r = await executarAgente("pilot", {
      contexto: { ...base, ultimaMensagemContato: "Não tenho interesse, obrigado" },
    });
    expect(r.saida.payload.motivo).toBe("recusa_recente");
  });

  it("teto de 14 dias pausa", async () => {
    const r = await executarAgente("pilot", { contexto: { ...base, diasParado: 14 } });
    expect(r.saida.payload.pausado).toBe(true);
  });

  it("cooldown de 48h", async () => {
    const r = await executarAgente("pilot", { contexto: { ...base, horasDesdeUltimaAutomatica: 47 } });
    expect(r.saida.payload.cooldown).toBe(true);
  });
});

describe("Eco com LLM", () => {
  const ctx = { nome: "Ana", dor: "estoque", meta: "crescer", nota: 8 };

  it("caminho feliz", async () => {
    modeloResponde('{"briefing":"Ana: dor estoque, meta crescer, nota 8."}');
    const r = await executarAgente("eco", { contexto: ctx });
    expect(r.usadoLlm).toBe(true);
    expect(r.saida.payload.briefing).toMatch(/Ana/);
  });

  it("saída inválida cai no briefing local", async () => {
    modeloResponde('{"resumo":"sem briefing"}');
    const r = await executarAgente("eco", { contexto: ctx });
    expect(r.usadoLlm).toBe(false);
    expect(r.saida.payload.llmInvalido).toBe(true);
    expect(String(r.saida.payload.briefing)).toMatch(/estoque/);
  });

  it("descarta briefing com valor inventado", async () => {
    modeloResponde('{"briefing":"Ana fatura R$ 80.000 por mês e quer crescer 30%."}');
    const r = await executarAgente("eco", { contexto: ctx });
    expect(r.usadoLlm).toBe(false);
    expect(String(r.saida.payload.briefing)).not.toMatch(/80\.000/);
  });

  it("campos ausentes viram 'não informado'", async () => {
    const r = await executarAgente("eco", { contexto: { nome: "Bia" } });
    const b = String(r.saida.payload.briefing);
    expect(b).toMatch(/Dor: não informado/);
    expect(b).toMatch(/Meta: não informado/);
    expect(b).toMatch(/Pergunta Matadora: não informado/);
    expect(b).not.toMatch(/undefined/);
  });
});

describe("guardrails puros", () => {
  it("valorOuNaoInformado", () => {
    expect(valorOuNaoInformado(undefined)).toBe("não informado");
    expect(valorOuNaoInformado("—")).toBe("não informado");
    expect(valorOuNaoInformado(0)).toBe("0");
  });

  it("numerosInventados só pega o que não está na fonte", () => {
    expect(numerosInventados("Pagou R$ 100 em 10/11", "valor R$ 100 e data 10/11")).toEqual([]);
    expect(numerosInventados("Pagou R$ 999", "valor R$ 100")).toEqual(["R$ 999"]);
  });

  it("limparFollowupsScribe tira duplicata e limita", () => {
    expect(limparFollowupsScribe(["A", "a", " ", "B"], "A B")).toEqual(["A", "B"]);
  });

  it("normalizarHistorico ignora lixo e ordena", () => {
    const h = normalizarHistorico([
      { autor: "contato", texto: "b", em: "2026-11-04T10:00:00Z" },
      { autor: "x", texto: "ruim", em: "2026-11-04T09:00:00Z" },
      { autor: "robo", texto: "a", em: "2026-11-04T08:00:00Z" },
      null,
    ]);
    expect(h.map((m) => m.texto)).toEqual(["a", "b"]);
    expect(minutosDeSilencio(h, "2026-11-04T11:00:00Z")).toBe(60);
    expect(minutosDeSilencio([], "2026-11-04T11:00:00Z")).toBeNull();
  });
});
