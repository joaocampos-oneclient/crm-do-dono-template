import * as React from 'react';
import { cx } from './cx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

type Common = { variant?: ButtonVariant; size?: ButtonSize; loading?: boolean; arrow?: boolean; block?: boolean };

const classes = (v: ButtonVariant, s: ButtonSize, block: boolean | undefined, className?: string) =>
  cx('ds-btn', `ds-btn--${v}`, s !== 'md' && `ds-btn--${s}`, block && 'ds-btn--block', className);

/** Botão. "danger" é perigo em tinta (vermelho é só AO VIVO). `loading` bloqueia cliques e mostra spinner. */
export function Button({ variant = 'primary', size = 'md', loading = false, arrow = false, block, className, children, disabled, ...rest }: React.ComponentProps<'button'> & Common) {
  return (
    <button type="button" {...rest} disabled={disabled || loading} aria-busy={loading || undefined} className={classes(variant, size, block, className)}>
      <span style={{ display: 'contents' }}>{children}</span>
      {arrow && <span aria-hidden="true" className="ds-btn__arrow">→</span>}
    </button>
  );
}

/** Mesmo visual, como link. Para o `next/link`, envolva: <Link legacyBehavior passHref> ou use className="ds-btn ds-btn--primary" direto. */
export function LinkButton({ variant = 'primary', size = 'md', arrow = false, block, className, children, ...rest }: React.ComponentProps<'a'> & Omit<Common, 'loading'>) {
  return (
    <a {...rest} className={classes(variant, size, block, className)}>
      {children}
      {arrow && <span aria-hidden="true" className="ds-btn__arrow">→</span>}
    </a>
  );
}
