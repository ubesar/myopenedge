import { useState, useMemo } from "react";
import AITradingInsight from "@/components/AITradingInsight";
import ContinuationStackCard from "@/components/ContinuationStackCard";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Navigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Bookmark, Loader2, SlidersHorizontal, PanelRightOpen } from "lucide-react";
import logo from "@/assets/logo.png";
import { type AnalysisMode } from "@/components/ControlPanel";
import AppNavSidebar, { MobileHeader } from "@/components/AppNavSidebar";
import ParameterPanel, { type OCCTimeframe, type MomentumBodyRatio, type OCCBodyRatio } from "@/components/ParameterPanel";
import RightSidebar from "@/components/RightSidebar";
import { useTemplates, type TemplateParams } from "@/hooks/useTemplates";
import ChartCard from "@/components/ChartCard";
import { useAnalysisHistory, type AnalysisRun } from "@/hooks/useAnalysisHistory";
import { useIsMobile } from "@/hooks/use-mobile";

import { analyzeIB, type AnalysisResult } from "@/lib/ib-analysis";
import { analyzeMomentum, type MomentumResult } from "@/lib/momentum-analysis";
import { analyzeOCC, type OCCResult } from "@/lib/occ-analysis";
import { analyzeGapFill, type GapFillResult } from "@/lib/gapfill-analysis";
import GapFillDashboard from "@/components/GapFillDashboard";
import { analyzeInsideBar, type InsideBarResult } from "@/lib/insidebar-analysis";
import { analyzeOutsideDay, type OutsideDayResult } from "@/lib/outsideday-analysis";
import { analyzeGlobexIB, type GlobexIBResult } from "@/lib/globex-ib-analysis";
import { analyzeLondonIB, type LondonIBResult } from "@/lib/london-ib-analysis";
import InsideBarReport from "@/components/InsideBarReport";
import OutsideDayReport from "@/components/OutsideDayReport";
import GlobexIBDashboard from "@/components/GlobexIBDashboard";
import LondonIBDashboard from "@/components/LondonIBDashboard";
import { useSubscription } from "@/hooks/useSubscription";
import { z } from "zod";

const BarSchema = z.object({
  datetime: z.string(),
  open: z.string(),
  high: z.string(),
  low: z.string(),
  close: z.string()
}).passthrough();

const TwelveDataResponseSchema = z.object({
  values: z.array(BarSchema).min(1)
}).passthrough();

const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { isActive } = useSubscription();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [momentumResult, setMomentumResult] = useState<MomentumResult | null>(null);
  const [occResult, setOccResult] = useState<OCCResult | null>(null);
  const [gapFillResult, setGapFillResult] = useState<GapFillResult | null>(null);
  const [insideBarResult, setInsideBarResult] = useState<InsideBarResult | null>(null);
  const [outsideDayResult, setOutsideDayResult] = useState<OutsideDayResult | null>(null);
  const [globexIBResult, setGlobexIBResult] = useState<GlobexIBResult | null>(null);
  const [londonIBResult, setLondonIBResult] = useState<LondonIBResult | null>(null);
  const [occRawBars, setOccRawBars] = useState<any[] | null>(null);
  const [occMaxDays, setOccMaxDays] = useState<number>(0);
  const [occWeekdays, setOccWeekdays] = useState<number[]>([1,2,3,4,5]);
  const [symbol, setSymbol] = useState("");
  const [activeMode, setActiveMode] = useState<AnalysisMode>("ib");
  const [selectedRunId, setSelectedRunId] = useState<string | undefined>();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [occCandleSize, setOccCandleSize] = useState<import("@/lib/occ-analysis").OCCCandleSize>("30m");
  const [momentumTimeframe, setMomentumTimeframe] = useState<OCCTimeframe>("M15");
  const [analysisMaxDays, setAnalysisMaxDays] = useState<number>(0);
  const [analysisWeekdays, setAnalysisWeekdays] = useState<number[]>([1,2,3,4,5]);
  const { runs: historyRuns, addRun, deleteRun } = useAnalysisHistory();
  const { templates, saveTemplate, deleteTemplate, loading: templateLoading } = useTemplates();

  // Mobile panels
  const [showParams, setShowParams] = useState(false);
  const [showRight, setShowRight] = useState(false);

  const isFree = !isActive;

  const DAY_NAMES_SHORT = ["", "Mon", "Tue", "Wed", "Thu", "Fri"];
  const formatDateRange = (days: number) => {
    if (days <= 20) return "1 month";
    if (days <= 40) return "2 months";
    if (days <= 60) return "3 months";
    if (days <= 120) return "6 months";
    return "12 months";
  };
  const formatWeekdays = (wd: number[]) => {
    if (wd.length === 5) return "all days";
    return wd.map(d => DAY_NAMES_SHORT[d]).join(", ");
  };

  if (!authLoading && !user) return <Navigate to="/auth" replace />;

  const MAX_BATCH_DAYS = 60; // ~3 months of 5min bars per request (approx 4680 bars)
  const BATCH_OUTPUTSIZE = 5000;
  const BATCH_DELAY_MS = 3000; // reduced delay since requests are distributed across API keys

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const fetchMarketData = async (ticker: string, totalDays: number) => {
    if (totalDays <= MAX_BATCH_DAYS) {
      const { data, error } = await supabase.functions.invoke("twelvedata-proxy", {
        body: { symbol: ticker, outputsize: String(BATCH_OUTPUTSIZE), key_index: 0 },
      });
      if (error) throw new Error("Failed to fetch market data");
      return data;
    }

    // Pagination: multiple batches, distributed across API keys via key_index
    let allValues: any[] = [];
    let endDate: string | null = null;
    let remaining = totalDays;
    let batchIndex = 0;

    while (remaining > 0) {
      const body: Record<string, any> = {
        symbol: ticker,
        outputsize: String(BATCH_OUTPUTSIZE),
        key_index: batchIndex, // round-robin across API keys
      };
      if (endDate) body.end_date = endDate;

      const { data, error } = await supabase.functions.invoke("twelvedata-proxy", { body });
      if (error) throw new Error("Failed to fetch market data (batch " + (batchIndex + 1) + ")");
      if (data?.status === "error") throw new Error(data.message || "API error on batch " + (batchIndex + 1));

      const values = data?.values;
      if (!values || !Array.isArray(values) || values.length === 0) break;

      allValues = allValues.concat(values);

      const oldestBar = values[values.length - 1];
      endDate = oldestBar.datetime;

      remaining -= MAX_BATCH_DAYS;
      batchIndex++;

      // Shorter delay since each batch uses a different API key
      if (remaining > 0) {
        await sleep(BATCH_DELAY_MS);
      }
    }

    const seen = new Set<string>();
    const deduped = allValues.filter((v) => {
      if (seen.has(v.datetime)) return false;
      seen.add(v.datetime);
      return true;
    });

    return { values: deduped };
  };

  const handleRun = async (ticker: string, ibWindow: number, maxDays: number, mode: AnalysisMode, bodyRatio: MomentumBodyRatio = "0.50", occBodyRatio: OCCBodyRatio = "0.50", weekdays: number[] = [1,2,3,4,5]) => {
    let effectiveIbWindow = ibWindow;
    let effectiveMaxDays = maxDays;
    let effectiveMode = mode;

    if (isFree) {
      effectiveMaxDays = Math.min(maxDays, 20);
      effectiveIbWindow = Math.min(ibWindow, 60);
      const freeAllowedModes: AnalysisMode[] = ["ib", "occ"];
      if (!freeAllowedModes.includes(mode)) {
        effectiveMode = "ib";
      }
    }

    setLoading(true);
    setResult(null); setMomentumResult(null); setOccResult(null); setGapFillResult(null); setInsideBarResult(null); setOutsideDayResult(null); setGlobexIBResult(null); setLondonIBResult(null);
    setSymbol(ticker); setActiveMode(effectiveMode); setAnalysisMaxDays(effectiveMaxDays); setAnalysisWeekdays(weekdays);
    // Close mobile param panel after run
    if (isMobile) setShowParams(false);
    try {
      if (effectiveMode === "globex-ib" || effectiveMode === "london-ib") {
        // Both use Massive API via massive-bars edge function
        // Split into 90-day client-side batches to avoid CPU timeout
        const MASSIVE_BATCH_DAYS = 90;
        const MASSIVE_BATCH_DELAY = 2000;
        const now = new Date();
        const calendarDaysNeeded = Math.ceil(effectiveMaxDays * 1.5) + 7;
        const globalFrom = new Date(now);
        globalFrom.setDate(globalFrom.getDate() - calendarDaysNeeded);

        const label = effectiveMode === "london-ib" ? "London" : "Globex";
        const totalBatches = Math.ceil(calendarDaysNeeded / MASSIVE_BATCH_DAYS);
        toast.info(`Fetching ${effectiveMaxDays} days of ${label} data (${totalBatches} batch${totalBatches > 1 ? "es" : ""})...`, { duration: 5000 });

        let allValues: any[] = [];
        let currentFrom = new Date(globalFrom);

        for (let i = 0; i < totalBatches; i++) {
          const batchEnd = new Date(currentFrom);
          batchEnd.setDate(batchEnd.getDate() + MASSIVE_BATCH_DAYS);
          if (batchEnd > now) batchEnd.setTime(now.getTime());

          const fromStr = currentFrom.toISOString().split("T")[0];
          const toStr = batchEnd.toISOString().split("T")[0];

          try {
            const { data: json, error } = await supabase.functions.invoke("massive-bars", {
              body: { symbol: ticker, from: fromStr, to: toStr, multiplier: 5, timespan: "minute" },
            });
            if (!error && json?.values) {
              allValues = allValues.concat(json.values);
            }
          } catch (e) {
            console.error(`Batch ${i + 1} failed:`, e);
          }

          currentFrom = new Date(batchEnd);
          currentFrom.setDate(currentFrom.getDate() + 1);

          if (i < totalBatches - 1) {
            await sleep(MASSIVE_BATCH_DELAY);
          }
        }

        // Deduplicate by datetime
        const seen = new Set<string>();
        const deduped = allValues.filter((v) => {
          if (seen.has(v.datetime)) return false;
          seen.add(v.datetime);
          return true;
        });

        if (deduped.length === 0) { toast.error("No data returned from Massive API."); return; }

        if (effectiveMode === "globex-ib") {
          const a = analyzeGlobexIB(deduped, effectiveIbWindow, effectiveMaxDays, weekdays);
          if (a.totalDays === 0) { toast.error("Not enough overnight data."); return; }
          setGlobexIBResult(a);
          addRun(effectiveMode, ticker, { totalDays: a.totalDays, ibWindow: effectiveIbWindow, highFirst: a.highFirst, lowFirst: a.lowFirst });
        } else {
          const a = analyzeLondonIB(deduped, effectiveIbWindow, effectiveMaxDays, weekdays);
          if (a.totalDays === 0) { toast.error("Not enough London session data."); return; }
          setLondonIBResult(a);
          addRun(effectiveMode, ticker, { totalDays: a.totalDays, ibWindow: effectiveIbWindow, highFirst: a.highFirst, lowFirst: a.lowFirst });
        }
      } else {
        const json = await fetchMarketData(ticker, effectiveMaxDays);
        if (json.status === "error") { toast.error(json.message || "API error"); return; }
        const parsed = TwelveDataResponseSchema.safeParse(json);
        if (!parsed.success) { toast.error("Invalid or empty data returned."); return; }
        const values = parsed.data.values;

        if (effectiveMode === "ib") {
          const a = analyzeIB(values as any, effectiveIbWindow, effectiveMaxDays, weekdays);
          if (a.totalDays === 0) { toast.error("Not enough data."); return; }
          setResult(a);
          addRun(effectiveMode, ticker, { totalDays: a.totalDays, ibWindow: effectiveIbWindow, highFirst: a.highFirst, lowFirst: a.lowFirst });
        } else if (effectiveMode === "momentum") {
          const a = analyzeMomentum(values as any, effectiveIbWindow, effectiveMaxDays, parseFloat(bodyRatio), weekdays);
          if (a.totalDays === 0) { toast.error("Not enough data."); return; }
          setMomentumResult(a);
          addRun(effectiveMode, ticker, { totalDays: a.totalDays, tfStats: a.tfStats });
        } else if (effectiveMode === "occ") {
          setOccRawBars(values as any);
          setOccMaxDays(effectiveMaxDays);
          setOccWeekdays(weekdays);
          const a = analyzeOCC(values as any, effectiveMaxDays, occCandleSize, weekdays);
          if (a.totalDays === 0) { toast.error("Not enough data."); return; }
          setOccResult(a);
          addRun(effectiveMode, ticker, { totalDays: a.totalDays, candleSize: a.candleSize, greenCandle: a.greenCandle, redCandle: a.redCandle });
        } else if (effectiveMode === "gapfill") {
          const a = analyzeGapFill(values as any, effectiveMaxDays, weekdays);
          if (a.totalDays === 0) { toast.error("Not enough data."); return; }
          setGapFillResult(a);
          addRun(effectiveMode, ticker, { totalDays: a.totalDays, stats: a.stats });
        } else if (effectiveMode === "insidebar") {
          const a = analyzeInsideBar(values as any, effectiveMaxDays, weekdays);
          if (a.totalDays === 0) { toast.error("Not enough data."); return; }
          setInsideBarResult(a);
          addRun(effectiveMode, ticker, { totalDays: a.totalDays, insideBarPct: a.insideBarPct, breakoutPct: a.breakoutPct });
        } else if (effectiveMode === "outsideday") {
          const a = analyzeOutsideDay(values as any, effectiveMaxDays, weekdays);
          if (a.totalDays === 0) { toast.error("Not enough data."); return; }
          setOutsideDayResult(a);
          addRun(effectiveMode, ticker, { totalDays: a.totalDays, outsidePct: a.outsidePct, bullishFilledPct: a.bullish.filledGapPct, bearishFilledPct: a.bearish.filledGapPct });
        }
      }

    } catch (err: any) {
      toast.error(err.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const hasResults = result || momentumResult || occResult || gapFillResult || insideBarResult || outsideDayResult || globexIBResult || londonIBResult;

  const reportTitle = hasResults
    ? `${symbol.toLowerCase()} ${activeMode === "ib" ? "initial balance breakout by rejection report" : activeMode === "globex-ib" ? "globex IB overnight breakout report" : activeMode === "london-ib" ? "london IB session breakout report" : activeMode === "momentum" ? "momentum candle continuation report" : activeMode === "occ" ? "opening candle continuation report" : activeMode === "insidebar" ? "inside bar probability report" : activeMode === "outsideday" ? "outside day volatility expansion report" : "gap fill statistics report"}`
    : "";

  const renderCharts = () => {
    if (activeMode === "ib" && result) {
      const hf = result.highFirst;
      const lf = result.lowFirst;
      const bs = result.breakTypeStats;
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <ChartCard
              title="IB high formed first"
              subtitle={`${symbol} · by rejection`}
              totalDays={hf.total}
              bars={[
                { name: "first break IB high", value: hf.total > 0 ? (hf.breakHigh / hf.total * 100) : 0, color: "primary" },
                { name: "first break IB low", value: hf.total > 0 ? (hf.breakLow / hf.total * 100) : 0, color: "muted" },
              ]}
              legendItems={[
                { label: "first break IB high", color: "hsl(var(--chart-bar-a))" },
                { label: "first break IB low", color: "hsl(var(--chart-bar-b))" },
              ]}
              settingsGrid={[
                { label: "IB timeframe", value: `${result.ibWindowMinutes} min` },
                { label: "candle timeframe", value: "5min" },
                { label: "IB size", value: "any size" },
                { label: "date range", value: formatDateRange(analysisMaxDays) },
                { label: "IB breakout measure", value: "by rejection (M5 close)" },
                { label: "weekdays to use", value: formatWeekdays(analysisWeekdays) },
              ]}
            />
            <ChartCard
              title="IB low formed first"
              subtitle={`${symbol} · by rejection`}
              totalDays={lf.total}
              bars={[
                { name: "first break IB high", value: lf.total > 0 ? (lf.breakHigh / lf.total * 100) : 0, color: "primary" },
                { name: "first break IB low", value: lf.total > 0 ? (lf.breakLow / lf.total * 100) : 0, color: "muted" },
              ]}
              legendItems={[
                { label: "first break IB high", color: "hsl(var(--chart-bar-a))" },
                { label: "first break IB low", color: "hsl(var(--chart-bar-b))" },
              ]}
              settingsGrid={[
                { label: "IB timeframe", value: `${result.ibWindowMinutes} min` },
                { label: "candle timeframe", value: "5min" },
                { label: "IB size", value: "any size" },
                { label: "date range", value: formatDateRange(analysisMaxDays) },
                { label: "IB breakout measure", value: "by rejection (M5 close)" },
                { label: "weekdays to use", value: formatWeekdays(analysisWeekdays) },
              ]}
            />
          </div>

          {/* Break Type Stats — Edgeful Model */}
          <div className="rounded-lg border border-border/30 bg-card/40 backdrop-blur-md p-4">
            <h3 className="text-[13px] font-semibold text-foreground mb-3 lowercase">
              IB break type statistics
            </h3>
            <p className="text-[11px] text-muted-foreground mb-3">
              how often does price single break, double break, or stay inside the IB range?
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 rounded-lg bg-muted/30">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">single break</p>
                <p className="text-lg font-semibold text-foreground">{bs.singleBreakPct.toFixed(0)}%</p>
                <p className="text-[10px] text-muted-foreground">{bs.singleBreak} days</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/30">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">double break</p>
                <p className="text-lg font-semibold text-foreground">{bs.doubleBreakPct.toFixed(0)}%</p>
                <p className="text-[10px] text-muted-foreground">{bs.doubleBreak} days</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/30">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">no break</p>
                <p className="text-lg font-semibold text-foreground">{bs.noBreakPct.toFixed(0)}%</p>
                <p className="text-[10px] text-muted-foreground">{bs.noBreak} days</p>
              </div>
            </div>
          </div>

          <AITradingInsight
            mode="ib"
            symbol={symbol}
            analysisData={{
              totalDays: result.totalDays,
              insideDays: result.insideDays,
              ibWindowMinutes: result.ibWindowMinutes,
              highFirst: { total: hf.total, breakHigh: hf.breakHigh, breakLow: hf.breakLow, inside: hf.inside },
              lowFirst: { total: lf.total, breakHigh: lf.breakHigh, breakLow: lf.breakLow, inside: lf.inside },
              breakTypeStats: { singleBreak: bs.singleBreak, doubleBreak: bs.doubleBreak, noBreak: bs.noBreak, singleBreakPct: bs.singleBreakPct, doubleBreakPct: bs.doubleBreakPct, noBreakPct: bs.noBreakPct },
              lastDay: result.lastDay ? { date: result.lastDay.date, ibHigh: result.lastDay.ibHigh, ibLow: result.lastDay.ibLow, highFirstFormed: result.lastDay.highFirstFormed, breakout: result.lastDay.breakout, breakType: result.lastDay.breakType } : null,
            }}
          />
        </div>
      );
    }

    if (activeMode === "momentum" && momentumResult) {
      const bodyPct = `${Math.round(momentumResult.bodyRatioThreshold * 100)}%`;
      const TFS: { tf: import("@/components/ParameterPanel").OCCTimeframe; label: string }[] = [
        { tf: "M5", label: "5min opening candle" },
        { tf: "M15", label: "15min opening candle" },
        { tf: "M30", label: "30min opening candle" },
        { tf: "H1", label: "60min opening candle" },
      ];
      return (
        <div className="space-y-4">
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-[12px] text-foreground/80 leading-relaxed">
            <strong className="text-foreground">momentum candle continuation (mcc)</strong> — measures the probability that the session closes in the same direction as the ny opening candle, only when that candle shows valid momentum (body ≥ {bodyPct} of total range). days without momentum on the opening candle are treated as neutral / no-signal.
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {TFS.map(({ tf, label }) => {
              const stats = momentumResult.tfStats[tf];
              if (!stats) return null;
              const bullTotal = stats.bullishSignals;
              const bearTotal = stats.bearishSignals;
              const bullContPct = bullTotal > 0 ? (stats.bullishContinued / bullTotal) * 100 : 0;
              const bullRevPct = bullTotal > 0 ? (stats.bullishReversed / bullTotal) * 100 : 0;
              const bearContPct = bearTotal > 0 ? (stats.bearishContinued / bearTotal) * 100 : 0;
              const bearRevPct = bearTotal > 0 ? (stats.bearishReversed / bearTotal) * 100 : 0;
              return (
                <ContinuationStackCard
                  key={tf}
                  title={label}
                  subtitle={`${symbol} · mcc · body ≥ ${bodyPct} · ${formatDateRange(analysisMaxDays)}`}
                  columns={[
                    {
                      label: "bullish opening",
                      bottomPct: bullContPct,
                      topPct: bullRevPct,
                      bottomLabel: "continued",
                      topLabel: "reversed",
                      total: bullTotal,
                    },
                    {
                      label: "bearish opening",
                      bottomPct: bearContPct,
                      topPct: bearRevPct,
                      bottomLabel: "continued",
                      topLabel: "reversed",
                      total: bearTotal,
                    },
                  ]}
                  legend={[
                    { label: "% continued", colorClass: "bg-chart-bar-a" },
                    { label: "% reversed", colorClass: "bg-chart-bar-b" },
                  ]}
                />
              );
            })}
          </div>
          <AITradingInsight
            mode="momentum"
            symbol={symbol}
            analysisData={{
              method: "Momentum Candle Continuation (MCC)",
              totalDays: momentumResult.totalDays,
              bodyRatioThreshold: momentumResult.bodyRatioThreshold,
              tfStats: momentumResult.tfStats,
              lastDay: momentumResult.lastDay ? {
                date: momentumResult.lastDay.date,
                timeframes: momentumResult.lastDay.timeframes.map(t => ({
                  tf: t.tf, direction: t.direction, hasMomentum: t.hasMomentum, continued: t.continued,
                })),
              } : null,
            }}
          />
        </div>
      );
    }

    if (activeMode === "occ" && occRawBars) {
      const SIZES: { size: import("@/lib/occ-analysis").OCCCandleSize; label: string }[] = [
        { size: "5m", label: "5min opening candle" },
        { size: "15m", label: "15min opening candle" },
        { size: "30m", label: "30min opening candle" },
        { size: "1h", label: "60min opening candle" },
      ];
      const results = SIZES.map(({ size, label }) => ({
        size, label, res: analyzeOCC(occRawBars, occMaxDays, size, occWeekdays),
      }));
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {results.map(({ size, label, res }) => (
              <ContinuationStackCard
                key={size}
                title={label}
                subtitle={`${symbol} · 9:30am – 4:00pm · ${formatDateRange(analysisMaxDays)}`}
                columns={[
                  {
                    label: "green candle",
                    bottomPct: res.greenCandle.greenDayPct,
                    topPct: res.greenCandle.redDayPct,
                    bottomLabel: "green day",
                    topLabel: "red day",
                    total: res.greenCandle.total,
                  },
                  {
                    label: "red candle",
                    bottomPct: res.redCandle.greenDayPct,
                    topPct: res.redCandle.redDayPct,
                    bottomLabel: "green day",
                    topLabel: "red day",
                    total: res.redCandle.total,
                  },
                ]}
                legend={[
                  { label: "% green day", colorClass: "bg-chart-bar-a" },
                  { label: "% red day", colorClass: "bg-chart-bar-b" },
                ]}
              />
            ))}
          </div>
          {occResult && (
            <AITradingInsight
              mode="occ"
              symbol={symbol}
              analysisData={{
                totalDays: occResult.totalDays,
                allTimeframes: results.map(r => ({
                  candleSize: r.size,
                  greenCandle: r.res.greenCandle,
                  redCandle: r.res.redCandle,
                })),
              }}
            />
          )}
        </div>
      );
    }

    if (activeMode === "gapfill" && gapFillResult) {
      return (
        <GapFillDashboard
          result={gapFillResult}
          symbol={symbol}
          dateRange={formatDateRange(analysisMaxDays)}
          weekdays={formatWeekdays(analysisWeekdays)}
        />
      );
    }

    if (activeMode === "insidebar" && insideBarResult) {
      return (
        <div className="space-y-4">
          <InsideBarReport result={insideBarResult} symbol={symbol} />
          <AITradingInsight
            mode="insidebar"
            symbol={symbol}
            analysisData={{
              totalDays: insideBarResult.totalDays,
              insideBarDays: insideBarResult.insideBarDays,
              insideBarPct: insideBarResult.insideBarPct,
              breakoutPct: insideBarResult.breakoutPct,
              brokeHighPct: insideBarResult.brokeHighPct,
              brokeLowPct: insideBarResult.brokeLowPct,
              stayedInsidePct: insideBarResult.stayedPct,
            }}
          />
        </div>
      );
    }

    if (activeMode === "outsideday" && outsideDayResult) {
      return (
        <div className="space-y-4">
          <OutsideDayReport
            result={outsideDayResult}
            symbol={symbol}
            dateRange={formatDateRange(analysisMaxDays)}
            weekdays={formatWeekdays(analysisWeekdays)}
          />
          <AITradingInsight
            mode="outsideday"
            symbol={symbol}
            analysisData={{
              type: "outsideday",
              totalDays: outsideDayResult.totalDays,
              outsideDays: outsideDayResult.outsideDays,
              outsidePct: outsideDayResult.outsidePct,
              bullish: outsideDayResult.bullish,
              bearish: outsideDayResult.bearish,
            }}
          />
        </div>
      );
    }

    if (activeMode === "globex-ib" && globexIBResult) {
      return (
        <div className="space-y-4">
          <GlobexIBDashboard
            result={globexIBResult}
            symbol={symbol}
            dateRange={formatDateRange(analysisMaxDays)}
            weekdays={formatWeekdays(analysisWeekdays)}
          />
          <AITradingInsight
            mode="ib"
            symbol={symbol}
            analysisData={{
              totalDays: globexIBResult.totalDays,
              insideDays: 0,
              ibWindowMinutes: globexIBResult.ibWindowMinutes,
              highFirst: globexIBResult.highFirst,
              lowFirst: globexIBResult.lowFirst,
              lastDay: globexIBResult.lastDay ? {
                date: globexIBResult.lastDay.date,
                ibHigh: globexIBResult.lastDay.globexIBHigh,
                ibLow: globexIBResult.lastDay.globexIBLow,
                highFirstFormed: globexIBResult.lastDay.highFirstFormed,
                breakout: globexIBResult.lastDay.rthBreakout,
              } : null,
            }}
          />
        </div>
      );
    }

    if (activeMode === "london-ib" && londonIBResult) {
      return (
        <LondonIBDashboard
          result={londonIBResult}
          symbol={symbol}
          dateRange={formatDateRange(analysisMaxDays)}
          weekdays={formatWeekdays(analysisWeekdays)}
        />
      );
    }

    return null;
  };

  return (
    <div className="h-screen w-full flex flex-col lg:flex-row overflow-hidden bg-background">

      {/* Mobile Header */}
      {isMobile && (
        <MobileHeader
          onMenuToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          title="reports"
          actions={
            <>
              <button
                onClick={() => setShowParams(!showParams)}
                className={`p-1.5 rounded-lg transition-colors ${showParams ? "bg-primary text-primary-foreground" : "hover:bg-accent text-muted-foreground"}`}
              >
                <SlidersHorizontal className="h-4 w-4" />
              </button>
            </>
          }
        />
      )}

      {/* Column 1: Nav Sidebar — hidden on mobile, shown via drawer */}
      {!isMobile && (
        <AppNavSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      )}
      {isMobile && (
        <AppNavSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      )}

      {/* Column 2: Parameter Panel — sheet on mobile */}
      {isMobile ? (
        showParams && (
          <>
            <div className="fixed inset-0 z-30 bg-black/50" onClick={() => setShowParams(false)} />
            <div className="fixed inset-y-0 left-0 z-40 w-[280px] bg-surface border-r border-border shadow-2xl animate-in slide-in-from-left duration-200 overflow-y-auto">
              <ParameterPanel
                onRun={handleRun}
                loading={loading}
                isFree={isFree}
                occTimeframe={momentumTimeframe}
                onOccTimeframeChange={setMomentumTimeframe}
                templates={templates}
                onSaveTemplate={saveTemplate}
                onDeleteTemplate={deleteTemplate}
                templateLoading={templateLoading}
              />
            </div>
          </>
        )
      ) : (
        <ParameterPanel
          onRun={handleRun}
          loading={loading}
          isFree={isFree}
          occTimeframe={momentumTimeframe}
          onOccTimeframeChange={setMomentumTimeframe}
          templates={templates}
          onSaveTemplate={saveTemplate}
          onDeleteTemplate={deleteTemplate}
          templateLoading={templateLoading}
        />
      )}

      {/* Column 3: Main Content */}
      <main className="flex-1 min-w-0 overflow-y-auto p-4 lg:p-6">
        {hasResults && (
          <div className="flex items-center gap-3 mb-5 flex-wrap">
            <h2 className="text-[14px] lg:text-[15px] text-foreground font-medium lowercase">{reportTitle}</h2>
            <button className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-3 py-1 text-[12px] font-medium">
              <Bookmark className="h-3.5 w-3.5" />
              bookmarked
            </button>
          </div>
        )}

        {!hasResults && !loading && (
          <div className="flex items-center justify-center h-full">
            <div className="border border-dashed border-border rounded-xl p-8 lg:p-12 text-center max-w-md">
              <img src={logo} className="h-14 w-14 rounded-full object-cover mx-auto mb-4 opacity-40" alt="" />
              <p className="text-[13px] text-muted-foreground">select a report type and ticker to begin analysis</p>
              <p className="text-[11px] text-muted-foreground mt-1">powered by TwelveData API · 5000 bars intraday</p>
              {isMobile && (
                <button
                  onClick={() => setShowParams(true)}
                  className="mt-4 flex items-center gap-2 mx-auto bg-primary text-primary-foreground rounded-lg px-4 py-2 text-[12px] font-medium"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  open parameters
                </button>
              )}
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-3">
              <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto" />
              <p className="text-[13px] text-muted-foreground">fetching & analyzing {symbol.toLowerCase()} data…</p>
            </div>
          </div>
        )}

        {hasResults && !loading && renderCharts()}
      </main>

      {/* Column 4: Right Sidebar — hidden on mobile */}
      {!isMobile && (
        <RightSidebar templates={templates} activeMode={activeMode} />
      )}
    </div>
  );
};

export default Index;
