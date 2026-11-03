"use client";
import * as React from "react";
import { Badge, Card } from "@/ds";
import { CRMProvider, useCRM } from "@/components/crm/provider";
import type { EstadoCRM } from "@/domain/types";
import type { RepositorioCRM } from "@/repo";
import { iniciais } from "./partes";
import { WhatsAppOnboarding } from "@/components/crm/WhatsAppOnboarding";
import { CrmV3App } from "@/crm-v3/CrmV3App";
import { ModalLigacao } from "./modais/Ligacao";
import { ModalDiscagem } from "./modais/Discagem";

/** Raiz: carrega o estado do repositório, pede o operador e monta o shell v3. */
export function App({ repo }: { repo: RepositorioCRM }) {
  const [estado, setEstado] = React.useState<EstadoCRM | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);
  const [ligacao, setLigacao] = React.useState<string | null>(null);
  const [discagem, setDiscagem] = React.useState(false);

  React.useEffect(() => {
    repo.carregar().then(setEstado).catch((e) => setErro(String(e.message ?? e)));
  }, [repo]);

  if (erro) {
    return (
      <div className="ds-gate">
        <Card className="ds-gate__card">
          <h1 style={{ margin: 0 }}>Não consegui carregar o CRM</h1>
          <p>{erro}</p>
          <p className="ds-muted">
            Se você definiu NEXT_PUBLIC_API_URL, confira se o servidor está no ar (<code>npm run dev</code>).
          </p>
        </Card>
      </div>
    );
  }
  if (!estado) {
    return (
      <div className="ds-gate">
        <span className="ds-label">Carregando…</span>
      </div>
    );
  }

  return (
    <CRMProvider repo={repo} estadoInicial={estado} aoLigar={setLigacao} aoDiscar={() => setDiscagem(true)}>
      <Interno />
      <ModalLigacao contatoId={ligacao} onClose={() => setLigacao(null)} />
      <ModalDiscagem
        open={discagem}
        onClose={() => setDiscagem(false)}
        aoLigar={(id) => {
          setDiscagem(false);
          setLigacao(id);
        }}
      />
    </CRMProvider>
  );
}

function Interno() {
  const crm = useCRM();
  if (!crm.operador) return <Entrada />;
  return <CrmV3App />;
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
        <p className="ds-gate__lead">
          Modo demo: escolha o operador. Em produção o gate é magic link em <a href="/entrar">/entrar</a>.
        </p>
        <div className="ds-oplist">
          {humanos.map((o) => (
            <button key={o.id} type="button" className="ds-row" onClick={() => entrar(o.id)}>
              <span className="ds-avatar ds-avatar--ink">{iniciais(o.nome)}</span>
              <span className="ds-row__body">
                <span className="ds-row__title">{o.nome}</span>
                <span className="ds-row__sub" style={{ display: "block" }}>
                  {o.papel}
                </span>
              </span>
              <Badge tone="outline">entrar</Badge>
            </button>
          ))}
        </div>
        <p className="ds-muted" style={{ margin: 0, fontSize: 13 }}>
          Dados de exemplo. Para zerar: Integrações → &quot;Começar do zero&quot;.
        </p>
      </Card>
      <div style={{ width: "min(420px, 100%)", marginTop: 8 }}>
        <WhatsAppOnboarding compact />
      </div>
    </div>
  );
}
