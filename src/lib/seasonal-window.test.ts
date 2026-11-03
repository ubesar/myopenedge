import { describe, it, expect } from "vitest";
import {
  buildDayGrids, parseMinute, parseLine, scanWindows, windowTrades,
  yearlyBreakdown, walkForwardSplit, equityCurve, type M1Series,
} from "./seasonal-window";

// Monday 2025-11-03 bars (NinjaTrader close-stamped)
function series(rows: [string, number, number, number?, number?][]): M1Series {
  const hasHL = rows.some((r) => r[3] !== undefined || r[4] !== undefined);
  const s: M1Series = {
    t: Int32Array.from(rows.map((r) => parseMinute(r[0]))),
    o: Float32Array.from(rows.map((r) => r[1])),
    c: Float32Array.from(rows.map((r) => r[2])),
  };
  if (hasHL) {
    s.h = Float32Array.from(rows.map((r) => r[3] ?? Math.max(r[1], r[2])));
    s.l = Float32Array.from(rows.map((r) => r[4] ?? Math.min(r[1], r[2])));
  }
  return s;
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
      weekday: 2, duration: 60, step: 60, sessionStart: 570, sessionEnd: 630, minTrades: 1, rankBy: "winRate",
    });
    expect(r.short[0].net).toBe(20);
    expect(r.long[0].winRate).toBe(0);
  });

  it("parseLine returns [t, open, high, low, close]", () => {
    const r = parseLine("2025-11-03 09:31:00,100,105,99,101,1234,1");
    expect(r).not.toBeNull();
    expect(r![1]).toBe(100);
    expect(r![2]).toBe(105);
    expect(r![3]).toBe(99);
    expect(r![4]).toBe(101);
  });

  it("computes MAE/MFE from bar highs and lows (long direction)", () => {
    const s2 = series([
      ["2025-11-03 09:31:00", 100, 104, 104, 98], // opened 09:30 @100
      ["2025-11-03 10:30:00", 108, 122, 97, 120], // closes window
    ]);
    const trades = windowTrades(buildDayGrids(s2, 1), 570, 630);
    expect(trades).toHaveLength(1);
    // long: worst adverse = 100 - 97 = 3; best favorable = 122 - 100 = 22
    expect(trades[0].mae).toBe(3);
    expect(trades[0].mfe).toBe(22);
  });

  it("short stats swap MAE and MFE", () => {
    const s2 = series([
      ["2025-11-03 09:31:00", 100, 104, 104, 98],
      ["2025-11-03 10:30:00", 108, 122, 97, 120],
    ]);
    const r = scanWindows(buildDayGrids(s2, 1), {
      weekday: 1, duration: 60, step: 60, sessionStart: 570, sessionEnd: 630, minTrades: 1, rankBy: "winRate",
    });
    // long: mae 3, mfe 22 → short: mae 22, mfe 3
    expect(r.all[0].long.avgMae).toBe(3);
    expect(r.all[0].long.avgMfe).toBe(22);
    expect(r.all[0].short.avgMae).toBe(22);
    expect(r.all[0].short.avgMfe).toBe(3);
  });

  it("ranks by the selected criterion", () => {
    const s2 = series([
      ["2025-11-03 09:31:00", 100, 101], ["2025-11-03 10:30:00", 110, 150],
      ["2025-11-10 09:31:00", 100, 101], ["2025-11-10 10:30:00", 110, 110], // 0 pts
      ["2025-11-17 09:31:00", 100, 101], ["2025-11-17 10:30:00", 110, 111],
      ["2025-11-24 09:31:00", 100, 101], ["2025-11-24 10:30:00", 110, 112],
      ["2025-12-01 09:31:00", 100, 101], ["2025-12-01 10:30:00", 110, 113],
    ]);
    const grids = buildDayGrids(s2, 1);
    const byNet = scanWindows(grids, { weekday: 1, duration: 60, step: 60, sessionStart: 570, sessionEnd: 630, minTrades: 1, rankBy: "net" });
    expect(byNet.long[0].net).toBe(50);
    const byWr = scanWindows(grids, { weekday: 1, duration: 60, step: 60, sessionStart: 570, sessionEnd: 630, minTrades: 1, rankBy: "winRate" });
    expect(byWr.long[0].winRate).toBe(80);
    const byPf = scanWindows(grids, { weekday: 1, duration: 60, step: 60, sessionStart: 570, sessionEnd: 630, minTrades: 1, rankBy: "profitFactor" });
    expect(byPf.long[0].profitFactor).toBe(Infinity);
  });
});

describe("consistency breakdown", () => {
  const trades = windowTrades(buildDayGrids(series([
    ["2024-11-04 09:31:00", 100, 101], ["2024-11-04 10:30:00", 110, 120],
    ["2024-11-11 09:31:00", 100, 101], ["2024-11-11 10:30:00", 110, 105],
    ["2025-01-06 09:31:00", 100, 101], ["2025-01-06 10:30:00", 110, 125],
    ["2025-01-13 09:31:00", 100, 101], ["2025-01-13 10:30:00", 110, 115],
  ]), 1), 570, 630);

  it("yearly breakdown groups by year with win rate and net", () => {
    const ys = yearlyBreakdown(trades);
    expect(ys).toHaveLength(2);
    expect(ys[0].label).toBe("2024");
    expect(ys[0].trades).toBe(2);
    expect(ys[0].wins).toBe(1);
    expect(ys[0].net).toBe(15);
    expect(ys[1].label).toBe("2025");
    expect(ys[1].net).toBe(30);
  });

  it("walk-forward splits chronologically into two halves", () => {
    const { first, second } = walkForwardSplit(trades);
    expect(first.trades).toBe(2);
    expect(second.trades).toBe(2);
    expect(first.net).toBe(15);
    expect(second.net).toBe(30);
  });

  it("equity curve is cumulative and chronological", () => {
    const eq = equityCurve(trades);
    expect(eq).toHaveLength(4);
    expect(eq[0].cum).toBe(20);
    expect(eq[1].cum).toBe(15);
    expect(eq[3].cum).toBe(45);
  });
});
