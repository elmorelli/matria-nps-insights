import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { allDataKey, allDataQuery, EMPTY_FILTERS, cycleStats, fmt, type AllData } from "@/lib/analytics";
import { npsBand } from "@/lib/nps";
import { BAND_TEXT } from "@/components/admin/charts";
import { Select } from "@/components/admin/FiltersBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/clientes/")({
  head: () => ({ meta: [{ title: "Clientes | Matria NPS" }, { name: "robots", content: "noindex" }] }),
  component: ClientsPage,
});

export function accountHistory(d: AllData, accountId: string) {
  return [...d.cycles]
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .map((c) => {
      const st = cycleStats(d, c, { ...EMPTY_FILTERS, account: accountId });
      return { cycle: c, st, nps: st.s.n ? st.s.nps : null, rate: st.rows.length ? st.rate : null };
    });
}

const EMPTY = { name: "", segment: "", country: "BR", city: "", owner_name: "", estimated_annual_revenue: "", notes: "" };

function ClientsPage() {
  const qc = useQueryClient();
  const { data: d } = useQuery(allDataQuery);
  const [q, setQ] = useState("");
  const [fSeg, setFSeg] = useState("");
  const [fCountry, setFCountry] = useState("");
  const [form, setForm] = useState<typeof EMPTY | null>(null);

  const segments = [...new Set((d?.accounts ?? []).map((a) => a.segment).filter(Boolean) as string[])].sort();
  const list = useMemo(() => {
    if (!d) return [];
    const t = q.trim().toLowerCase();
    return d.accounts
      .filter((a) => (!t || a.name.toLowerCase().includes(t)) && (!fSeg || a.segment === fSeg) && (!fCountry || a.country === fCountry))
      .map((a) => {
        const hist = accountHistory(d, a.id);
        const latest = [...hist].reverse().find((h) => h.nps !== null);
        return { a, hist, latest, active: d.contacts.filter((c) => c.account_id === a.id && c.status === "active" && !c.is_test).length };
      });
  }, [d, q, fSeg, fCountry]);

  const create = async () => {
    if (!form?.name.trim()) return toast.error("Informe o nome.");
    const { error } = await supabase.from("accounts").insert({
      name: form.name.trim(),
      segment: form.segment || null,
      country: form.country || null,
      city: form.city || null,
      owner_name: form.owner_name || null,
      estimated_annual_revenue: form.estimated_annual_revenue ? Number(form.estimated_annual_revenue) : null,
      notes: form.notes || null,
    });
    if (error) return toast.error("Não foi possível criar.");
    toast.success("Instituição criada.");
    setForm(null);
    qc.invalidateQueries({ queryKey: allDataKey });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl">Clientes</h1>
          <p className="mt-1 text-muted-foreground">{d?.accounts.length ?? 0} instituições.</p>
        </div>
        <Button onClick={() => setForm({ ...EMPTY })}>
          <Plus /> Nova instituição
        </Button>
      </div>

      {form && (
        <div className="grid gap-4 rounded-lg border bg-background p-4 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              ["name", "Nome"],
              ["segment", "Segmento"],
              ["city", "Cidade"],
              ["owner_name", "Responsável na Matria"],
              ["estimated_annual_revenue", "Receita anual estimada"],
            ] as const
          ).map(([k, l]) => (
            <div key={k} className="space-y-1">
              <Label htmlFor={k}>{l}</Label>
              <Input id={k} type={k === "estimated_annual_revenue" ? "number" : "text"} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
            </div>
          ))}
          <div className="space-y-1">
            <Label htmlFor="country">País</Label>
            <select id="country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
              <option value="BR">Brasil</option>
              <option value="MX">México</option>
            </select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea id="notes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
            <Button onClick={create}>Criar instituição</Button>
            <Button variant="outline" onClick={() => setForm(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Input placeholder="Buscar instituição" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs bg-background" />
        <Select value={fSeg} onChange={setFSeg} label="Todos os segmentos" options={segments.map((s) => [s, s])} />
        <Select value={fCountry} onChange={setFCountry} label="Todos os países" options={[["BR", "Brasil"], ["MX", "México"]]} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {list.map(({ a, hist, latest, active }) => {
          const band = latest?.nps != null ? npsBand(latest.nps) : null;
          return (
            <Link key={a.id} to="/admin/clientes/$id" params={{ id: a.id }} className="flex flex-col rounded-lg border bg-background p-5 hover:border-primary">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="truncate text-lg">{a.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    {[a.segment, a.country === "MX" ? "México" : a.country === "BR" ? "Brasil" : null].filter(Boolean).join(" · ") || "Sem segmento"}
                  </p>
                </div>
                <div className="text-right">
                  <p className={cn("text-2xl font-semibold", band ? BAND_TEXT[band] : "text-muted-foreground")}>{fmt(latest?.nps)}</p>
                  <p className="text-xs text-muted-foreground">{latest ? `n=${latest.st.s.n} · ${latest.cycle.name}` : "Sem respostas"}</p>
                </div>
              </div>
              <div className="mt-4 flex items-end justify-between gap-4">
                <p className="text-sm text-muted-foreground">{active} contatos ativos</p>
                <div className="h-10 w-28">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={hist.map((h) => ({ v: h.nps }))}>
                      <YAxis hide domain={[-100, 100]} />
                      <Line dataKey="v" stroke="var(--primary)" strokeWidth={2} dot={{ r: 2 }} connectNulls isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
