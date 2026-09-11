/**
 * Peer Breadth Diffusion (Candidate 18) — daily-bar engine.
 * Port of 02_peer_breadth_backtest.py (revision answering AUDIT.md):
 * funding settlement -> known open-time exits -> admission on OPEN-TIME equity
 * with one open slot per coin and pro-rata batch sizing -> intraday protection -> close marks.
 */

export interface DailyBar {
  date: string; // YYYY-MM-DD (UTC day)
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface FundingEvent {
  time: number; // epoch ms
  rate: number;
}

export interface SymbolData {
  bars: DailyBar[];
  funding?: FundingEvent[];
}

export const PEER_BREADTH_UNIVERSE = [
  "1000PEPEUSDT", "AAVEUSDT", "ADAUSDT", "AVAXUSDT", "BCHUSDT", "BNBUSDT", "BTCUSDT",
  "DOGEUSDT", "ETHUSDT", "FILUSDT", "LINKUSDT", "LTCUSDT", "NEARUSDT", "SOLUSDT",
  "SUIUSDT", "TRXUSDT", "UNIUSDT", "WLDUSDT", "XRPUSDT", "ZECUSDT",
];

export interface PeerBreadthConfig {
  breadthBars: number;      // 5
  breadthFraction: number;  // 0.70
  minPeers: number;         // 8
  peerCoverage: number;     // 0.8
  atrPeriod: number;        // 14
  stopAtr: number;          // 2.5
  minStopPct: number;       // 0.005
  maxStopPct: number;       // 0.20
  targetR: number;          // 3.0
  maxHoldDays: number;      // 14
  warmupBars: number;       // 25
  startEquity: number;      // 100000
  riskFraction: number;     // 0.0025
  riskCap: number;          // 0.015
  grossCap: number;         // 2.0
  feePerSide: number;       // 0.0010
  minNotional: number;      // 100
  useFunding: boolean;
}

export const DEFAULT_PEER_BREADTH_CONFIG: PeerBreadthConfig = {
  breadthBars: 5,
  breadthFraction: 0.7,
  minPeers: 8,
  peerCoverage: 0.8,
  atrPeriod: 14,
  stopAtr: 2.5,
  minStopPct: 0.005,
  maxStopPct: 0.2,
  targetR: 3,
  maxHoldDays: 14,
  warmupBars: 25,
  startEquity: 100_000,
  riskFraction: 0.0025,
  riskCap: 0.015,
  grossCap: 2,
  feePerSide: 0.001,
  minNotional: 100,
  useFunding: true,
};

export interface PeerBreadthSignal {
  date: string;
  symbol: string;
  side: 1 | -1;
  stopPct: number;
  positiveShare: number;
  negativeShare: number;
  eligiblePeers: number;
  ownReturn: number;
  close: number;
}

export interface PeerBreadthTrade {
  symbol: string;
  side: 1 | -1;
  signalDate: string;
  entryDate: string;
  entry: number;
  qty: number;
  stop: number;
  target: number;
  notional: number;
  initialRisk: number;
  exitDate: string;
  exit: number;
  reason: "stop" | "target" | "time" | "end_of_data";
  grossPnl: number;
  fees: number;
  fundingPaid: number;
  netPnl: number;
  rMultiple: number;
}

export interface EquityPoint {
  date: string;
  equity: number;
  cash: number;
  openPositions: number;
  grossNotionalPct: number;
  openRiskPct: number;
}

export interface PeerBreadthStats {
  trades: number;
  wins: number;
  winRate: number;
  profitFactor: number;
  netPnl: number;
  returnPct: number;
  maxDrawdownPct: number;
  avgTrade: number;
  sharpe: number;
  sortino: number;
  cagr: number;
  calmar: number;
  expectancyR: number;
  timeInMarketPct: number;
  reasonCounts: Record<string, number>;
  finalEquity: number;
}

export interface PeerBreadthResult {
  signals: PeerBreadthSignal[];
  trades: PeerBreadthTrade[];
  equity: EquityPoint[];
  stats: PeerBreadthStats;
  perSymbol: { symbol: string; trades: number; netPnl: number; winRate: number }[];
  latestSignals: PeerBreadthSignal[];
}

const dayMs = 86_400_000;
const toMs = (d: string) => Date.parse(`${d}T00:00:00Z`);

function trueRanges(bars: DailyBar[]): number[] {
  return bars.map((b, i) => {
    if (i === 0) return b.high - b.low;
    const pc = bars[i - 1].close;
    return Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc));
  });
}

function simpleAtr(bars: DailyBar[], period: number): (number | null)[] {
  const tr = trueRanges(bars);
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < tr.length; i++) {
    sum += tr[i];
    if (i >= period) sum -= tr[i - period];
    out.push(i >= period - 1 ? sum / period : null);
  }
  return out;
}

/** Signal generation across the whole universe. */
export function generatePeerBreadthSignals(
  data: Record<string, SymbolData>,
  cfg: PeerBreadthConfig = DEFAULT_PEER_BREADTH_CONFIG
): PeerBreadthSignal[] {
  const symbols = Object.keys(data).filter((s) => (data[s]?.bars?.length ?? 0) > 0);
  if (symbols.length < 2) return [];

  const allDates = Array.from(
    new Set(symbols.flatMap((s) => data[s].bars.map((b) => b.date)))
  ).sort();

  // close and 5-day return per symbol keyed by date
  const closeBy: Record<string, Map<string, number>> = {};
  const chgBy: Record<string, Map<string, number>> = {};
  const atrBy: Record<string, Map<string, number>> = {};
  const barBy: Record<string, Map<string, DailyBar>> = {};
  const warmDate: Record<string, string> = {};

  for (const s of symbols) {
    const bars = data[s].bars.slice().sort((a, b) => (a.date < b.date ? -1 : 1));
    const cm = new Map<string, number>();
    const gm = new Map<string, number>();
    const am = new Map<string, number>();
    const bm = new Map<string, DailyBar>();
    const atr = simpleAtr(bars, cfg.atrPeriod);
    bars.forEach((b, i) => {
      cm.set(b.date, b.close);
      bm.set(b.date, b);
      if (i >= cfg.breadthBars) gm.set(b.date, b.close / bars[i - cfg.breadthBars].close - 1);
      const a = atr[i];
      if (a != null) am.set(b.date, a);
    });
    closeBy[s] = cm;
    chgBy[s] = gm;
    atrBy[s] = am;
    barBy[s] = bm;
    warmDate[s] = bars[Math.min(cfg.warmupBars, bars.length - 1)].date;
  }

  const prevDateOf = new Map<string, string>();
  allDates.forEach((d, i) => { if (i > 0) prevDateOf.set(d, allDates[i - 1]); });

  const signals: PeerBreadthSignal[] = [];

  for (const s of symbols) {
    const peers = symbols.filter((p) => p !== s);
    const required = Math.max(cfg.minPeers, Math.ceil(cfg.peerCoverage * peers.length));

    for (const d of allDates) {
      const pd = prevDateOf.get(d);
      if (!pd) continue;
      const bar = barBy[s].get(d);
      if (!bar) continue;
      if (d < warmDate[s]) continue;

      const own = chgBy[s].get(d);
      const prevClose = closeBy[s].get(pd);
      const atr = atrBy[s].get(d);
      if (own == null || prevClose == null || atr == null) continue;

      let eligible = 0, pos = 0, posPrev = 0, neg = 0, negPrev = 0;
      for (const p of peers) {
        const now = chgBy[p].get(d);
        const before = chgBy[p].get(pd);
        if (now == null || before == null) continue;
        eligible++;
        if (now > 0) pos++;
        if (before > 0) posPrev++;
        if (now < 0) neg++;
        if (before < 0) negPrev++;
      }
      if (eligible < required) continue;

      const posShare = pos / eligible;
      const posPrevShare = posPrev / eligible;
      const negShare = neg / eligible;
      const negPrevShare = negPrev / eligible;

      const isLong =
        posShare >= cfg.breadthFraction && posPrevShare < cfg.breadthFraction && own > 0 && bar.close > prevClose;
      const isShort =
        negShare >= cfg.breadthFraction && negPrevShare < cfg.breadthFraction && own < 0 && bar.close < prevClose;
      if (!isLong && !isShort) continue;

      const stopPct = Math.max(cfg.minStopPct, (cfg.stopAtr * atr) / bar.close);
      if (stopPct > cfg.maxStopPct) continue;

      signals.push({
        date: d,
        symbol: s,
        side: isLong ? 1 : -1,
        stopPct,
        positiveShare: posShare,
        negativeShare: negShare,
        eligiblePeers: eligible,
        ownReturn: own,
        close: bar.close,
      });
    }
  }

  return signals.sort((a, b) => (a.date === b.date ? (a.symbol < b.symbol ? -1 : 1) : a.date < b.date ? -1 : 1));
}

interface OpenPos {
  symbol: string;
  side: 1 | -1;
  signalDate: string;
  entryDate: string;
  entry: number;
  qty: number;
  stop: number;
  target: number;
  initialRisk: number;
  fees: number;
  funding: number;
  settledTo: number;
  mark: number;
}

export function runPeerBreadthBacktest(
  data: Record<string, SymbolData>,
  cfg: PeerBreadthConfig = DEFAULT_PEER_BREADTH_CONFIG,
  startDate?: string,
  endDate?: string
): PeerBreadthResult {
  const symbols = Object.keys(data).filter((s) => (data[s]?.bars?.length ?? 0) > 0);
  const signals = generatePeerBreadthSignals(data, cfg);

  const barBy: Record<string, Map<string, DailyBar>> = {};
  for (const s of symbols) {
    const m = new Map<string, DailyBar>();
    for (const b of data[s].bars) m.set(b.date, b);
    barBy[s] = m;
  }

  let dates = Array.from(new Set(symbols.flatMap((s) => data[s].bars.map((b) => b.date)))).sort();
  if (startDate) dates = dates.filter((d) => d >= startDate);
  if (endDate) dates = dates.filter((d) => d < endDate);

  const byDay = new Map<string, PeerBreadthSignal[]>();
  for (const s of signals) {
    if (!byDay.has(s.date)) byDay.set(s.date, []);
    byDay.get(s.date)!.push(s);
  }

  let cash = cfg.startEquity;
  let openPos: OpenPos[] = [];
  const trades: PeerBreadthTrade[] = [];
  const equity: EquityPoint[] = [];

  const closeTrade = (p: OpenPos, d: string, px: number, reason: PeerBreadthTrade["reason"]) => {
    const gross = (px - p.entry) * p.qty * p.side;
    const exitFee = px * p.qty * cfg.feePerSide;
    cash += gross - exitFee;
    p.fees += exitFee;
    const net = gross - p.fees - p.funding;
    trades.push({
      symbol: p.symbol,
      side: p.side,
      signalDate: p.signalDate,
      entryDate: p.entryDate,
      entry: p.entry,
      qty: p.qty,
      stop: p.stop,
      target: p.target,
      notional: p.qty * p.entry,
      initialRisk: p.initialRisk,
      exitDate: d,
      exit: px,
      reason,
      grossPnl: gross,
      fees: p.fees,
      fundingPaid: p.funding,
      netPnl: net,
      rMultiple: p.initialRisk > 0 ? net / p.initialRisk : 0,
    });
  };

  for (let i = 0; i < dates.length; i++) {
    const d = dates[i];
    const dMs = toMs(d);

    // 1) funding due up to and including today's 00:00 event
    if (cfg.useFunding) {
      for (const p of openPos) {
        const events = data[p.symbol].funding || [];
        let amt = 0;
        for (const ev of events) {
          if (ev.time > p.settledTo && ev.time <= dMs) amt += ev.rate;
        }
        if (amt !== 0) {
          const paid = amt * p.qty * p.entry * p.side;
          cash -= paid;
          p.funding += paid;
        }
        p.settledTo = dMs;
      }
    } else {
      for (const p of openPos) p.settledTo = dMs;
    }

    // 2) known open-time exits at today's open
    let still: OpenPos[] = [];
    for (const p of openPos) {
      const bar = barBy[p.symbol].get(d);
      if (!bar) { still.push(p); continue; }
      const o = bar.open;
      if ((dMs - toMs(p.entryDate)) / dayMs >= cfg.maxHoldDays) closeTrade(p, d, o, "time");
      else if (p.side * (o - p.stop) <= 0) closeTrade(p, d, o, "stop");
      else if (p.side * (o - p.target) > 0) closeTrade(p, d, p.target, "target");
      else still.push(p);
    }
    openPos = still;

    // 3) admit yesterday's signals at today's open, sized on open-time equity
    const prevDay = i > 0 ? dates[i - 1] : null;
    const batchSignals = prevDay ? byDay.get(prevDay) : undefined;
    if (batchSignals?.length) {
      let eq = cash, gross = 0, riskOpen = 0;
      for (const p of openPos) {
        const px = barBy[p.symbol].get(d)?.open ?? p.mark;
        eq += p.side * p.qty * (px - p.entry);
        gross += p.qty * px;
        riskOpen += p.initialRisk;
      }
      const occupied = new Set(openPos.map((p) => p.symbol));
      const batch: { sig: PeerBreadthSignal; open: number; want: number }[] = [];
      for (const s of batchSignals) {
        if (occupied.has(s.symbol)) continue;
        const bar = barBy[s.symbol]?.get(d);
        if (!bar) continue;
        occupied.add(s.symbol);
        batch.push({ sig: s, open: bar.open, want: Math.max(0, eq * cfg.riskFraction) });
      }
      if (batch.length) {
        const totalWant = batch.reduce((a, b) => a + b.want, 0);
        const cap = Math.max(0, eq * cfg.riskCap - riskOpen);
        let scale = totalWant > 0 ? Math.min(1, cap / totalWant) : 0;
        const totalGross = batch.reduce(
          (a, b) => a + (b.want * scale) / (b.sig.stopPct + 2 * cfg.feePerSide), 0
        );
        if (totalGross > 0) {
          scale *= Math.min(1, Math.max(0, eq * cfg.grossCap - gross) / totalGross);
        }
        for (const b of batch) {
          const rf = b.sig.stopPct + 2 * cfg.feePerSide;
          let r = b.want * scale;
          let notional = r / rf;
          const q = Math.floor((notional / b.open) * 1e8) / 1e8;
          if (notional < cfg.minNotional || q <= 0) continue;
          notional = q * b.open;
          r = notional * rf;
          const fee = notional * cfg.feePerSide;
          cash -= fee;
          openPos.push({
            symbol: b.sig.symbol,
            side: b.sig.side,
            signalDate: b.sig.date,
            entryDate: d,
            entry: b.open,
            qty: q,
            stop: b.open * (1 - b.sig.side * b.sig.stopPct),
            target: b.open * (1 + b.sig.side * b.sig.stopPct * cfg.targetR),
            initialRisk: r,
            fees: fee,
            funding: 0,
            settledTo: dMs,
            mark: b.open,
          });
        }
      }
    }

    // 4) intraday protection (stop before target inside one bar)
    still = [];
    for (const p of openPos) {
      const bar = barBy[p.symbol].get(d);
      if (!bar) { still.push(p); continue; }
      const stopHit = p.side === 1 ? bar.low <= p.stop : bar.high >= p.stop;
      const tgtHit = p.side === 1 ? bar.high >= p.target : bar.low <= p.target;
      if (stopHit) closeTrade(p, d, p.stop, "stop");
      else if (tgtHit) closeTrade(p, d, p.target, "target");
      else { p.mark = bar.close; still.push(p); }
    }
    openPos = still;

    // 5) mark at the close
    const eqNow = cash + openPos.reduce((a, p) => a + p.side * p.qty * (p.mark - p.entry), 0);
    equity.push({
      date: d,
      equity: eqNow,
      cash,
      openPositions: openPos.length,
      grossNotionalPct: eqNow > 0 ? (openPos.reduce((a, p) => a + p.qty * p.mark, 0) / eqNow) * 100 : 0,
      openRiskPct: eqNow > 0 ? (openPos.reduce((a, p) => a + p.initialRisk, 0) / eqNow) * 100 : 0,
    });
  }

  // liquidate open positions at the last close
  if (dates.length) {
    for (const p of [...openPos]) closeTrade(p, dates[dates.length - 1], p.mark, "end_of_data");
    openPos = [];
    equity[equity.length - 1].equity = cash;
  }

  const stats = computeStats(trades, equity, cfg.startEquity);
  const perSymbol = symbols
    .map((s) => {
      const t = trades.filter((x) => x.symbol === s);
      return {
        symbol: s,
        trades: t.length,
        netPnl: t.reduce((a, b) => a + b.netPnl, 0),
        winRate: t.length ? (t.filter((x) => x.netPnl > 0).length / t.length) * 100 : 0,
      };
    })
    .filter((x) => x.trades > 0)
    .sort((a, b) => b.netPnl - a.netPnl);

  const lastDate = dates[dates.length - 1];
  const latestSignals = signals.filter((s) => lastDate && s.date === lastDate);

  return { signals, trades, equity, stats, perSymbol, latestSignals };
}

function computeStats(trades: PeerBreadthTrade[], equity: EquityPoint[], startEquity: number): PeerBreadthStats {
  const natural = trades.filter((t) => t.reason !== "end_of_data");
  const wins = natural.filter((t) => t.netPnl > 0);
  const grossWin = wins.reduce((a, b) => a + b.netPnl, 0);
  const grossLoss = -natural.filter((t) => t.netPnl <= 0).reduce((a, b) => a + b.netPnl, 0);
  const finalEquity = equity.length ? equity[equity.length - 1].equity : startEquity;

  let peak = startEquity, maxDd = 0;
  for (const e of equity) {
    peak = Math.max(peak, e.equity);
    maxDd = Math.min(maxDd, e.equity / peak - 1);
  }

  const rets: number[] = [];
  for (let i = 1; i < equity.length; i++) {
    const prev = equity[i - 1].equity;
    if (prev > 0) rets.push(equity[i].equity / prev - 1);
  }
  const mean = rets.length ? rets.reduce((a, b) => a + b, 0) / rets.length : 0;
  const sd = rets.length > 1
    ? Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1))
    : 0;
  const downside = rets.length
    ? Math.sqrt(rets.reduce((a, b) => a + Math.min(b, 0) ** 2, 0) / rets.length)
    : 0;
  const sharpe = sd > 0 ? (mean / sd) * Math.sqrt(365) : 0;
  const sortino = downside > 0 ? (mean / downside) * Math.sqrt(365) : 0;

  const years = equity.length > 1
    ? (toMs(equity[equity.length - 1].date) - toMs(equity[0].date)) / dayMs / 365.25
    : 0;
  const cagr = years > 0 && finalEquity > 0 ? (finalEquity / startEquity) ** (1 / years) - 1 : 0;
  const calmar = maxDd < 0 ? cagr / Math.abs(maxDd) : 0;

  const reasonCounts: Record<string, number> = {};
  for (const t of trades) reasonCounts[t.reason] = (reasonCounts[t.reason] || 0) + 1;

  const inMarket = equity.filter((e) => e.openPositions > 0).length;

  return {
    trades: natural.length,
    wins: wins.length,
    winRate: natural.length ? (wins.length / natural.length) * 100 : 0,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0,
    netPnl: finalEquity - startEquity,
    returnPct: ((finalEquity - startEquity) / startEquity) * 100,
    maxDrawdownPct: maxDd * 100,
    avgTrade: natural.length ? natural.reduce((a, b) => a + b.netPnl, 0) / natural.length : 0,
    sharpe,
    sortino,
    cagr: cagr * 100,
    calmar,
    expectancyR: natural.length ? natural.reduce((a, b) => a + b.rMultiple, 0) / natural.length : 0,
    timeInMarketPct: equity.length ? (inMarket / equity.length) * 100 : 0,
    reasonCounts,
    finalEquity,
  };
}

/* ------------------------------------------------------------------ */
/* Live breadth dashboard                                              */
/* ------------------------------------------------------------------ */

export interface LiveCoinState {
  symbol: string;
  date: string;
  close: number;
  ownReturn: number;          // 5-day close-to-close return
  ownUp: boolean;             // ownReturn > 0
  closedUp: boolean;          // close > previous close
  eligiblePeers: number;
  peersUp: number;            // peers with positive 5d return today
  peersDown: number;
  positiveShare: number;
  negativeShare: number;
  prevPositiveShare: number;
  prevNegativeShare: number;
  crossedUp: boolean;         // positive share crossed the 70% line today
  crossedDown: boolean;
  stopPct: number | null;     // null when ATR unavailable
  stopTooWide: boolean;
  signal: 0 | 1 | -1;         // actionable entry for the next daily open
  entryRef: number;           // reference price (today's close)
  stop: number | null;
  target: number | null;
}

export interface PeerBreadthLive {
  date: string;
  coinsUp: number;            // coins in the universe with positive 5d return
  coinsCounted: number;
  universeShare: number;      // coinsUp / coinsCounted
  threshold: number;          // cfg.breadthFraction
  coins: LiveCoinState[];
  signals: LiveCoinState[];   // coins with signal !== 0
}

/** Snapshot of breadth + actionable entries on the most recent complete daily bar. */
export function computePeerBreadthLive(
  data: Record<string, SymbolData>,
  cfg: PeerBreadthConfig = DEFAULT_PEER_BREADTH_CONFIG
): PeerBreadthLive | null {
  const symbols = Object.keys(data).filter((s) => (data[s]?.bars?.length ?? 0) > cfg.breadthBars + 1);
  if (symbols.length < 2) return null;

  const closeBy: Record<string, Map<string, number>> = {};
  const chgBy: Record<string, Map<string, number>> = {};
  const atrBy: Record<string, Map<string, number>> = {};
  const dateSet = new Set<string>();

  for (const s of symbols) {
    const bars = data[s].bars.slice().sort((a, b) => (a.date < b.date ? -1 : 1));
    const cm = new Map<string, number>();
    const gm = new Map<string, number>();
    const am = new Map<string, number>();
    const atr = simpleAtr(bars, cfg.atrPeriod);
    bars.forEach((b, i) => {
      cm.set(b.date, b.close);
      dateSet.add(b.date);
      if (i >= cfg.breadthBars) gm.set(b.date, b.close / bars[i - cfg.breadthBars].close - 1);
      const a = atr[i];
      if (a != null) am.set(b.date, a);
    });
    closeBy[s] = cm;
    chgBy[s] = gm;
    atrBy[s] = am;
  }

  const allDates = Array.from(dateSet).sort();
  if (allDates.length < 2) return null;
  const date = allDates[allDates.length - 1];
  const prev = allDates[allDates.length - 2];

  const coins: LiveCoinState[] = [];
  let coinsUp = 0, coinsCounted = 0;

  for (const s of symbols) {
    const own = chgBy[s].get(date);
    const close = closeBy[s].get(date);
    const prevClose = closeBy[s].get(prev);
    if (own == null || close == null || prevClose == null) continue;
    coinsCounted++;
    if (own > 0) coinsUp++;

    const peers = symbols.filter((p) => p !== s);
    const required = Math.max(cfg.minPeers, Math.ceil(cfg.peerCoverage * peers.length));
    let eligible = 0, pos = 0, posPrev = 0, neg = 0, negPrev = 0;
    for (const p of peers) {
      const now = chgBy[p].get(date);
      const before = chgBy[p].get(prev);
      if (now == null || before == null) continue;
      eligible++;
      if (now > 0) pos++;
      if (before > 0) posPrev++;
      if (now < 0) neg++;
      if (before < 0) negPrev++;
    }

    const positiveShare = eligible ? pos / eligible : 0;
    const negativeShare = eligible ? neg / eligible : 0;
    const prevPositiveShare = eligible ? posPrev / eligible : 0;
    const prevNegativeShare = eligible ? negPrev / eligible : 0;
    const enough = eligible >= required;

    const crossedUp = enough && positiveShare >= cfg.breadthFraction && prevPositiveShare < cfg.breadthFraction;
    const crossedDown = enough && negativeShare >= cfg.breadthFraction && prevNegativeShare < cfg.breadthFraction;

    const atr = atrBy[s].get(date);
    const stopPct = atr != null ? Math.max(cfg.minStopPct, (cfg.stopAtr * atr) / close) : null;
    const stopTooWide = stopPct != null && stopPct > cfg.maxStopPct;

    const closedUp = close > prevClose;
    let signal: 0 | 1 | -1 = 0;
    if (stopPct != null && !stopTooWide) {
      if (crossedUp && own > 0 && closedUp) signal = 1;
      else if (crossedDown && own < 0 && close < prevClose) signal = -1;
    }

    coins.push({
      symbol: s,
      date,
      close,
      ownReturn: own,
      ownUp: own > 0,
      closedUp,
      eligiblePeers: eligible,
      peersUp: pos,
      peersDown: neg,
      positiveShare,
      negativeShare,
      prevPositiveShare,
      prevNegativeShare,
      crossedUp,
      crossedDown,
      stopPct,
      stopTooWide,
      signal,
      entryRef: close,
      stop: signal !== 0 && stopPct != null ? close * (1 - signal * stopPct) : null,
      target: signal !== 0 && stopPct != null ? close * (1 + signal * stopPct * cfg.targetR) : null,
    });
  }

  coins.sort((a, b) => b.positiveShare - a.positiveShare || (a.symbol < b.symbol ? -1 : 1));

  return {
    date,
    coinsUp,
    coinsCounted,
    universeShare: coinsCounted ? coinsUp / coinsCounted : 0,
    threshold: cfg.breadthFraction,
    coins,
    signals: coins.filter((c) => c.signal !== 0),
  };
}
