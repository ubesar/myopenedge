---
name: pullback-50
description: Implement the Pullback 50% intraday strategy engine (M15 trigger candle + 50% pullback entry with TP1 RR 1:1 and TP2 RR 1:2). Trigger when the user asks to add, port, or analyze a "pullback 50%", "50% pullback", or "M15 pullback" strategy in any project.
---

# Pullback 50% Strategy — Reusable Module

A self-contained intraday strategy engine. Drop two files into any project, wire `analyzePullback(bars, options)`, and you get full trade list + win-rate/expectancy stats for bullish, bearish, and overall.

## When to use
- User asks: "add pullback 50%", "50% pullback strategy", "M15 trigger candle pullback".
- Project already has intraday OHLC bars (M5 or finer) with NY timestamps.

## Files in this skill
- `assets/pullback-analysis.ts` — strategy engine
- `assets/m15-aggregation.ts` — generic timeframe aggregator (M5 → M15)

## Install
1. Copy both files to `src/lib/` (or your equivalent). Adjust the import path inside `pullback-analysis.ts` if needed.
2. Call:
   ```ts
   import { analyzePullback } from "@/lib/pullback-analysis";
   const result = analyzePullback(bars, { bodyThreshold: 0.7 });
   ```
3. Input bars shape: `{ datetime: "YYYY-MM-DD HH:mm:ss", open, high, low, close }` (string values OK — engine parses).

## Algorithm (do NOT change order)

1. **Filter RTH**: keep bars with NY time in `[09:30, 16:00)`.
2. **Aggregate M5 → M15**: group every 15 min from first bar (open=first, close=last, high=max, low=min).
3. **Trigger candle (M15)** at index `i`:
   - `range = high - low` (skip if ≤ 0)
   - `ratio = abs(close - open) / range` — require `ratio ≥ bodyThreshold` (default 0.7)
   - `direction = close > open ? "bullish" : "bearish"`
4. **Entry — 50% pullback** using next candle `m15[i+1]`:
   - `mid = bullish ? low + range*0.5 : high - range*0.5`
   - Tagged if `next.low ≤ mid` (bull) or `next.high ≥ mid` (bear). Else skip.
5. **Stop**:
   - `"full"` (default) = trigger candle's far edge (low for bull / high for bear)
   - `"half"` = `mid ± range * pullbackLevel * 0.5`
6. **Targets**:
   - `target1 = entry ± range * tp1Ratio` (default 0.5 → RR 1:1 vs full stop)
   - `target2 = entry ± range * tp2Ratio` (default 1.0 → RR 1:2)
7. **Walk-forward** from `i+1` until 16:00 NY. Per bar:
   - If stop AND target both hit in same bar → **loss** (conservative)
   - Only target → **win**
   - Only stop → **loss**
   - Never hit by EOD → **open**
8. **Gating**: after entry, block new entries until TP2 resolves (set `openUntilIndex = resolved index`, or end-of-session if open).

## Parameters

| Param | Default | Notes |
|---|---|---|
| `bodyThreshold` | 0.7 | 0.5–0.9 reasonable |
| `pullbackLevel` | 0.5 | mid pullback ratio |
| `tp1Ratio` | 0.5 | RR 1:1 vs full stop |
| `tp2Ratio` | 1.0 | RR 1:2 |
| `sessionEndMinutes` | 780 (13:00) | last allowed trigger minute |
| `stopMode` | `"full"` | or `"half"` |
| `maxDays` | 0 (all) | tail N days |
| `weekdays` | [1,2,3,4,5] | Mon–Fri |

## Output

```ts
PullbackResult {
  totalDays, totalTrades,
  bullish:  { tp1: SideStats, tp2: SideStats },
  bearish:  { tp1: SideStats, tp2: SideStats },
  overall:  { tp1: SideStats, tp2: SideStats },
  trades:   PullbackTrade[],   // full per-trade log
  params:   {...}              // echoed config
}
SideStats { total, wins, losses, open, winRate /* % */ }
```

Compute **expectancy** in UI: `wr * RR - lr * 1` where RR = 1 for TP1, 2 for TP2.

## Validation checklist after install
- [ ] No type errors after copying files
- [ ] `analyzePullback([])` returns zeros without throwing
- [ ] On real data, `result.trades.length > 0` for a typical week of QQQ/NQ
- [ ] Stop & target arithmetic uses `±` matching direction
