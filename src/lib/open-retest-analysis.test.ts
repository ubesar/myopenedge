import { describe, it, expect } from "vitest";
import { analyzeOpenRetest } from "./open-retest-analysis";

const bar = (t: string, o: number, h: number, l: number, c: number) => ({
  datetime: `2026-01-05 ${t}:00`, open: o, high: h, low: l, close: c,
});

describe("analyzeOpenRetest", () => {
  it("counts touches and side crosses of the 09:30 open until 11:00", () => {
    const r = analyzeOpenRetest([
      bar("09:30", 100, 101, 99.5, 100.8),
      bar("09:35", 100.8, 101, 99.9, 99.7),   // touch + cross down
      bar("09:40", 99.7, 100.2, 99.5, 100.1), // touch + cross up
      bar("09:45", 100.1, 102, 100.5, 101.5), // no touch (low 100.5)
      bar("11:00", 101.5, 101.6, 99, 99),     // outside window
    ]);
    expect(r.days[0].touches).toBe(2);
    expect(r.days[0].crosses).toBe(2);
    expect(r.days[0].lastTouchTime).toBe("09:40");
  });

  it("skips days without a 09:30 bar", () => {
    expect(analyzeOpenRetest([bar("09:35", 1, 1, 1, 1)]).days.length).toBe(0);
  });
});
