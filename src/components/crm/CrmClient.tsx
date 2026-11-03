"use client";

import * as React from "react";
import { App } from "@/screens/App";
import { criarRepositorio } from "@/repo/criar";
import type { RepositorioCRM } from "@/repo";

export function CrmClient() {
  const [repo, setRepo] = React.useState<RepositorioCRM | null>(null);

  React.useEffect(() => {
    setRepo(criarRepositorio());
  }, []);

  if (!repo) {
    return (
      <div className="ds-gate">
        <span className="ds-label">Carregando…</span>
      </div>
    );
  }

  return <App repo={repo} />;
}
