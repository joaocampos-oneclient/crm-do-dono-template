import * as React from 'react';
import { cx } from './cx';
import { StatusTag } from './surface';

/** Barra de CTA flutuante com vidro: um dos 3 pontos permitidos. Fixa na base; use `static` só em documentação. */
export function CtaBar({ status, title, sub, action, static: isStatic }: { status?: string; title: string; sub?: string; action: React.ReactNode; static?: boolean }) {
  return (
    <aside aria-label="Chamada para ação" className={cx('ds-ctabar', isStatic && 'ds-ctabar--static')}>
      <div className="ds-ctabar__text">
        {status && <StatusTag kind="onair">{status}</StatusTag>}
        <div className="ds-ctabar__title">{title}</div>
        {sub && <div className="ds-ctabar__sub">{sub}</div>}
      </div>
      {action}
    </aside>
  );
}
