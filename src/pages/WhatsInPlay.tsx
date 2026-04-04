import { useState, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import AppNavSidebar, { MobileHeader } from "@/components/AppNavSidebar";
import { toast } from "sonner";
import { Crown, Play, Loader2, Combine, Plus } from "lucide-react";
import { z } from "zod";

import ConditionPicker from "@/components/whats-in-play/ConditionPicker";
import ComboResults from "@/components/whats-in-play/ComboResults";
import type { ConditionConfig, ComboResult } from "@/lib/combo-analysis";
import { analyzeCombo } from "@/lib/combo-analysis";

const BarSchema = z.object({
  datetime: z.string(),
  open: z.string(),
  high: z.string(),
  low: z.string(),
  close: z.string(),
}).passthrough();
const ResponseSchema = z.object({ values: z.array(BarSchema).min(1) }).passthrough();

const DATE_RANGES = [
  { label: "1 month", days: 20 },
  { label: "2 months", days: 40 },
  { label: "3 months", days: 60 },
  { label: "6 months", days: 120 },
  { label: "12 months", days: 240 },
  { label: "24 months", days: 480 },
  { label: "36 months", days: 720 },
];

const WhatsInPlay = () => {
  const { user, loading: authLoading } = useAuth();
  const { isActive } = useSubscription();
  const isMobile = useIsMobile();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [symbol, setSymbol] = useState("QQQ");
  const [maxDays, setMaxDays] = useState(60);
  const [condA, setCondA] = useState<ConditionConfig>({ type: "ib_breakout", window: 60, direction: "any" });
  const [condB, setCondB] = useState<ConditionConfig>({ type: "bb_breakout", timeframe: 15, band: "upper", period: 20, timing: "during_ib" });
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ComboResult | null>(null);

  const isFree = !isActive;

  const runAnalysis = useCallback(async () => {
    if (isFree) {
      toast.error("Combo Builder is a Pro feature. Upgrade to access.");
      return;
    }
    setRunning(true);
    setResult(null);

    try {
      const batchSize = 5000;
      const { data: json, error } = await supabase.functions.invoke("twelvedata-proxy", {
        body: { symbol, outputsize: String(batchSize), key_index: 0 },
      });
      if (error) throw new Error("API error");

      const parsed = ResponseSchema.safeParse(json);
      if (!parsed.success) {
        toast.error("Failed to parse market data");
        setRunning(false);
        return;
      }

      const comboResult = analyzeCombo(parsed.data.values as any, condA, condB, maxDays);
      setResult(comboResult);

      if (comboResult.bothFired === 0) {
        toast.info("No days found where both conditions fired simultaneously.");
      }
    } catch (err) {
      toast.error("Failed to fetch data. Try again.");
    }
    setRunning(false);
  }, [symbol, condA, condB, maxDays, isFree]);

  if (!authLoading && !user) return <Navigate to="/auth" replace />;

  const selectClass = "bg-card border border-border rounded-lg px-2.5 py-1.5 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary";

  return (
    <div className="h-screen w-full flex flex-col lg:flex-row overflow-hidden bg-background">
      {isMobile && (
        <MobileHeader onMenuToggle={() => setSidebarCollapsed(!sidebarCollapsed)} title="combo builder" />
      )}
      <AppNavSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

      <main className="flex-1 min-w-0 overflow-y-auto p-4 lg:p-6 space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2">
            <Combine className="h-5 w-5 text-primary" />
            <h1 className="text-[18px] lg:text-[22px] font-bold text-foreground lowercase">combo builder</h1>
          </div>
          <p className="text-[12px] text-muted-foreground mt-1 max-w-xl">
            combine two conditions and backtest the probability of continuation. build your edge by stacking indicators.
          </p>
        </div>

        {/* Pro gate */}
        {isFree && (
          <div className="rounded-xl border border-border bg-card/50 p-8 text-center max-w-md mx-auto">
            <Crown className="h-8 w-8 text-amber-400 mx-auto mb-3" />
            <h3 className="text-[14px] font-semibold text-foreground mb-1">pro feature</h3>
            <p className="text-[12px] text-muted-foreground">
              combo builder is available for pro members. upgrade to access custom backtesting combinations.
            </p>
          </div>
        )}

        {!isFree && (
          <>
            {/* Controls row */}
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">symbol</label>
                <input
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  placeholder="QQQ"
                  className={selectClass + " w-[100px]"}
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">date range</label>
                <select
                  value={maxDays}
                  onChange={(e) => setMaxDays(Number(e.target.value))}
                  className={selectClass}
                >
                  {DATE_RANGES.map((r) => (
                    <option key={r.days} value={r.days}>{r.label} ({r.days}d)</option>
                  ))}
                </select>
              </div>
              <button
                onClick={runAnalysis}
                disabled={running || !symbol.trim()}
                className="flex items-center gap-2 bg-primary text-primary-foreground rounded-lg px-5 py-1.5 text-[12px] font-semibold disabled:opacity-50 transition-colors hover:bg-primary/90"
              >
                {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                {running ? "analyzing..." : "run backtest"}
              </button>
            </div>

            {/* Condition pickers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ConditionPicker label="condition A" value={condA} onChange={setCondA} otherCondition={condB} />
              <div className="flex items-center justify-center md:hidden">
                <div className="flex items-center gap-2 text-primary">
                  <Plus className="h-4 w-4" />
                  <span className="text-[11px] font-bold uppercase tracking-widest">and</span>
                </div>
              </div>
              <ConditionPicker label="condition B" value={condB} onChange={setCondB} otherCondition={condA} />
            </div>

            {/* Results */}
            {result && (
              <ComboResults result={result} condA={condA} condB={condB} symbol={symbol} />
            )}

            {/* Empty state */}
            {!result && !running && (
              <div className="flex items-center justify-center h-[30vh]">
                <div className="border border-dashed border-border rounded-xl p-8 text-center max-w-sm">
                  <Combine className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-[13px] text-muted-foreground">
                    configure your two conditions above and hit "run backtest" to see the probability of continuation
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default WhatsInPlay;
