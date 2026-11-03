"use client";

import { Integracoes } from "@/screens/Integracoes";
import { CrmV3Page } from "./frame";
import { PageChrome } from "./page-chrome";

/** Reusa a tela de integrações do template dentro da casca v3. */
export function IntegracoesV3() {
  return (
    <CrmV3Page>
      <PageChrome
        label="Integrar ao GrokBot"
        title="MCP, webhook e chaves."
        lede="Mesmo painel do template — WhatsApp (wpp-engine), MCP e setup."
      />
      <div className="crm-v3-surface" style={{ padding: 8 }}>
        <Integracoes />
      </div>
    </CrmV3Page>
  );
}
