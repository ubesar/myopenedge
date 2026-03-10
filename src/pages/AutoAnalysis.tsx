import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Bot, RefreshCw, TrendingUp, TrendingDown, Minus, Calendar, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import logo from "@/assets/logo.png";
import { toast } from "sonner";

interface AutoAnalysis {
  id: string;
  symbol: string;
  analysis_date: string;
  ib_results: Record<string, any>;
  momentum_results: Record<string, any>;
  ai_insight: string;
  created_at: string;
}

const AutoAnalysisPage = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [analyses, setAnalyses] = useState<AutoAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }
    if (user) fetchAnalyses();
  }, [user, authLoading]);

  const fetchAnalyses = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("auto_analyses")
      .select("*")
      .order("analysis_date", { ascending: false })
      .limit(30);
    if (data) {
      setAnalyses(data as AutoAnalysis[]);
      if (data.length > 0 && !selectedId) setSelectedId(data[0].id);
    }
    setLoading(false);
  };

  const triggerManual = async () => {
    setTriggering(true);
    try {
      const { data, error } = await supabase.functions.invoke("auto-analyze", { body: {} });
      if (error) throw error;
      toast.success(`Analysis completed for ${data?.symbol || "QQQ"}`);
      await fetchAnalyses();
    } catch (err: any) {
      toast.error(err.message || "Failed to trigger analysis");
    } finally {
      setTriggering(false);
    }
  };

  const selected = analyses.find((a) => a.id === selectedId) || analyses[0];

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <header className="border-b border-border/40 px-3 sm:px-6 py-2 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-2 sm:gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/app")} className="h-7 px-2 gap-1">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline text-xs">Back</span>
          </Button>
          <img src={logo} alt="MyOpenEdge" className="h-7 w-7 rounded-full object-cover" />
          <h1 className="text-base font-bold text-foreground tracking-tight">Daily AI Briefing</h1>
          <Badge variant="secondary" className="gap-1 text-[10px] bg-primary/15 text-primary border-primary/30">
            <Bot className="h-3 w-3" /> Auto
          </Badge>
          <div className="ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={triggerManual}
              disabled={triggering}
              className="h-7 px-3 gap-1 text-xs"
            >
              {triggering ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Run Now
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 min-h-0 p-2 sm:p-3">
        <div className="h-full grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-2 sm:gap-3">
          {/* Left: Date list */}
          <aside className="min-h-0 overflow-y-auto scrollbar-thin rounded-lg border border-border/30 bg-card/50 backdrop-blur">
            <div className="p-3 border-b border-border/20">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Analysis History
              </h2>
            </div>
            {analyses.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-xs">
                No analyses yet. Click "Run Now" to trigger.
              </div>
            ) : (
              <div className="divide-y divide-border/10">
                {analyses.map((a) => {
                  const ib60 = a.ib_results?.M60;
                  const mom60 = a.momentum_results?.M60;
                  const ibBias = ib60
                    ? ib60.lowFirst.breakHigh > ib60.lowFirst.breakLow
                      ? "bullish"
                      : ib60.lowFirst.breakLow > ib60.lowFirst.breakHigh
                      ? "bearish"
                      : "neutral"
                    : "neutral";
                  const momBias = mom60
                    ? mom60.bullishDays > mom60.bearishDays
                      ? "bullish"
                      : mom60.bearishDays > mom60.bullishDays
                      ? "bearish"
                      : "choppy"
                    : "choppy";

                  return (
                    <button
                      key={a.id}
                      onClick={() => setSelectedId(a.id)}
                      className={`w-full text-left px-3 py-2.5 transition-colors hover:bg-muted/30 ${
                        selectedId === a.id ? "bg-primary/10 border-l-2 border-primary" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-card-foreground">
                          {new Date(a.analysis_date + "T00:00:00").toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{a.symbol}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="flex items-center gap-0.5 text-[10px]">
                          {ibBias === "bullish" ? (
                            <TrendingUp className="h-3 w-3 text-emerald-400" />
                          ) : ibBias === "bearish" ? (
                            <TrendingDown className="h-3 w-3 text-red-400" />
                          ) : (
                            <Minus className="h-3 w-3 text-muted-foreground" />
                          )}
                          <span className="text-muted-foreground">IB</span>
                        </span>
                        <span className="flex items-center gap-0.5 text-[10px]">
                          {momBias === "bullish" ? (
                            <TrendingUp className="h-3 w-3 text-emerald-400" />
                          ) : momBias === "bearish" ? (
                            <TrendingDown className="h-3 w-3 text-red-400" />
                          ) : (
                            <Minus className="h-3 w-3 text-muted-foreground" />
                          )}
                          <span className="text-muted-foreground">Mom</span>
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </aside>

          {/* Right: Detail */}
          <section className="min-h-0 overflow-y-auto scrollbar-thin space-y-3">
            {selected ? (
              <>
                {/* AI Insight Card */}
                <div className="rounded-lg border border-border/30 bg-card/50 backdrop-blur p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-card-foreground">AI Trading Briefing</h3>
                      <p className="text-[10px] text-muted-foreground">
                        {selected.symbol} ·{" "}
                        {new Date(selected.analysis_date + "T00:00:00").toLocaleDateString("en-US", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                  {selected.ai_insight ? (
                    <div className="prose prose-sm prose-invert max-w-none text-card-foreground [&>h3]:text-sm [&>h3]:font-semibold [&>p]:text-sm [&>ul]:text-sm [&>ol]:text-sm">
                      <ReactMarkdown>{selected.ai_insight}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No AI insight available.</p>
                  )}
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* IB Stats */}
                  <div className="rounded-lg border border-border/30 bg-card/50 backdrop-blur p-4">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      IB Breakout Probabilities
                    </h4>
                    {selected.ib_results &&
                      Object.entries(selected.ib_results).map(([tf, data]: [string, any]) => {
                        const hfT = data.highFirst.total || 1;
                        const lfT = data.lowFirst.total || 1;
                        return (
                          <div key={tf} className="mb-3 last:mb-0">
                            <p className="text-xs font-medium text-card-foreground mb-1">
                              {tf} ({data.ibWindowMinutes}min) · {data.totalDays} days
                            </p>
                            <div className="grid grid-cols-2 gap-2 text-[10px]">
                              <div className="bg-muted/20 rounded p-1.5">
                                <p className="text-muted-foreground mb-0.5">High First ({data.highFirst.total}d)</p>
                                <div className="flex gap-2">
                                  <span className="text-emerald-400">↑{((data.highFirst.breakHigh / hfT) * 100).toFixed(0)}%</span>
                                  <span className="text-red-400">↓{((data.highFirst.breakLow / hfT) * 100).toFixed(0)}%</span>
                                  <span className="text-muted-foreground">→{((data.highFirst.inside / hfT) * 100).toFixed(0)}%</span>
                                </div>
                              </div>
                              <div className="bg-muted/20 rounded p-1.5">
                                <p className="text-muted-foreground mb-0.5">Low First ({data.lowFirst.total}d)</p>
                                <div className="flex gap-2">
                                  <span className="text-emerald-400">↑{((data.lowFirst.breakHigh / lfT) * 100).toFixed(0)}%</span>
                                  <span className="text-red-400">↓{((data.lowFirst.breakLow / lfT) * 100).toFixed(0)}%</span>
                                  <span className="text-muted-foreground">→{((data.lowFirst.inside / lfT) * 100).toFixed(0)}%</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>

                  {/* Momentum Stats */}
                  <div className="rounded-lg border border-border/30 bg-card/50 backdrop-blur p-4">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      Momentum Candle Probabilities
                    </h4>
                    {selected.momentum_results &&
                      Object.entries(selected.momentum_results).map(([window, data]: [string, any]) => {
                        const total = data.totalDays || 1;
                        return (
                          <div key={window} className="mb-3 last:mb-0">
                            <p className="text-xs font-medium text-card-foreground mb-1">
                              {window} Window · {data.totalDays} days
                            </p>
                            <div className="flex gap-3 text-[10px] mb-1.5">
                              <span className="text-emerald-400">Bull {((data.bullishDays / total) * 100).toFixed(0)}%</span>
                              <span className="text-red-400">Bear {((data.bearishDays / total) * 100).toFixed(0)}%</span>
                              <span className="text-muted-foreground">Chop {((data.choppyDays / total) * 100).toFixed(0)}%</span>
                            </div>
                            {data.tfStats &&
                              Object.entries(data.tfStats).map(([tf, stats]: [string, any]) => {
                                const hfT = stats.highFirst.total || 1;
                                const lfT = stats.lowFirst.total || 1;
                                return (
                                  <div key={tf} className="grid grid-cols-2 gap-2 text-[10px] mb-1">
                                    <div className="bg-muted/20 rounded p-1">
                                      <span className="text-muted-foreground">{tf} HF: </span>
                                      <span className="text-emerald-400">{((stats.highFirst.bullish / hfT) * 100).toFixed(0)}%</span>
                                      {" / "}
                                      <span className="text-red-400">{((stats.highFirst.bearish / hfT) * 100).toFixed(0)}%</span>
                                    </div>
                                    <div className="bg-muted/20 rounded p-1">
                                      <span className="text-muted-foreground">{tf} LF: </span>
                                      <span className="text-emerald-400">{((stats.lowFirst.bullish / lfT) * 100).toFixed(0)}%</span>
                                      {" / "}
                                      <span className="text-red-400">{((stats.lowFirst.bearish / lfT) * 100).toFixed(0)}%</span>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        );
                      })}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full rounded-lg border border-dashed border-border/30">
                <div className="text-center">
                  <Bot className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-30" />
                  <p className="text-muted-foreground text-xs">No analysis available yet.</p>
                  <p className="text-muted-foreground text-[10px] mt-1">Click "Run Now" to generate your first daily briefing.</p>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};

export default AutoAnalysisPage;
