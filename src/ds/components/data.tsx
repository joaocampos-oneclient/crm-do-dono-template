import * as React from 'react';
import { cx } from './cx';

/* ---------- Tabela densa ---------- */
export type Column<T> = { key: string; header: string; render: (row: T) => React.ReactNode; numeric?: boolean };
export function DataTable<T>({ columns, rows, rowKey, caption, dense = true }: { columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string; caption?: string; dense?: boolean }) {
  return (
    <div className="ds-table-wrap">
      <table className={cx('ds-table', dense && 'ds-table--dense')}>
        {caption && <caption className="ds-label">{caption}</caption>}
        <thead><tr>{columns.map((c) => <th key={c.key} scope="col" className={c.numeric ? 'is-num' : undefined}>{c.header}</th>)}</tr></thead>
        <tbody>{rows.map((r) => <tr key={rowKey(r)}>{columns.map((c) => <td key={c.key} className={c.numeric ? 'is-num' : undefined}>{c.render(r)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

/* ---------- Lista com linha clicável ---------- */
export function List({ className, ...rest }: React.ComponentProps<'div'>) { return <div {...rest} className={cx('ds-list', className)} />; }

type RowBase = { leading?: React.ReactNode; title: React.ReactNode; subtitle?: React.ReactNode; trailing?: React.ReactNode };
function RowInner({ leading, title, subtitle, trailing }: RowBase) {
  return (<>{leading}<span className="ds-row__body"><span className="ds-row__title">{title}</span>{subtitle && <span className="ds-row__sub" style={{ display: 'block' }}>{subtitle}</span>}</span>{trailing}</>);
}
export function ListRow({ href, onClick, className, ...row }: RowBase & { href?: string; onClick?: () => void; className?: string }) {
  if (href) return <a href={href} className={cx('ds-row', className)}><RowInner {...row} /></a>;
  return <button type="button" onClick={onClick} className={cx('ds-row', className)}><RowInner {...row} /></button>;
}

/* ---------- Linha do tempo ---------- */
export type TimelineEntry = { time: string; tag: string; text: React.ReactNode };
export function Timeline({ items, label }: { items: TimelineEntry[]; label?: string }) {
  return (
    <ol className="ds-timeline" aria-label={label}>
      {items.map((e, i) => (
        <li key={`${e.time}-${i}`} className="ds-timeline__item">
          <div><div className="ds-timeline__time">{e.time}</div><div className="ds-timeline__tag">{e.tag}</div></div>
          <div className="ds-timeline__text">{e.text}</div>
        </li>
      ))}
    </ol>
  );
}

/* ---------- Métrica com barra: real x meta x baseline ---------- */
/** Valores em 0–100. Com `n` abaixo de `minSample`, mostra aviso em vez de porcentagem. A barra fica verde só quando a meta é batida. */
export function MetricBar({ label, value, meta, baseline, n, minSample = 10 }: { label: string; value: number; meta: number; baseline: number; n?: number; minSample?: number }) {
  const small = n !== undefined && n < minSample;
  const style = { '--value': small ? '0%' : `${value}%`, '--meta': `${meta}%`, '--base': `${baseline}%` } as React.CSSProperties;
  const text = small ? `n=${n} · amostra pequena` : `${value}%`;
  return (
    <div className="ds-metric">
      <div className="ds-metric__head"><span>{label}</span><span className="ds-metric__values">{text} <span style={{ color: 'var(--fg-3)' }}>· meta {meta}% · base {baseline}%</span></span></div>
      <div className="ds-meter" style={style} role="img" aria-label={`${label}: ${text}, meta ${meta}%, baseline ${baseline}%`}>
        <span className={cx('ds-meter__fill', !small && value >= meta && 'ds-meter__fill--hit')} />
        <span className="ds-meter__meta" /><span className="ds-meter__base" />
      </div>
    </div>
  );
}

/* ---------- Kanban ---------- */
export function KanbanColumn({ title, count, meta, over, children, ...rest }: Omit<React.ComponentProps<'section'>, 'title'> & { title: string; count: string; meta?: React.ReactNode; over?: boolean }) {
  return (
    <section {...rest} aria-label={title} className={cx('ds-kcol', over && 'ds-kcol--over')}>
      <header className="ds-kcol__head"><div className="ds-kcol__row"><span>{title}</span><span className="ds-num">{count}</span></div>{meta && <div className="ds-label">{meta}</div>}</header>
      {children}
    </section>
  );
}
export function Kanban({ className, ...rest }: React.ComponentProps<'div'>) { return <div {...rest} className={cx('ds-kanban', className)} />; }

export function KanbanCard({ title, subtitle, meta, footerLeft, time, late, dragging, className, ...rest }: Omit<React.ComponentProps<'button'>, 'title'> & { title: string; subtitle?: string; meta?: React.ReactNode; footerLeft?: React.ReactNode; time: string; late?: boolean; dragging?: boolean }) {
  return (
    <button type="button" {...rest} className={cx('ds-kcard', dragging && 'is-dragging', className)}>
      <span className="ds-kcard__title">{title}</span>
      {subtitle && <span className="ds-kcard__sub">{subtitle}</span>}
      {meta}
      <span className="ds-kcard__foot"><span>{footerLeft}</span><span className={late ? 'ds-kcard__late' : undefined}>{late ? `${time} · vencido` : time}</span></span>
    </button>
  );
}
