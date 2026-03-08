import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Navigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Bookmark, Loader2 } from "lucide-react";
import logo from "@/assets/logo.png";
import { type AnalysisMode } from "@/components/ControlPanel";
import AppNavSidebar from "@/components/AppNavSidebar";
import ParameterPanel, { type OCCTimeframe, type MomentumBodyRatio, type OCCBodyRatio } from "@/components/ParameterPanel";
import RightSidebar from "@/components/RightSidebar";
import { useTemplates, type TemplateParams } from "@/hooks/useTemplates";
import ChartCard from "@/components/ChartCard";
import { useAnalysisHistory, type AnalysisRun } from "@/hooks/useAnalysisHistory";

import { analyzeIB, type AnalysisResult } from "@/lib/ib-analysis";
import { analyzeMomentum, type MomentumResult } from "@/lib/momentum-analysis";
import { analyzeOCC, type OCCResult } from "@/lib/occ-analysis";
import { analyzeGapFill, type GapFillResult } from "@/lib/gapfill-analysis";
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
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [momentumResult, setMomentumResult] = useState<MomentumResult | null>(null);
  const [occResult, setOccResult] = useState<OCCResult | null>(null);
  const [gapFillResult, setGapFillResult] = useState<GapFillResult | null>(null);
  const [insideBarResult, setInsideBarResult] = useState<InsideBarResult | null>(null);
  const [symbol, setSymbol] = useState("");
  const [activeMode, setActiveMode] = useState<AnalysisMode>("ib");
  const [selectedRunId, setSelectedRunId] = useState<string | undefined>();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [occTimeframe, setOccTimeframe] = useState<OCCTimeframe>("M15");
  const [momentumTimeframe, setMomentumTimeframe] = useState<OCCTimeframe>("M15");
  const { runs: historyRuns, addRun, deleteRun } = useAnalysisHistory();
  const { templates, saveTemplate, deleteTemplate, loading: templateLoading } = useTemplates();

  const isFree = !isActive;


  if (!authLoading && !user) return <Navigate to="/auth" replace />;

  const fetchMarketData = async (ticker: string) => {
    const { data, error } = await supabase.functions.invoke("twelvedata-proxy", { body: { symbol: ticker } });
    if (error) throw new Error("Failed to fetch market data");
    return data;
  };

  const handleRun = async (ticker: string, ibWindow: number, maxDays: number, mode: AnalysisMode, bodyRatio: MomentumBodyRatio = "0.50", occBodyRatio: OCCBodyRatio = "0.50") => {
    // Server-side enforcement: clamp free-tier parameters regardless of UI bypass
    let effectiveIbWindow = ibWindow;
    let effectiveMaxDays = maxDays;
    let effectiveMode = mode;

    if (isFree) {
      effectiveMaxDays = Math.min(maxDays, 7);
      effectiveIbWindow = Math.min(ibWindow, 60);
      effectiveMode = "ib"; // Force IB mode for free users
    }

    setLoading(true);
    setResult(null); setMomentumResult(null); setOccResult(null); setGapFillResult(null); setInsideBarResult(null);
    setSymbol(ticker); setActiveMode(effectiveMode);
    try {
      const json = await fetchMarketData(ticker);
      if (json.status === "error") { toast.error(json.message || "API error"); return; }
      const parsed = TwelveDataResponseSchema.safeParse(json);
      if (!parsed.success) { toast.error("Invalid or empty data returned."); return; }
      const values = parsed.data.values;

      if (effectiveMode === "ib") {
        const a = analyzeIB(values as any, effectiveIbWindow, effectiveMaxDays);
        if (a.totalDays === 0) { toast.error("Not enough data."); return; }
        setResult(a);
        addRun(effectiveMode, ticker, { totalDays: a.totalDays, ibWindow: effectiveIbWindow, highFirst: a.highFirst, lowFirst: a.lowFirst });
      } else if (effectiveMode === "momentum") {
        const a = analyzeMomentum(values as any, effectiveIbWindow, effectiveMaxDays, parseFloat(bodyRatio));
        if (a.totalDays === 0) { toast.error("Not enough data."); return; }
        setMomentumResult(a);
        addRun(effectiveMode, ticker, { totalDays: a.totalDays, tfStats: a.tfStats });
      } else if (effectiveMode === "occ") {
        const a = analyzeOCC(values as any, effectiveMaxDays, parseFloat(occBodyRatio));
        if (a.totalDays === 0) { toast.error("Not enough data."); return; }
        setOccResult(a);
        addRun(effectiveMode, ticker, { totalDays: a.totalDays, tfDirectionStats: a.tfDirectionStats });
      } else if (effectiveMode === "gapfill") {
        const a = analyzeGapFill(values as any, effectiveMaxDays);
        if (a.totalDays === 0) { toast.error("Not enough data."); return; }
        setGapFillResult(a);
        addRun(effectiveMode, ticker, { totalDays: a.totalDays, stats: a.stats });
      } else if (effectiveMode === "insidebar") {
        const a = analyzeInsideBar(values as any, effectiveMaxDays);
        if (a.totalDays === 0) { toast.error("Not enough data."); return; }
        setInsideBarResult(a);
        addRun(effectiveMode, ticker, { totalDays: a.totalDays, insideBarPct: a.insideBarPct, breakoutPct: a.breakoutPct });
      }

    } catch (err: any) {
      toast.error(err.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const hasResults = result || momentumResult || occResult || gapFillResult || insideBarResult;

  const reportTitle = hasResults
    ? `${symbol.toLowerCase()} ${activeMode === "ib" ? "initial balance breakout by rejection report" : activeMode === "momentum" ? "ny open momentum continuation report" : activeMode === "occ" ? "opening candle continuation report" : activeMode === "insidebar" ? "inside bar probability report" : "gap fill statistics report"}`
    : "";

  // Build chart data for each mode
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
              { label: "IB ending zone", value: "all days" },
              { label: "IB breakout measure", value: "by rejection (M5 close)" },
              { label: "weekdays to use", value: "all days" },
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
              { label: "IB ending zone", value: "all days" },
              { label: "IB breakout measure", value: "by rejection (M5 close)" },
              { label: "weekdays to use", value: "all days" },
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
          {/* TF toggle bar */}
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
          {/* TF toggle bar */}
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
              title="candle 1 bullish"
              subtitle={`${symbol} · OCC · ${tf}`}
              totalDays={stats.bullishFirst.total}
              bars={[
                { name: "valid continuation", value: stats.bullishFirst.total > 0 ? (stats.bullishFirst.valid / stats.bullishFirst.total * 100) : 0, color: "primary" },
                { name: "failed continuation", value: stats.bullishFirst.total > 0 ? (stats.bullishFirst.invalid / stats.bullishFirst.total * 100) : 0, color: "muted" },
              ]}
              legendItems={[
                { label: "valid continuation", color: "hsl(217,91%,60%)" },
                { label: "failed continuation", color: "hsl(240,5%,30%)" },
              ]}
            />
            <ChartCard
              title="candle 1 bearish"
              subtitle={`${symbol} · OCC · ${tf}`}
              totalDays={stats.bearishFirst.total}
              bars={[
                { name: "valid continuation", value: stats.bearishFirst.total > 0 ? (stats.bearishFirst.valid / stats.bearishFirst.total * 100) : 0, color: "primary" },
                { name: "failed continuation", value: stats.bearishFirst.total > 0 ? (stats.bearishFirst.invalid / stats.bearishFirst.total * 100) : 0, color: "muted" },
              ]}
              legendItems={[
                { label: "valid continuation", color: "hsl(217,91%,60%)" },
                { label: "failed continuation", color: "hsl(240,5%,30%)" },
              ]}
            />
          </div>
        </div>
      );
    }

    if (activeMode === "gapfill" && gapFillResult) {
      const s = gapFillResult.stats;
      return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <ChartCard
            title="gap up fill rate"
            subtitle={`${symbol} · gap fill`}
            totalDays={s.totalGapUp}
            bars={[
              { name: "filled", value: s.gapUpFillRate, color: "primary" },
              { name: "unfilled", value: 100 - s.gapUpFillRate, color: "muted" },
            ]}
            legendItems={[
              { label: "filled", color: "hsl(217,91%,60%)" },
              { label: "unfilled", color: "hsl(240,5%,30%)" },
            ]}
          />
          <ChartCard
            title="gap down fill rate"
            subtitle={`${symbol} · gap fill`}
            totalDays={s.totalGapDown}
            bars={[
              { name: "filled", value: s.gapDownFillRate, color: "primary" },
              { name: "unfilled", value: 100 - s.gapDownFillRate, color: "muted" },
            ]}
            legendItems={[
              { label: "filled", color: "hsl(217,91%,60%)" },
              { label: "unfilled", color: "hsl(240,5%,30%)" },
            ]}
          />
        </div>
      );
    }

    if (activeMode === "insidebar" && insideBarResult) {
      return <InsideBarReport result={insideBarResult} symbol={symbol} />;
    }

    return null;
  };

  return (
    <div className="h-screen w-full flex overflow-hidden bg-background">

      {/* Column 1: Nav Sidebar */}
      <AppNavSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

      {/* Column 2: Parameter Panel */}
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

      {/* Column 3: Main Content */}
      <main className="flex-1 min-w-0 overflow-y-auto p-6">
        {/* Header row */}
        {hasResults && (
          <div className="flex items-center gap-3 mb-5">
            <h2 className="text-[15px] text-foreground font-medium lowercase">{reportTitle}</h2>
            <button className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-3 py-1 text-[12px] font-medium">
              <Bookmark className="h-3.5 w-3.5" />
              bookmarked
            </button>
          </div>
        )}

        {/* Empty state */}
        {!hasResults && !loading && (
          <div className="flex items-center justify-center h-full">
            <div className="border border-dashed border-border rounded-xl p-12 text-center max-w-md">
              <img src={logo} className="h-14 w-14 rounded-full object-cover mx-auto mb-4 opacity-40" alt="" />
              <p className="text-[13px] text-muted-foreground">select a report type and ticker to begin analysis</p>
              <p className="text-[11px] text-muted-foreground mt-1">powered by TwelveData API · 5000 bars intraday</p>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-3">
              <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto" />
              <p className="text-[13px] text-muted-foreground">fetching & analyzing {symbol.toLowerCase()} data…</p>
            </div>
          </div>
        )}

        {/* Results — pure bar chart cards only */}
        {hasResults && !loading && renderCharts()}
      </main>

      {/* Column 4: Right Sidebar */}
      <RightSidebar templates={templates} activeMode={activeMode} />
    </div>
  );
};

export default Index;
