import { useState } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import AppNavSidebar, { MobileHeader } from "@/components/AppNavSidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import NYOrbM15Dashboard from "@/components/NYOrbM15Dashboard";
import QuantPanel from "@/components/QuantPanel";
import { analyzeNYOrbM15, nyOrbQuantTrades, type NYOrbResult } from "@/lib/ny-orb-m15";
import PullbackReport from "@/components/PullbackReport";
import { analyzePullback, type PullbackResult } from "@/lib/pullback-analysis";
import { DEFAULT_QUANT_SETTINGS, type QuantTrade } from "@/lib/quant-metrics";

type Strategy = "ny-orb-m15" | "pullback-50";

const STRATEGY_OPTIONS: { value: Strategy; label: string; desc: string }[] = [
  {
    value: "ny-orb-m15",
    label: "ny open orb m15",
    desc: "opening range 09:30–09:45 ET dari 3 candle m5 · breakout by wick · target 0.5 × extension orb · risk fix $100",
  },
  {
    value: "pullback-50",
    label: "pullback 50%",
    desc: "momentum candle m15 (super body) · entry di 50% range candle trigger · sl di ekstrem candle · target rr 1:1",
  },
];

const pullbackQuantTrades = (r: PullbackResult): QuantTrade[] =>
  r.trades.map((t) => ({
    date: t.date,
    side: t.direction === "bullish" ? "long" : "short",
    entry: t.entry,
    risk: Math.abs(t.entry - t.stop),
    outcome: t.outcome,
    rMultiple:
      t.outcome === "open"
        ? undefined
        : t.outcome === "win"
        ? Math.abs(t.target - t.entry) / Math.max(1e-9, Math.abs(t.entry - t.stop))
        : -1,
  }));

const DAY_OPTIONS = [
  { value: "20", label: "1 month" },
  { value: "40", label: "2 months" },
  { value: "60", label: "3 months" },
  { value: "120", label: "6 months" },
  { value: "240", label: "12 months" },
];

const MAX_BATCH_DAYS = 60;
const BATCH_OUTPUTSIZE = 5000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const Backtester = () => {
  const { user, loading: authLoading } = useAuth();
  const isMobile = useIsMobile();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [symbol, setSymbol] = useState("NQ");
  const [maxDays, setMaxDays] = useState("60");
  const [loading, setLoading] = useState(false);
  const [strategy, setStrategy] = useState<Strategy>("ny-orb-m15");
  const [result, setResult] = useState<NYOrbResult | null>(null);
  const [pullback, setPullback] = useState<PullbackResult | null>(null);
  const [ranSymbol, setRanSymbol] = useState("NQ");
  const [ranDays, setRanDays] = useState(60);

  if (!authLoading && !user) return <Navigate to="/auth" replace />;

  const fetchMarketData = async (ticker: string, totalDays: number) => {
    if (totalDays <= MAX_BATCH_DAYS) {
      const { data, error } = await supabase.functions.invoke("twelvedata-proxy", {
        body: { symbol: ticker, outputsize: String(BATCH_OUTPUTSIZE), key_index: 0 },
      });
      if (error) throw new Error("failed to fetch market data");
      return data;
    }

    let all: any[] = [];
    let endDate: string | null = null;
    let remaining = totalDays;
    let batchIndex = 0;
    while (remaining > 0) {
      const body: Record<string, any> = { symbol: ticker, outputsize: String(BATCH_OUTPUTSIZE), key_index: batchIndex };
      if (endDate) body.end_date = endDate;
      const { data, error } = await supabase.functions.invoke("twelvedata-proxy", { body });
      if (error) throw new Error(`failed to fetch market data (batch ${batchIndex + 1})`);
      const values = (data as any)?.values;
      if (!values || !Array.isArray(values) || values.length === 0) break;
      all = all.concat(values);
      endDate = values[values.length - 1].datetime;
      remaining -= MAX_BATCH_DAYS;
      batchIndex++;
      if (remaining > 0) await sleep(3000);
    }
    const seen = new Set<string>();
    return { values: all.filter((v) => (seen.has(v.datetime) ? false : (seen.add(v.datetime), true))) };
  };

  const run = async () => {
    const ticker = symbol.trim().toUpperCase();
    if (!ticker) return;
    setLoading(true);
    setResult(null);
    setPullback(null);
    try {
      const days = parseInt(maxDays);
      const json: any = await fetchMarketData(ticker, days);
      if (json?.status === "error") { toast.error(json.message || "api error"); return; }
      const values = json?.values;
      if (!Array.isArray(values) || values.length === 0) { toast.error("no data returned"); return; }
      if (strategy === "pullback-50") {
        const p = analyzePullback(values, { maxDays: days });
        if (p.totalDays === 0) { toast.error("not enough session data"); return; }
        setPullback(p);
      } else {
        const a = analyzeNYOrbM15(values, days, [1, 2, 3, 4, 5], 0.6, ticker);
        if (a.totalDays === 0) { toast.error("not enough session data"); return; }
        setResult(a);
      }
      setRanSymbol(ticker);
      setRanDays(days);
    } catch (e: any) {
      toast.error(e.message || "failed to run backtest");
    } finally {
      setLoading(false);
    }
  };

  const activeStrategy = STRATEGY_OPTIONS.find((s) => s.value === strategy)!;
  const rangeLabel = DAY_OPTIONS.find((d) => d.value === String(ranDays))?.label ?? `${ranDays} days`;

  return (
    <div className="h-screen w-full flex flex-col lg:flex-row overflow-hidden bg-background">
      {isMobile && <MobileHeader onMenuToggle={() => setSidebarCollapsed(!sidebarCollapsed)} title="backtester" />}
      <AppNavSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-4 lg:p-6 space-y-4">
          <div>
            <h1 className="text-[17px] font-semibold text-foreground lowercase">backtester — {activeStrategy.label}</h1>
            <p className="text-[12px] text-muted-foreground mt-0.5">{activeStrategy.desc}</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-3 flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <p className="text-[11px] text-muted-foreground">strategy</p>
              <Select value={strategy} onValueChange={(v) => setStrategy(v as Strategy)}>
                <SelectTrigger className="w-52 bg-input border-border text-[13px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STRATEGY_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] text-muted-foreground">ticker</p>
              <Input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder="NQ"
                className="w-32 bg-input border-border text-[13px] uppercase"
              />
            </div>
            <div className="space-y-1">
              <p className="text-[11px] text-muted-foreground">date range</p>
              <Select value={maxDays} onValueChange={setMaxDays}>
                <SelectTrigger className="w-44 bg-input border-border text-[13px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAY_OPTIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={run} disabled={loading} className="text-[13px] gap-1.5">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              run backtest
            </Button>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="text-center space-y-3">
                <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto" />
                <p className="text-[13px] text-muted-foreground">fetching &amp; analyzing {symbol.toLowerCase()} data…</p>
              </div>
            </div>
          )}

          {!loading && result && (
            <>
              <NYOrbM15Dashboard
                result={result}
                symbol={ranSymbol}
                dateRange={rangeLabel}
                weekdays="monday, tuesday, wednesday, thursday, friday"
              />
              {result.trades.length > 0 && (
                <QuantPanel
                  trades={nyOrbQuantTrades(result) as any}
                  settings={DEFAULT_QUANT_SETTINGS}
                  label="ny open orb m15"
                />
              )}
            </>
          )}

          {!loading && pullback && (
            <>
              <PullbackReport result={pullback} symbol={ranSymbol} dateRange={rangeLabel} bodyThresholdPct={70} />
              {pullback.trades.length > 0 && (
                <QuantPanel trades={pullbackQuantTrades(pullback)} settings={DEFAULT_QUANT_SETTINGS} label="pullback 50%" />
              )}
            </>
          )}

          {!loading && !result && !pullback && (
            <div className="border border-dashed border-border rounded-xl p-10 text-center">
              <p className="text-[13px] text-muted-foreground">pilih strategy + ticker lalu jalankan backtest untuk melihat statistik lengkap</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Backtester;
