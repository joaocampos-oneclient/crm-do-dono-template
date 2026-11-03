import { CrmLink as Link } from "./hash-nav";
import { ROTULO_ALERTA } from "@/lib/crm/conversas-dominio";
import type { ConversaDetalhe, ConversaResumo } from "@/lib/crm/conversas";
import type { OperadorPainel } from "./_componentes/conversa-painel";
import { dataHora, iniciais, nomeEmExibicao } from "@/lib/crm/format";
import { ConversaPainel } from "./_componentes/conversa-painel";
import { Avatar } from "./crm-ui";
import { CrmEmpty } from "./empty";
import { CrmV3Page } from "./frame";
import { PageChrome } from "./page-chrome";

export function ConversasV3({
  lista,
  detalhe,
  exemplo,
  ligado,
  takeover = false,
  operadores = [],
}: {
  lista: ConversaResumo[];
  detalhe: ConversaDetalhe | null;
  exemplo: boolean;
  ligado: boolean;
  takeover?: boolean;
  operadores?: OperadorPainel[];
}) {
  return (
    <CrmV3Page>
      <PageChrome
        label="Conversas"
        title="Quem está falando com quem."
        lede={
          exemplo
            ? "exemplo ilustrativo · dados de mentira"
            : !ligado
              ? "As mensagens só chegam aqui depois que o Cláudio for ligado ao CRM. Assumir continua desligado enquanto a ligação com o Cláudio estiver apagada."
              : undefined
        }
      />

      <div className={`crm-conversas${detalhe ? " crm-conversas--aberta" : ""}`}>
        <div className="crm-conversas__lista">
          {lista.length === 0 ? (
            <CrmEmpty
              title="Nenhuma conversa espelhada ainda"
              text={
                ligado
                  ? "Quando o Cláudio ou o contato trocarem mensagens, elas aparecem aqui."
                  : "A ligação com o Cláudio ainda não foi ativada. Nada aparece."
              }
            />
          ) : (
            <ul className="crm-v3-list">
              {lista.map((c) => (
                <li key={c.contatoId}>
                  <Link href={`/conversas?c=${c.contatoId}`}>
                    <Avatar initials={iniciais(c.nome)} size={36} />
                    <span style={{ minWidth: 0, display: "grid", gap: 2, flex: 1 }}>
                      <span style={{ font: "500 15px var(--font-sans)" }}>{nomeEmExibicao(c.nome)}</span>
                      <span style={{ font: "400 12px var(--font-sans)", color: "var(--fg-2)" }}>
                        {c.ultimaAutor === "lead" ? "Contato" : c.ultimaAutor === "claudio" ? "Cláudio" : "Equipe"}: {c.ultimaTexto}
                      </span>
                      <span className="crm-num" style={{ font: "400 11px var(--font-mono)", color: "var(--fg-3)" }}>
                        {dataHora(c.ultimaEm)}
                        {c.handoff ? ` · ${c.handoff.nivel ? ROTULO_ALERTA[c.handoff.nivel] : "pediu humano"}` : ""}
                        {!c.handoff && c.modo === "humano" ? (c.responsavelNome ? ` · com ${c.responsavelNome}` : " · com uma pessoa") : ""}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {detalhe ? (
          <div style={{ display: "grid", gap: 12 }}>
            <Link href="/conversas" className="crm-conversas__voltar" style={{ font: "500 13px var(--font-sans)", color: "var(--fg)" }}>
              Voltar à lista
            </Link>
            <div className="crm-v3-surface">
              <ConversaPainel key={detalhe.contato.id} detalhe={detalhe} exemplo={exemplo} ligado={ligado} takeover={takeover} operadores={operadores} />
            </div>
            {!exemplo && (
              <Link href={`/contatos/${detalhe.contato.id}`} style={{ font: "500 13px var(--font-sans)", color: "var(--fg)" }}>
                Abrir a ficha do contato
              </Link>
            )}
          </div>
        ) : (
          lista.length > 0 && (
            <CrmEmpty title="Escolha uma conversa" text="Leia o histórico e, se for o caso, assuma. Ao assumir o contato recebe um aviso automático." />
          )
        )}
      </div>
    </CrmV3Page>
  );
}
