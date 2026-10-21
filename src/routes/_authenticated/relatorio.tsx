import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { allDataQuery, cycleReading, cycleStats, describeFilters, fmt, previousCycle, targetFor, EMPTY_FILTERS, BAND_LABEL, type Filters, type CycleStats } from "@/lib/analytics";
import { npsBand, promotersNeeded } from "@/lib/nps";
import { BAND_TEXT, CorrelationChart, Distribution, DriversTable, GroupBars, Histogram, Reading } from "@/components/admin/charts";
import { MatriaLogo } from "@/components/MatriaLogo";
import { cn } from "@/lib/utils";

type S = { cycles?: string; account?: string; role?: string; stage?: string; product?: string; country?: string; test?: string };

export const Route = createFileRoute("/_authenticated/relatorio")({
  validateSearch: (s: Record<string, unknown>): S => Object.fromEntries(Object.entries(s).filter(([, v]) => typeof v === "string" || typeof v === "number").map(([k, v]) => [k, String(v)])) as S,
  head: () => ({ meta: [{ title: "Relatório NPS | Matria" }, { name: "robots", content: "noindex" }] }),
  component: Report,
});

function Page({ title, caption, children, n }: { title: string; caption?: string; children: React.ReactNode; n: number }) {
  return (
    <section className="report-page flex flex-col bg-background p-10">
      <div className="flex items-center justify-between border-b pb-3">
        <h2 className="text-2xl">{title}</h2>
        <MatriaLogo className="h-8" />
      </div>
      <div className="mt-6 min-h-0 flex-1">{children}</div>
      <div className="flex justify-between pt-3 text-xs text-muted-foreground">
        <span>{caption}</span>
        <span>Página {n}</span>
      </div>
    </section>
  );
}

function Report() {
  const s = Route.useSearch();
  const { data: d } = useQuery(allDataQuery);
  const f: Filters = { ...EMPTY_FILTERS, account: s.account ?? "", role: s.role ?? "", stage: s.stage ?? "", product: s.product ?? "", country: s.country ?? "", showTest: s.test === "1" };
  const ids = (s.cycles ?? "").split(",").filter(Boolean);

  const r = useMemo(() => {
    if (!d) return null;
    const sel = d.cycles.filter((c) => !ids.length || ids.includes(c.id)).sort((a, b) => a.start_date.localeCompare(b.start_date));
    const stats = sel.map((c) => cycleStats(d, c, f));
    const main: CycleStats | undefined = [...stats].reverse().find((x) => x.s.n > 0) ?? stats[stats.length - 1];
    const pc = main ? previousCycle(d, main.cycle) : undefined;
    const prev = pc ? cycleStats(d, pc, f) : null;
    return { sel, stats, main, prev, target: targetFor(sel) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, s.cycles, s.account, s.role, s.stage, s.product, s.country, s.test]);

  useEffect(() => {
    if (r?.main) {
      const t = setTimeout(() => window.print(), 1200);
      return () => clearTimeout(t);
    }
  }, [r]);

  if (!d || !r) return <p className="p-8">Preparando o relatório...</p>;
  const { sel, main, prev, target } = r;
  if (!main) return <p className="p-8">Nenhum ciclo encontrado.</p>;
  const band = main.nps != null ? npsBand(main.nps) : null;
  const need = promotersNeeded(main.s, target.nps);
  const texts = main.answered.filter((x) => x.reason).sort((a, b) => (b.inv.answered_at ?? "").localeCompare(a.inv.answered_at ?? ""));
  const det = texts.filter((x) => x.score! <= 6).slice(0, 5);
  const pro = texts.filter((x) => x.score! >= 9).slice(0, 5);
  const period = `${new Date(sel[0].start_date + "T12:00").toLocaleDateString("pt-BR")} a ${sel[sel.length - 1].end_date ? new Date(sel[sel.length - 1].end_date + "T12:00").toLocaleDateString("pt-BR") : "hoje"}`;
  const ref = sel.length > 1 ? `Dados detalhados do ciclo mais recente com respostas: ${main.cycle.name}.` : "";

  return (
    <div className="report bg-subtle">
      <style>{`
        @page { size: 297mm 167mm; margin: 0; }
        .report-page { width: 297mm; height: 167mm; overflow: hidden; break-after: page; margin: 0 auto 16px; border: 1px solid var(--border); }
        @media print { .report { background: #fff; } .report-page { margin: 0; border: 0; } .no-print { display: none; } }
      `}</style>
      <div className="no-print flex justify-center gap-4 p-4 text-sm">
        <button onClick={() => window.print()} className="rounded-md bg-primary px-4 py-2 text-primary-foreground">
          Salvar como PDF
        </button>
        <span className="self-center text-muted-foreground">Na janela de impressão, escolha "Salvar como PDF".</span>
      </div>

      <section className="report-page flex flex-col justify-between bg-primary p-12 text-primary-foreground">
        <MatriaLogo variant="negativo" className="h-14 self-start" />
        <div>
          <p className="text-lg opacity-80">Pesquisa de NPS relacional</p>
          <h1 className="mt-2 text-5xl">{sel.length === 1 ? sel[0].name : `${sel.length} ciclos: ${sel.map((c) => c.name).join(", ")}`}</h1>
          <p className="mt-4 text-lg">Período: {period}</p>
          <p className="mt-1">Filtros: {describeFilters(f, d)}</p>
          <p className="mt-1">
            {target.label}: NPS {fmt(target.nps)} e taxa de resposta {target.rate}%
            {target.averaged ? ` (média de ${sel.map((c) => `${c.name} ${fmt(Number(c.target_nps))}`).join(", ")})` : ""}
          </p>
        </div>
        <p className="text-sm opacity-80">Gerado em {new Date().toLocaleString("pt-BR")}</p>
      </section>

      <Page n={2} title="Indicadores principais" caption={`NPS, taxa de resposta e comparação com o ciclo anterior. ${ref}`}>
        <div className="grid h-full grid-cols-4 gap-6">
          {[
            ["NPS", fmt(main.nps), band ? BAND_LABEL[band] : "", band ? BAND_TEXT[band] : ""],
            ["Meta de NPS", fmt(target.nps), main.s.n === 0 ? "Aguardando respostas" : need === 0 ? "Meta atingida" : `Faltam ${need} promotores`, ""],
            ["Taxa de resposta", `${main.rate ?? 0}%`, `${main.s.n} de ${main.base} contatos válidos. Meta ${target.rate}%`, ""],
            ["Variação", prev?.nps != null && main.nps != null ? fmt(main.nps - prev.nps) : "–", prev ? `Em relação ao ${prev.cycle.name} (${fmt(prev.nps)})` : "Sem ciclo anterior", ""],
          ].map(([l, v, sub, c]) => (
            <div key={l} className="rounded-xl border p-6">
              <p className="text-muted-foreground">{l}</p>
              <p className={cn("mt-3 text-5xl font-semibold", c)}>{v}</p>
              <p className="mt-3 text-sm text-muted-foreground">{sub}</p>
            </div>
          ))}
        </div>
      </Page>

      <Page n={3} title="Distribuição das notas" caption="Proporção de detratores, neutros e promotores, e quantas pessoas deram cada nota de 0 a 10.">
        <div className="grid grid-cols-2 gap-8">
          <Distribution s={main.s} />
          <Histogram data={main.hist} height={300} />
        </div>
      </Page>

      <Page n={4} title="NPS por instituição" caption={`Barras partem do zero. Tracejado marca a meta ${fmt(target.nps)}. n é o número de respostas.`}>
        <div className="columns-2 gap-10">
          <GroupBars items={main.byAccount.slice(0, 20)} target={target.nps} />
        </div>
      </Page>

      <Page n={5} title="NPS por papel e por estágio" caption="Comparação entre papéis do contato e estágios do MOM no ciclo.">
        <div className="grid grid-cols-2 gap-10">
          <div>
            <p className="mb-3 text-muted-foreground">Por papel</p>
            <GroupBars items={main.byRole} target={target.nps} />
          </div>
          <div>
            <p className="mb-3 text-muted-foreground">Por estágio MOM</p>
            <GroupBars items={main.byStage} target={target.nps} />
          </div>
        </div>
      </Page>

      <Page n={6} title="Direcionadores" caption="À esquerda, a média de cada afirmação (1 a 5). À direita, média versus correlação com o NPS.">
        <div className="grid grid-cols-2 gap-8">
          <div className="[&_*]:max-h-none">
            <DriversTable items={main.drivers} />
          </div>
          <CorrelationChart items={main.drivers} height={380} />
        </div>
      </Page>

      <Page n={7} title="Leitura do ciclo" caption="Texto gerado automaticamente a partir dos dados e filtros aplicados.">
        <div className="max-w-4xl text-lg">
          <Reading paragraphs={cycleReading(main, prev)} />
        </div>
      </Page>

      <Page n={8} title="O que os clientes disseram" caption="Os 5 comentários mais recentes de detratores e de promotores, para a pergunta sobre o que mais pesou na nota.">
        <div className="grid grid-cols-2 gap-8 text-sm">
          {[
            ["Detratores (0 a 6)", det],
            ["Promotores (9 e 10)", pro],
          ].map(([l, list]) => (
            <div key={l as string}>
              <p className="mb-3 text-muted-foreground">{l as string}</p>
              <div className="space-y-3">
                {(list as typeof det).map((x) => (
                  <div key={x.inv.id} className="rounded-lg border p-3">
                    <p>"{x.reason}"</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Nota {x.score} · {x.contact.full_name} · {x.account?.name} · {x.contact.role}
                    </p>
                  </div>
                ))}
                {!(list as typeof det).length && <p className="text-muted-foreground">Sem comentários neste grupo.</p>}
              </div>
            </div>
          ))}
        </div>
      </Page>
    </div>
  );
}
