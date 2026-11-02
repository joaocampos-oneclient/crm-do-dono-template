/**
 * Tema sem flash. Preferência: 'light' | 'dark' | 'system' (padrão 'system'), salva em localStorage.
 *
 * Aqui o tema vive no wrapper `.ds-root` (não no <html>).
 * Veja src/main.tsx:
 *
 *   <div className="ds-root" suppressHydrationWarning>
 *     <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
 *     {children}
 *   </div>
 *
 * `suppressHydrationWarning` no wrapper: o script muda data-theme antes da hidratação.
 * Se usar CSP com nonce, passe o nonce no <script>.
 */
export type ThemePreference = 'light' | 'dark' | 'system';
export const THEME_KEY = 'ds-theme';

export const themeInitScript = `(function(){var k='${THEME_KEY}',t='light';try{var p=localStorage.getItem(k)||'system';t=(p==='dark'||(p==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches))?'dark':'light';}catch(_){}var n=document.querySelectorAll('.ds-root');for(var i=0;i<n.length;i++){n[i].setAttribute('data-theme',t);n[i].style.colorScheme=t;}})();`;

export function resolveTheme(pref: ThemePreference): 'light' | 'dark' {
  if (pref === 'system') return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  return pref;
}

/** Aplica e salva. Chame no clique do seletor de tema. Só no cliente. */
export function setTheme(pref: ThemePreference): void {
  try { window.localStorage.setItem(THEME_KEY, pref); } catch { /* storage bloqueado: segue sem persistir */ }
  const t = resolveTheme(pref);
  document.querySelectorAll<HTMLElement>('.ds-root').forEach((el) => {
    el.setAttribute('data-theme', t);
    el.style.colorScheme = t;
  });
}

export function getThemePreference(): ThemePreference {
  try { const v = window.localStorage.getItem(THEME_KEY); return v === 'light' || v === 'dark' ? v : 'system'; } catch { return 'system'; }
}

/** Reage à mudança do sistema quando a preferência é 'system'. Retorna a função de limpeza. */
export function watchSystemTheme(): () => void {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const on = () => { if (getThemePreference() === 'system') setTheme('system'); };
  mq.addEventListener('change', on);
  return () => mq.removeEventListener('change', on);
}
