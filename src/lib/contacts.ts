/** Roles, products and the rest come from Configurações. */

export const TEMPLATE_COLUMNS = ["Instituição", "Nome completo", "DDI", "Telefone", "E-mail", "Cargo", "Papel", "Produto"] as const;

export const DDI_RULES: Record<string, { digits: number[]; example: string }> = {
  "+55": { digits: [10, 11], example: "(11) 98765-4321" },
  "+52": { digits: [10], example: "55 1234 5678" },
};

/** Builds +<ddi><national> from a DDI and a typed national number. Returns null when it does not match the country rule. */
export function toIntlPhone(ddi: string, national: string): string | null {
  const code = ddi.startsWith("+") ? ddi : "+" + ddi.replace(/\D/g, "");
  let digits = national.replace(/\D/g, "");
  const cc = code.slice(1);
  if (digits.startsWith(cc) && digits.length > Math.max(...(DDI_RULES[code]?.digits ?? [15]))) digits = digits.slice(cc.length);
  const rule = DDI_RULES[code];
  if (rule) return rule.digits.includes(digits.length) ? code + digits : null;
  return digits.length >= 8 && digits.length <= 13 ? code + digits : null;
}

/** Splits a stored international phone into DDI and national digits. */
export function splitPhone(intl: string | null | undefined): { ddi: string; national: string } {
  if (!intl) return { ddi: "+55", national: "" };
  for (const ddi of Object.keys(DDI_RULES)) if (intl.startsWith(ddi)) return { ddi, national: intl.slice(ddi.length) };
  const m = /^(\+\d{1,3})(\d+)$/.exec(intl);
  return m ? { ddi: m[1], national: m[2] } : { ddi: "+55", national: intl.replace(/\D/g, "") };
}

/** Formats national digits as the user types or for display. */
export function formatNational(ddi: string, raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (ddi === "+55") {
    if (d.length <= 2) return d.length ? `(${d}` : "";
    const area = d.slice(0, 2);
    const rest = d.slice(2, 11);
    if (rest.length <= 4) return `(${area}) ${rest}`;
    const cut = rest.length === 9 ? 5 : 4;
    return `(${area}) ${rest.slice(0, cut)}-${rest.slice(cut)}`;
  }
  if (ddi === "+52") {
    const x = d.slice(0, 10);
    return [x.slice(0, 2), x.slice(2, 6), x.slice(6)].filter(Boolean).join(" ");
  }
  return d;
}

/** Display format used everywhere: DDI plus formatted national number. */
export function formatPhone(intl: string | null | undefined): string {
  if (!intl) return "";
  const { ddi, national } = splitPhone(intl);
  return `${ddi} ${formatNational(ddi, national)}`;
}

/** Legacy helper: normalizes loose input. Brazilian numbers without country code get +55. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  if (trimmed.startsWith("+")) return "+" + digits;
  if (digits.length === 10 || digits.length === 11) return "+55" + digits;
  return "+" + digits;
}

export function isValidPhone(p: string | null): boolean {
  if (!p) return false;
  if (p.startsWith("+55")) return /^\+55\d{10,11}$/.test(p);
  if (p.startsWith("+52")) return /^\+52\d{10}$/.test(p);
  return /^\+\d{9,15}$/.test(p);
}

export function isValidEmail(e: string | null): boolean {
  if (!e) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@.]+$/.test(e.trim());
}

export type ImportRow = {
  institution: string;
  full_name: string;
  ddi: string;
  phone: string;
  email: string;
  job_title: string;
  role: string;
  product: string;
};

export const splitProducts = (s: string) => s.split(/[;,]/).map((x) => x.trim()).filter(Boolean);

const eq = (a: string, b: string) => a.trim().toLocaleLowerCase("pt-BR") === b.trim().toLocaleLowerCase("pt-BR");

export function validateRow(r: ImportRow, lists: { roles: string[]; products: string[] }): string[] {
  const errs: string[] = [];
  if (!r.institution.trim()) errs.push("Instituição vazia");
  if (!r.full_name.trim()) errs.push("Nome vazio");
  if (!r.role.trim()) errs.push("Papel vazio");
  else if (!lists.roles.some((x) => eq(x, r.role))) errs.push("Papel fora da lista");
  const bad = splitProducts(r.product).filter((p) => !lists.products.some((x) => eq(x, p)));
  if (bad.length) errs.push(`Produto fora da lista: ${bad.join(", ")}`);
  if (!isValidEmail(r.email)) errs.push("E-mail inválido");
  if (!toIntlPhone(r.ddi.trim() || "+55", r.phone)) errs.push("Telefone fora do padrão");
  return errs;
}

export function fillTemplate(tpl: string, vars: { nome: string; instituicao: string; link: string }) {
  return tpl
    .replaceAll("{nome}", vars.nome)
    .replaceAll("{instituição}", vars.instituicao)
    .replaceAll("{instituicao}", vars.instituicao)
    .replaceAll("{link}", vars.link);
}

export function firstName(full: string) {
  return full.trim().split(/\s+/)[0] ?? full;
}
