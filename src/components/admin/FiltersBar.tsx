import { distinctProducts, rolesOf, hasActiveFilters, EMPTY_FILTERS, FILTER_KEYS, type AllData, type Filters } from "@/lib/analytics";
import { useOptions } from "@/lib/options";
import { cn } from "@/lib/utils";

/** Labeled select. First option is always "Todos" (value ""). */
export function Select({ value, onChange, label, options, className }: { value: string; onChange: (v: string) => void; label: string; options: [string, string][]; className?: string }) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1", className)}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-9 min-w-[9rem] max-w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
        <option value="">Todos</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ClearFilters({ show, onClear }: { show: boolean; onClear: () => void }) {
  if (!show) return null;
  return (
    <button type="button" onClick={onClear} className="h-9 self-end text-sm text-primary underline-offset-4 hover:underline">
      Limpar filtros
    </button>
  );
}

export function FiltersBar({ d, f, set, children, extraActive = false, onClearExtra }: { d: AllData; f: Filters; set: (f: Filters) => void; country?: boolean; children?: React.ReactNode; extraActive?: boolean; onClearExtra?: () => void }) {
  const o = useOptions();
  const vals = (k: Parameters<typeof o.values>[0]) => o.values(k).map((v) => [v, v] as [string, string]);
  return (
    <div className="flex flex-wrap items-end gap-3">
      {children}
      <Select value={f.account} onChange={(v) => set({ ...f, account: v })} label="Instituição" options={d.accounts.map((a) => [a.id, a.name])} />
      <Select value={f.role} onChange={(v) => set({ ...f, role: v })} label="Papel" options={rolesOf(d).map((r) => [r, r])} />
      <Select value={f.product} onChange={(v) => set({ ...f, product: v })} label="Produto" options={distinctProducts(d).map((p) => [p, p])} />
      <Select value={f.tier} onChange={(v) => set({ ...f, tier: v })} label="Tier" options={vals("account_tier")} />
      <Select value={f.type} onChange={(v) => set({ ...f, type: v })} label="Tipo" options={vals("account_type")} />
      <Select value={f.country} onChange={(v) => set({ ...f, country: v })} label="País" options={o.countries.map((c) => [c.value, c.extra.label ?? c.value])} />
      <Select value={f.iad} onChange={(v) => set({ ...f, iad: v })} label="IAD" options={vals("iad")} />
      <Select value={f.kae} onChange={(v) => set({ ...f, kae: v })} label="KAE" options={vals("kae")} />
      <label className="flex h-9 items-center gap-2 self-end text-sm text-muted-foreground">
        <input type="checkbox" checked={!f.showTest} onChange={(e) => set({ ...f, showTest: !e.target.checked })} /> Ocultar dados de teste
      </label>
      <ClearFilters
        show={hasActiveFilters(f) || extraActive}
        onClear={() => {
          set({ ...EMPTY_FILTERS, showTest: f.showTest });
          onClearExtra?.();
        }}
      />
    </div>
  );
}

export function filtersToSearch(f: Filters) {
  const p = new URLSearchParams();
  FILTER_KEYS.forEach((k) => f[k] && p.set(k, f[k]));
  if (f.showTest) p.set("test", "1");
  return p;
}
