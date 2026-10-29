import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowRight, ArrowUp, FileDown } from "lucide-react";
import { CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { allDataQuery, BAND_LABEL, EMPTY_FILTERS, cycleStats, fmt, fmt1, pooled, targetFor, type Filters } from "@/lib/analytics";
import { npsBand } from "@/lib/nps";
import { BAND_BG, BAND_TEXT, Card, GroupBars, TableWrap } from "@/components/admin/charts";
import { FiltersBar, Select, filtersToSearch } from "@/components/admin/FiltersBar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Visão geral | Matria NPS" }, { name: "robots", content: "noindex" }] }),
  component: Overview,
});

function Overview() {
  const { data: d } = useQuery(allDataQuery);
  const [f, setF] = useState<Filters>(EMPTY_FILTERS);
  const [pick, setPick] = useState(""); // "" = todos
  const picked = pick ? [pick] : [];

  const sorted = useMemo(() => [...(d?.cycles ?? [])].sort((a, b) => a.start_date.localeCompare(b.start_date)), [d]);
  const selected = picked.length ? sorted.filter((c) => picked.includes(c.id)) : sorted;
  const stats = useMemo(() => (d ? selected.map((c) => cycleStats(d, c, f)) : []), [d, selected, f]);
  const target = targetFor(selected);
  const latest = [...stats].reverse().find((s) => s.s.n > 0 || s.nps != null) ?? stats[stats.length - 1];
  const latestIdx = latest ? sorted.findIndex((c) => c.id === latest.cycle.id) : -1;
  const prevCycle = latestIdx > 0 ? sorted[latestIdx - 1] : undefined;
  const prev = d && prevCycle ? cycleStats(d, prevCycle, f) : null;

  if (!d) return <p className="text-muted-foreground">Carregando...</p>;

  const trend = stats.map((s) => ({ ciclo: s.cycle.name, NPS: s.nps, n: s.s.n, "Meta do ciclo": Number(s.cycle.target_nps), Taxa: s.rate, "Meta de resposta": Number(s.cycle.target_response_rate) }));
  const accountsWithData = d.accounts.filter((a) => !f.account || a.id === f.account);
  const heat = accountsWithData
    .map((a) => ({ a, cells: stats.map((s) => s.byAccount.find((x) => x.name === a.name) ?? null) }))
    .filter((r) => r.cells.some(Boolean))
    .sort((x, y) => {
      const lx = [...x.cells].reverse().find(Boolean)?.nps ?? 999;
      const ly = [...y.cells].reverse().find(Boolean)?.nps ?? 999;
      return lx - ly;
    });
  const driverKeys = [...new Map(stats.flatMap((s) => [...s.questions].sort((x, y) => x.position - y.position).filter((q) => q.kind === "likert" || q.kind === "likert_nr").map((q) => [q.key, q.text] as const))).entries()];
  const view = pooled(stats);
  const exportPdf = () => {
    const p = filtersToSearch(f);
    p.set("cycles", selected.map((c) => c.id).join(","));
    window.location.assign(`/admin/relatorio?${p.toString()}`);
  };
  const band = latest?.nps != null ? npsBand(latest.nps) : null;
  const latestTarget = latest ? { nps: Number(latest.cycle.target_nps), rate: Number(latest.cycle.target_response_rate) } : null;
  const setAt = selected.length ? [...selected].sort((x, y) => (y.targets_set_at ?? "").localeCompare(x.targets_set_at ?? ""))[0].targets_set_at : null;
  const totalN = stats.reduce((a, s) => a + s.s.n, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Visão geral</p>
<h1 className="text-2xl">NPS Matria</h1>
        </div>
        <Button variant="outline" onClick={exportPdf}>
          <FileDown /> Exportar PDF
        </Button>
      </div>

      <div className="space-y-3 rounded-lg border bg-background p-4">
<FiltersBar d={d} f={f} set={setF} extraActive={!!pick} onClearExtra={() => setPick("")}>
          <Select value={pick} onChange={setPick} label="Ciclo" options={[...sorted].reverse().map((c) => [c.id, c.name])} />
        </FiltersBar>
      </div>

      {!f.showTest && d.contacts.length > 0 && d.contacts.every((c) => c.is_test) && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-attention bg-background p-4 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 text-attention" />
          <span className="flex-1">Todos os contatos cadastrados hoje são de teste, por isso os números aparecem vazios. Desmarque "Ocultar dados de teste" para ver os dados de exemplo, ou importe os contatos reais em Contatos.</span>
          <Button size="sm" variant="outline" onClick={() => setF({ ...f, showTest: true })}>
            Mostrar dados de teste
          </Button>
        </div>
      )}

      {totalN > 0 && totalN < 10 && (
        <div className="flex items-center gap-3 rounded-lg border bg-background p-4 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 text-attention" /> Amostra pequena: {totalN} respostas no recorte. Leia com cautela.
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-[1fr_1fr_0.75fr]">
        <div className="rounded-xl border bg-background p-6">
          <h2 className="text-lg">NPS Matria</h2>
          <p className="text-sm text-muted-foreground">Visão para os filtros aplicados.</p>
          <Indicators nps={view.nps} rate={view.rate} n={view.n} target={target} />
        </div>
        {latest && latestTarget ? (
          <Link to="/admin/ciclos/$id" params={{ id: latest.cycle.id }} search={{ tab: "resultados" }} className="rounded-xl border bg-background p-6 hover:border-primary">
            <div className="flex items-center justify-between">
              <h2 className="text-lg">Ciclo mais recente</h2>
              <ArrowRight className="h-4 w-4 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">{latest.cycle.name}{latest.fromReference ? ". Valor de referência" : ""}</p>
            <Indicators nps={latest.nps} rate={latest.rate} n={latest.s.n} target={latestTarget} />
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <Delta label="NPS" v={prev?.nps != null && latest.nps != null ? latest.nps - prev.nps : null} unit=" pontos" />
              <Delta label="Taxa" v={prev?.rate != null && latest.rate != null ? latest.rate - prev.rate : null} unit=" p.p." />
            </div>
            {band && <p className={cn("mt-2 text-sm", BAND_TEXT[band])}>{BAND_LABEL[band]}</p>}
          </Link>
        ) : (
          <div className="rounded-xl border bg-background p-6 text-muted-foreground">Sem ciclos ainda.</div>
        )}
        <div className="rounded-xl border bg-background p-6">
          <h2 className="text-lg">Metas em uso</h2>
          <dl className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Taxa de resposta</dt><dd>≥ {target.rate}%</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-muted-foreground">NPS</dt><dd>≥ {fmt(target.nps)}</dd></div>
          </dl>
          <p className="mt-2 text-sm text-muted-foreground">
            {target.averaged ? `Média das metas de ${selected.length} ciclos.` : "Metas do ciclo selecionado."}
            {setAt && ` Definidas em ${new Date(setAt).toLocaleDateString("pt-BR")}.`}
          </p>
          <div className="mt-4 border-t pt-3 text-sm">
            <p>Meta de programa</p>
            <p className="text-muted-foreground">
              Taxa ≥ {d.program.rate}% e NPS ≥ {fmt(d.program.nps)}
              {d.program.setAt && `. Definida em ${new Date(d.program.setAt + "T00:00").toLocaleDateString("pt-BR")}`}.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card title="NPS ao longo dos ciclos" caption="Linha azul: NPS (número de respostas no ponto). Degraus: meta de cada ciclo. Tracejado: meta em uso.">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trend} margin={{ left: -16, right: 16, top: 16 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="ciclo" interval={0} padding={{ left: 40, right: 40 }} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
                <YAxis domain={[-100, 100]} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--border)" }} />
                <Line type="stepAfter" dataKey="Meta do ciclo" stroke="var(--foreground)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                <ReferenceLine y={target.nps} stroke="var(--brand-light)" strokeDasharray="6 4" />
                <Line dataKey="NPS" stroke="var(--primary)" strokeWidth={3} connectNulls isAnimationActive={false} label={({ x, y, index }: { x: number; y: number; index: number }) => (
                  <text x={x} y={y - 10} textAnchor="middle" fontSize={11} fill="var(--foreground)">{trend[index]?.NPS != null ? `${fmt(trend[index].NPS)} ${trend[index].n ? `(${trend[index].n} respostas)` : "(referência)"}` : ""}</text>
                )} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Taxa de resposta ao longo dos ciclos" caption="Degraus: meta de resposta de cada ciclo. Tracejado: meta em uso.">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trend} margin={{ left: -16, right: 16, top: 16 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="ciclo" interval={0} padding={{ left: 40, right: 40 }} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} unit="%" />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--border)" }} />
                <Line type="stepAfter" dataKey="Meta de resposta" stroke="var(--foreground)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                <ReferenceLine y={target.rate} stroke="var(--brand-light)" strokeDasharray="6 4" />
                <Line dataKey="Taxa" stroke="var(--primary)" strokeWidth={3} connectNulls isAnimationActive={false} label={{ position: "top", fontSize: 11, fill: "var(--foreground)" }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </section>

      <Card title="NPS por instituição" caption="NPS de cada instituição em cada ciclo. As que pedem atenção aparecem primeiro.">
        <TableWrap>
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-subtle text-left">
              <tr>
                <th className="sticky left-0 bg-subtle px-3 py-2 font-medium">Instituição</th>
                {stats.map((s) => (
                  <th key={s.cycle.id} className="whitespace-nowrap px-3 py-2 text-center font-medium">
                    {s.cycle.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heat.map(({ a, cells }) => (
                <tr key={a.id} className="border-t">
                  <td className="sticky left-0 whitespace-nowrap bg-background px-3 py-2">
                    <Link to="/admin/clientes/$id" params={{ id: a.id }} className="hover:underline">
                      {a.name}
                    </Link>
                  </td>
                  {cells.map((c, i) => (
                    <td key={i} className="p-1 text-center">
                      {c ? (
                        <div className={cn("rounded-md px-2 py-2", BAND_BG[npsBand(c.nps ?? 0)])}>
                          <span className={cn("font-medium", BAND_TEXT[npsBand(c.nps ?? 0)])}>{fmt(c.nps)}</span>
                          <span className="ml-1 text-xs text-muted-foreground">{c.n} respostas</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">–</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
              {heat.length === 0 && (
                <tr>
                  <td colSpan={stats.length + 1} className="px-3 py-8 text-center text-muted-foreground">
                    Sem respostas no recorte.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </TableWrap>
      </Card>

      {latest && (
        <section className="grid gap-4 lg:grid-cols-2">
          <Card title="NPS por papel" caption="Ciclo mais recente no recorte.">
            <GroupBars items={latest.byRole} target={target.nps} />
          </Card>
          <Card title="NPS por produto" caption="Ciclo mais recente no recorte.">
            <GroupBars items={latest.byProduct} target={target.nps} />
          </Card>
        </section>
      )}

      <Card title="Direcionadores ao longo dos ciclos" caption="Média de 1 a 5 por ciclo. A seta compara com o ciclo anterior.">
        {driverKeys.length ? (
          <TableWrap>
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-subtle text-left">
                <tr>
                  <th className="sticky left-0 z-10 min-w-[16rem] bg-subtle px-3 py-2 font-medium">Direcionador</th>
                  {stats.map((s) => (
                    <th key={s.cycle.id} className="whitespace-nowrap px-3 py-2 text-center font-medium">{s.cycle.name}</th>
                  ))}
                  <th className="whitespace-nowrap px-3 py-2 text-center font-medium">Variação</th>
                </tr>
              </thead>
              <tbody>
                {driverKeys.map(([k, text]) => {
                  const vals = stats.map((s) => s.drivers.find((x) => x.key === k)?.mean ?? null);
                  const known = vals.filter((v): v is number => v != null);
                  const change = known.length >= 2 ? known[known.length - 1] - known[0] : null;
                  return (
                    <tr key={k} className="border-t">
                      <td className="sticky left-0 z-[1] bg-background px-3 py-2">{text}</td>
                      {vals.map((v, i) => {
                        const before = vals.slice(0, i).reverse().find((x) => x != null) ?? null;
                        const dl = v != null && before != null ? v - before : null;
                        return (
                          <td key={i} className="p-1 text-center">
                            {v != null ? (
                              <div className="rounded-md px-2 py-2" style={{ background: `color-mix(in oklab, var(--primary) ${Math.round(((v - 1) / 4) * 85) + 5}%, var(--background))`, color: v >= 3.4 ? "var(--primary-foreground)" : "var(--foreground)" }}>
                                {fmt1(v)}
                                {dl != null && Math.abs(dl) >= 0.05 && (dl > 0 ? <ArrowUp className="ml-1 inline h-3 w-3" /> : <ArrowDown className="ml-1 inline h-3 w-3" />)}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">–</span>
                            )}
                          </td>
                        );
                      })}
                      <td className={cn("whitespace-nowrap px-3 py-2 text-center", change == null ? "text-muted-foreground" : change > 0 ? "text-positive" : change < 0 ? "text-negative" : "")}>
                        {change == null ? "–" : (change > 0 ? "+" : "") + fmt1(change)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        ) : (
          <p className="text-muted-foreground">Sem respostas de escala ainda.</p>
        )}
      </Card>
    </div>
  );
}

function Status({ ok }: { ok: boolean }) {
  return <span className={cn("text-xs", ok ? "text-positive" : "text-negative")}>{ok ? "Dentro da meta" : "Fora da meta"}</span>;
}

function Indicators({ nps, rate, n, target }: { nps: number | null; rate: number | null; n: number; target: { nps: number; rate: number } }) {
  const band = nps != null ? npsBand(nps) : null;
  return (
    <div className="mt-4 grid grid-cols-2 gap-4">
      <div>
        <p className="text-sm text-muted-foreground">NPS</p>
        <p className={cn("text-5xl font-light", band ? BAND_TEXT[band] : "text-muted-foreground")}>{fmt(nps)}</p>
        {nps != null && <Status ok={nps >= target.nps} />}
      </div>
      <div>
        <p className="text-sm text-muted-foreground">Taxa de resposta</p>
        <p className="text-5xl font-light">{rate ?? "–"}{rate != null && "%"}</p>
        {rate != null && <Status ok={rate >= target.rate} />}
      </div>
      <p className="col-span-2 text-sm text-muted-foreground">Respostas: {n}</p>
    </div>
  );
}

function Delta({ label, v, unit }: { label: string; v: number | null; unit: string }) {
  if (v == null) return <span className="text-muted-foreground">{label}: sem ciclo anterior</span>;
  return (
    <span className={cn("flex items-center gap-1", v > 0 ? "text-positive" : v < 0 ? "text-negative" : "text-muted-foreground")}>
      {v > 0 ? <ArrowUp className="h-4 w-4" /> : v < 0 ? <ArrowDown className="h-4 w-4" /> : null}
      {label} {v > 0 ? "+" : ""}{v}{unit}
    </span>
  );
}
