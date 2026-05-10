import { describe, it, expect } from "vitest";
import { formatOCCResult, validateOCCResult, buildOCCPayload } from "./occ-formatter";
import type { OCCResult } from "./occ-analysis";

const validResult: OCCResult = {
  totalDays: 2,
  candleSize: "30m",
  candleSizeMinutes: 30,
  greenCandle: {
    total: 1,
    greenDayCount: 1,
    redDayCount: 0,
    greenDayPct: 100,
    redDayPct: 0,
  },
  redCandle: {
    total: 1,
    greenDayCount: 0,
    redDayCount: 1,
    greenDayPct: 0,
    redDayPct: 100,
  },
  allDays: [
    {
      date: "2025-01-06",
      openingCandleGreen: true,
      dayEndGreen: true,
      openingCandle: { time: "09:30", open: 100, high: 102.5, low: 99.9, close: 102 },
      dailyOpen: 100,
      dailyClose: 105,
    },
    {
      date: "2025-01-07",
      openingCandleGreen: false,
      dayEndGreen: false,
      openingCandle: { time: "09:30", open: 100, high: 100.1, low: 97.5, close: 98 },
      dailyOpen: 100,
      dailyClose: 95,
    },
  ],
};

describe("validateOCCResult", () => {
  it("returns null for a valid result", () => {
    expect(validateOCCResult(validResult)).toBeNull();
  });

  it("flags missing greenCandle/redCandle", () => {
    const err = validateOCCResult({ totalDays: 1, allDays: [] });
    expect(err).not.toBeNull();
    expect(err?.missingFields).toEqual(
      expect.arrayContaining(["greenCandle", "redCandle"]),
    );
  });

  it("flags non-object input", () => {
    expect(validateOCCResult(undefined)).not.toBeNull();
    expect(validateOCCResult(null)).not.toBeNull();
    expect(validateOCCResult("oops")).not.toBeNull();
  });

  it("flags legacy momentum-shaped result (tfStats only)", () => {
    const legacy = { totalDays: 5, tfStats: { M30: {} }, allDays: [] };
    const err = validateOCCResult(legacy);
    expect(err).not.toBeNull();
    expect(err?.missingFields).toEqual(
      expect.arrayContaining(["greenCandle", "redCandle"]),
    );
  });
});

describe("buildOCCPayload", () => {
  it("maps to the expected schema", () => {
    const payload = buildOCCPayload(validResult);
    expect(payload).toEqual({
      mode: "occ",
      totalDays: 2,
      candleSize: "30m",
      greenOpeningCandle: { total: 1, continuesGreenPct: 100, reversesRedPct: 0 },
      redOpeningCandle: { total: 1, continuesRedPct: 100, reversesGreenPct: 0 },
      lastDay: {
        date: "2025-01-07",
        openingCandleGreen: false,
        dayEndGreen: false,
      },
    });
  });

  it("returns null lastDay when allDays is empty", () => {
    const payload = buildOCCPayload({ ...validResult, allDays: [] });
    expect(payload.lastDay).toBeNull();
  });
});

describe("formatOCCResult", () => {
  it("returns JSON payload string for valid input", () => {
    const json = JSON.parse(formatOCCResult(validResult));
    expect(json.mode).toBe("occ");
    expect(json.greenOpeningCandle.continuesGreenPct).toBe(100);
  });

  it("never throws and returns JSON error for malformed input", () => {
    const out = formatOCCResult({ totalDays: 0 });
    const parsed = JSON.parse(out);
    expect(parsed.error).toMatch(/malformed/);
  });

  it("does not crash on undefined (regression: Object.entries(undefined))", () => {
    expect(() => formatOCCResult(undefined)).not.toThrow();
    const parsed = JSON.parse(formatOCCResult(undefined));
    expect(parsed.error).toBeDefined();
  });
});
