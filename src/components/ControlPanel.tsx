import { useState } from "react";
import { Loader2, Play, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type AnalysisMode = "ib" | "momentum" | "occ" | "gapfill" | "nygap";

export interface MomentumParams {
  /** legacy — unused */
  lookback: number;
  /** legacy — unused */
  stopLoss: number;
  /** Multiplier untuk Super Momentum (body > N × avgBody body SMA15) */
  takeProfit: number;
}

interface ControlPanelProps {
  onRun: (symbol: string, ibWindow: number, maxDays: number, mode: AnalysisMode, momentumParams?: MomentumParams) => void;
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
  { value: "365", label: "Last 12 Months" },
];

const ControlPanel = ({ onRun, loading, isFree = false }: ControlPanelProps) => {
  const [symbol, setSymbol] = useState("QQQ");
  const [ibWindow, setIbWindow] = useState(isFree ? "60" : "30");
  const [maxDays, setMaxDays] = useState(isFree ? "7" : "15");
  const [mode, setMode] = useState<AnalysisMode>("ib");

  // Momentum Candle params
  const [superMult, setSuperMult] = useState("1.5");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol.trim()) return;
    const momentumParams: MomentumParams = {
      lookback: 15,
      stopLoss: 0,
      takeProfit: parseFloat(superMult),
    };
    onRun(symbol.trim().toUpperCase(), parseInt(ibWindow), parseInt(maxDays), mode, momentumParams);
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
            {!isFree && <SelectItem value="momentum">Momentum Candle @ NY Open</SelectItem>}
            {!isFree && <SelectItem value="occ">Opening Candle Continuation</SelectItem>}
            {!isFree && <SelectItem value="gapfill">Gap Fill Statistics</SelectItem>}
            {!isFree && <SelectItem value="nygap">NY Gap M15 Probability</SelectItem>}
          </SelectContent>
        </Select>
        {isFree && <p className="text-[10px] text-muted-foreground">🔒 Upgrade to Pro for more modes</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="symbol" className="text-sm text-muted-foreground">Ticker Symbol</Label>
        <Input id="symbol" placeholder="QQQ" value={symbol} onChange={(e) => setSymbol(e.target.value)}
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
              : DAY_OPTIONS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)
            }
          </SelectContent>
        </Select>
        {isFree && <p className="text-[10px] text-muted-foreground">🔒 Upgrade to Pro for more days</p>}
      </div>

      {mode !== "occ" && mode !== "gapfill" && mode !== "nygap" && (
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">IB Window</Label>
          <Select value={isFree ? "60" : ibWindow} onValueChange={(v) => !isFree && setIbWindow(v)} disabled={isFree}>
            <SelectTrigger className="bg-muted border-border text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {isFree
                ? <SelectItem value="60">First 60 min (09:30–10:30)</SelectItem>
                : IB_WINDOWS.map((w) => <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>)
              }
            </SelectContent>
          </Select>
          {isFree && <p className="text-[10px] text-muted-foreground">🔒 Upgrade to Pro for more windows</p>}
        </div>
      )}

      {/* Momentum Candle @ NY Open Parameters */}
      {mode === "momentum" && !isFree && (
        <div className="space-y-2 border-t border-border/20 pt-2">
          <div className="text-[10px] font-semibold text-primary uppercase tracking-wide">momentum candle params</div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">super momentum multiplier</Label>
            <Select value={superMult} onValueChange={setSuperMult}>
              <SelectTrigger className="bg-muted border-border text-foreground h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["1.2", "1.5", "1.75", "2.0", "2.5", "3.0"].map((v) => (
                  <SelectItem key={v} value={v}>{v}× avg body</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-[9px] text-muted-foreground leading-tight">
            scan candle pembuka 09:30 ET (M15). body &gt; multiplier × SMA15 body = <span className="text-emerald-400">super bull</span> / <span className="text-fuchsia-400">super bear</span>.
          </p>
        </div>
      )}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Analyzing…
          </>
        ) : (
          <>
            <Play className="mr-2 h-4 w-4" />
            Run Analysis
          </>
        )}
      </Button>
    </form>
  );
};

export default ControlPanel;
