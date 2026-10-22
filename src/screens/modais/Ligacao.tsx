import * as React from "react";
import { Button, Checkbox, Input, Modal, Segmented, Textarea } from "../../ds";
import { useCRM } from "../../app/crm";
import { adapters } from "../../adapters";
import { oportunidadePrincipal, primeiroNome } from "../../domain/rules";
import type { Ligacao, Termometro, TrechoLigacao } from "../../domain/types";

type Fase = "antes" | "ligando" | "depois";

/**
 * Ligação de dentro do CRM: aviso de gravação -> cronômetro -> encerrar -> transcrição com trechos marcados,
 * termômetro obrigatório, resumo e follow-ups que viram tarefas. Telefonia e transcrição são simuladas
 * (src/adapters); a troca por Twilio/Whisper está em docs/integracoes.md.
 */
export function ModalLigacao({ contatoId, onClose }: { contatoId: string | null; onClose: () => void }) {
  const { contato, operador, despachar, estado } = useCRM();
  const c = contatoId ? contato(contatoId) : null;
  const [fase, setFase] = React.useState<Fase>("antes");
  const [aviso, setAviso] = React.useState(false);
  const [inicio, setInicio] = React.useState<number>(0);
  const [seg, setSeg] = React.useState(0);
  const [resultado, setResultado] = React.useState<Ligacao["resultado"]>("atendeu");
  const [termometro, setTermometro] = React.useState<Termometro | "">("");
  const [resumo, setResumo] = React.useState("");
  const [trechos, setTrechos] = React.useState<TrechoLigacao[]>([]);
  const [termometroIA, setTermometroIA] = React.useState<Termometro>("morno");
  const [followups, setFollowups] = React.useState<{ texto: string; quando: string; marcado: boolean }[]>([]);
  const [novoFollow, setNovoFollow] = React.useState("");

  React.useEffect(() => { if (contatoId) { setFase("antes"); setAviso(false); setSeg(0); setTermometro(""); setResumo(""); setTrechos([]); setFollowups([]); setResultado("atendeu"); } }, [contatoId]);
  React.useEffect(() => {
    if (fase !== "ligando") return;
    const t = setInterval(() => setSeg(Math.round((Date.now() - inicio) / 1000)), 500);
    return () => clearInterval(t);
  }, [fase, inicio]);

  if (!c) return null;
  const o = oportunidadePrincipal(c.oportunidades);
  const nome = primeiroNome(c.nome);

  const ligar = async () => {
    await adapters.telefonia.ligar(c.telefone, { avisoDeGravacao: true });
    setInicio(Date.now()); setFase("ligando");
  };
  const encerrar = async () => {
    const dur = Math.max(1, Math.round((Date.now() - inicio) / 1000));
    setSeg(dur);
    if (resultado === "atendeu") {
      const t = await adapters.transcricao.transcrever("sim", { nome, dor: o?.briefing?.dor, segmento: c.segmento });
      setTrechos(t.trechos);
      setTermometroIA(t.termometroIA);
      setResumo(t.resumo);
      setFollowups(t.followups.map((f) => ({ ...f, marcado: true })));
    }
    setFase("depois");
  };
  const salvar = async () => {
    if (!termometro) return;
    const l: Omit<Ligacao, "id"> = {
      contatoId: c.id, operadorId: operador?.id ?? null, iniciouEm: new Date(inicio).toISOString(), duracaoSeg: seg, resultado, avisoGravacaoDado: aviso,
      trechos: resultado === "atendeu" ? trechos : [], followups: followups.filter((f) => f.marcado).map((f) => ({ texto: f.texto, quando: f.quando, origem: "ligação" })), resumo, termometroVendedor: termometro, termometroIA,
    };
    if (await despachar({ tipo: "registrarLigacao", ligacao: l }, "Ligação salva na ficha. Follow-ups viraram tarefas.")) onClose();
  };
  const mm = `${String(Math.floor(seg / 60)).padStart(2, "0")}:${String(seg % 60).padStart(2, "0")}`;

  return (
    <Modal open={!!contatoId} onClose={onClose} title={`Ligação · ${c.nome}`} footer={
      fase === "antes" ? <Button onClick={ligar} disabled={!aviso}>Ligar para {c.telefone}</Button>
      : fase === "ligando" ? <Button variant="danger" onClick={encerrar}>Encerrar</Button>
      : <Button onClick={salvar} disabled={!termometro}>Salvar na ficha</Button>
    }>
      {fase === "antes" && (
        <div style={{ display: "grid", gap: 10 }}>
          <p style={{ margin: 0 }}>Antes de ligar: a ligação será gravada e transcrita. <strong>Sem aviso ao contato, não grava.</strong> Diga nos primeiros segundos: "esta ligação está sendo gravada para registro, tudo bem?"</p>
          <Checkbox checked={aviso} onChange={(e) => setAviso(e.target.checked)} label="Vou avisar que a ligação é gravada" />
          {o?.briefing && <div className="ds-label">Briefing: dor "{o.briefing.dor}" · meta "{o.briefing.meta}" · data {o.briefing.data}</div>}
          <p className="ds-muted" style={{ margin: 0, fontSize: 13 }}>Telefonia simulada. Em produção, este botão disca pela Twilio/Zenvia e o áudio vai para um bucket privado.</p>
        </div>
      )}
      {fase === "ligando" && (
        <div style={{ display: "grid", gap: 10 }}>
          <div className="ds-callclock" aria-live="polite">{mm}</div>
          <Segmented name="resultado" label="Resultado" value={resultado} onChange={setResultado} options={[{ value: "atendeu", label: "Atendeu" }, { value: "caixa postal", label: "Caixa postal" }, { value: "não atende", label: "Não atende" }]} />
          <p className="ds-muted" style={{ margin: 0 }}>Enquanto fala, lembre da Pergunta Matadora da etapa. Ao encerrar, a transcrição aparece aqui.</p>
        </div>
      )}
      {fase === "depois" && (
        <div style={{ display: "grid", gap: 12 }}>
          <div className="ds-label">Duração {mm} · {resultado}{resultado === "atendeu" ? " · transcrição simulada" : ""}</div>
          {resultado === "atendeu" && (
            <ol className="ds-timeline" aria-label="Transcrição">
              {trechos.map((t, i) => <li key={i} className="ds-timeline__item"><div><div className="ds-timeline__time">{t.hora}</div><div className="ds-timeline__tag">{t.marca ?? (t.quem === "vendedor" ? "você" : "contato")}</div></div><div className="ds-timeline__text">{t.texto}</div></li>)}
            </ol>
          )}
          <Segmented name="termometro" label="Como foi? (obrigatório)" value={termometro} onChange={setTermometro} options={[{ value: "frio", label: "Fria" }, { value: "morno", label: "Morna" }, { value: "quente", label: "Quente" }]} />
          {resultado === "atendeu" && <div className="ds-label">Leitura da IA: {termometroIA}. Vale a sua.</div>}
          <Textarea label="Resumo" rows={3} value={resumo} onChange={(e) => setResumo(e.target.value)} />
          <div>
            <div className="ds-label" style={{ marginBottom: 6 }}>Follow-ups (marcados viram tarefas)</div>
            <div style={{ display: "grid", gap: 6 }}>
              {followups.map((f, i) => <Checkbox key={i} checked={f.marcado} onChange={(e) => setFollowups(followups.map((x, j) => (j === i ? { ...x, marcado: e.target.checked } : x)))} label={<span>{f.texto} <span className="ds-label">· {f.quando}</span></span>} />)}
              <div className="ds-composer">
                <Input placeholder="Novo follow-up (vence amanhã)" value={novoFollow} onChange={(e) => setNovoFollow(e.target.value)} />
                <Button size="sm" variant="secondary" onClick={() => { if (novoFollow.trim()) { setFollowups([...followups, { texto: novoFollow, quando: "amanhã", marcado: true }]); setNovoFollow(""); } }}>Adicionar</Button>
              </div>
            </div>
          </div>
          <p className="ds-muted" style={{ margin: 0, fontSize: 13 }}>Próxima evolução (docs/plano-cursor.md): {estado.config.nomeRobo} ouve a transcrição e propõe o follow-up sozinho.</p>
        </div>
      )}
    </Modal>
  );
}
