import { useState, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import AppNavSidebar, { MobileHeader } from "@/components/AppNavSidebar";
import { toast } from "sonner";
import { Crown, Play, Loader2, Combine } from "lucide-react";
import { z } from "zod";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

import ExtensionResults from "@/components/whats-in-play/ExtensionResults";
import { analyzeIBExtension, type ExtensionResult } from "@/lib/ib-extension-analysis";

const BarSchema = z.object({
  datetime: z.string(),
  open: z.string(),
  high: z.string(),
  low: z.string(),
  close: z.string(),
}).passthrough();
const ResponseSchema = z.object({ values: z.array(BarSchema).min(1) }).passthrough();

const DAY_OPTIONS = [
  { value: "20", label: "1 Month" },
  { value: "40", label: "2 Months" },
  { value: "60", label: "3 Months" },
  { value: "120", label: "6 Months" },
  { value: "240", label: "12 Months" },
];

const WEEKDAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
];

const WhatsInPlay = () => {
  const { user, loading: authLoading } = useAuth();
  const { isActive } = useSubscription();
  const isMobile = useIsMobile();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [symbol, setSymbol] = useState("QQQ");
  const [ibWindow, setIbWindow] = useState<"30" | "60">("60");
  const [pullbackWindow, setPullbackWindow] = useState<"30" | "60">("30");
  const [maxDays, setMaxDays] = useState("240");
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ExtensionResult | null>(null);

  const isFree = !isActive;

  const dateRangeLabel = DAY_OPTIONS.find((d) => d.value === maxDays)?.label || maxDays + " days";
  const weekdaysLabel =
    weekdays.length === 5
      ? "Mon–Fri"
      : weekdays.map((d) => ["", "Mon", "Tue", "Wed", "Thu", "Fri"][d]).join(", ");

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

      const extResult = analyzeIBExtension(
        parsed.data.values as any,
        Number(ibWindow) as 30 | 60,
        Number(pullbackWindow) as 30 | 60,
        Number(maxDays),
        weekdays
      );
      setResult(extResult);

      if (extResult.totalDays === 0) {
        toast.info("No trading days found in the selected range.");
      }
    } catch (err) {
      toast.error("Failed to fetch data. Try again.");
    }
    setRunning(false);
  }, [symbol, ibWindow, pullbackWindow, maxDays, weekdays, isFree]);

  if (!authLoading && !user) return <Navigate to="/auth" replace />;

  return (
    <div className="h-screen w-full flex flex-col lg:flex-row overflow-hidden bg-background">
      {isMobile && (
        <MobileHeader onMenuToggle={() => setSidebarCollapsed(!sidebarCollapsed)} title="combo builder" />
      )}
      <AppNavSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

      {/* Parameter Panel (left sidebar) */}
      {!isFree && (
        <div className="h-full border-r border-border bg-surface overflow-y-auto w-full lg:w-[260px] shrink-0">
          <div className="p-4 space-y-5">
            {/* Header */}
            <div className="flex items-center gap-2">
              <Combine className="h-4 w-4 text-primary" />
              <p className="section-label">combo builder</p>
            </div>
            <p className="text-[10px] text-muted-foreground -mt-3">
              IB extension & pullback probability analysis
            </p>

            {/* Ticker */}
            <div className="space-y-2">
              <p className="section-label">ticker & timeframe</p>
              <p className="text-[11px] text-muted-foreground">asset & ticker</p>
              <Input
                placeholder="QQQ"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                className="bg-input border-border text-[13px] text-foreground placeholder:text-muted-foreground uppercase"
              />

              <p className="text-[11px] text-muted-foreground">IB window</p>
              <Select value={ibWindow} onValueChange={(v) => setIbWindow(v as "30" | "60")}>
                <SelectTrigger className="bg-input border-border text-[13px] text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">First 30 min</SelectItem>
                  <SelectItem value="60">First 60 min</SelectItem>
                </SelectContent>
              </Select>

              <p className="text-[11px] text-muted-foreground">pullback window</p>
              <Select value={pullbackWindow} onValueChange={(v) => setPullbackWindow(v as "30" | "60")}>
                <SelectTrigger className="bg-input border-border text-[13px] text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 min after breakout</SelectItem>
                  <SelectItem value="60">60 min after breakout</SelectItem>
                </SelectContent>
              </Select>

              <p className="text-[11px] text-muted-foreground">date range</p>
              <Select value={maxDays} onValueChange={setMaxDays}>
                <SelectTrigger className="bg-input border-border text-[13px] text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAY_OPTIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <p className="text-[11px] text-muted-foreground mt-2">weekdays to use</p>
              <div className="flex flex-wrap gap-2">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox
                    checked={weekdays.length === 5}
                    onCheckedChange={(checked) => setWeekdays(checked ? [1, 2, 3, 4, 5] : [])}
                  />
                  <span className="text-[12px] text-foreground font-medium">All</span>
                </label>
                {WEEKDAYS.map((wd) => (
                  <label key={wd.value} className="flex items-center gap-1.5 cursor-pointer">
                    <Checkbox
                      checked={weekdays.includes(wd.value)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setWeekdays((prev) => [...prev.filter((d) => d !== wd.value), wd.value].sort());
                        } else {
                          setWeekdays((prev) => prev.filter((d) => d !== wd.value));
                        }
                      }}
                    />
                    <span className="text-[12px] text-foreground">{wd.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Run button */}
            <button
              onClick={runAnalysis}
              disabled={running || !symbol.trim() || weekdays.length === 0}
              className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors"
            >
              {running ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  analyzing…
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  run analysis
                </>
              )}
            </button>

            {/* Info */}
            <div className="rounded-lg border border-border bg-background/50 p-3 space-y-1.5">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">what this analyzes</p>
              <ul className="text-[10px] text-muted-foreground space-y-1 list-disc list-inside">
                <li>IB extension levels: 25%, 50%, 100%</li>
                <li>pullback to IB 50% (midpoint) after breakout</li>
                <li>continuation probability after pullback</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-y-auto p-4 lg:p-6 space-y-6">
        {/* Pro gate */}
        {isFree && (
          <div className="flex items-center justify-center h-full">
            <div className="rounded-xl border border-border bg-card/50 p-8 text-center max-w-md">
              <Crown className="h-8 w-8 text-amber-400 mx-auto mb-3" />
              <h3 className="text-[14px] font-semibold text-foreground mb-1">pro feature</h3>
              <p className="text-[12px] text-muted-foreground">
                combo builder is available for pro members. upgrade to access IB extension & pullback analysis.
              </p>
            </div>
          </div>
        )}

        {!isFree && (
          <>
            {/* Results */}
            {result && (
              <ExtensionResults
                result={result}
                symbol={symbol}
                dateRange={dateRangeLabel}
                weekdays={weekdaysLabel}
              />
            )}

            {/* Empty state */}
            {!result && !running && (
              <div className="flex items-center justify-center h-[60vh]">
                <div className="border border-dashed border-border rounded-xl p-8 text-center max-w-sm">
                  <Combine className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-[13px] text-muted-foreground">
                    configure your parameters and hit "run analysis" to see IB extension & pullback probabilities
                  </p>
                </div>
              </div>
            )}

            {/* Loading state */}
            {running && (
              <div className="flex items-center justify-center h-[60vh]">
                <div className="text-center space-y-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                  <p className="text-[12px] text-muted-foreground">analyzing {symbol}...</p>
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
