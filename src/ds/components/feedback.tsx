import * as React from 'react';
import { cx } from './cx';

export function EmptyState({ title, text, action, icon }: { title: string; text?: string; action?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="ds-empty">
      {icon ?? <span className="ds-tile" aria-hidden="true"><span style={{ width: 14, height: 14, borderRadius: '50%', border: '1.5px solid var(--fg-3)' }} /></span>}
      <h3>{title}</h3>{text && <p>{text}</p>}{action}
    </div>
  );
}

/** Esqueleto. Decorativo: avise o leitor de tela com aria-busy no contêiner. */
export function Skeleton({ width = '100%', height = 16, className, style }: { width?: number | string; height?: number | string; className?: string; style?: React.CSSProperties }) {
  return <span aria-hidden="true" className={cx('ds-skeleton', className)} style={{ width, height, ...style }} />;
}

export function ErrorState({ code, title, text, onRetry }: { code?: string; title: string; text?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="ds-errorstate">
      {code && <span className="ds-label">{code}</span>}
      <h3>{title}</h3>{text && <p>{text}</p>}
      {onRetry && <button type="button" className="ds-btn ds-btn--primary" onClick={onRetry}>Tentar de novo</button>}
    </div>
  );
}
