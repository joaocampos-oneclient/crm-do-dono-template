"use client";
import * as React from "react";
import { Badge, Banner, Button, Card, Fab, Segmented, Shell, Sidebar, TabBar, useToast, type NavItem } from "@/ds";
import { CRMProvider, useCRM, type Tela } from "@/components/crm/provider";
import type { EstadoCRM } from "@/domain/types";
import type { RepositorioCRM } from "@/repo";
import { NAV_DESKTOP, NAV_MOBILE_PRIMARY, telaNoMais } from "@/lib/nav";
import { Demandas } from "./Demandas";
import { Hoje } from "./Hoje";
import { FunilKanban } from "./FunilKanban";
import { Conversas } from "./Conversas";
import { Contatos } from "./Contatos";
import { Playbook } from "./Playbook";
import { Produtos } from "./Produtos";
import { Operadores } from "./Operadores";
import { Templates } from "./Templates";
import { Relatorios } from "./Relatorios";
import { Ocorrencias } from "./Ocorrencias";
import { Integracoes } from "./Integracoes";
import { Agentes } from "./Agentes";
import { ModalLigacao } from "./modais/Ligacao";
import { ModalDiscagem } from "./modais/Discagem";
import { iniciais } from "./partes";
import { WhatsAppOnboarding } from "@/components/crm/WhatsAppOnboarding";

/** Raiz: carrega o estado do repositório, pede o operador e monta o shell. */
export function App({ repo }: { repo: RepositorioCRM }) {
  const [estado, setEstado] = React.useState<EstadoCRM | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);
  const [ligacao, setLigacao] = React.useState<string | null>(null);
  const [discagem, setDiscagem] = React.useState(false);

  React.useEffect(() => { repo.carregar().then(setEstado).catch((e) => setErro(String(e.message ?? e))); }, [repo]);

  if (erro) return <div className="ds-gate"><Card className="ds-gate__card"><h1 style={{ margin: 0 }}>Não consegui carregar o CRM</h1><p>{erro}</p><p className="ds-muted">Se você definiu NEXT_PUBLIC_API_URL, confira se o servidor está no ar (<code>npm run dev</code>).</p></Card></div>;
  if (!estado) return <div className="ds-gate"><span className="ds-label">Carregando…</span></div>;

  return (
    <CRMProvider repo={repo} estadoInicial={estado} aoLigar={setLigacao} aoDiscar={() => setDiscagem(true)}>
      <Interno />
      <ModalLigacao contatoId={ligacao} onClose={() => setLigacao(null)} />
      <ModalDiscagem open={discagem} onClose={() => setDiscagem(false)} aoLigar={(id) => { setDiscagem(false); setLigacao(id); }} />
    </CRMProvider>
  );
}

function Interno() {
  const crm = useCRM();
  if (!crm.operador) return <Entrada />;
  return <Painel />;
}

/** Escolha do operador (demo local). Produção usa /entrar com magic link. */
function Entrada() {
  const { estado, entrar } = useCRM();
  const humanos = estado.operadores.filter((o) => o.tipo === "humano" && o.ativo);
  return (
    <div className="ds-gate ds-gate--login">
      <div className="ds-gate__eyebrow ds-label">CRM · {estado.config.nomeEmpresa}</div>
      <Card className="ds-gate__card ds-gate__card--login">
        <h1 className="ds-gate__title">Quem está entrando?</h1>
        <p className="ds-gate__lead">Modo demo: escolha o operador. Em produção o gate é magic link em <a href="/entrar">/entrar</a>.</p>
        <div className="ds-oplist">
          {humanos.map((o) => (
            <button key={o.id} type="button" className="ds-row" onClick={() => entrar(o.id)}>
              <span className="ds-avatar ds-avatar--ink">{iniciais(o.nome)}</span>
              <span className="ds-row__body"><span className="ds-row__title">{o.nome}</span><span className="ds-row__sub" style={{ display: "block" }}>{o.papel}</span></span>
              <Badge tone="outline">entrar</Badge>
            </button>
          ))}
        </div>
        <p className="ds-muted" style={{ margin: 0, fontSize: 13 }}>Dados de exemplo. Para zerar: Integrações → &quot;Começar do zero&quot;.</p>
      </Card>
      <div style={{ width: "min(420px, 100%)", marginTop: 8 }}>
        <WhatsAppOnboarding compact />
      </div>
    </div>
  );
}

function Painel() {
  const crm = useCRM();
  const { estado, rota, operador, sair, contatos, agora } = crm;
  const toast = useToast();
  const [tema, setTema] = React.useState<"light" | "dark">(document.querySelector(".ds-root")?.getAttribute("data-theme") === "dark" ? "dark" : "light");
  const [maisAberto, setMaisAberto] = React.useState(false);

  const trocarTema = (v: "light" | "dark") => {
    const el = document.querySelector<HTMLElement>(".ds-root");
    if (el) { el.setAttribute("data-theme", v); el.style.colorScheme = v; }
    try { localStorage.setItem("ds-theme", v); } catch { /* sem storage */ }
    setTema(v);
  };

  const handoffs = contatos.filter((c) => c.handoffPendente).length;
  const ocorrencias = estado.ocorrencias.filter((o) => o.status !== "resolvida").length;
  const tarefasVencidas = estado.tarefas.filter((t) => !t.feita && t.venceEm && Date.parse(t.venceEm) < Date.parse(agora)).length;
  const badges: Partial<Record<Tela, number>> = { conversas: handoffs, ocorrencias, hoje: handoffs + tarefasVencidas };

  const items: NavItem[] = NAV_DESKTOP.map((t) => ({
    id: t.id,
    label: t.label,
    href: `#/${t.id}`,
    grupo: t.grupo,
    badge: badges[t.id] ? badges[t.id] : undefined,
  }));

  const mobileActive = telaNoMais(rota.tela) || maisAberto ? "mais" : rota.tela;

  React.useEffect(() => {
    if (crm.repo.origem === "local") return;
    toast.push("Conectado ao servidor local. Leads via webhook aparecem aqui sozinhos.");
  }, [crm.repo.origem, toast]);

  React.useEffect(() => {
    if (!telaNoMais(rota.tela)) setMaisAberto(false);
  }, [rota.tela]);

  const tela = (() => {
    switch (rota.tela) {
      case "demandas": return <Demandas />;
      case "hoje": return <Hoje />;
      case "funil": return <FunilKanban />;
      case "conversas": return <Conversas />;
      case "contatos": return <Contatos />;
      case "playbook": return <Playbook />;
      case "produtos": return <Produtos />;
      case "operadores": return <Operadores />;
      case "templates": return <Templates />;
      case "relatorios": return <Relatorios />;
      case "ocorrencias": return <Ocorrencias />;
      case "integracoes": return <Integracoes />;
      case "agentes": return <Agentes />;
    }
  })();

  const maisItens = NAV_DESKTOP.filter((t) => telaNoMais(t.id));

  return (
    <Shell
      sidebar={
        <Sidebar
          items={items}
          activeId={rota.tela}
          brand={
            <div>
              <div className="ds-label">{estado.config.nomeEmpresa}</div>
              <strong>CRM do dono</strong>
            </div>
          }
          footer={
            <>
              <div className="ds-wrap" style={{ justifyContent: "space-between" }}>
                <span style={{ fontSize: 13 }}>
                  <span className="ds-avatar ds-avatar--ink" style={{ marginRight: 6 }}>{iniciais(operador!.nome)}</span>
                  {operador!.nome}
                </span>
                <Button size="sm" variant="ghost" onClick={sair}>Sair</Button>
              </div>
              <Segmented
                name="tema"
                label="Tema"
                value={tema}
                onChange={trocarTema}
                options={[
                  { value: "light", label: "Claro" },
                  { value: "dark", label: "Escuro" },
                ]}
              />
              <Badge tone="dashed">{crm.repo.origem === "local" ? "dados no navegador" : "servidor local"}</Badge>
            </>
          }
        />
      }
    >
      {crm.repo.origem === "local" && rota.tela === "hoje" && (
        <Banner>
          Este CRM está rodando só no seu navegador, com dados de exemplo. Para receber leads de verdade por webhook e conectar o Grokbot, veja{" "}
          <a href="#/integracoes">Integrações</a>.
        </Banner>
      )}
      {tela}

      {/* Mobile 2: sheet "Mais" */}
      {maisAberto && (
        <div className="ds-mais" role="dialog" aria-label="Mais telas">
          <div className="ds-mais__scrim" onClick={() => setMaisAberto(false)} />
          <div className="ds-mais__sheet">
            <div className="ds-mais__head">
              <strong>Mais</strong>
              <Button size="sm" variant="ghost" onClick={() => setMaisAberto(false)}>Fechar</Button>
            </div>
            <div className="ds-mais__list">
              {maisItens.map((t) => (
                <a
                  key={t.id}
                  href={`#/${t.id}`}
                  className="ds-mais__item"
                  aria-current={rota.tela === t.id ? "page" : undefined}
                  onClick={() => setMaisAberto(false)}
                >
                  <span className="ds-mais__item-main">
                    <strong>{t.label}</strong>
                    <span className="ds-label">{t.grupo}</span>
                  </span>
                </a>
              ))}
              <button type="button" className="ds-mais__item" onClick={() => { sair(); setMaisAberto(false); }}>
                <span className="ds-mais__item-main">
                  <strong>Sair</strong>
                  <span className="ds-label">{operador!.nome}</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile 2: Hoje · Funil · Conversas · Leads · Mais (vidro na barra) */}
      <div className="ds-mobile-nav">
        <TabBar
          activeId={mobileActive}
          items={NAV_MOBILE_PRIMARY.map((t) => ({
            id: t.id,
            label: t.label,
            href: t.id === "mais" ? "#mais" : `#/${t.id}`,
          }))}
          renderLink={({ href, className, "aria-current": cur, children }) => {
            if (href === "#mais") {
              return (
                <button
                  key="mais"
                  type="button"
                  className={className}
                  aria-current={cur}
                  onClick={() => setMaisAberto((v) => !v)}
                >
                  {children}
                </button>
              );
            }
            return (
              <a
                key={href}
                href={href}
                className={className}
                aria-current={cur}
                onClick={() => setMaisAberto(false)}
              >
                {children}
              </a>
            );
          }}
        />
      </div>

      <Fab label="Discagem rápida: ligar para um número" onClick={crm.discar} title="Discagem rápida" />
    </Shell>
  );
}
