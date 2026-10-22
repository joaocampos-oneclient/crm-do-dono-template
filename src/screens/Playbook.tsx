import * as React from "react";
import { Card, PageHead, Segmented } from "../ds";
import { useCRM } from "../app/crm";
import { ETAPAS, playbookDe } from "../domain/funil";

/** Playbook: a Pergunta Matadora de cada etapa. O padrão vale para todos os produtos; cada produto pode ter o seu. */
export function Playbook() {
  const { estado } = useCRM();
  const [produtoId, setProdutoId] = React.useState<string>("padrao");
  const produto = estado.produtos.find((p) => p.id === produtoId) ?? null;
  return (
    <>
      <PageHead eyebrow="Configuração" title="Playbook" actions={estado.produtos.length > 0 && <Segmented name="pb-produto" label="Produto" value={produtoId} onChange={setProdutoId} options={[{ value: "padrao", label: "Padrão" }, ...estado.produtos.filter((p) => p.ativo).map((p) => ({ value: p.id, label: p.nome }))]} />}>
        <p className="ds-muted" style={{ margin: "4px 0 0" }}>Uma pergunta principal por etapa, as complementares (com o porquê), as objeções (o que dizer e o que nunca dizer), a condição e o próximo passo. {estado.config.nomeRobo} usa a etapa "Em conversa"; os humanos usam as demais. Edite em <a href="#/produtos">Produtos</a> (playbook por produto) ou em <code>src/domain/funil.ts</code> (padrão).</p>
      </PageHead>
      {ETAPAS.map((e) => {
        const p = playbookDe(e.id, produto);
        if (!p) return null;
        const proprio = !!produto?.playbook.some((x) => x.etapa === e.id);
        return (
          <Card key={e.id} style={{ padding: 16, display: "grid", gap: 10 }}>
            <div className="ds-label">Etapa {ETAPAS.indexOf(e) + 1}: {e.nome} · quem move: {e.auto ? "sistema" : e.dono} · prazo {e.prazoTexto} · meta {e.meta}%{proprio ? " · playbook próprio do produto" : ""}</div>
            <h2 style={{ margin: 0, fontSize: 20 }}>{p.pergunta}</h2>
            <div><div className="ds-label">O que fazer por resposta</div><ul style={{ margin: 0, paddingLeft: 18 }}>{p.faixas.map((f) => <li key={`${f.de}-${f.ate}`}><span className="ds-num">{f.de}–{f.ate}</span>: {f.acao}</li>)}</ul></div>
            {p.complementares.length > 0 && <div><div className="ds-label">Perguntas complementares</div><ul style={{ margin: 0, paddingLeft: 18 }}>{p.complementares.map((q) => <li key={q.pergunta}>{q.pergunta} <em>({q.porque})</em></li>)}</ul></div>}
            {p.objecoes.length > 0 && <div><div className="ds-label">Objeções</div><ul style={{ margin: 0, paddingLeft: 18 }}>{p.objecoes.map((o) => <li key={o.objecao}><strong>{o.objecao}</strong>: diga "{o.diga}" — nunca "{o.nuncaDiga}"</li>)}</ul></div>}
            <div><div className="ds-label">Condição</div>{p.condicao}</div>
            <div><div className="ds-label">Próximo passo</div>{p.proximoPasso}</div>
            <div><div className="ds-label">Como validar que o card pode andar</div>{e.validacao} · motivos de perda: {e.motivosPerda.join(", ")}</div>
          </Card>
        );
      })}
    </>
  );
}
