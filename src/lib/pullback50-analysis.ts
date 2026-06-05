import { parse } from "date-fns";
import { aggregateBars, type CandleBar } from "./m15-aggregation";
import type { TpStats, DirStats, TradeDirection, TradeOutcome } from "./momentum-analysis";

interface BarData {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
}

export interface Pullback50Trade {
  date: string;
  signalTime: string;
  direction: TradeDirection;
  entry: number;     // midpoint of candle 1
  stop: number;      // far end of candle 1
  target: number;    // opposite end of candle 1
  outcome: TradeOutcome;
  triggered: boolean;
}

export interface Pullback50Result {
  totalDays: number;
  daysWithSignal: number;
  sessionEndMinutes: number;
  bodyThreshold: number;
  totalTrades: number;
  stats: TpStats;
  trades: Pullback50Trade[];
}

const IB_START = 9 * 60 + 30;   // 09:30 NY
const MARKET_CLOSE = 16 * 60;   // 16:00 NY
const DEFAULT_BODY_THRESHOLD = 0.7;
const TF_MINUTES = 15;

function parseDateTime(dt: string): Date {
  return parse(dt, "yyyy-MM-dd HH:mm:ss", new Date());
}
function getTimeMinutes(dt: Date): number {
  return dt.getHours() * 60 + dt.getMinutes();
}
function emptyDir(): DirStats { return { total: 0, wins: 0, losses: 0, winRate: 0 }; }
function emptyTp(): TpStats {
  return { total: 0, wins: 0, losses: 0, open: 0, winRate: 0, bullish: emptyDir(), bearish: emptyDir() };
}
function finalizeTp(s: TpStats) {
  const dw = s.wins + s.losses;
  s.winRate = dw > 0 ? (s.wins / dw) * 100 : 0;
  const bd = s.bullish.wins + s.bullish.losses;
  s.bullish.winRate = bd > 0 ? (s.bullish.wins / bd) * 100 : 0;
  const rd = s.bearish.wins + s.bearish.losses;
  s.bearish.winRate = rd > 0 ? (s.bearish.wins / rd) * 100 : 0;
}

/**
 * Pullback 50% strategy:
 * After a momentum candle (candle 1), wait for price to retrace to the 50% level
 * of candle 1 (entry trigger). SL at far end of candle 1, TP at opposite end.
 * If both SL and TP hit in the same bar -> loss (conservative).
 * If never triggered before market close -> outcome = "open".
 */
const MAX_TRIGGER_LOOKAHEAD = 2; // candle 2 and candle 3 only

function resolvePullback(
  bars: CandleBar[],
  startIdx: number,
  direction: TradeDirection,
  entry: number,
  stop: number,
  target: number,
  bodyThreshold: number,
): { outcome: TradeOutcome; resolvedIdx: number; triggered: boolean } {
  let triggered = false;
  let triggerDeadline = Math.min(startIdx + MAX_TRIGGER_LOOKAHEAD, bars.length - 1);
  for (let i = startIdx + 1; i < bars.length; i++) {
    const b = bars[i];
    if (!triggered) {
      // Bullish: price retraces DOWN into midpoint. Bearish: price retraces UP into midpoint.
      const trig = direction === "bullish" ? b.low <= entry : b.high >= entry;
      if (!trig) {
        // Invalidate candle 1 if this untriggered bar is itself a momentum candle
        // (it will become the new candle 1 in the outer loop).
        const range = b.high - b.low;
        const body = Math.abs(b.close - b.open);
        const isMomentum = range > 0 && b.close !== b.open && body / range >= bodyThreshold;
        if (isMomentum) {
          return { outcome: "open", resolvedIdx: i - 1, triggered: false };
        }
        if (i >= triggerDeadline) {
          return { outcome: "open", resolvedIdx: i, triggered: false };
        }
        continue;
      }
      triggered = true;
    }
    let hitStop: boolean;
    let hitTarget: boolean;
    if (direction === "bullish") {
      hitStop = b.low <= stop;
      hitTarget = b.high >= target;
    } else {
      hitStop = b.high >= stop;
      hitTarget = b.low <= target;
    }
    if (hitStop && hitTarget) return { outcome: "loss", resolvedIdx: i, triggered };
    if (hitTarget) return { outcome: "win", resolvedIdx: i, triggered };
    if (hitStop) return { outcome: "loss", resolvedIdx: i, triggered };
  }
  return { outcome: "open", resolvedIdx: bars.length - 1, triggered };
}

export function analyzePullback50(
  bars: BarData[],
  maxDays: number = 0,
  weekdays: number[] = [1, 2, 3, 4, 5],
  sessionEndMinutes: number = 13 * 60,
  bodyThreshold: number = DEFAULT_BODY_THRESHOLD,
): Pullback50Result {
  const byDate = new Map<string, BarData[]>();
  for (const bar of bars) {
    const date = bar.datetime.split(" ")[0];
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(bar);
  }

  let dates = Array.from(byDate.keys()).sort();
  if (maxDays > 0) dates = dates.slice(-maxDays);
  dates = dates.filter((d) => {
    const day = new Date(d + "T12:00:00").getDay();
    return weekdays.includes(day);
  });

  const trades: Pullback50Trade[] = [];
  let daysWithSignal = 0;
  let totalDays = 0;

  for (const date of dates) {
    const dayBars = byDate.get(date)!;
    dayBars.sort((a, b) => parseDateTime(a.datetime).getTime() - parseDateTime(b.datetime).getTime());

    const sessionRaw = dayBars.filter((b) => {
      const m = getTimeMinutes(parseDateTime(b.datetime));
      return m >= IB_START && m < MARKET_CLOSE;
    });
    if (sessionRaw.length === 0) continue;

    const m5: CandleBar[] = sessionRaw.map((b) => ({
      time: b.datetime.split(" ")[1].slice(0, 5),
      open: parseFloat(b.open),
      high: parseFloat(b.high),
      low: parseFloat(b.low),
      close: parseFloat(b.close),
    }));

    const m15 = aggregateBars(m5, TF_MINUTES);
    if (m15.length < 2) continue;
    totalDays++;

    let signalsToday = 0;
    let gateUntil = -1;

    for (let i = 0; i < m15.length - 1; i++) {
      if (i <= gateUntil) continue;
      const c = m15[i];
      const [hh, mm] = c.time.split(":").map(Number);
      const tMin = hh * 60 + mm;
      if (tMin < IB_START || tMin >= sessionEndMinutes) continue;

      const range = c.high - c.low;
      if (range <= 0) continue;
      const body = Math.abs(c.close - c.open);
      if (c.close === c.open) continue;
      if (body / range < BODY_THRESHOLD) continue;

      const direction: TradeDirection = c.close > c.open ? "bullish" : "bearish";
      const entry = (c.high + c.low) / 2;
      const stop = direction === "bullish" ? c.low : c.high;
      const target = direction === "bullish" ? c.high : c.low;

      const r = resolvePullback(m15, i, direction, entry, stop, target);

      // Skip unresolved/untriggered trades — only count win/loss outcomes.
      if (r.outcome === "open") continue;

      trades.push({
        date,
        signalTime: c.time,
        direction,
        entry,
        stop,
        target,
        outcome: r.outcome,
        triggered: r.triggered,
      });

      signalsToday++;
      gateUntil = r.resolvedIdx;
    }

    if (signalsToday > 0) daysWithSignal++;
  }

  const stats = emptyTp();
  for (const t of trades) {
    stats.total++;
    const bucket = t.direction === "bullish" ? stats.bullish : stats.bearish;
    bucket.total++;
    if (t.outcome === "win") { stats.wins++; bucket.wins++; }
    else if (t.outcome === "loss") { stats.losses++; bucket.losses++; }
    else { stats.open++; }
  }
  finalizeTp(stats);

  return {
    totalDays,
    daysWithSignal,
    sessionEndMinutes,
    bodyThreshold: BODY_THRESHOLD,
    totalTrades: trades.length,
    stats,
    trades,
  };
}
