import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { accountHistory, allDataKey, allDataQuery, fmt } from "@/lib/analytics";
import { npsBand } from "@/lib/nps";
import { BAND_TEXT } from "@/components/admin/charts";
import { ClearFilters, Select } from "@/components/admin/FiltersBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useOptions } from "@/lib/options";
import { StatusTag, TierTag, accountTotals } from "@/components/admin/AccountTags";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/clientes/")({
  head: () => ({ meta: [{ title: "Clientes | Matria NPS" }, { name: "robots", content: "noindex" }] }),
  component: ClientsPage,
});

const EMPTY = { name: "", status: "", tier: "", segment: "", country: "BR", iad: "", kae: "", owner_name: "", estimated_annual_revenue: "", notes: "" };

function ClientsPage() {
  const qc = useQueryClient();
  const { data: d } = useQuery(allDataQuery);
  const [q, setQ] = useState("");
  const [fSeg, setFSeg] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fTier, setFTier] = useState("");
  const opts = useOptions();
  const [fCountry, setFCountry] = useState("");
  const [fIad, setFIad] = useState("");
  const [fKae, setFKae] = useState("");
  const [form, setForm] = useState<typeof EMPTY | null>(null);

  const list = useMemo(() => {
    if (!d) return [];
    const t = q.trim().toLowerCase();
    return d.accounts
      .filter((a) => (!t || a.name.toLowerCase().includes(t)) && (!fSeg || a.segment === fSeg) && (!fCountry || a.country === fCountry) && (!fStatus || a.status === fStatus) && (!fTier || a.tier === fTier) && (!fIad || a.iad === fIad) && (!fKae || a.kae === fKae))
      .map((a) => {
        const hist = accountHistory(d, a.id);
        const latest = [...hist].reverse().find((h) => h.nps !== null);
        return { a, hist, latest, tot: accountTotals(hist) };
      })
      .sort((x, y) => (x.tot.general.nps ?? 999) - (y.tot.general.nps ?? 999));
  }, [d, q, fSeg, fCountry, fStatus, fTier, fIad, fKae]);

  const create = async () => {
    if (!form?.name.trim()) return toast.error("Informe o nome.");
    if (!form.status || !form.tier) return toast.error("Escolha o status e o Tier.");
    const { error } = await supabase.from("accounts").insert({
      name: form.name.trim(),
      status: form.status,
      tier: form.tier,
      segment: form.segment || null,
      country: form.country || null,
      iad: form.iad || null,
      kae: form.kae || null,
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
            ] as const
          ).map(([k, l]) => (
            <div key={k} className="space-y-1">
              <Label htmlFor={k}>{l}</Label>
              <Input id={k} type={k === "estimated_annual_revenue" ? "number" : "text"} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
            </div>
          ))}
          {(
            [
              ["status", "Status", opts.values("account_status").map((v) => [v, v])],
              ["tier", "Tier", opts.values("account_tier").map((v) => [v, v])],
              ["segment", "Tipo", opts.values("account_type").map((v) => [v, v])],
              ["iad", "IAD", opts.values("iad").map((v) => [v, v])],
              ["kae", "KAE", opts.values("kae").map((v) => [v, v])],
              ["country", "País", opts.countries.map((c) => [c.value, `${c.extra.flag ?? ""} ${c.extra.label ?? c.value}`])],
            ] as const
          ).map(([k, l, o]) => (
            <div key={k} className="space-y-1">
              <Label htmlFor={k}>
                {l}
                {(k === "status" || k === "tier") && " *"}
              </Label>
              <select id={k} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                <option value="">Escolha</option>
                {o.map(([v, t]) => (
                  <option key={v} value={v}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          ))}
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

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Buscar</span>
          <Input placeholder="Nome da instituição" value={q} onChange={(e) => setQ(e.target.value)} className="w-64 bg-background" />
        </label>
        <Select value={fStatus} onChange={setFStatus} label="Status" options={opts.values("account_status").map((s) => [s, s])} />
        <Select value={fTier} onChange={setFTier} label="Tier" options={opts.values("account_tier").map((s) => [s, s])} />
        <Select value={fSeg} onChange={setFSeg} label="Tipo" options={opts.values("account_type").map((s) => [s, s])} />
        <Select value={fCountry} onChange={setFCountry} label="País" options={opts.countries.map((c) => [c.value, c.extra.label ?? c.value])} />
        <Select value={fIad} onChange={setFIad} label="IAD" options={opts.values("iad").map((s) => [s, s])} />
        <Select value={fKae} onChange={setFKae} label="KAE" options={opts.values("kae").map((s) => [s, s])} />
        <ClearFilters
          show={!!(fStatus || fTier || fSeg || fCountry || fIad || fKae || q)}
          onClear={() => {
            setQ(""); setFStatus(""); setFTier(""); setFSeg(""); setFCountry(""); setFIad(""); setFKae("");
          }}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {list.map(({ a, hist, latest, tot }) => {
          const gBand = tot.general.nps != null ? npsBand(tot.general.nps) : null;
          const lBand = latest?.nps != null ? npsBand(latest.nps) : null;
          return (
            <Link key={a.id} to="/admin/clientes/$id" params={{ id: a.id }} className="flex flex-col rounded-lg border bg-background p-5 hover:border-primary">
              <h2 className="truncate text-lg font-medium">{a.name}</h2>
              <p className="text-sm text-muted-foreground">{[a.segment, opts.countryLabel(a.country)].filter(Boolean).join(" · ") || "Tipo e país não informados"}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <StatusTag value={a.status} />
                <TierTag value={a.tier} tiers={opts.values("account_tier")} />
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-2">
                <div>
                  <dt className="text-xs text-muted-foreground">NPS geral</dt>
                  <dd className={cn("text-2xl font-light", gBand ? BAND_TEXT[gBand] : "text-muted-foreground")}>{fmt(tot.general.nps)}</dd>
                  <dd className="text-xs text-muted-foreground">{tot.general.n} respostas</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Último ciclo</dt>
                  <dd className={cn("text-2xl font-light", lBand ? BAND_TEXT[lBand] : "text-muted-foreground")}>{fmt(latest?.nps)}</dd>
                  <dd className="truncate text-xs text-muted-foreground">{latest?.cycle.name ?? "Sem respostas"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Taxa acumulada</dt>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <dd className="text-2xl font-light text-primary">{tot.rate != null ? `${tot.rate}%` : "–"}</dd>
                    </TooltipTrigger>
                    <TooltipContent>
                      {tot.answered} respondentes de {tot.invited} convidados
                    </TooltipContent>
                  </Tooltip>
                </div>
              </dl>
              <div className="mt-3 h-10 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={hist.map((h) => ({ v: h.nps }))}>
                    <YAxis hide domain={[-100, 100]} />
                    <Line dataKey="v" stroke="var(--primary)" strokeWidth={2} dot={{ r: 2 }} connectNulls isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
