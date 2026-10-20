import { Card } from "../ds";
import { ETAPAS, PLAYBOOK, etapaDe } from "../domain/funil";

/** Playbook: a Pergunta Matadora de cada etapa. Aqui só a etapa "Em conversa" está completa, de exemplo. */
export function Playbook() {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {PLAYBOOK.map((p) => (
        <Card key={p.etapa} style={{ padding: 16, display: "grid", gap: 10 }}>
          <div className="ds-label">Etapa: {etapaDe(p.etapa)?.nome}</div>
          <h2 style={{ margin: 0, fontSize: 20 }}>{p.pergunta}</h2>
          <div><div className="ds-label">O que fazer por nota</div><ul style={{ margin: 0, paddingLeft: 18 }}>{p.faixas.map((f) => <li key={f.de}><span className="ds-num">{f.de}–{f.ate}</span>: {f.acao}</li>)}</ul></div>
          <div><div className="ds-label">Perguntas complementares</div><ul style={{ margin: 0, paddingLeft: 18 }}>{p.complementares.map((q) => <li key={q.pergunta}>{q.pergunta} <em>({q.porque})</em></li>)}</ul></div>
          <div><div className="ds-label">Objeções</div><ul style={{ margin: 0, paddingLeft: 18 }}>{p.objecoes.map((o) => <li key={o.objecao}><strong>{o.objecao}</strong>: diga "{o.diga}" — nunca "{o.nuncaDiga}"</li>)}</ul></div>
          <div><div className="ds-label">Condição</div>{p.condicao}</div>
          <div><div className="ds-label">Próximo passo</div>{p.proximoPasso}</div>
        </Card>
      ))}
      <Card tone="alt" style={{ padding: 16 }}>
        <div className="ds-label">Falta escrever (é a sua parte)</div>
        <p style={{ margin: "6px 0 0" }}>{ETAPAS.filter((e) => !PLAYBOOK.some((p) => p.etapa === e.id)).map((e) => e.nome).join(" · ")}</p>
      </Card>
    </div>
  );
}
