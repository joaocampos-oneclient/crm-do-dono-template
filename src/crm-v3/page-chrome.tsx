import type { ReactNode } from "react";

export function PageChrome({
  label,
  title,
  lede,
  aside,
  children,
}: {
  label: string;
  title: string;
  lede?: ReactNode;
  aside?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header style={{ display: "grid", gap: 8 }}>
      <p className="crm-label" style={{ margin: 0 }}>
        {label}
      </p>
      <div className="crm-v3-hello">
        <h1 className="crm-v3-display">{title}</h1>
        {aside}
      </div>
      {lede && <div className="crm-v3-lede">{lede}</div>}
      {children}
    </header>
  );
}
