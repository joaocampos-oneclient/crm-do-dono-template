/** Máscaras PII leves (sem dependência do grokbot). */
export function buscaRevelaContato(q: string): boolean {
  const t = q.trim();
  if (t.length < 3) return false;
  if (/[0-9@+]/.test(t)) return false;
  if (!/[\p{L}]/u.test(t)) return false;
  return true;
}

export function mascararEmailCrm(email: string | null | undefined): string {
  if (!email) return "—";
  const [u, d] = email.split("@");
  if (!d) return "***";
  return `${(u ?? "").slice(0, 2)}***@${d}`;
}

export function mascararWhatsappCrm(whatsapp: string | null | undefined): string {
  if (!whatsapp) return "—";
  const d = whatsapp.replace(/\D/g, "");
  if (d.length < 4) return "***";
  return `***${d.slice(-4)}`;
}

export function contatoPublico<T extends { email: string | null; whatsapp: string | null }>(
  c: T,
  revelar: boolean,
): T & { mascarado: boolean } {
  if (revelar) return { ...c, mascarado: false };
  return {
    ...c,
    email: c.email ? mascararEmailCrm(c.email) : null,
    whatsapp: c.whatsapp ? mascararWhatsappCrm(c.whatsapp) : null,
    mascarado: true,
  };
}

export function hrefContatoPermitido(_href: string, revelou: boolean): boolean {
  return revelou;
}
