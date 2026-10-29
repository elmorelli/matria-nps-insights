import { cn } from "@/lib/utils";
import { npsOf } from "@/lib/nps";
import type { accountHistory } from "@/lib/analytics";

const STATUS_STYLE: Record<string, string> = {
  Ativo: "bg-green-light text-green-dark",
  Inativo: "bg-offwhite text-muted-foreground",
  Churn: "bg-pink-light text-wine",
  Suspenso: "bg-peach text-orange",
};

/** Tier tag uses the monochrome blue scale by list position: first item darkest. */
const TIER_STYLE = ["bg-tier-1 text-primary-foreground", "bg-tier-2 text-primary-foreground", "bg-tier-3 text-primary-foreground", "bg-tier-4 text-deep", "bg-tier-5 text-deep"];

export function StatusTag({ value }: { value: string | null }) {
  if (!value) return null;
  return <span className={cn("rounded-full px-2.5 py-0.5 text-xs", STATUS_STYLE[value] ?? "bg-offwhite text-primary")}>{value}</span>;
}

export function TierTag({ value, tiers }: { value: string | null; tiers: string[] }) {
  if (!value) return null;
  const i = tiers.indexOf(value);
  return <span className={cn("rounded-full px-2.5 py-0.5 text-xs", TIER_STYLE[Math.min(Math.max(i, 0), TIER_STYLE.length - 1)])}>Tier {value}</span>;
}

/** General NPS across all cycles and accumulated response rate (sum of respondents / sum of invited). */
export function accountTotals(hist: ReturnType<typeof accountHistory>) {
  const scores = hist.flatMap((h) => h.st.answered.map((r) => r.score!));
  const answered = hist.reduce((a, h) => a + h.st.answered.length, 0);
  const invited = hist.reduce((a, h) => a + h.st.rows.length, 0);
  return { general: npsOf(scores), answered, invited, rate: invited ? Math.round((answered / invited) * 100) : null };
}
