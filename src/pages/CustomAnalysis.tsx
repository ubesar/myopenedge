import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, Send, Loader2, TrendingUp, TrendingDown, Target, BarChart3,
  Trophy, Flame, DollarSign, Activity, Zap, Brain,
} from "lucide-react";
import { analyzeIB } from "@/lib/ib-analysis";
import { analyzeMomentum } from "@/lib/momentum-analysis";
import { analyzeOCC } from "@/lib/occ-analysis";
import { analyzeGapFill } from "@/lib/gapfill-analysis";
import { analyzeNYGapM15 } from "@/lib/nygap-m15-analysis";
import { z } from "zod";
import ReactMarkdown from "react-markdown";
import logo from "@/assets/logo.png";

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

const DAY_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

interface DailyRecord {
  date: string;
  day_of_week: string;
  prev_close: number;
  ny_open: number;
  m15_close: number;
  gap_type: string;
  gap_pct: number;
  gap_filled: boolean;
  ib_high: number;
  ib_low: number;
  ib_high_first: boolean;
  ib_breakout: string;
  momentum: string;
  occ_bias: string;
  m15_direction: string;
  session_high: number;
  session_low: number;
}

interface AnalysisResponse {
  analysis_title: string;
  filters: Record<string, unknown>;
  metrics: {
    total_trades: number;
    wins: number;
    losses: number;
    win_rate: number;
    profit_factor: number;
    expectancy_usd: number;
    avg_win_usd: number;
    avg_loss_usd: number;
    total_pnl_usd: number;
    max_consecutive_wins: number;
    max_consecutive_losses: number;
    sample_size: number;
    win_condition: string;
  };
  day_distribution: Record<string, { total: number; wins: number }>;
  insight: string;
  needs_clarification: boolean;
  follow_up_options: { field: string; label: string; options: string[] }[];
  filtered_dates: { date: string; gap_type: string; gap_pct: number; m15_direction: string; is_win: boolean; pnl: number }[];
}

const SUGGESTION_PROMPTS = [
  "tampilkan win rate gap fill jika m15 pertama bearish saat gap up",
  "probabilitas ib break high saat momentum bullish",
  "filter gap down > 0.5% yang gap filled, hari senin-rabu",
  "win rate strategi fade gap saat occ bias failed",
];

const DAY_OPTIONS = [
  { value: "0", label: "all days" },
  { value: "30", label: "last 30 days" },
  { value: "60", label: "last 60 days" },
  { value: "120", label: "last 120 days" },
  { value: "365", label: "last 12 months" },
];

const CustomAnalysis = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [symbol, setSymbol] = useState("QQQ");
  const [maxDays, setMaxDays] = useState("120");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(false);
  const [dailyData, setDailyData] = useState<DailyRecord[]>([]);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [dataSymbol, setDataSymbol] = useState("");
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (result && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [result]);

  const fetchAndBuildData = async () => {
    if (dataSymbol === symbol.trim().toUpperCase() && dailyData.length > 0) return dailyData;

    setFetchingData(true);
    try {
      const { data: json, error } = await supabase.functions.invoke("twelvedata-proxy", {
        body: { symbol: symbol.trim().toUpperCase() },
      });
      if (error) throw new Error("failed to fetch market data");

      const parsed = TwelveDataResponseSchema.safeParse(json);
      if (!parsed.success) throw new Error("invalid data returned. check ticker symbol.");

      const bars = parsed.data.values;

      // run all analyses
      const ibResult = analyzeIB(bars as any, 60, parseInt(maxDays));
      const momentumResult = analyzeMomentum(bars as any, 60, parseInt(maxDays));
      const occResult = analyzeOCC(bars as any, parseInt(maxDays));
      const gapFillResult = analyzeGapFill(bars as any, parseInt(maxDays));
      const nygapResult = analyzeNYGapM15(bars as any, parseInt(maxDays));

      // build consolidated daily records
      const dateMap = new Map<string, DailyRecord>();

      // seed from nygap (has gap data)
      for (const day of nygapResult.allDays) {
        dateMap.set(day.date, {
          date: day.date,
          day_of_week: DAY_NAMES[day.dayOfWeek],
          prev_close: day.prevClose,
          ny_open: day.nyOpen,
          m15_close: day.m15Close,
          gap_type: day.gapType === "Gap Up" ? "up" : "down",
          gap_pct: Math.round(Math.abs(day.gapPercent) * 100) / 100,
          gap_filled: false,
          ib_high: 0,
          ib_low: 0,
          ib_high_first: false,
          ib_breakout: "inside",
          momentum: "choppy",
          occ_bias: "failed",
          m15_direction: day.m15Direction.toLowerCase(),
          session_high: 0,
          session_low: 0,
        });
      }

      // merge gap fill data
      for (const day of gapFillResult.allDays) {
        const rec = dateMap.get(day.date);
        if (rec) {
          rec.gap_filled = day.filled;
          rec.session_high = day.sessionHigh;
          rec.session_low = day.sessionLow;
        }
      }

      // merge ib data
      for (const day of ibResult.allDays) {
        const rec = dateMap.get(day.date);
        if (rec) {
          rec.ib_high = day.ibHigh;
          rec.ib_low = day.ibLow;
          rec.ib_high_first = day.highFirstFormed;
          rec.ib_breakout = day.breakout;
        }
      }

      // merge momentum data
      for (const day of momentumResult.allDays) {
        const rec = dateMap.get(day.date);
        if (rec) {
          rec.momentum = day.momentum;
        }
      }

      // merge occ data
      for (const day of occResult.allDays) {
        const rec = dateMap.get(day.date);
        if (rec) {
          rec.occ_bias = day.overallBias;
        }
      }

      const consolidated = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
      setDailyData(consolidated);
      setDataSymbol(symbol.trim().toUpperCase());
      return consolidated;
    } finally {
      setFetchingData(false);
    }
  };

  const handleSubmit = async (queryText?: string) => {
    const q = (queryText || query).trim();
    if (!q || loading) return;

    setLoading(true);
    setResult(null);

    try {
      const data = await fetchAndBuildData();
      if (!data || data.length === 0) {
        toast.error("no trading data available for this symbol");
        return;
      }

      const { data: response, error } = await supabase.functions.invoke("custom-ai-analysis", {
        body: {
          query: q,
          dailyData: data,
          symbol: symbol.trim().toUpperCase(),
        },
      });

      if (error) throw new Error("analysis request failed");
      if (response?.error) {
        toast.error(response.error);
        return;
      }

      setResult(response as AnalysisResponse);
    } catch (err: any) {
      toast.error(err.message || "failed to run custom analysis");
    } finally {
      setLoading(false);
    }
  };

  const handleFollowUp = (field: string, value: string) => {
    const newQuery = `${query} → ${field}: ${value}`;
    setQuery(newQuery);
    handleSubmit(newQuery);
  };

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* header */}
      <header className="border-b border-border/40 px-4 py-3 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/app")} className="gap-1 text-muted-foreground h-8 px-2">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-xs">back</span>
          </Button>
          <img src={logo} alt="myopenedge" className="h-6 w-6 rounded-full object-cover" />
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            <h1 className="text-sm font-bold tracking-tight">custom ai analysis</h1>
          </div>
          <span className="text-[10px] text-muted-foreground hidden sm:inline">natural language trading edge finder</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* input section */}
        <div className="rounded-xl border border-border/30 bg-card/60 backdrop-blur-md p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold">describe your trading edge</span>
          </div>

          {/* controls row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">ticker</label>
              <Input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder="QQQ"
                className="h-8 text-xs bg-muted border-border uppercase"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">period</label>
              <Select value={maxDays} onValueChange={setMaxDays}>
                <SelectTrigger className="h-8 text-xs bg-muted border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAY_OPTIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* query input */}
          <div className="space-y-2">
            <Textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="contoh: tampilkan win rate strategi gap fill jika candle 15m pertama ditutup searah dengan arah gap..."
              className="min-h-[80px] text-sm bg-muted/50 border-border/30 resize-none placeholder:text-muted-foreground/60"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
            <div className="flex items-center justify-between">
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTION_PROMPTS.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => { setQuery(prompt); handleSubmit(prompt); }}
                    className="px-2.5 py-1 rounded-full border border-border/40 bg-muted/30 hover:bg-muted/60 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {prompt.slice(0, 40)}{prompt.length > 40 ? "…" : ""}
                  </button>
                ))}
              </div>
              <Button
                onClick={() => handleSubmit()}
                disabled={loading || fetchingData || !query.trim()}
                size="sm"
                className="gap-1.5 h-8"
              >
                {loading || fetchingData ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> analyzing…</>
                ) : (
                  <><Send className="h-3.5 w-3.5" /> analyze</>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* loading state */}
        {(loading || fetchingData) && (
          <div className="rounded-xl border border-border/20 bg-card/30 p-8 flex flex-col items-center gap-3">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-muted-foreground">
              {fetchingData ? "fetching market data…" : "ai is analyzing your query…"}
            </p>
          </div>
        )}

        {/* results dashboard */}
        {result && !loading && (
          <div ref={resultRef} className="space-y-4">
            {/* title & insight */}
            <div className="rounded-xl border border-border/30 bg-card/60 backdrop-blur-md p-5">
              <div className="flex items-center gap-2 mb-2">
                <Brain className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-bold">{result.analysis_title}</h2>
                <span className="text-[10px] text-muted-foreground ml-auto">
                  {result.metrics.total_trades} trades · {result.metrics.sample_size} days scanned
                </span>
              </div>
              <div className="text-xs text-muted-foreground leading-relaxed prose prose-sm prose-invert max-w-none">
                <ReactMarkdown>{result.insight}</ReactMarkdown>
              </div>
              {/* applied filters */}
              <div className="flex flex-wrap gap-1.5 mt-3">
                {Object.entries(result.filters).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => (
                  <span key={k} className="px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[10px] text-primary">
                    {k}: {String(v)}
                  </span>
                ))}
              </div>
            </div>

            {/* metric cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              <MetricCard icon={Trophy} label="win rate" value={`${result.metrics.win_rate}%`}
                color={result.metrics.win_rate >= 50 ? "text-[hsl(var(--profit))]" : "text-[hsl(var(--loss))]"} />
              <MetricCard icon={Target} label="profit factor" value={`${result.metrics.profit_factor}`}
                color={result.metrics.profit_factor >= 1 ? "text-[hsl(var(--profit))]" : "text-[hsl(var(--loss))]"} />
              <MetricCard icon={DollarSign} label="expectancy" value={`$${result.metrics.expectancy_usd}`}
                color={result.metrics.expectancy_usd >= 0 ? "text-[hsl(var(--profit))]" : "text-[hsl(var(--loss))]"} />
              <MetricCard icon={TrendingUp} label="avg win" value={`$${result.metrics.avg_win_usd}`} color="text-[hsl(var(--profit))]" />
              <MetricCard icon={TrendingDown} label="avg loss" value={`$${result.metrics.avg_loss_usd}`} color="text-[hsl(var(--loss))]" />
              <MetricCard icon={Activity} label="total pnl" value={`$${result.metrics.total_pnl_usd}`}
                color={result.metrics.total_pnl_usd >= 0 ? "text-[hsl(var(--profit))]" : "text-[hsl(var(--loss))]"} />
            </div>

            {/* secondary stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg border border-border/20 bg-card/40 p-3 text-center">
                <p className="text-[10px] text-muted-foreground">wins / losses</p>
                <p className="text-sm font-bold">{result.metrics.wins} / {result.metrics.losses}</p>
              </div>
              <div className="rounded-lg border border-border/20 bg-card/40 p-3 text-center">
                <p className="text-[10px] text-muted-foreground">max consecutive wins</p>
                <p className="text-sm font-bold text-[hsl(var(--profit))]">{result.metrics.max_consecutive_wins}</p>
              </div>
              <div className="rounded-lg border border-border/20 bg-card/40 p-3 text-center">
                <p className="text-[10px] text-muted-foreground">max consecutive losses</p>
                <p className="text-sm font-bold text-[hsl(var(--loss))]">{result.metrics.max_consecutive_losses}</p>
              </div>
              <div className="rounded-lg border border-border/20 bg-card/40 p-3 text-center">
                <p className="text-[10px] text-muted-foreground">win condition</p>
                <p className="text-sm font-bold text-primary">{result.metrics.win_condition}</p>
              </div>
            </div>

            {/* day distribution */}
            {Object.keys(result.day_distribution).length > 0 && (
              <div className="rounded-xl border border-border/30 bg-card/60 backdrop-blur-md p-4">
                <p className="text-[10px] text-muted-foreground mb-3">win rate by day of week</p>
                <div className="grid grid-cols-5 gap-2">
                  {["mon", "tue", "wed", "thu", "fri"].map((day) => {
                    const d = result.day_distribution[day];
                    const wr = d && d.total > 0 ? Math.round((d.wins / d.total) * 100) : 0;
                    return (
                      <div key={day} className="rounded-lg bg-muted/30 p-2 text-center">
                        <p className="text-[10px] text-muted-foreground">{day}</p>
                        <p className={`text-sm font-bold ${wr >= 50 ? "text-[hsl(var(--profit))]" : "text-[hsl(var(--loss))]"}`}>
                          {d ? `${wr}%` : "—"}
                        </p>
                        <p className="text-[9px] text-muted-foreground">{d ? `${d.total} trades` : ""}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* recent trades table */}
            {result.filtered_dates.length > 0 && (
              <div className="rounded-xl border border-border/30 bg-card/60 backdrop-blur-md p-4 overflow-x-auto">
                <p className="text-[10px] text-muted-foreground mb-3">recent filtered trades (last 20)</p>
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="border-b border-border/20">
                      <th className="text-left py-1 px-2 text-muted-foreground font-medium">date</th>
                      <th className="text-left py-1 px-2 text-muted-foreground font-medium">gap</th>
                      <th className="text-left py-1 px-2 text-muted-foreground font-medium">gap %</th>
                      <th className="text-left py-1 px-2 text-muted-foreground font-medium">m15</th>
                      <th className="text-left py-1 px-2 text-muted-foreground font-medium">result</th>
                      <th className="text-right py-1 px-2 text-muted-foreground font-medium">pnl (usd)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.filtered_dates.map((d, i) => (
                      <tr key={i} className="border-b border-border/10 hover:bg-muted/20">
                        <td className="py-1 px-2">{d.date}</td>
                        <td className="py-1 px-2">
                          <span className={d.gap_type === "up" ? "text-[hsl(var(--profit))]" : "text-[hsl(var(--loss))]"}>
                            {d.gap_type}
                          </span>
                        </td>
                        <td className="py-1 px-2">{d.gap_pct.toFixed(2)}%</td>
                        <td className="py-1 px-2">
                          <span className={d.m15_direction === "bullish" ? "text-[hsl(var(--profit))]" : "text-[hsl(var(--loss))]"}>
                            {d.m15_direction}
                          </span>
                        </td>
                        <td className="py-1 px-2">
                          <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium ${
                            d.is_win ? "bg-[hsl(var(--profit))]/15 text-[hsl(var(--profit))]" : "bg-[hsl(var(--loss))]/15 text-[hsl(var(--loss))]"
                          }`}>
                            {d.is_win ? "win" : "loss"}
                          </span>
                        </td>
                        <td className={`py-1 px-2 text-right font-mono ${d.is_win ? "text-[hsl(var(--profit))]" : "text-[hsl(var(--loss))]"}`}>
                          {d.is_win ? "+" : "-"}${d.pnl.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* follow-up options */}
            {result.needs_clarification && result.follow_up_options.length > 0 && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 backdrop-blur-md p-4 space-y-3">
                <p className="text-xs text-primary font-medium flex items-center gap-1.5">
                  <Brain className="h-3.5 w-3.5" />
                  need more details to refine results
                </p>
                {result.follow_up_options.map((opt, i) => (
                  <div key={i} className="space-y-1.5">
                    <p className="text-[10px] text-muted-foreground">{opt.label}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {opt.options.map((val) => (
                        <button
                          key={val}
                          onClick={() => handleFollowUp(opt.field, val)}
                          className="px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 hover:bg-primary/20 text-[11px] text-primary transition-colors"
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* empty state */}
        {!result && !loading && !fetchingData && (
          <div className="rounded-xl border border-dashed border-border/30 p-12 flex flex-col items-center gap-4 text-center">
            <Brain className="h-10 w-10 text-muted-foreground/30" />
            <div>
              <p className="text-sm text-muted-foreground">describe your trading edge in natural language</p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">
                the ai will extract filters, run backtest, and show you win rate, profit factor, and expectancy
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

const MetricCard = ({ icon: Icon, label, value, color }: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
}) => (
  <div className="rounded-lg border border-border/20 bg-card/40 backdrop-blur-sm p-3 space-y-1">
    <div className="flex items-center gap-1.5">
      <Icon className="h-3 w-3 text-muted-foreground" />
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
    <p className={`text-lg font-bold font-mono ${color}`}>{value}</p>
  </div>
);

export default CustomAnalysis;
