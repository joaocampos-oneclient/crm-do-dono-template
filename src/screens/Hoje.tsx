import { Badge, Card, List, ListRow } from "../ds";
import { etapaDe } from "../domain/funil";
import { categoria, estourouPrazo, proximasAcoes } from "../domain/rules";
import type { Ctx } from "./ctx";

/** Tela "Hoje": o que fazer agora, em ordem. É a tela que o time abre de manhã. */
export function Hoje({ contatos, abrir }: Ctx) {
  const handoffs = contatos.filter((c) => c.handoffPendente);
  const vencidos = contatos.filter((c) => c.oportunidades.some(estourouPrazo) && !c.handoffPendente);
  const demais = contatos.filter((c) => !c.handoffPendente && !vencidos.includes(c) && proximasAcoes(c).length);

  const bloco = (titulo: string, lista: typeof contatos, tom?: "solid") => (
    <Card style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <strong>{titulo}</strong>
        <Badge tone={tom ?? "soft"}>{lista.length}</Badge>
      </div>
      {lista.length === 0 ? (
        <p style={{ margin: 0, opacity: 0.7 }}>Nada aqui agora.</p>
      ) : (
        <List>
          {lista.map((c) => {
            const [a] = proximasAcoes(c);
            const o = c.oportunidades[0];
            return (
              <ListRow
                key={c.id}
                onClick={() => abrir(c.id)}
                title={`${c.nome} · ${c.empresa}`}
                subtitle={a ? `${a.titulo} — ${a.porque}` : etapaDe(o.etapa)?.nome}
                trailing={<Badge tone="outline">{categoria(c)}</Badge>}
              />
            );
          })}
        </List>
      )}
    </Card>
  );

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {bloco("Pediu humano e ninguém assumiu", handoffs, "solid")}
      {bloco("Prazo vencido na etapa", vencidos)}
      {bloco("Próximas ações", demais)}
    </div>
  );
}
