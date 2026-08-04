import { describe, it, expect } from "vitest";
import { computeFeeValue, totalActiveMrr } from "@/lib/contracts";

describe("computeFeeValue", () => {
  it("computes the percentage of the gain", () => {
    expect(computeFeeValue(10000, 10)).toBe(1000);
  });

  it("rounds to cents", () => {
    expect(computeFeeValue(333.33, 15)).toBe(50);
  });

  it("returns 0 for a 0% fee", () => {
    expect(computeFeeValue(10000, 0)).toBe(0);
  });
});

describe("totalActiveMrr", () => {
  it("sums only active mrr contracts", () => {
    const contracts = [
      { type: "mrr", status: "ativo", value: 5000 },
      { type: "mrr", status: "ativo", value: 8000 },
      { type: "mrr", status: "encerrado", value: 12000 },
      { type: "setup", status: "ativo", value: 30000 },
      { type: "performance_fee", status: "ativo", value: null },
    ];
    expect(totalActiveMrr(contracts)).toBe(13000);
  });

  it("returns 0 when there are no active mrr contracts", () => {
    expect(totalActiveMrr([])).toBe(0);
  });
});
