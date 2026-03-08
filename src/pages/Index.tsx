import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Bookmark, Loader2 } from "lucide-react";
import logo from "@/assets/logo.png";
import { type AnalysisMode } from "@/components/ControlPanel";
import AppNavSidebar from "@/components/AppNavSidebar";
import ParameterPanel from "@/components/ParameterPanel";
import RightSidebar from "@/components/RightSidebar";
import ChartCard from "@/components/ChartCard";
import IBDayChart from "@/components/IBDayChart";
import { useAnalysisHistory, type AnalysisRun } from "@/hooks/useAnalysisHistory";
import MomentumChart from "@/components/MomentumChart";
import MomentumDayChart from "@/components/MomentumDayChart";
import OCCChart from "@/components/OCCChart";
import OCCDayChart from "@/components/OCCDayChart";
import AIChatAssistant, { type AnalysisContext } from "@/components/AIChatAssistant";
import { analyzeIB, type AnalysisResult } from "@/lib/ib-analysis";
import { analyzeMomentum, type MomentumResult } from "@/lib/momentum-analysis";
import { analyzeOCC, type OCCResult } from "@/lib/occ-analysis";
import { analyzeGapFill, type GapFillResult } from "@/lib/gapfill-analysis";
import GapFillDashboard from "@/components/GapFillDashboard";
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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
        mode: "ib", symbol,
        summary: `Symbol: ${symbol}\nTotal: ${result.totalDays}, Inside: ${result.insideDays}\nHF(${hf.total}): BH ${(hf.breakHigh/hfTotal*100).toFixed(1)}% BL ${(hf.breakLow/hfTotal*100).toFixed(1)}% In ${(hf.inside/hfTotal*100).toFixed(1)}%\nLF(${lf.total}): BH ${(lf.breakHigh/lfTotal*100).toFixed(1)}% BL ${(lf.breakLow/lfTotal*100).toFixed(1)}% In ${(lf.inside/lfTotal*100).toFixed(1)}%`
      };
    }
    if (activeMode === "momentum" && momentumResult) {
      return { mode: "momentum", symbol, summary: `Momentum analysis for ${symbol}, ${momentumResult.totalDays} days` };
    }
    if (activeMode === "occ" && occResult) {
      return { mode: "occ", symbol, summary: `OCC analysis for ${symbol}, ${occResult.totalDays} days` };
    }
    if (activeMode === "gapfill" && gapFillResult) {
      return { mode: "gapfill", symbol, summary: `Gap Fill for ${symbol}, ${gapFillResult.totalDays} days` };
    }
    return { mode: null, symbol: "", summary: "" };
  }, [activeMode, result, momentumResult, occResult, gapFillResult, symbol]);

  if (!authLoading && !user) {
    return <Navigate to="/auth" replace />;
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
      if (json.status === "error") { toast.error(json.message || "API error"); return; }
      const parsed = TwelveDataResponseSchema.safeParse(json);
      if (!parsed.success) { toast.error("Invalid or empty data returned."); return; }
      const values = parsed.data.values;

      if (mode === "ib") {
        const analysis = analyzeIB(values as any, ibWindow, maxDays);
        if (analysis.totalDays === 0) { toast.error("Not enough data."); return; }
        setResult(analysis);
        setSelectedDate(analysis.lastDay?.date || "");
        addRun(mode, ticker, { totalDays: analysis.totalDays, insideDays: analysis.insideDays, ibWindow, highFirst: analysis.highFirst, lowFirst: analysis.lowFirst });
      } else if (mode === "momentum") {
        const analysis = analyzeMomentum(values as any, ibWindow, maxDays);
        if (analysis.totalDays === 0) { toast.error("Not enough data."); return; }
        setMomentumResult(analysis);
        setSelectedDate(analysis.lastDay?.date || "");
        addRun(mode, ticker, { totalDays: analysis.totalDays, tfStats: analysis.tfStats });
      } else if (mode === "occ") {
        const analysis = analyzeOCC(values as any, maxDays);
        if (analysis.totalDays === 0) { toast.error("Not enough data."); return; }
        setOccResult(analysis);
        setSelectedDate(analysis.lastDay?.date || "");
        addRun(mode, ticker, { totalDays: analysis.totalDays, tfDirectionStats: analysis.tfDirectionStats });
      } else if (mode === "gapfill") {
        const analysis = analyzeGapFill(values as any, maxDays);
        if (analysis.totalDays === 0) { toast.error("Not enough data."); return; }
        setGapFillResult(analysis);
        setSelectedDate(analysis.lastDay?.date || "");
        addRun(mode, ticker, { totalDays: analysis.totalDays, stats: analysis.stats });
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const hasResults = result || momentumResult || occResult || gapFillResult;

  // Build report title
  const reportTitle = hasResults
    ? `${symbol.toLowerCase()} ${activeMode === "ib" ? "initial balance breakout by rejection report" : activeMode === "momentum" ? "momentum candle report" : activeMode === "occ" ? "opening candle continuation report" : "gap fill statistics report"}`
    : "";

  return (
    <div className="h-screen w-full flex overflow-hidden bg-background">
      <AIChatAssistant analysisContext={analysisContext} />

      {/* Column 1: Nav Sidebar */}
      <AppNavSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

      {/* Column 2: Parameter Panel */}
      <ParameterPanel onRun={handleRun} loading={loading} isFree={isFree} />

      {/* Column 3: Main Content */}
      <main className="flex-1 min-w-0 overflow-y-auto p-6">
        {/* Header row */}
        {hasResults && (
          <div className="flex items-center gap-3 mb-5">
            <h2 className="text-[15px] text-foreground font-medium">{reportTitle}</h2>
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

        {/* IB Results */}
        {activeMode === "ib" && result && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <ChartCard
                title="IB high formed first"
                subtitle={`${symbol} · by rejection`}
                totalDays={result.highFirst.total}
                bars={[
                  { name: "first break IB high", value: result.highFirst.total > 0 ? (result.highFirst.breakHigh / result.highFirst.total * 100) : 0, color: "primary" },
                  { name: "first break IB low", value: result.highFirst.total > 0 ? (result.highFirst.breakLow / result.highFirst.total * 100) : 0, color: "muted" },
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
                ]}
              />
              <ChartCard
                title="IB low formed first"
                subtitle={`${symbol} · by rejection`}
                totalDays={result.lowFirst.total}
                bars={[
                  { name: "first break IB high", value: result.lowFirst.total > 0 ? (result.lowFirst.breakHigh / result.lowFirst.total * 100) : 0, color: "primary" },
                  { name: "first break IB low", value: result.lowFirst.total > 0 ? (result.lowFirst.breakLow / result.lowFirst.total * 100) : 0, color: "muted" },
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
                ]}
              />
            </div>
            {/* Day chart */}
            {result.allDays.length > 0 && (() => {
              const dayData = result.allDays.find((d) => d.date === selectedDate) || result.allDays[result.allDays.length - 1];
              return (
                <div className="bg-card border border-border rounded-xl p-4">
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
                    statsLowFirst={result.lowFirst}
                  />
                </div>
              );
            })()}
          </div>
        )}

        {/* Momentum Results */}
        {activeMode === "momentum" && momentumResult && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">timeframe:</span>
              {["M5", "M15", "M30", "H1"].map((tf) => (
                <button
                  key={tf}
                  onClick={() => setMomentumTf(tf)}
                  className={`px-3 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                    momentumTf === tf ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
            {momentumResult.tfStats[momentumTf] && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <MomentumChart title="IB High Formed First" total={momentumResult.tfStats[momentumTf].highFirst.total} bullish={momentumResult.tfStats[momentumTf].highFirst.bullish} bearish={momentumResult.tfStats[momentumTf].highFirst.bearish} choppy={momentumResult.tfStats[momentumTf].highFirst.choppy} />
                <MomentumChart title="IB Low Formed First" total={momentumResult.tfStats[momentumTf].lowFirst.total} bullish={momentumResult.tfStats[momentumTf].lowFirst.bullish} bearish={momentumResult.tfStats[momentumTf].lowFirst.bearish} choppy={momentumResult.tfStats[momentumTf].lowFirst.choppy} />
              </div>
            )}
            {momentumResult.allDays.length > 0 && (() => {
              const dayData = momentumResult.allDays.find((d) => d.date === selectedDate) || momentumResult.allDays[momentumResult.allDays.length - 1];
              const tfData = dayData.timeframes.find(t => t.tf === momentumTf);
              const tfStatsHF = momentumResult.tfStats[momentumTf]?.highFirst || { total: 0, bullish: 0, bearish: 0, choppy: 0 };
              const tfStatsLF = momentumResult.tfStats[momentumTf]?.lowFirst || { total: 0, bullish: 0, bearish: 0, choppy: 0 };
              return (
                <div className="bg-card border border-border rounded-xl p-4">
                  <MomentumDayChart date={dayData.date} bars={dayData.bars} symbol={symbol} momentum={tfData?.momentum || dayData.momentum} signals={tfData?.signals || dayData.signals} availableDates={momentumResult.allDays.map((d) => d.date)} selectedDate={selectedDate || dayData.date} onDateChange={setSelectedDate} statsHighFirst={tfStatsHF} statsLowFirst={tfStatsLF} highFirstFormed={dayData.highFirstFormed} selectedTf={momentumTf} />
                </div>
              );
            })()}
          </div>
        )}

        {/* OCC Results */}
        {activeMode === "occ" && occResult && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">timeframe:</span>
              {["M5", "M15", "M30", "H1"].map((tf) => (
                <button
                  key={tf}
                  onClick={() => setOccTf(tf)}
                  className={`px-3 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                    occTf === tf ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
            {occResult.tfDirectionStats[occTf] && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <OCCChart title="Candle 1 Bullish" stats={occResult.tfDirectionStats[occTf].bullishFirst} color="emerald" />
                <OCCChart title="Candle 1 Bearish" stats={occResult.tfDirectionStats[occTf].bearishFirst} color="red" />
              </div>
            )}
            {occResult.allDays.length > 0 && (() => {
              const dayData = occResult.allDays.find((d) => d.date === selectedDate) || occResult.allDays[occResult.allDays.length - 1];
              return (
                <div className="bg-card border border-border rounded-xl p-4">
                  <OCCDayChart date={dayData.date} bars={dayData.bars} symbol={symbol} timeframes={dayData.timeframes} overallBias={dayData.overallBias} availableDates={occResult.allDays.map((d) => d.date)} selectedDate={selectedDate || dayData.date} onDateChange={setSelectedDate} tfDirectionStats={occResult.tfDirectionStats} />
                </div>
              );
            })()}
          </div>
        )}

        {/* Gap Fill Results */}
        {activeMode === "gapfill" && gapFillResult && (
          <GapFillDashboard result={gapFillResult} symbol={symbol} />
        )}
      </main>

      {/* Column 4: Right Sidebar */}
      <RightSidebar
        runs={historyRuns.slice(0, 10)}
        onDelete={deleteRun}
        onSelect={handleSelectRun}
        selectedId={selectedRunId}
      />
    </div>
  );
};

export default Index;
