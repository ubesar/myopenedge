import { useState, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import AppNavSidebar, { MobileHeader } from "@/components/AppNavSidebar";
import { toast } from "sonner";
import {
  Loader2, Play, Plus, X, TrendingUp, TrendingDown, Minus,
  ArrowUpRight, ArrowDownRight, Crown,
} from "lucide-react";

/* ───── Report types we run for each ticker ───── */
type ReportKey = "gapfill" | "ib" | "occ" | "insidebar" | "outsideday";

interface ReportCard {
  key: ReportKey;
  label: string;
  bias: "bullish" | "bearish" | "neutral";
  mainStat: string;
  subStats: { label: string; value: string }[];
}

interface TickerResult {
  symbol: string;
  loading: boolean;
  reports: ReportCard[];
}

const REPORT_LABELS: Record<ReportKey, string> = {
  gapfill: "gap fill",
  ib: "initial balance",
  occ: "opening candle",
  insidebar: "inside bar",
  outsideday: "outside day",
};

const DEFAULT_TICKERS_FUTURES = ["MNQ", "MES", "MGC", "MYM"];
const DEFAULT_TICKERS_STOCKS = ["QQQ", "SPY", "TSLA", "NVDA"];

/* ───── Tiny helper to import analysis functions lazily ───── */
import { analyzeIB } from "@/lib/ib-analysis";
import { analyzeOCC } from "@/lib/occ-analysis";
import { analyzeGapFill } from "@/lib/gapfill-analysis";
import { analyzeInsideBar } from "@/lib/insidebar-analysis";
import { analyzeOutsideDay } from "@/lib/outsideday-analysis";
import { z } from "zod";

const BarSchema = z.object({ datetime: z.string(), open: z.string(), high: z.string(), low: z.string(), close: z.string() }).passthrough();
const ResponseSchema = z.object({ values: z.array(BarSchema).min(1) }).passthrough();

const MAX_DAYS = 60; // 3 months default lookback
const BATCH_SIZE = 5000;

const WhatsInPlay = () => {
  const { user, loading: authLoading } = useAuth();
  const { isActive } = useSubscription();
  const isMobile = useIsMobile();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [marketType, setMarketType] = useState<"futures" | "stocks">("futures");
  const [tickers, setTickers] = useState<string[]>(DEFAULT_TICKERS_FUTURES);
  const [customTicker, setCustomTicker] = useState("");
  const [results, setResults] = useState<TickerResult[]>([]);
  const [running, setRunning] = useState(false);

  const isFree = !isActive;

  const switchMarket = (type: "futures" | "stocks") => {
    setMarketType(type);
    setTickers(type === "futures" ? DEFAULT_TICKERS_FUTURES : DEFAULT_TICKERS_STOCKS);
    setResults([]);
  };

  const addTicker = () => {
    const t = customTicker.trim().toUpperCase();
    if (t && !tickers.includes(t)) {
      setTickers([...tickers, t]);
    }
    setCustomTicker("");
  };

  const removeTicker = (t: string) => setTickers(tickers.filter((x) => x !== t));

  /* ───── Run all reports for all tickers ───── */
  const runAll = useCallback(async () => {
    if (isFree) {
      toast.error("What's in Play is a Pro feature. Upgrade to access.");
      return;
    }
    setRunning(true);
    const initial: TickerResult[] = tickers.map((s) => ({ symbol: s, loading: true, reports: [] }));
    setResults(initial);

    for (let i = 0; i < tickers.length; i++) {
      const ticker = tickers[i];
      try {
        const { data: json, error } = await supabase.functions.invoke("twelvedata-proxy", {
          body: { symbol: ticker, outputsize: String(BATCH_SIZE), key_index: i % 3 },
        });
        if (error) throw new Error("API error");
        const parsed = ResponseSchema.safeParse(json);
        if (!parsed.success) {
          setResults((prev) => prev.map((r) => r.symbol === ticker ? { ...r, loading: false } : r));
          continue;
        }
        const values = parsed.data.values as any;
        const weekdays = [1, 2, 3, 4, 5];

        const reports: ReportCard[] = [];

        // Gap Fill
        try {
          const gf = analyzeGapFill(values, MAX_DAYS, weekdays);
          if (gf.totalDays > 0) {
          const fillPct = gf.stats.gapUpFillRate;
            const fillDownPct = gf.stats.gapDownFillRate;
            const avgFill = (fillPct + fillDownPct) / 2;
            reports.push({
              key: "gapfill",
              label: REPORT_LABELS.gapfill,
              bias: avgFill > 65 ? "bullish" : avgFill < 45 ? "bearish" : "neutral",
              mainStat: `${avgFill.toFixed(0)}%`,
              subStats: [
                { label: "gap up fill", value: `${fillPct.toFixed(0)}%` },
                { label: "gap down fill", value: `${fillDownPct.toFixed(0)}%` },
                { label: "days", value: `${gf.totalDays}` },
              ],
            });
          }
        } catch {}

        // IB Breakout
        try {
          const ib = analyzeIB(values, 60, MAX_DAYS, weekdays);
          if (ib.totalDays > 0) {
            const hf = ib.highFirst;
            const lf = ib.lowFirst;
            const hfBreakHighPct = hf.total > 0 ? (hf.breakHigh / hf.total) * 100 : 0;
            const lfBreakLowPct = lf.total > 0 ? (lf.breakLow / lf.total) * 100 : 0;
            const bias = hfBreakHighPct > 55 ? "bullish" : lfBreakLowPct > 55 ? "bearish" : "neutral";
            reports.push({
              key: "ib",
              label: REPORT_LABELS.ib,
              bias,
              mainStat: `${hfBreakHighPct.toFixed(0)}%`,
              subStats: [
                { label: "HF → break high", value: `${hfBreakHighPct.toFixed(0)}%` },
                { label: "LF → break low", value: `${lfBreakLowPct.toFixed(0)}%` },
                { label: "days", value: `${ib.totalDays}` },
              ],
            });
          }
        } catch {}

        // OCC
        try {
          const occ = analyzeOCC(values, MAX_DAYS, "30m", weekdays);
          if (occ.totalDays > 0) {
            const greenPct = occ.greenCandle.greenDayPct;
            const redPct = occ.redCandle.redDayPct;
            const bias = greenPct > 60 ? "bullish" : redPct > 60 ? "bearish" : "neutral";
            reports.push({
              key: "occ",
              label: REPORT_LABELS.occ,
              bias,
              mainStat: `${greenPct.toFixed(0)}%`,
              subStats: [
                { label: "green cont.", value: `${greenPct.toFixed(0)}%` },
                { label: "red cont.", value: `${redPct.toFixed(0)}%` },
                { label: "days", value: `${occ.totalDays}` },
              ],
            });
          }
        } catch {}

        // Inside Bar
        try {
          const isb = analyzeInsideBar(values, MAX_DAYS, weekdays);
          if (isb.totalDays > 0) {
            const bPct = isb.breakoutPct;
            reports.push({
              key: "insidebar",
              label: REPORT_LABELS.insidebar,
              bias: isb.brokeHighPct > 55 ? "bullish" : isb.brokeLowPct > 55 ? "bearish" : "neutral",
              mainStat: `${bPct.toFixed(0)}%`,
              subStats: [
                { label: "breakout", value: `${bPct.toFixed(0)}%` },
                { label: "broke high", value: `${isb.brokeHighPct.toFixed(0)}%` },
                { label: "broke low", value: `${isb.brokeLowPct.toFixed(0)}%` },
              ],
            });
          }
        } catch {}

        // Outside Day
        try {
          const od = analyzeOutsideDay(values, MAX_DAYS, weekdays);
          if (od.totalDays > 0 && od.outsideDays > 0) {
            reports.push({
              key: "outsideday",
              label: REPORT_LABELS.outsideday,
              bias: od.bullish.total > od.bearish.total ? "bullish" : od.bearish.total > od.bullish.total ? "bearish" : "neutral",
              mainStat: `${od.outsidePct.toFixed(0)}%`,
              subStats: [
                { label: "occurrence", value: `${od.outsidePct.toFixed(0)}%` },
                { label: "bullish", value: `${od.bullish.total}` },
                { label: "bearish", value: `${od.bearish.total}` },
              ],
            });
          }
        } catch {}

        setResults((prev) => prev.map((r) => r.symbol === ticker ? { ...r, loading: false, reports } : r));
      } catch {
        setResults((prev) => prev.map((r) => r.symbol === ticker ? { ...r, loading: false } : r));
      }
    }
    setRunning(false);
  }, [tickers, isFree]);

  const biasIcon = (bias: "bullish" | "bearish" | "neutral") => {
    if (bias === "bullish") return <ArrowUpRight className="h-3.5 w-3.5 text-profit" />;
    if (bias === "bearish") return <ArrowDownRight className="h-3.5 w-3.5 text-loss" />;
    return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
  };

  const biasColor = (bias: "bullish" | "bearish" | "neutral") => {
    if (bias === "bullish") return "text-profit";
    if (bias === "bearish") return "text-loss";
    return "text-muted-foreground";
  };

  return (
    <div className="h-screen w-full flex flex-col lg:flex-row overflow-hidden bg-background">
      {isMobile && (
        <MobileHeader
          onMenuToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          title="what's in play"
        />
      )}

      {!isMobile && (
        <AppNavSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      )}
      {isMobile && (
        <AppNavSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      )}

      <main className="flex-1 min-w-0 overflow-y-auto p-4 lg:p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-[18px] lg:text-[22px] font-bold text-foreground lowercase">what's in play</h1>
          <p className="text-[12px] text-muted-foreground mt-1">
            consolidated view of all reports across your selected tickers. identify high-probability setups instantly.
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {/* Market toggle */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => switchMarket("futures")}
              className={`px-3 py-1.5 text-[12px] font-medium transition-colors ${marketType === "futures" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}
            >
              futures
            </button>
            <button
              onClick={() => switchMarket("stocks")}
              className={`px-3 py-1.5 text-[12px] font-medium transition-colors ${marketType === "stocks" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}
            >
              stocks
            </button>
          </div>

          {/* Ticker chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            {tickers.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground rounded-md px-2 py-1 text-[11px] font-medium">
                {t}
                <button onClick={() => removeTicker(t)} className="hover:text-loss transition-colors">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>

          {/* Add ticker */}
          <div className="flex items-center gap-1">
            <input
              value={customTicker}
              onChange={(e) => setCustomTicker(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && addTicker()}
              placeholder="add ticker"
              className="w-[90px] bg-card border border-border rounded-md px-2 py-1 text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button onClick={addTicker} className="p-1 rounded-md bg-secondary hover:bg-accent transition-colors">
              <Plus className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>

          {/* Run button */}
          <button
            onClick={runAll}
            disabled={running || tickers.length === 0}
            className="flex items-center gap-2 bg-primary text-primary-foreground rounded-lg px-4 py-1.5 text-[12px] font-medium disabled:opacity-50 transition-colors hover:bg-primary/90"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {running ? "analyzing..." : "run all"}
          </button>
        </div>

        {/* Pro gate */}
        {isFree && (
          <div className="rounded-xl border border-border bg-card/50 p-8 text-center max-w-md mx-auto">
            <Crown className="h-8 w-8 text-primary mx-auto mb-3" />
            <h3 className="text-[14px] font-semibold text-foreground mb-1">pro feature</h3>
            <p className="text-[12px] text-muted-foreground">
              what's in play is available for pro members. upgrade to access consolidated multi-ticker analysis.
            </p>
          </div>
        )}

        {/* Results grid */}
        {!isFree && results.length > 0 && (
          <div className="space-y-6">
            {results.map((tr) => (
              <div key={tr.symbol} className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-[14px] font-bold text-foreground uppercase">{tr.symbol}</h3>
                  {tr.loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
                </div>

                {tr.loading ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="h-[120px] rounded-lg border border-border bg-card/30 animate-pulse" />
                    ))}
                  </div>
                ) : tr.reports.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground italic">no data available</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                    {tr.reports.map((rpt) => (
                      <div
                        key={rpt.key}
                        className="rounded-lg border border-border bg-card/60 backdrop-blur-sm p-3 hover:border-primary/30 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                            {rpt.label}
                          </span>
                          {biasIcon(rpt.bias)}
                        </div>
                        <p className={`text-[22px] font-bold ${biasColor(rpt.bias)} leading-none mb-2`}>
                          {rpt.mainStat}
                        </p>
                        <div className="space-y-0.5">
                          {rpt.subStats.map((s) => (
                            <div key={s.label} className="flex items-center justify-between text-[10px]">
                              <span className="text-muted-foreground">{s.label}</span>
                              <span className="text-foreground font-medium">{s.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isFree && results.length === 0 && !running && (
          <div className="flex items-center justify-center h-[50vh]">
            <div className="border border-dashed border-border rounded-xl p-8 text-center max-w-sm">
              <TrendingUp className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-[13px] text-muted-foreground">
                select your tickers and hit "run all" to see what's in play across all reports
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default WhatsInPlay;
