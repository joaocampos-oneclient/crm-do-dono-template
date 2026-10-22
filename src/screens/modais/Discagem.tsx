import * as React from "react";
import { Button, FormRow, Input, List, ListRow, Modal, Select } from "../../ds";
import { useCRM } from "../../app/crm";
import { telefoneDigitos } from "../../domain/rules";

/**
 * Discagem rápida: de qualquer tela, escolha um contato ou digite um número. Número novo vira
 * contato + oportunidade na hora e já abre a ligação. Tudo vira inteligência para o CRM.
 */
export function ModalDiscagem({ open, onClose, aoLigar }: { open: boolean; onClose: () => void; aoLigar: (contatoId: string) => void }) {
  const { contatos, estado, despachar } = useCRM();
  const [termo, setTermo] = React.useState("");
  const [novo, setNovo] = React.useState({ nome: "", empresa: "", origem: estado.funis[0]?.id ?? "" });
  React.useEffect(() => { if (open) { setTermo(""); setNovo({ nome: "", empresa: "", origem: estado.funis[0]?.id ?? "" }); } }, [open, estado.funis]);

  const digitos = termo.replace(/\D/g, "");
  const achados = contatos.filter((c) => termo && (`${c.nome} ${c.empresa}`.toLowerCase().includes(termo.toLowerCase()) || (digitos.length >= 4 && telefoneDigitos(c.telefone).includes(digitos)))).slice(0, 6);
  const pareceTelefone = digitos.length >= 8 && achados.length === 0;

  const criarELigar = async () => {
    const s = await despachar({ tipo: "criarLead", nome: novo.nome || "Lead sem nome", telefone: termo, origem: novo.origem, empresa: novo.empresa, abrirConversa: false, por: "discagem" }, "Contato criado.");
    if (!s) return;
    const c = s.contatos.find((x) => telefoneDigitos(x.telefone) === telefoneDigitos(termo));
    if (c) aoLigar(c.id);
  };

  return (
    <Modal open={open} onClose={onClose} title="Discagem rápida">
      <div style={{ display: "grid", gap: 10 }}>
        <Input label="Contato ou telefone" placeholder="Nome, empresa ou (62) 9…" value={termo} onChange={(e) => setTermo(e.target.value)} autoFocus />
        {achados.length > 0 && <List>{achados.map((c) => <ListRow key={c.id} onClick={() => aoLigar(c.id)} title={c.nome} subtitle={`${c.empresa} · ${c.telefone}`} />)}</List>}
        {pareceTelefone && (
          <div style={{ display: "grid", gap: 8 }}>
            <div className="ds-label">Número novo. Cria o contato e liga:</div>
            <FormRow>
              <Input label="Nome" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} />
              <Input label="Empresa" value={novo.empresa} onChange={(e) => setNovo({ ...novo, empresa: e.target.value })} />
              <Select label="Origem" value={novo.origem} onChange={(e) => setNovo({ ...novo, origem: e.target.value })}>{estado.funis.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}</Select>
            </FormRow>
            <Button onClick={criarELigar} disabled={!novo.nome.trim()}>Criar e ligar</Button>
          </div>
        )}
        {!termo && <p className="ds-muted" style={{ margin: 0, fontSize: 13 }}>Dica: digite parte do nome ou o telefone com DDD.</p>}
      </div>
    </Modal>
  );
}
