import type { CsvBar } from "./csv-bars";

export interface SyncIssue {
  level: "error" | "warning";
  message: string;
}

export interface SyncReport {
  ok: boolean;
  scanTf: number;      // detected timeframe (minutes) of the scan file
  intraTf: number;     // detected timeframe (minutes) of the intrabar file
  scanBars: number;
  intraBars: number;
  overlapDays: number;
  coveredBuckets: number;
  totalBuckets: number;
  mismatchBuckets: number;
  issues: SyncIssue[];
}

const toTs = (dt: string) => new Date(dt.replace(" ", "T")).getTime();
const dayOf = (dt: string) => dt.slice(0, 10);

/** Median spacing between consecutive bars, in minutes. */
export function detectTimeframe(bars: CsvBar[]): number {
  const diffs: number[] = [];
  for (let i = 1; i < Math.min(bars.length, 500); i++) {
    const d = (toTs(bars[i].datetime) - toTs(bars[i - 1].datetime)) / 60000;
    if (d > 0 && d <= 240) diffs.push(d);
  }
  if (!diffs.length) return 0;
  diffs.sort((a, b) => a - b);
  return Math.round(diffs[Math.floor(diffs.length / 2)]);
}

/**
 * Validates that the m15 scan file and the m5/m1 intrabar file describe the
 * same market, the same period, and the same candles — so momentum scanning on
 * m15 and SL/TP resolution on the finer file can never drift apart.
 */
export function checkCsvSync(scan: CsvBar[], intra: CsvBar[]): SyncReport {
  const issues: SyncIssue[] = [];
  const scanTf = detectTimeframe(scan);
  const intraTf = detectTimeframe(intra);

  if (scanTf && scanTf !== 15) {
    issues.push({ level: "warning", message: `file scan terdeteksi m${scanTf}, bukan m15` });
  }
  if (intraTf && intraTf >= 15) {
    issues.push({ level: "error", message: `file intrabar terdeteksi m${intraTf} — butuh m5 atau m1` });
  }
  if (scanTf && intraTf && scanTf % intraTf !== 0) {
    issues.push({ level: "error", message: `m${intraTf} tidak membagi habis m${scanTf}` });
  }

  const scanDays = new Set(scan.map((b) => dayOf(b.datetime)));
  const intraDays = new Set(intra.map((b) => dayOf(b.datetime)));
  const overlap = [...scanDays].filter((d) => intraDays.has(d));
  const overlapDays = overlap.length;

  if (overlapDays === 0) {
    issues.push({ level: "error", message: "rentang tanggal kedua file tidak beririsan sama sekali" });
  } else {
    const missingIntra = [...scanDays].filter((d) => !intraDays.has(d));
    const missingScan = [...intraDays].filter((d) => !scanDays.has(d));
    if (missingIntra.length) {
      issues.push({
        level: "warning",
        message: `${missingIntra.length} hari ada di m15 tapi tidak ada di intrabar (dilewati)`,
      });
    }
    if (missingScan.length) {
      issues.push({
        level: "warning",
        message: `${missingScan.length} hari ada di intrabar tapi tidak ada di m15`,
      });
    }
  }

  // Bucket-level OHLC reconciliation on the overlapping days.
  const overlapSet = new Set(overlap);
  const bucketKey = (dt: string) => {
    const [d, t] = dt.split(" ");
    const [h, m] = t.split(":").map(Number);
    const b = Math.floor((h * 60 + m) / 15) * 15;
    return `${d} ${String(Math.floor(b / 60)).padStart(2, "0")}:${String(b % 60).padStart(2, "0")}`;
  };

  const agg = new Map<string, { high: number; low: number; n: number }>();
  for (const b of intra) {
    if (!overlapSet.has(dayOf(b.datetime))) continue;
    const k = bucketKey(b.datetime);
    const hi = parseFloat(b.high);
    const lo = parseFloat(b.low);
    const cur = agg.get(k);
    if (!cur) agg.set(k, { high: hi, low: lo, n: 1 });
    else {
      cur.high = Math.max(cur.high, hi);
      cur.low = Math.min(cur.low, lo);
      cur.n++;
    }
  }

  let totalBuckets = 0;
  let coveredBuckets = 0;
  let mismatchBuckets = 0;
  const expectedSub = intraTf > 0 ? 15 / intraTf : 3;

  for (const b of scan) {
    if (!overlapSet.has(dayOf(b.datetime))) continue;
    totalBuckets++;
    const a = agg.get(bucketKey(b.datetime));
    if (!a) continue;
    coveredBuckets++;
    const hi = parseFloat(b.high);
    const lo = parseFloat(b.low);
    const tol = Math.max((hi - lo) * 0.02, 1e-6);
    if (a.n < expectedSub || a.high > hi + tol || a.low < lo - tol) mismatchBuckets++;
  }

  const missing = totalBuckets - coveredBuckets;
  if (totalBuckets > 0) {
    if (missing > 0) {
      issues.push({
        level: missing / totalBuckets > 0.05 ? "error" : "warning",
        message: `${missing} candle m15 tidak punya bar intrabar (${((missing / totalBuckets) * 100).toFixed(1)}%)`,
      });
    }
    if (mismatchBuckets > 0) {
      issues.push({
        level: mismatchBuckets / totalBuckets > 0.05 ? "error" : "warning",
        message: `${mismatchBuckets} candle m15 tidak cocok high/low-nya dengan agregasi intrabar (${((mismatchBuckets / totalBuckets) * 100).toFixed(1)}%)`,
      });
    }
  }

  return {
    ok: !issues.some((i) => i.level === "error"),
    scanTf,
    intraTf,
    scanBars: scan.length,
    intraBars: intra.length,
    overlapDays,
    coveredBuckets,
    totalBuckets,
    mismatchBuckets,
    issues,
  };
}
