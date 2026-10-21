import { ROLES, STAGES } from "@/lib/contacts";
import { distinctProducts, type AllData, type Filters } from "@/lib/analytics";

export function Select({ value, onChange, label, options }: { value: string; onChange: (v: string) => void; label: string; options: [string, string][] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="h-9 min-w-0 max-w-full rounded-md border bg-background px-3 text-sm">
      <option value="">{label}</option>
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}

export function FiltersBar({ d, f, set, country = false }: { d: AllData; f: Filters; set: (f: Filters) => void; country?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={f.account} onChange={(v) => set({ ...f, account: v })} label="Todas as instituições" options={d.accounts.map((a) => [a.id, a.name])} />
      <Select value={f.role} onChange={(v) => set({ ...f, role: v })} label="Todos os papéis" options={ROLES.map((r) => [r, r])} />
      <Select value={f.stage} onChange={(v) => set({ ...f, stage: v })} label="Todos os estágios" options={STAGES.map((r) => [r, r])} />
      <Select value={f.product} onChange={(v) => set({ ...f, product: v })} label="Todos os produtos" options={distinctProducts(d).map((p) => [p, p])} />
      {country && (
        <Select value={f.country} onChange={(v) => set({ ...f, country: v })} label="Todos os países" options={[["BR", "Brasil"], ["MX", "México"]]} />
      )}
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input type="checkbox" checked={!f.showTest} onChange={(e) => set({ ...f, showTest: !e.target.checked })} /> Ocultar dados de teste
      </label>
    </div>
  );
}

export function filtersToSearch(f: Filters) {
  const p = new URLSearchParams();
  (["account", "role", "stage", "product", "country"] as const).forEach((k) => f[k] && p.set(k, f[k]));
  if (f.showTest) p.set("test", "1");
  return p;
}
