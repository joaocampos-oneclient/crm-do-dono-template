"use client";

import { CrmLink as Link } from "./hash-nav";
import { useCrmPath, useCrmRouter } from "./hash-nav";
import { useEffect, useMemo, useState } from "react";
import { ToastProvider } from "@/design-system-2027";
import { getThemePreference, setTheme } from "@/design-system-2027/theme-script";
import { DiscagemRapida } from "./_componentes/discagem-rapida";
import { NovaOportunidade } from "./_componentes/nova-oportunidade";
import { Avatar, BottomBar, Button, Icon, NewFieldMark, type TabId } from "./crm-ui";
import { CommandPalette } from "./command";
import { DelegarSheet } from "./delegar";
import { iniciais } from "@/lib/crm/format";
import { iniciarViewTransition } from "./motion";
import {
  gruposDoPapel,
  idAtivo,
  itensDoPapel,
  maisMobile,
  ROTULO_PAPEL,
  tabsMobile,
  type CrmPapelNav,
  type NavItem,
} from "./nav";

export type CrmV3Badges = { today?: number; chat?: number; work?: number };

function NavLink({
  item,
  atual,
  badges,
  onGo,
}: {
  item: NavItem;
  atual: string;
  badges: CrmV3Badges;
  onGo: (href: string) => void;
}) {
  const current = item.id === atual;
  const n = item.badgeKey ? badges[item.badgeKey] : 0;
  return (
    <Link
      href={item.href}
      className="crm-v3-nav__item"
      aria-current={current ? "page" : undefined}
      onClick={(e) => {
        e.preventDefault();
        onGo(item.href);
      }}
    >
      <Icon name={item.icon} size={16} />
      <span>{item.label}</span>
      {item.id === "agentes" && (
        <span className="crm-v3-nav__dots" aria-hidden>
          <i style={{ background: "var(--ag-scout)" }} />
          <i style={{ background: "var(--ag-scribe)" }} />
          <i style={{ background: "var(--ag-echo)" }} />
        </span>
      )}
      {!!n && <span className="crm-v3-nav__badge">{n}</span>}
    </Link>
  );
}

function tituloDaRota(pathBruto: string): { title: string; novo?: boolean } {
  const path = pathBruto.replace(/^\/crm(?=\/|$)/, "") || "/";
  if (path === "/") return { title: "Hoje", novo: true };
  if (path.startsWith("/funil")) return { title: "Funil" };
  if (path.startsWith("/conversas")) return { title: "Conversas" };
  if (path.startsWith("/leads")) return { title: "Leads" };
  if (path.startsWith("/clientes")) return { title: "Clientes" };
  if (path.startsWith("/trabalho")) return { title: "Trabalho" };
  if (path.startsWith("/agentes")) return { title: "Agentes" };
  if (path.startsWith("/demanda")) return { title: "Demanda" };
  if (path.startsWith("/placar") || path.startsWith("/relatorios")) return { title: "Placar" };
  if (path.startsWith("/config/metas")) return { title: "Metas" };
  if (path.startsWith("/config/sessao-fechada")) return { title: "Sessão fechada" };
  if (path.startsWith("/config/ocorrencias")) return { title: "Ocorrências" };
  if (path.startsWith("/config/integrar")) return { title: "Integrar ao GrokBot" };
  if (path.startsWith("/contatos")) return { title: "Contato" };
  if (path.startsWith("/buscar")) return { title: "Buscar" };
  if (path.startsWith("/visual")) return { title: "Hoje", novo: true };
  return { title: "CRM" };
}

export function CrmV3Shell({
  papel,
  nome,
  ligacaoLigada = false,
  badges = {},
  children,
}: {
  papel: CrmPapelNav;
  nome: string;
  ligacaoLigada?: boolean;
  badges?: CrmV3Badges;
  children: React.ReactNode;
}) {
  const path = useCrmPath();
  const router = useCrmRouter();
  const itens = useMemo(() => itensDoPapel(papel), [papel]);
  const grupos = useMemo(() => gruposDoPapel(papel), [papel]);
  const atual = idAtivo(itens, path);
  const titulo = tituloDaRota(path);
  const [cmd, setCmd] = useState(false);
  const [delegar, setDelegar] = useState(false);
  const [novo, setNovo] = useState(false);
  const [discar, setDiscar] = useState(false);
  const [mais, setMais] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const podeCriar = papel !== "trafego";
  const podeLigar = ligacaoLigada && papel !== "trafego";
  const tabs = tabsMobile(papel);
  const extra = maisMobile(papel);
  const tabAtiva: TabId =
    (tabs.find((t) => t.id === atual)?.tab as TabId | undefined) ?? (extra.some((t) => t.id === atual) ? "more" : "today");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmd(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function ir(href: string) {
    setMais(false);
    setCmd(false);
    iniciarViewTransition(() => router.push(href));
  }

  function alternarTema() {
    setTheme(getThemePreference() === "dark" ? "light" : "dark");
  }

  return (
    <ToastProvider>
      <div className="crm-v3-app">
        <aside className="crm-v3-sidebar" aria-label="Navegação">
          <Link href={papel === "trafego" ? "/demanda" : "/"} className="crm-v3-brand">
            <span className="crm-v3-brand__mark" aria-hidden />
            CRM · IA para Donos
          </Link>
          <button type="button" className="crm-v3-search" onClick={() => setCmd(true)}>
            <Icon name="search" size={16} />
            Buscar
            <kbd>⌘K</kbd>
          </button>
          <nav className="crm-v3-nav">
            {grupos.map((g) => (
              <div key={g.id} className="crm-v3-nav__group">
                {g.label && <p className="crm-label crm-v3-nav__label">{g.label}</p>}
                {g.itens.map((item) => (
                  <NavLink key={item.id} item={item} atual={atual} badges={badges} onGo={ir} />
                ))}
              </div>
            ))}
          </nav>
          <div className="crm-v3-side-foot">
            <button type="button" className="crm-v3-nav__item" onClick={alternarTema}>
              <Icon name="more" size={16} />
              Configurações
            </button>
            <div className="crm-v3-user">
              <Avatar initials={iniciais(nome)} size={32} ink />
              <div className="crm-v3-user__meta">
                <strong>{nome}</strong>
                <span>{ROTULO_PAPEL[papel]}</span>
              </div>
            </div>
          </div>
        </aside>

        <div className="crm-v3-stage">
          <header className={`crm-v3-topbar crm-glass-bar${scrolled ? " is-scrolled" : ""}`}>
            <span className="crm-v3-topbar__title">
              {titulo.title}
              {titulo.novo && <NewFieldMark />}
            </span>
            <div className="crm-v3-topbar__actions">
              {podeLigar && (
                <Button variant="ghost" onClick={() => setDiscar(true)}>
                  <Icon name="phone" size={16} />
                  Ligar
                </Button>
              )}
              <Button variant="ghost" onClick={alternarTema} aria-label="Alternar entre tema claro e escuro">
                Tema
              </Button>
              {papel !== "trafego" && (
                <Button className="crm-v3-topbar__delegar" variant="secondary" onClick={() => setDelegar(true)}>
                  Delegar
                </Button>
              )}
            </div>
          </header>

          <main className="crm-v3-content">{children}</main>
        </div>

        <div className="crm-v3-bottom">
          <BottomBar
            active={tabAtiva}
            badges={{
              today: badges.today,
              chat: badges.chat,
              more: extra.some((i) => i.id === atual) ? 1 : undefined,
            }}
            onSelect={(id) => {
              if (id === "more") {
                setMais(true);
                return;
              }
              const dest = tabs.find((t) => t.tab === id);
              if (dest) ir(dest.href);
            }}
          />
        </div>
      </div>

      {mais && (
        <div
          role="dialog"
          aria-label="Mais"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            background: "rgba(0,0,0,.4)",
            display: "flex",
            alignItems: "flex-end",
          }}
          onClick={() => setMais(false)}
        >
          <div
            className="crm-v3-surface"
            style={{ width: "100%", borderRadius: "var(--r-sheet) var(--r-sheet) 0 0", paddingBottom: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="crm-label">Mais</p>
            {extra.map((item) => (
              <button key={item.id} type="button" className="crm-v3-nav__item" onClick={() => ir(item.href)}>
                <Icon name={item.icon} size={18} />
                {item.label}
              </button>
            ))}
            {papel !== "trafego" && (
              <button type="button" className="crm-v3-nav__item" onClick={() => { setMais(false); setDelegar(true); }}>
                <Icon name="delegate" size={18} />
                Delegar
              </button>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <Button variant="ghost" onClick={alternarTema}>
                Tema
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  try {
                    window.localStorage.removeItem("crm-do-dono:operador");
                  } catch {
                    /* ignore */
                  }
                  window.location.hash = "#/";
                  window.location.reload();
                }}
              >
                Sair
              </Button>
            </div>
          </div>
        </div>
      )}

      <CommandPalette open={cmd} onClose={() => setCmd(false)} papel={papel} />
      <DelegarSheet open={delegar} onClose={() => setDelegar(false)} />
      {podeCriar && (
        <>
          <button type="button" className="crm-v3-fab" aria-label="Nova oportunidade" onClick={() => setNovo(true)}>
            +
          </button>
          <NovaOportunidade aberto={novo} aoFechar={() => setNovo(false)} />
        </>
      )}
      {podeLigar && <DiscagemRapida aberta={discar} aoFechar={() => setDiscar(false)} />}
    </ToastProvider>
  );
}
