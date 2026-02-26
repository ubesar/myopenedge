import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut, Crown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import logo from "@/assets/logo10.jpg";
import ControlPanel, { type AnalysisMode } from "@/components/ControlPanel";
import IBChart from "@/components/IBChart";
import IBDayChart from "@/components/IBDayChart";
import SummaryTable from "@/components/SummaryTable";
import MomentumChart from "@/components/MomentumChart";
import MomentumDayChart from "@/components/MomentumDayChart";
import OCCChart from "@/components/OCCChart";
import OCCDayChart from "@/components/OCCDayChart";
import AIChatAssistant from "@/components/AIChatAssistant";
import { analyzeIB, type AnalysisResult } from "@/lib/ib-analysis";
import { analyzeMomentum, type MomentumResult } from "@/lib/momentum-analysis";
import { analyzeOCC, type OCCResult } from "@/lib/occ-analysis";
import { useSubscription } from "@/hooks/useSubscription";
import ApiKeyDialog from "@/components/ApiKeyDialog";
import { z } from "zod";

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

const Index = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { isActive, endDate, loading: subLoading } = useSubscription();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [momentumResult, setMomentumResult] = useState<MomentumResult | null>(null);
  const [occResult, setOccResult] = useState<OCCResult | null>(null);
  const [symbol, setSymbol] = useState("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [activeMode, setActiveMode] = useState<AnalysisMode>("ib");
  const [occTf, setOccTf] = useState("M15");

  const isFree = !isActive;


  // Redirect if not authenticated
  if (!authLoading && !user) {
    navigate("/auth");
    return null;
  }

  const handleRun = async (apiKey: string, ticker: string, ibWindow: number, maxDays: number, mode: AnalysisMode) => {
    setLoading(true);
    setResult(null);
    setMomentumResult(null);
    setOccResult(null);
    setSymbol(ticker);
    setActiveMode(mode);

    try {
      const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(ticker)}&interval=5min&outputsize=5000&apikey=${encodeURIComponent(apiKey)}&format=JSON&timezone=America/New_York`;
      const res = await fetch(url);
      const json = await res.json();

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
        toast.success(`Analyzed ${analysis.highFirst.total + analysis.lowFirst.total} trading days for ${ticker}`);
      } else if (mode === "momentum") {
        const analysis = analyzeMomentum(values as any, ibWindow, maxDays);
        if (analysis.totalDays === 0) {
          toast.error("Not enough trading days in the data to analyze.");
          return;
        }
        setMomentumResult(analysis);
        setSelectedDate(analysis.lastDay?.date || "");
        toast.success(`Momentum analysis: ${analysis.totalDays} trading days for ${ticker}`);
      } else {
        // OCC mode
        const analysis = analyzeOCC(values as any, maxDays);
        if (analysis.totalDays === 0) {
          toast.error("Not enough trading days in the data to analyze.");
          return;
        }
        setOccResult(analysis);
        setSelectedDate(analysis.lastDay?.date || "");
        
        toast.success(`OCC analysis: ${analysis.totalDays} trading days for ${ticker}`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative">
      <AIChatAssistant />
      <ApiKeyDialog />
      {/* Background Video */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="fixed inset-0 w-full h-full object-cover opacity-20 z-0">

        <source src="/videos/hero-bg.mp4" type="video/mp4" />
      </video>
      <div className="fixed inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background z-0" />

      <header className="relative z-10 border-b border-border/40 px-3 sm:px-6 py-3 sm:py-4 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex items-center gap-2 sm:gap-3 flex-wrap">
          <img src={logo} alt="MyOpenEdge" className="h-7 w-7 sm:h-8 sm:w-8 rounded-full object-cover" />
          <h1 className="text-base sm:text-xl font-bold text-foreground tracking-tight">MyOpenEdge</h1>
          <span className="text-xs text-muted-foreground ml-1 hidden sm:inline">​IB & Momentum Analytics</span>
          {isActive ? (
            <div className="flex items-center gap-2 ml-1 sm:ml-2">
              <Badge variant="secondary" className="gap-1 text-[10px] sm:text-xs bg-primary/15 text-primary border-primary/30">
                <Crown className="h-3 w-3" /> Pro
              </Badge>
              {endDate && (
                <span className="text-[10px] sm:text-xs text-muted-foreground hidden sm:inline">
                  exp {new Date(endDate).toLocaleDateString()}
                </span>
              )}
            </div>
          ) : (
            <Badge
              variant="outline"
              className="gap-1 text-[10px] sm:text-xs cursor-pointer hover:bg-primary/10"
              onClick={() => navigate("/upgrade")}
            >
              Free · Upgrade
            </Badge>
          )}
          <div className="ml-auto">
            <Button variant="ghost" size="sm" onClick={signOut} className="gap-1 sm:gap-2 text-muted-foreground h-8 px-2 sm:px-3">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-4">
        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-3 sm:gap-5">
          <aside>
            <ControlPanel onRun={handleRun} loading={loading} isFree={isFree} />
          </aside>

          <section>
            {!result && !momentumResult && !occResult && !loading &&
            <div className="flex items-center justify-center h-[400px] rounded-lg border border-dashed border-border">
                <div className="text-center">
                  <img src={logo} className="h-12 w-12 rounded-full object-cover mx-auto mb-4 opacity-40" alt="MyOpenEdge" />
                  <p className="text-muted-foreground text-sm">Sign up for free at twelvedata.com and enter your API key.





                </p>
                </div>
              </div>}

            {loading && <div className="flex items-center justify-center h-[400px] rounded-lg border border-border bg-card">
                <div className="text-center space-y-3">
                  <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-muted-foreground text-sm">
                    Fetching & analyzing {symbol} data…
                  </p>
                </div>
              </div>}

            {/* IB Mode Results */}
            {activeMode === "ib" && result && <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                <SummaryTable result={result} symbol={symbol} />
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
                    onDateChange={setSelectedDate} />);


              })()}
              </div>
            }

            {/* Momentum Mode Results */}
            {activeMode === "momentum" && momentumResult &&
            <div className="space-y-3">
                <div className="text-center space-y-1">
                  
                  


                  


                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <MomentumChart
                  title="IB High Formed First"
                  total={momentumResult.highFirst.total}
                  bullish={momentumResult.highFirst.bullish}
                  bearish={momentumResult.highFirst.bearish}
                  choppy={momentumResult.highFirst.choppy} />

                  <MomentumChart
                  title="IB Low Formed First"
                  total={momentumResult.lowFirst.total}
                  bullish={momentumResult.lowFirst.bullish}
                  bearish={momentumResult.lowFirst.bearish}
                  choppy={momentumResult.lowFirst.choppy} />

                </div>
                {momentumResult.allDays.length > 0 && (() => {
                const dayData = momentumResult.allDays.find((d) => d.date === selectedDate) || momentumResult.allDays[momentumResult.allDays.length - 1];
                return (
                  <MomentumDayChart
                    date={dayData.date}
                    bars={dayData.bars}
                    symbol={symbol}
                    momentum={dayData.momentum}
                    signals={dayData.signals}
                    availableDates={momentumResult.allDays.map((d) => d.date)}
                    selectedDate={selectedDate || dayData.date}
                    onDateChange={setSelectedDate} />);


              })()}
              </div>
            }

            {/* OCC Mode Results */}
            {activeMode === "occ" && occResult &&
            <div className="space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-muted-foreground">Timeframe:</span>
                  {["M5", "M15", "M30", "H1"].map((tf) => (
                    <button
                      key={tf}
                      onClick={() => setOccTf(tf)}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                        occTf === tf
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
                {occResult.tfDirectionStats[occTf] && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <OCCChart
                      title="Candle 1 Bullish"
                      stats={occResult.tfDirectionStats[occTf].bullishFirst}
                      color="emerald"
                    />
                    <OCCChart
                      title="Candle 1 Bearish"
                      stats={occResult.tfDirectionStats[occTf].bearishFirst}
                      color="red"
                    />
                  </div>
                )}
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
                    />
                  );
                })()}
              </div>
            }
          </section>
        </div>
      </main>
    </div>);

};

export default Index;