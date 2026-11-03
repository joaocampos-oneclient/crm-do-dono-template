import type { Metadata } from "next";
import { themeInitScript } from "@/design-system-2027/theme-script";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "./globals.css";
import { ClientLayout } from "@/components/ClientLayout";

export const metadata: Metadata = {
  title: "CRM do dono",
  description: "CRM v3 instalável · agentes, funil e MCP. Contas + chaves e pronto.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <ClientLayout>
          <div className="ds-root" suppressHydrationWarning>
            <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
            {children}
          </div>
        </ClientLayout>
      </body>
    </html>
  );
}
