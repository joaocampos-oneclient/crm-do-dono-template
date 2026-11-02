import * as React from 'react';
import { cx } from './cx';

/* ---------- Shell: sidebar fixa no desktop, barra no celular ---------- */
export type NavItem = { id: string; label: string; href: string; badge?: React.ReactNode; grupo?: string };

export function Sidebar({ items, activeId, brand, footer, label = 'Navegação principal' }: { items: NavItem[]; activeId: string; brand: React.ReactNode; footer?: React.ReactNode; label?: string }) {
  const grupos = Array.from(new Set(items.map((i) => i.grupo ?? '')));
  return (
    <nav aria-label={label} className="ds-sidebar">
      <div className="ds-sidebar__brand">{brand}</div>
      {grupos.map((g) => (
        <div key={g} className="ds-sidebar__group">
          {g && <div className="ds-label ds-sidebar__group-label">{g}</div>}
          {items.filter((i) => (i.grupo ?? '') === g).map((it) => (
            <a key={it.id} href={it.href} aria-current={it.id === activeId ? 'page' : undefined} className="ds-sidebar__item">
              <span>{it.label}</span>
              {it.badge != null && <span className="ds-sidebar__badge">{it.badge}</span>}
            </a>
          ))}
        </div>
      ))}
      {footer && <div className="ds-sidebar__foot">{footer}</div>}
    </nav>
  );
}

export function Shell({ sidebar, children }: { sidebar: React.ReactNode; children: React.ReactNode }) {
  return <div className="ds-shell">{sidebar}<main className="ds-shell__main">{children}</main></div>;
}

/* ---------- Cabeçalho de tela ---------- */
export function PageHead({ eyebrow, title, actions, children }: { eyebrow?: string; title: string; actions?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <header className="ds-pagehead">
      <div>
        {eyebrow && <div className="ds-label">{eyebrow}</div>}
        <h1 className="ds-pagehead__title">{title}</h1>
        {children}
      </div>
      {actions && <div className="ds-pagehead__actions">{actions}</div>}
    </header>
  );
}

/* ---------- Cartão de métrica ---------- */
export function StatCard({ label, value, delta, hint, tone }: { label: string; value: React.ReactNode; delta?: number | null; hint?: string; tone?: 'good' | 'bad' }) {
  const sinal = delta == null ? null : delta > 0 ? `▲ ${delta}%` : delta < 0 ? `▼ ${Math.abs(delta)}%` : '= 0%';
  return (
    <div className="ds-stat">
      <div className="ds-label">{label}</div>
      <div className={cx('ds-stat__value', 'ds-num')}>{value}</div>
      <div className="ds-stat__foot">
        {sinal && <span className={cx('ds-stat__delta', tone === 'good' && 'is-good', tone === 'bad' && 'is-bad')}>{sinal}</span>}
        {hint && <span className="ds-stat__hint">{hint}</span>}
      </div>
    </div>
  );
}

export function StatGrid({ children }: { children: React.ReactNode }) { return <div className="ds-statgrid">{children}</div>; }

/* ---------- Seção com título ---------- */
export function Section({ title, aside, children, className }: { title: React.ReactNode; aside?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cx('ds-section', className)}>
      <div className="ds-section__head"><h2 className="ds-section__title">{title}</h2>{aside}</div>
      {children}
    </section>
  );
}

/* ---------- Definição (chave: valor) ---------- */
export function DefList({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="ds-deflist">
      {items.map(([k, v]) => <div key={k}><dt className="ds-label">{k}</dt><dd>{v}</dd></div>)}
    </dl>
  );
}

/* ---------- Painel de formulário com ações ---------- */
export function FormRow({ children }: { children: React.ReactNode }) { return <div className="ds-formrow">{children}</div>; }
export function Actions({ children, align = 'end' }: { children: React.ReactNode; align?: 'start' | 'end' | 'between' }) {
  return <div className={cx('ds-actions', `ds-actions--${align}`)}>{children}</div>;
}
