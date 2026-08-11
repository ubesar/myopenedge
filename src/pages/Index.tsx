import { useState, useMemo } from "react";
import AITradingInsight from "@/components/AITradingInsight";
import ContinuationStackCard from "@/components/ContinuationStackCard";
import MomentumResultCard from "@/components/MomentumResultCard";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Navigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Bookmark, Loader2, SlidersHorizontal, PanelRightOpen, BarChart3 } from "lucide-react";
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
import { analyzePullback50, type Pullback50Result } from "@/lib/pullback50-analysis";
import { analyzeIB2575, type IB2575Result } from "@/lib/ib2575-analysis";
import { analyzeMCM152am, type MCM152amResult } from "@/lib/mcm15-2am-analysis";
import { runOrbM15Backtest, type OrbResult } from "@/lib/orb-backtest";
import TradeChartDialog, { type TradeForChart } from "@/components/TradeChartDialog";

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
  const [pullback50Result, setPullback50Result] = useState<Pullback50Result | null>(null);
  const [ib2575Result, setIb2575Result] = useState<IB2575Result | null>(null);
  const [mcm152amResult, setMcm152amResult] = useState<MCM152amResult | null>(null);
  const [occRawBars, setOccRawBars] = useState<any[] | null>(null);
  const [ib2575RawBars, setIb2575RawBars] = useState<any[] | null>(null);
  const [ibChartTrade, setIbChartTrade] = useState<TradeForChart | null>(null);
  const [orbResult, setOrbResult] = useState<OrbResult | null>(null);
  const [orbRawBars, setOrbRawBars] = useState<any[] | null>(null);
  const [orbChartTrade, setOrbChartTrade] = useState<TradeForChart | null>(null);

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

  const handleRun = async (ticker: string, ibWindow: number, maxDays: number, mode: AnalysisMode, bodyRatio: MomentumBodyRatio = "0.50", occBodyRatio: OCCBodyRatio = "0.50", weekdays: number[] = [1,2,3,4,5], momentumSessionEnd: number = 13 * 60, sessionStart: number = 9 * 60 + 30) => {
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
    setResult(null); setMomentumResult(null); setOccResult(null); setGapFillResult(null); setInsideBarResult(null); setOutsideDayResult(null); setGlobexIBResult(null); setLondonIBResult(null); setPullback50Result(null); setIb2575Result(null); setOrbResult(null); setMcm152amResult(null);
    setSymbol(ticker); setActiveMode(effectiveMode); setAnalysisMaxDays(effectiveMaxDays); setAnalysisWeekdays(weekdays);
    // Close mobile param panel after run
    if (isMobile) setShowParams(false);
    try {
      const pb50PreMarket = effectiveMode === "pullback50" && sessionStart < 9 * 60 + 30;
      if (effectiveMode === "globex-ib" || effectiveMode === "london-ib" || effectiveMode === "mcm15-2am" || pb50PreMarket) {
        // All three use Massive API via massive-bars edge function
        // Split into 90-day client-side batches to avoid CPU timeout
        const MASSIVE_BATCH_DAYS = 90;
        const MASSIVE_BATCH_DELAY = 2000;
        const now = new Date();
        const calendarDaysNeeded = Math.ceil(effectiveMaxDays * 1.5) + 7;
        const globalFrom = new Date(now);
        globalFrom.setDate(globalFrom.getDate() - calendarDaysNeeded);

        const label = effectiveMode === "london-ib" ? "London" : effectiveMode === "mcm15-2am" ? "04:00 NY" : pb50PreMarket ? "pre-market" : "Globex";
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
        } else if (effectiveMode === "london-ib") {
          const a = analyzeLondonIB(deduped, effectiveIbWindow, effectiveMaxDays, weekdays);
          if (a.totalDays === 0) { toast.error("Not enough London session data."); return; }
          setLondonIBResult(a);
          addRun(effectiveMode, ticker, { totalDays: a.totalDays, ibWindow: effectiveIbWindow, highFirst: a.highFirst, lowFirst: a.lowFirst });
        } else if (pb50PreMarket) {
          const a = analyzePullback50(deduped as any, effectiveMaxDays, weekdays, momentumSessionEnd, sessionStart);
          if (a.totalDays === 0) { toast.error("Not enough pre-market data."); return; }
          setPullback50Result(a);
          addRun(effectiveMode, ticker, { totalTrades: a.totalTrades, sessionEndMinutes: a.sessionEndMinutes, winRate: a.stats.winRate });
        } else {
          // mcm15-2am
          const a = analyzeMCM152am(deduped as any, effectiveMaxDays, weekdays);
          if (a.totalDays === 0) { toast.error("Not enough pre-market data around 04:00 NY."); return; }
          setMcm152amResult(a);
          addRun(effectiveMode, ticker, { totalTrades: a.totalTrades, tp1WinRate: a.tp1Stats.winRate, tp2WinRate: a.tp2Stats.winRate });
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
          const a = analyzeMomentum(values as any, effectiveIbWindow, effectiveMaxDays, parseFloat(bodyRatio), weekdays, momentumSessionEnd);
          if (a.totalDays === 0) { toast.error("Not enough data."); return; }
          setMomentumResult(a);
          addRun(effectiveMode, ticker, { totalTrades: a.totalTrades, sessionEndMinutes: a.sessionEndMinutes, fullSlWinRate: a.fullSl.tp50.winRate, halfSlWinRate: a.halfSl.tp50.winRate });
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
        } else if (effectiveMode === "pullback50") {
          const a = analyzePullback50(values as any, effectiveMaxDays, weekdays, momentumSessionEnd, sessionStart);
          if (a.totalDays === 0) { toast.error("Not enough data."); return; }
          setPullback50Result(a);
          addRun(effectiveMode, ticker, { totalTrades: a.totalTrades, sessionEndMinutes: a.sessionEndMinutes, winRate: a.stats.winRate });
        } else if (effectiveMode === "ib2575") {
          const a = analyzeIB2575(values as any, effectiveIbWindow, effectiveMaxDays, weekdays);
          if (a.totalDays === 0) { toast.error("Not enough data."); return; }
          setIb2575RawBars(values as any);
          setIb2575Result(a);

          addRun(effectiveMode, ticker, { totalTrades: a.totalTrades, ibWindow: effectiveIbWindow, winRate: a.stats.winRate, triggeredTrades: a.triggeredTrades });
        } else if (effectiveMode === "orbm15") {
          const a = runOrbM15Backtest(ticker, values as any, { riskUsd: 100, side: "both", maxDays: effectiveMaxDays, momentumMode: "sma" });
          if (a.totalDays === 0) { toast.error("Not enough data."); return; }
          setOrbRawBars(values as any);
          setOrbResult(a);
          addRun(effectiveMode, ticker, { totalDays: a.totalDays, triggeredDays: a.triggeredDays, winRate: a.winRate, netPnl: a.netPnl });
        }
      }

    } catch (err: any) {
      toast.error(err.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const hasResults = result || momentumResult || occResult || gapFillResult || insideBarResult || outsideDayResult || globexIBResult || londonIBResult || pullback50Result || ib2575Result || orbResult || mcm152amResult;

  const reportTitle = hasResults
    ? `${symbol.toLowerCase()} ${activeMode === "ib" ? "initial balance breakout by rejection report" : activeMode === "globex-ib" ? "globex IB overnight breakout report" : activeMode === "london-ib" ? "london IB session breakout report" : activeMode === "momentum" ? "momentum candle continuation report" : activeMode === "pullback50" ? "50% pullback strategy report" : activeMode === "ib2575" ? "IB momentum limit report" : activeMode === "orbm15" ? "orb m15 pullback report" : activeMode === "mcm15-2am" ? "m15 momentum @ 04:00 ny report" : activeMode === "occ" ? "opening candle continuation report" : activeMode === "insidebar" ? "inside bar probability report" : activeMode === "outsideday" ? "outside day volatility expansion report" : "gap fill statistics report"}`
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
      const sessionEndH = Math.floor(momentumResult.sessionEndMinutes / 60);
      const sessionEndM = momentumResult.sessionEndMinutes % 60;
      const sessionEndLabel = `${String(sessionEndH).padStart(2, "0")}:${String(sessionEndM).padStart(2, "0")}`;
      const bodyPct = `body > ${momentumResult.bodyThreshold}× avg body (sma15)`;
      const subtitle = `${symbol} · m15 · ${bodyPct} · 09:30 – ${sessionEndLabel} ny · ${formatDateRange(analysisMaxDays)}`;
      const full = momentumResult.fullSl.tp50;
      const half = momentumResult.halfSl.tp50;
      const signalPct = momentumResult.totalDays > 0 ? (momentumResult.daysWithSignal / momentumResult.totalDays) * 100 : 0;
      return (
        <div className="space-y-4">
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-[12px] text-foreground/80 leading-relaxed">
            <strong className="text-foreground">momentum candle analysis</strong> — scans m15 candles (09:30 – {sessionEndLabel} ny) with {bodyPct}, then walks forward to market close to measure tp 50% hit rate against two stop variants. anti-overlap: next trade only after prior gate (sl full + tp 100%) resolves.
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">total trades</p>
              <p className="text-[18px] font-semibold text-foreground">{momentumResult.totalTrades}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">days w/ signal</p>
              <p className="text-[18px] font-semibold text-foreground">{momentumResult.daysWithSignal}/{momentumResult.totalDays} <span className="text-[11px] text-muted-foreground">({signalPct.toFixed(0)}%)</span></p>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">win rate · sl full</p>
              <p className="text-[18px] font-semibold text-foreground">{full.winRate.toFixed(1)}%</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">win rate · sl half</p>
              <p className="text-[18px] font-semibold text-foreground">{half.winRate.toFixed(1)}%</p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <MomentumResultCard
              title="sl full (ujung candle) · tp 50%"
              subtitle={subtitle}
              stats={full}
            />
            <MomentumResultCard
              title="sl half (50% candle) · tp 50%"
              subtitle={subtitle}
              stats={half}
            />
          </div>

          <AITradingInsight
            mode="momentum"
            symbol={symbol}
            analysisData={{
              method: "Momentum Candle Analysis (PRD v3)",
              totalDays: momentumResult.totalDays,
              daysWithSignal: momentumResult.daysWithSignal,
              sessionEndMinutes: momentumResult.sessionEndMinutes,
              bodyThreshold: momentumResult.bodyThreshold,
              totalTrades: momentumResult.totalTrades,
              fullSl: momentumResult.fullSl,
              halfSl: momentumResult.halfSl,
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

    if (activeMode === "pullback50" && pullback50Result) {
      const sessionEndH = Math.floor(pullback50Result.sessionEndMinutes / 60);
      const sessionEndM = pullback50Result.sessionEndMinutes % 60;
      const sessionEndLabel = `${String(sessionEndH).padStart(2, "0")}:${String(sessionEndM).padStart(2, "0")}`;
      const bodyPct = `body > ${pullback50Result.bodyThreshold}× avg body (sma15)`;
      const sessionStartLabel = `${String(Math.floor(pullback50Result.sessionStartMinutes / 60)).padStart(2, "0")}:${String(pullback50Result.sessionStartMinutes % 60).padStart(2, "0")}`;
      const subtitle = `${symbol} · m15 · ${bodyPct} · ${sessionStartLabel} – ${sessionEndLabel} ny · ${formatDateRange(analysisMaxDays)}`;
      const s = pullback50Result.stats;
      const signalPct = pullback50Result.totalDays > 0 ? (pullback50Result.daysWithSignal / pullback50Result.totalDays) * 100 : 0;
      return (
        <div className="space-y-4">
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-[12px] text-foreground/80 leading-relaxed">
            <strong className="text-foreground">50% pullback strategy</strong> — scans m15 momentum candles ({sessionStartLabel} – {sessionEndLabel} ny, {bodyPct}). entry triggers when price retraces to 50% of candle 1. sl at far end of candle 1, tp at opposite end. walks forward to 16:00 close.
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">total signals</p>
              <p className="text-[18px] font-semibold text-foreground">{pullback50Result.totalTrades}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">days w/ signal</p>
              <p className="text-[18px] font-semibold text-foreground">{pullback50Result.daysWithSignal}/{pullback50Result.totalDays} <span className="text-[11px] text-muted-foreground">({signalPct.toFixed(0)}%)</span></p>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">win rate</p>
              <p className="text-[18px] font-semibold text-foreground">{s.winRate.toFixed(1)}%</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">wins / losses / open</p>
              <p className="text-[14px] font-semibold text-foreground">{s.wins} / {s.losses} / {s.open}</p>
            </div>
          </div>

          <MomentumResultCard
            title="50% pullback · sl ujung candle · tp opposite end"
            subtitle={subtitle}
            stats={s}
          />

          {pullback50Result.trades.length > 0 && (
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
                <p className="text-[12px] font-semibold text-foreground">trade history</p>
                <p className="text-[10px] text-muted-foreground">{pullback50Result.trades.length} signals</p>
              </div>
              <div className="max-h-[420px] overflow-auto">
                <table className="w-full text-[11px]">
                  <thead className="sticky top-0 bg-card border-b border-border">
                    <tr className="text-left text-muted-foreground">
                      <th className="px-3 py-2 font-medium">date</th>
                      <th className="px-3 py-2 font-medium">time</th>
                      <th className="px-3 py-2 font-medium">dir</th>
                      <th className="px-3 py-2 font-medium text-right">entry</th>
                      <th className="px-3 py-2 font-medium text-right">sl</th>
                      <th className="px-3 py-2 font-medium text-right">tp</th>
                      <th className="px-3 py-2 font-medium text-center">outcome</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...pullback50Result.trades].reverse().map((t, idx) => {
                      const isWin = t.outcome === "win";
                      const dirColor = t.direction === "bullish" ? "text-emerald-500" : "text-rose-500";
                      const outColor = isWin ? "text-emerald-500 bg-emerald-500/10" : "text-rose-500 bg-rose-500/10";
                      return (
                        <tr key={idx} className="border-b border-border/40 hover:bg-muted/30">
                          <td className="px-3 py-1.5 text-foreground/80">{t.date}</td>
                          <td className="px-3 py-1.5 text-foreground/80">{t.signalTime}</td>
                          <td className={`px-3 py-1.5 font-medium ${dirColor}`}>{t.direction === "bullish" ? "buy" : "sell"}</td>
                          <td className="px-3 py-1.5 text-right text-foreground/90 tabular-nums">{t.entry.toFixed(2)}</td>
                          <td className="px-3 py-1.5 text-right text-foreground/70 tabular-nums">{t.stop.toFixed(2)}</td>
                          <td className="px-3 py-1.5 text-right text-foreground/70 tabular-nums">{t.target.toFixed(2)}</td>
                          <td className="px-3 py-1.5 text-center">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${outColor}`}>{t.outcome}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <AITradingInsight
            mode="momentum"
            symbol={symbol}
            analysisData={{
              method: "50% Pullback Strategy",
              totalDays: pullback50Result.totalDays,
              daysWithSignal: pullback50Result.daysWithSignal,
              sessionStartMinutes: pullback50Result.sessionStartMinutes,
              sessionEndMinutes: pullback50Result.sessionEndMinutes,
              bodyThreshold: pullback50Result.bodyThreshold,
              totalTrades: pullback50Result.totalTrades,
              stats: s,
            }}
          />
        </div>
      );
    }


    if (activeMode === "ib2575" && ib2575Result) {
      const s = ib2575Result.stats;
      const subtitle = `${symbol} · IB ${ib2575Result.ibWindowMinutes}min · momentum limit · ${formatDateRange(analysisMaxDays)}`;
      const signalPct = ib2575Result.totalDays > 0 ? (ib2575Result.daysWithSignal / ib2575Result.totalDays) * 100 : 0;
      return (
        <div className="space-y-4">
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-[12px] text-foreground/80 leading-relaxed">
            <strong className="text-foreground">IB momentum limit</strong> — after the {ib2575Result.ibWindowMinutes}min IB completes, detect which extreme printed first.
            IB low first → wait for an m5 momentum candle closing above IB75, then <span className="text-emerald-500 font-medium">buy limit @ IB75</span>, SL IB50, TP IB high (RR 1:1).
            IB high first → wait for an m5 momentum candle closing below IB25, then <span className="text-rose-500 font-medium">sell limit @ IB25</span>, SL IB50, TP IB low (RR 1:1).
            momentum scan until 13:00 ny, position managed until 16:00 ny close.
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">triggered</p>
              <p className="text-[18px] font-semibold text-foreground">{ib2575Result.triggeredTrades}<span className="text-[11px] text-muted-foreground">/{ib2575Result.totalDays} ({signalPct.toFixed(0)}%)</span></p>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">win rate</p>
              <p className="text-[18px] font-semibold text-foreground">{s.winRate.toFixed(1)}%</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">wins</p>
              <p className="text-[18px] font-semibold text-emerald-500">{s.wins}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">losses / open</p>
              <p className="text-[18px] font-semibold text-foreground"><span className="text-rose-500">{s.losses}</span> <span className="text-[11px] text-muted-foreground">/ {s.open}</span></p>
            </div>
          </div>

          <MomentumResultCard title="ib momentum limit" subtitle={subtitle} stats={s} />


          {ib2575Result.trades.length > 0 && (
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
                <p className="text-[12px] font-semibold text-foreground">trade history</p>
                <p className="text-[10px] text-muted-foreground">{ib2575Result.trades.length} setups</p>
              </div>
              <div className="max-h-[420px] overflow-auto">
                <table className="w-full text-[11px]">
                  <thead className="sticky top-0 bg-card border-b border-border">
                    <tr className="text-left text-muted-foreground">
                      <th className="px-3 py-2 font-medium">date</th>
                      <th className="px-3 py-2 font-medium">first</th>
                      <th className="px-3 py-2 font-medium">dir</th>
                      <th className="px-3 py-2 font-medium text-right">ib low</th>
                      <th className="px-3 py-2 font-medium text-right">ib25</th>
                      <th className="px-3 py-2 font-medium text-right">ib50</th>
                      <th className="px-3 py-2 font-medium text-right">ib75</th>
                      <th className="px-3 py-2 font-medium text-right">ib high</th>
                      <th className="px-3 py-2 font-medium text-right">confirm</th>
                      <th className="px-3 py-2 font-medium text-right">entry time</th>
                      <th className="px-3 py-2 font-medium text-right">entry</th>
                      <th className="px-3 py-2 font-medium text-right">sl</th>
                      <th className="px-3 py-2 font-medium text-right">tp</th>
                      <th className="px-3 py-2 font-medium text-center">outcome</th>
                      <th className="px-3 py-2 font-medium text-center">chart</th>

                    </tr>
                  </thead>
                  <tbody>
                    {[...ib2575Result.trades].reverse().map((t, idx) => {
                      const dirColor = t.direction === "bullish" ? "text-emerald-500" : "text-rose-500";
                      const outLabel = !t.triggered ? "no fill" : t.outcome;
                      const outCls = !t.triggered ? "text-muted-foreground bg-muted/40" : t.outcome === "win" ? "text-emerald-500 bg-emerald-500/10" : t.outcome === "loss" ? "text-rose-500 bg-rose-500/10" : "text-muted-foreground bg-muted/40";
                      return (
                        <tr key={idx} className="border-b border-border/40 hover:bg-muted/30">
                          <td className="px-3 py-1.5 text-foreground/80">{t.date}</td>
                          <td className="px-3 py-1.5 text-foreground/70 uppercase">{t.firstFormed}</td>
                          <td className={`px-3 py-1.5 font-medium ${dirColor}`}>{t.direction === "bullish" ? "long" : "short"}</td>
                          <td className="px-3 py-1.5 text-right text-foreground/60 tabular-nums">{t.ibLow.toFixed(2)}</td>
                          <td className="px-3 py-1.5 text-right text-foreground/70 tabular-nums">{t.ib25.toFixed(2)}</td>
                          <td className="px-3 py-1.5 text-right text-foreground/70 tabular-nums">{t.ib50.toFixed(2)}</td>
                          <td className="px-3 py-1.5 text-right text-foreground/70 tabular-nums">{t.ib75.toFixed(2)}</td>
                          <td className="px-3 py-1.5 text-right text-foreground/60 tabular-nums">{t.ibHigh.toFixed(2)}</td>
                          <td className="px-3 py-1.5 text-right text-foreground/60 tabular-nums">{t.confirmTime ?? "—"}</td>
                          <td className="px-3 py-1.5 text-right text-foreground/70 tabular-nums">{t.entryTime ?? "—"}</td>
                          <td className="px-3 py-1.5 text-right text-foreground/90 tabular-nums font-medium">{t.entry.toFixed(2)}</td>
                          <td className="px-3 py-1.5 text-right text-foreground/70 tabular-nums">{t.stop.toFixed(2)}</td>
                          <td className="px-3 py-1.5 text-right text-foreground/70 tabular-nums">{t.target.toFixed(2)}</td>
                          <td className="px-3 py-1.5 text-center">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${outCls}`}>{outLabel}</span>
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            <button
                              type="button"
                              title="view chart"
                              className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                              disabled={!t.triggered || !ib2575RawBars}
                              onClick={() => setIbChartTrade({
                                date: t.date,
                                time: t.entryTime ?? t.confirmTime ?? undefined,
                                direction: t.direction,
                                entry: t.entry,
                                stop: t.stop,
                                target: t.target,
                                outcome: t.outcome === "win" ? "win" : "loss",
                                ib: { high: t.ibHigh, low: t.ibLow, q25: t.ib25, q50: t.ib50, q75: t.ib75, windowMinutes: ib2575Result.ibWindowMinutes },
                              })}
                            >
                              <BarChart3 className="h-3.5 w-3.5 inline" />
                            </button>
                          </td>
                        </tr>

                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <AITradingInsight
            mode="momentum"
            symbol={symbol}
            analysisData={{
              method: `IB momentum limit (IB ${ib2575Result.ibWindowMinutes}min)`,
              totalDays: ib2575Result.totalDays,
              daysWithSignal: ib2575Result.daysWithSignal,
              triggeredTrades: ib2575Result.triggeredTrades,
              totalTrades: ib2575Result.totalTrades,
              stats: s,
            }}
          />
        </div>
      );
    }

    if (activeMode === "orbm15" && orbResult) {
      return (
        <div className="space-y-4">
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-[12px] text-foreground/80 leading-relaxed">
            <strong className="text-foreground">orb m15 pullback</strong> — c1 = candle m15 pertama sesi (09:30 ny). c2 harus pullback masuk range c1.
            entry breakout c1 high (long) / c1 low (short), sl trailing running low/high c2, tp 0.5× range c1.
            setup batal jika harga menembus midpoint c1 sebelum entry, sisanya ditutup di close sesi.
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {[
              { l: "days", v: String(orbResult.totalDays), c: "" },
              { l: "triggered", v: String(orbResult.triggeredDays), c: "" },
              { l: "cancelled", v: String(orbResult.cancelledDays), c: "" },
              { l: "no trigger", v: String(orbResult.noTriggerDays), c: "" },
              { l: "win rate", v: `${orbResult.winRate.toFixed(1)}%`, c: orbResult.winRate >= 50 ? "text-emerald-500" : "text-rose-500" },
              { l: "expectancy", v: `${orbResult.expectancyR.toFixed(2)}R`, c: orbResult.expectancyR >= 0 ? "text-emerald-500" : "text-rose-500" },
              { l: "profit factor", v: isFinite(orbResult.profitFactor) ? orbResult.profitFactor.toFixed(2) : "∞", c: "" },
              { l: "max dd", v: `-$${orbResult.maxDrawdown.toFixed(0)}`, c: "text-rose-500" },
              { l: "long / short", v: `${orbResult.longTrades} / ${orbResult.shortTrades}`, c: "" },
              { l: "net pnl", v: `$${orbResult.netPnl.toFixed(0)}`, c: orbResult.netPnl >= 0 ? "text-emerald-500" : "text-rose-500" },
            ].map((s) => (
              <div key={s.l} className="rounded-xl border border-border bg-card px-3 py-2">
                <p className="text-[10px] text-muted-foreground lowercase">{s.l}</p>
                <p className={`text-sm font-semibold ${s.c}`}>{s.v}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-border bg-card overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left py-2 px-2">date</th>
                  <th className="text-left py-2 px-2">time</th>
                  <th className="text-left py-2 px-2">side</th>
                  <th className="text-right py-2 px-2">entry</th>
                  <th className="text-right py-2 px-2">sl</th>
                  <th className="text-right py-2 px-2">tp</th>
                  <th className="text-right py-2 px-2">r</th>
                  <th className="text-right py-2 px-2">pnl</th>
                  <th className="text-left py-2 px-2">exit</th>
                  <th className="text-center py-2 px-2">chart</th>
                </tr>
              </thead>
              <tbody>
                {[...orbResult.triggered].reverse().map((t, i) => (
                  <tr key={`${t.date}-${i}`} className="border-b border-border/40">
                    <td className="py-1.5 px-2">{t.date}</td>
                    <td className="py-1.5 px-2">{t.entryTime}</td>
                    <td className={`py-1.5 px-2 uppercase text-[10px] ${t.direction === "long" ? "text-emerald-500" : "text-rose-500"}`}>
                      {t.direction}
                    </td>
                    <td className="py-1.5 px-2 text-right">{t.entryPrice?.toFixed(2)}</td>
                    <td className="py-1.5 px-2 text-right">{t.stopLoss.toFixed(2)}</td>
                    <td className="py-1.5 px-2 text-right">{t.target.toFixed(2)}</td>
                    <td className="py-1.5 px-2 text-right">{t.rMultiple.toFixed(2)}</td>
                    <td className={`py-1.5 px-2 text-right font-medium ${t.pnlUsd >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                      {t.pnlUsd >= 0 ? "+" : ""}${t.pnlUsd.toFixed(0)}
                    </td>
                    <td className="py-1.5 px-2 lowercase">{t.outcome}</td>
                    <td className="py-1.5 px-2 text-center">
                      <button
                        className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-muted"
                        onClick={() =>
                          setOrbChartTrade({
                            date: t.date,
                            time: t.entryTime ?? undefined,
                            direction: t.direction === "long" ? "bullish" : "bearish",
                            entry: t.entryPrice ?? 0,
                            stop: t.stopLoss,
                            target: t.target,
                            outcome: t.pnlUsd >= 0 ? "win" : "loss",
                            midpoint: t.midpoint,
                            exitTime: t.exitTime ?? undefined,
                            exitPrice: t.exitPrice ?? undefined,
                          })
                        }
                        title="view chart"
                      >
                        <BarChart3 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      );
    }



    if (activeMode === "mcm15-2am" && mcm152amResult) {
      const bodyPct = `body > ${mcm152amResult.bodyThreshold}× avg body (sma15)`;
      const subtitle = `${symbol} · m15 @ 04:00 ny (fallback 04:15) · ${bodyPct} · ${formatDateRange(analysisMaxDays)}`;
      const tp1 = mcm152amResult.tp1Stats;
      const tp2 = mcm152amResult.tp2Stats;
      const signalPct = mcm152amResult.totalDays > 0 ? (mcm152amResult.daysWithSignal / mcm152amResult.totalDays) * 100 : 0;
      const trigPct = mcm152amResult.totalTrades > 0 ? (mcm152amResult.triggeredTrades / mcm152amResult.totalTrades) * 100 : 0;
      return (
        <div className="space-y-4">
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-[12px] text-foreground/80 leading-relaxed">
            <strong className="text-foreground">m15 momentum @ 04:00 ny</strong> — scans the m15 candle at 04:00 ny ({bodyPct}). if not a momentum candle, fallback to 04:15. otherwise skip the day.
            bullish → <span className="text-emerald-500 font-medium">buy stop @ high</span>, sl @ low. bearish → <span className="text-rose-500 font-medium">sell stop @ low</span>, sl @ high.
            tp1 rr 1:0.5 &amp; tp2 rr 1:1 tracked independently until 16:00 ny close.
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">setups</p>
              <p className="text-[18px] font-semibold text-foreground">{mcm152amResult.totalTrades}<span className="text-[11px] text-muted-foreground">/{mcm152amResult.totalDays} ({signalPct.toFixed(0)}%)</span></p>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">scan 04:00 / 04:15</p>
              <p className="text-[18px] font-semibold text-foreground">{mcm152amResult.scan0200} <span className="text-[11px] text-muted-foreground">/ {mcm152amResult.scan0215}</span></p>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">triggered</p>
              <p className="text-[18px] font-semibold text-foreground">{mcm152amResult.triggeredTrades} <span className="text-[11px] text-muted-foreground">({trigPct.toFixed(0)}%)</span></p>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">tp1 / tp2 win</p>
              <p className="text-[18px] font-semibold text-foreground">{tp1.winRate.toFixed(1)}% <span className="text-[11px] text-muted-foreground">/ {tp2.winRate.toFixed(1)}%</span></p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <MomentumResultCard title="tp1 · rr 1:0.5" subtitle={subtitle} stats={tp1} />
            <MomentumResultCard title="tp2 · rr 1:1" subtitle={subtitle} stats={tp2} />
          </div>

          {mcm152amResult.trades.length > 0 && (
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
                <p className="text-[12px] font-semibold text-foreground">trade history</p>
                <p className="text-[10px] text-muted-foreground">{mcm152amResult.trades.length} setups</p>
              </div>
              <div className="max-h-[420px] overflow-auto">
                <table className="w-full text-[11px]">
                  <thead className="sticky top-0 bg-card border-b border-border">
                    <tr className="text-left text-muted-foreground">
                      <th className="px-3 py-2 font-medium">date</th>
                      <th className="px-3 py-2 font-medium">scan</th>
                      <th className="px-3 py-2 font-medium">dir</th>
                      <th className="px-3 py-2 font-medium text-right">entry</th>
                      <th className="px-3 py-2 font-medium text-right">sl</th>
                      <th className="px-3 py-2 font-medium text-right">tp1</th>
                      <th className="px-3 py-2 font-medium text-right">tp2</th>
                      <th className="px-3 py-2 font-medium text-center">trig</th>
                      <th className="px-3 py-2 font-medium text-center">tp1</th>
                      <th className="px-3 py-2 font-medium text-center">tp2</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...mcm152amResult.trades].reverse().map((t, idx) => {
                      const dirColor = t.direction === "bullish" ? "text-emerald-500" : "text-rose-500";
                      const badge = (o: string) => o === "win" ? "text-emerald-500 bg-emerald-500/10" : o === "loss" ? "text-rose-500 bg-rose-500/10" : "text-muted-foreground bg-muted/40";
                      return (
                        <tr key={idx} className="border-b border-border/40 hover:bg-muted/30">
                          <td className="px-3 py-1.5 text-foreground/80">{t.date}</td>
                          <td className="px-3 py-1.5 text-foreground/70 tabular-nums">{t.scanTime}</td>
                          <td className={`px-3 py-1.5 font-medium ${dirColor}`}>{t.direction === "bullish" ? "buy" : "sell"}</td>
                          <td className="px-3 py-1.5 text-right text-foreground/90 tabular-nums">{t.entry.toFixed(2)}</td>
                          <td className="px-3 py-1.5 text-right text-foreground/70 tabular-nums">{t.stop.toFixed(2)}</td>
                          <td className="px-3 py-1.5 text-right text-foreground/70 tabular-nums">{t.tp1.toFixed(2)}</td>
                          <td className="px-3 py-1.5 text-right text-foreground/70 tabular-nums">{t.tp2.toFixed(2)}</td>
                          <td className="px-3 py-1.5 text-center">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${t.triggered ? "text-emerald-500 bg-emerald-500/10" : "text-muted-foreground bg-muted/40"}`}>{t.triggered ? "yes" : "no"}</span>
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${badge(t.outcomeTp1)}`}>{t.outcomeTp1}</span>
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${badge(t.outcomeTp2)}`}>{t.outcomeTp2}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <AITradingInsight
            mode="momentum"
            symbol={symbol}
            analysisData={{
              method: "M15 Momentum @ 04:00 NY (fallback 04:15)",
              totalDays: mcm152amResult.totalDays,
              daysWithSignal: mcm152amResult.daysWithSignal,
              triggeredTrades: mcm152amResult.triggeredTrades,
              scan0200: mcm152amResult.scan0200,
              scan0215: mcm152amResult.scan0215,
              tp1Stats: tp1,
              tp2Stats: tp2,
            }}
          />
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

      <TradeChartDialog
        open={!!ibChartTrade}
        onOpenChange={(v) => !v && setIbChartTrade(null)}
        trade={ibChartTrade}
        bars={ib2575RawBars ?? []}
        symbol={symbol}
        sessionStartMin={9 * 60 + 30}
        sessionEndMin={16 * 60}
        tfMinutes={5}
      />

      <TradeChartDialog
        open={!!orbChartTrade}
        onOpenChange={(v) => !v && setOrbChartTrade(null)}
        trade={orbChartTrade}
        bars={orbRawBars ?? []}
        symbol={symbol}
        sessionStartMin={9 * 60 + 30}
        sessionEndMin={16 * 60}
        tfMinutes={15}
      />



    </div>
  );
};

export default Index;
