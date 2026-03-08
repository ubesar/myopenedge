// --- EXISTING LOGIC PRESERVED --- All hooks, state, handlers, data transformations
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useAnalysisHistory, type AnalysisRun } from "@/hooks/useAnalysisHistory";
import { analyzeIB, type AnalysisResult } from "@/lib/ib-analysis";
import { analyzeMomentum, type MomentumResult } from "@/lib/momentum-analysis";
import { analyzeOCC, type OCCResult } from "@/lib/occ-analysis";
import { analyzeGapFill, type GapFillResult } from "@/lib/gapfill-analysis";
import type { AnalysisMode } from "@/components/ControlPanel";
import AIChatAssistant, { type AnalysisContext } from "@/components/AIChatAssistant";
import GapFillDashboard from "@/components/GapFillDashboard";
import { z } from "zod";

// --- NEW UI LAYOUT --- Edgeful-inspired dashboard components
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import ParameterPanel from "@/components/dashboard/ParameterPanel";
import RightPanel from "@/components/dashboard/RightPanel";
import EdgefulChart from "@/components/dashboard/EdgefulChart";
import MobileHeader from "@/components/dashboard/MobileHeader";
import { Bookmark } from "lucide-react";

// --- EXISTING LOGIC PRESERVED --- Zod schemas
const BarSchema = z.object({
  datetime: z.string(),
  open: z.string(),
  high: z.string(),
  low: z.string(),
  close: z.string(),
}).passthrough();

const TwelveDataResponseSchema = z.object({
  values: z.array(BarSchema).min(1),
}).passthrough();

// --- EXISTING LOGIC PRESERVED --- Report title map
const REPORT_TITLES: Record<AnalysisMode, string> = {
  ib: "initial balance breakout report",
  momentum: "ny open momentum continuation report",
  occ: "opening candle continuation report",
  gapfill: "gap fill statistics report",
};

const Index = () => {
  // --- EXISTING LOGIC PRESERVED --- All state and hooks
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
  const { runs: historyRuns, addRun, deleteRun } = useAnalysisHistory();

  const isFree = !isActive;

  // --- EXISTING LOGIC PRESERVED --- Handlers
  const handleSelectRun = (run: AnalysisRun) => {
    setSelectedRunId(run.id);
  };

  // --- EXISTING LOGIC PRESERVED --- Analysis context for AI chat
  const analysisContext = useMemo<AnalysisContext>(() => {
    if (activeMode === "ib" && result) {
      const hf = result.highFirst;
      const lf = result.lowFirst;
      const hfTotal = hf.total || 1;
      const lfTotal = lf.total || 1;
      return {
        mode: "ib",
        symbol,
        summary: `Symbol: ${symbol}\nTotal trading days: ${result.totalDays}, Inside days: ${result.insideDays}\n\nIB High Formed First (${hf.total} days):\n- Break High: ${hf.breakHigh} (${((hf.breakHigh / hfTotal) * 100).toFixed(1)}%)\n- Break Low: ${hf.breakLow} (${((hf.breakLow / hfTotal) * 100).toFixed(1)}%)\n- Inside: ${hf.inside} (${((hf.inside / hfTotal) * 100).toFixed(1)}%)\n\nIB Low Formed First (${lf.total} days):\n- Break High: ${lf.breakHigh} (${((lf.breakHigh / lfTotal) * 100).toFixed(1)}%)\n- Break Low: ${lf.breakLow} (${((lf.breakLow / lfTotal) * 100).toFixed(1)}%)\n- Inside: ${lf.inside} (${((lf.inside / lfTotal) * 100).toFixed(1)}%)`,
      };
    }
    if (activeMode === "momentum" && momentumResult) {
      const hf = momentumResult.highFirst;
      const lf = momentumResult.lowFirst;
      const hfT = hf.total || 1;
      const lfT = lf.total || 1;
      return {
        mode: "momentum",
        symbol,
        summary: `Symbol: ${symbol}\nTotal trading days: ${momentumResult.totalDays}\n\nHigh Formed First (${hf.total} days):\n- Bullish: ${hf.bullish} (${((hf.bullish / hfT) * 100).toFixed(1)}%)\n- Bearish: ${hf.bearish} (${((hf.bearish / hfT) * 100).toFixed(1)}%)\n- Choppy: ${hf.choppy} (${((hf.choppy / hfT) * 100).toFixed(1)}%)\n\nLow Formed First (${lf.total} days):\n- Bullish: ${lf.bullish} (${((lf.bullish / lfT) * 100).toFixed(1)}%)\n- Bearish: ${lf.bearish} (${((lf.bearish / lfT) * 100).toFixed(1)}%)\n- Choppy: ${lf.choppy} (${((lf.choppy / lfT) * 100).toFixed(1)}%)`,
      };
    }
    if (activeMode === "occ" && occResult) {
      const tfStats = occResult.tfDirectionStats;
      let summary = `Symbol: ${symbol}\nTotal trading days: ${occResult.totalDays}\n\nOCC Stats by Timeframe:\n`;
      for (const tf of ["M5", "M15", "M30", "H1"]) {
        const s = tfStats[tf];
        if (s) {
          const bT = s.bullishFirst.total || 1;
          const brT = s.bearishFirst.total || 1;
          summary += `\n${tf}:\n- Candle1 Bullish (${s.bullishFirst.total} days): Valid ${s.bullishFirst.valid} (${((s.bullishFirst.valid / bT) * 100).toFixed(1)}%), Invalid ${s.bullishFirst.invalid} (${((s.bullishFirst.invalid / bT) * 100).toFixed(1)}%)\n- Candle1 Bearish (${s.bearishFirst.total} days): Valid ${s.bearishFirst.valid} (${((s.bearishFirst.valid / brT) * 100).toFixed(1)}%), Invalid ${s.bearishFirst.invalid} (${((s.bearishFirst.invalid / brT) * 100).toFixed(1)}%)`;
        }
      }
      return { mode: "occ", symbol, summary };
    }
    if (activeMode === "gapfill" && gapFillResult) {
      const s = gapFillResult.stats;
      return {
        mode: "gapfill",
        symbol,
        summary: `Symbol: ${symbol}\nTotal gap days: ${gapFillResult.totalDays}\nOverall Fill Rate: ${s.overallFillRate.toFixed(1)}%\nGap Up Fill: ${s.gapUpFillRate.toFixed(1)}% (${s.filledGapUp}/${s.totalGapUp})\nGap Down Fill: ${s.gapDownFillRate.toFixed(1)}% (${s.filledGapDown}/${s.totalGapDown})\nBy Size: Small ${s.bySize.small.rate.toFixed(0)}%, Medium ${s.bySize.medium.rate.toFixed(0)}%, Large ${s.bySize.large.rate.toFixed(0)}%`,
      };
    }
    return { mode: null, symbol: "", summary: "" };
  }, [activeMode, result, momentumResult, occResult, gapFillResult, symbol]);

  // --- EXISTING LOGIC PRESERVED --- Auth guard
  if (!authLoading && !user) {
    navigate("/auth");
    return null;
  }

  // --- EXISTING LOGIC PRESERVED --- API fetch
  const fetchMarketData = async (ticker: string) => {
    const { data, error } = await supabase.functions.invoke("twelvedata-proxy", {
      body: { symbol: ticker },
    });
    if (error) throw new Error("Failed to fetch market data");
    return data;
  };

  // --- EXISTING LOGIC PRESERVED --- Run handler
  const handleRun = async (ticker: string, ibWindow: number, maxDays: number, mode: AnalysisMode) => {
    setLoading(true);
    setResult(null);
    setMomentumResult(null);
    setOccResult(null);
    setGapFillResult(null);
    setSymbol(ticker);
    setActiveMode(mode);

    try {
      const json = await fetchMarketData(ticker);

      if (json.status === "error") {
        toast.error(json.message || "API error");
        return;
      }

      const parsed = TwelveDataResponseSchema.safeParse(json);
      if (!parsed.success) {
        toast.error("Invalid or empty data returned. Check ticker symbol.");
        return;
      }

      const values = parsed.data.values;

      if (mode === "ib") {
        const analysis = analyzeIB(values as any, ibWindow, maxDays);
        if (analysis.totalDays === 0 && analysis.insideDays === 0) {
          toast.error("Not enough trading days in the data to analyze.");
          return;
        }
        setResult(analysis);
        setSelectedDate(analysis.lastDay?.date || "");
        addRun(mode, ticker, {
          totalDays: analysis.totalDays,
          insideDays: analysis.insideDays,
          ibWindow,
          highFirst: analysis.highFirst,
          lowFirst: analysis.lowFirst,
        });
      } else if (mode === "momentum") {
        const analysis = analyzeMomentum(values as any, ibWindow, maxDays);
        if (analysis.totalDays === 0) {
          toast.error("Not enough trading days in the data to analyze.");
          return;
        }
        setMomentumResult(analysis);
        setSelectedDate(analysis.lastDay?.date || "");
        addRun(mode, ticker, {
          totalDays: analysis.totalDays,
          tfStats: analysis.tfStats,
        });
      } else if (mode === "occ") {
        const analysis = analyzeOCC(values as any, maxDays);
        if (analysis.totalDays === 0) {
          toast.error("Not enough trading days in the data to analyze.");
          return;
        }
        setOccResult(analysis);
        setSelectedDate(analysis.lastDay?.date || "");
        addRun(mode, ticker, {
          totalDays: analysis.totalDays,
          tfDirectionStats: analysis.tfDirectionStats,
        });
      } else if (mode === "gapfill") {
        const analysis = analyzeGapFill(values as any, maxDays);
        if (analysis.totalDays === 0) {
          toast.error("Not enough gap days in the data to analyze.");
          return;
        }
        setGapFillResult(analysis);
        setSelectedDate(analysis.lastDay?.date || "");
        addRun(mode, ticker, {
          totalDays: analysis.totalDays,
          stats: analysis.stats,
        });
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const hasResults = result || momentumResult || occResult || gapFillResult;

  // --- NEW UI LAYOUT --- Edgeful-inspired 4-column dashboard
  return (
    <div className="h-screen w-full flex flex-col lg:flex-row overflow-hidden bg-background">
      <AIChatAssistant analysisContext={analysisContext} />

      {/* Mobile Header */}
      <MobileHeader isActive={isActive} onSignOut={signOut} />

      {/* Far-Left Sidebar (desktop only) */}
      <DashboardSidebar isActive={isActive} onSignOut={signOut} />

      {/* Left Parameter Panel */}
      <div className="lg:hidden">
        <ParameterPanel onRun={handleRun} loading={loading} isFree={isFree} />
      </div>
      <div className="hidden lg:block">
        <ParameterPanel onRun={handleRun} loading={loading} isFree={isFree} />
      </div>

      {/* Main Content Area */}
      <main className="flex-1 min-h-0 overflow-y-auto">
        {/* Content Header */}
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border/20 px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-sm sm:text-base font-semibold text-foreground lowercase">
                {symbol ? `${symbol} — ` : ""}
                {REPORT_TITLES[activeMode]}
              </h1>
              {symbol && (
                <p className="text-[10px] text-muted-foreground lowercase mt-0.5">
                  powered by twelvedata api · 5000 bars of intraday data
                </p>
              )}
            </div>
            {hasResults && (
              <span className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/15 text-primary text-xs font-medium">
                <Bookmark className="h-3.5 w-3.5" />
                bookmarked
              </span>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6">
          {/* Empty State */}
          {!hasResults && !loading && (
            <div className="flex items-center justify-center h-[60vh]">
              <div className="text-center">
                <div className="h-16 w-16 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">📊</span>
                </div>
                <p className="text-sm text-muted-foreground lowercase">
                  select a report type and run analysis to get started
                </p>
                <p className="text-[10px] text-muted-foreground mt-1 lowercase">
                  powered by twelvedata api with 5000 bars of intraday data
                </p>
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center h-[60vh]">
              <div className="text-center space-y-3">
                <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm text-muted-foreground lowercase">analyzing {symbol}…</p>
              </div>
            </div>
          )}

          {/* IB Mode Results */}
          {activeMode === "ib" && result && (
            <div className="space-y-4">
              {/* Timeframe selector - for IB we show info summary */}
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span>total days: <span className="text-foreground font-semibold">{result.totalDays}</span></span>
                <span>•</span>
                <span>inside days: <span className="text-foreground font-semibold">{result.insideDays}</span></span>
              </div>

              {/* Two chart cards side by side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <EdgefulChart
                  title="IB high formed first"
                  subtitle={`${result.highFirst.total} trading days`}
                  bars={[
                    {
                      label: "break high",
                      value: result.highFirst.total > 0 ? (result.highFirst.breakHigh / result.highFirst.total) * 100 : 0,
                      color: "blue",
                    },
                    {
                      label: "break low",
                      value: result.highFirst.total > 0 ? (result.highFirst.breakLow / result.highFirst.total) * 100 : 0,
                      color: "grey",
                    },
                    {
                      label: "inside",
                      value: result.highFirst.total > 0 ? (result.highFirst.inside / result.highFirst.total) * 100 : 0,
                      color: "grey",
                    },
                  ]}
                  legend={[
                    { label: "break high", color: "bg-primary" },
                    { label: "break low", color: "bg-chart-grey" },
                  ]}
                  settingsRows={[
                    { label: "IB window", value: `${result.ibWindowMinutes} min` },
                    { label: "candle timeframe", value: "5min" },
                    { label: "break high", value: `${result.highFirst.breakHigh} days` },
                    { label: "break low", value: `${result.highFirst.breakLow} days` },
                  ]}
                />
                <EdgefulChart
                  title="IB low formed first"
                  subtitle={`${result.lowFirst.total} trading days`}
                  bars={[
                    {
                      label: "break high",
                      value: result.lowFirst.total > 0 ? (result.lowFirst.breakHigh / result.lowFirst.total) * 100 : 0,
                      color: "blue",
                    },
                    {
                      label: "break low",
                      value: result.lowFirst.total > 0 ? (result.lowFirst.breakLow / result.lowFirst.total) * 100 : 0,
                      color: "grey",
                    },
                    {
                      label: "inside",
                      value: result.lowFirst.total > 0 ? (result.lowFirst.inside / result.lowFirst.total) * 100 : 0,
                      color: "grey",
                    },
                  ]}
                  legend={[
                    { label: "break high", color: "bg-primary" },
                    { label: "break low", color: "bg-chart-grey" },
                  ]}
                  settingsRows={[
                    { label: "IB window", value: `${result.ibWindowMinutes} min` },
                    { label: "candle timeframe", value: "5min" },
                    { label: "break high", value: `${result.lowFirst.breakHigh} days` },
                    { label: "break low", value: `${result.lowFirst.breakLow} days` },
                  ]}
                />
              </div>
            </div>
          )}

          {/* Momentum Mode Results */}
          {activeMode === "momentum" && momentumResult && (
            <div className="space-y-4">
              {/* Timeframe selector */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">timeframe:</span>
                {["M5", "M15", "M30", "H1"].map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setMomentumTf(tf)}
                    className={`px-3 py-1 rounded-lg text-[11px] font-medium transition-colors lowercase ${
                      momentumTf === tf
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tf}
                  </button>
                ))}
                <span className="ml-3 text-[11px] text-muted-foreground">
                  total days: <span className="text-foreground font-semibold">{momentumResult.totalDays}</span>
                </span>
              </div>

              {momentumResult.tfStats[momentumTf] && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <EdgefulChart
                    title="IB high formed first"
                    subtitle={`${momentumResult.tfStats[momentumTf].highFirst.total} trading days`}
                    bars={[
                      {
                        label: "bullish",
                        value: momentumResult.tfStats[momentumTf].highFirst.total > 0 ? (momentumResult.tfStats[momentumTf].highFirst.bullish / momentumResult.tfStats[momentumTf].highFirst.total) * 100 : 0,
                        color: "green",
                      },
                      {
                        label: "bearish",
                        value: momentumResult.tfStats[momentumTf].highFirst.total > 0 ? (momentumResult.tfStats[momentumTf].highFirst.bearish / momentumResult.tfStats[momentumTf].highFirst.total) * 100 : 0,
                        color: "red",
                      },
                      {
                        label: "choppy",
                        value: momentumResult.tfStats[momentumTf].highFirst.total > 0 ? (momentumResult.tfStats[momentumTf].highFirst.choppy / momentumResult.tfStats[momentumTf].highFirst.total) * 100 : 0,
                        color: "yellow",
                      },
                    ]}
                    legend={[
                      { label: "bullish", color: "bg-[hsl(142,71%,45%)]" },
                      { label: "bearish", color: "bg-[hsl(0,84%,60%)]" },
                      { label: "choppy", color: "bg-[hsl(45,100%,50%)]" },
                    ]}
                  />
                  <EdgefulChart
                    title="IB low formed first"
                    subtitle={`${momentumResult.tfStats[momentumTf].lowFirst.total} trading days`}
                    bars={[
                      {
                        label: "bullish",
                        value: momentumResult.tfStats[momentumTf].lowFirst.total > 0 ? (momentumResult.tfStats[momentumTf].lowFirst.bullish / momentumResult.tfStats[momentumTf].lowFirst.total) * 100 : 0,
                        color: "green",
                      },
                      {
                        label: "bearish",
                        value: momentumResult.tfStats[momentumTf].lowFirst.total > 0 ? (momentumResult.tfStats[momentumTf].lowFirst.bearish / momentumResult.tfStats[momentumTf].lowFirst.total) * 100 : 0,
                        color: "red",
                      },
                      {
                        label: "choppy",
                        value: momentumResult.tfStats[momentumTf].lowFirst.total > 0 ? (momentumResult.tfStats[momentumTf].lowFirst.choppy / momentumResult.tfStats[momentumTf].lowFirst.total) * 100 : 0,
                        color: "yellow",
                      },
                    ]}
                    legend={[
                      { label: "bullish", color: "bg-[hsl(142,71%,45%)]" },
                      { label: "bearish", color: "bg-[hsl(0,84%,60%)]" },
                      { label: "choppy", color: "bg-[hsl(45,100%,50%)]" },
                    ]}
                  />
                </div>
              )}
            </div>
          )}

          {/* OCC Mode Results */}
          {activeMode === "occ" && occResult && (
            <div className="space-y-4">
              {/* Timeframe selector */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">timeframe:</span>
                {["M5", "M15", "M30", "H1"].map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setOccTf(tf)}
                    className={`px-3 py-1 rounded-lg text-[11px] font-medium transition-colors lowercase ${
                      occTf === tf
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tf}
                  </button>
                ))}
                <span className="ml-3 text-[11px] text-muted-foreground">
                  total days: <span className="text-foreground font-semibold">{occResult.totalDays}</span>
                </span>
              </div>

              {occResult.tfDirectionStats[occTf] && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <EdgefulChart
                    title="candle 1 bullish"
                    subtitle={`${occResult.tfDirectionStats[occTf].bullishFirst.total} trading days`}
                    bars={[
                      {
                        label: "valid continuation",
                        value: occResult.tfDirectionStats[occTf].bullishFirst.total > 0 ? (occResult.tfDirectionStats[occTf].bullishFirst.valid / occResult.tfDirectionStats[occTf].bullishFirst.total) * 100 : 0,
                        color: "green",
                      },
                      {
                        label: "invalid",
                        value: occResult.tfDirectionStats[occTf].bullishFirst.total > 0 ? (occResult.tfDirectionStats[occTf].bullishFirst.invalid / occResult.tfDirectionStats[occTf].bullishFirst.total) * 100 : 0,
                        color: "grey",
                      },
                    ]}
                    legend={[
                      { label: "valid", color: "bg-[hsl(142,71%,45%)]" },
                      { label: "invalid", color: "bg-chart-grey" },
                    ]}
                  />
                  <EdgefulChart
                    title="candle 1 bearish"
                    subtitle={`${occResult.tfDirectionStats[occTf].bearishFirst.total} trading days`}
                    bars={[
                      {
                        label: "valid continuation",
                        value: occResult.tfDirectionStats[occTf].bearishFirst.total > 0 ? (occResult.tfDirectionStats[occTf].bearishFirst.valid / occResult.tfDirectionStats[occTf].bearishFirst.total) * 100 : 0,
                        color: "red",
                      },
                      {
                        label: "invalid",
                        value: occResult.tfDirectionStats[occTf].bearishFirst.total > 0 ? (occResult.tfDirectionStats[occTf].bearishFirst.invalid / occResult.tfDirectionStats[occTf].bearishFirst.total) * 100 : 0,
                        color: "grey",
                      },
                    ]}
                    legend={[
                      { label: "valid", color: "bg-[hsl(0,84%,60%)]" },
                      { label: "invalid", color: "bg-chart-grey" },
                    ]}
                  />
                </div>
              )}
            </div>
          )}

          {/* Gap Fill Mode Results */}
          {activeMode === "gapfill" && gapFillResult && (
            <GapFillDashboard result={gapFillResult} symbol={symbol} />
          )}
        </div>
      </main>

      {/* Right Sidebar (desktop only) */}
      <RightPanel
        runs={historyRuns.slice(0, 10)}
        onDelete={deleteRun}
        onSelect={handleSelectRun}
        selectedId={selectedRunId}
        isActive={isActive}
        endDate={endDate}
      />
    </div>
  );
};

export default Index;
