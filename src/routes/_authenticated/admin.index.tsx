import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, FileDown } from "lucide-react";
import { CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, LineChart } from "recharts";
import { allDataQuery, BAND_LABEL, EMPTY_FILTERS, cycleStats, fmt, fmt1, targetFor, type Filters , stageCaption } from "@/lib/analytics";
import { npsBand } from "@/lib/nps";
import { BAND_BG, BAND_TEXT, Card, GroupBars, TableWrap } from "@/components/admin/charts";
import { FiltersBar, filtersToSearch } from "@/components/admin/FiltersBar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Visão geral | Matria NPS" }, { name: "robots", content: "noindex" }] }),
  component: Overview,
});

function Overview() {
  const { data: d } = useQuery(allDataQuery);
  const [f, setF] = useState<Filters>(EMPTY_FILTERS);
  const [picked, setPicked] = useState<string[]>([]); // empty = todos

  const sorted = useMemo(() => [...(d?.cycles ?? [])].sort((a, b) => a.start_date.localeCompare(b.start_date)), [d]);
  const selected = picked.length ? sorted.filter((c) => picked.includes(c.id)) : sorted;
  const stats = useMemo(() => (d ? selected.map((c) => cycleStats(d, c, f)) : []), [d, selected, f]);
  const target = targetFor(selected);
  const latest = [...stats].reverse().find((s) => s.s.n > 0 || s.nps != null) ?? stats[stats.length - 1];
  const latestIdx = latest ? sorted.findIndex((c) => c.id === latest.cycle.id) : -1;
  const prevCycle = latestIdx > 0 ? sorted[latestIdx - 1] : undefined;
  const prev = d && prevCycle ? cycleStats(d, prevCycle, f) : null;

  if (!d) return <p className="text-muted-foreground">Carregando...</p>;

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
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
  const driverKeys = [...new Map(stats.flatMap((s) => s.drivers.map((x) => [x.key, x.text] as const))).entries()];
  const coverage = latest
    ? d.accounts
        .filter((a) => !f.account || a.id === f.account)
        .map((a) => {
          const active = d.contacts.filter((c) => c.account_id === a.id && c.status === "active" && (f.showTest || !c.is_test)).length;
          const ans = latest.answered.filter((r) => r.account?.id === a.id).length;
          return { a, active, ans, pct: active ? Math.round((ans / active) * 100) : 0 };
        })
        .filter((r) => r.active > 0)
        .sort((x, y) => x.pct - y.pct)
    : [];

  const exportPdf = () => {
    const p = filtersToSearch(f);
    p.set("cycles", selected.map((c) => c.id).join(","));
    window.location.assign(`/admin/relatorio?${p.toString()}`);
  };
  const band = latest?.nps != null ? npsBand(latest.nps) : null;
  const totalN = stats.reduce((a, s) => a + s.s.n, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Visão geral</p>
          <h1 className="text-2xl">{picked.length === 0 ? "Todos os ciclos" : selected.length === 1 ? selected[0].name : `${selected.length} ciclos selecionados`}</h1>
        </div>
        <Button variant="outline" onClick={exportPdf}>
          <FileDown /> Exportar PDF
        </Button>
      </div>

      <div className="space-y-3 rounded-lg border bg-background p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Ciclos:</span>
          <Chip on={picked.length === 0} onClick={() => setPicked([])}>
            Todos os ciclos
          </Chip>
          {sorted.map((c) => (
            <Chip key={c.id} on={picked.includes(c.id)} onClick={() => toggle(c.id)}>
              {c.name}
            </Chip>
          ))}
        </div>
        <FiltersBar d={d} f={f} set={setF} country />
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

      <section className="grid gap-4 lg:grid-cols-3">
        {latest && (
          <Link to="/admin/ciclos/$id" params={{ id: latest.cycle.id }} search={{ tab: "resultados" }} className="rounded-xl border bg-background p-6 hover:border-primary">
            <div className="flex items-center justify-between">
              <h2 className="text-lg">Ciclo mais recente</h2>
              <ArrowRight className="h-4 w-4 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">{latest.cycle.name}</p>
            <p className={cn("mt-3 text-5xl font-light", band ? BAND_TEXT[band] : "text-muted-foreground")}>{fmt(latest.nps)}</p>
            {band && <p className={cn("text-sm", BAND_TEXT[band])}>{BAND_LABEL[band]}</p>}
            <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Resposta</dt>
                <dd className="text-lg font-light">{latest.rate ?? "–"}%</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">n</dt>
                <dd className="text-lg font-light">{latest.s.n}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Variação</dt>
                <dd className="text-lg font-light">{prev?.nps != null && latest.nps != null ? fmt(latest.nps - prev.nps) : "–"}</dd>
              </div>
            </dl>
            {latest.weighted !== null && <p className="mt-3 text-sm text-muted-foreground">Ponderado por receita: {fmt(latest.weighted)}. Dá mais peso às contas maiores.</p>}
            {latest.fromReference && <p className="mt-3 text-sm text-muted-foreground">Valor de referência registrado, sem respostas no sistema.</p>}
          </Link>
        )}
        <Card
          title="Meta em uso"
          className="lg:col-span-2"
          caption={target.averaged ? "Média simples das metas dos ciclos selecionados." : "Meta própria do ciclo selecionado."}
        >
          <p className="text-sm text-muted-foreground">{target.label}</p>
          <div className="mt-2 flex flex-wrap gap-8">
            <div>
              <p className="text-sm text-muted-foreground">NPS</p>
              <p className="text-3xl font-light" title={selected.map((c) => `${c.name}: ${fmt(Number(c.target_nps))}`).join("\n")}>
                {fmt(target.nps)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Taxa de resposta</p>
              <p className="text-3xl font-light">{target.rate}%</p>
            </div>
          </div>
          {target.averaged && (
            <ul className="mt-3 flex flex-wrap gap-x-4 text-sm text-muted-foreground">
              {selected.map((c) => (
                <li key={c.id}>
                  {c.name}: {fmt(Number(c.target_nps))} e {c.target_response_rate}%
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card title="NPS ao longo dos ciclos" caption="Linha azul: NPS (n no ponto). Degraus: meta de cada ciclo. Tracejado: meta em uso.">
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
                  <text x={x} y={y - 10} textAnchor="middle" fontSize={11} fill="var(--foreground)">{trend[index]?.NPS != null ? `${fmt(trend[index].NPS)} ${trend[index].n ? `(n=${trend[index].n})` : "(referência)"}` : ""}</text>
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

      <Card title="Mapa de calor por instituição" caption="NPS de cada instituição em cada ciclo. As que pedem atenção aparecem primeiro.">
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
                          <span className="ml-1 text-xs text-muted-foreground">n={c.n}</span>
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
          <Card title="NPS por papel" caption={`Ciclo ${latest.cycle.name}.`}>
            <GroupBars items={latest.byRole} target={target.nps} />
          </Card>
          <Card title="NPS por estágio MOM" caption={`Ciclo ${latest.cycle.name}. ${stageCaption(latest)}`}>
            <GroupBars items={latest.byStage} target={target.nps} />
          </Card>
        </section>
      )}

      <Card title="Direcionadores ao longo dos ciclos" caption="Média de 1 a 5 de cada direcionador, por ciclo.">
        {driverKeys.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {driverKeys.map(([k, text]) => {
              const data = stats.map((s) => ({ ciclo: s.cycle.name, v: s.drivers.find((x) => x.key === k)?.mean ?? null }));
              const last = [...data].reverse().find((x) => x.v != null)?.v ?? null;
              return (
                <div key={k} className="rounded-lg border p-3">
                  <p className="line-clamp-2 text-sm" title={text}>
                    {text}
                  </p>
                  <p className="mt-1 text-xl font-light">{fmt1(last)}</p>
                  <div className="h-14">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data}>
                        <YAxis hide domain={[1, 5]} />
                        <XAxis dataKey="ciclo" hide />
                        <Tooltip formatter={(v: number) => fmt1(v)} contentStyle={{ borderRadius: 8, border: "1px solid var(--border)" }} />
                        <Line dataKey="v" stroke="var(--primary)" strokeWidth={2} dot={{ r: 2 }} connectNulls isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-muted-foreground">Sem respostas de escala ainda.</p>
        )}
      </Card>

      {latest && (
        <Card title="Cobertura por instituição" caption={`Contatos ativos e respostas no ciclo ${latest.cycle.name}. Alerta quando há menos de 2 respostas.`}>
          <TableWrap>
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-subtle text-left">
                <tr>
                  {["Instituição", "Contatos ativos", "Responderam", "Cobertura", ""].map((h) => (
                    <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {coverage.map((r) => (
                  <tr key={r.a.id} className="border-t">
                    <td className="whitespace-nowrap px-3 py-2">{r.a.name}</td>
                    <td className="px-3 py-2">{r.active}</td>
                    <td className="px-3 py-2">{r.ans}</td>
                    <td className="px-3 py-2">{r.pct}%</td>
                    <td className="whitespace-nowrap px-3 py-2">{r.ans < 2 && <span className="rounded-full bg-attention-bg px-2 py-0.5 text-xs text-attention">Cobertura baixa</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Card>
      )}
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn("rounded-full border px-3 py-1 text-sm", on ? "border-primary bg-primary text-primary-foreground" : "bg-background text-foreground hover:border-primary")}>
      {children}
    </button>
  );
}
