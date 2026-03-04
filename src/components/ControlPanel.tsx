import { useState } from "react";
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
  { value: "15", label: "First 15 min (09:30–09:45)" },
  { value: "30", label: "First 30 min (09:30–10:00)" },
  { value: "60", label: "First 60 min (09:30–10:30)" },
  { value: "90", label: "First 90 min (09:30–11:00)" },
];

const DAY_OPTIONS = [
  { value: "0", label: "All Days" },
  { value: "7", label: "Last 7 Days" },
  { value: "15", label: "Last 15 Days" },
  { value: "30", label: "Last 30 Days" },
  { value: "60", label: "Last 60 Days" },
  { value: "90", label: "Last 90 Days" },
  { value: "120", label: "Last 120 Days" },
];

const ControlPanel = ({ onRun, loading, isFree = false }: ControlPanelProps) => {
  const [symbol, setSymbol] = useState("QQQ");
  const [ibWindow, setIbWindow] = useState(isFree ? "60" : "30");
  const [maxDays, setMaxDays] = useState(isFree ? "7" : "15");
  const [mode, setMode] = useState<AnalysisMode>("ib");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol.trim()) return;
    onRun(symbol.trim().toUpperCase(), parseInt(ibWindow), parseInt(maxDays), mode);
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-border/30 bg-card/40 backdrop-blur-md p-2.5 shadow-lg text-xs h-full flex flex-col">
      <div className="flex items-center gap-1.5 mb-2">
        <BarChart3 className="h-3.5 w-3.5 text-primary" />
        <h2 className="text-xs font-semibold text-card-foreground">IB Analysis</h2>
      </div>

      <div className="flex-1 flex flex-col justify-between gap-2">
        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Analysis Type</Label>
            <Select value={isFree ? "ib" : mode} onValueChange={(v) => !isFree && setMode(v as AnalysisMode)} disabled={isFree}>
              <SelectTrigger className="bg-muted border-border text-foreground h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ib">Initial Balance (IB)</SelectItem>
                {!isFree && <SelectItem value="momentum">Momentum Candle</SelectItem>}
                {!isFree && <SelectItem value="occ">Opening Candle Continuation</SelectItem>}
                {!isFree && <SelectItem value="gapfill">Gap Fill Statistics</SelectItem>}
              </SelectContent>
            </Select>
            {isFree && <p className="text-[9px] text-muted-foreground">🔒 Upgrade to Pro for more</p>}
          </div>

          <div className="rounded-md border border-border/20 bg-muted/30 px-2 py-1.5 text-[9px] text-muted-foreground leading-relaxed">
            {(() => {
              const currentMode = isFree ? "ib" : mode;
              if (currentMode === "ib") return (
                <>
                  <span className="font-semibold text-foreground/80">IB Analysis</span> — Calculates the IB range from 5-min bars within the selected window. Detects which side formed first, then scans for breakouts using <span className="font-medium text-foreground/70">M15 candle close</span> from IB end until 12:00.
                </>
              );
              if (currentMode === "momentum") return (
                <>
                  <span className="font-semibold text-foreground/80">Momentum Candle</span> — Scans for 2 consecutive same-color candles in 09:30–12:00 across <span className="font-medium text-foreground/70">M5, M15, M30, H1</span>.
                </>
              );
              if (currentMode === "gapfill") return (
                <>
                  <span className="font-semibold text-foreground/80">Gap Fill</span> — Compares Today's Open vs Yesterday's Close. Shows fill probability by gap size and day of week.
                </>
              );
              return (
                <>
                  <span className="font-semibold text-foreground/80">OCC</span> — Evaluates first 2 candles after open across M5, M15, M30, H1. Both green → Bullish, both red → Bearish.
                </>
              );
            })()}
          </div>

          <div className="space-y-1">
            <Label htmlFor="symbol" className="text-[10px] text-muted-foreground">Ticker Symbol</Label>
            <Input id="symbol" placeholder="QQQ" value={symbol} onChange={(e) => setSymbol(e.target.value)}
              className="bg-muted border-border text-foreground placeholder:text-muted-foreground uppercase h-7 text-xs" />
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Trading Days</Label>
            <Select value={isFree ? "7" : maxDays} onValueChange={(v) => !isFree && setMaxDays(v)} disabled={isFree}>
              <SelectTrigger className="bg-muted border-border text-foreground h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {isFree
                  ? <SelectItem value="7">Last 7 Days</SelectItem>
                  : DAY_OPTIONS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)
                }
              </SelectContent>
            </Select>
            {isFree && <p className="text-[9px] text-muted-foreground">🔒 Upgrade for more days</p>}
          </div>

          {mode !== "occ" && mode !== "gapfill" && (
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">IB Window</Label>
              <Select value={isFree ? "60" : ibWindow} onValueChange={(v) => !isFree && setIbWindow(v)} disabled={isFree}>
                <SelectTrigger className="bg-muted border-border text-foreground h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {isFree
                    ? <SelectItem value="60">First 60 min (09:30–10:30)</SelectItem>
                    : IB_WINDOWS.map((w) => <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>)
                  }
                </SelectContent>
              </Select>
              {isFree && <p className="text-[9px] text-muted-foreground">🔒 Upgrade for more windows</p>}
            </div>
          )}
        </div>

        <Button type="submit" disabled={loading} className="w-full h-8 text-xs shrink-0">
          {loading ? (
            <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Analyzing…</>
          ) : (
            <><Play className="mr-1.5 h-3.5 w-3.5" /> Run Analysis</>
          )}
        </Button>
      </div>
    </form>
  );
};

export default ControlPanel;
