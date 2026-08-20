import { supabase } from "@/integrations/supabase/client";

export interface StoredBar {
  datetime: string; // "yyyy-MM-dd HH:mm:ss" (America/New_York)
  open: string;
  high: string;
  low: string;
  close: string;
  volume?: string;
}

export interface DatasetSummary {
  symbol: string;
  interval: string;
  chunks: number;
  bars: number;
  firstBar: string | null;
  lastBar: string | null;
  periods: string[];
}

export const DATA_SOURCE_INTERVALS = ["5min", "15min", "30min", "1h", "1day"] as const;
export type DataSourceInterval = (typeof DATA_SOURCE_INTERVALS)[number];

const MODE_KEY = "moe:data-source-mode";
export type DataSourceMode = "auto" | "live" | "stored";

/** Default is "auto": stored data is used automatically when available, else live api. */
export function getDataSourceMode(): DataSourceMode {
  if (typeof localStorage === "undefined") return "auto";
  const v = localStorage.getItem(MODE_KEY);
  return v === "stored" || v === "live" ? v : "auto";
}

/** True when stored data should be tried first (auto + stored modes). */
export function preferStored(): boolean {
  return getDataSourceMode() !== "live";
}

/** Per-page override ------------------------------------------------------ */
export type DataSourceScope = "app" | "backtester" | "chart";
export type PageDataSource = "default" | "auto" | "live" | "stored";

const pageKey = (scope: DataSourceScope) => `moe:data-source-mode:${scope}`;

export function getPageDataSource(scope: DataSourceScope): PageDataSource {
  if (typeof localStorage === "undefined") return "default";
  const v = localStorage.getItem(pageKey(scope));
  return v === "auto" || v === "live" || v === "stored" ? v : "default";
}

export function setPageDataSource(scope: DataSourceScope, value: PageDataSource) {
  if (value === "default") localStorage.removeItem(pageKey(scope));
  else localStorage.setItem(pageKey(scope), value);
  window.dispatchEvent(new CustomEvent("moe:data-source-mode", { detail: value }));
}

/** Resolves the effective mode for a page (page override → global mode). */
export function resolveDataSource(scope: DataSourceScope): DataSourceMode {
  const page = getPageDataSource(scope);
  return page === "default" ? getDataSourceMode() : page;
}

/** True when the given page should try stored data first. */
export function preferStoredFor(scope: DataSourceScope): boolean {
  return resolveDataSource(scope) !== "live";
}

export function setDataSourceMode(mode: DataSourceMode) {
  localStorage.setItem(MODE_KEY, mode);
  window.dispatchEvent(new CustomEvent("moe:data-source-mode", { detail: mode }));
}

const pad = (n: number) => String(n).padStart(2, "0");

export function monthsInRange(from: string, to: string): string[] {
  // from/to = "yyyy-MM"
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  const out: string[] = [];
  let y = fy;
  let m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${pad(m)}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

function monthBounds(period: string) {
  const [y, m] = period.split("-").map(Number);
  const start = `${y}-${pad(m)}-01 00:00:00`;
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const end = `${nextY}-${pad(nextM)}-01 00:00:00`;
  return { start, end };
}

function normalizeBars(values: any[]): StoredBar[] {
  const seen = new Set<string>();
  return values
    .filter((v) => v?.datetime && !seen.has(v.datetime) && (seen.add(v.datetime), true))
    .map((v) => ({
      datetime: String(v.datetime).replace("T", " ").length === 10
        ? `${String(v.datetime)} 00:00:00`
        : String(v.datetime).replace("T", " "),
      open: String(v.open),
      high: String(v.high),
      low: String(v.low),
      close: String(v.close),
      ...(v.volume != null ? { volume: String(v.volume) } : {}),
    }))
    .sort((a, b) => a.datetime.localeCompare(b.datetime));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isRateLimit(msg: string) {
  const m = msg.toLowerCase();
  return m.includes("api credits") || m.includes("rate limit") || m.includes("429");
}

/** Downloads one month from TwelveData and stores it. Returns bar count saved. */
export async function downloadMonth(
  symbol: string,
  interval: DataSourceInterval,
  period: string
): Promise<number> {
  const { start, end } = monthBounds(period);

  let data: any = null;
  const maxAttempts = 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await supabase.functions.invoke("twelvedata-proxy", {
      body: {
        symbol,
        interval,
        outputsize: "5000",
        start_date: start,
        end_date: end,
      },
    });

    let msg = "";
    if (res.error) {
      // Non-2xx (e.g. 429) — try to read the body for the real reason
      const ctx: any = (res.error as any).context;
      try {
        const body = ctx && typeof ctx.json === "function" ? await ctx.clone().json() : null;
        msg = body?.message || body?.error || res.error.message || "";
      } catch {
        msg = res.error.message || "";
      }
    } else if (res.data?.status === "error") {
      msg = res.data.message || "";
    } else {
      data = res.data;
      break;
    }

    if (isRateLimit(msg) && attempt < maxAttempts) {
      await sleep(62000);
      continue;
    }
    throw new Error(msg || `fetch failed (${period})`);
  }

  const bars = normalizeBars(Array.isArray(data?.values) ? data.values : []).filter(
    (b) => b.datetime >= start && b.datetime < end
  );
  if (bars.length === 0) return 0;

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) throw new Error("not signed in");

  const { error: upErr } = await supabase.from("market_data_chunks").upsert(
    {
      user_id: userId,
      symbol,
      interval,
      period,
      bars: bars as any,
      bar_count: bars.length,
      first_bar: bars[0].datetime,
      last_bar: bars[bars.length - 1].datetime,
    },
    { onConflict: "user_id,symbol,interval,period" }
  );
  if (upErr) throw new Error(upErr.message);
  return bars.length;
}

export async function listDatasets(): Promise<DatasetSummary[]> {
  const { data, error } = await supabase
    .from("market_data_chunks")
    .select("symbol, interval, period, bar_count, first_bar, last_bar")
    .order("period", { ascending: true });
  if (error) throw new Error(error.message);

  const map = new Map<string, DatasetSummary>();
  for (const row of data || []) {
    const key = `${row.symbol}|${row.interval}`;
    const cur =
      map.get(key) ||
      ({
        symbol: row.symbol,
        interval: row.interval,
        chunks: 0,
        bars: 0,
        firstBar: null,
        lastBar: null,
        periods: [],
      } as DatasetSummary);
    cur.chunks += 1;
    cur.bars += row.bar_count || 0;
    cur.periods.push(row.period);
    if (row.first_bar && (!cur.firstBar || row.first_bar < cur.firstBar)) cur.firstBar = row.first_bar;
    if (row.last_bar && (!cur.lastBar || row.last_bar > cur.lastBar)) cur.lastBar = row.last_bar;
    map.set(key, cur);
  }
  return Array.from(map.values()).sort(
    (a, b) => a.symbol.localeCompare(b.symbol) || a.interval.localeCompare(b.interval)
  );
}

export async function deleteDataset(symbol: string, interval: string) {
  const { error } = await supabase
    .from("market_data_chunks")
    .delete()
    .eq("symbol", symbol)
    .eq("interval", interval);
  if (error) throw new Error(error.message);
}

/** Loads stored bars ascending. `days` limits to the most recent N trading days. */
export async function loadStoredBars(
  symbol: string,
  interval: string,
  days?: number
): Promise<StoredBar[]> {
  const { data, error } = await supabase
    .from("market_data_chunks")
    .select("bars, period")
    .eq("symbol", symbol.toUpperCase())
    .eq("interval", interval)
    .order("period", { ascending: true });
  if (error) throw new Error(error.message);

  let bars: StoredBar[] = [];
  for (const row of data || []) bars = bars.concat((row.bars as unknown as StoredBar[]) || []);
  bars.sort((a, b) => a.datetime.localeCompare(b.datetime));

  if (days && days > 0) {
    const uniqueDays = Array.from(new Set(bars.map((b) => b.datetime.slice(0, 10))));
    const keep = new Set(uniqueDays.slice(-days));
    bars = bars.filter((b) => keep.has(b.datetime.slice(0, 10)));
  }
  return bars;
}

/** TwelveData-shaped payload (descending) built from stored data. */
export async function loadStoredValues(symbol: string, interval: string, days?: number) {
  const bars = await loadStoredBars(symbol, interval, days);
  return { values: [...bars].reverse(), source: "stored" as const };
}

export function barsToCsv(bars: StoredBar[]): string {
  const head = "datetime,open,high,low,close,volume";
  const rows = bars.map(
    (b) => `${b.datetime},${b.open},${b.high},${b.low},${b.close},${b.volume ?? ""}`
  );
  return [head, ...rows].join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
