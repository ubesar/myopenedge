import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut, Crown, FileText, Bot } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import logo from "@/assets/logo.png";
import ControlPanel, { type AnalysisMode } from "@/components/ControlPanel";
import IBChart from "@/components/IBChart";
import IBDayChart from "@/components/IBDayChart";
import AnalysisHistory from "@/components/AnalysisHistory";
import { useAnalysisHistory, type AnalysisRun } from "@/hooks/useAnalysisHistory";
import SummaryTable from "@/components/SummaryTable";
import MomentumChart from "@/components/MomentumChart";
import MomentumDayChart from "@/components/MomentumDayChart";
import OCCChart from "@/components/OCCChart";
import OCCDayChart from "@/components/OCCDayChart";
import AIChatAssistant, { type AnalysisContext } from "@/components/AIChatAssistant";
import { analyzeIB, type AnalysisResult } from "@/lib/ib-analysis";
import { analyzeMomentum, type MomentumResult } from "@/lib/momentum-analysis";
import { analyzeOCC, type OCCResult } from "@/lib/occ-analysis";
import { analyzeGapFill, type GapFillResult } from "@/lib/gapfill-analysis";
import { analyzeNYGapM15, type NYGapM15Result } from "@/lib/nygap-m15-analysis";
import GapFillDashboard from "@/components/GapFillDashboard";
import NYGapM15Dashboard from "@/components/NYGapM15Dashboard";

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
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { isActive, endDate, loading: subLoading } = useSubscription();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [momentumResult, setMomentumResult] = useState<MomentumResult | null>(null);
  const [occResult, setOccResult] = useState<OCCResult | null>(null);
  const [gapFillResult, setGapFillResult] = useState<GapFillResult | null>(null);
  const [nyGapResult, setNyGapResult] = useState<NYGapM15Result | null>(null);
  const [symbol, setSymbol] = useState("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [activeMode, setActiveMode] = useState<AnalysisMode>("ib");
  const [occTf, setOccTf] = useState("M15");
  const [momentumTf, setMomentumTf] = useState("M15");
  const [selectedRunId, setSelectedRunId] = useState<string | undefined>();
  const { runs: historyRuns, addRun, deleteRun } = useAnalysisHistory();

  const isFree = !isActive;

  const handleSelectRun = (run: AnalysisRun) => {
    setSelectedRunId(run.id);
  };

  const analysisContext = useMemo<AnalysisContext>(() => {
    if (activeMode === "ib" && result) {
      const hf = result.highFirst;
      const lf = result.lowFirst;
      const hfTotal = hf.total || 1;
      const lfTotal = lf.total || 1;
      return {
        mode: "ib",
        symbol,
        summary: `Symbol: ${symbol}\nTotal trading days: ${result.totalDays}, Inside days: ${result.insideDays}\n\nIB High Formed First (${hf.total} days):\n- Break High: ${hf.breakHigh} (${(hf.breakHigh / hfTotal * 100).toFixed(1)}%)\n- Break Low: ${hf.breakLow} (${(hf.breakLow / hfTotal * 100).toFixed(1)}%)\n- Inside: ${hf.inside} (${(hf.inside / hfTotal * 100).toFixed(1)}%)\n\nIB Low Formed First (${lf.total} days):\n- Break High: ${lf.breakHigh} (${(lf.breakHigh / lfTotal * 100).toFixed(1)}%)\n- Break Low: ${lf.breakLow} (${(lf.breakLow / lfTotal * 100).toFixed(1)}%)\n- Inside: ${lf.inside} (${(lf.inside / lfTotal * 100).toFixed(1)}%)`
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
        summary: `Symbol: ${symbol}\nTotal trading days: ${momentumResult.totalDays}\n\nHigh Formed First (${hf.total} days):\n- Bullish: ${hf.bullish} (${(hf.bullish / hfT * 100).toFixed(1)}%)\n- Bearish: ${hf.bearish} (${(hf.bearish / hfT * 100).toFixed(1)}%)\n- Choppy: ${hf.choppy} (${(hf.choppy / hfT * 100).toFixed(1)}%)\n\nLow Formed First (${lf.total} days):\n- Bullish: ${lf.bullish} (${(lf.bullish / lfT * 100).toFixed(1)}%)\n- Bearish: ${lf.bearish} (${(lf.bearish / lfT * 100).toFixed(1)}%)\n- Choppy: ${lf.choppy} (${(lf.choppy / lfT * 100).toFixed(1)}%)`
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
          summary += `\n${tf}:\n- Candle1 Bullish (${s.bullishFirst.total} days): Valid ${s.bullishFirst.valid} (${(s.bullishFirst.valid / bT * 100).toFixed(1)}%), Invalid ${s.bullishFirst.invalid} (${(s.bullishFirst.invalid / bT * 100).toFixed(1)}%)\n- Candle1 Bearish (${s.bearishFirst.total} days): Valid ${s.bearishFirst.valid} (${(s.bearishFirst.valid / brT * 100).toFixed(1)}%), Invalid ${s.bearishFirst.invalid} (${(s.bearishFirst.invalid / brT * 100).toFixed(1)}%)`;
        }
      }
      return { mode: "occ", symbol, summary };
    }
    if (activeMode === "gapfill" && gapFillResult) {
      const s = gapFillResult.stats;
      return {
        mode: "gapfill",
        symbol,
        summary: `Symbol: ${symbol}\nTotal gap days: ${gapFillResult.totalDays}\nOverall Fill Rate: ${s.overallFillRate.toFixed(1)}%\nGap Up Fill: ${s.gapUpFillRate.toFixed(1)}% (${s.filledGapUp}/${s.totalGapUp})\nGap Down Fill: ${s.gapDownFillRate.toFixed(1)}% (${s.filledGapDown}/${s.totalGapDown})\nBy Size: Small ${s.bySize.small.rate.toFixed(0)}%, Medium ${s.bySize.medium.rate.toFixed(0)}%, Large ${s.bySize.large.rate.toFixed(0)}%`
      };
    }
    return { mode: null, symbol: "", summary: "" };
  }, [activeMode, result, momentumResult, occResult, gapFillResult, symbol]);

  if (!authLoading && !user) {
    navigate("/auth");
    return null;
  }

  const fetchMarketData = async (ticker: string) => {
    const { data, error } = await supabase.functions.invoke("twelvedata-proxy", {
      body: { symbol: ticker }
    });
    if (error) throw new Error("Failed to fetch market data");
    return data;
  };

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
          totalDays: analysis.totalDays, insideDays: analysis.insideDays,
          ibWindow,
          highFirst: analysis.highFirst, lowFirst: analysis.lowFirst,
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

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background relative">
      <AIChatAssistant analysisContext={analysisContext} />
      
      {/* Background Video */}
      <video
        autoPlay loop muted playsInline
        className="fixed inset-0 w-full h-full object-cover opacity-20 z-0">
        <source src="/videos/hero-bg.mp4" type="video/mp4" />
      </video>
      <div className="fixed inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background z-0" />

      {/* Header - compact */}
      <header className="relative z-10 border-b border-border/40 px-3 sm:px-6 py-2 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-2 sm:gap-3">
          <img src={logo} alt="MyOpenEdge" className="h-7 w-7 rounded-full object-cover" />
          <h1 className="text-base font-bold text-foreground tracking-tight">MyOpenEdge</h1>
          <span className="text-xs text-muted-foreground ml-1 hidden sm:inline">IB & Momentum Analytics</span>
          {isActive ? (
            <div className="flex items-center gap-2 ml-1">
              <Badge variant="secondary" className="gap-1 text-[10px] bg-primary/15 text-primary border-primary/30">
                <Crown className="h-3 w-3" /> Pro
              </Badge>
              {endDate && (
                <span className="text-[10px] text-muted-foreground hidden sm:inline">
                  exp {new Date(endDate).toLocaleDateString()}
                </span>
              )}
            </div>
          ) : (
            <Badge
              variant="outline"
              className="gap-1 text-[10px] cursor-pointer hover:bg-primary/10"
              onClick={() => navigate("/upgrade")}>
              Free · Upgrade
            </Badge>
          )}
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => navigate("/daily-briefing")} className="gap-1 text-muted-foreground h-7 px-2">
              <Bot className="h-4 w-4" />
              <span className="hidden sm:inline text-xs">Daily AI</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/docs")} className="gap-1 text-muted-foreground h-7 px-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline text-xs">Docs</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut} className="gap-1 text-muted-foreground h-7 px-2">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline text-xs">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main content - fills remaining height, no scroll */}
      <main className="relative z-10 flex-1 min-h-0 p-2 sm:p-3">
        <div className="h-full grid grid-cols-1 lg:grid-cols-[260px_1fr_300px] gap-2 sm:gap-3">
          {/* Left: Control Panel */}
          <aside className="min-h-0 overflow-y-auto scrollbar-thin">
            <ControlPanel onRun={handleRun} loading={loading} isFree={isFree} />
          </aside>

          {/* Center: Results */}
          <section className="min-h-0 overflow-y-auto scrollbar-thin">
            {/* Empty state */}
            {!hasResults && !loading && (
              <div className="flex items-center justify-center h-full rounded-lg border border-dashed border-border/30">
                <div className="text-center">
                  <img src={logo} className="h-12 w-12 rounded-full object-cover mx-auto mb-3 opacity-40" alt="MyOpenEdge" />
                  <p className="text-muted-foreground text-xs">Powered by TwelveData API with 5000 bars of intraday data.</p>
                </div>
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div className="flex items-center justify-center h-full rounded-lg border border-border/20 bg-card/30">
                <div className="text-center space-y-2">
                  <div className="h-7 w-7 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-muted-foreground text-xs">Analyzing {symbol}…</p>
                </div>
              </div>
            )}

            {/* IB Mode */}
            {activeMode === "ib" && result && (
              <div className="h-full grid grid-rows-2 gap-2">
                {/* Top: Two IB charts - 50% height */}
                <div className="grid grid-cols-2 gap-2 min-h-0">
                  <IBChart
                    title="IB High Formed First"
                    total={result.highFirst.total}
                    breakHigh={result.highFirst.breakHigh}
                    breakLow={result.highFirst.breakLow}
                    inside={result.highFirst.inside} />
                  <IBChart
                    title="IB Low Formed First"
                    total={result.lowFirst.total}
                    breakHigh={result.lowFirst.breakHigh}
                    breakLow={result.lowFirst.breakLow}
                    inside={result.lowFirst.inside} />
                </div>
                {/* Bottom: Day chart - 50% height */}
                <div className="min-h-0 overflow-hidden">
                  {result.allDays.length > 0 && (() => {
                    const dayData = result.allDays.find((d) => d.date === selectedDate) || result.allDays[result.allDays.length - 1];
                    return (
                      <IBDayChart
                        date={dayData.date}
                        bars={dayData.bars}
                        ibHigh={dayData.ibHigh}
                        ibLow={dayData.ibLow}
                        symbol={symbol}
                        ibWindowMinutes={result.ibWindowMinutes}
                        highFirstFormed={dayData.highFirstFormed}
                        breakout={dayData.breakout}
                        availableDates={result.allDays.map((d) => d.date)}
                        selectedDate={selectedDate || dayData.date}
                        onDateChange={setSelectedDate}
                        statsHighFirst={result.highFirst}
                        statsLowFirst={result.lowFirst} />
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Momentum Mode */}
            {activeMode === "momentum" && momentumResult && (
              <div className="h-full flex flex-col gap-2">
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-muted-foreground">TF:</span>
                  {["M5", "M15", "M30", "H1"].map((tf) => (
                    <button
                      key={tf}
                      onClick={() => setMomentumTf(tf)}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                        momentumTf === tf
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}>
                      {tf}
                    </button>
                  ))}
                </div>
                <div className="flex-1 min-h-0 grid grid-rows-2 gap-2">
                  {momentumResult.tfStats[momentumTf] && (
                    <div className="grid grid-cols-2 gap-2 min-h-0">
                      <MomentumChart
                        title="IB High Formed First"
                        total={momentumResult.tfStats[momentumTf].highFirst.total}
                        bullish={momentumResult.tfStats[momentumTf].highFirst.bullish}
                        bearish={momentumResult.tfStats[momentumTf].highFirst.bearish}
                        choppy={momentumResult.tfStats[momentumTf].highFirst.choppy} />
                      <MomentumChart
                        title="IB Low Formed First"
                        total={momentumResult.tfStats[momentumTf].lowFirst.total}
                        bullish={momentumResult.tfStats[momentumTf].lowFirst.bullish}
                        bearish={momentumResult.tfStats[momentumTf].lowFirst.bearish}
                        choppy={momentumResult.tfStats[momentumTf].lowFirst.choppy} />
                    </div>
                  )}
                  <div className="min-h-0 overflow-hidden">
                    {momentumResult.allDays.length > 0 && (() => {
                      const dayData = momentumResult.allDays.find((d) => d.date === selectedDate) || momentumResult.allDays[momentumResult.allDays.length - 1];
                      const tfData = dayData.timeframes.find(t => t.tf === momentumTf);
                      const tfStatsHF = momentumResult.tfStats[momentumTf]?.highFirst || { total: 0, bullish: 0, bearish: 0, choppy: 0 };
                      const tfStatsLF = momentumResult.tfStats[momentumTf]?.lowFirst || { total: 0, bullish: 0, bearish: 0, choppy: 0 };
                      return (
                        <MomentumDayChart
                          date={dayData.date}
                          bars={dayData.bars}
                          symbol={symbol}
                          momentum={tfData?.momentum || dayData.momentum}
                          signals={tfData?.signals || dayData.signals}
                          availableDates={momentumResult.allDays.map((d) => d.date)}
                          selectedDate={selectedDate || dayData.date}
                          onDateChange={setSelectedDate}
                          statsHighFirst={tfStatsHF}
                          statsLowFirst={tfStatsLF}
                          highFirstFormed={dayData.highFirstFormed}
                          selectedTf={momentumTf} />
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}

            {/* OCC Mode */}
            {activeMode === "occ" && occResult && (
              <div className="h-full flex flex-col gap-2">
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-muted-foreground">TF:</span>
                  {["M5", "M15", "M30", "H1"].map((tf) => (
                    <button
                      key={tf}
                      onClick={() => setOccTf(tf)}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                        occTf === tf
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}>
                      {tf}
                    </button>
                  ))}
                </div>
                <div className="flex-1 min-h-0 grid grid-rows-2 gap-2">
                  {occResult.tfDirectionStats[occTf] && (
                    <div className="grid grid-cols-2 gap-2 min-h-0">
                      <OCCChart
                        title="Candle 1 Bullish"
                        stats={occResult.tfDirectionStats[occTf].bullishFirst}
                        color="emerald" />
                      <OCCChart
                        title="Candle 1 Bearish"
                        stats={occResult.tfDirectionStats[occTf].bearishFirst}
                        color="red" />
                    </div>
                  )}
                  <div className="min-h-0 overflow-hidden">
                    {occResult.allDays.length > 0 && (() => {
                      const dayData = occResult.allDays.find((d) => d.date === selectedDate) || occResult.allDays[occResult.allDays.length - 1];
                      return (
                        <OCCDayChart
                          date={dayData.date}
                          bars={dayData.bars}
                          symbol={symbol}
                          timeframes={dayData.timeframes}
                          overallBias={dayData.overallBias}
                          availableDates={occResult.allDays.map((d) => d.date)}
                          selectedDate={selectedDate || dayData.date}
                          onDateChange={setSelectedDate}
                          tfDirectionStats={occResult.tfDirectionStats} />
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}

            {/* Gap Fill Mode */}
            {activeMode === "gapfill" && gapFillResult && (
              <div className="h-full overflow-y-auto">
                <GapFillDashboard result={gapFillResult} symbol={symbol} />
              </div>
            )}
          </section>

          {/* Right: Report History */}
          <aside className="hidden lg:flex min-h-0">
            <AnalysisHistory
              runs={historyRuns.slice(0, 10)}
              onDelete={deleteRun}
              onSelect={handleSelectRun}
              selectedId={selectedRunId} />
          </aside>
        </div>
      </main>
    </div>
  );
};

export default Index;
