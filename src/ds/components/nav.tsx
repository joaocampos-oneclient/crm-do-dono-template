'use client';
import * as React from 'react';
import { cx } from './cx';

/* ---------- Tabs (WAI-ARIA: setas, Home, End; tabindex móvel) ---------- */
export type TabItem = { id: string; label: string; panel: React.ReactNode; disabled?: boolean };

export function Tabs({ items, label, defaultId, value, onChange }: { items: TabItem[]; label: string; defaultId?: string; value?: string; onChange?: (id: string) => void }) {
  const [inner, setInner] = React.useState<string>(defaultId ?? items[0]?.id ?? '');
  const current = value ?? inner;
  const base = React.useId();
  const refs = React.useRef<Record<string, HTMLButtonElement | null>>({});
  const enabled = items.filter((t) => !t.disabled);

  const select = (id: string) => { if (value === undefined) setInner(id); onChange?.(id); refs.current[id]?.focus(); };
  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, id: string) => {
    const i = enabled.findIndex((t) => t.id === id); const n = enabled.length;
    let j = i;
    if (e.key === 'ArrowRight') j = (i + 1) % n; else if (e.key === 'ArrowLeft') j = (i - 1 + n) % n;
    else if (e.key === 'Home') j = 0; else if (e.key === 'End') j = n - 1; else return;
    e.preventDefault(); select(enabled[j].id);
  };

  return (
    <div>
      <div role="tablist" aria-label={label} className="ds-tabs">
        {items.map((t) => (
          <button key={t.id} ref={(el) => { refs.current[t.id] = el; }} type="button" role="tab" id={`${base}-t-${t.id}`} aria-selected={current === t.id} aria-controls={`${base}-p-${t.id}`} tabIndex={current === t.id ? 0 : -1} disabled={t.disabled} className="ds-tab" onClick={() => select(t.id)} onKeyDown={(e) => onKeyDown(e, t.id)}>{t.label}</button>
        ))}
      </div>
      {items.map((t) => (
        <div key={t.id} role="tabpanel" id={`${base}-p-${t.id}`} aria-labelledby={`${base}-t-${t.id}`} hidden={current !== t.id} tabIndex={0} className="ds-tabpanel">{current === t.id ? t.panel : null}</div>
      ))}
    </div>
  );
}

/* ---------- Segmented: radios nativos (setas funcionam sem JS) ---------- */
export function Segmented<T extends string>({ name, label, options, value, onChange }: { name: string; label: string; options: { value: T; label: string; disabled?: boolean }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="ds-seg">
      {options.map((o) => (
        <label key={o.value} className="ds-seg__item">
          <input type="radio" name={name} value={o.value} checked={value === o.value} disabled={o.disabled} onChange={() => onChange(o.value)} />
          <span>{o.label}</span>
        </label>
      ))}
    </div>
  );
}

/* ---------- Barra móvel de 5 itens + botão flutuante ---------- */
export type TabBarItem = { id: string; label: string; href: string; icon?: React.ReactNode };
export type RenderLink = (p: { href: string; className: string; 'aria-current'?: 'page'; children: React.ReactNode }) => React.ReactNode;

/** Use `renderLink` para plugar o next/link: renderLink={(p) => <Link {...p} />} */
export function TabBar({ items, activeId, label = 'Navegação principal', renderLink }: { items: TabBarItem[]; activeId: string; label?: string; renderLink?: RenderLink }) {
  return (
    <nav aria-label={label} className="ds-tabbar">
      {items.slice(0, 5).map((it) => {
        const props = { href: it.href, className: 'ds-tabbar__item', 'aria-current': it.id === activeId ? ('page' as const) : undefined };
        const inner = <>{it.icon ?? <span className="ds-tabbar__icon" aria-hidden="true" />}<span>{it.label}</span></>;
        return renderLink ? <React.Fragment key={it.id}>{renderLink({ ...props, children: inner })}</React.Fragment> : <a key={it.id} {...props}>{inner}</a>;
      })}
    </nav>
  );
}

export function Fab({ label, className, ...rest }: React.ComponentProps<'button'> & { label: string }) {
  return <button type="button" {...rest} aria-label={label} className={cx('ds-fab', className)}>+</button>;
}
