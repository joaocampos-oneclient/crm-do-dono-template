"use client";

import { LazyMotion, MotionConfig, domAnimation, m, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Raiz de movimento do CRM v3. Lazy + reduced-motion. Sem spring. */
export function CrmMotionRoot({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig transition={{ duration: 0.2, ease: EASE }}>{children}</MotionConfig>
    </LazyMotion>
  );
}

export function CrmEnter({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  const cls = className ? `crm-v3-enter ${className}` : "crm-v3-enter";
  if (reduce) return <div className={cls}>{children}</div>;
  return (
    <m.div className={cls} initial={false} animate={{ opacity: 1 }} transition={{ duration: 0.12, ease: EASE }}>
      {children}
    </m.div>
  );
}

/** Troca de tela: View Transitions se existir; senão o CrmEnter cobre o fade. */
export function iniciarViewTransition(fn: () => void) {
  if (typeof document === "undefined") {
    fn();
    return;
  }
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => void;
  };
  if (reduce || typeof doc.startViewTransition !== "function") {
    fn();
    return;
  }
  doc.startViewTransition(fn);
}
