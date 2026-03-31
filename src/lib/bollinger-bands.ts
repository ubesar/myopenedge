import type { CandleBar } from "./m15-aggregation";

export interface BBValues {
  upper: number;
  middle: number;
  lower: number;
}

export interface BBBar extends CandleBar {
  bb: BBValues | null;
}

/** Compute Bollinger Band values for a single window of close prices */
function computeSingleBB(closes: number[], multiplier: number): BBValues {
  const n = closes.length;
  const sma = closes.reduce((a, b) => a + b, 0) / n;
  const variance = closes.reduce((sum, c) => sum + (c - sma) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);
  return {
    upper: sma + multiplier * stdDev,
    middle: sma,
    lower: sma - multiplier * stdDev,
  };
}

/** Compute BB for each bar in a series (rolling window) */
export function computeBBSeries(
  bars: CandleBar[],
  period: number = 20,
  multiplier: number = 2
): BBBar[] {
  return bars.map((bar, i) => {
    if (i < period - 1) return { ...bar, bb: null };
    const window = bars.slice(i - period + 1, i + 1).map((b) => b.close);
    return { ...bar, bb: computeSingleBB(window, multiplier) };
  });
}
