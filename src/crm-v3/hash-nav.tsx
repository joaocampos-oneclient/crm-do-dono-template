"use client";

/**
 * Navegação por hash compatível com a casca CRM v3 (produção usa App Router).
 * Paths no estilo produção: #/, #/funil, #/conversas?c=…, #/contatos/:id.
 */
import * as React from "react";

export function lerHashPath(): string {
  if (typeof window === "undefined") return "/";
  const raw = window.location.hash.replace(/^#/, "") || "/";
  return raw.startsWith("/") ? raw : `/${raw}`;
}

export function pathSemQuery(path: string): string {
  return path.split("?")[0] || "/";
}

export function queryDoHash(path = lerHashPath()): URLSearchParams {
  const q = path.includes("?") ? path.slice(path.indexOf("?") + 1) : "";
  return new URLSearchParams(q);
}

export function irPara(href: string) {
  const h = href.startsWith("#") ? href : href.startsWith("/") ? `#${href}` : `#/${href}`;
  if (window.location.hash === h) {
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    return;
  }
  window.location.hash = h;
}

export function useCrmPath(): string {
  const [path, setPath] = React.useState(lerHashPath);
  React.useEffect(() => {
    const on = () => setPath(lerHashPath());
    on();
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return path;
}

export function useCrmRouter() {
  return React.useMemo(
    () => ({
      push: (href: string) => irPara(href),
      replace: (href: string) => {
        const h = href.startsWith("#") ? href.slice(1) : href.startsWith("/") ? href : `/${href}`;
        window.location.replace(`${window.location.pathname}${window.location.search}#${h}`);
      },
      refresh: () => window.dispatchEvent(new HashChangeEvent("hashchange")),
      back: () => window.history.back(),
    }),
    [],
  );
}

/** Drop-in de next/link para telas CRM v3 em modo hash. */
export function CrmLink({
  href,
  children,
  className,
  style,
  onClick,
  ...rest
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const alvo = href.startsWith("#") ? href : href.startsWith("/") ? `#${href}` : `#/${href}`;
  return (
    <a
      href={alvo}
      className={className}
      style={style}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        irPara(alvo);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
