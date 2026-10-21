import { useMemo, useState } from "react";
import { AlertTriangle, FileDown, Target, TrendingUp, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { promotersNeeded, answersNeeded, npsBand } from "@/lib/nps";
import { BAND_LABEL, EMPTY_FILTERS, cycleReading, cycleStats, dailySeries, fmt, previousCycle, type AllData, type Cycle } from "@/lib/analytics";
import { BAND_TEXT, Card, CorrelationChart, Distribution, DriversTable, Evolution, Funnel, Gauge, GroupBars, Histogram, Reading } from "@/components/admin/charts";
import { FiltersBar, filtersToSearch } from "@/components/admin/FiltersBar";
import { cn } from "@/lib/utils";

export function Results({ d, cycle }: { d: AllData; cycle: Cycle }) {
  const [f, setF] = useState(EMPTY_FILTERS);
  const st = useMemo(() => cycleStats(d, cycle, f), [d, cycle, f]);
  const prevC = previousCycle(d, cycle);
  const prev = useMemo(() => (prevC ? cycleStats(d, prevC, f) : null), [d, prevC, f]);
  const days = useMemo(() => dailySeries(st), [st]);
  const reading = useMemo(() => cycleReading(st, prev), [st, prev]);
  const target = Number(cycle.target_nps);
  const targetRate = Number(cycle.target_response_rate);
  const band = st.s.nps === null ? null : npsBand(st.s.nps);
  const need = promotersNeeded(st.s, target);
  const needAns = answersNeeded(st.s.n, st.base, targetRate);
  const belowZero = st.byAccount.filter((a) => (a.nps ?? 0) < 0);

  const exportPdf = () => {
    const p = filtersToSearch(f);
    p.set("cycles", cycle.id);
    window.open(`/relatorio?${p.toString()}`, "_blank");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FiltersBar d={d} f={f} set={setF} />
        <Button variant="outline" onClick={exportPdf}>
          <FileDown /> Exportar PDF
        </Button>
      </div>

      {st.s.n > 0 && st.s.n < 10 && (
        <div className="flex items-center gap-3 rounded-lg border bg-background p-4 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 text-attention" />
          Amostra pequena: {st.s.n} {st.s.n === 1 ? "resposta" : "respostas"}. Cada resposta move o NPS em muitos pontos. Leia com cautela.
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-5">
        <Card title="NPS do ciclo" className="lg:col-span-3" right={band && <span className={cn("text-sm", BAND_TEXT[band])}>{BAND_LABEL[band]}</span>}>
          <div className="grid items-center gap-6 sm:grid-cols-2">
            <Gauge value={st.s.nps} target={target} previous={prev?.nps ?? null} />
            <div className="space-y-4">
              <div className="rounded-lg bg-highlight p-4">
                <div className="flex items-center gap-2 text-primary">
                  <Target className="h-4 w-4" /> <span className="text-sm">Caminho para a meta ({fmt(target)})</span>
                </div>
                <p className="mt-2">
                  {st.s.n === 0 ? "Aguardando as primeiras respostas." : need === 0 ? "Meta atingida. Mantenha os promotores próximos." : `Faltam ${need} ${need === 1 ? "promotor" : "promotores"} (nota 9 ou 10) sem novos detratores.`}
                </p>
              </div>
              {prev?.nps != null && st.s.nps !== null && (
                <p className="flex items-center gap-2 text-sm">
                  <TrendingUp className="h-4 w-4 text-primary" /> {fmt(st.s.nps - prev.nps)} pontos em relação ao {prevC?.name} ({fmt(prev.nps)})
                </p>
              )}
              {st.weighted !== null && (
                <p className="text-sm text-muted-foreground">
                  Ponderado por receita: <span className="text-foreground">{fmt(st.weighted)}</span>. Dá mais peso às contas maiores.
                </p>
              )}
            </div>
          </div>
          <div className="mt-6">
            <Distribution s={st.s} />
          </div>
        </Card>
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card title="Taxa de resposta" right={<Users className="h-5 w-5 text-muted-foreground" />}>
            <p className="text-4xl font-semibold">{st.rate ?? 0}%</p>
            <p className="text-sm text-muted-foreground">
              {st.s.n} de {st.base} contatos válidos
            </p>
            <div className="relative mt-5 h-3 rounded-full bg-offwhite">
              <div className={cn("h-full rounded-full", (st.rate ?? 0) >= targetRate ? "bg-positive" : "bg-primary")} style={{ width: `${Math.min(100, st.rate ?? 0)}%` }} />
              <div className="absolute -top-1 h-5 w-0.5 bg-foreground" style={{ left: `${targetRate}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-sm text-muted-foreground">
              <span>{st.base === 0 ? "Aguardando links" : needAns === 0 ? "Meta atingida" : `Faltam ${needAns} respostas`}</span>
              <span>Meta {targetRate}%</span>
            </div>
          </Card>
          <Card title="Funil da coleta">
            <Funnel steps={st.funnel} />
          </Card>
        </div>
      </section>

      <Card title="Leitura do ciclo" caption="Texto gerado a partir dos dados e dos filtros aplicados.">
        <Reading paragraphs={reading} />
      </Card>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card title="Notas de 0 a 10" caption="Quantas pessoas deram cada nota.">
          <Histogram data={st.hist} />
        </Card>
        <Card title="Evolução da coleta" caption="Acumulado por dia, do início ao fim do ciclo. Tracejado marca lembretes.">
          <Evolution days={days} />
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card title="NPS por instituição" caption={`Meta: todas acima de 0. Tracejado em ${fmt(target)}.`}>
          {belowZero.length > 0 && <p className="mb-3 rounded-md bg-negative-bg p-3 text-sm">Abaixo de 0: {belowZero.map((a) => a.name).join(", ")}</p>}
          <GroupBars items={st.byAccount} target={target} />
        </Card>
        <Card title="NPS por produto">
          <GroupBars items={st.byProduct} target={target} />
        </Card>
        <Card title="NPS por papel">
          <GroupBars items={st.byRole} target={target} />
        </Card>
        <Card title="NPS por estágio MOM">
          <GroupBars items={st.byStage} target={target} />
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card title="Direcionadores" caption="Média de 1 a 5 de cada afirmação, da menor para a maior.">
          <DriversTable items={st.drivers} />
        </Card>
        <Card title="Direcionador versus NPS" caption="Eixo horizontal: média. Eixo vertical: correlação com a nota de NPS.">
          <CorrelationChart items={st.drivers} />
        </Card>
      </section>
    </div>
  );
}
