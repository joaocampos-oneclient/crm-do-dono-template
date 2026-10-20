import { Kanban, KanbanCard, KanbanColumn } from "../ds";
import { ETAPAS } from "../domain/funil";
import { estourouPrazo } from "../domain/rules";
import { FUNIS } from "../data/demo";
import type { Ctx } from "./ctx";

const tempo = (min: number) => (min < 60 ? `${min} min` : min < 1440 ? `${Math.round(min / 60)} h` : `${Math.round(min / 1440)} d`);

/** Funil de venda: um quadro, 8 etapas. As etapas automáticas (proposta aberta, pago, dentro) o sistema move. */
export function FunilKanban({ contatos, abrir }: Ctx) {
  return (
    <div style={{ overflowX: "auto" }}>
      <Kanban>
        {ETAPAS.map((e) => {
          const cards = contatos.flatMap((c) => c.oportunidades.filter((o) => o.etapa === e.id).map((o) => ({ c, o })));
          return (
            <KanbanColumn key={e.id} title={e.nome} count={String(cards.length)} meta={e.auto ? "automática" : `meta ${e.meta}%`}>
              {cards.map(({ c, o }) => (
                <KanbanCard
                  key={o.id}
                  title={c.nome}
                  subtitle={c.empresa}
                  footerLeft={`${FUNIS.find((f) => f.id === c.origem)?.nome ?? ""}${c.nota !== null ? ` · nota ${c.nota}` : ""}`}
                  time={tempo(o.minutosNaEtapa)}
                  late={estourouPrazo(o)}
                  onClick={() => abrir(c.id)}
                />
              ))}
            </KanbanColumn>
          );
        })}
      </Kanban>
    </div>
  );
}
