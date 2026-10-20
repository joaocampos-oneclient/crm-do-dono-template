import { useState } from "react";
import { Badge, Banner, Card, Segmented, Tabs, useToast } from "../ds";
import { CONTATOS } from "../data/demo";
import type { Contato } from "../domain/types";
import type { Ctx } from "./ctx";
import { Hoje } from "./Hoje";
import { FunilKanban } from "./FunilKanban";
import { Contatos } from "./Contatos";
import { Playbook } from "./Playbook";
import { Metricas } from "./Metricas";

export function App() {
  const [contatos, setContatos] = useState<Contato[]>(CONTATOS);
  const [aberto, setAberto] = useState<string | null>(null);
  const [aba, setAba] = useState("hoje");
  const toast = useToast();
  const [tema, setTema] = useState<"light" | "dark">(
    document.querySelector(".ds-root")?.getAttribute("data-theme") === "dark" ? "dark" : "light",
  );

  const ctx: Ctx = {
    contatos,
    atualizar: (id, fn) => setContatos((l) => l.map((c) => (c.id === id ? fn(c) : c))),
    abrir: (id) => { setAberto(id); setAba("contatos"); },
    aberto,
    fechar: () => setAberto(null),
    aviso: toast.push,
  };

  const trocarTema = (v: "light" | "dark") => {
    const el = document.querySelector<HTMLElement>(".ds-root");
    if (el) { el.setAttribute("data-theme", v); el.style.colorScheme = v; }
    setTema(v);
  };

  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: "20px 16px 96px", display: "grid", gap: 16 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div className="ds-label">CRM do dono · template educacional</div>
          <h1 style={{ margin: "4px 0 0", fontSize: 28, letterSpacing: "-0.02em" }}>Seu time comercial em uma tela</h1>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Badge tone="dashed">exemplo ilustrativo</Badge>
          <Segmented
            name="tema"
            label="Tema"
            value={tema}
            onChange={trocarTema}
            options={[{ value: "light", label: "Claro" }, { value: "dark", label: "Escuro" }]}
          />
        </div>
      </header>

      <Banner>
        Isto é um template, não um produto pronto. Dados fictícios, integrações simuladas. Serve para ver as telas, entender o modelo e continuar no Cursor com o guia do README.
      </Banner>

      <Tabs
        label="Áreas do CRM"
        value={aba}
        onChange={setAba}
        items={[
          { id: "hoje", label: "Hoje", panel: <Hoje {...ctx} /> },
          { id: "funil", label: "Funil", panel: <FunilKanban {...ctx} /> },
          { id: "contatos", label: "Contatos", panel: <Contatos {...ctx} /> },
          { id: "playbook", label: "Playbook", panel: <Playbook /> },
          { id: "metricas", label: "Números", panel: <Metricas {...ctx} /> },
        ]}
      />

      <Card tone="alt" style={{ padding: 16 }}>
        <div className="ds-label">Próximo passo</div>
        <p style={{ margin: "6px 0 0" }}>
          Abra o README e cole o prompt de continuação no Cursor. Troque os dados de exemplo pelos seus, uma tela por vez.
        </p>
      </Card>
    </main>
  );
}
