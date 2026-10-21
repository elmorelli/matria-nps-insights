import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AlertTriangle, Target, TrendingUp, Users } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from "recharts";
import { fetchContacts, fetchCycles } from "@/lib/admin-data";
import { npsOf, promotersNeeded, answersNeeded, npsBand, type Band } from "@/lib/nps";
import { ROLES } from "@/lib/contacts";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: Overview,
});

const BAND_TEXT: Record<Band, string> = { negative: "text-negative", low: "text-attention", mid: "text-info", high: "text-positive" };
const BAND_FILL: Record<Band, string> = { negative: "var(--negative)", low: "var(--attention)", mid: "var(--info)", high: "var(--positive)" };
const BAND_LABEL: Record<Band, string> = { negative: "Zona crítica", low: "Zona de aperfeiçoamento", mid: "Zona de qualidade", high: "Zona de excelência" };

function fmt(n: number | null) {
  if (n === null) return "–";
  return (n > 0 ? "+" : "") + n;
}

function Overview() {
  const { data: cycles } = useQuery({ queryKey: ["cycles"], queryFn: fetchCycles });
  const { data: contacts } = useQuery({ queryKey: ["contacts"], queryFn: fetchContacts });
  const [cycleId, setCycleId] = useState("");
  const [fRole, setFRole] = useState("");
  const [hideTest, setHideTest] = useState(false);
  const cycle = cycles?.find((c) => c.id === cycleId) ?? cycles?.find((c) => !c.closed) ?? cycles?.[0];
  const prev = cycles?.filter((c) => cycle && c.start_date < cycle.start_date).sort((a, b) => b.start_date.localeCompare(a.start_date))[0];
  const target = Number(cycle?.target_nps ?? 60);
  const targetRate = Number(cycle?.target_response_rate ?? 75);

  const m = useMemo(() => {
    const base = (contacts ?? []).filter((c) => (!fRole || c.role === fRole) && (!hideTest || !c.is_test));
    const valid = base.filter((c) => c.status === "active");
    const rows = valid.map((c) => ({ c, inv: c.invitations.find((i) => i.cycle_id === cycle?.id) }));
    const invs = rows.filter((r) => r.inv);
    const sent = invs.filter((r) => r.inv!.sent_at || ["sent", "opened", "answered"].includes(r.inv!.status));
    const opened = invs.filter((r) => r.inv!.opened_at || r.inv!.status === "answered");
    const answered = invs.filter((r) => r.inv!.status === "answered" && r.inv!.responses);
    const scores = answered.map((r) => r.inv!.responses!.q1_nps);
    const s = npsOf(scores);

    // revenue weighted
    let wSum = 0;
    let wNps = 0;
    answered.forEach((r) => {
      const rev = Number((r.c.accounts as { estimated_annual_revenue?: number } | null)?.estimated_annual_revenue ?? 0);
      if (rev > 0) {
        const sc = r.inv!.responses!.q1_nps;
        wSum += rev;
        wNps += rev * (sc >= 9 ? 100 : sc <= 6 ? -100 : 0);
      }
    });

    // per account
    const byAcc = new Map<string, number[]>();
    answered.forEach((r) => {
      const k = r.c.accounts?.name ?? "Sem instituição";
      byAcc.set(k, [...(byAcc.get(k) ?? []), r.inv!.responses!.q1_nps]);
    });
    const accounts = [...byAcc.entries()].map(([name, sc]) => ({ name, ...npsOf(sc) })).sort((a, b) => (b.nps ?? 0) - (a.nps ?? 0));

    // timeline
    const start = cycle ? new Date(cycle.start_date + "T00:00") : new Date();
    const dates = invs.flatMap((r) => [r.inv!.sent_at, r.inv!.opened_at, r.inv!.answered_at]).filter(Boolean).map((d) => new Date(d!));
    const end = new Date(Math.max(Date.now() < start.getTime() ? start.getTime() : Date.now(), ...dates.map((d) => d.getTime())));
    const days: { dia: string; Enviados: number; Abertos: number; Respondidos: number; lembrete: boolean }[] = [];
    const reminderDays = new Set(invs.flatMap((r) => [r.inv!.reminder_1_at, r.inv!.reminder_2_at, r.inv!.reminder_3_at]).filter(Boolean).map((d) => d!.slice(0, 10)));
    for (let d = new Date(start); d <= end && days.length < 60; d.setDate(d.getDate() + 1)) {
      const lim = new Date(d);
      lim.setHours(23, 59, 59);
      const cnt = (k: "sent_at" | "opened_at" | "answered_at") => invs.filter((r) => r.inv![k] && new Date(r.inv![k]!) <= lim).length;
      const iso = d.toISOString().slice(0, 10);
      days.push({ dia: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), Enviados: cnt("sent_at"), Abertos: cnt("opened_at"), Respondidos: cnt("answered_at"), lembrete: reminderDays.has(iso) });
    }

    return {
      valid: valid.length,
      generated: invs.length,
      sent: sent.length,
      opened: opened.length,
      answered: answered.length,
      s,
      weighted: wSum > 0 ? Math.round(wNps / wSum) : null,
      accounts,
      days,
      rate: valid.length ? Math.round((answered.length / valid.length) * 100) : 0,
    };
  }, [contacts, cycle, fRole, hideTest]);

  const band = m.s.nps === null ? null : npsBand(m.s.nps);
  const need = promotersNeeded(m.s, target);
  const needAns = answersNeeded(m.answered, m.valid, targetRate);
  const prevNps = prev?.reference_nps != null ? Number(prev.reference_nps) : null;
  const prevRate = prev?.reference_response_rate != null ? Number(prev.reference_response_rate) : null;
  const belowZero = m.accounts.filter((a) => (a.nps ?? 0) < 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Visão geral</p>
          <h1 className="text-2xl">{cycle?.name ?? "Sem pesquisa"}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={cycle?.id ?? ""} onChange={(e) => setCycleId(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm">
            {cycles?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select value={fRole} onChange={(e) => setFRole(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm">
            <option value="">Todos os papéis</option>
            {ROLES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={hideTest} onChange={(e) => setHideTest(e.target.checked)} /> Ocultar dados de teste
          </label>
        </div>
      </div>

      {m.s.n > 0 && m.s.n < 10 && (
        <div className="flex items-center gap-3 rounded-lg border bg-background p-4 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 text-attention" />
          Amostra pequena: {m.s.n} {m.s.n === 1 ? "resposta" : "respostas"}. Cada resposta move o NPS em muitos pontos. Leia com cautela.
        </div>
      )}

      {/* Hero: NPS vs meta */}
      <section className="grid gap-4 lg:grid-cols-5">
        <div className="rounded-xl border bg-background p-6 lg:col-span-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg">NPS do ciclo</h2>
            {band && <span className={cn("text-sm", BAND_TEXT[band])}>{BAND_LABEL[band]}</span>}
          </div>
          <div className="mt-2 grid items-center gap-6 sm:grid-cols-2">
            <Gauge value={m.s.nps} target={target} previous={prevNps} />
            <div className="space-y-5">
              <div>
                <p className="text-sm text-muted-foreground">Meta do ciclo</p>
                <p className="text-2xl font-semibold">{fmt(target)}</p>
              </div>
              <div className="rounded-lg bg-highlight p-4">
                <div className="flex items-center gap-2 text-primary">
                  <Target className="h-4 w-4" />
                  <span className="text-sm">Caminho para a meta</span>
                </div>
                <p className="mt-2">
                  {m.s.n === 0
                    ? "Aguardando as primeiras respostas."
                    : need === 0
                      ? "Meta atingida. Mantenha os promotores próximos."
                      : `Faltam ${need} ${need === 1 ? "promotor" : "promotores"} (nota 9 ou 10) sem novos detratores.`}
                </p>
              </div>
              {prevNps !== null && m.s.nps !== null && (
                <p className="flex items-center gap-2 text-sm">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  {fmt(m.s.nps - prevNps)} pontos em relação ao {prev?.name} ({fmt(prevNps)})
                </p>
              )}
              {m.weighted !== null && (
                <p className="text-sm text-muted-foreground">
                  Ponderado por receita: <span className="text-foreground">{fmt(m.weighted)}</span>. Dá mais peso às contas maiores.
                </p>
              )}
            </div>
          </div>
          <Distribution s={m.s} />
        </div>

        <div className="flex flex-col gap-4 lg:col-span-2">
          <div className="rounded-xl border bg-background p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg">Taxa de resposta</h2>
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="mt-3 text-4xl font-semibold">{m.rate}%</p>
            <p className="text-sm text-muted-foreground">
              {m.answered} de {m.valid} contatos válidos
            </p>
            <div className="relative mt-5 h-3 rounded-full bg-offwhite">
              <div className={cn("h-full rounded-full", m.rate >= targetRate ? "bg-positive" : "bg-primary")} style={{ width: `${Math.min(100, m.rate)}%` }} />
              <div className="absolute -top-1 h-5 w-0.5 bg-foreground" style={{ left: `${targetRate}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-sm text-muted-foreground">
              <span>{needAns === 0 ? "Meta atingida" : `Faltam ${needAns} respostas`}</span>
              <span>Meta {targetRate}%</span>
            </div>
            {prevRate !== null && (
              <p className="mt-3 text-sm text-muted-foreground">
                {fmt(m.rate - prevRate)} p.p. em relação ao ciclo anterior ({prevRate}%)
              </p>
            )}
          </div>
          <div className="rounded-xl border bg-background p-6">
            <h2 className="text-lg">Funil da coleta</h2>
            <Funnel
              steps={[
                ["Base válida", m.valid],
                ["Links gerados", m.generated],
                ["Enviados", m.sent],
                ["Abertos", m.opened],
                ["Respondidos", m.answered],
              ]}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-5">
        <div className="rounded-xl border bg-background p-6 lg:col-span-3">
          <h2 className="text-lg">Evolução da coleta</h2>
          <p className="text-sm text-muted-foreground">Acumulado por dia desde o início. Linhas tracejadas marcam dias de lembrete.</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={m.days} margin={{ left: -20, right: 8 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="dia" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--border)" }} />
                {m.days.filter((d) => d.lembrete).map((d) => (
                  <ReferenceLine key={d.dia} x={d.dia} stroke="var(--brand-light)" strokeDasharray="4 4" />
                ))}
                <Line type="monotone" dataKey="Enviados" stroke="#B5C4DA" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Abertos" stroke="#5F7FB0" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Respondidos" stroke="#073B84" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border bg-background p-6 lg:col-span-2">
          <h2 className="text-lg">NPS por instituição</h2>
          <p className="text-sm text-muted-foreground">Meta: todas acima de 0. Linha tracejada em {fmt(target)}.</p>
          {belowZero.length > 0 && (
            <p className="mt-3 rounded-md bg-negative-bg p-3 text-sm">
              {belowZero.length} {belowZero.length === 1 ? "instituição abaixo" : "instituições abaixo"} de 0: {belowZero.map((a) => a.name).join(", ")}
            </p>
          )}
          <div className="mt-4 space-y-3">
            {m.accounts.map((a) => (
              <AccountBar key={a.name} name={a.name} nps={a.nps ?? 0} n={a.n} target={target} />
            ))}
            {m.accounts.length === 0 && <p className="text-muted-foreground">Sem respostas ainda.</p>}
          </div>
        </div>
      </section>

      <div className="flex gap-2">
        <Link to="/admin/respostas" className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
          Ler as respostas
        </Link>
        <Link to="/admin/contatos" className="rounded-md border bg-background px-4 py-2 text-sm text-primary">
          Acompanhar envios
        </Link>
      </div>
    </div>
  );
}

function Gauge({ value, target, previous }: { value: number | null; target: number; previous: number | null }) {
  const R = 90;
  const toXY = (v: number) => {
    const a = Math.PI * (1 - (v + 100) / 200);
    return [110 + R * Math.cos(a), 110 - R * Math.sin(a)] as const;
  };
  const arc = (from: number, to: number) => {
    const [x1, y1] = toXY(from);
    const [x2, y2] = toXY(to);
    return `M ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2}`;
  };
  const band = value === null ? null : npsBand(value);
  const marker = (v: number, color: string) => {
    const a = Math.PI * (1 - (v + 100) / 200);
    const [x1, y1] = [110 + (R - 16) * Math.cos(a), 110 - (R - 16) * Math.sin(a)];
    const [x2, y2] = [110 + (R + 16) * Math.cos(a), 110 - (R + 16) * Math.sin(a)];
    return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={3} strokeLinecap="round" />;
  };
  return (
    <div className="relative mx-auto w-full max-w-xs">
      <svg viewBox="0 0 220 130" className="w-full">
        <path d={arc(-100, 100)} stroke="var(--offwhite)" strokeWidth={18} fill="none" strokeLinecap="round" />
        {value !== null && band && <path d={arc(-100, Math.max(-99.5, value))} stroke={BAND_FILL[band]} strokeWidth={18} fill="none" strokeLinecap="round" />}
        {previous !== null && marker(previous, "var(--brand-light)")}
        {marker(target, "var(--foreground)")}
      </svg>
      <div className="absolute inset-x-0 bottom-1 text-center">
        <p className={cn("text-5xl font-semibold", band ? BAND_TEXT[band] : "text-muted-foreground")}>{fmt(value)}</p>
      </div>
      <div className="mt-2 flex justify-center gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-3 w-0.5 bg-foreground" /> Meta
        </span>
        {previous !== null && (
          <span className="flex items-center gap-1">
            <span className="h-3 w-0.5 bg-brand-light" /> Ciclo anterior
          </span>
        )}
      </div>
    </div>
  );
}

function Distribution({ s }: { s: ReturnType<typeof npsOf> }) {
  if (!s.n) return null;
  const parts = [
    ["Detratores", s.detractors, "bg-negative", "0 a 6"],
    ["Neutros", s.passives, "bg-brand-light", "7 e 8"],
    ["Promotores", s.promoters, "bg-positive", "9 e 10"],
  ] as const;
  return (
    <div className="mt-6">
      <div className="flex h-3 overflow-hidden rounded-full">
        {parts.map(([l, v, c]) => (v ? <div key={l} className={c} style={{ width: `${(v / s.n) * 100}%` }} /> : null))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
        {parts.map(([l, v, c, r]) => (
          <div key={l}>
            <span className={cn("mr-2 inline-block h-2.5 w-2.5 rounded-full", c)} />
            {l} <span className="text-muted-foreground">({r})</span>
            <p className="text-lg font-semibold">
              {Math.round((v / s.n) * 100)}% <span className="text-sm font-normal text-muted-foreground">· {v}</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Funnel({ steps }: { steps: [string, number][] }) {
  const max = Math.max(1, steps[0][1]);
  return (
    <div className="mt-4 space-y-2">
      {steps.map(([label, v], i) => {
        const prev = i > 0 ? steps[i - 1][1] : null;
        return (
          <div key={label}>
            <div className="flex justify-between text-sm">
              <span>{label}</span>
              <span className="text-muted-foreground">
                {v}
                {prev ? ` · ${Math.round((v / prev) * 100)}%` : ""}
              </span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-offwhite">
              <div className="h-full rounded-full bg-primary" style={{ width: `${(v / max) * 100}%`, opacity: 0.4 + (i / steps.length) * 0.6 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AccountBar({ name, nps, n, target }: { name: string; nps: number; n: number; target: number }) {
  const pos = (v: number) => `${(v + 100) / 2}%`;
  const band = npsBand(nps);
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span className="truncate">{name}</span>
        <span className={cn(BAND_TEXT[band])}>
          {fmt(nps)} <span className="text-muted-foreground">· n={n}</span>
        </span>
      </div>
      <div className="relative mt-1 h-2 rounded-full bg-offwhite">
        <div
          className="absolute h-full rounded-full"
          style={{ left: nps >= 0 ? "50%" : pos(nps), width: `${Math.abs(nps) / 2}%`, background: BAND_FILL[band] }}
        />
        <div className="absolute -top-0.5 h-3 w-px bg-muted-foreground" style={{ left: "50%" }} />
        <div className="absolute -top-0.5 h-3 border-l border-dashed border-foreground" style={{ left: pos(target) }} />
      </div>
    </div>
  );
}
