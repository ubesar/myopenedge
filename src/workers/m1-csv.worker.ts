import { parseLine } from "@/lib/seasonal-window";

/** Streams a large NinjaTrader M1 CSV and returns compact typed arrays. */
self.onmessage = async (ev: MessageEvent<{ file: File }>) => {
  const file = ev.data.file;
  try {
    const cap0 = Math.max(1024, Math.ceil(file.size / 45));
    let cap = cap0;
    let t = new Int32Array(cap), o = new Float32Array(cap), h = new Float32Array(cap), l = new Float32Array(cap), c = new Float32Array(cap);
    let n = 0, read = 0, lastPct = -1, rest = "";
    const reader = file.stream().pipeThrough(new TextDecoderStream()).getReader();
    const push = (line: string) => {
      const r = parseLine(line);
      if (!r) return;
      if (n === cap) {
        cap *= 2;
        const t2 = new Int32Array(cap); t2.set(t); t = t2;
        const o2 = new Float32Array(cap); o2.set(o); o = o2;
        const h2 = new Float32Array(cap); h2.set(h); h = h2;
        const l2 = new Float32Array(cap); l2.set(l); l = l2;
        const c2 = new Float32Array(cap); c2.set(c); c = c2;
      }
      t[n] = r[0]; o[n] = r[1]; h[n] = r[2]; l[n] = r[3]; c[n] = r[4]; n++;
    };
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      read += value.length;
      const lines = (rest + value).split(/\r?\n/);
      rest = lines.pop() ?? "";
      for (const l2 of lines) push(l2);
      const pct = Math.floor((read / file.size) * 100);
      if (pct !== lastPct) { lastPct = pct; (self as any).postMessage({ type: "progress", pct }); }
    }
    if (rest) push(rest);
    if (n === 0) throw new Error("tidak ada baris ohlc valid (format: Time,Open,High,Low,Close)");

    // sort by time if needed + dedupe
    let sorted = true;
    for (let i = 1; i < n; i++) if (t[i] < t[i - 1]) { sorted = false; break; }
    let idx: number[] | null = null;
    if (!sorted) {
      idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => t[a] - t[b]);
    }
    const T = new Int32Array(n), O = new Float32Array(n), H = new Float32Array(n), L = new Float32Array(n), C = new Float32Array(n);
    let m = 0;
    for (let k = 0; k < n; k++) {
      const i = idx ? idx[k] : k;
      if (m > 0 && T[m - 1] === t[i]) continue;
      T[m] = t[i]; O[m] = o[i]; H[m] = h[i]; L[m] = l[i]; C[m] = c[i]; m++;
    }
    const out = { t: T.slice(0, m), o: O.slice(0, m), h: H.slice(0, m), l: L.slice(0, m), c: C.slice(0, m) };
    (self as any).postMessage({ type: "done", series: out }, [out.t.buffer, out.o.buffer, out.h.buffer, out.l.buffer, out.c.buffer]);
  } catch (e: any) {
    (self as any).postMessage({ type: "error", message: e?.message || String(e) });
  }
};
