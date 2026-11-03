"use client";

import type { ReactNode } from "react";
import { KpiCard, Sparkline } from "./crm-ui";
import { CrmV3Page } from "./frame";
import { PageChrome } from "./page-chrome";

export function NumerosV3({
  children,
  kpis,
  label,
  title,
  lede,
}: {
  children: ReactNode;
  kpis?: Array<{ label: string; value: string; chart?: number[]; isNew?: boolean; caption?: string }>;
  label?: string;
  title?: string;
  lede?: ReactNode;
}) {
  return (
    <CrmV3Page>
      {label && title && <PageChrome label={label} title={title} lede={lede} />}
      {kpis && kpis.length > 0 && (
        <div className="crm-v3-kpis" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          {kpis.map((k) => (
            <KpiCard
              key={k.label}
              label={k.label}
              value={k.value}
              isNew={k.isNew}
              caption={k.caption}
              chart={k.chart && k.chart.length > 1 ? <Sparkline values={k.chart} /> : undefined}
            />
          ))}
        </div>
      )}
      {children}
    </CrmV3Page>
  );
}
