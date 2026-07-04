import { parse } from "date-fns";
import type { CandleBar } from "./m15-aggregation";
import type { TpStats, DirStats, TradeDirection, TradeOutcome } from "./momentum-analysis";

interface BarData {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
}

export interface IB2575Trade {
  date: string;
  direction: TradeDirection;   // bullish = long IB75, bearish = short IB25
  ibHigh: number;
  ibLow: number;
  ib25: number;
  ib50: number;
  ib75: number;
  confirmClose: number;        // close of 10:25 candle
  entry: number;               // limit @ IB25 (short) or IB75 (long)
  stop: number;                // IB50
  target: number;              // IB0 (short) or IB100 (long)
  triggered: boolean;          // limit order filled by 16:00
  outcome: TradeOutcome;       // win/loss/open
}

export interface IB2575Result {
  totalDays: number;
  daysWithSignal: number;
  totalTrades: number;
  triggeredTrades: number;
  ibWindowMinutes: number;
  stats: TpStats;
  trades: IB2575Trade[];
}

const RTH_START = 9 * 60 + 30;
const CONFIRM_TIME = 10 * 60 + 25; // 10:25 candle
const MARKET_CLOSE = 16 * 60;

function parseDateTime(dt: string): Date { return parse(dt, "yyyy-MM-dd HH:mm:ss", new Date()); }
function timeMin(dt: Date): number { return dt.getHours() * 60 + dt.getMinutes(); }
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
 * Walk m5 bars starting at index `startIdx` (bar AFTER confirmation) until MARKET_CLOSE.
 * Limit order: bullish (long @ IB75) fills when bar.low <= entry; bearish (short @ IB25) fills when bar.high >= entry.
 * After fill, in same/subsequent bars: SL/TP tracked. If both hit same bar -> conservative loss.
 */
function resolve(
  m5: CandleBar[],
  startIdx: number,
  direction: TradeDirection,
  entry: number,
  stop: number,
  target: number,
): { triggered: boolean; outcome: TradeOutcome } {
  let triggered = false;
  for (let i = startIdx; i < m5.length; i++) {
    const b = m5[i];
    if (!triggered) {
      const fill = direction === "bullish" ? b.low <= entry : b.high >= entry;
      if (!fill) continue;
      triggered = true;
    }
    const hitStop = direction === "bullish" ? b.low <= stop : b.high >= stop;
    const hitTp = direction === "bullish" ? b.high >= target : b.low <= target;
    if (hitStop && hitTp) return { triggered, outcome: "loss" };
    if (hitTp) return { triggered, outcome: "win" };
    if (hitStop) return { triggered, outcome: "loss" };
  }
  return { triggered, outcome: "open" };
}

export function analyzeIB2575(
  bars: BarData[],
  ibWindow: number = 60,
  maxDays: number = 0,
  weekdays: number[] = [1, 2, 3, 4, 5],
): IB2575Result {
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

  const IB_END = RTH_START + ibWindow;

  const trades: IB2575Trade[] = [];
  let totalDays = 0;
  let daysWithSignal = 0;

  for (const date of dates) {
    const dayBars = byDate.get(date)!;
    dayBars.sort((a, b) => parseDateTime(a.datetime).getTime() - parseDateTime(b.datetime).getTime());

    const sessionRaw = dayBars.filter((b) => {
      const m = timeMin(parseDateTime(b.datetime));
      return m >= RTH_START && m < MARKET_CLOSE;
    });
    if (sessionRaw.length === 0) continue;

    const m5: CandleBar[] = sessionRaw.map((b) => ({
      time: b.datetime.split(" ")[1].slice(0, 5),
      open: parseFloat(b.open),
      high: parseFloat(b.high),
      low: parseFloat(b.low),
      close: parseFloat(b.close),
    }));

    if (m5[0].time !== "09:30") continue;

    // IB bars: from 09:30 up to (but not including) IB_END
    const ibBars = m5.filter((b) => {
      const [h, mi] = b.time.split(":").map(Number);
      const t = h * 60 + mi;
      return t >= RTH_START && t < IB_END;
    });
    if (ibBars.length === 0) continue;

    const ibHigh = Math.max(...ibBars.map((b) => b.high));
    const ibLow = Math.min(...ibBars.map((b) => b.low));
    const range = ibHigh - ibLow;
    if (range <= 0) continue;

    const ib25 = ibLow + range * 0.25;
    const ib50 = ibLow + range * 0.5;
    const ib75 = ibLow + range * 0.75;

    totalDays++;

    // Confirmation candle: 5m bar timestamped 10:25 (covers 10:25-10:30)
    const confirmIdx = m5.findIndex((b) => {
      const [h, mi] = b.time.split(":").map(Number);
      return h * 60 + mi === CONFIRM_TIME;
    });
    if (confirmIdx === -1) continue;
    const confirm = m5[confirmIdx];

    let direction: TradeDirection | null = null;
    if (confirm.close < ib25) direction = "bearish";
    else if (confirm.close > ib75) direction = "bullish";
    if (!direction) continue;

    const entry = direction === "bullish" ? ib75 : ib25;
    const stop = ib50;
    const target = direction === "bullish" ? ibHigh : ibLow;

    // Walk from next bar after confirmation
    const r = resolve(m5, confirmIdx + 1, direction, entry, stop, target);

    trades.push({
      date,
      direction,
      ibHigh, ibLow, ib25, ib50, ib75,
      confirmClose: confirm.close,
      entry, stop, target,
      triggered: r.triggered,
      outcome: r.triggered ? r.outcome : "open",
    });
    daysWithSignal++;
  }

  const stats = emptyTp();
  let triggeredTrades = 0;
  for (const t of trades) {
    if (t.triggered) triggeredTrades++;
    stats.total++;
    const bucket = t.direction === "bullish" ? stats.bullish : stats.bearish;
    bucket.total++;
    if (t.outcome === "win") { stats.wins++; bucket.wins++; }
    else if (t.outcome === "loss") { stats.losses++; bucket.losses++; }
    else stats.open++;
  }
  finalizeTp(stats);

  return {
    totalDays,
    daysWithSignal,
    totalTrades: trades.length,
    triggeredTrades,
    ibWindowMinutes: ibWindow,
    stats,
    trades,
  };
}
