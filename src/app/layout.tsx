import type { Metadata } from "next";
import { themeInitScript } from "@/design-system-2027/theme-script";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "CRM do dono",
  description: "CRM v3 instalável · agentes, funil e MCP. Contas + chaves e pronto.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <div className="ds-root" suppressHydrationWarning>
          <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
          {children}
        </div>
      </body>
    </html>
  );
}
