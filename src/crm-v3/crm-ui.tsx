"use client";

/**
 * CRM v3 · componentes base. Estilo por variáveis do DS 2027 + extras.
 * Port do export Claude Design. Só entra em tela quando CRM_V3=1.
 */
import * as React from "react";
import { indiceEtapa, type StageIndex } from "@/lib/crm/etapas-chip";

export type AgentId = "scout" | "scribe" | "ledger" | "pilot" | "echo" | "ember";
export type Owner = AgentId | "claudio" | "otavio" | "joao" | "guilherme";
export type Thermo = "frio" | "morno" | "quente";
export const STAGES = ["Novo", "Cláudio", "Handoff", "Briefing", "Proposta", "Oferta", "Pago", "Dentro"] as const;
export type { StageIndex };
export { indiceEtapa };

const ICONS = {
  today: ["M3 10.5 12 3l9 7.5", "M5 9v11h14V9"],
  funnel: ["M4 5h16l-6 7.5V18l-4 2v-7.5Z"],
  chat: ["M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"],
  leads: ["M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20", "M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z", "M20 20v-1.5a3.5 3.5 0 0 0-2.5-3.3", "M15.5 4.2a3.5 3.5 0 0 1 0 6.6"],
  clients: ["M15 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 3 18.5V20", "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z", "m16 11 2 2 4-4"],
  work: ["M10 6h10", "M10 12h10", "M10 18h10", "m3.5 6 1.5 1.5L7.5 5", "m3.5 12 1.5 1.5 2.5-2.5", "m3.5 18 1.5 1.5 2.5-2.5"],
  agents: ["M12 8V4H8", "M6 8h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z", "M2 14h2", "M20 14h2", "M9 13v2", "M15 13v2"],
  spark: ["M12 3c.9 3.6 2.8 5.5 6.4 6.4-3.6.9-5.5 2.8-6.4 6.4-.9-3.6-2.8-5.5-6.4-6.4 3.6-.9 5.5-2.8 6.4-6.4Z", "M18.5 16.5v4", "M16.5 18.5h4"],
  demand: ["m3 17 6-6 4 4 8-8", "M14 7h7v7"],
  score: ["M4 20V11", "M10 20V5", "M16 20v-6", "M21 20H3"],
  goals: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z", "M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"],
  more: ["M5 12h.01", "M12 12h.01", "M19 12h.01"],
  search: ["M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z", "m20 20-3.5-3.5"],
  bell: ["M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9", "M10.3 21a1.9 1.9 0 0 0 3.4 0"],
  delegate: ["M15 17l5-5-5-5", "M4 18v-2a4 4 0 0 1 4-4h12"],
  phone: ["M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"],
  chevronDown: ["m6 9 6 6 6-6"],
  chevronRight: ["m9 6 6 6-6 6"],
  close: ["M18 6 6 18", "m6 6 12 12"],
} as const;
export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 18, label }: { name: IconName; size?: number; label?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ flex: "none" }}
    >
      {ICONS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

export function AgentGlyph({ agent, size = 14 }: { agent: AgentId | "claudio"; size?: number }) {
  if (agent === "claudio") {
    return (
      <span
        aria-hidden
        style={{
          width: size + 2,
          height: size + 2,
          borderRadius: "50%",
          background: "var(--orb)",
          display: "inline-block",
          flex: "none",
        }}
      />
    );
  }
  const c = agent === "ember" ? "var(--ag-ember, #d97706)" : `var(--ag-${agent})`;
  const shape = {
    scout: <circle cx={8} cy={8} r={5} fill="none" stroke={c} strokeWidth={2} />,
    scribe: <path d="M8 2.5 13.5 8 8 13.5 2.5 8Z" fill={c} />,
    ledger: <path d="M4 13V7a4 4 0 0 1 8 0v6" fill="none" stroke={c} strokeWidth={2} />,
    pilot: <path d="M8 2.5 14 13H2Z" fill={c} />,
    echo: <path d="M8 1.8 13.4 4.9v6.2L8 14.2 2.6 11.1V4.9Z" fill={c} />,
    ember: <path d="M8 1.6c1.1 3 2.7 4.6 5.7 5.7-3 1.1-4.6 2.7-5.7 5.7-1.1-3-2.7-4.6-5.7-5.7 3-1.1 4.6-2.7 5.7-5.7Z" fill={c} />,
  }[agent];
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 16 16" style={{ flex: "none" }}>
      {shape}
    </svg>
  );
}

const OWNER_NAME: Record<Owner, string> = {
  scout: "Scout",
  scribe: "Scribe",
  ledger: "Ledger",
  pilot: "Pilot",
  echo: "Echo",
  ember: "Ember",
  claudio: "Cláudio",
  otavio: "Otávio",
  joao: "João",
  guilherme: "Guilherme",
};

export function ownerName(owner: Owner): string {
  return OWNER_NAME[owner];
}

export function AgentBadge({ owner }: { owner: Owner }) {
  const person = owner === "otavio" || owner === "joao" || owner === "guilherme";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 26,
        padding: "0 10px 0 6px",
        borderRadius: 999,
        background: "var(--bg-2)",
        font: "500 12px var(--font-sans)",
      }}
    >
      {person ? (
        <Avatar initials={OWNER_NAME[owner].slice(0, 2).toUpperCase()} size={16} ink />
      ) : (
        <AgentGlyph agent={owner as AgentId | "claudio"} size={12} />
      )}
      {OWNER_NAME[owner]}
    </span>
  );
}

export function Avatar({ initials, size = 32, ink }: { initials: string; size?: number; ink?: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: ink ? "var(--fg)" : "var(--bg-2)",
        color: ink ? "var(--bg)" : "var(--fg)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        font: `${ink ? 600 : 500} ${Math.round(size * 0.38)}px var(--font-${ink ? "mono" : "sans"})`,
        flex: "none",
      }}
    >
      {initials}
    </span>
  );
}

type BtnVariant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  variant = "primary",
  loading,
  style,
  children,
  ...rest
}: React.ComponentProps<"button"> & { variant?: BtnVariant; loading?: boolean }) {
  const v: Record<BtnVariant, React.CSSProperties> = {
    primary: { background: "var(--fg)", color: "var(--bg)", border: 0 },
    secondary: { background: "var(--surface)", color: "var(--fg)", border: "1px solid var(--hairline-2)" },
    ghost: { background: "transparent", color: "var(--fg-2)", border: 0 },
    danger: { background: "transparent", color: "var(--fg)", border: "1px solid var(--fg)", fontWeight: 600 },
  };
  return (
    <button
      type="button"
      {...rest}
      aria-busy={loading || undefined}
      disabled={rest.disabled || loading}
      style={{
        minHeight: "var(--touch)",
        padding: "0 16px",
        borderRadius: "var(--r-btn)",
        font: "500 14px var(--font-sans)",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        opacity: rest.disabled ? 0.4 : 1,
        transition: "opacity var(--dur-1) var(--ease-out)",
        ...v[variant],
        ...style,
      }}
    >
      {loading ? (
        <span
          aria-hidden
          style={{
            width: 16,
            height: 16,
            borderRadius: "50%",
            border: "2px solid currentColor",
            borderRightColor: "transparent",
            animation: "crm-spin .8s linear infinite",
          }}
        />
      ) : (
        children
      )}
    </button>
  );
}

export function StageChip({ stage, lost }: { stage: StageIndex; lost?: boolean }) {
  const fact = stage >= 6;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 24,
        padding: "0 9px",
        borderRadius: 999,
        whiteSpace: "nowrap",
        font: "500 11px var(--font-sans)",
        background: lost ? "transparent" : fact ? "var(--verde-wash)" : "var(--bg-2)",
        color: fact ? "var(--verde-ink)" : "var(--fg)",
        border: lost ? "1px solid var(--fg)" : "1px solid transparent",
      }}
    >
      {lost ? "Perdida" : STAGES[stage]}
    </span>
  );
}

export function SegmentBar({
  total,
  filled,
  height = 6,
  color = "var(--fg)",
  label,
}: {
  total: number;
  filled: number;
  height?: number;
  color?: string;
  label?: string;
}) {
  return (
    <div role="img" aria-label={label ?? `${filled} de ${total}`} style={{ display: "flex", gap: 2, height }}>
      {Array.from({ length: total }, (_, i) => (
        <i key={i} style={{ flex: 1, borderRadius: 1, background: i < filled ? color : "var(--hairline-2)" }} />
      ))}
    </div>
  );
}

export function Thermometer({ value }: { value?: Thermo }) {
  const n = value ? { frio: 1, morno: 2, quente: 3 }[value] : 0;
  return (
    <span role="img" aria-label={value ? `Interesse ${value}` : "Sem interesse informado"} style={{ display: "inline-flex", gap: 2 }}>
      {[0, 1, 2].map((i) => (
        <i key={i} style={{ width: 10, height: 6, borderRadius: 1, background: i < n ? "var(--fg)" : "var(--hairline-2)" }} />
      ))}
    </span>
  );
}

export function Sparkline({ values, height = 24, highlightLast = true }: { values: number[]; height?: number; highlightLast?: boolean }) {
  const w = 120;
  const mx = Math.max(...values, 0);
  const mn = Math.min(...values, 0);
  const pts =
    values.length < 2
      ? ([[0, height / 2], [w, height / 2]] as const)
      : values.map((v, i) => [(i * w) / (values.length - 1), height - 3 - ((v - mn) / (mx - mn || 1)) * (height - 6)] as const);
  const last = pts[pts.length - 1];
  return (
    <svg aria-hidden viewBox={`0 0 ${w} ${height}`} width="100%" height={height} preserveAspectRatio="none">
      <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke="var(--fg)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      {highlightLast && last && <circle cx={last[0] - 2} cy={last[1]} r={2.5} fill="var(--verde)" />}
    </svg>
  );
}

export function NewFieldMark() {
  return (
    <span
      title="Campo novo: ainda não existe no banco"
      aria-label="campo novo"
      style={{ width: 6, height: 6, borderRadius: "50%", border: "1px solid var(--fg-3)", display: "inline-block", flex: "none" }}
    />
  );
}

export function KpiCard({
  label,
  value,
  unit,
  caption,
  isNew,
  chart,
}: {
  label: string;
  value: string;
  unit?: string;
  caption?: string;
  isNew?: boolean;
  chart?: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "var(--surface)",
        borderRadius: "var(--r-kpi)",
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
        <span className="crm-label">{label}</span>
        {isNew && <NewFieldMark />}
      </div>
      <span className="crm-num" style={{ font: "500 22px/1 var(--font-mono)" }}>
        {value}
        {unit && <span style={{ fontSize: 11, color: "var(--fg-3)", letterSpacing: 0 }}>{unit}</span>}
      </span>
      {chart}
      {caption && <span style={{ font: "400 10px var(--font-mono)", color: "var(--fg-3)" }}>{caption}</span>}
    </div>
  );
}

export type Approval =
  | { kind: "handoff"; author: "claudio"; title: string; lead: string; context: string[]; preview: string; source: string; sla: string }
  | { kind: "suggestion"; author: AgentId; title: string; lead: string; preview?: string; stageChange?: [StageIndex, StageIndex]; source: string; confidence: number };

export function ApprovalCard({
  item,
  onPrimary,
  onEdit,
  onSkip,
  onReassign,
}: {
  item: Approval;
  onPrimary: () => void;
  onEdit?: () => void;
  onSkip: () => void;
  onReassign?: () => void;
}) {
  const hand = item.kind === "handoff";
  return (
    <article
      style={{
        border: "1px solid var(--hairline-2)",
        borderRadius: "var(--r-card)",
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 9,
        background: hand ? "linear-gradient(var(--verde-wash),var(--verde-wash)),var(--surface)" : "var(--surface)",
        animation: "crm-in var(--dur-3) var(--ease-out) both",
      }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 8, font: "400 12px var(--font-sans)", color: "var(--fg-2)" }}>
        <AgentGlyph agent={item.author} size={14} />
        <b style={{ fontWeight: 500, color: "var(--fg)" }}>{OWNER_NAME[item.author]}</b>
        <span style={{ marginLeft: "auto", font: "500 10px var(--font-mono)", letterSpacing: ".1em", color: hand ? "var(--verde-ink)" : "var(--fg-3)" }}>
          {hand ? item.sla : "SUGESTÃO"}
        </span>
      </header>
      <h3 style={{ margin: 0, font: "520 16px/1.25 var(--font-sans)", letterSpacing: "-.01em" }}>{item.title}</h3>
      <p style={{ margin: 0, font: "400 12px var(--font-sans)", color: "var(--fg-2)" }}>{item.lead}</p>
      {hand && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {item.context.map((c) => (
            <span
              key={c}
              style={{
                height: 24,
                padding: "0 8px",
                borderRadius: 999,
                border: "1px solid var(--hairline)",
                display: "inline-flex",
                alignItems: "center",
                font: "500 11px var(--font-mono)",
              }}
            >
              {c}
            </span>
          ))}
        </div>
      )}
      {item.preview && (
        <div style={{ background: "var(--bg-2)", borderRadius: 12, padding: "10px 12px", font: "400 13px/1.45 var(--font-sans)" }}>{item.preview}</div>
      )}
      {!hand && item.stageChange && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg-2)", borderRadius: 12, padding: "10px 12px" }}>
          <StageChip stage={item.stageChange[0]} />
          <span aria-hidden>→</span>
          <StageChip stage={item.stageChange[1]} />
        </div>
      )}
      <p style={{ margin: 0, font: "400 11px var(--font-sans)", color: "var(--fg-3)" }}>
        Fonte: {item.source}
        {!hand && ` · Confiança ${item.confidence}%`}
      </p>
      <footer style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        <Button onClick={onPrimary}>{hand ? "Assumir conversa" : item.stageChange ? "Aprovar" : "Aprovar e enviar"}</Button>
        {onEdit && (
          <Button variant="secondary" onClick={onEdit}>
            Editar
          </Button>
        )}
        <Button variant="ghost" onClick={onSkip}>
          Pular
        </Button>
        {onReassign && (
          <Button variant="ghost" onClick={onReassign}>
            Reatribuir
          </Button>
        )}
      </footer>
    </article>
  );
}

export type AgentMode = "suggest" | "ask" | "auto";

export function ModeSelector({ agent, value, onChange }: { agent: AgentId; value: AgentMode; onChange: (m: AgentMode) => void }) {
  const opts: [AgentMode, string][] = [
    ["suggest", "Só sugerir"],
    ["ask", "Perguntar antes"],
    ["auto", "Automático"],
  ];
  return (
    <div role="radiogroup" aria-label={`Modo do ${OWNER_NAME[agent]}`} style={{ display: "flex", padding: 3, borderRadius: 12, background: "var(--bg-2)", gap: 2 }}>
      {opts.map(([id, l]) => {
        const off = agent === "ledger" && id === "auto";
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={value === id}
            aria-disabled={off || undefined}
            onClick={() => !off && onChange(id)}
            style={{
              flex: 1,
              minHeight: 40,
              border: 0,
              borderRadius: 10,
              background: value === id ? "var(--surface)" : "transparent",
              color: value === id ? "var(--fg)" : "var(--fg-2)",
              font: `${value === id ? 600 : 500} 12px var(--font-sans)`,
              boxShadow: value === id ? "0 0 0 1px var(--hairline-2)" : "none",
              opacity: off ? 0.4 : 1,
              textDecoration: off ? "line-through" : "none",
              cursor: off ? "not-allowed" : "pointer",
            }}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}

export function TimelineItem({
  who,
  author,
  action,
  detail,
  time,
  tag,
}: {
  who: Owner | string;
  author: string;
  action: string;
  detail?: string;
  time: string;
  tag: string;
}) {
  const isAgent = ["scout", "scribe", "ledger", "pilot", "echo", "ember", "claudio"].includes(who);
  return (
    <li
      style={{
        display: "grid",
        gridTemplateColumns: "22px 1fr auto",
        gap: 10,
        padding: "10px 0",
        borderTop: "1px solid var(--hairline)",
        alignItems: "start",
        listStyle: "none",
      }}
    >
      {isAgent ? <AgentGlyph agent={who as AgentId | "claudio"} size={14} /> : <Avatar initials={String(who).slice(0, 2).toUpperCase()} size={22} />}
      <div>
        <div style={{ font: "400 13px/1.4 var(--font-sans)" }}>
          <b style={{ fontWeight: 500 }}>{author}</b> {action}
        </div>
        {detail && <div style={{ font: "400 12px var(--font-sans)", color: "var(--fg-2)", marginTop: 2 }}>{detail}</div>}
        <div className="crm-label" style={{ marginTop: 4, fontSize: 9 }}>
          {tag}
        </div>
      </div>
      <time style={{ font: "400 11px var(--font-mono)", color: "var(--fg-3)" }}>{time}</time>
    </li>
  );
}

export type TabId = "today" | "funnel" | "chat" | "leads" | "more";
const TABS: [TabId, string, IconName][] = [
  ["today", "Hoje", "today"],
  ["funnel", "Funil", "funnel"],
  ["chat", "Conversas", "chat"],
  ["leads", "Leads", "leads"],
  ["more", "Mais", "more"],
];

export function BottomBar({
  active,
  badges = {},
  onSelect,
}: {
  active: TabId;
  badges?: Partial<Record<TabId, number>>;
  onSelect: (id: TabId) => void;
}) {
  return (
    <nav
      aria-label="Navegação principal"
      className="crm-glass-bar"
      style={{
        position: "fixed",
        insetInline: 0,
        bottom: 0,
        display: "flex",
        padding: "6px 4px calc(24px + env(safe-area-inset-bottom))",
        borderTop: "1px solid var(--hairline)",
        zIndex: 30,
      }}
    >
      {TABS.map(([id, label, icon]) => (
        <button
          key={id}
          type="button"
          aria-current={active === id ? "page" : undefined}
          onClick={() => onSelect(id)}
          style={{
            flex: 1,
            minHeight: 52,
            border: 0,
            background: "transparent",
            color: active === id ? "var(--fg)" : "var(--fg-3)",
            font: `${active === id ? 600 : 500} 11px var(--font-sans)`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            cursor: "pointer",
          }}
        >
          <span style={{ position: "relative", display: "flex" }}>
            <Icon name={icon} size={22} />
            {!!badges[id] && (
              <span
                style={{
                  position: "absolute",
                  top: -4,
                  right: -8,
                  minWidth: 15,
                  height: 15,
                  padding: "0 3px",
                  borderRadius: 99,
                  background: "var(--fg)",
                  color: "var(--bg)",
                  font: "600 9px/15px var(--font-mono)",
                  textAlign: "center",
                }}
              >
                {badges[id]}
              </span>
            )}
          </span>
          {label}
        </button>
      ))}
    </nav>
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const ref = React.useRef<HTMLDialogElement>(null);
  React.useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{ margin: "auto 0 0", maxWidth: "none", width: "100%", border: 0, padding: 0, background: "transparent" }}
    >
      <div
        style={{
          background: "var(--surface)",
          borderRadius: "var(--r-sheet) var(--r-sheet) 0 0",
          padding: "10px 16px calc(24px + env(safe-area-inset-bottom))",
          boxShadow: "var(--sh-sheet)",
          animation: "crm-in var(--dur-4) var(--ease-out) both",
        }}
      >
        <div aria-hidden style={{ width: 36, height: 4, borderRadius: 99, background: "var(--hairline-2)", margin: "0 auto 12px" }} />
        {children}
      </div>
    </dialog>
  );
}
