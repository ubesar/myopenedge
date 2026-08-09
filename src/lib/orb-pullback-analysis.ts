import { parse } from "date-fns";
import { aggregateBars, type CandleBar } from "./m15-aggregation";
import { computeMomentumFlagsByDay, SUPER_BODY_MULT, type MomentumFlag } from "./momentum-candle";

export type ORBDirection = "bullish" | "bearish";
export type ORBStatus = "win" | "loss" | "invalidated" | "no_trigger" | "open";

interface BarData {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
}

export interface ORBPullbackTrade {
  date: string;
  signalTime: string;      // candle 1 time
  triggerTime?: string;    // m15 bar where the stop order filled
  direction: ORBDirection;
  candle1High: number;
  candle1Low: number;
  candle1Mid: number;
  pullbackExtreme: number; // deepest pullback of candle 2 before trigger
  pullbackPct: number;     // 0..1 of candle 1 range
  entry: number;           // trigger price (candle 1 high / low)
  stop: number;            // final sl (dynamic = candle 2 extreme)
  target: number;          // tp = entry ± tpMult * candle1 range
  status: ORBStatus;
  realizedRR: number;      // tp distance / sl distance
}

export interface ORBPullbackResult {
  totalDays: number;
  daysWithSignal: number;
  sessionStartMinutes: number;
  sessionEndMinutes: number;
  bodyThreshold: number;
  pullbackThreshold: number;
  tpMultiplier: number;
  dynamicSl: boolean;
  setups: number;
  invalidated: number;
  noTrigger: number;
  triggered: number;
  wins: number;
  losses: number;
  winRate: number;
  avgRR: number;
  bullish: { total: number; wins: number; losses: number; winRate: number };
  bearish: { total: number; wins: number; losses: number; winRate: number };
  trades: ORBPullbackTrade[];
}

export interface ORBPullbackOptions {
  maxDays?: number;
  weekdays?: number[];
  sessionStartMinutes?: number;
  sessionEndMinutes?: number;
  sessionCloseMinutes?: number;
  /** max retracement into candle 1 (fraction of candle 1 range) before the setup is invalidated */
  pullbackThreshold?: number;
  /** tp = entry ± tpMultiplier * candle 1 range */
  tpMultiplier?: number;
  /** sl at candle 2 running extreme (true) or far end of candle 1 (false) */
  dynamicSl?: boolean;
  /** how many candles after candle 1 may trigger the stop order */
  triggerLookahead?: number;
  /** finer-grained bars (m1/m5) used for intrabar sequencing */
  intraBars?: BarData[];
}

const IB_START = 9 * 60 + 30;
const MARKET_CLOSE = 16 * 60;
const TF_MINUTES = 15;

function parseDateTime(dt: string): Date {
  return parse(dt, "yyyy-MM-dd HH:mm:ss", new Date());
}
function pad2(n: number) { return String(n).padStart(2, "0"); }
function fmtDate(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function minutesToLabel(min: number) { return `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`; }
function labelToMinutes(label: string) {
  const [h, m] = label.split(":").map(Number);
  return h * 60 + m;
}

/**
 * ORB M15 pullback with buy/sell stop entry and dynamic stop loss.
 *
 * candle 1 : m15 momentum candle (body > 1.5x avg body sma15)
 * candle 2 : pullback into candle 1 body — invalidated if it retraces deeper
 *            than `pullbackThreshold` of candle 1 range before triggering
 * entry    : stop order at candle 1 high (long) / low (short)
 * sl       : running extreme of the pullback candles (dynamic) or far end of candle 1
 * tp       : entry ± tpMultiplier * candle 1 range (extension target)
 */
export function analyzeORBPullback(bars: BarData[], opts: ORBPullbackOptions = {}): ORBPullbackResult {
  const {
    maxDays = 0,
    weekdays = [1, 2, 3, 4, 5],
    sessionStartMinutes = IB_START,
    sessionEndMinutes = 13 * 60,
    sessionCloseMinutes = MARKET_CLOSE,
    pullbackThreshold = 0.5,
    tpMultiplier = 0.5,
    dynamicSl = true,
    triggerLookahead = 2,
    intraBars,
  } = opts;

  const wrapCutoff = sessionCloseMinutes > 24 * 60 ? sessionCloseMinutes - 24 * 60 : 0;
  const sessionKey = (bar: BarData) => {
    const dt = parseDateTime(bar.datetime);
    const m = dt.getHours() * 60 + dt.getMinutes();
    if (wrapCutoff > 0 && m < wrapCutoff) {
      const prev = new Date(dt.getTime());
      prev.setDate(prev.getDate() - 1);
      return { date: fmtDate(prev), min: m + 24 * 60 };
    }
    return { date: bar.datetime.split(" ")[0], min: m };
  };

  const byDate = new Map<string, { min: number; bar: BarData }[]>();
  for (const bar of bars) {
    const k = sessionKey(bar);
    if (!byDate.has(k.date)) byDate.set(k.date, []);
    byDate.get(k.date)!.push({ min: k.min, bar });
  }

  const intraByDate = new Map<string, CandleBar[]>();
  if (intraBars?.length) {
    for (const bar of intraBars) {
      const k = sessionKey(bar);
      if (!intraByDate.has(k.date)) intraByDate.set(k.date, []);
      intraByDate.get(k.date)!.push({
        time: minutesToLabel(k.min),
        open: parseFloat(bar.open),
        high: parseFloat(bar.high),
        low: parseFloat(bar.low),
        close: parseFloat(bar.close),
      });
    }
    for (const arr of intraByDate.values()) arr.sort((a, b) => labelToMinutes(a.time) - labelToMinutes(b.time));
  }

  let dates = Array.from(byDate.keys()).sort();
  if (maxDays > 0) dates = dates.slice(-maxDays);
  dates = dates.filter((d) => weekdays.includes(new Date(d + "T12:00:00").getDay()));

  const daySeries: { date: string; m15: CandleBar[]; m5: CandleBar[] }[] = [];
  for (const date of dates) {
    const dayBars = byDate.get(date)!.slice().sort((a, b) => a.min - b.min);
    const sessionRaw = dayBars.filter((b) => b.min >= sessionStartMinutes && b.min < sessionCloseMinutes);
    if (sessionRaw.length === 0) continue;
    const m5: CandleBar[] = sessionRaw.map((b) => ({
      time: minutesToLabel(b.min),
      open: parseFloat(b.bar.open),
      high: parseFloat(b.bar.high),
      low: parseFloat(b.bar.low),
      close: parseFloat(b.bar.close),
    }));
    const m15 = aggregateBars(m5, TF_MINUTES);
    if (m15.length < 3) continue;
    daySeries.push({ date, m15, m5 });
  }

  const flagsByDay = computeMomentumFlagsByDay(daySeries.map((d) => d.m15));

  const trades: ORBPullbackTrade[] = [];
  let daysWithSignal = 0;
  let totalDays = 0;

  for (let d = 0; d < daySeries.length; d++) {
    const { date, m15, m5 } = daySeries[d];
    const flags: MomentumFlag[] = flagsByDay[d];
    totalDays++;

    const dayIntra = intraByDate.get(date) ?? m5;
    const intraOf = (idx: number) => {
      const from = labelToMinutes(m15[idx].time);
      const to = from + TF_MINUTES;
      const sub = dayIntra.filter((b) => {
        const m = labelToMinutes(b.time);
        return m >= from && m < to;
      });
      return sub.length ? sub : [m15[idx]];
    };

    let signalsToday = 0;
    let gateUntil = -1;

    for (let i = 0; i < m15.length - 1; i++) {
      if (i <= gateUntil) continue;
      const c1 = m15[i];
      const tMin = labelToMinutes(c1.time);
      if (tMin < sessionStartMinutes || tMin >= sessionEndMinutes) continue;

      const flag = flags[i];
      if (!flag?.isSuper || !flag.direction) continue;

      const range = c1.high - c1.low;
      if (range <= 0) continue;

      const direction: ORBDirection = flag.direction;
      const entry = direction === "bullish" ? c1.high : c1.low;
      const mid = (c1.high + c1.low) / 2;
      const invalidLevel =
        direction === "bullish" ? c1.high - range * pullbackThreshold : c1.low + range * pullbackThreshold;
      const target = direction === "bullish" ? entry + range * tpMultiplier : entry - range * tpMultiplier;

      // Walk the pullback candles looking for the stop-order trigger.
      const deadline = Math.min(i + triggerLookahead, m15.length - 1);
      let pullbackExtreme = direction === "bullish" ? c1.high : c1.low;
      let triggerIdx = -1;
      let triggerBarPos = 0;
      let invalidated = false;

      outer: for (let j = i + 1; j <= deadline; j++) {
        for (const [pos, s] of intraOf(j).entries()) {
          // track the running pullback extreme (this becomes the dynamic sl)
          if (direction === "bullish") pullbackExtreme = Math.min(pullbackExtreme, s.low);
          else pullbackExtreme = Math.max(pullbackExtreme, s.high);

          const tooDeep = direction === "bullish" ? pullbackExtreme < invalidLevel : pullbackExtreme > invalidLevel;
          if (tooDeep) { invalidated = true; break outer; }

          const trig = direction === "bullish" ? s.high >= entry : s.low <= entry;
          if (trig) { triggerIdx = j; triggerBarPos = pos; break outer; }
        }
      }

      const pullbackPct = Math.abs(entry - pullbackExtreme) / range;

      if (invalidated || triggerIdx < 0) {
        trades.push({
          date,
          signalTime: c1.time,
          direction,
          candle1High: c1.high,
          candle1Low: c1.low,
          candle1Mid: mid,
          pullbackExtreme,
          pullbackPct,
          entry,
          stop: dynamicSl ? pullbackExtreme : direction === "bullish" ? c1.low : c1.high,
          target,
          status: invalidated ? "invalidated" : "no_trigger",
          realizedRR: 0,
        });
        signalsToday++;
        gateUntil = Math.min(deadline, m15.length - 1);
        continue;
      }

      const stop = dynamicSl ? pullbackExtreme : direction === "bullish" ? c1.low : c1.high;
      const slDist = Math.abs(entry - stop);
      const tpDist = Math.abs(target - entry);
      if (slDist <= 0) { gateUntil = triggerIdx; continue; }

      // Resolve tp/sl walking the finer series from the trigger bar onwards.
      let status: ORBStatus = "open";
      let resolvedIdx = m15.length - 1;
      resolve: for (let j = triggerIdx; j < m15.length; j++) {
        const seq = intraOf(j);
        for (let p = j === triggerIdx ? triggerBarPos : 0; p < seq.length; p++) {
          const s = seq[p];
          const hitStop = direction === "bullish" ? s.low <= stop : s.high >= stop;
          const hitTp = direction === "bullish" ? s.high >= target : s.low <= target;
          if (hitStop && hitTp) { status = "loss"; resolvedIdx = j; break resolve; }
          if (hitTp) { status = "win"; resolvedIdx = j; break resolve; }
          if (hitStop) { status = "loss"; resolvedIdx = j; break resolve; }
        }
      }

      trades.push({
        date,
        signalTime: c1.time,
        triggerTime: m15[triggerIdx].time,
        direction,
        candle1High: c1.high,
        candle1Low: c1.low,
        candle1Mid: mid,
        pullbackExtreme,
        pullbackPct,
        entry,
        stop,
        target,
        status,
        realizedRR: tpDist / slDist,
      });

      signalsToday++;
      gateUntil = flags[resolvedIdx]?.isSuper ? resolvedIdx - 1 : resolvedIdx;
    }

    if (signalsToday > 0) daysWithSignal++;
  }

  const decided = trades.filter((t) => t.status === "win" || t.status === "loss");
  const wins = decided.filter((t) => t.status === "win").length;
  const losses = decided.filter((t) => t.status === "loss").length;
  const dir = (k: ORBDirection) => {
    const set = decided.filter((t) => t.direction === k);
    const w = set.filter((t) => t.status === "win").length;
    const l = set.length - w;
    return { total: set.length, wins: w, losses: l, winRate: set.length ? (w / set.length) * 100 : 0 };
  };

  return {
    totalDays,
    daysWithSignal,
    sessionStartMinutes,
    sessionEndMinutes,
    bodyThreshold: SUPER_BODY_MULT,
    pullbackThreshold,
    tpMultiplier,
    dynamicSl,
    setups: trades.length,
    invalidated: trades.filter((t) => t.status === "invalidated").length,
    noTrigger: trades.filter((t) => t.status === "no_trigger").length,
    triggered: decided.length + trades.filter((t) => t.status === "open").length,
    wins,
    losses,
    winRate: decided.length ? (wins / decided.length) * 100 : 0,
    avgRR: decided.length ? decided.reduce((s, t) => s + t.realizedRR, 0) / decided.length : 0,
    bullish: dir("bullish"),
    bearish: dir("bearish"),
    trades,
  };
}
