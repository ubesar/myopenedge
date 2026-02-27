import { useState, useEffect } from "react";
import { Loader2, Play, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type AnalysisMode = "ib" | "momentum" | "occ" | "gapfill";

interface ControlPanelProps {
  onRun: (symbol: string, ibWindow: number, maxDays: number, mode: AnalysisMode) => void;
  loading: boolean;
  isFree?: boolean;
}

const IB_WINDOWS = [
{ value: "15", label: "First 15 min (09:30–09:45)", ibOnly: true },
{ value: "30", label: "First 30 min (09:30–10:00)" },
{ value: "60", label: "First 60 min (09:30–10:30)" },
{ value: "90", label: "First 90 min (09:30–11:00)" }];


const DAY_OPTIONS = [
{ value: "0", label: "All Days" },
{ value: "7", label: "Last 7 Days" },
{ value: "15", label: "Last 15 Days" },
{ value: "30", label: "Last 30 Days" },
{ value: "60", label: "Last 60 Days" },
{ value: "90", label: "Last 90 Days" },
{ value: "120", label: "Last 120 Days" }];


const ControlPanel = ({ onRun, loading, isFree = false }: ControlPanelProps) => {
  const [symbol, setSymbol] = useState("QQQ");
  const [ibWindow, setIbWindow] = useState(isFree ? "60" : "30");
  const [maxDays, setMaxDays] = useState(isFree ? "7" : "15");
  const [mode, setMode] = useState<AnalysisMode>("ib");

  // Auto-switch IB window if current selection is invalid for momentum mode
  useEffect(() => {
    if (mode === "momentum" && ibWindow === "15") {
      setIbWindow("30");
    }
  }, [mode, ibWindow]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol.trim()) return;
    onRun(symbol.trim().toUpperCase(), parseInt(ibWindow), parseInt(maxDays), mode);
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-border/30 bg-card/40 backdrop-blur-md p-3 space-y-2.5 mt-2 lg:mt-4 shadow-lg text-xs">
      <div className="flex items-center gap-1.5 mb-1">
        <BarChart3 className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-card-foreground">IB Analysis</h2>
      </div>

      <div className="space-y-2">
        <Label className="text-sm text-muted-foreground">Analysis Type</Label>
        <Select value={isFree ? "ib" : mode} onValueChange={(v) => !isFree && setMode(v as AnalysisMode)} disabled={isFree}>
          <SelectTrigger className="bg-muted border-border text-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ib">Initial Balance (IB)</SelectItem>
            {!isFree && <SelectItem value="momentum">Momentum Candle</SelectItem>}
            {!isFree && <SelectItem value="occ">Opening Candle Continuation</SelectItem>}
            {!isFree && <SelectItem value="gapfill">Gap Fill Statistics</SelectItem>}
          </SelectContent>
        </Select>
        {isFree && <p className="text-[10px] text-muted-foreground">🔒 Upgrade to Pro for Momentum analysis</p>}
        <div className="rounded-md border border-border/20 bg-muted/30 px-2.5 py-2 text-[10px] text-muted-foreground leading-relaxed mt-1">
          {(() => {
            const currentMode = isFree ? "ib" : mode;
            if (currentMode === "ib") return (
              <>
                <span className="font-semibold text-foreground/80">IB Analysis</span> — Calculates the IB range (High & Low) from 5-min bars within the selected window. Detects which side formed first (High/Low First), then scans for breakouts using <span className="font-medium text-foreground/70">M15 candle close</span> from IB end until 12:00. Output: probability of Break High / Break Low / Inside Day.
              </>
            );
            if (currentMode === "momentum") return (
              <>
                <span className="font-semibold text-foreground/80">Momentum Candle</span> — Scans for 2 consecutive M15 candles with the same color (bullish/bearish) in the 09:30–12:00 window. First candle must have body ≥50% of range, second ≥30%. The first signal determines the day's bias: Bullish, Bearish, or Choppy.
              </>
            );
            if (currentMode === "gapfill") return (
              <>
                <span className="font-semibold text-foreground/80">Gap Fill Statistics</span> — Compares Today's Open vs Yesterday's Close. A <span className="font-medium text-foreground/70">Gap Up</span> fills if the session Low ≤ PrevClose; a <span className="font-medium text-foreground/70">Gap Down</span> fills if session High ≥ PrevClose. Shows fill probability by gap size (Small/Medium/Large) and day of week.
              </>
            );
            return (
              <>
                <span className="font-semibold text-foreground/80">Opening Candle Continuation</span> — Evaluates the first 2 candles after market open (09:30) simultaneously across 4 timeframes: M5, M15, M30, H1. If both candles are <span className="font-medium text-foreground/70">green → Bullish OCC</span>, both red → Bearish OCC, mixed colors → Failed OCC. Overall bias is determined by the majority of 4 TFs.
              </>
            );
          })()}
        </div>
      </div>


      <div className="space-y-2">
        <Label htmlFor="symbol" className="text-sm text-muted-foreground">
          Ticker Symbol
        </Label>
        <Input
          id="symbol"
          placeholder="QQQ"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          className="bg-muted border-border text-foreground placeholder:text-muted-foreground uppercase" />

      </div>

      <div className="space-y-2">
        <Label className="text-sm text-muted-foreground">Trading Days</Label>
        <Select value={isFree ? "7" : maxDays} onValueChange={(v) => !isFree && setMaxDays(v)} disabled={isFree}>
          <SelectTrigger className="bg-muted border-border text-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {isFree
              ? <SelectItem value="7">Last 7 Days</SelectItem>
              : DAY_OPTIONS.map((d) =>
                <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
              )
            }
          </SelectContent>
        </Select>
        {isFree && <p className="text-[10px] text-muted-foreground">🔒 Upgrade to Pro for more days</p>}
      </div>

      {mode !== "occ" && mode !== "gapfill" && (
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">IB Window</Label>
          <Select value={isFree ? "60" : ibWindow} onValueChange={(v) => !isFree && setIbWindow(v)} disabled={isFree}>
            <SelectTrigger className="bg-muted border-border text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {isFree
                ? <SelectItem value="60">First 60 min (09:30–10:30)</SelectItem>
                : IB_WINDOWS
                  .filter((w) => mode === "ib" || !w.ibOnly)
                  .map((w) =>
                    <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>
                  )
              }
            </SelectContent>
          </Select>
          {isFree && <p className="text-[10px] text-muted-foreground">🔒 Upgrade to Pro for more windows</p>}
        </div>
      )}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ?
        <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Analyzing…
          </> :

        <>
            <Play className="mr-2 h-4 w-4" />
            Run Analysis
          </>
        }
      </Button>
    </form>);

};

export default ControlPanel;