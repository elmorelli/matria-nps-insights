import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ListKey = "role" | "product" | "account_status" | "account_tier" | "account_type" | "country" | "iad" | "kae";
export type OptionRow = { id: string; list: ListKey; value: string; extra: { label?: string; ddi?: string; flag?: string }; position: number; active: boolean };

export const LIST_LABEL: Record<ListKey, string> = {
  role: "Papel do contato",
  product: "Produtos",
  account_status: "Status da instituição",
  account_tier: "Tier da instituição",
  account_type: "Tipo da instituição",
  country: "País",
  iad: "IAD",
  kae: "KAE",
};

export const optionsKey = ["option-lists"] as const;
export const optionsQuery = {
  queryKey: optionsKey,
  queryFn: async () => {
    const { data, error } = await supabase.from("option_lists").select("*").order("position");
    if (error) throw error;
    return data as unknown as OptionRow[];
  },
};

export type Options = ReturnType<typeof buildOptions>;

export function buildOptions(rows: OptionRow[]) {
  const all = (k: ListKey) => rows.filter((r) => r.list === k).sort((a, b) => a.position - b.position);
  const active = (k: ListKey) => all(k).filter((r) => r.active);
  const values = (k: ListKey) => active(k).map((r) => r.value);
  const countryLabel = (code: string | null | undefined) => all("country").find((c) => c.value === code)?.extra.label ?? code ?? "";
  return { rows, all, active, values, countryLabel, countries: active("country") };
}

/** Selection lists configured in Configurações. Every select in the app reads from here. */
export function useOptions() {
  const q = useQuery(optionsQuery);
  return buildOptions(q.data ?? []);
}

/** Case-insensitive match against a configured list. Returns the canonical value or null. */
export function matchOption(list: string[], raw: string): string | null {
  const t = raw.trim().toLocaleLowerCase("pt-BR");
  return list.find((v) => v.toLocaleLowerCase("pt-BR") === t) ?? null;
}
