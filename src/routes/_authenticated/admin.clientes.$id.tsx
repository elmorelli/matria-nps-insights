import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ChevronDown, ChevronRight, FileDown, Plus } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { accountHistory, allDataKey, allDataQuery, fmt, fmt1, type Account, type AllData } from "@/lib/analytics";
import { npsBand } from "@/lib/nps";
import { STAGES } from "@/lib/contacts";
import { useOptions } from "@/lib/options";
import { ContactSheet } from "@/components/admin/ContactSheet";
import { StatusTag, TierTag } from "@/components/admin/AccountTags";
import { BAND_TEXT, Card, ScorePill, TableWrap } from "@/components/admin/charts";
import { ContactsTable } from "@/components/admin/ContactsTable";
import { AnswersList } from "@/components/admin/cycle/Respondents";
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
  const [adding, setAdding] = useState(false);
  const opts = useOptions();
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
        <div className="flex flex-wrap gap-1.5">
          <StatusTag value={acc.status} />
          <TierTag value={acc.tier} tiers={opts.values("account_tier")} />
        </div>
        <Editable className="mt-2 text-3xl font-light text-primary" value={acc.name} onSave={(v) => v.trim() && update({ name: v.trim() })} />
        <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Status">
            <OptSelect value={acc.status} options={opts.values("account_status")} onChange={(v) => v && update({ status: v })} />
          </Field>
          <Field label="Tier">
            <OptSelect value={acc.tier} options={opts.values("account_tier")} onChange={(v) => v && update({ tier: v })} />
          </Field>
          <Field label="Tipo">
            <OptSelect value={acc.segment} options={opts.values("account_type")} onChange={(v) => update({ segment: v || null })} />
          </Field>
          <Field label="País">
            <OptSelect value={acc.country} options={opts.countries.map((c) => c.value)} labels={Object.fromEntries(opts.countries.map((c) => [c.value, c.extra.label ?? c.value]))} onChange={(v) => update({ country: v || null })} />
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

      <ProductsBlock d={d} accountId={acc.id} onChanged={refresh} />

      <Card
        title="Contatos"
        caption={`${contacts.filter((c) => c.status === "active").length} ativos de ${contacts.length}.`}
        right={
          <Button size="sm" variant="outline" className="print:hidden" onClick={() => setAdding(true)}>
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
              {c.full_name} · {c.job_title} · {c.papel} · {c.contact_products.map((p) => p.product).join(", ")}
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
      <ContactSheet d={d} contact={adding ? null : undefined} defaultAccount={acc.id} onClose={() => setAdding(false)} />
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

function OptSelect({ value, options, labels, onChange }: { value: string | null; options: string[]; labels?: Record<string, string>; onChange: (v: string) => void }) {
  const list = value && !options.includes(value) ? [...options, value] : options;
  return (
    <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="w-full rounded border border-transparent bg-transparent px-1 py-1 text-primary hover:border-border">
      <option value="">Não informado</option>
      {list.map((o) => (
        <option key={o} value={o}>
          {labels?.[o] ?? o}
        </option>
      ))}
    </select>
  );
}

function ProductsBlock({ d, accountId, onChanged }: { d: AllData; accountId: string; onChanged: () => void }) {
  const opts = useOptions();
  const [adding, setAdding] = useState("");
  const rows = d.accountProducts.filter((p) => p.account_id === accountId);
  const available = opts.values("product").filter((p) => !rows.some((r) => r.product === p));
  const setStage = async (id: string, mom_stage: string) => {
    const { error } = await supabase.from("account_products").update({ mom_stage: mom_stage as never }).eq("id", id);
    if (error) return toast.error("Não foi possível salvar.");
    toast.success("Estágio atualizado.");
    onChanged();
  };
  const add = async () => {
    if (!adding) return;
    const { error } = await supabase.from("account_products").insert({ account_id: accountId, product: adding });
    if (error) return toast.error("Não foi possível adicionar.");
    setAdding("");
    onChanged();
  };
  const remove = async (id: string) => {
    const { error } = await supabase.from("account_products").delete().eq("id", id);
    if (error) return toast.error("Não foi possível remover.");
    onChanged();
  };
  return (
    <Card title="Produtos contratados" caption="O estágio vale para todos os contatos da instituição que usam o produto.">
      <ul className="divide-y rounded-lg border">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="min-w-40 flex-1 text-primary">{r.product}</span>
            <select value={r.mom_stage} onChange={(e) => setStage(r.id, e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm print:border-0">
              {STAGES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground">desde {new Date(r.updated_at).toLocaleDateString("pt-BR")}</span>
            <button onClick={() => remove(r.id)} className="text-sm text-muted-foreground hover:text-negative print:hidden">
              Remover
            </button>
          </li>
        ))}
        {!rows.length && <li className="px-4 py-3 text-muted-foreground">Nenhum produto contratado.</li>}
      </ul>
      {available.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 print:hidden">
          <select value={adding} onChange={(e) => setAdding(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm">
            <option value="">Adicionar produto</option>
            {available.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <Button size="sm" variant="outline" onClick={add} disabled={!adding}>
            <Plus /> Adicionar
          </Button>
        </div>
      )}
    </Card>
  );
}
