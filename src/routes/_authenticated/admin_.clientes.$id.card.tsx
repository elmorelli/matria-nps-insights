import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { accountHistory, allDataQuery, fmt, fmt1 } from "@/lib/analytics";
import { npsBand } from "@/lib/nps";
import { formatPhone } from "@/lib/contacts";
import { useOptions } from "@/lib/options";
import { BAND_TEXT } from "@/components/admin/charts";
import { StatusTag, TierTag, accountTotals } from "@/components/admin/AccountTags";
import { MatriaLogo } from "@/components/MatriaLogo";
import { PdfViewer, pdfDate } from "@/components/admin/PdfViewer";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin_/clientes/$id/card")({
  head: () => ({ meta: [{ title: "Card da instituição | Matria NPS" }, { name: "robots", content: "noindex" }] }),
  component: CardPdf,
});

function A4({ title, n, children }: { title: string; n: number; children: React.ReactNode }) {
  return (
    <section className="flex h-full flex-col bg-background px-12 pb-8 pt-8">
      <div className="flex items-start justify-between gap-6">
        <h1 className="text-3xl font-light leading-tight">{title}</h1>
        <MatriaLogo className="h-14 shrink-0" />
      </div>
      <div className="mt-6 min-h-0 flex-1 overflow-hidden">{children}</div>
      <div className="flex justify-between pt-3 text-xs text-muted-foreground">
        <span>Card da instituição · gerado em {new Date().toLocaleDateString("pt-BR")}</span>
        <span>Página {n}</span>
      </div>
    </section>
  );
}

function CardPdf() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const { data: d } = useQuery(allDataQuery);
  const opts = useOptions();
  const acc = d?.accounts.find((a) => a.id === id);
  const hist = useMemo(() => (d && acc ? accountHistory(d, acc.id) : []), [d, acc]);
  if (!d) return <p className="p-8">Preparando o card...</p>;
  if (!acc) return <p className="p-8">Instituição não encontrada.</p>;

  const tot = accountTotals(hist);
  const latest = [...hist].reverse().find((h) => h.st.s.n > 0);
  const contacts = d.contacts.filter((c) => c.account_id === acc.id && c.status === "active" && !c.is_test);
  const products = d.accountProducts.filter((p) => p.account_id === acc.id);
  const kpi = (l: string, v: string, sub: string, cls?: string) => (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-muted-foreground">{l}</p>
      <p className={cn("mt-1 text-4xl font-light text-primary", cls)}>{v}</p>
      <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
    </div>
  );

  const pages = [
    <A4 key="1" title={acc.name} n={1}>
      <div className="flex flex-wrap gap-1.5">
        <StatusTag value={acc.status} />
        <TierTag value={acc.tier} tiers={opts.values("account_tier")} />
        <span className="text-sm text-muted-foreground">{[acc.segment, opts.countryLabel(acc.country), acc.iad && `IAD ${acc.iad}`, acc.kae && `KAE ${acc.kae}`].filter(Boolean).join(" · ")}</span>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3">
        {kpi("NPS geral", fmt(tot.general.nps), `${tot.general.n} respostas, todos os ciclos`, tot.general.nps != null ? BAND_TEXT[npsBand(tot.general.nps)] : "")}
        {kpi("Último ciclo", fmt(latest?.nps), latest ? `${latest.cycle.name}, ${latest.st.s.n} respostas` : "Sem respostas", latest?.nps != null ? BAND_TEXT[npsBand(latest.nps)] : "")}
        {kpi("Taxa acumulada", tot.rate != null ? `${tot.rate}%` : "–", `${tot.answered} de ${tot.invited} convidados`)}
      </div>
      <h2 className="mt-6 text-lg">Histórico de NPS</h2>
      <LineChart width={690} height={200} data={hist.map((h) => ({ ciclo: h.cycle.name, NPS: h.nps }))} margin={{ left: -16, right: 16, top: 16 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="ciclo" tick={{ fontSize: 12, fill: "var(--primary)" }} />
        <YAxis domain={[-100, 100]} tick={{ fontSize: 12, fill: "var(--primary)" }} />
        <Line dataKey="NPS" stroke="var(--primary)" strokeWidth={3} connectNulls isAnimationActive={false} label={{ position: "top", fontSize: 12, fill: "var(--primary)" }} />
      </LineChart>
      <table className="mt-2 w-full text-sm">
        <thead className="text-left text-primary">
          <tr className="border-b">
            {["Ciclo", "Respostas", "NPS", "Promotores", "Neutros", "Detratores", "Taxa"].map((h) => (
              <th key={h} className="py-1.5 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {hist.map((h) => (
            <tr key={h.cycle.id} className="border-b">
              <td className="py-1.5">{h.cycle.name}</td>
              <td>{h.st.s.n}</td>
              <td className={cn(h.nps != null && BAND_TEXT[npsBand(h.nps)])}>{fmt(h.nps)}</td>
              <td>{h.st.s.promoters}</td>
              <td>{h.st.s.passives}</td>
              <td>{h.st.s.detractors}</td>
              <td>{h.rate != null ? `${h.rate}%` : "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-6 grid grid-cols-2 gap-6">
        <div>
          <h2 className="text-lg">Produtos contratados</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {products.map((p) => (
              <li key={p.id} className="flex justify-between border-b py-1">
                <span>{p.product}</span>
              </li>
            ))}
            {!products.length && <li className="text-muted-foreground">Nenhum produto.</li>}
          </ul>
        </div>
        <div>
          <h2 className="text-lg">Contatos ativos</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {contacts.slice(0, 10).map((c) => (
              <li key={c.id} className="border-b py-1">
                {c.full_name} <span className="text-muted-foreground">· {c.papel}</span>
                <div className="text-xs text-muted-foreground">{formatPhone(c.phone)}</div>
              </li>
            ))}
            {contacts.length > 10 && <li className="text-xs text-muted-foreground">E mais {contacts.length - 10}.</li>}
          </ul>
        </div>
      </div>
    </A4>,
    <A4 key="2" title={latest ? `Respostas do ${latest.cycle.name}` : "Respostas"} n={2}>
      {latest ? (
        <div className="space-y-3 text-sm">
          {latest.st.answered.slice(0, 8).map((r) => (
            <div key={r.inv.id} className="rounded-lg border p-3">
              <p className="text-primary">
                Nota {r.score} · {r.contact.full_name} · {r.contact.papel}
              </p>
              {latest.st.questions
                .filter((q) => q.kind === "text")
                .map((q) =>
                  r.answers[q.key]?.text ? (
                    <p key={q.key} className="mt-1">
                      <span className="text-muted-foreground">{q.text} </span>
                      {r.answers[q.key]?.text}
                    </p>
                  ) : null,
                )}
            </div>
          ))}
          <h2 className="pt-2 text-lg">Direcionadores</h2>
          <ul>
            {latest.st.drivers.map((x) => (
              <li key={x.key} className="flex justify-between border-b py-1">
                <span className="pr-4">{x.text}</span>
                <span className="text-primary">{fmt1(x.mean)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-muted-foreground">Sem respostas ainda.</p>
      )}
    </A4>,
  ];

  return <PdfViewer pages={pages} format="a4" filename={`Matria NPS - ${acc.name} - ${pdfDate()}.pdf`} back={() => nav({ to: "/admin/clientes/$id", params: { id } })} />;
}
