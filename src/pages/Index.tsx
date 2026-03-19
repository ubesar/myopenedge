import { useState, useMemo } from "react";
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
import InsideBarReport from "@/components/InsideBarReport";
import OutsideDayReport from "@/components/OutsideDayReport";
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
  const [symbol, setSymbol] = useState("");
  const [activeMode, setActiveMode] = useState<AnalysisMode>("ib");
  const [selectedRunId, setSelectedRunId] = useState<string | undefined>();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [occTimeframe, setOccTimeframe] = useState<OCCTimeframe>("M15");
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
      effectiveMode = "ib";
    }

    setLoading(true);
    setResult(null); setMomentumResult(null); setOccResult(null); setGapFillResult(null); setInsideBarResult(null); setOutsideDayResult(null);
    setSymbol(ticker); setActiveMode(effectiveMode); setAnalysisMaxDays(effectiveMaxDays); setAnalysisWeekdays(weekdays);
    // Close mobile param panel after run
    if (isMobile) setShowParams(false);
    try {
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
        const a = analyzeOCC(values as any, effectiveMaxDays, parseFloat(occBodyRatio), weekdays);
        if (a.totalDays === 0) { toast.error("Not enough data."); return; }
        setOccResult(a);
        addRun(effectiveMode, ticker, { totalDays: a.totalDays, tfDirectionStats: a.tfDirectionStats });
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
        addRun(effectiveMode, ticker, { totalDays: a.totalDays, outsidePct: a.outsidePct, bullishContinuationPct: a.bullishContinuationPct, bearishContinuationPct: a.bearishContinuationPct });
      }

    } catch (err: any) {
      toast.error(err.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const hasResults = result || momentumResult || occResult || gapFillResult || insideBarResult || outsideDayResult;

  const reportTitle = hasResults
    ? `${symbol.toLowerCase()} ${activeMode === "ib" ? "initial balance breakout by rejection report" : activeMode === "momentum" ? "momentum candle continuation report" : activeMode === "occ" ? "opening candle continuation report" : activeMode === "insidebar" ? "inside bar probability report" : activeMode === "outsideday" ? "outside day volatility expansion report" : "gap fill statistics report"}`
    : "";

  const renderCharts = () => {
    if (activeMode === "ib" && result) {
      const hf = result.highFirst;
      const lf = result.lowFirst;
      return (
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
              { label: "first break IB high", color: "hsl(217,91%,60%)" },
              { label: "first break IB low", color: "hsl(240,5%,30%)" },
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
              { label: "first break IB high", color: "hsl(217,91%,60%)" },
              { label: "first break IB low", color: "hsl(240,5%,30%)" },
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
      );
    }

    if (activeMode === "momentum" && momentumResult) {
      const tf = momentumTimeframe;
      const stats = momentumResult.tfStats[tf];
      if (!stats) return null;
      const hf = stats.highFirst;
      const lf = stats.lowFirst;
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground font-medium mr-1">TF:</span>
            {(["M5", "M15", "M30", "H1"] as OCCTimeframe[]).map((t) => (
              <button
                key={t}
                onClick={() => setMomentumTimeframe(t)}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                  momentumTimeframe === t
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <ChartCard
              title="high formed first"
              subtitle={`${symbol} · momentum · ${tf}`}
              totalDays={hf.total}
              bars={[
                { name: "bullish", value: hf.total > 0 ? (hf.bullish / hf.total * 100) : 0, color: "primary" },
                { name: "bearish", value: hf.total > 0 ? (hf.bearish / hf.total * 100) : 0, color: "muted" },
              ]}
              legendItems={[
                { label: "bullish", color: "hsl(217,91%,60%)" },
                { label: "bearish", color: "hsl(240,5%,30%)" },
              ]}
              settingsGrid={[
                { label: "candle timeframe", value: tf },
                { label: "session", value: "NY open" },
                { label: "date range", value: formatDateRange(analysisMaxDays) },
                { label: "weekdays to use", value: formatWeekdays(analysisWeekdays) },
              ]}
            />
            <ChartCard
              title="low formed first"
              subtitle={`${symbol} · momentum · ${tf}`}
              totalDays={lf.total}
              bars={[
                { name: "bullish", value: lf.total > 0 ? (lf.bullish / lf.total * 100) : 0, color: "primary" },
                { name: "bearish", value: lf.total > 0 ? (lf.bearish / lf.total * 100) : 0, color: "muted" },
              ]}
              legendItems={[
                { label: "bullish", color: "hsl(217,91%,60%)" },
                { label: "bearish", color: "hsl(240,5%,30%)" },
              ]}
              settingsGrid={[
                { label: "candle timeframe", value: tf },
                { label: "session", value: "NY open" },
                { label: "date range", value: formatDateRange(analysisMaxDays) },
                { label: "weekdays to use", value: formatWeekdays(analysisWeekdays) },
              ]}
            />
          </div>
        </div>
      );
    }

    if (activeMode === "occ" && occResult) {
      const tf = occTimeframe;
      const stats = occResult.tfDirectionStats[tf];
      if (!stats) return null;
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground font-medium mr-1">TF:</span>
            {(["M5", "M15", "M30", "H1"] as OCCTimeframe[]).map((t) => (
              <button
                key={t}
                onClick={() => setOccTimeframe(t)}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                  occTimeframe === t
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <ChartCard
              title="candle bullish first"
              subtitle={`${symbol} · OCC · ${tf}`}
              totalDays={stats.bullishFirst.total}
              bars={[
                { name: "continuation", value: stats.bullishFirst.total > 0 ? (stats.bullishFirst.valid / stats.bullishFirst.total * 100) : 0, color: "primary" },
                { name: "reverting", value: stats.bullishFirst.total > 0 ? (stats.bullishFirst.invalid / stats.bullishFirst.total * 100) : 0, color: "muted" },
              ]}
              legendItems={[
                { label: "continuation", color: "hsl(217,91%,60%)" },
                { label: "reverting", color: "hsl(240,5%,30%)" },
              ]}
              settingsGrid={[
                { label: "candle timeframe", value: tf },
                { label: "date range", value: formatDateRange(analysisMaxDays) },
                { label: "weekdays to use", value: formatWeekdays(analysisWeekdays) },
              ]}
            />
            <ChartCard
              title="candle bearish first"
              subtitle={`${symbol} · OCC · ${tf}`}
              totalDays={stats.bearishFirst.total}
              bars={[
                { name: "continuation", value: stats.bearishFirst.total > 0 ? (stats.bearishFirst.valid / stats.bearishFirst.total * 100) : 0, color: "primary" },
                { name: "reverting", value: stats.bearishFirst.total > 0 ? (stats.bearishFirst.invalid / stats.bearishFirst.total * 100) : 0, color: "muted" },
              ]}
              legendItems={[
                { label: "continuation", color: "hsl(217,91%,60%)" },
                { label: "reverting", color: "hsl(240,5%,30%)" },
              ]}
              settingsGrid={[
                { label: "candle timeframe", value: tf },
                { label: "date range", value: formatDateRange(analysisMaxDays) },
                { label: "weekdays to use", value: formatWeekdays(analysisWeekdays) },
              ]}
            />
          </div>
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
      return <InsideBarReport result={insideBarResult} symbol={symbol} />;
    }

    if (activeMode === "outsideday" && outsideDayResult) {
      return <OutsideDayReport result={outsideDayResult} symbol={symbol} />;
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
                occTimeframe={occTimeframe}
                onOccTimeframeChange={setOccTimeframe}
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
          occTimeframe={occTimeframe}
          onOccTimeframeChange={setOccTimeframe}
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
