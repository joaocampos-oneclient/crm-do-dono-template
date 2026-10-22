import React from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "./ds/tokens.css";
import "./ds/ds2027.css";
import "./ds/crm.css";
import { themeInitScript, ToastProvider } from "./ds";
import { App } from "./screens/App";
import { criarRepositorio } from "./repo/criar";

const repo = criarRepositorio();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <div className="ds-root" suppressHydrationWarning style={{ minHeight: "100dvh" }}>
      <ToastProvider>
        <App repo={repo} />
      </ToastProvider>
    </div>
  </React.StrictMode>,
);
// Aplica o tema salvo logo após a primeira pintura (sem SSR, não precisa do <script> inline).
new Function(themeInitScript)();
