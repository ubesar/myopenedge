import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Bookmark } from "lucide-react";
import ControlPanel, { type AnalysisMode } from "@/components/ControlPanel";
import AppSidebar from "@/components/AppSidebar";
import RightSidebar from "@/components/RightSidebar";
import DivBarChart from "@/components/DivBarChart";
import AIChatAssistant, { type AnalysisContext } from "@/components/AIChatAssistant";
import GapFillDashboard from "@/components/GapFillDashboard";
import { useAnalysisHistory, type AnalysisRun } from "@/hooks/useAnalysisHistory";
import { analyzeIB, type AnalysisResult } from "@/lib/ib-analysis";
import { analyzeMomentum, type MomentumResult } from "@/lib/momentum-analysis";
import { analyzeOCC, type OCCResult } from "@/lib/occ-analysis";
import { analyzeGapFill, type GapFillResult } from "@/lib/gapfill-analysis";
import { useSubscription } from "@/hooks/useSubscription";
import { z } from "zod";

const BarSchema = z.object({
  datetime: z.string(), open: z.string(), high: z.string(), low: z.string(), close: z.string()
}).passthrough();

const TwelveDataResponseSchema = z.object({
  values: z.array(BarSchema).min(1)
}).passthrough();

const Index = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { isActive, endDate, loading: subLoading } = useSubscription();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [momentumResult, setMomentumResult] = useState<MomentumResult | null>(null);
  const [occResult, setOccResult] = useState<OCCResult | null>(null);
  const [gapFillResult, setGapFillResult] = useState<GapFillResult | null>(null);
  const [symbol, setSymbol] = useState("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [activeMode, setActiveMode] = useState<AnalysisMode>("ib");
  const [occTf, setOccTf] = useState("M15");
  const [momentumTf, setMomentumTf] = useState("M15");
  const [selectedRunId, setSelectedRunId] = useState<string | undefined>();
  const [sidebarItem, setSidebarItem] = useState("reports");
  const { runs: historyRuns, addRun, deleteRun } = useAnalysisHistory();

  const isFree = !isActive;

  const handleSelectRun = (run: AnalysisRun) => setSelectedRunId(run.id);

  const handleSidebarClick = (item: string) => {
    if (item === "docs") { navigate("/docs"); return; }
    setSidebarItem(item);
  };

  // Analysis context for AI chat
  const analysisContext = useMemo<AnalysisContext>(() => {
    if (activeMode === "ib" && result) {
      const hf = result.highFirst; const lf = result.lowFirst;
      const hfT = hf.total || 1; const lfT = lf.total || 1;
      return { mode: "ib", symbol, summary: `Symbol: ${symbol}\nTotal: ${result.totalDays} days\nHigh 1st (${hf.total}): BH ${(hf.breakHigh/hfT*100).toFixed(1)}%, BL ${(hf.breakLow/hfT*100).toFixed(1)}%\nLow 1st (${lf.total}): BH ${(lf.breakHigh/lfT*100).toFixed(1)}%, BL ${(lf.breakLow/lfT*100).toFixed(1)}%` };
    }
    if (activeMode === "momentum" && momentumResult) {
      return { mode: "momentum", symbol, summary: `Symbol: ${symbol}\nTotal: ${momentumResult.totalDays} days` };
    }
    if (activeMode === "occ" && occResult) {
      return { mode: "occ", symbol, summary: `Symbol: ${symbol}\nTotal: ${occResult.totalDays} days` };
    }
    if (activeMode === "gapfill" && gapFillResult) {
      return { mode: "gapfill", symbol, summary: `Symbol: ${symbol}\nTotal: ${gapFillResult.totalDays} gaps\nFill Rate: ${gapFillResult.stats.overallFillRate.toFixed(1)}%` };
    }
    return { mode: null, symbol: "", summary: "" };
  }, [activeMode, result, momentumResult, occResult, gapFillResult, symbol]);

  if (!authLoading && !user) { navigate("/auth"); return null; }

  const fetchMarketData = async (ticker: string) => {
    const { data, error } = await supabase.functions.invoke("twelvedata-proxy", { body: { symbol: ticker } });
    if (error) throw new Error("Failed to fetch market data");
    return data;
  };

  const handleRun = async (ticker: string, ibWindow: number, maxDays: number, mode: AnalysisMode) => {
    setLoading(true);
    setResult(null); setMomentumResult(null); setOccResult(null); setGapFillResult(null);
    setSymbol(ticker); setActiveMode(mode);
    try {
      const json = await fetchMarketData(ticker);
      if (json.status === "error") { toast.error(json.message || "API error"); return; }
      const parsed = TwelveDataResponseSchema.safeParse(json);
      if (!parsed.success) { toast.error("Invalid or empty data. Check ticker."); return; }
      const values = parsed.data.values;

      if (mode === "ib") {
        const a = analyzeIB(values as any, ibWindow, maxDays);
        if (a.totalDays === 0) { toast.error("Not enough data."); return; }
        setResult(a); setSelectedDate(a.lastDay?.date || "");
        addRun(mode, ticker, { totalDays: a.totalDays, insideDays: a.insideDays, ibWindow, highFirst: a.highFirst, lowFirst: a.lowFirst });
      } else if (mode === "momentum") {
        const a = analyzeMomentum(values as any, ibWindow, maxDays);
        if (a.totalDays === 0) { toast.error("Not enough data."); return; }
        setMomentumResult(a); setSelectedDate(a.lastDay?.date || "");
        addRun(mode, ticker, { totalDays: a.totalDays, tfStats: a.tfStats });
      } else if (mode === "occ") {
        const a = analyzeOCC(values as any, maxDays);
        if (a.totalDays === 0) { toast.error("Not enough data."); return; }
        setOccResult(a); setSelectedDate(a.lastDay?.date || "");
        addRun(mode, ticker, { totalDays: a.totalDays, tfDirectionStats: a.tfDirectionStats });
      } else if (mode === "gapfill") {
        const a = analyzeGapFill(values as any, maxDays);
        if (a.totalDays === 0) { toast.error("Not enough gap days."); return; }
        setGapFillResult(a); setSelectedDate(a.lastDay?.date || "");
        addRun(mode, ticker, { totalDays: a.totalDays, stats: a.stats });
      }
    } catch (err: any) { toast.error(err.message || "Failed to fetch data"); }
    finally { setLoading(false); }
  };

  const hasResults = result || momentumResult || occResult || gapFillResult;

  // Build report title
  const modeLabels: Record<AnalysisMode, string> = {
    ib: "initial balance breakout report",
    momentum: "ny open momentum continuation report",
    occ: "opening candle continuation report",
    gapfill: "gap fill statistics report",
  };

  // Get IB window label for subtitle
  const getIbWindowLabel = (mins: number) => `${mins}min`;

  return (
    <div className="h-screen w-full flex overflow-hidden bg-background">
      <AIChatAssistant analysisContext={analysisContext} />

      {/* Col 1: Navigation sidebar - hidden on mobile */}
      <div className="hidden lg:block">
        <AppSidebar activeItem={sidebarItem} onItemClick={handleSidebarClick} isActive={isActive} />
      </div>

      {/* Col 2: Parameter Panel */}
      <div className="w-full sm:w-[280px] shrink-0 border-r border-border/30 bg-card/60 overflow-y-auto scrollbar-thin">
        <div className="p-3">
          <ControlPanel onRun={handleRun} loading={loading} isFree={isFree} />
        </div>
      </div>

      {/* Col 3: Main Content */}
      <main className="flex-1 min-w-0 overflow-y-auto scrollbar-thin">
        <div className="p-4 sm:p-6">
          {/* Header */}
          {hasResults && (
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-sm sm:text-base font-semibold text-foreground lowercase">
                {modeLabels[activeMode]}
              </h1>
              <button className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-medium">
                <Bookmark className="h-3.5 w-3.5" />
                bookmarked
              </button>
            </div>
          )}

          {/* Empty State */}
          {!hasResults && !loading && (
            <div className="flex items-center justify-center h-[60vh]">
              <div className="text-center">
                <p className="text-muted-foreground text-sm lowercase">select parameters and run analysis</p>
                <p className="text-muted-foreground/60 text-xs mt-1 lowercase">powered by twelvedata api · 5000 bars intraday</p>
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center h-[60vh]">
              <div className="text-center space-y-3">
                <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-muted-foreground text-xs lowercase">analyzing {symbol}…</p>
              </div>
            </div>
          )}

          {/* IB Mode */}
          {activeMode === "ib" && result && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <DivBarChart
                title="charts"
                subtitle={`${symbol} ${getIbWindowLabel(result.ibWindowMinutes)} IB high formed first | ${result.totalDays} days`}
                bars={[
                  { label: "first break IB high", value: result.highFirst.total > 0 ? (result.highFirst.breakHigh / result.highFirst.total) * 100 : 0, color: "blue" },
                  { label: "first break IB low", value: result.highFirst.total > 0 ? (result.highFirst.breakLow / result.highFirst.total) * 100 : 0, color: "grey" },
                ]}
                legend={[
                  { label: "first break IB high", color: "blue" },
                  { label: "first break IB low", color: "grey" },
                ]}
                settings={[
                  { label: "IB timeframe", value: `${result.ibWindowMinutes}min` },
                  { label: "candle timeframe", value: "5min" },
                  { label: "total days", value: `${result.highFirst.total}` },
                  { label: "breakout measure", value: "by wick" },
                ]}
              />
              <DivBarChart
                title="charts"
                subtitle={`${symbol} ${getIbWindowLabel(result.ibWindowMinutes)} IB low formed first | ${result.totalDays} days`}
                bars={[
                  { label: "first break IB high", value: result.lowFirst.total > 0 ? (result.lowFirst.breakHigh / result.lowFirst.total) * 100 : 0, color: "blue" },
                  { label: "first break IB low", value: result.lowFirst.total > 0 ? (result.lowFirst.breakLow / result.lowFirst.total) * 100 : 0, color: "grey" },
                ]}
                legend={[
                  { label: "first break IB high", color: "blue" },
                  { label: "first break IB low", color: "grey" },
                ]}
                settings={[
                  { label: "IB timeframe", value: `${result.ibWindowMinutes}min` },
                  { label: "candle timeframe", value: "5min" },
                  { label: "total days", value: `${result.lowFirst.total}` },
                  { label: "breakout measure", value: "by wick" },
                ]}
              />
            </div>
          )}

          {/* Momentum Mode */}
          {activeMode === "momentum" && momentumResult && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground lowercase">timeframe:</span>
                {["M5", "M15", "M30", "H1"].map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setMomentumTf(tf)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors lowercase ${
                      momentumTf === tf ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-card/80 border border-border/30"
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
              {momentumResult.tfStats[momentumTf] && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <DivBarChart
                    title="charts"
                    subtitle={`${symbol} ${momentumTf} IB high formed first | ${momentumResult.totalDays} days`}
                    bars={[
                      { label: "bullish", value: momentumResult.tfStats[momentumTf].highFirst.total > 0 ? (momentumResult.tfStats[momentumTf].highFirst.bullish / momentumResult.tfStats[momentumTf].highFirst.total) * 100 : 0, color: "blue" },
                      { label: "bearish", value: momentumResult.tfStats[momentumTf].highFirst.total > 0 ? (momentumResult.tfStats[momentumTf].highFirst.bearish / momentumResult.tfStats[momentumTf].highFirst.total) * 100 : 0, color: "grey" },
                    ]}
                    legend={[
                      { label: "bullish continuation", color: "blue" },
                      { label: "bearish reversal", color: "grey" },
                    ]}
                  />
                  <DivBarChart
                    title="charts"
                    subtitle={`${symbol} ${momentumTf} IB low formed first | ${momentumResult.totalDays} days`}
                    bars={[
                      { label: "bullish", value: momentumResult.tfStats[momentumTf].lowFirst.total > 0 ? (momentumResult.tfStats[momentumTf].lowFirst.bullish / momentumResult.tfStats[momentumTf].lowFirst.total) * 100 : 0, color: "blue" },
                      { label: "bearish", value: momentumResult.tfStats[momentumTf].lowFirst.total > 0 ? (momentumResult.tfStats[momentumTf].lowFirst.bearish / momentumResult.tfStats[momentumTf].lowFirst.total) * 100 : 0, color: "grey" },
                    ]}
                    legend={[
                      { label: "bullish continuation", color: "blue" },
                      { label: "bearish reversal", color: "grey" },
                    ]}
                  />
                </div>
              )}
            </div>
          )}

          {/* OCC Mode */}
          {activeMode === "occ" && occResult && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground lowercase">timeframe:</span>
                {["M5", "M15", "M30", "H1"].map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setOccTf(tf)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors lowercase ${
                      occTf === tf ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-card/80 border border-border/30"
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
              {occResult.tfDirectionStats[occTf] && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <DivBarChart
                    title="charts"
                    subtitle={`${symbol} ${occTf} candle 1 bullish | ${occResult.totalDays} days`}
                    bars={[
                      { label: "valid", value: occResult.tfDirectionStats[occTf].bullishFirst.total > 0 ? (occResult.tfDirectionStats[occTf].bullishFirst.valid / occResult.tfDirectionStats[occTf].bullishFirst.total) * 100 : 0, color: "blue" },
                      { label: "invalid", value: occResult.tfDirectionStats[occTf].bullishFirst.total > 0 ? (occResult.tfDirectionStats[occTf].bullishFirst.invalid / occResult.tfDirectionStats[occTf].bullishFirst.total) * 100 : 0, color: "grey" },
                    ]}
                    legend={[
                      { label: "hit target first", color: "blue" },
                      { label: "hit stoploss first", color: "grey" },
                    ]}
                  />
                  <DivBarChart
                    title="charts"
                    subtitle={`${symbol} ${occTf} candle 1 bearish | ${occResult.totalDays} days`}
                    bars={[
                      { label: "valid", value: occResult.tfDirectionStats[occTf].bearishFirst.total > 0 ? (occResult.tfDirectionStats[occTf].bearishFirst.valid / occResult.tfDirectionStats[occTf].bearishFirst.total) * 100 : 0, color: "blue" },
                      { label: "invalid", value: occResult.tfDirectionStats[occTf].bearishFirst.total > 0 ? (occResult.tfDirectionStats[occTf].bearishFirst.invalid / occResult.tfDirectionStats[occTf].bearishFirst.total) * 100 : 0, color: "grey" },
                    ]}
                    legend={[
                      { label: "hit target first", color: "blue" },
                      { label: "hit stoploss first", color: "grey" },
                    ]}
                  />
                </div>
              )}
            </div>
          )}

          {/* Gap Fill Mode */}
          {activeMode === "gapfill" && gapFillResult && (
            <GapFillDashboard result={gapFillResult} symbol={symbol} />
          )}
        </div>
      </main>

      {/* Col 4: Right sidebar - hidden on mobile */}
      <div className="hidden lg:block">
        <RightSidebar
          runs={historyRuns.slice(0, 15)}
          onDelete={deleteRun}
          onSelect={handleSelectRun}
          selectedId={selectedRunId}
          onSignOut={signOut}
        />
      </div>
    </div>
  );
};

export default Index;
