import { useState } from "react";
import { Loader2, Play, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type AnalysisMode = "ib" | "momentum" | "occ" | "gapfill" | "insidebar" | "outsideday" | "globex-ib" | "london-ib" | "pullback50" | "ib2575" | "mcm15-2am";

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
  { value: "20", label: "1 Month" },
  { value: "40", label: "2 Months" },
  { value: "60", label: "3 Months" },
  { value: "120", label: "6 Months" },
  { value: "240", label: "12 Months" },
  { value: "480", label: "24 Months" },
  { value: "720", label: "36 Months" },
];

const ControlPanel = ({ onRun, loading, isFree = false }: ControlPanelProps) => {
  const [symbol, setSymbol] = useState("QQQ");
  const [ibWindow, setIbWindow] = useState(isFree ? "60" : "30");
  const [maxDays, setMaxDays] = useState("20");
  const [mode, setMode] = useState<AnalysisMode>("ib");

  const isFreeMode = isFree && mode !== "ib" && mode !== "occ";

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
        <Select value={mode} onValueChange={(v) => setMode(v as AnalysisMode)}>
          <SelectTrigger className="bg-muted border-border text-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ib">Initial Balance (IB)</SelectItem>
            <SelectItem value="occ">Opening Candle Continuation</SelectItem>
            {!isFree && <SelectItem value="globex-ib">Globex IB (Overnight)</SelectItem>}
            {!isFree && <SelectItem value="momentum">Momentum Candle</SelectItem>}
            {!isFree && <SelectItem value="gapfill">Gap Fill Statistics</SelectItem>}
            {!isFree && <SelectItem value="insidebar">Inside Bar</SelectItem>}
            {!isFree && <SelectItem value="outsideday">Outside Day</SelectItem>}
          </SelectContent>
        </Select>
        {isFree && <p className="text-[10px] text-muted-foreground">🔒 Upgrade to Pro for more analysis types</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="symbol" className="text-sm text-muted-foreground">Ticker Symbol</Label>
        <Input
          id="symbol"
          placeholder="QQQ"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          className="bg-muted border-border text-foreground placeholder:text-muted-foreground uppercase"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-sm text-muted-foreground">Trading Days</Label>
        <Select value={isFree ? "20" : maxDays} onValueChange={(v) => !isFree && setMaxDays(v)} disabled={isFree}>
          <SelectTrigger className="bg-muted border-border text-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {isFree
              ? <SelectItem value="20">1 Month</SelectItem>
              : DAY_OPTIONS.map((d) =>
                  <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                )
            }
          </SelectContent>
        </Select>
        {isFree && <p className="text-[10px] text-muted-foreground">🔒 Upgrade to Pro for more days</p>}
      </div>

      {(mode === "ib" || mode === "momentum" || mode === "globex-ib") && (
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">IB Window</Label>
          <Select value={isFree ? "60" : ibWindow} onValueChange={(v) => !isFree && setIbWindow(v)} disabled={isFree}>
            <SelectTrigger className="bg-muted border-border text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {isFree
                ? <SelectItem value="60">First 60 min (09:30–10:30)</SelectItem>
                : IB_WINDOWS.map((w) =>
                    <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>
                  )
              }
            </SelectContent>
          </Select>
          {isFree && <p className="text-[10px] text-muted-foreground">🔒 Upgrade to Pro for more windows</p>}
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
