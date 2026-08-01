export interface CsvBar {
  datetime: string; // "yyyy-MM-dd HH:mm:ss"
  open: string;
  high: string;
  low: string;
  close: string;
}

const DT_RE = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function shiftDatetime(dt: string, hourOffset: number): string {
  const [d, t] = dt.replace("T", " ").split(" ");
  const [y, mo, da] = d.split("-").map(Number);
  const [h, mi, s = 0] = t.split(":").map(Number);
  const base = new Date(y, mo - 1, da, h, mi, s);
  base.setMinutes(base.getMinutes() + Math.round(hourOffset * 60));
  return `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())} ${pad(base.getHours())}:${pad(
    base.getMinutes()
  )}:${pad(base.getSeconds())}`;
}

/**
 * Rebuilds OHLC values from tokens where the decimal separator is a comma
 * (NinjaTrader export: `24696,25,24709,75,...` = 24696.25 / 24709.75 ...).
 * A token much shorter than the first price token is treated as a fraction.
 */
function rebuildOhlc(tokens: string[]): number[] | null {
  const nums: number[] = [];
  const refLen = tokens[0]?.length ?? 0;
  let i = 0;
  while (i < tokens.length && nums.length < 4) {
    const intPart = tokens[i];
    if (!/^-?\d+$/.test(intPart)) return null;
    let value = intPart;
    const next = tokens[i + 1];
    if (next && /^\d+$/.test(next) && next.length <= 2 && next.length < refLen - 1) {
      value = `${intPart}.${next}`;
      i += 2;
    } else {
      i += 1;
    }
    const n = parseFloat(value);
    if (!isFinite(n)) return null;
    nums.push(n);
  }
  return nums.length === 4 ? nums : null;
}

export function parseCsvBars(text: string, hourOffset = 0): CsvBar[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) throw new Error("csv is empty");

  const delimiter = lines[0].includes(";") ? ";" : ",";
  const out: CsvBar[] = [];

  for (let li = 0; li < lines.length; li++) {
    const raw = lines[li].split(delimiter).map((s) => s.trim().replace(/^"|"$/g, ""));
    if (raw.length < 5) continue;
    const dt = raw[0];
    if (!DT_RE.test(dt)) continue; // skips the header and malformed rows

    const rest = raw.slice(1);
    let ohlc: number[] | null;
    if (rest.some((t) => t.includes("."))) {
      ohlc = rest.slice(0, 4).map((t) => parseFloat(t));
      if (ohlc.some((n) => !isFinite(n))) ohlc = null;
    } else {
      ohlc = rebuildOhlc(rest);
    }
    if (!ohlc) continue;

    const datetime = hourOffset ? shiftDatetime(dt, hourOffset) : `${dt.replace("T", " ")}${dt.length === 16 ? ":00" : ""}`;
    out.push({
      datetime,
      open: String(ohlc[0]),
      high: String(ohlc[1]),
      low: String(ohlc[2]),
      close: String(ohlc[3]),
    });
  }

  if (out.length === 0) throw new Error("no valid ohlc rows found in csv");
  out.sort((a, b) => a.datetime.localeCompare(b.datetime));
  return out;
}
