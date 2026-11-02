// @ts-nocheck
import type { ReactNode } from "react";
import { CrmLink as Link } from "./hash-nav";
import { AcoesOportunidade } from "./_componentes/acoes-oportunidade";
import { EmailContato } from "./_componentes/email-contato";
import { LigarContato } from "./_componentes/ligar-contato";
import { MarcarCliente } from "./_componentes/marcar-cliente";
import { MembroPublicoToggle } from "./_componentes/membro-publico";
import { NovaNota, NovaTarefa, TarefaItem } from "./_componentes/notas-tarefas";
import { PropostaOferta } from "./_componentes/proposta-oferta";
import { formatarReais, valorComDesconto } from "@/lib/crm/domain";
import { dataHora, iniciais, nomeEmExibicao } from "@/lib/crm/format";
import { mascararEmailCrm, mascararWhatsappCrm } from "@/lib/crm/pii";
import { rotuloAutor, rotuloFichaCabecalho, rotuloMotivo, rotuloOrigem } from "@/lib/crm/rotulos";
import type { FichaContato } from "@/lib/crm/queries";
import type { TipoContato } from "@/lib/crm/tipo-contato";
import { indiceEtapa } from "@/lib/crm/etapas-chip";
import { SITE_URL } from "@/lib/seo";
import { AgentBadge, Avatar, NewFieldMark, StageChip, Thermometer, TimelineItem, type Thermo } from "./crm-ui";
import { FichaAbas } from "./ficha-abas";
import { CrmV3Page } from "./frame";

const NEGOCIO = [
  "Negócio",
  "Nicho",
  "Descrição",
  "Cidade / UF",
  "Funcionários",
  "Faturamento",
  "Instagram / site",
  "Usa hoje",
  "Quem decide",
  "Objeção principal",
] as const;

function termo(v: string): Thermo | undefined {
  if (v === "frio" || v === "morno" || v === "quente") return v;
  return undefined;
}

function motivosVisiveis(slug: string, motivos: string[]): string[] {
  if (slug === "pago" || slug === "dentro") return motivos.filter((m) => m !== "nao_engajou");
  return motivos;
}

function Card({ children }: { children: ReactNode }) {
  return (
    <section style={{ background: "var(--surface)", borderRadius: "var(--r-card)", padding: 14, display: "grid", gap: 10 }}>
      {children}
    </section>
  );
}

export function FichaV3({
  ficha,
  tipo,
  whatsappReal,
  emailReal,
  aberta,
  proxima,
  propostaOferta,
  emails,
  linkProposta,
  remetenteConfigurado,
  assinatura,
  ligacaoLigada,
  ligacaoIdInicial,
  membroPublico,
  jevProva,
  jevLead,
  insistencia,
}: {
  ficha: FichaContato;
  tipo: TipoContato;
  whatsappReal: string;
  emailReal: string;
  aberta: FichaContato["oportunidades"][number] | undefined;
  proxima: { slug: "claudio" | "handoff" | "briefing"; nome: string } | null;
  propostaOferta: Awaited<ReturnType<typeof import("@/lib/crm/propostas").getPropostaOfertaDaOportunidade>> | null;
  emails: Awaited<ReturnType<typeof import("@/lib/crm/email").listarEmailsDoContato>>;
  linkProposta: string | null;
  remetenteConfigurado: boolean;
  assinatura: string;
  ligacaoLigada: boolean;
  ligacaoIdInicial?: string;
  membroPublico: { id: string; membro_publico: boolean } | null;
  jevProva: string | null;
  jevLead: string;
  insistencia: {
    placar: string;
    criterioSaida: string;
    segmentoReengajamento: boolean;
    podeTocar: boolean;
  } | null;
}) {
  const c = ficha.contato;
  const id = c.id;
  const nome = nomeEmExibicao(c.nome);
  const tarefasAbertas = ficha.tarefas.filter((t) => !t.concluida_em);
  const nota = typeof c.nota_claudio === "number" ? c.nota_claudio : null;
  const ultima = ficha.oportunidades[0];
  const perdida = (!aberta && ultima?.status === "perdida") || aberta?.status === "perdida";
  const stage = indiceEtapa(aberta?.etapa?.slug ?? ultima?.etapa?.slug);
  const listaVolta = tipo === "cliente" ? "/clientes" : "/leads";

  const resumo = (
    <div style={{ display: "grid", gap: 12 }}>
      {aberta ? (
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <h2 style={{ margin: 0, font: "520 18px var(--font-sans)" }}>{aberta.etapa.nome}</h2>
            <span className="crm-num">{formatarReais(valorComDesconto(Number(aberta.valor_centavos), Number(aberta.desconto_pct ?? 0)))}</span>
          </div>
          <p style={{ margin: 0, font: "400 12px var(--font-sans)", color: "var(--fg-2)" }}>
            Nesta etapa desde {dataHora(aberta.etapa_desde)}
            {aberta.origem_criacao === "manual" ? " · criada à mão" : ""}
          </p>
          {insistencia?.criterioSaida ? (
            <p style={{ margin: 0, font: "400 13px var(--font-sans)", color: "var(--fg-2)" }}>
              Para avançar: {insistencia.criterioSaida}
            </p>
          ) : null}
          {insistencia ? (
            <p style={{ margin: 0, font: "500 13px var(--font-sans)" }}>
              Toques {insistencia.placar}
              {insistencia.podeTocar ? "" : " · teto da semana"}
            </p>
          ) : null}
          {insistencia?.segmentoReengajamento ? (
            <p style={{ margin: 0, font: "400 12px var(--font-sans)", color: "var(--fg-2)" }}>
              Segmento reengajamento
            </p>
          ) : null}
          <AcoesOportunidade
            oportunidadeId={aberta.id}
            proxima={proxima}
            motivosPerda={motivosVisiveis(aberta.etapa.slug, aberta.etapa.motivos_perda)}
            briefing={{
              dor: String(aberta.dor ?? ""),
              meta: String(aberta.meta ?? ""),
              meta_ate: String(aberta.meta_ate ?? ""),
              usa: String(aberta.usa ?? ""),
              decide: String(aberta.decide ?? ""),
              proxima_acao: String(aberta.proxima_acao ?? ""),
              nota_prioridade: typeof aberta.nota_prioridade === "number" ? aberta.nota_prioridade : null,
              nota_satisfacao: typeof aberta.nota_satisfacao === "number" ? aberta.nota_satisfacao : null,
              nota_urgencia: typeof aberta.nota_urgencia === "number" ? aberta.nota_urgencia : null,
              nota_decide: typeof aberta.nota_decide === "number" ? aberta.nota_decide : null,
              nota_claudio: nota,
            }}
          />
        </Card>
      ) : (
        <div style={{ background: "var(--surface)", borderRadius: "var(--r-card)", padding: 16 }}>
          <p style={{ margin: 0, font: "500 16px var(--font-sans)" }}>Sem oportunidade aberta</p>
          <p style={{ margin: "8px 0 0", font: "400 13px var(--font-sans)", color: "var(--fg-2)" }}>
            {ultima?.status === "perdida"
              ? `Última oportunidade perdida (${rotuloMotivo(String(ultima.motivo_perda ?? ""))}).`
              : "Use o botão + para abrir uma nova."}
            {insistencia?.segmentoReengajamento ? " · Segmento reengajamento" : ""}
          </p>
        </div>
      )}
    </div>
  );

  const contato = (
    <Card>
      <h2 style={{ margin: 0, font: "520 18px var(--font-sans)" }}>Contato</h2>
      <p style={{ margin: 0, font: "400 13px var(--font-sans)", color: "var(--fg-2)" }}>
        WhatsApp {whatsappReal ? mascararWhatsappCrm(whatsappReal) : "—"} · E-mail {emailReal ? mascararEmailCrm(emailReal) : "—"}
      </p>
      <p style={{ margin: 0, font: "400 12px var(--font-sans)", color: "var(--fg-3)" }}>
        Contato completo só na <Link href="/buscar" style={{ color: "var(--fg)", fontWeight: 600 }}>busca por nome</Link>.
      </p>
      <p style={{ margin: 0, font: "400 13px var(--font-sans)" }}>
        Origem {c.origem ? rotuloOrigem(String(c.origem)) : "—"}
      </p>
      {ligacaoLigada && (
        <LigarContato
          contatoId={id}
          destino={whatsappReal || null}
          oportunidadeId={aberta?.id}
          ligacaoIdInicial={ligacaoIdInicial}
        />
      )}
      {tipo === "lead" ? (
        <MarcarCliente contatoId={id} />
      ) : (
        <p style={{ margin: 0, font: "400 12px var(--font-sans)", color: "var(--fg-2)" }}>
          Já está marcado como cliente. Não aparece no funil.
        </p>
      )}
      {membroPublico && <MembroPublicoToggle memberId={membroPublico.id} inicial={membroPublico.membro_publico} />}
    </Card>
  );

  const qualificacao = (
    <div style={{ display: "grid", gap: 12 }}>
      <Card>
        <h2 style={{ margin: 0, font: "520 18px var(--font-sans)" }}>Nota que o lead se deu</h2>
        <p style={{ margin: 0, font: "400 13px var(--font-sans)", color: "var(--fg-2)" }}>
          De 0 a 10, o que a pessoa respondeu na pergunta-chave.
        </p>
        <p className="crm-num" style={{ margin: 0, font: "500 28px var(--font-mono)" }}>
          {nota == null ? "—" : nota}
        </p>
        <p style={{ margin: 0, font: "400 12px var(--font-sans)", color: "var(--fg-3)" }}>
          Prova {jevProva ?? "Não informado"}
        </p>
      </Card>
      <Card>
        <h2 style={{ margin: 0, font: "520 18px var(--font-sans)" }}>Classificação do lead</h2>
        <p style={{ margin: 0, font: "400 13px var(--font-sans)", color: "var(--fg-2)" }}>
          {jevLead}
        </p>
        <p style={{ margin: 0, font: "400 12px var(--font-sans)", color: "var(--fg-3)" }}>
          A classificação automática ainda não está configurada. Esta tela só mostra o texto; não muda a etapa, não marca perda e não fala de preço.
        </p>
      </Card>
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ font: "400 13px var(--font-sans)" }}>Interesse</span>
          <Thermometer value={termo(String(c.termometro ?? ""))} />
        </div>
      </Card>
    </div>
  );

  const negocio = (
    <div style={{ display: "grid", gap: 12 }}>
      <Card>
        <h2 style={{ margin: 0, font: "520 18px var(--font-sans)" }}>Negócio</h2>
        {NEGOCIO.map((campo) => (
          <div key={campo} style={{ display: "flex", alignItems: "center", gap: 8, font: "400 13px var(--font-sans)" }}>
            <span style={{ minWidth: 140 }}>{campo}</span>
            <NewFieldMark />
            <span style={{ color: "var(--fg-3)" }}>Não informado</span>
          </div>
        ))}
      </Card>
      {aberta && propostaOferta && !propostaOferta.indisponivel && (
        <Card>
          <h2 style={{ margin: 0, font: "520 18px var(--font-sans)" }}>Proposta e oferta</h2>
          <PropostaOferta
            oportunidadeId={aberta.id}
            ordemEtapa={aberta.etapa.ordem}
            valorCentavos={Number(aberta.valor_centavos)}
            siteUrl={SITE_URL}
            proposta={propostaOferta.proposta}
            oferta={propostaOferta.oferta}
          />
        </Card>
      )}
    </div>
  );

  const historico = (
    <div style={{ display: "grid", gap: 12 }}>
      <Card>
        <h2 style={{ margin: 0, font: "520 18px var(--font-sans)" }}>E-mail</h2>
        <EmailContato
          contatoId={id}
          oportunidadeId={aberta?.id ?? null}
          nome={nome}
          email={emailReal}
          assinatura={assinatura}
          linkProposta={linkProposta}
          remetenteConfigurado={remetenteConfigurado}
          emails={emails}
        />
      </Card>
      <Card>
        <h2 style={{ margin: 0, font: "520 18px var(--font-sans)" }}>Linha do tempo</h2>
        {ficha.linhaDoTempo.length === 0 ? (
          <p style={{ margin: 0, font: "400 13px var(--font-sans)", color: "var(--fg-2)" }}>Nada registrado ainda. O chat vazio não quebra.</p>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {ficha.linhaDoTempo.map((t, i) => (
              <TimelineItem
                key={`${t.em}-${i}`}
                who={t.tipo}
                author={rotuloAutor(t.tipo)}
                action={
                  t.texto.startsWith("Perdida: ")
                    ? `Perdida: ${rotuloMotivo(t.texto.slice("Perdida: ".length))}`
                    : t.texto
                }
                time={dataHora(t.em)}
                tag={t.tipo}
              />
            ))}
          </ul>
        )}
      </Card>
      <Card>
        <h2 style={{ margin: 0, font: "520 18px var(--font-sans)" }}>Tarefas</h2>
        {tarefasAbertas.length === 0 && <p style={{ margin: 0, font: "400 13px var(--font-sans)", color: "var(--fg-2)" }}>Sem tarefa aberta.</p>}
        {tarefasAbertas.map((t) => (
          <TarefaItem key={t.id} id={t.id} titulo={t.titulo} vence={t.vence_em ? dataHora(t.vence_em) : null} />
        ))}
        <NovaTarefa contatoId={id} oportunidadeId={aberta?.id} />
      </Card>
      <Card>
        <h2 style={{ margin: 0, font: "520 18px var(--font-sans)" }}>Notas</h2>
        {ficha.notas.map((n) => (
          <div key={n.id}>
            <p style={{ margin: 0, whiteSpace: "pre-wrap", font: "400 14px var(--font-sans)" }}>{n.texto}</p>
            <p className="crm-label" style={{ margin: "4px 0 0" }}>
              {n.operador?.nome ?? "Sistema"} · {dataHora(n.created_at)}
            </p>
          </div>
        ))}
        <NovaNota contatoId={id} oportunidadeId={aberta?.id} />
      </Card>
    </div>
  );

  return (
    <CrmV3Page>
      <header style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <Avatar initials={iniciais(c.nome)} size={44} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1 style={{ margin: 0, font: "520 24px/1.15 var(--font-sans)" }}>{nome}</h1>
          <p style={{ margin: 0, font: "400 13px var(--font-sans)", color: "var(--fg-2)" }}>
            {[String(c.empresa ?? ""), String(c.segmento ?? "")].filter(Boolean).join(" · ") || "Sem empresa informada"}
          </p>
        </div>
        <StageChip stage={stage} lost={perdida} />
        <AgentBadge owner={c.dono === "otavio" ? "otavio" : "claudio"} />
      </header>

      <p className="crm-label" style={{ margin: 0 }}>
        {rotuloFichaCabecalho({
          etapaNome: aberta?.etapa?.nome ?? ultima?.etapa?.nome,
          status: aberta?.status ?? ultima?.status,
        })}
      </p>

      <FichaAbas
        abas={[
          { id: "resumo", label: "Resumo", painel: resumo },
          { id: "contato", label: "Contato", painel: contato },
          { id: "qualificacao", label: "Qualificação", painel: qualificacao },
          { id: "negocio", label: "Negócio", painel: negocio },
          { id: "historico", label: "Histórico", painel: historico },
        ]}
      />

      <Link href={listaVolta} style={{ color: "var(--fg)", font: "500 14px var(--font-sans)" }}>
        {tipo === "cliente" ? "Voltar aos clientes" : "Voltar aos leads"}
      </Link>
    </CrmV3Page>
  );
}
