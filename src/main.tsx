import React from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "./ds/tokens.css";
import "./ds/ds2027.css";
import { themeInitScript, ToastProvider } from "./ds";
import { App } from "./screens/App";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <div className="ds-root" suppressHydrationWarning style={{ minHeight: "100dvh" }}>
      <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      <ToastProvider>
        <App />
      </ToastProvider>
    </div>
  </React.StrictMode>,
);
// O <script> acima não roda dentro do React; aplica o tema na primeira pintura:
new Function(themeInitScript)();
