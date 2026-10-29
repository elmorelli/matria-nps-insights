import { supabase } from "@/integrations/supabase/client";
import { npsOf, npsBand, promotersNeeded, answersNeeded, type NpsSummary, type Band } from "@/lib/nps";

/* ---------- loading ---------- */

export async function fetchAll() {
  const [cy, ac, co, inv, qs, qn, ap, ol, st] = await Promise.all([
    supabase.from("cycles").select("*").order("start_date"),
    supabase.from("accounts").select("*").order("name"),
    supabase.from("contacts").select("*, contact_products(id,product)").order("full_name"),
    supabase.from("invitations").select("*, responses(*, response_answers(*))"),
    supabase.from("questions").select("*").order("position"),
    supabase.from("questionnaires").select("*").order("version"),
    supabase.from("account_products").select("*").order("product"),
    supabase.from("option_lists").select("list,value,position,active").eq("list", "role").order("position"),
    supabase.from("settings").select("program_target_rate,program_target_nps,program_targets_set_at").eq("id", 1).maybeSingle(),
  ]);
  for (const r of [cy, ac, co, inv, qs, qn, ap, ol, st]) if (r.error) throw r.error;
  return {
    cycles: cy.data!,
    accounts: ac.data!,
    contacts: co.data!,
    invitations: inv.data!,
    questions: qs.data!,
    questionnaires: qn.data!,
    accountProducts: ap.data!,
    roles: ol.data!.map((r) => r.value),
    program: { rate: Number(st.data?.program_target_rate ?? 75), nps: Number(st.data?.program_target_nps ?? 80), setAt: st.data?.program_targets_set_at ?? null },
  };
}
export type AllData = Awaited<ReturnType<typeof fetchAll>>;
export type Cycle = AllData["cycles"][number];
export type Account = AllData["accounts"][number];
export type Contact = AllData["contacts"][number];
export type Invitation = AllData["invitations"][number];
export type QuestionRow = AllData["questions"][number];
export type AnswerVal = { num: number | null; text: string | null; nr: boolean };

export const allDataKey = ["all-data"] as const;
export const allDataQuery = { queryKey: allDataKey, queryFn: fetchAll };

/* ---------- filters ---------- */

export type Filters = { account: string; role: string; product: string; country: string; tier: string; type: string; iad: string; kae: string; showTest: boolean };
export const EMPTY_FILTERS: Filters = { account: "", role: "", product: "", country: "", tier: "", type: "", iad: "", kae: "", showTest: false };
export const FILTER_KEYS = ["account", "role", "product", "country", "tier", "type", "iad", "kae"] as const;
export const hasActiveFilters = (f: Filters) => FILTER_KEYS.some((k) => f[k]);

export function matches(c: Contact, acc: Account | undefined, f: Filters, _d?: unknown) {
  if (!f.showTest && c.is_test) return false;
  if (f.account && c.account_id !== f.account) return false;
  if (f.role && c.papel !== f.role) return false;
  if (f.product && !c.contact_products.some((p) => p.product === f.product)) return false;
  if (f.country && acc?.country !== f.country) return false;
  if (f.tier && acc?.tier !== f.tier) return false;
  if (f.type && acc?.segment !== f.type) return false;
  if (f.iad && acc?.iad !== f.iad) return false;
  if (f.kae && acc?.kae !== f.kae) return false;
  return true;
}

export function describeFilters(f: Filters, d: AllData) {
  const parts: string[] = [];
  if (f.account) parts.push(`Instituição: ${d.accounts.find((a) => a.id === f.account)?.name}`);
  if (f.role) parts.push(`Papel: ${f.role}`);
  if (f.product) parts.push(`Produto: ${f.product}`);
  if (f.country) parts.push(`País: ${f.country === "BR" ? "Brasil" : f.country === "MX" ? "México" : f.country}`);
  if (f.tier) parts.push(`Tier: ${f.tier}`);
  if (f.type) parts.push(`Tipo: ${f.type}`);
  if (f.iad) parts.push(`IAD: ${f.iad}`);
  if (f.kae) parts.push(`KAE: ${f.kae}`);
  parts.push(f.showTest ? "Com dados de teste" : "Sem dados de teste");
  return parts.join(" · ");
}

/* ---------- respondent model ---------- */

export type Row = {
  inv: Invitation;
  contact: Contact;
  account: Account | undefined;
  answered: boolean;
  score: number | null;
  answers: Record<string, AnswerVal>;
  reason: string;
};

function answersOf(inv: Invitation): Record<string, AnswerVal> {
  const out: Record<string, AnswerVal> = {};
  const r = inv.responses;
  if (!r) return out;
  for (const a of r.response_answers ?? []) out[a.question_key] = { num: a.value_num, text: a.value_text, nr: a.not_reached };
  out.nps ??= { num: r.q1_nps, text: null, nr: false };
  out.motivo ??= { num: null, text: r.q2_reason, nr: false };
  return out;
}

export function cycleRows(d: AllData, cycleId: string, f: Filters): Row[] {
  const cMap = new Map(d.contacts.map((c) => [c.id, c]));
  const aMap = new Map(d.accounts.map((a) => [a.id, a]));
  return d.invitations
    .filter((i) => i.cycle_id === cycleId)
    .map((inv) => {
      const contact = cMap.get(inv.contact_id)!;
      const account = contact ? aMap.get(contact.account_id) : undefined;
      const answered = inv.status === "answered" && !!inv.responses;
      return { inv, contact, account, answered, score: answered ? inv.responses!.q1_nps : null, answers: answersOf(inv), reason: inv.responses?.q2_reason ?? "" };
    })
    .filter((r) => r.contact && matches(r.contact, r.account, f, d))
    .sort((a, b) => a.contact.full_name.localeCompare(b.contact.full_name));
}

/** Valid base: invited, not invalid, contact still active. Falls back to active contacts before links exist. */
export function validBase(d: AllData, cycleId: string, f: Filters, rows: Row[]) {
  if (rows.length) return rows.filter((r) => r.inv.status !== "invalid" && r.contact.status === "active").length;
  const aMap = new Map(d.accounts.map((a) => [a.id, a]));
  return d.contacts.filter((c) => c.status === "active" && matches(c, aMap.get(c.account_id), f, d)).length;
}

/* ---------- cycle stats ---------- */

export type GroupStat = { name: string } & NpsSummary;

function groupBy(rows: Row[], keys: (r: Row) => string[]): GroupStat[] {
  const m = new Map<string, number[]>();
  rows.filter((r) => r.answered).forEach((r) => keys(r).forEach((k) => m.set(k, [...(m.get(k) ?? []), r.score!])));
  return [...m.entries()].map(([name, sc]) => ({ name, ...npsOf(sc) }));
}

export type Driver = { key: string; text: string; mean: number | null; n: number; nr: number; nrApplicable: boolean; corr: number | null };

function pearson(xs: number[], ys: number[]) {
  const n = xs.length;
  if (n < 3) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  if (!dx || !dy) return null;
  return num / Math.sqrt(dx * dy);
}

export function questionsOf(d: AllData, cycle: Cycle | undefined) {
  return d.questions.filter((q) => q.questionnaire_id === cycle?.questionnaire_id).sort((a, b) => a.position - b.position);
}

export function drivers(rows: Row[], questions: QuestionRow[]): Driver[] {
  const ans = rows.filter((r) => r.answered);
  return questions
    .filter((q) => q.kind === "likert" || q.kind === "likert_nr")
    .map((q) => {
      const pairs = ans.map((r) => [r.answers[q.key]?.num, r.score] as const).filter(([v]) => typeof v === "number") as [number, number][];
      const nr = ans.filter((r) => r.answers[q.key]?.nr).length;
      const mean = pairs.length ? pairs.reduce((a, [v]) => a + v, 0) / pairs.length : null;
      return { key: q.key, text: q.text, mean, n: pairs.length, nr, nrApplicable: q.kind === "likert_nr", corr: pearson(pairs.map((p) => p[0]), pairs.map((p) => p[1])) };
    })
    .sort((a, b) => (a.mean ?? 99) - (b.mean ?? 99));
}

export function cycleStats(d: AllData, cycle: Cycle, f: Filters) {
  const rows = cycleRows(d, cycle.id, f);
  const answered = rows.filter((r) => r.answered);
  const s = npsOf(answered.map((r) => r.score!));
  const base = validBase(d, cycle.id, f, rows);
  const hasData = answered.length > 0;
  const nps = hasData ? s.nps : cycle.reference_nps != null ? Number(cycle.reference_nps) : null;
  const rate = hasData || rows.length ? (base ? Math.round((answered.length / base) * 100) : 0) : cycle.reference_response_rate != null ? Number(cycle.reference_response_rate) : null;
  const qs = questionsOf(d, cycle);
  const hist = Array.from({ length: 11 }, (_, i) => ({ nota: String(i), n: answered.filter((r) => r.score === i).length }));
  const sent = rows.filter((r) => r.inv.sent_at || ["sent", "opened", "answered"].includes(r.inv.status)).length;
  const opened = rows.filter((r) => r.inv.opened_at || r.inv.status === "answered").length;

  let wSum = 0, wNps = 0;
  answered.forEach((r) => {
    const rev = Number(r.account?.estimated_annual_revenue ?? 0);
    if (rev > 0) {
      wSum += rev;
      wNps += rev * (r.score! >= 9 ? 100 : r.score! <= 6 ? -100 : 0);
    }
  });

  return {
    cycle,
    rows,
    answered,
    s,
    nps,
    rate,
    base,
    fromReference: !hasData && cycle.reference_nps != null,
    hist,
    funnel: [["Base válida", base], ["Links gerados", rows.length], ["Enviados", sent], ["Abertos", opened], ["Respondidos", answered.length]] as [string, number][],
    byAccount: groupBy(rows, (r) => [r.account?.name ?? "Sem instituição"]).sort((a, b) => (a.nps ?? 0) - (b.nps ?? 0)),
    byRole: rolesOf(d, rows).map((role) => groupBy(rows.filter((r) => r.contact.papel === role), () => [role])[0] ?? { name: role, ...npsOf([]) }),
    byProduct: groupBy(rows, (r) => [...new Set(r.contact.contact_products.map((p) => p.product))]).sort((a, b) => (a.nps ?? 0) - (b.nps ?? 0)),
    drivers: drivers(rows, qs),
    questions: qs,
    weighted: wSum > 0 ? Math.round(wNps / wSum) : null,
  };
}
export type CycleStats = ReturnType<typeof cycleStats>;

export function previousCycle(d: AllData, cycle: Cycle) {
  return d.cycles.filter((c) => c.start_date < cycle.start_date).sort((a, b) => b.start_date.localeCompare(a.start_date))[0];
}

/** Daily cumulative series from start_date to end_date or today, no cap. */
export function dailySeries(st: CycleStats) {
  const start = new Date(st.cycle.start_date + "T00:00");
  const today = new Date();
  const endDate = st.cycle.end_date ? new Date(st.cycle.end_date + "T00:00") : today;
  const end = endDate < today ? endDate : today;
  const reminderDays = new Set(st.rows.flatMap((r) => [r.inv.reminder_1_at, r.inv.reminder_2_at, r.inv.reminder_3_at]).filter(Boolean).map((x) => x!.slice(0, 10)));
  const out: { dia: string; Enviados: number; Abertos: number; Respondidos: number; lembrete: boolean }[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const lim = new Date(d);
    lim.setHours(23, 59, 59);
    const cnt = (k: "sent_at" | "opened_at" | "answered_at") => st.rows.filter((r) => r.inv[k] && new Date(r.inv[k]!) <= lim).length;
    out.push({ dia: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), Enviados: cnt("sent_at"), Abertos: cnt("opened_at"), Respondidos: cnt("answered_at"), lembrete: reminderDays.has(d.toISOString().slice(0, 10)) });
  }
  return out;
}

/* ---------- target rule ---------- */

export function targetFor(selected: Cycle[]) {
  if (selected.length === 1) return { nps: Number(selected[0].target_nps), rate: Number(selected[0].target_response_rate), averaged: false, label: "Meta do ciclo" };
  const n = selected.length || 1;
  return {
    nps: Math.round(selected.reduce((a, c) => a + Number(c.target_nps), 0) / n),
    rate: Math.round(selected.reduce((a, c) => a + Number(c.target_response_rate), 0) / n),
    averaged: true,
    label: "Meta média dos ciclos selecionados",
  };
}

/** Pooled view over several cycles: all answers together, rate over the summed valid base. */
export function pooled(stats: CycleStats[]) {
  const scores = stats.flatMap((s) => s.answered.map((r) => r.score!));
  const s = npsOf(scores);
  const base = stats.reduce((a, x) => a + x.base, 0);
  if (!s.n && stats.length === 1) return { nps: stats[0].nps, rate: stats[0].rate, n: 0 };
  return { nps: s.n ? s.nps : null, rate: base ? Math.round((s.n / base) * 100) : null, n: s.n };
}

/** Attainment color rule: at/above target positive, within 10 points attention, else negative. */
export function attainment(value: number | null | undefined, target: number): "positive" | "attention" | "negative" | null {
  if (value == null) return null;
  if (value >= target) return "positive";
  if (value >= target - 10) return "attention";
  return "negative";
}

/* ---------- labels ---------- */

export const BAND_LABEL: Record<Band, string> = { negative: "Zona crítica", low: "Zona de aperfeiçoamento", mid: "Zona de qualidade", high: "Zona de excelência" };
export const fmt = (n: number | null | undefined) => (n == null ? "–" : (n > 0 ? "+" : "") + n);
export const fmt1 = (n: number | null | undefined) => (n == null ? "–" : n.toFixed(1).replace(".", ","));

/* ---------- Leitura do ciclo ---------- */

export function cycleReading(st: CycleStats, prev: CycleStats | null): string[] {
  const out: string[] = [];
  const t = Number(st.cycle.target_nps);
  const tr = Number(st.cycle.target_response_rate);
  const n = st.s.n;
  if (!n) return ["Ainda não há respostas neste recorte. A leitura aparece quando a primeira resposta chegar."];
  const nps = st.s.nps!;
  const need = promotersNeeded(st.s, t);
  out.push(
    `O NPS está em ${fmt(nps)}, na ${BAND_LABEL[npsBand(nps)].toLowerCase()}. A meta do ciclo é ${fmt(t)}. ` +
      (need === 0 ? "A meta foi atingida." : `Faltam ${need} ${need === 1 ? "promotor" : "promotores"} sem novos detratores para chegar lá.`),
  );
  const missing = answersNeeded(n, st.base, tr);
  out.push(`A taxa de resposta é ${st.rate}%, com ${n} de ${st.base} contatos válidos. A meta é ${tr}%. ` + (missing ? `Faltam ${missing} respostas.` : "A meta de resposta foi atingida."));
  if (prev?.nps != null) {
    const dlt = nps - prev.nps;
    out.push(`Em relação ao ${prev.cycle.name}, o NPS ${dlt === 0 ? "ficou igual" : dlt > 0 ? `subiu ${dlt} pontos` : `caiu ${-dlt} pontos`} (era ${fmt(prev.nps)}).`);
  }
  const below = st.byAccount.filter((a) => (a.nps ?? 0) < 0);
  const low = st.byAccount.filter((a) => a.n < 2);
  if (below.length || low.length) {
    let p = "";
    if (below.length) p += `${below.length === 1 ? "Uma instituição está" : `${below.length} instituições estão`} abaixo de 0: ${below.map((a) => `${a.name} (${fmt(a.nps)})`).join(", ")}. `;
    if (low.length) p += `Com menos de 2 respostas, a cobertura é baixa em ${low.map((a) => a.name).join(", ")}.`;
    out.push(p.trim());
  }
  const dr = st.drivers.filter((x) => x.mean != null);
  if (dr.length >= 2) {
    const weak = dr.slice(0, 2);
    const strong = dr[dr.length - 1];
    out.push(`Os direcionadores com menor média são "${weak[0].text}" (${fmt1(weak[0].mean)}) e "${weak[1].text}" (${fmt1(weak[1].mean)}). O de maior média é "${strong.text}" (${fmt1(strong.mean)}).`);
  }
  const roles = st.byRole.filter((r) => r.n > 0);
  if (roles.length) {
    const worst = [...roles].sort((a, b) => (a.nps ?? 0) - (b.nps ?? 0))[0];
    let p = `O papel com menor NPS é ${worst.name} (${fmt(worst.nps)}, n=${worst.n}).`;
    const gaps: string[] = [];
    const accNames = [...new Set(st.answered.map((r) => r.account?.name ?? ""))];
    accNames.forEach((an) => {
      const rr = st.answered.filter((r) => (r.account?.name ?? "") === an);
      const vals = [...new Set(rr.map((r) => r.contact.papel ?? ""))].map((role) => npsOf(rr.filter((r) => r.contact.papel === role).map((r) => r.score!))).filter((x) => x.n > 0).map((x) => x.nps!);
      if (vals.length >= 2 && Math.max(...vals) - Math.min(...vals) > 30) gaps.push(an);
    });
    if (gaps.length) p += ` Em ${gaps.join(", ")}, a diferença entre papéis passa de 30 pontos.`;
    out.push(p);
  }
  const nrQs = st.drivers.filter((x) => x.nrApplicable);
  if (nrQs.some((x) => x.nr > 0)) {
    out.push(nrQs.map((x) => `${Math.round((x.nr / n) * 100)}% marcaram "Ainda não chegamos nesta etapa" em "${x.text}"`).join(". ") + ".");
  }
  if (n < 10) out.push(`A amostra tem ${n} ${n === 1 ? "resposta" : "respostas"}. Cada resposta move o NPS em muitos pontos.`);
  const focus = below.length ? `recuperar ${below[0].name}` : dr.length ? `trabalhar "${dr[0].text.replace(/\.$/, "")}"` : missing ? "ampliar a taxa de resposta" : "manter os promotores próximos";
  out.push(`Os dados sugerem priorizar ${focus}.`);
  return out;
}

/* ---------- answer display ---------- */

export const LIKERT = ["Discordo totalmente", "Discordo", "Neutro", "Concordo", "Concordo totalmente"];
export function answerLabel(q: Pick<QuestionRow, "kind">, a: AnswerVal | undefined) {
  if (!a) return "Sem resposta";
  if (a.nr) return "Ainda não chegamos nesta etapa";
  if (q.kind === "text") return a.text?.trim() || "Sem resposta";
  if (a.num == null) return "Sem resposta";
  if (q.kind === "nps") return String(a.num);
  return `${a.num} · ${LIKERT[a.num - 1] ?? ""}`;
}

/** Roles from Configurações plus any legacy value still on contacts. */
export function rolesOf(d: AllData, rows?: Row[]) {
  const extra = (rows ?? []).map((r) => r.contact.papel).filter(Boolean) as string[];
  return [...new Set([...d.roles, ...extra])];
}

export function distinctProducts(d: AllData) {
  return [...new Set(d.contacts.flatMap((c) => c.contact_products.map((p) => p.product)))].sort();
}

/* ---------- per institution ---------- */

export function accountHistory(d: AllData, accountId: string) {
  return [...d.cycles]
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .map((c) => {
      const st = cycleStats(d, c, { ...EMPTY_FILTERS, account: accountId });
      return { cycle: c, st, nps: st.s.n ? st.s.nps : null, rate: st.rows.length ? st.rate : null };
    });
}


