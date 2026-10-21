import { describe, it, expect } from "vitest";
import { npsOf, promotersNeeded, answersNeeded, npsBand } from "./nps";

describe("NPS", () => {
  it("promotores 9-10, neutros 7-8, detratores 0-6", () => {
    const s = npsOf([10, 9, 8, 7, 6, 0]);
    expect([s.promoters, s.passives, s.detractors, s.nps]).toEqual([2, 2, 2, 0]);
  });
  it("calcula promotores que faltam para +60", () => {
    // 1 promotor, 1 neutro, 1 detrator = NPS 0. Com 5 promotores a mais: (6-1)/8 = 62,5
    expect(promotersNeeded(npsOf([10, 8, 5]), 60)).toBe(5);
  });
  it("zero quando a meta já foi atingida", () => {
    expect(promotersNeeded(npsOf([10, 10, 9]), 60)).toBe(0);
  });
  it("respostas que faltam para 75%", () => {
    expect(answersNeeded(10, 20, 75)).toBe(5);
  });
  it("faixas de cor", () => {
    expect([npsBand(-5), npsBand(10), npsBand(50), npsBand(80)]).toEqual(["negative", "low", "mid", "high"]);
  });
});
