import * as React from "react";
import { Badge, Button, Card, Input, PageHead, Section, Tabs, useToast } from "../ds";
import { useCRM } from "../app/crm";
import { estadoExemplo, estadoVazio } from "../data/exemplo";
import { chaveAtiva, configMcp, exemplosCurl, promptGrokbot } from "../domain/integracao";
import { apagarEstadoLocal } from "../repo/local";

/**
 * Integrações: como ligar canais de entrada (webhook), o Grokbot (MCP + prompt) e outros sistemas (API).
 * Também: exportar/importar o estado e começar do zero.
 */
export function Integracoes() {
  const { estado, repo, despachar } = useCRM();
  const toast = useToast();
  const [apiUrl, setApiUrl] = React.useState((import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8787");
  const [caminho, setCaminho] = React.useState("/caminho/para/crm-do-dono");
  const opts = { apiUrl, chaveLeitura: chaveAtiva(estado, "leitura"), chaveEscrita: chaveAtiva(estado, "escrita"), caminhoRepo: caminho };
  const curl = exemplosCurl(estado, opts);
  const copiar = (t: string) => { navigator.clipboard?.writeText(t); toast.push("Copiado."); };
  const Bloco = ({ titulo, texto }: { titulo: string; texto: string }) => (
    <div style={{ display: "grid", gap: 6 }}>
      <div className="ds-wrap" style={{ justifyContent: "space-between" }}><span className="ds-label">{titulo}</span><Button size="sm" variant="ghost" onClick={() => copiar(texto)}>Copiar</Button></div>
      <pre className="ds-pre">{texto}</pre>
    </div>
  );

  const exportar = () => {
    const blob = new Blob([JSON.stringify(estado, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `crm-do-dono-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  };
  const importar = async (file: File) => {
    try {
      const e = JSON.parse(await file.text());
      if (!e?.contatos || !e?.config) throw new Error("arquivo não parece um estado do CRM");
      if (await despachar({ tipo: "substituirEstado", estado: e }, "Estado importado.")) window.location.reload();
    } catch (err) { toast.push(`Não deu: ${(err as Error).message}`); }
  };
  const zerar = async (vazio: boolean) => {
    if (!window.confirm(vazio ? "Apagar TUDO e começar do zero (só dono + Cláudio)?" : "Voltar aos dados de exemplo? O que você mexeu será perdido.")) return;
    if (repo.origem === "local") apagarEstadoLocal(window.localStorage);
    await despachar({ tipo: "substituirEstado", estado: vazio ? estadoVazio() : estadoExemplo() });
    window.location.reload();
  };

  return (
    <>
      <PageHead eyebrow="Configuração" title="Integrações">
        <p className="ds-muted" style={{ margin: "4px 0 0" }}>Agora: <Badge tone="dashed">{repo.origem === "local" ? "dados só no navegador" : `servidor em ${apiUrl}`}</Badge>. Para receber leads de fora e conectar o Grokbot, suba o servidor local: <code>npm run dev:server</code> (ou <code>npm run dev:all</code>) e crie <code>.env.local</code> com <code>VITE_API_URL</code> e <code>VITE_API_KEY</code>. Passo a passo: <code>docs/instalacao.md</code>.</p>
      </PageHead>

      <div className="ds-formrow">
        <Input label="URL da API" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} help="Local: http://localhost:8787. Publicada: a URL do seu deploy (docs/deploy.md)." />
        <Input label="Caminho do repositório (para o MCP por stdio)" value={caminho} onChange={(e) => setCaminho(e.target.value)} />
      </div>

      <Tabs label="Integrações" items={[
        { id: "grok", label: "Grokbot / agentes", panel: (
          <div style={{ display: "grid", gap: 14 }}>
            <Card tone="alt" style={{ padding: 12 }}>
              <strong>Três níveis de acesso para um agente</strong>
              <ol style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                <li><strong>Leitura do banco</strong>: chave de escopo <em>leitura</em> no servidor MCP. O agente consulta métricas, contatos e funil, sem mudar nada.</li>
                <li><strong>Alterações via Cursor</strong>: o agente abre este repositório no Cursor e segue as regras do prompt (domínio com teste, sem segredo no código).</li>
                <li><strong>Testes via navegador</strong>: operador de papel <em>bot</em>; o agente abre o CRM, clica e relata.</li>
              </ol>
            </Card>
            <Bloco titulo="Prompt para colar no Grokbot (gerado com os seus dados)" texto={promptGrokbot(estado, opts)} />
            <Bloco titulo="Configuração MCP (Cursor: .cursor/mcp.json · Grokbot: configuração de servidores MCP)" texto={configMcp(opts)} />
            <p className="ds-muted" style={{ margin: 0, fontSize: 13 }}>Chaves em uso: leitura {opts.chaveLeitura ? <code>{opts.chaveLeitura.slice(0, 16)}…</code> : <em>nenhuma</em>} · escrita {opts.chaveEscrita ? <code>{opts.chaveEscrita.slice(0, 16)}…</code> : <em>nenhuma</em>}. Gerencie em <a href="#/operadores">Operadores e chaves</a>. Detalhes: <code>docs/grokbot.md</code>.</p>
          </div>
        ) },
        { id: "entrada", label: "Entrada de leads (webhook)", panel: (
          <div style={{ display: "grid", gap: 14 }}>
            <p style={{ margin: 0 }}>Qualquer canal entra por <code>POST /api/leads</code>: Meta Lead Ads, Google Ads, formulário do site, Typeform, planilha, indicação. Campo <code>origem</code> = id do funil ({estado.funis.map((f) => <code key={f.id} style={{ marginRight: 4 }}>{f.id}</code>)}). Telefone repetido não duplica.</p>
            <Bloco titulo="Criar lead" texto={curl.lead} />
            <Bloco titulo="Mensagem recebida no WhatsApp (o servidor devolve a resposta do Cláudio)" texto={curl.whatsapp} />
            <Bloco titulo="Confirmação de pagamento" texto={curl.pagamento} />
            <Bloco titulo="Ler métricas (chave de leitura)" texto={curl.metricas} />
            <p className="ds-muted" style={{ margin: 0, fontSize: 13 }}>Mapeamento do payload do Meta/Google e dos provedores de WhatsApp, telefonia, e-mail e pagamento: <code>docs/integracoes.md</code>.</p>
          </div>
        ) },
        { id: "dados", label: "Dados", panel: (
          <div style={{ display: "grid", gap: 14 }}>
            <Section title="Exportar / importar">
              <div className="ds-wrap">
                <Button variant="secondary" onClick={exportar}>Exportar estado (JSON)</Button>
                <label className="ds-btn ds-btn--secondary">Importar JSON<input type="file" accept="application/json" style={{ display: "none" }} onChange={(e) => e.target.files?.[0] && importar(e.target.files[0])} /></label>
              </div>
              <p className="ds-muted" style={{ margin: 0, fontSize: 13 }}>O JSON tem exatamente as tabelas de <code>supabase/schema.sql</code>. É o caminho para migrar para um banco: <code>docs/banco-de-dados.md</code>.</p>
            </Section>
            <Section title="Recomeçar">
              <div className="ds-wrap">
                <Button variant="secondary" onClick={() => zerar(false)}>Voltar aos dados de exemplo</Button>
                <Button variant="danger" onClick={() => zerar(true)}>Começar do zero</Button>
              </div>
            </Section>
            <Section title="Estado atual">
              <div className="ds-label">{estado.contatos.length} contatos · {estado.oportunidades.length} oportunidades · {estado.mensagens.length} mensagens · {estado.movimentos.length} movimentos · {estado.ligacoes.length} ligações · versão {estado.versao}</div>
            </Section>
          </div>
        ) },
      ]} />
    </>
  );
}
