import { describe, it, expect } from "vitest";
import { buildDayGrids, parseMinute, scanWindows, windowTrades, type M1Series } from "./seasonal-window";

// Monday 2025-11-03 bars (NinjaTrader close-stamped)
function series(rows: [string, number, number][]): M1Series {
  return {
    t: Int32Array.from(rows.map((r) => parseMinute(r[0]))),
    o: Float32Array.from(rows.map((r) => r[1])),
    c: Float32Array.from(rows.map((r) => r[2])),
  };
}

describe("seasonal window (ninjatrader close-stamped m1)", () => {
  const s = series([
    ["2025-11-03 09:30:00", 90, 95],
    ["2025-11-03 09:31:00", 100, 101], // opened at 09:30
    ["2025-11-03 10:30:00", 110, 120], // closed at 10:30
    ["2025-11-04 09:31:00", 200, 201], // tuesday
    ["2025-11-04 10:30:00", 190, 180],
  ]);

  it("enters at open of bar labelled start+1 and exits at close of bar labelled end", () => {
    const trades = windowTrades(buildDayGrids(s, 1), 570, 630);
    expect(trades).toHaveLength(1);
    expect(trades[0].entry).toBe(100);
    expect(trades[0].exit).toBe(120);
    expect(trades[0].points).toBe(20);
  });

  it("filters by weekday (tuesday = short winner)", () => {
    const r = scanWindows(buildDayGrids(s, 2), {
      weekday: 2, duration: 60, step: 60, sessionStart: 570, sessionEnd: 630, minTrades: 1,
    });
    expect(r.short[0].net).toBe(20);
    expect(r.long[0].winRate).toBe(0);
  });
});
