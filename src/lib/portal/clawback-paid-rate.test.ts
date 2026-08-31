import { describe, expect, it } from "vitest";
import {
  clawbackAmountFromPaidRate,
  parsePaidRatePercentInput,
} from "./clawback-paid-rate-math";

describe("parsePaidRatePercentInput", () => {
  it("parses percent points", () => {
    expect(parsePaidRatePercentInput("1.75")).toBeCloseTo(0.0175, 6);
    expect(parsePaidRatePercentInput("1.75%")).toBeCloseTo(0.0175, 6);
    expect(parsePaidRatePercentInput(" 2 ")).toBeCloseTo(0.02, 6);
  });

  it("keeps small fractions as-is", () => {
    expect(parsePaidRatePercentInput("0.0175")).toBeCloseTo(0.0175, 6);
  });

  it("rejects empty / zero / over 10%", () => {
    expect(parsePaidRatePercentInput("")).toBeNull();
    expect(parsePaidRatePercentInput("0")).toBeNull();
    expect(parsePaidRatePercentInput("12")).toBeNull();
    expect(parsePaidRatePercentInput("abc")).toBeNull();
  });
});

describe("clawbackAmountFromPaidRate", () => {
  it("rounds debt × rate to cents", () => {
    expect(clawbackAmountFromPaidRate(129861.19, 0.0175)).toBe(2272.57);
    expect(clawbackAmountFromPaidRate(10000, 0.02)).toBe(200);
  });

  it("returns 0 for bad inputs", () => {
    expect(clawbackAmountFromPaidRate(0, 0.02)).toBe(0);
    expect(clawbackAmountFromPaidRate(1000, 0)).toBe(0);
  });
});
