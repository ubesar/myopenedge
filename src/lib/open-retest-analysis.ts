export interface OHLCBar {
  datetime: string; // "yyyy-MM-dd HH:mm[:ss]" in NY time
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface OpenRetestDay {
  date: string;
  openPrice: number;
  touches: number;      // bars (after the first) whose range contains the open
  crosses: number;      // close flips side of the open
  maxUpPct: number;
  maxDownPct: number;
  lastTouchTime: string | null;
  closeAtEnd: number;
}

export interface OpenRetestResult {
  days: OpenRetestDay[];
  avgTouches: number;
  avgCrosses: number;
  zeroTouchPct: number;
  buckets: { label: string; touches: number; crosses: number }[];
}

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/** Count how often price returns to the 09:30 NY open between start and end (exclusive end). */
export function analyzeOpenRetest(
  bars: OHLCBar[],
  startTime = "09:30",
  endTime = "11:00"
): OpenRetestResult {
  const s = toMin(startTime);
  const e = toMin(endTime);
  const byDay = new Map<string, OHLCBar[]>();
  for (const b of bars) {
    const [d, t] = b.datetime.split(/[ T]/);
    if (!t) continue;
    const m = toMin(t.slice(0, 5));
    if (m < s || m >= e) continue;
    (byDay.get(d) ?? byDay.set(d, []).get(d)!).push(b);
  }

  const days: OpenRetestDay[] = [];
  for (const [date, list] of [...byDay.entries()].sort()) {
    list.sort((a, b) => (a.datetime < b.datetime ? -1 : 1));
    const first = list[0];
    if (toMin(first.datetime.split(/[ T]/)[1].slice(0, 5)) !== s) continue;
    const open = first.open;
    let touches = 0, crosses = 0, hi = first.high, lo = first.low;
    let lastTouch: string | null = null;
    let side = first.close > open ? 1 : first.close < open ? -1 : 0;
    for (let i = 1; i < list.length; i++) {
      const b = list[i];
      hi = Math.max(hi, b.high);
      lo = Math.min(lo, b.low);
      if (b.low <= open && b.high >= open) {
        touches++;
        lastTouch = b.datetime.split(/[ T]/)[1].slice(0, 5);
      }
      const ns = b.close > open ? 1 : b.close < open ? -1 : 0;
      if (ns !== 0) {
        if (side !== 0 && ns !== side) crosses++;
        side = ns;
      }
    }
    days.push({
      date,
      openPrice: open,
      touches,
      crosses,
      maxUpPct: ((hi - open) / open) * 100,
      maxDownPct: ((open - lo) / open) * 100,
      lastTouchTime: lastTouch,
      closeAtEnd: list[list.length - 1].close,
    });
  }

  const n = days.length || 1;
  const bucket = (f: (v: number) => boolean, k: "touches" | "crosses") =>
    days.length ? (days.filter((d) => f(d[k])).length / days.length) * 100 : 0;
  const defs: [string, (v: number) => boolean][] = [
    ["0", (v) => v === 0],
    ["1-2", (v) => v >= 1 && v <= 2],
    ["3-5", (v) => v >= 3 && v <= 5],
    ["6+", (v) => v >= 6],
  ];
  return {
    days,
    avgTouches: days.reduce((a, d) => a + d.touches, 0) / n,
    avgCrosses: days.reduce((a, d) => a + d.crosses, 0) / n,
    zeroTouchPct: bucket((v) => v === 0, "touches"),
    buckets: defs.map(([label, f]) => ({ label, touches: bucket(f, "touches"), crosses: bucket(f, "crosses") })),
  };
}
