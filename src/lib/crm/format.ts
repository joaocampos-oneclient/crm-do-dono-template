const TZ = "America/Sao_Paulo";

/** 20/10 14:35, sempre no horário de Brasília. */
export function dataHora(iso: string | Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** ISO (`2026-10-26` ou datetime) → `26/10/2026`. Vazio se não der. */
export function isoParaDataBr(iso: string | null | undefined): string {
  const t = String(iso ?? "").trim();
  if (!t) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (!m) return "";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** `26/10/2026`, `26-10-2026` ou ISO → `2026-10-26`. Vazio se não der. */
export function dataBrParaIso(br: string | null | undefined): string {
  const t = String(br ?? "").trim();
  if (!t) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/.exec(t);
  if (!m) return "";
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

/** 20/10 */
export function diaMes(iso: string | Date): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit" }).format(new Date(iso));
}

/** Iniciais para o avatar: "Ana Paula" → "AP". */
export function iniciais(nome: string): string {
  const p = nomeEmExibicao(nome).trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? (p[p.length - 1][0] ?? "") : "")).toUpperCase() || "?";
}

const PARTICULAS = new Set(["de", "da", "do", "das", "dos", "e", "di", "du"]);

/** "BRUNO CAVALCANTE NUNES" → "Bruno Cavalcante Nunes". Nomes já mistos ficam como vieram. */
export function nomeEmExibicao(nome: string): string {
  const t = nome.trim().replace(/\s+/g, " ");
  if (!t) return t;
  const letras = t.replace(/[^\p{L}]/gu, "");
  const maiusculas = [...letras].filter((c) => c === c.toUpperCase() && c !== c.toLowerCase()).length;
  const minusculas = [...letras].filter((c) => c === c.toLowerCase() && c !== c.toUpperCase()).length;
  if (letras.length > 2 && maiusculas > 0 && minusculas > 0 && maiusculas / letras.length < 0.7) return t;
  return t
    .toLocaleLowerCase("pt-BR")
    .split(" ")
    .map((p, i) => {
      if (i > 0 && PARTICULAS.has(p)) return p;
      return p.charAt(0).toLocaleUpperCase("pt-BR") + p.slice(1);
    })
    .join(" ");
}
