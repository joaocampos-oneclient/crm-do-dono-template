'use client';
import * as React from 'react';
import { cx } from './cx';

/* ---------- Diálogo nativo: Modal, Drawer e BottomSheet ----------
   <dialog>.showModal() dá foco preso, Esc e restauração de foco ao elemento que abriu. */
type DialogProps = { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode };

function BaseDialog({ open, onClose, title, children, footer, variant, grip }: DialogProps & { variant?: 'drawer' | 'sheet'; grip?: boolean }) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const tid = React.useId();
  React.useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} aria-labelledby={tid} className={cx('ds-dialog', variant && `ds-dialog--${variant}`)} onClose={onClose} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ds-dialog__panel">
        {grip && <div className="ds-dialog__grip" aria-hidden="true" />}
        <div className="ds-dialog__head">
          <h2 id={tid} className="ds-dialog__title">{title}</h2>
          <button type="button" className="ds-dialog__close" aria-label="Fechar" onClick={onClose}>×</button>
        </div>
        <div>{children}</div>
        {footer && <div className="ds-dialog__foot">{footer}</div>}
      </div>
    </dialog>
  );
}
export const Modal = (p: DialogProps) => <BaseDialog {...p} />;
export const Drawer = (p: DialogProps) => <BaseDialog {...p} variant="drawer" />;
export const BottomSheet = (p: DialogProps) => <BaseDialog {...p} variant="sheet" grip />;

/* ---------- Toast (vidro: é um dos 3 pontos permitidos, "avisos") ---------- */
type ToastApi = { push: (text: string) => void };
const ToastCtx = React.createContext<ToastApi | null>(null);

export function ToastProvider({ children, duration = 4000 }: { children: React.ReactNode; duration?: number }) {
  const [items, setItems] = React.useState<{ id: number; text: string }[]>([]);
  const timers = React.useRef<number[]>([]);
  React.useEffect(() => () => { timers.current.forEach((t) => window.clearTimeout(t)); }, []);
  const push = React.useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, text }]);
    timers.current.push(window.setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), duration));
  }, [duration]);
  const api = React.useMemo<ToastApi>(() => ({ push }), [push]);
  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="ds-toasts" role="status" aria-live="polite">
        {items.map((t) => <div key={t.id} className="ds-toast"><span className="ds-toast__dot" aria-hidden="true" />{t.text}</div>)}
      </div>
    </ToastCtx.Provider>
  );
}
export function useToast(): ToastApi {
  const c = React.useContext(ToastCtx);
  if (!c) throw new Error('useToast precisa estar dentro de <ToastProvider>.');
  return c;
}

/* ---------- Banner ---------- */
export function Banner({ tone = 'soft', role = 'status', children, action }: { tone?: 'soft' | 'fact' | 'strong'; role?: 'status' | 'alert'; children: React.ReactNode; action?: React.ReactNode }) {
  return <div role={role} className={cx('ds-banner', tone !== 'soft' && `ds-banner--${tone}`)}><div className="ds-banner__body">{children}</div>{action}</div>;
}

/* ---------- Tooltip (hover, foco; Esc dispensa, WCAG 1.4.13) ---------- */
export function Tooltip({ text, children }: { text: string; children: React.ReactElement<{ 'aria-describedby'?: string }> }) {
  const id = React.useId();
  const [open, setOpen] = React.useState(false);
  return (
    <span className="ds-tip" data-open={open || undefined} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}>
      {React.cloneElement(children, { 'aria-describedby': id })}
      <span role="tooltip" id={id} className="ds-tip__bubble">{text}</span>
    </span>
  );
}

/* ---------- Dropdown / menu (setas, Home, End, Esc, Tab) ---------- */
export type MenuItem = { id: string; label: string; onSelect: () => void; disabled?: boolean; danger?: boolean };

export function Dropdown({ label, items }: { label: React.ReactNode; items: MenuItem[] }) {
  const [open, setOpen] = React.useState(false);
  const root = React.useRef<HTMLDivElement>(null);
  const trigger = React.useRef<HTMLButtonElement>(null);
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const id = React.useId();

  React.useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  React.useEffect(() => { if (open) refs.current.find((r, i) => r && !items[i]?.disabled)?.focus(); }, [open, items]);

  const move = (from: number, dir: 1 | -1) => {
    const n = items.length;
    for (let k = 1; k <= n; k++) { const j = (from + dir * k + n * n) % n; if (!items[j].disabled) { refs.current[j]?.focus(); return; } }
  };
  const onMenuKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(i, 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(i, -1); }
    else if (e.key === 'Home') { e.preventDefault(); move(-1, 1); }
    else if (e.key === 'End') { e.preventDefault(); move(items.length, -1); }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); trigger.current?.focus(); }
    else if (e.key === 'Tab') setOpen(false);
  };

  return (
    <div ref={root} className="ds-menu">
      <button ref={trigger} type="button" className="ds-btn ds-btn--secondary ds-btn--sm" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen((o) => !o)} onKeyDown={(e) => { if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); } }}>{label}</button>
      {open && (
        <div id={id} role="menu" className="ds-menu__list">
          {items.map((it, i) => (
            <button key={it.id} ref={(el) => { refs.current[i] = el; }} type="button" role="menuitem" disabled={it.disabled} className={cx('ds-menu__item', it.danger && 'ds-menu__item--danger')} onKeyDown={(e) => onMenuKey(e, i)} onClick={() => { it.onSelect(); setOpen(false); trigger.current?.focus(); }}>{it.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}
