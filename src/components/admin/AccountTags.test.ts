import { describe, it, expect } from "vitest";
import { accountTotals } from "./AccountTags";

const h = (scores: number[], invited: number) => ({ st: { answered: scores.map((score) => ({ score })), rows: Array.from({ length: invited }) } }) as never;

describe("cartão da instituição", () => {
  it("taxa acumulada soma respondentes e convidados de todos os ciclos", () => {
    const t = accountTotals([h([10, 9], 4), h([3], 6)]);
    expect(t.answered).toBe(3);
    expect(t.invited).toBe(10);
    expect(t.rate).toBe(30);
  });
  it("NPS geral junta as notas de todos os ciclos", () => {
    expect(accountTotals([h([10, 9], 2), h([3, 8], 2)]).general.nps).toBe(25);
  });
});
