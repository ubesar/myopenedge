import { parse } from "date-fns";

interface BarData {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
}

export type PullbackLevel = 25 | 50 | 75;

export interface LevelStats {
  level: PullbackLevel;
  triggered: number;
  wins: number;
  losses: number;
  noTrigger: number;
  open: number;
  winRate: number; // wins / (wins+losses) * 100
  triggerRate: number; // triggered / total * 100
}

export interface IBPullbackSideStats {
  total: number;
  levels: Record<PullbackLevel, LevelStats>;
}

export interface IBPullbackDayTrade {
  date: string;
  side: "long" | "short"; // long when low-first; short when high-first
  ibHigh: number;
  ibLow: number;
  level: PullbackLevel;
  entry: number;
  stop: number;
  target: number;
  outcome: "win" | "loss" | "no-trigger" | "open";
  triggerTime?: string;
  resolvedTime?: string;
}

export interface IBPullbackResult {
  totalDays: number;
  ibWindowMinutes: number;
  longSide: IBPullbackSideStats;  // low-first days → long setups
  shortSide: IBPullbackSideStats; // high-first days → short setups
  overall: Record<PullbackLevel, LevelStats>;
  trades: IBPullbackDayTrade[];
}

const IB_START = 9 * 60 + 30;
const MARKET_CLOSE = 16 * 60;
const LEVELS: PullbackLevel[] = [25, 50, 75];

function parseDateTime(dt: string): Date {
  return parse(dt, "yyyy-MM-dd HH:mm:ss", new Date());
}

function getTimeMinutes(dt: Date): number {
  return dt.getHours() * 60 + dt.getMinutes();
}

function emptyLevel(level: PullbackLevel): LevelStats {
  return { level, triggered: 0, wins: 0, losses: 0, noTrigger: 0, open: 0, winRate: 0, triggerRate: 0 };
}

function emptySide(): IBPullbackSideStats {
  return {
    total: 0,
    levels: { 25: emptyLevel(25), 50: emptyLevel(50), 75: emptyLevel(75) },
  };
}

function finalize(stats: LevelStats, total: number) {
  const resolved = stats.wins + stats.losses;
  stats.winRate = resolved > 0 ? (stats.wins / resolved) * 100 : 0;
  stats.triggerRate = total > 0 ? (stats.triggered / total) * 100 : 0;
}

export function analyzeIBPullback(
  bars: BarData[],
  ibWindowMinutes: number = 60,
  maxDays: number = 0,
  weekdays: number[] = [1, 2, 3, 4, 5]
): IBPullbackResult {
  const ibEnd = IB_START + ibWindowMinutes;

  const byDate = new Map<string, BarData[]>();
  for (const bar of bars) {
    const date = bar.datetime.split(" ")[0];
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(bar);
  }

  let dates = Array.from(byDate.keys()).sort();
  if (maxDays > 0) dates = dates.slice(-maxDays);
  dates = dates.filter(d => {
    const day = new Date(d + "T12:00:00").getDay();
    return weekdays.includes(day);
  });

  const longSide = emptySide();
  const shortSide = emptySide();
  const trades: IBPullbackDayTrade[] = [];

  for (const date of dates) {
    const dayBars = byDate.get(date)!;
    dayBars.sort((a, b) => parseDateTime(a.datetime).getTime() - parseDateTime(b.datetime).getTime());

    const ibBars = dayBars.filter(b => {
      const m = getTimeMinutes(parseDateTime(b.datetime));
      return m >= IB_START && m < ibEnd;
    });
    if (ibBars.length < 2) continue;

    let ibHigh = -Infinity;
    let ibLow = Infinity;
    for (const bar of ibBars) {
      const h = parseFloat(bar.high);
      const l = parseFloat(bar.low);
      if (h > ibHigh) ibHigh = h;
      if (l < ibLow) ibLow = l;
    }

    let firstHighTouch = "";
    let firstLowTouch = "";
    for (const bar of ibBars) {
      if (!firstHighTouch && parseFloat(bar.high) >= ibHigh) firstHighTouch = bar.datetime;
      if (!firstLowTouch && parseFloat(bar.low) <= ibLow) firstLowTouch = bar.datetime;
    }
    if (!firstHighTouch || !firstLowTouch) continue;

    const highFirst = parseDateTime(firstHighTouch).getTime() < parseDateTime(firstLowTouch).getTime();
    const side: "long" | "short" = highFirst ? "short" : "long";
    const sideStats = highFirst ? shortSide : longSide;
    sideStats.total++;

    const range = ibHigh - ibLow;
    if (range <= 0) continue;

    const postIBBars = dayBars.filter(b => {
      const m = getTimeMinutes(parseDateTime(b.datetime));
      return m >= ibEnd && m < MARKET_CLOSE;
    });

    for (const level of LEVELS) {
      // Long (low-first): 0%=high, 100%=low → entry = high - (level/100)*range; SL=low; TP=high
      // Short (high-first): 0%=low, 100%=high → entry = low + (level/100)*range; SL=high; TP=low
      const entry = side === "long"
        ? ibHigh - (level / 100) * range
        : ibLow + (level / 100) * range;
      const stop = side === "long" ? ibLow : ibHigh;
      const target = side === "long" ? ibHigh : ibLow;

      let triggered = false;
      let outcome: "win" | "loss" | "no-trigger" | "open" = "no-trigger";
      let triggerTime: string | undefined;
      let resolvedTime: string | undefined;

      for (const bar of postIBBars) {
        const h = parseFloat(bar.high);
        const l = parseFloat(bar.low);
        const time = bar.datetime.split(" ")[1].slice(0, 5);

        if (!triggered) {
          const hit = side === "long" ? l <= entry : h >= entry;
          if (!hit) continue;
          triggered = true;
          triggerTime = time;
          // On same bar, check SL/TP after trigger
          const hitStop = side === "long" ? l <= stop : h >= stop;
          const hitTarget = side === "long" ? h >= target : l <= target;
          if (hitStop && hitTarget) { outcome = "loss"; resolvedTime = time; break; }
          if (hitTarget) { outcome = "win"; resolvedTime = time; break; }
          if (hitStop) { outcome = "loss"; resolvedTime = time; break; }
        } else {
          const hitStop = side === "long" ? l <= stop : h >= stop;
          const hitTarget = side === "long" ? h >= target : l <= target;
          if (hitStop && hitTarget) { outcome = "loss"; resolvedTime = time; break; }
          if (hitTarget) { outcome = "win"; resolvedTime = time; break; }
          if (hitStop) { outcome = "loss"; resolvedTime = time; break; }
        }
      }

      if (triggered && outcome === "no-trigger") outcome = "open";

      const lvlStats = sideStats.levels[level];
      if (outcome === "win") { lvlStats.triggered++; lvlStats.wins++; }
      else if (outcome === "loss") { lvlStats.triggered++; lvlStats.losses++; }
      else if (outcome === "open") { lvlStats.triggered++; lvlStats.open++; }
      else lvlStats.noTrigger++;

      trades.push({ date, side, ibHigh, ibLow, level, entry, stop, target, outcome, triggerTime, resolvedTime });
    }
  }

  for (const level of LEVELS) {
    finalize(longSide.levels[level], longSide.total);
    finalize(shortSide.levels[level], shortSide.total);
  }

  const overall: Record<PullbackLevel, LevelStats> = {
    25: emptyLevel(25), 50: emptyLevel(50), 75: emptyLevel(75),
  };
  const totalAll = longSide.total + shortSide.total;
  for (const level of LEVELS) {
    const a = longSide.levels[level];
    const b = shortSide.levels[level];
    const o = overall[level];
    o.triggered = a.triggered + b.triggered;
    o.wins = a.wins + b.wins;
    o.losses = a.losses + b.losses;
    o.noTrigger = a.noTrigger + b.noTrigger;
    o.open = a.open + b.open;
    finalize(o, totalAll);
  }

  return {
    totalDays: longSide.total + shortSide.total,
    ibWindowMinutes,
    longSide,
    shortSide,
    overall,
    trades,
  };
}
