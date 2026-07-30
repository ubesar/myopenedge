/**
 * Momentum Candle detection — ported from the "Momentum Candle (Big Body Candle)"
 * Pine Script indicator (© Gautam_Dixit).
 *
 * Logic:
 *   body     = |close - open|
 *   avgBody  = SMA(body, 15)   (includes current bar, like ta.sma)
 *
 *   body <= avgBody              -> "below"  (weak / normal)
 *   avgBody < body <= 1.5*avg    -> "above"  (momentum rising)
 *   body > 1.5 * avgBody         -> "super"  (Momentum Candle / impulse)
 *
 * A "momentum candle" for every strategy in the app = Super Body candle.
 * This replaces the old fixed body/range >= 70% rule.
 */

export const MOMENTUM_SMA_PERIOD = 15;
export const SUPER_BODY_MULT = 1.5;
/** Minimum number of bars before a signal can be produced (SMA warm-up). */
export const MOMENTUM_MIN_WARMUP = 5;

export type MomentumLevel = "below" | "above" | "super";
export type MomentumDirection = "bullish" | "bearish";

export interface OHLC {
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface MomentumFlag {
  body: number;
  range: number;
  avgBody: number;
  level: MomentumLevel;
  direction: MomentumDirection | null;
  /** true when body > 1.5 * avgBody and the candle has a direction */
  isSuper: boolean;
}

const emptyFlag = (b: OHLC): MomentumFlag => ({
  body: Math.abs(b.close - b.open),
  range: b.high - b.low,
  avgBody: NaN,
  level: "below",
  direction: null,
  isSuper: false,
});

/**
 * Compute momentum classification for a chronological series of candles.
 * The rolling average is carried across the whole series (like a chart),
 * so pass a continuous series (multiple days concatenated is fine).
 */
export function computeMomentumFlags(
  bars: OHLC[],
  period: number = MOMENTUM_SMA_PERIOD,
  mult: number = SUPER_BODY_MULT,
): MomentumFlag[] {
  const out: MomentumFlag[] = [];
  const bodies = bars.map((b) => Math.abs(b.close - b.open));
  let sum = 0;

  for (let i = 0; i < bars.length; i++) {
    sum += bodies[i];
    if (i >= period) sum -= bodies[i - period];
    const count = Math.min(i + 1, period);
    const avgBody = sum / count;

    const b = bars[i];
    const flag = emptyFlag(b);
    flag.avgBody = avgBody;

    if (i + 1 < MOMENTUM_MIN_WARMUP || b.close === b.open || avgBody <= 0) {
      out.push(flag);
      continue;
    }

    flag.direction = b.close > b.open ? "bullish" : "bearish";
    if (flag.body > avgBody * mult) {
      flag.level = "super";
      flag.isSuper = true;
    } else if (flag.body > avgBody) {
      flag.level = "above";
    } else {
      flag.direction = null; // below-average candles are not directional signals
    }
    out.push(flag);
  }

  return out;
}

/**
 * Same as computeMomentumFlags but for day-segmented series: the rolling
 * average is computed across the concatenated series and then split back
 * per day, so early-session candles still get a valid average.
 */
export function computeMomentumFlagsByDay(
  days: OHLC[][],
  period: number = MOMENTUM_SMA_PERIOD,
  mult: number = SUPER_BODY_MULT,
): MomentumFlag[][] {
  const flat: OHLC[] = [];
  for (const d of days) flat.push(...d);
  const flags = computeMomentumFlags(flat, period, mult);
  const out: MomentumFlag[][] = [];
  let idx = 0;
  for (const d of days) {
    out.push(flags.slice(idx, idx + d.length));
    idx += d.length;
  }
  return out;
}

/** Convenience: is this bar a momentum (super body) candle? */
export function isMomentumCandle(flag: MomentumFlag | undefined): boolean {
  return !!flag?.isSuper;
}
