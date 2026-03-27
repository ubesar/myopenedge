import { useState, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import AppNavSidebar, { MobileHeader } from "@/components/AppNavSidebar";
import { toast } from "sonner";
import { Crown, TrendingUp } from "lucide-react";

import WIPControls from "@/components/whats-in-play/WIPControls";
import WIPTickerRow from "@/components/whats-in-play/WIPTickerRow";
import WIPSummaryBar from "@/components/whats-in-play/WIPSummaryBar";
import type { ReportCardData } from "@/components/whats-in-play/WIPReportCard";

import { analyzeIB } from "@/lib/ib-analysis";
import { analyzeOCC } from "@/lib/occ-analysis";
import { analyzeGapFill } from "@/lib/gapfill-analysis";
import { analyzeInsideBar } from "@/lib/insidebar-analysis";
import { analyzeOutsideDay } from "@/lib/outsideday-analysis";
import { z } from "zod";

const BarSchema = z.object({ datetime: z.string(), open: z.string(), high: z.string(), low: z.string(), close: z.string() }).passthrough();
const ResponseSchema = z.object({ values: z.array(BarSchema).min(1) }).passthrough();

const MAX_DAYS = 60;
const BATCH_SIZE = 5000;
const DEFAULT_TICKERS_FUTURES = ["MNQ", "MES", "MGC", "MYM"];
const DEFAULT_TICKERS_STOCKS = ["QQQ", "SPY", "TSLA", "NVDA"];

interface TickerResult {
  symbol: string;
  loading: boolean;
  reports: ReportCardData[];
}

/* ─── Build report cards from raw analysis ─── */
function buildReports(values: any[]): ReportCardData[] {
  const weekdays = [1, 2, 3, 4, 5];
  const reports: ReportCardData[] = [];

  try {
    const gf = analyzeGapFill(values, MAX_DAYS, weekdays);
    if (gf.totalDays > 0) {
      const upFill = gf.stats.gapUpFillRate;
      const downFill = gf.stats.gapDownFillRate;
      const avg = (upFill + downFill) / 2;
      reports.push({
        key: "gapfill", label: "gap fill",
        bias: avg > 65 ? "bullish" : avg < 45 ? "bearish" : "neutral",
        mainStat: `${avg.toFixed(0)}%`, mainLabel: "average fill rate",
        subStats: [
          { label: "gap up fill", value: `${upFill.toFixed(0)}%` },
          { label: "gap down fill", value: `${downFill.toFixed(0)}%` },
          { label: "sample days", value: `${gf.totalDays}` },
        ],
        description: avg > 65 ? "high gap fill probability — fades tend to work" : avg < 45 ? "gaps rarely fill — trend continuation likely" : "mixed gap fill behavior",
      });
    }
  } catch {}

  try {
    const ib = analyzeIB(values, 60, MAX_DAYS, weekdays);
    if (ib.totalDays > 0) {
      const hf = ib.highFirst;
      const lf = ib.lowFirst;
      const hfPct = hf.total > 0 ? (hf.breakHigh / hf.total) * 100 : 0;
      const lfPct = lf.total > 0 ? (lf.breakLow / lf.total) * 100 : 0;
      const bias = hfPct > 55 ? "bullish" : lfPct > 55 ? "bearish" : "neutral";
      reports.push({
        key: "ib", label: "initial balance",
        bias, mainStat: `${hfPct.toFixed(0)}%`, mainLabel: "HF → break high rate",
        subStats: [
          { label: "HF → break high", value: `${hfPct.toFixed(0)}%` },
          { label: "LF → break low", value: `${lfPct.toFixed(0)}%` },
          { label: "sample days", value: `${ib.totalDays}` },
        ],
        description: bias === "bullish" ? "strong high-first breakout tendency" : bias === "bearish" ? "low-first breakdown dominates" : "balanced IB behavior",
      });
    }
  } catch {}

  try {
    const occ = analyzeOCC(values, MAX_DAYS, "30m", weekdays);
    if (occ.totalDays > 0) {
      const gPct = occ.greenCandle.greenDayPct;
      const rPct = occ.redCandle.redDayPct;
      const bias = gPct > 60 ? "bullish" : rPct > 60 ? "bearish" : "neutral";
      reports.push({
        key: "occ", label: "opening candle",
        bias, mainStat: `${gPct.toFixed(0)}%`, mainLabel: "green candle continuation",
        subStats: [
          { label: "green cont.", value: `${gPct.toFixed(0)}%` },
          { label: "red cont.", value: `${rPct.toFixed(0)}%` },
          { label: "sample days", value: `${occ.totalDays}` },
        ],
        description: bias === "bullish" ? "opening candle color tends to predict direction" : bias === "bearish" ? "red opens signal continued selling" : "opening candle not strongly predictive",
      });
    }
  } catch {}

  try {
    const isb = analyzeInsideBar(values, MAX_DAYS, weekdays);
    if (isb.totalDays > 0) {
      const bPct = isb.breakoutPct;
      reports.push({
        key: "insidebar", label: "inside bar",
        bias: isb.brokeHighPct > 55 ? "bullish" : isb.brokeLowPct > 55 ? "bearish" : "neutral",
        mainStat: `${bPct.toFixed(0)}%`, mainLabel: "breakout rate",
        subStats: [
          { label: "breakout", value: `${bPct.toFixed(0)}%` },
          { label: "broke high", value: `${isb.brokeHighPct.toFixed(0)}%` },
          { label: "broke low", value: `${isb.brokeLowPct.toFixed(0)}%` },
        ],
        description: isb.brokeHighPct > 55 ? "breakouts tend to go up" : isb.brokeLowPct > 55 ? "breakdowns more common" : "balanced breakout direction",
      });
    }
  } catch {}

  try {
    const od = analyzeOutsideDay(values, MAX_DAYS, weekdays);
    if (od.totalDays > 0 && od.outsideDays > 0) {
      reports.push({
        key: "outsideday", label: "outside day",
        bias: od.bullish.total > od.bearish.total ? "bullish" : od.bearish.total > od.bullish.total ? "bearish" : "neutral",
        mainStat: `${od.outsidePct.toFixed(0)}%`, mainLabel: "occurrence rate",
        subStats: [
          { label: "occurrence", value: `${od.outsidePct.toFixed(0)}%` },
          { label: "bullish", value: `${od.bullish.total}` },
          { label: "bearish", value: `${od.bearish.total}` },
        ],
        description: od.bullish.total > od.bearish.total ? "outside days lean bullish" : "outside days lean bearish",
      });
    }
  } catch {}

  return reports;
}

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
    if (t && !tickers.includes(t)) setTickers([...tickers, t]);
    setCustomTicker("");
  };

  const removeTicker = (t: string) => setTickers(tickers.filter((x) => x !== t));

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
          setResults((prev) => prev.map((r) => (r.symbol === ticker ? { ...r, loading: false } : r)));
          continue;
        }
        const reports = buildReports(parsed.data.values as any);
        setResults((prev) => prev.map((r) => (r.symbol === ticker ? { ...r, loading: false, reports } : r)));
      } catch {
        setResults((prev) => prev.map((r) => (r.symbol === ticker ? { ...r, loading: false } : r)));
      }
    }
    setRunning(false);
  }, [tickers, isFree]);

  if (!authLoading && !user) return <Navigate to="/auth" replace />;

  return (
    <div className="h-screen w-full flex flex-col lg:flex-row overflow-hidden bg-background">
      {isMobile && (
        <MobileHeader onMenuToggle={() => setSidebarCollapsed(!sidebarCollapsed)} title="what's in play" />
      )}
      <AppNavSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

      <main className="flex-1 min-w-0 overflow-y-auto p-4 lg:p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-[18px] lg:text-[22px] font-bold text-foreground lowercase">what's in play</h1>
          <p className="text-[12px] text-muted-foreground mt-1 max-w-xl">
            consolidated view across all reports for your selected tickers. stack probabilities to identify the highest-edge setups instantly.
          </p>
        </div>

        {/* Controls */}
        <WIPControls
          marketType={marketType}
          onSwitchMarket={switchMarket}
          tickers={tickers}
          onRemoveTicker={removeTicker}
          customTicker={customTicker}
          onCustomTickerChange={setCustomTicker}
          onAddTicker={addTicker}
          running={running}
          onRun={runAll}
        />

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

        {/* Summary bar */}
        {!isFree && !running && results.length > 0 && (
          <WIPSummaryBar results={results} />
        )}

        {/* Results */}
        {!isFree && results.length > 0 && (
          <div className="space-y-8">
            {results.map((tr) => (
              <WIPTickerRow key={tr.symbol} symbol={tr.symbol} loading={tr.loading} reports={tr.reports} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isFree && results.length === 0 && !running && (
          <div className="flex items-center justify-center h-[50vh]">
            <div className="border border-dashed border-border rounded-xl p-8 text-center max-w-sm">
              <TrendingUp className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-[13px] text-muted-foreground">
                select your tickers and hit "run all reports" to see what's in play across all reports
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default WhatsInPlay;
