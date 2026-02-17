import { useState } from "react";
import { toast } from "sonner";
import { TrendingUp } from "lucide-react";
import ControlPanel from "@/components/ControlPanel";
import IBChart from "@/components/IBChart";
import IBDayChart from "@/components/IBDayChart";
import SummaryTable from "@/components/SummaryTable";
import { analyzeIB, type AnalysisResult } from "@/lib/ib-analysis";

const Index = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [symbol, setSymbol] = useState("");

  const handleRun = async (apiKey: string, ticker: string, ibWindow: number, maxDays: number) => {
    setLoading(true);
    setResult(null);
    setSymbol(ticker);

    try {
      const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(ticker)}&interval=5min&outputsize=5000&apikey=${encodeURIComponent(apiKey)}&format=JSON&timezone=America/New_York`;
      const res = await fetch(url);
      const json = await res.json();

      if (json.status === "error") {
        toast.error(json.message || "API error");
        return;
      }

      if (!json.values || json.values.length === 0) {
        toast.error("No data returned. Check ticker symbol.");
        return;
      }

      const analysis = analyzeIB(json.values, ibWindow, maxDays);

      if (analysis.totalDays === 0) {
        toast.error("Not enough trading days in the data to analyze.");
        return;
      }

      setResult(analysis);
      toast.success(`Analyzed ${analysis.totalDays + analysis.insideDays} trading days for ${ticker}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <TrendingUp className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold text-foreground tracking-tight">
            MyOpenEdge
          </h1>
          <span className="text-xs text-muted-foreground ml-1">Auction Market Theory</span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-8">
          <aside>
            <ControlPanel onRun={handleRun} loading={loading} />
          </aside>

          <section>
            {!result && !loading && (
              <div className="flex items-center justify-center h-[400px] rounded-lg border border-dashed border-border">
                <div className="text-center">
                  <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-40" />
                  <p className="text-muted-foreground text-sm">
                    Enter your API key and ticker to begin analysis
                  </p>
                </div>
              </div>
            )}

            {loading && (
              <div className="flex items-center justify-center h-[400px] rounded-lg border border-border bg-card">
                <div className="text-center space-y-3">
                  <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-muted-foreground text-sm">
                    Fetching & analyzing {symbol} data…
                  </p>
                </div>
              </div>
            )}

            {result && (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row gap-6">
                  <IBChart
                    title="IB High Formed First"
                    total={result.highFirst.total}
                    breakHigh={result.highFirst.breakHigh}
                    breakLow={result.highFirst.breakLow}
                  />
                  <IBChart
                    title="IB Low Formed First"
                    total={result.lowFirst.total}
                    breakHigh={result.lowFirst.breakHigh}
                    breakLow={result.lowFirst.breakLow}
                  />
                </div>
                <SummaryTable result={result} symbol={symbol} />
                {result.lastDay && (
                  <IBDayChart
                    date={result.lastDay.date}
                    bars={result.lastDay.bars}
                    ibHigh={result.lastDay.ibHigh}
                    ibLow={result.lastDay.ibLow}
                    symbol={symbol}
                    ibWindowMinutes={result.ibWindowMinutes}
                    highFirstFormed={result.lastDay.highFirstFormed}
                    breakout={result.lastDay.breakout}
                  />
                )}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};

export default Index;
