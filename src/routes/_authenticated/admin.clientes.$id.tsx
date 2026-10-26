import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ChevronDown, ChevronRight, FileDown, Plus } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { accountHistory, allDataKey, allDataQuery, fmt, fmt1, type Account } from "@/lib/analytics";
import { npsBand } from "@/lib/nps";
import type { ImportRow } from "@/lib/contacts";
import { BAND_TEXT, Card, ScorePill, TableWrap } from "@/components/admin/charts";
import { ContactsTable } from "@/components/admin/ContactsTable";
import { AnswersList } from "@/components/admin/cycle/Respondents";
import { ImportDialog } from "@/components/admin/ImportDialog";
import { MatriaLogo } from "@/components/MatriaLogo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/clientes/$id")({
  head: () => ({ meta: [{ title: "Instituição | Matria NPS" }, { name: "robots", content: "noindex" }] }),
  component: ClientPage,
});

function ClientPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data: d } = useQuery(allDataQuery);
  const [open, setOpen] = useState<string | null>(null);
  const [importRows, setImportRows] = useState<ImportRow[] | null>(null);
  const acc = d?.accounts.find((a) => a.id === id);
  const hist = useMemo(() => (d && acc ? accountHistory(d, acc.id) : []), [d, acc]);
  const refresh = () => qc.invalidateQueries({ queryKey: allDataKey });

  if (!d) return <p className="text-muted-foreground">Carregando...</p>;
  if (!acc) return <p>Instituição não encontrada.</p>;

  const contacts = d.contacts.filter((c) => c.account_id === acc.id);
  const driverKeys = [...new Map(hist.flatMap((h) => h.st.drivers.map((x) => [x.key, x.text] as const))).entries()];
  const withData = hist.filter((h) => h.st.s.n > 0 || h.nps !== null);
  const latest = [...hist].reverse().find((h) => h.st.s.n > 0);

  const update = async (patch: Partial<Account>) => {
    const { error } = await supabase.from("accounts").update(patch).eq("id", acc.id);
    if (error) return toast.error("Não foi possível salvar.");
    refresh();
  };

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="hidden items-center justify-between border-b pb-3 print:flex">
        <MatriaLogo variant="pb" className="h-8" />
        <p className="text-sm text-muted-foreground">Card da instituição · gerado em {new Date().toLocaleDateString("pt-BR")}</p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link to="/admin/clientes" className="inline-flex items-center gap-1 text-sm text-primary">
          <ArrowLeft className="h-4 w-4" /> Clientes
        </Link>
        <Button variant="outline" onClick={() => window.print()}>
          <FileDown /> Exportar card (PDF)
        </Button>
      </div>

      <section className="rounded-xl border bg-background p-4 sm:p-6">
        <Editable className="text-2xl" value={acc.name} onSave={(v) => v.trim() && update({ name: v.trim() })} />
        <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Segmento">
            <Editable value={acc.segment ?? ""} onSave={(v) => update({ segment: v || null })} />
          </Field>
          <Field label="País">
            <select value={acc.country ?? ""} onChange={(e) => update({ country: e.target.value || null })} className="rounded border border-transparent bg-transparent px-1 py-1 hover:border-border">
              <option value="">Não informado</option>
              <option value="BR">Brasil</option>
              <option value="MX">México</option>
            </select>
          </Field>
          <Field label="Cidade">
            <Editable value={acc.city ?? ""} onSave={(v) => update({ city: v || null })} />
          </Field>
          <Field label="Responsável na Matria">
            <Editable value={acc.owner_name ?? ""} onSave={(v) => update({ owner_name: v || null })} />
          </Field>
          <Field label="Receita anual estimada">
            <Editable value={acc.estimated_annual_revenue != null ? String(acc.estimated_annual_revenue) : ""} onSave={(v) => update({ estimated_annual_revenue: v ? Number(v.replace(/\D/g, "")) : null })} />
          </Field>
        </div>
        <Field label="Observações" className="mt-4 text-sm">
          <Editable value={acc.notes ?? ""} onSave={(v) => update({ notes: v || null })} />
        </Field>
      </section>

      <Card
        title="Contatos"
        caption={`${contacts.filter((c) => c.status === "active").length} ativos de ${contacts.length}.`}
        right={
          <Button size="sm" variant="outline" className="print:hidden" onClick={() => setImportRows([{ institution: acc.name, full_name: "", phone: "", email: "", job_title: "", role: "", product: "", stage: "", notes: "" }])}>
            <Plus /> Adicionar contato
          </Button>
        }
      >
        <div className="print:hidden">
          <ContactsTable d={d} contacts={contacts} showAccount={false} />
        </div>
        <ul className="hidden text-sm print:block">
          {contacts.map((c) => (
            <li key={c.id}>
              {c.full_name} · {c.job_title} · {c.role} · {c.contact_products.map((p) => `${p.product} (${p.mom_stage})`).join(", ")}
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Histórico de NPS" caption="NPS e taxa de resposta da instituição em cada ciclo.">
        {withData.length ? (
          <div className="h-64 break-inside-avoid">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hist.map((h) => ({ ciclo: h.cycle.name, NPS: h.nps, "Taxa de resposta": h.rate, n: h.st.s.n }))} margin={{ left: -16, right: 16 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="ciclo" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
                <YAxis domain={[-100, 100]} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--border)" }} />
                <Legend />
                <Line dataKey="NPS" stroke="var(--primary)" strokeWidth={3} connectNulls isAnimationActive={false} label={{ position: "top", fontSize: 12, fill: "var(--foreground)" }} />
                <Line dataKey="Taxa de resposta" stroke="var(--brand-light)" strokeWidth={2} strokeDasharray="4 4" connectNulls isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-muted-foreground">Sem respostas ainda.</p>
        )}
        <TableWrap className="mt-4 max-h-none">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-subtle text-left">
              <tr>
                {["Ciclo", "n", "NPS", "Promotores", "Neutros", "Detratores", ...driverKeys.map(([k]) => k)].map((h) => (
                  <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hist.map((h) => (
                <tr key={h.cycle.id} className="border-t">
                  <td className="whitespace-nowrap px-3 py-2">{h.cycle.name}</td>
                  <td className="px-3 py-2">{h.st.s.n}</td>
                  <td className={cn("px-3 py-2 font-medium", h.nps != null && BAND_TEXT[npsBand(h.nps)])}>{fmt(h.nps)}</td>
                  <td className="px-3 py-2">{h.st.s.promoters}</td>
                  <td className="px-3 py-2">{h.st.s.passives}</td>
                  <td className="px-3 py-2">{h.st.s.detractors}</td>
                  {driverKeys.map(([k]) => (
                    <td key={k} className="px-3 py-2">
                      {fmt1(h.st.drivers.find((x) => x.key === k)?.mean)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Card>

      <Card title="Respostas" caption="Todas as respostas desta instituição, por ciclo.">
        <div className="space-y-6">
          {[...hist].reverse().filter((h) => h.st.answered.length).map((h) => (
            <div key={h.cycle.id} className={cn(h !== latest && "print:hidden")}>
              <h3 className="text-base">{h.cycle.name}</h3>
              <div className="mt-2 space-y-2">
                {h.st.answered.map((r) => {
                  const isOpen = open === r.inv.id;
                  return (
                    <Fragment key={r.inv.id}>
                      <button onClick={() => setOpen(isOpen ? null : r.inv.id)} className="flex w-full items-start gap-3 rounded-lg border p-3 text-left print:hidden">
                        <ScorePill score={r.score!} />
                        <div className="min-w-0 flex-1">
                          <p>
                            {r.contact.full_name} <span className="text-muted-foreground">· {r.contact.papel}</span>
                          </p>
                          <p className="truncate text-sm text-muted-foreground">{r.reason}</p>
                        </div>
                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                      {isOpen && (
                        <div className="rounded-lg bg-subtle p-4 print:hidden">
                          <AnswersList row={r} questions={h.st.questions} />
                        </div>
                      )}
                      <div className="hidden break-inside-avoid border-b py-2 text-sm print:block">
                        <p>
                          {r.score} · {r.contact.full_name} · {r.contact.papel}
                        </p>
                        {h.st.questions
                          .filter((q) => q.kind === "text")
                          .map((q) => r.answers[q.key]?.text && (
                            <p key={q.key} className="mt-1">
                              <span className="text-muted-foreground">{q.text} </span>
                              {r.answers[q.key]?.text}
                            </p>
                          ))}
                      </div>
                    </Fragment>
                  );
                })}
              </div>
            </div>
          ))}
          {!latest && <p className="text-muted-foreground">Sem respostas ainda.</p>}
        </div>
      </Card>
      <ImportDialog rows={importRows} setRows={setImportRows} onDone={refresh} />
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function Editable({ value, onSave, className }: { value: string; onSave: (v: string) => void; className?: string }) {
  const [v, setV] = useState(value);
  const [orig, setOrig] = useState(value);
  if (value !== orig) {
    setOrig(value);
    setV(value);
  }
  return (
    <input
      value={v}
      placeholder="Clique para preencher"
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== value && onSave(v)}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      className={cn("w-full rounded border border-transparent bg-transparent px-1 py-1 hover:border-border focus:border-primary focus:outline-none", className)}
    />
  );
}
