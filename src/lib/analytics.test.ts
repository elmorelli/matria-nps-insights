import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { targetFor, type Cycle } from "./analytics";

const c = (target_nps: number, target_response_rate: number) => ({ id: String(target_nps), name: "C", target_nps, target_response_rate }) as unknown as Cycle;

describe("target rule", () => {
  it("single cycle uses its own targets", () => {
    const t = targetFor([c(60, 75)]);
    expect(t).toMatchObject({ nps: 60, rate: 75, averaged: false });
  });
  it("several cycles use the mean of their targets", () => {
    const t = targetFor([c(50, 70), c(60, 80)]);
    expect(t).toMatchObject({ nps: 55, rate: 75, averaged: true, label: "Meta média dos ciclos selecionados" });
  });
});

import { attainment as att } from "@/lib/analytics";
describe("attainment color rule", () => {
  it("positive at or above target", () => expect(att(80, 80)).toBe("positive"));
  it("attention within 10 points below", () => expect(att(70, 80)).toBe("attention"));
  it("negative more than 10 points below", () => expect(att(69, 80)).toBe("negative"));
});
