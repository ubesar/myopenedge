export interface CandleBar {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export function aggregateToM15(bars: CandleBar[]): CandleBar[] {
  if (bars.length === 0) return [];

  const groups: CandleBar[][] = [];
  let current: CandleBar[] = [];

  for (const bar of bars) {
    const [h, m] = bar.time.split(":").map(Number);
    const totalMin = h * 60 + m;

    if (current.length > 0) {
      const [fh, fm] = current[0].time.split(":").map(Number);
      const firstMin = fh * 60 + fm;
      if (totalMin - firstMin >= 15) {
        groups.push(current);
        current = [];
      }
    }
    current.push(bar);
  }
  if (current.length > 0) groups.push(current);

  return groups.map((g) => ({
    time: g[0].time,
    open: g[0].open,
    high: Math.max(...g.map((b) => b.high)),
    low: Math.min(...g.map((b) => b.low)),
    close: g[g.length - 1].close,
  }));
}

/**
 * Clock-aligned aggregation: buckets always start at a multiple of `tfMinutes`
 * from midnight (07:00, 07:15, 07:30 … for m15), never at the first bar's time.
 */
export function aggregateBars(bars: CandleBar[], tfMinutes: number): CandleBar[] {
  if (tfMinutes <= 5) return bars;

  const minOf = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const pad = (n: number) => String(n).padStart(2, "0");

  const groups = new Map<number, CandleBar[]>();
  for (const bar of bars) {
    const bucket = Math.floor(minOf(bar.time) / tfMinutes) * tfMinutes;
    if (!groups.has(bucket)) groups.set(bucket, []);
    groups.get(bucket)!.push(bar);
  }

  return Array.from(groups.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([bucket, g]) => ({
      time: `${pad(Math.floor(bucket / 60))}:${pad(bucket % 60)}`,
      open: g[0].open,
      high: Math.max(...g.map((b) => b.high)),
      low: Math.min(...g.map((b) => b.low)),
      close: g[g.length - 1].close,
    }));
}

