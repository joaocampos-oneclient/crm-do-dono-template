import * as React from "react";
import { Badge, Banner, Button, Card, Fab, Segmented, Shell, Sidebar, useToast, type NavItem } from "../ds";
import { CRMProvider, useCRM, type Tela } from "../app/crm";
import type { EstadoCRM } from "../domain/types";
import type { RepositorioCRM } from "../repo";
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
import { ModalLigacao } from "./modais/Ligacao";
import { ModalDiscagem } from "./modais/Discagem";
import { iniciais } from "./partes";

/** Raiz: carrega o estado do repositório, pede o operador e monta o shell. */
export function App({ repo }: { repo: RepositorioCRM }) {
  const [estado, setEstado] = React.useState<EstadoCRM | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);
  const [ligacao, setLigacao] = React.useState<string | null>(null);
  const [discagem, setDiscagem] = React.useState(false);

  React.useEffect(() => { repo.carregar().then(setEstado).catch((e) => setErro(String(e.message ?? e))); }, [repo]);

  if (erro) return <div className="ds-gate"><Card className="ds-gate__card"><h1 style={{ margin: 0 }}>Não consegui carregar o CRM</h1><p>{erro}</p><p className="ds-muted">Se você definiu VITE_API_URL, confira se o servidor está no ar (<code>npm run dev:server</code>).</p></Card></div>;
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

/** Escolha do operador. É um "login" local, sem senha: serve para registrar quem fez o quê. Auth de verdade: docs/banco-de-dados.md. */
function Entrada() {
  const { estado, entrar } = useCRM();
  const humanos = estado.operadores.filter((o) => o.tipo === "humano" && o.ativo);
  return (
    <div className="ds-gate">
      <Card className="ds-gate__card">
        <div className="ds-label">{estado.config.nomeEmpresa} · CRM do dono</div>
        <h1 style={{ margin: 0, fontSize: 26, letterSpacing: "-0.02em" }}>Quem está entrando?</h1>
        <p className="ds-muted" style={{ margin: 0 }}>Tudo que você fizer fica registrado no seu nome: mensagens, ligações, notas e movimentos do funil.</p>
        <div className="ds-oplist">
          {humanos.map((o) => (
            <button key={o.id} type="button" className="ds-row" onClick={() => entrar(o.id)}>
              <span className="ds-avatar ds-avatar--ink">{iniciais(o.nome)}</span>
              <span className="ds-row__body"><span className="ds-row__title">{o.nome}</span><span className="ds-row__sub" style={{ display: "block" }}>{o.papel}</span></span>
              <Badge tone="outline">entrar</Badge>
            </button>
          ))}
        </div>
        <p className="ds-muted" style={{ margin: 0, fontSize: 13 }}>Dados de exemplo. Para zerar e começar do seu jeito: Integrações → "Começar do zero".</p>
      </Card>
    </div>
  );
}

const TELAS: { id: Tela; label: string; grupo: string }[] = [
  { id: "demandas", label: "Demandas", grupo: "Operação" },
  { id: "hoje", label: "Hoje", grupo: "Operação" },
  { id: "funil", label: "Funil", grupo: "Operação" },
  { id: "conversas", label: "Conversas", grupo: "Operação" },
  { id: "contatos", label: "Contatos", grupo: "Operação" },
  { id: "relatorios", label: "Relatórios", grupo: "Gestão" },
  { id: "ocorrencias", label: "Ocorrências", grupo: "Gestão" },
  { id: "playbook", label: "Playbook", grupo: "Configuração" },
  { id: "produtos", label: "Produtos e funis", grupo: "Configuração" },
  { id: "operadores", label: "Operadores e chaves", grupo: "Configuração" },
  { id: "templates", label: "Templates", grupo: "Configuração" },
  { id: "integracoes", label: "Integrações", grupo: "Configuração" },
];

function Painel() {
  const crm = useCRM();
  const { estado, rota, operador, sair, contatos, agora } = crm;
  const toast = useToast();
  const [tema, setTema] = React.useState<"light" | "dark">(document.querySelector(".ds-root")?.getAttribute("data-theme") === "dark" ? "dark" : "light");
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
  const items: NavItem[] = TELAS.map((t) => ({ id: t.id, label: t.label, href: `#/${t.id}`, grupo: t.grupo, badge: badges[t.id] ? badges[t.id] : undefined }));

  React.useEffect(() => {
    if (crm.repo.origem === "local") return;
    toast.push("Conectado ao servidor local. Leads via webhook aparecem aqui sozinhos.");
  }, [crm.repo.origem, toast]);

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
    }
  })();

  return (
    <Shell
      sidebar={
        <Sidebar
          items={items}
          activeId={rota.tela}
          brand={<div><div className="ds-label">{estado.config.nomeEmpresa}</div><strong>CRM do dono</strong></div>}
          footer={
            <>
              <div className="ds-wrap" style={{ justifyContent: "space-between" }}>
                <span style={{ fontSize: 13 }}><span className="ds-avatar ds-avatar--ink" style={{ marginRight: 6 }}>{iniciais(operador!.nome)}</span>{operador!.nome}</span>
                <Button size="sm" variant="ghost" onClick={sair}>Sair</Button>
              </div>
              <Segmented name="tema" label="Tema" value={tema} onChange={trocarTema} options={[{ value: "light", label: "Claro" }, { value: "dark", label: "Escuro" }]} />
              <Badge tone="dashed">{crm.repo.origem === "local" ? "dados no navegador" : "servidor local"}</Badge>
            </>
          }
        />
      }
    >
      {crm.repo.origem === "local" && rota.tela === "demandas" && (
        <Banner>Este CRM está rodando só no seu navegador, com dados de exemplo. Para receber leads de verdade por webhook e conectar o Grokbot, veja <a href="#/integracoes">Integrações</a>.</Banner>
      )}
      {tela}
      <Fab label="Discagem rápida: ligar para um número" onClick={crm.discar} title="Discagem rápida" />
    </Shell>
  );
}
