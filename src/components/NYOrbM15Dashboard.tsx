import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Database, TrendingUp, TrendingDown } from "lucide-react";
import { supabase as _supa } from "@/integrations/supabase/client";
import type { FormedFirstStats, NYOrbResult } from "@/lib/ny-orb-m15";

// @ts-ignore — ny_session_bias is not in the generated types yet
const supabase: any = _supa as any;

interface Props {
  result: NYOrbResult;
  symbol: string;
  dateRange: string;
  weekdays: string;
}

const pct = (v: number, d = 2) => `${v.toFixed(d)}%`;

interface BiasRow {
  session_date: string;
  orb_high_price: number | null;
  orb_low_price: number | null;
  formed_first: string | null;
  first_breakout: string | null;
}

const BarPair = ({
  title,
  subtitle,
  highPct,
  lowPct,
  n,
  highlight,
}: {
  title: string;
  subtitle: string;
  highPct: number;
  lowPct: number;
  n: number;
  highlight: "high" | "low";
}) => {
  const bars = [
    { label: "first break ORB high", value: highPct, active: highlight === "high" },
    { label: "first break ORB low", value: lowPct, active: highlight === "low" },
  ];
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <p className="text-[14px] font-semibold text-foreground">{title}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>
      </div>

      <div className="p-4">
        <div className="flex gap-3">
          {/* y axis */}
          <div className="flex flex-col justify-between h-[220px] text-[10px] text-muted-foreground pr-1">
            {[80, 60, 40, 20, 0].map((t) => (
              <span key={t}>{t}%</span>
            ))}
          </div>
          <div className="flex-1 flex items-end justify-around h-[220px] border-l border-b border-border/60 px-4 gap-6">
            {bars.map((b) => (
              <div key={b.label} className="flex-1 max-w-[120px] flex flex-col justify-end h-full">
                <div
                  className={`w-full rounded-t-md flex items-center justify-center transition-all ${
                    b.active ? "bg-primary" : "bg-muted"
                  }`}
                  style={{ height: `${Math.max((b.value / 100) * 100, 4)}%` }}
                >
                  <span
                    className={`text-[12px] font-semibold ${
                      b.active ? "text-primary-foreground" : "text-foreground"
                    }`}
                  >
                    {pct(b.value)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-center gap-5 mt-3">
          {bars.map((b) => (
            <div key={b.label} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${b.active ? "bg-primary" : "bg-muted-foreground/50"}`} />
              <span className="text-[11px] text-muted-foreground">{b.label}</span>
            </div>
          ))}
        </div>
        <p className="text-center text-[10px] text-muted-foreground mt-2">sample: {n} sessions</p>
      </div>
    </div>
  );
};

const NYOrbM15Dashboard = ({ result, symbol, dateRange, weekdays }: Props) => {
  const [rows, setRows] = useState<BiasRow[] | null>(null);
  const [syncing, setSyncing] = useState(false);

  const loadRows = async () => {
    const { data } = await supabase
      .from("ny_session_bias")
      .select("session_date, orb_high_price, orb_low_price, formed_first, first_breakout")
      .eq("symbol", symbol.toUpperCase())
      .order("session_date", { ascending: false })
      .limit(1000);
    setRows((data as BiasRow[]) ?? []);
  };

  useEffect(() => {
    loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  const syncToDatabase = async () => {
    setSyncing(true);
    try {
      const payload = result.days.map((d) => ({
        symbol: symbol.toUpperCase(),
        session_date: d.date,
        orb_high_price: d.orbHigh,
        orb_low_price: d.orbLow,
        formed_first: d.formedFirst,
        first_breakout: d.firstBreakout,
      }));
      const { error } = await supabase
        .from("ny_session_bias")
        .upsert(payload, { onConflict: "symbol,session_date" });
      if (error) throw error;
      toast.success(`${payload.length} sessions saved to ny_session_bias`);
      await loadRows();
    } catch (e: any) {
      toast.error(e.message || "failed to save sessions");
    } finally {
      setSyncing(false);
    }
  };

  // stats from the stored history when available, otherwise from the live analysis
  const dbStats = useMemo(() => {
    if (!rows || rows.length === 0) return null;
    const build = (ff: "HIGH" | "LOW"): FormedFirstStats => {
      const set = rows.filter((r) => r.formed_first === ff && (r.first_breakout === "HIGH" || r.first_breakout === "LOW"));
      const breakHigh = set.filter((r) => r.first_breakout === "HIGH").length;
      const breakLow = set.filter((r) => r.first_breakout === "LOW").length;
      const n = set.length;
      return {
        formedFirst: ff, n, breakHigh, breakLow,
        breakHighPct: n ? (breakHigh / n) * 100 : 0,
        breakLowPct: n ? (breakLow / n) * 100 : 0,
        noBreakout: rows.filter((r) => r.formed_first === ff).length - n,
      };
    };
    return { high: build("HIGH"), low: build("LOW"), source: "ny_session_bias" as const };
  }, [rows]);

  const highStats = dbStats?.high ?? result.highFirstStats;
  const lowStats = dbStats?.low ?? result.lowFirstStats;
  const source = dbStats ? `supabase · ny_session_bias (${rows?.length ?? 0} rows)` : "live analysis";

  const today = result.today;
  const bias = today
    ? today.formedFirst === "LOW"
      ? { dir: "long" as const, prob: lowStats.breakHighPct, text: "probability to break High" }
      : { dir: "short" as const, prob: highStats.breakLowPct, text: "probability to break Low" }
    : null;

  const settings = [
    { label: "ORB timeframe", value: "09:30 am to 09:45 am (UTC-4)" },
    { label: "candle timeframe", value: "5min (09:30 / 09:35 / 09:40)" },
    { label: "ORB size", value: "any size" },
    { label: "ORB breakout measure", value: "by wick" },
    { label: "target", value: "0.5 × extension ORB" },
    { label: "risk per trade", value: "$100 fixed" },
    { label: "weekdays to use", value: weekdays },
    { label: "date range", value: dateRange },
    { label: "data source", value: source },
  ];

  return (
    <div className="space-y-4">
      {/* daily bias badge */}
      {bias && today && (
        <div
          className={`rounded-xl border px-4 py-3 flex flex-wrap items-center gap-3 ${
            bias.dir === "long"
              ? "border-emerald-500/40 bg-emerald-500/10"
              : "border-destructive/40 bg-destructive/10"
          }`}
        >
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold ${
              bias.dir === "long" ? "bg-emerald-500 text-black" : "bg-destructive text-destructive-foreground"
            }`}
          >
            {bias.dir === "long" ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            Bias: {bias.dir === "long" ? "Long" : "Short"} ({bias.prob.toFixed(0)}% {bias.text})
          </span>
          <span className="text-[12px] text-foreground/80">
            {today.date} · {today.formedFirst === "LOW" ? "Low formed first" : "High formed first"} · ORB{" "}
            <span className="font-mono">{today.orbLow.toFixed(2)} – {today.orbHigh.toFixed(2)}</span>
            {today.firstBreakout !== "NONE" && (
              <> · first breakout {today.firstBreakout.toLowerCase()} @ {today.breakoutTime}</>
            )}
          </span>
        </div>
      )}

      {/* two headline probability cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BarPair
          title="15min ORB high formed first"
          subtitle={`${symbol.toUpperCase()} 15min ORB high formed first | by rejection | ${dateRange} | 9:30 am - 4:00 pm (UTC-4)`}
          highPct={highStats.breakHighPct}
          lowPct={highStats.breakLowPct}
          n={highStats.n}
          highlight="high"
        />
        <BarPair
          title="15min ORB low formed first"
          subtitle={`${symbol.toUpperCase()} 15min ORB low formed first | by rejection | ${dateRange} | 9:30 am - 4:00 pm (UTC-4)`}
          highPct={lowStats.breakHighPct}
          lowPct={lowStats.breakLowPct}
          n={lowStats.n}
          highlight="high"
        />
      </div>

      {/* headline stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {[
          { l: "sessions", v: String(result.totalDays) },
          { l: "high formed first", v: String(result.highFirstStats.n) },
          { l: "low formed first", v: String(result.lowFirstStats.n) },
          { l: "1x extension hit", v: pct(result.extensionHitPct, 1) },
          { l: "entry win rate", v: pct(result.tradeStats.winRate, 1) },
          { l: "expectancy", v: `${result.tradeStats.expectancyR.toFixed(2)}R` },
          { l: "net p&l ($100 risk)", v: `$${result.tradeStats.totalPnlUsd.toFixed(0)}` },
        ].map((s) => (
          <div key={s.l} className="rounded-xl border border-border bg-card p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.l}</p>
            <p className="text-[16px] font-semibold text-foreground font-mono mt-1">{s.v}</p>
          </div>
        ))}
      </div>

      {/* custom settings */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <p className="text-center text-[12px] text-muted-foreground py-2 border-b border-border">custom settings</p>
        <div className="grid grid-cols-1 sm:grid-cols-2">
          {settings.map((s, i) => (
            <div key={s.label} className={`px-4 py-2 border-border ${i % 2 === 0 ? "sm:border-r" : ""} border-b`}>
              <span className="text-[11px] text-muted-foreground">{s.label}: </span>
              <span className="text-[11px] text-foreground font-medium">{s.value}</span>
            </div>
          ))}
        </div>
        <div className="p-3 flex justify-end">
          <button
            onClick={syncToDatabase}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-[12px] font-medium disabled:opacity-60"
          >
            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Database className="h-3.5 w-3.5" />}
            save sessions to database
          </button>
        </div>
      </div>

      {/* entry engine rules */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-[12px] text-foreground/80 leading-relaxed">
        <strong className="text-foreground">entry rules (target 0.5 × extension ORB, risk fix $100)</strong> — C1: candle m15 pertama yang momentum. C2: setelah C1 close, tunggu pullback lalu pasang stop order di high C1 (long) / low C1 (short). SL mengikuti low/high C2 selama order belum trigger; jika C2 break sisi berlawanan C1 → order dibatalkan; setelah trigger SL tidak bergeser lagi. target = 0.5 × extension ORB (RR bervariasi tergantung jarak SL), risk fix $100 per trade.
      </div>

      {/* trade history */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <p className="text-[12px] font-medium text-foreground px-4 py-2 border-b border-border">session history</p>
        <div className="overflow-x-auto max-h-[420px]">
          <table className="w-full text-[11px]">
            <thead className="bg-muted/40 sticky top-0">
              <tr className="text-muted-foreground">
                {["date", "orb low", "orb high", "formed first", "first breakout", "1x ext", "entry", "sl", "tp", "result"].map((h) => (
                  <th key={h} className="text-left font-medium px-3 py-2 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...result.days].reverse().map((d) => (
                <tr key={d.date} className="border-t border-border/60">
                  <td className="px-3 py-1.5 font-mono whitespace-nowrap">{d.date}</td>
                  <td className="px-3 py-1.5 font-mono">{d.orbLow.toFixed(2)}</td>
                  <td className="px-3 py-1.5 font-mono">{d.orbHigh.toFixed(2)}</td>
                  <td className={`px-3 py-1.5 font-medium ${d.formedFirst === "LOW" ? "text-emerald-500" : "text-destructive"}`}>{d.formedFirst.toLowerCase()}</td>
                  <td className="px-3 py-1.5">{d.firstBreakout.toLowerCase()}{d.breakoutTime ? ` @ ${d.breakoutTime}` : ""}</td>
                  <td className="px-3 py-1.5">{d.firstBreakout === "NONE" ? "—" : d.extensionHit ? "yes" : "no"}</td>
                  <td className="px-3 py-1.5 font-mono">{d.trade?.risk ? d.trade.entry.toFixed(2) : "—"}</td>
                  <td className="px-3 py-1.5 font-mono">{d.trade?.risk ? d.trade.stop.toFixed(2) : "—"}</td>
                  <td className="px-3 py-1.5 font-mono">{d.trade?.risk ? d.trade.target.toFixed(2) : "—"}</td>
                  <td className={`px-3 py-1.5 font-medium ${d.trade?.outcome === "win" ? "text-emerald-500" : d.trade?.outcome === "loss" ? "text-destructive" : "text-muted-foreground"}`}>
                    {d.trade?.outcome ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default NYOrbM15Dashboard;
