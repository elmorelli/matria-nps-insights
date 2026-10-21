export const ROLES = ["Sponsor", "Estratégico", "Champion", "Hero User"] as const;
export const STAGES = ["Handoff", "Implantação", "Go-live", "Sustentação"] as const;
export type Role = (typeof ROLES)[number];
export type Stage = (typeof STAGES)[number];

export const TEMPLATE_COLUMNS = [
  "Instituição",
  "Nome completo",
  "Telefone",
  "E-mail",
  "Cargo",
  "Papel",
  "Produto",
  "Estágio MOM",
  "Observações",
] as const;

/** Normalizes a phone to +<country><area><number>. Brazilian numbers without country code get +55. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  if (trimmed.startsWith("+")) return "+" + digits;
  if (digits.startsWith("00")) return "+" + digits.slice(2);
  if (digits.length === 10 || digits.length === 11) return "+55" + digits;
  return "+" + digits;
}

export function isValidPhone(p: string | null): boolean {
  if (!p) return true;
  // Brazil: +55 + 2-digit area + 8/9 digits. Mexico: +52 + 10 digits. Others: 8-15 digits.
  if (p.startsWith("+55")) return /^\+55\d{10,11}$/.test(p);
  if (p.startsWith("+52")) return /^\+52\d{10}$/.test(p);
  return /^\+\d{8,15}$/.test(p);
}

export function isValidEmail(e: string | null): boolean {
  if (!e) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export type ImportRow = {
  institution: string;
  full_name: string;
  phone: string;
  email: string;
  job_title: string;
  role: string;
  product: string;
  stage: string;
  notes: string;
};

export function validateRow(r: ImportRow): string[] {
  const errs: string[] = [];
  if (!r.institution.trim()) errs.push("Instituição vazia");
  if (!r.full_name.trim()) errs.push("Nome vazio");
  if (!r.phone.trim() && !r.email.trim()) errs.push("Informe telefone ou e-mail");
  if (r.role.trim() && !ROLES.includes(r.role.trim() as Role)) errs.push("Papel fora da lista");
  if (!r.role.trim()) errs.push("Papel vazio");
  if (r.product.trim() && !STAGES.includes(r.stage.trim() as Stage)) errs.push("Estágio fora da lista");
  if (!isValidEmail(r.email.trim() || null)) errs.push("E-mail inválido");
  if (!isValidPhone(normalizePhone(r.phone))) errs.push("Telefone fora do padrão");
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
