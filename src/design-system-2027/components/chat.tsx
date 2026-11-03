import * as React from 'react';
import { cx } from './cx';
import { Orb } from './surface';

export type Author = 'lead' | 'robo' | 'humano';
const NAMES: Record<Author, string> = { lead: 'Contato', robo: 'Robô', humano: 'Atendente' };

/**
 * Balão de chat com 3 autores. Contato à esquerda; robô e atendente à direita.
 * Robô: contorno + orbe + etiqueta roxa. Atendente: tinta. `auto` = aviso automático.
 * `selectable` liga o modo de seleção (registrar ocorrência): a linha vira um checkbox.
 */
export function ChatBubble({ author, time, tag, selectable, selected, onToggle, children }: { author: Author; time: string; tag?: string; selectable?: boolean; selected?: boolean; onToggle?: () => void; children: React.ReactNode }) {
  const body = (
    <div className={cx('ds-bubble', `ds-bubble--${author}`)}>
      {(tag || author === 'robo') && <div className="ds-bubble__tag">{author === 'robo' ? `Robô${tag ? ` · ${tag}` : ''}` : tag}</div>}
      {children}
      <div className="ds-bubble__time">{author === 'humano' ? `Atendente · ${time}` : time}</div>
    </div>
  );
  const row = (
    <>
      {selectable && <span className="ds-bubble-check" aria-hidden="true">✓</span>}
      {author === 'robo' ? <div className="ds-bubble-side"><Orb size={22} />{body}</div> : body}
    </>
  );
  if (!selectable) return <div className="ds-bubble-row">{row}</div>;
  return (
    <div role="checkbox" aria-checked={!!selected} aria-label={`${NAMES[author]} ${time}`} tabIndex={0} data-selectable="true" className="ds-bubble-row" onClick={onToggle} onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onToggle?.(); } }}>{row}</div>
  );
}
