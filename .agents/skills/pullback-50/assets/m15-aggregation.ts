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

export function aggregateBars(bars: CandleBar[], tfMinutes: number): CandleBar[] {
  if (tfMinutes <= 5) return bars;

  const groups: CandleBar[][] = [];
  let current: CandleBar[] = [];

  for (const bar of bars) {
    const [h, m] = bar.time.split(":").map(Number);
    const totalMin = h * 60 + m;
    if (current.length > 0) {
      const [fh, fm] = current[0].time.split(":").map(Number);
      const firstMin = fh * 60 + fm;
      if (totalMin - firstMin >= tfMinutes) {
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
