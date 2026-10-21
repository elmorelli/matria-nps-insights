export type NpsSummary = { n: number; promoters: number; passives: number; detractors: number; nps: number | null };

export function npsOf(scores: number[]): NpsSummary {
  const promoters = scores.filter((s) => s >= 9).length;
  const detractors = scores.filter((s) => s <= 6).length;
  const passives = scores.length - promoters - detractors;
  return {
    n: scores.length,
    promoters,
    passives,
    detractors,
    nps: scores.length ? Math.round(((promoters - detractors) / scores.length) * 100) : null,
  };
}

/** How many additional promoter answers are needed to reach the target NPS. */
export function promotersNeeded(s: NpsSummary, target: number): number {
  const t = target / 100;
  if (s.n > 0 && (s.promoters - s.detractors) / s.n >= t) return 0;
  if (t >= 1) return Infinity;
  return Math.max(0, Math.ceil((t * s.n - s.promoters + s.detractors) / (1 - t) - 1e-9));
}

/** How many more answers are needed to reach the target response rate. */
export function answersNeeded(answered: number, validBase: number, targetPct: number): number {
  return Math.max(0, Math.ceil((targetPct / 100) * validBase - answered - 1e-9));
}

export type Band = "negative" | "low" | "mid" | "high";
export function npsBand(nps: number): Band {
  if (nps < 0) return "negative";
  if (nps < 30) return "low";
  if (nps <= 70) return "mid";
  return "high";
}
