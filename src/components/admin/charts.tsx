import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, LabelList, ZAxis, Label as RLabel } from "recharts";
import { npsBand, type Band, type NpsSummary } from "@/lib/nps";
import { BAND_LABEL, fmt, fmt1, type Driver, type GroupStat } from "@/lib/analytics";
import { cn } from "@/lib/utils";

export const BAND_TEXT: Record<Band, string> = { negative: "text-negative", low: "text-attention", mid: "text-info", high: "text-positive" };
export const BAND_BG: Record<Band, string> = { negative: "bg-negative-bg", low: "bg-attention-bg", mid: "bg-highlight", high: "bg-positive-bg" };
export const BAND_FILL: Record<Band, string> = { negative: "var(--negative)", low: "var(--attention)", mid: "var(--info)", high: "var(--positive)" };
export { BAND_LABEL };

export function Card({ title, caption, children, className, right }: { title: string; caption?: string; children: React.ReactNode; className?: string; right?: React.ReactNode }) {
  return (
    <section className={cn("min-w-0 rounded-xl border bg-background p-4 sm:p-6", className)}>
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-lg">{title}</h2>
        {right}
      </div>
      {caption && <p className="text-sm text-muted-foreground">{caption}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Gauge({ value, target, previous }: { value: number | null; target: number; previous: number | null }) {
  const R = 90;
  const pt = (v: number, r = R) => {
    const a = Math.PI * (1 - (v + 100) / 200);
    return [110 + r * Math.cos(a), 110 - r * Math.sin(a)] as const;
  };
  const arc = (from: number, to: number) => {
    const [x1, y1] = pt(from);
    const [x2, y2] = pt(to);
    return `M ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2}`;
  };
  const band = value === null ? null : npsBand(value);
  const marker = (v: number, color: string) => {
    const [x1, y1] = pt(v, R - 16);
    const [x2, y2] = pt(v, R + 16);
    return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={3} strokeLinecap="round" />;
  };
  return (
    <div className="mx-auto w-full max-w-xs">
      <div className="relative">
        <svg viewBox="0 0 220 130" className="w-full">
          <path d={arc(-100, 100)} stroke="var(--offwhite)" strokeWidth={18} fill="none" strokeLinecap="round" />
          {value !== null && band && <path d={arc(-100, Math.max(-99.5, value))} stroke={BAND_FILL[band]} strokeWidth={18} fill="none" strokeLinecap="round" />}
          {previous !== null && marker(previous, "var(--brand-light)")}
          {marker(target, "var(--foreground)")}
        </svg>
        <p className={cn("absolute inset-x-0 bottom-0 text-center text-5xl font-semibold", band ? BAND_TEXT[band] : "text-muted-foreground")}>{fmt(value)}</p>
      </div>
      <div className="mt-4 flex justify-center gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-3 w-0.5 bg-foreground" /> Meta {fmt(target)}
        </span>
        {previous !== null && (
          <span className="flex items-center gap-1">
            <span className="h-3 w-0.5 bg-brand-light" /> Anterior {fmt(previous)}
          </span>
        )}
      </div>
    </div>
  );
}

export function Distribution({ s }: { s: NpsSummary }) {
  if (!s.n) return <p className="text-muted-foreground">Sem respostas ainda.</p>;
  const parts = [
    ["Detratores", s.detractors, "bg-negative", "0 a 6"],
    ["Neutros", s.passives, "bg-brand-light", "7 e 8"],
    ["Promotores", s.promoters, "bg-positive", "9 e 10"],
  ] as const;
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full">{parts.map(([l, v, c]) => (v ? <div key={l} className={c} style={{ width: `${(v / s.n) * 100}%` }} /> : null))}</div>
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

export function Histogram({ data, height = 200 }: { data: { nota: string; n: number }[]; height?: number }) {
  const color = (n: number) => (n >= 9 ? "var(--positive)" : n >= 7 ? "var(--brand-light)" : "var(--negative)");
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: -24, right: 4, top: 16 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="nota" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
          <Bar dataKey="n" isAnimationActive={false} shape={(p: { x: number; y: number; width: number; height: number; payload: { nota: string } }) => <rect x={p.x} y={p.y} width={p.width} height={p.height} rx={3} fill={color(Number(p.payload.nota))} />}>
            <LabelList dataKey="n" position="top" style={{ fontSize: 11, fill: "var(--foreground)" }} formatter={(v: number) => (v ? v : "")} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Funnel({ steps }: { steps: [string, number][] }) {
  const max = Math.max(1, steps[0][1]);
  return (
    <div className="space-y-2">
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
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (v / max) * 100)}%`, opacity: 0.4 + (i / steps.length) * 0.6 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function GroupBars({ items, target }: { items: GroupStat[]; target?: number }) {
  const pos = (v: number) => `${(v + 100) / 2}%`;
  if (!items.some((i) => i.n > 0)) return <p className="text-muted-foreground">Sem respostas ainda.</p>;
  return (
    <div className="space-y-3">
      {items.map((a) => {
        const nps = a.nps ?? 0;
        const band = npsBand(nps);
        return (
          <div key={a.name}>
            <div className="flex justify-between gap-2 text-sm">
              <span className="truncate">{a.name}</span>
              <span className={cn("shrink-0", a.n ? BAND_TEXT[band] : "text-muted-foreground")}>
                {a.n ? fmt(a.nps) : "–"} <span className="text-muted-foreground">· n={a.n}</span>
              </span>
            </div>
            <div className="relative mt-1 h-2 rounded-full bg-offwhite">
              {a.n > 0 && <div className="absolute h-full rounded-full" style={{ left: nps >= 0 ? "50%" : pos(nps), width: `${Math.abs(nps) / 2}%`, background: BAND_FILL[band] }} />}
              <div className="absolute -top-0.5 h-3 w-px bg-muted-foreground" style={{ left: "50%" }} />
              {target !== undefined && <div className="absolute -top-0.5 h-3 border-l border-dashed border-foreground" style={{ left: pos(target) }} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function DriversTable({ items }: { items: Driver[] }) {
  if (!items.length) return <p className="text-muted-foreground">Este questionário não tem perguntas de escala.</p>;
  return (
    <TableWrap>
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-subtle text-left">
          <tr>
            <th className="px-3 py-2 font-semibold">Direcionador</th>
            <th className="px-3 py-2 text-right font-semibold">Média</th>
            <th className="px-3 py-2 text-right font-semibold">n</th>
            <th className="px-3 py-2 text-right font-semibold">Ainda não</th>
          </tr>
        </thead>
        <tbody>
          {items.map((d) => (
            <tr key={d.key} className="border-t">
              <td className="min-w-56 px-3 py-2">{d.text}</td>
              <td className={cn("px-3 py-2 text-right font-semibold", d.mean != null && d.mean < 3.5 ? "text-negative" : d.mean != null && d.mean >= 4.3 ? "text-positive" : "")}>{fmt1(d.mean)}</td>
              <td className="px-3 py-2 text-right text-muted-foreground">{d.n}</td>
              <td className="px-3 py-2 text-right text-muted-foreground">{d.nrApplicable ? d.nr : "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
}

export function CorrelationChart({ items, height = 300 }: { items: Driver[]; height?: number }) {
  const data = items.filter((d) => d.mean != null && d.corr != null).map((d) => ({ x: Number(d.mean!.toFixed(2)), y: Number(d.corr!.toFixed(2)), name: d.key }));
  if (data.length < 2) return <p className="text-muted-foreground">São necessárias pelo menos 3 respostas com variação para calcular a correlação.</p>;
  const midX = data.reduce((a, b) => a + b.x, 0) / data.length;
  const midY = data.reduce((a, b) => a + b.y, 0) / data.length;
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ left: 0, right: 16, top: 16, bottom: 16 }}>
          <CartesianGrid stroke="var(--border)" />
          <XAxis type="number" dataKey="x" domain={[1, 5]} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}>
            <RLabel value="Média (1 a 5)" position="bottom" offset={0} style={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
          </XAxis>
          <YAxis type="number" dataKey="y" domain={[-1, 1]} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} width={36} />
          <ZAxis range={[80, 80]} />
          <ReferenceLine x={midX} stroke="var(--brand-light)" strokeDasharray="4 4" />
          <ReferenceLine y={midY} stroke="var(--brand-light)" strokeDasharray="4 4" />
          <ReferenceLine segment={[{ x: 1.1, y: 0.95 }, { x: 1.1, y: 0.95 }]} label={{ value: "Prioridade", position: "right", fontSize: 12, fill: "var(--negative)" }} />
          <ReferenceLine segment={[{ x: 4.2, y: 0.95 }, { x: 4.2, y: 0.95 }]} label={{ value: "Manter", position: "right", fontSize: 12, fill: "var(--positive)" }} />
          <ReferenceLine segment={[{ x: 1.1, y: -0.9 }, { x: 1.1, y: -0.9 }]} label={{ value: "Monitorar", position: "right", fontSize: 12, fill: "var(--muted-foreground)" }} />
          <ReferenceLine segment={[{ x: 3.8, y: -0.9 }, { x: 3.8, y: -0.9 }]} label={{ value: "Baixo impacto", position: "right", fontSize: 12, fill: "var(--muted-foreground)" }} />
          <Tooltip formatter={(v: number) => String(v).replace(".", ",")} contentStyle={{ borderRadius: 8, border: "1px solid var(--border)" }} />
          <Scatter data={data} fill="var(--primary)" isAnimationActive={false}>
            <LabelList dataKey="name" position="top" style={{ fontSize: 11, fill: "var(--foreground)" }} />
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Evolution({ days, height = 256 }: { days: { dia: string; Enviados: number; Abertos: number; Respondidos: number; lembrete: boolean }[]; height?: number }) {
  if (!days.length) return <p className="text-muted-foreground">O ciclo ainda não começou.</p>;
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={days} margin={{ left: -20, right: 8 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="dia" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} minTickGap={16} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
          <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--border)" }} />
          {days.filter((d) => d.lembrete).map((d) => (
            <ReferenceLine key={d.dia} x={d.dia} stroke="var(--brand-light)" strokeDasharray="4 4" />
          ))}
          <Line type="monotone" dataKey="Enviados" stroke="var(--brand-light)" strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="Abertos" stroke="var(--info)" strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="Respondidos" stroke="var(--primary)" strokeWidth={3} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TableWrap({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("max-h-[70vh] overflow-auto rounded-lg border bg-background", className)}>{children}</div>;
}

export function ScorePill({ score }: { score: number }) {
  const b = score >= 9 ? "bg-positive-bg text-positive" : score >= 7 ? "bg-highlight text-info" : "bg-negative-bg text-foreground";
  return <span className={cn("inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md font-semibold", b)}>{score}</span>;
}

export function Reading({ paragraphs }: { paragraphs: string[] }) {
  return (
    <div className="space-y-3 leading-relaxed">
      {paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}
