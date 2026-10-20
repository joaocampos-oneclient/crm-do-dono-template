import * as React from 'react';
import { cx } from './cx';

export function Card({ tone = 'surface', radius, dots, className, ...rest }: React.ComponentProps<'div'> & { tone?: 'surface' | 'alt' | 'trust'; radius?: 'section'; dots?: boolean }) {
  return <div {...rest} className={cx('ds-card', tone === 'alt' && 'ds-card--alt', tone === 'trust' && 'ds-card--trust', radius === 'section' && 'ds-card--section', dots && 'ds-dots', className)} />;
}

/** Tile de ícone. light = incluído · dark = adicional · ia = IA (lilás + roxo). */
export function Tile({ tone = 'light', size = 'md', className, ...rest }: React.ComponentProps<'span'> & { tone?: 'light' | 'dark' | 'ia'; size?: 'xs' | 'sm' | 'md' }) {
  return <span {...rest} className={cx('ds-tile', size !== 'md' && `ds-tile--${size}`, tone === 'dark' && 'ds-tile--dark', tone === 'ia' && 'ds-tile--ia', className)} />;
}

export type BadgeTone = 'soft' | 'solid' | 'outline' | 'fact' | 'dashed';
export function Badge({ tone = 'soft', className, ...rest }: React.ComponentProps<'span'> & { tone?: BadgeTone }) {
  return <span {...rest} className={cx('ds-badge', tone !== 'soft' && `ds-badge--${tone}`, className)} />;
}

/** Chip selecionável (filtro). */
export function Chip({ pressed, className, ...rest }: React.ComponentProps<'button'> & { pressed?: boolean }) {
  return <button type="button" {...rest} aria-pressed={pressed} className={cx('ds-chip', className)} />;
}

/** Pílula de eyebrow. `glass` só sobre o painel de confiança. */
export function Pill({ tone = 'outline', dot, className, children, ...rest }: React.ComponentProps<'span'> & { tone?: 'outline' | 'fill' | 'glass'; dot?: boolean }) {
  return <span {...rest} className={cx('ds-pill', tone === 'fill' && 'ds-pill--fill', tone === 'glass' && 'ds-pill--glass', className)}>{dot && <span className="ds-dot" aria-hidden="true" />}{children}</span>;
}

/** Estado: no ar (verde, fato) · ao vivo (vermelho, 1 por tela) · rascunho (tracejado). Sempre com texto: cor nunca é o único sinal. */
export function StatusTag({ kind, children }: { kind: 'onair' | 'live' | 'draft'; children?: React.ReactNode }) {
  const text = children ?? (kind === 'onair' ? 'No ar' : kind === 'live' ? 'Ao vivo' : 'Rascunho');
  return <span className={cx('ds-status', `ds-status--${kind}`)}><span className="ds-dot" aria-hidden="true" />{text}</span>;
}

/** Marcador AO VIVO. Só para transmissão; no máximo um por tela. */
export function LiveMarker({ children = 'AO VIVO' }: { children?: React.ReactNode }) {
  return <span className="ds-live"><span className="ds-dot" aria-hidden="true" />{children}</span>;
}

export function Avatar({ initials, tone = 'soft', label, className }: { initials: string; tone?: 'soft' | 'ink'; label?: string; className?: string }) {
  return <span role={label ? 'img' : undefined} aria-label={label} className={cx('ds-avatar', tone === 'ink' && 'ds-avatar--ink', className)}>{initials}</span>;
}

/** Orbe da IA: o único ponto de "imagem" e o ponto roxo da página. Decorativo por padrão. */
export function Orb({ size = 28, onAir, label, className }: { size?: number; onAir?: boolean; label?: string; className?: string }) {
  return <span role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} className={cx('ds-orb', onAir && 'ds-orb--onair', className)} style={{ width: size, height: size }} />;
}
