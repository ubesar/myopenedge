import { describe, it, expect } from "vitest";
import { analyzeOCC } from "./occ-analysis";

interface Bar {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
}

// Helper: build 5-min RTH bars (09:30 -> 16:00) for a given date with a
// directional opening 30-minute candle and a final close direction.
function buildDay(
  date: string,
  openingGreen: boolean,
  dayEndGreen: boolean,
): Bar[] {
  const bars: Bar[] = [];
  const dayOpen = 100;
  // 6 bars * 5min = first 30min (the 30m opening candle)
  // opening close after 30 min
  const openingClose = openingGreen ? dayOpen + 2 : dayOpen - 2;
  // final daily close
  const dailyClose = dayEndGreen ? dayOpen + 5 : dayOpen - 5;

  // 09:30 - 16:00 = 78 bars of 5 min
  const totalBars = 78;
  for (let i = 0; i < totalBars; i++) {
    const minutes = 9 * 60 + 30 + i * 5;
    const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
    const mm = String(minutes % 60).padStart(2, "0");
    const dt = `${date} ${hh}:${mm}:00`;

    let o: number, c: number;
    if (i === 0) {
      o = dayOpen;
      // first sub-bar of opening candle
      c = openingGreen ? dayOpen + 0.3 : dayOpen - 0.3;
    } else if (i < 6) {
      // remaining opening 5m bars; ensure last (i==5) closes at openingClose
      o = openingGreen ? dayOpen + 0.3 * i : dayOpen - 0.3 * i;
      c = i === 5 ? openingClose : openingGreen ? dayOpen + 0.3 * (i + 1) : dayOpen - 0.3 * (i + 1);
    } else if (i === totalBars - 1) {
      o = dailyClose;
      c = dailyClose;
    } else {
      o = openingClose;
      c = openingClose;
    }
    const high = Math.max(o, c) + 0.1;
    const low = Math.min(o, c) - 0.1;
    bars.push({
      datetime: dt,
      open: o.toFixed(2),
      high: high.toFixed(2),
      low: low.toFixed(2),
      close: c.toFixed(2),
    });
  }
  return bars;
}

describe("analyzeOCC", () => {
  it("returns the documented schema with greenCandle/redCandle", () => {
    // Mon 2025-01-06 (green/green), Tue 2025-01-07 (red/red)
    const bars = [
      ...buildDay("2025-01-06", true, true),
      ...buildDay("2025-01-07", false, false),
    ];

    const result = analyzeOCC(bars, 0, "30m");

    expect(result.totalDays).toBe(2);
    expect(result.candleSize).toBe("30m");
    expect(result.greenCandle).toBeDefined();
    expect(result.redCandle).toBeDefined();
    expect(result.allDays).toHaveLength(2);

    // Both opening green continued -> 100% green day
    expect(result.greenCandle.total).toBe(1);
    expect(result.greenCandle.greenDayPct).toBe(100);
    expect(result.greenCandle.redDayPct).toBe(0);

    // Red opening continued red -> 100% red day
    expect(result.redCandle.total).toBe(1);
    expect(result.redCandle.redDayPct).toBe(100);
    expect(result.redCandle.greenDayPct).toBe(0);
  });

  it("does not expose legacy fields (tfStats / bullishDays)", () => {
    const bars = buildDay("2025-01-06", true, true);
    const result = analyzeOCC(bars, 0, "30m") as Record<string, unknown>;
    expect(result.tfStats).toBeUndefined();
    expect(result.tfDirectionStats).toBeUndefined();
    expect(result.bullishDays).toBeUndefined();
  });
});
