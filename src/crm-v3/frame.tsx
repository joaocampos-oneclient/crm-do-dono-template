"use client";

import type { ReactNode } from "react";
import { CrmEnter, CrmMotionRoot } from "./motion";

/** Envelope visual das telas v3. Só use atrás de CRM_V3. */
export function CrmV3Page({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <CrmMotionRoot>
      <div className={className ? `crm-v3 crm-v3-page ${className}` : "crm-v3 crm-v3-page"}>
        <CrmEnter>{children}</CrmEnter>
      </div>
    </CrmMotionRoot>
  );
}
