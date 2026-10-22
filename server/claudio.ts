/**
 * Cláudio com modelo de linguagem (OPCIONAL). Desligado por padrão: sem LLM_API_KEY, vale o Cláudio
 * por regras (src/domain/claudio.ts). Quando ligado, o modelo só REDIGE; as decisões (nota, handoff,
 * trava de preço) continuam nas regras, e a resposta passa por sanitizarFalaDoRobo antes de sair.
 *
 * Funciona com qualquer endpoint compatível com a API de chat da OpenAI (OpenAI, Groq, xAI, OpenRouter, Ollama).
 *   LLM_API_KEY=...   LLM_BASE_URL=https://api.openai.com/v1   LLM_MODEL=gpt-4o-mini
 */
import { claudioResponde, type ContextoClaudio } from "../src/domain/claudio";
import { playbookDe } from "../src/domain/funil";

export interface ConfigLLM { apiKey: string; baseUrl: string; modelo: string }

export function configLLMDoAmbiente(env: NodeJS.ProcessEnv = process.env): ConfigLLM | null {
  if (!env.LLM_API_KEY) return null;
  return { apiKey: env.LLM_API_KEY, baseUrl: (env.LLM_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, ""), modelo: env.LLM_MODEL ?? "gpt-4o-mini" };
}

/**
 * Pede ao modelo uma redação melhor para a decisão que as regras já tomaram.
 * Devolve null em qualquer falha (aí o servidor usa o texto das regras).
 */
export async function redigirComLLM(cfg: ConfigLLM, ctx: ContextoClaudio, textoDoLead: string, fetchFn: typeof fetch = fetch) {
  const decisao = claudioResponde(ctx, textoDoLead);
  if (!decisao.resposta) return null;
  const pb = playbookDe("conversa", ctx.produto);
  const sistema = `Você é ${ctx.nomeEmpresa ? `o Cláudio, assistente de IA da ${ctx.nomeEmpresa}` : "um assistente de IA"}. Fala português do Brasil, curto, humano, sem emojis.
Regras invioláveis:
- NUNCA fale de preço, valor, desconto, parcela, cupom, condição ou link de pagamento. Se perguntarem, diga que uma pessoa do time fala disso e passe adiante.
- Nunca diga que é humano. Nunca invente dados.
- Uma pergunta por mensagem. Máximo 3 frases.
Playbook da etapa: pergunta principal "${pb?.pergunta ?? ""}". Objeções: ${pb?.objecoes.map((o) => `"${o.objecao}" -> diga "${o.diga}", nunca "${o.nuncaDiga}"`).join("; ") ?? ""}.
A decisão desta rodada já foi tomada pelas regras: ação = ${decisao.acao}; motivo = ${decisao.motivo}. Reescreva a mensagem abaixo mantendo exatamente essa intenção.`;
  const historico = ctx.mensagens.slice(-10).map((m) => ({ role: m.autor === "contato" ? "user" : "assistant", content: m.texto }));
  try {
    const r = await fetchFn(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({
        model: cfg.modelo,
        temperature: 0.4,
        messages: [{ role: "system", content: sistema }, ...historico, { role: "user", content: textoDoLead }, { role: "system", content: `Mensagem base para reescrever: "${decisao.resposta}"` }],
      }),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { choices?: { message?: { content?: string } }[] };
    const texto = j.choices?.[0]?.message?.content?.trim();
    if (!texto) return null;
    return { texto, nota: decisao.nota, acao: decisao.acao === "silencio" ? "perguntar" as const : decisao.acao };
  } catch {
    return null;
  }
}
