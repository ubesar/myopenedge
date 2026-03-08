import { useState } from "react";
import { Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type AnalysisMode = "ib" | "momentum" | "occ" | "gapfill";

interface ControlPanelProps {
  onRun: (symbol: string, ibWindow: number, maxDays: number, mode: AnalysisMode) => void;
  loading: boolean;
  isFree?: boolean;
}

const IB_WINDOWS = [
  { value: "15", label: "first 15 min (09:30–09:45)" },
  { value: "30", label: "first 30 min (09:30–10:00)" },
  { value: "60", label: "first 60 min (09:30–10:30)" },
  { value: "90", label: "first 90 min (09:30–11:00)" },
];

const DAY_OPTIONS = [
  { value: "0", label: "all days" },
  { value: "7", label: "last 7 days" },
  { value: "15", label: "last 15 days" },
  { value: "30", label: "last 30 days" },
  { value: "60", label: "last 60 days" },
  { value: "90", label: "last 90 days" },
  { value: "120", label: "last 120 days" },
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
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Reports & Customizations */}
      <div>
        <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">reports & customizations</h3>
        
        <div className="space-y-3">
          <div>
            <label className="text-[11px] text-muted-foreground lowercase mb-1 block">report</label>
            <Select value={isFree ? "ib" : mode} onValueChange={(v) => !isFree && setMode(v as AnalysisMode)} disabled={isFree}>
              <SelectTrigger className="bg-card border-border/50 text-foreground text-xs h-9 rounded-lg lowercase">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ib" className="lowercase">IB: initial balance breakout</SelectItem>
                {!isFree && <SelectItem value="momentum" className="lowercase">momentum candle</SelectItem>}
                {!isFree && <SelectItem value="occ" className="lowercase">opening candle continuation</SelectItem>}
                {!isFree && <SelectItem value="gapfill" className="lowercase">gap fill statistics</SelectItem>}
              </SelectContent>
            </Select>
            {isFree && <p className="text-[10px] text-muted-foreground mt-1">🔒 upgrade to pro for more reports</p>}
          </div>
        </div>
      </div>

      {/* Ticker & Timeframe */}
      <div>
        <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">ticker & timeframe</h3>
        
        <div className="space-y-3">
          <div>
            <label className="text-[11px] text-muted-foreground lowercase mb-1 block">asset & ticker</label>
            <Input
              placeholder="QQQ"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="bg-card border-border/50 text-foreground placeholder:text-muted-foreground uppercase text-xs h-9 rounded-lg"
            />
          </div>

          <div>
            <label className="text-[11px] text-muted-foreground lowercase mb-1 block">date range</label>
            <Select value={isFree ? "7" : maxDays} onValueChange={(v) => !isFree && setMaxDays(v)} disabled={isFree}>
              <SelectTrigger className="bg-card border-border/50 text-foreground text-xs h-9 rounded-lg lowercase">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {isFree
                  ? <SelectItem value="7" className="lowercase">last 7 days</SelectItem>
                  : DAY_OPTIONS.map((d) => <SelectItem key={d.value} value={d.value} className="lowercase">{d.label}</SelectItem>)
                }
              </SelectContent>
            </Select>
            {isFree && <p className="text-[10px] text-muted-foreground mt-1">🔒 upgrade for more days</p>}
          </div>

          {mode !== "occ" && mode !== "gapfill" && (
            <div>
              <label className="text-[11px] text-muted-foreground lowercase mb-1 block">session / IB window</label>
              <Select value={isFree ? "60" : ibWindow} onValueChange={(v) => !isFree && setIbWindow(v)} disabled={isFree}>
                <SelectTrigger className="bg-card border-border/50 text-foreground text-xs h-9 rounded-lg lowercase">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {isFree
                    ? <SelectItem value="60" className="lowercase">first 60 min (09:30–10:30)</SelectItem>
                    : IB_WINDOWS.map((w) => <SelectItem key={w.value} value={w.value} className="lowercase">{w.label}</SelectItem>)
                  }
                </SelectContent>
              </Select>
              {isFree && <p className="text-[10px] text-muted-foreground mt-1">🔒 upgrade for more windows</p>}
            </div>
          )}
        </div>
      </div>

      <Button type="submit" disabled={loading} className="w-full h-9 rounded-lg text-xs font-medium lowercase">
        {loading ? (
          <>
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            analyzing…
          </>
        ) : (
          <>
            <Play className="mr-2 h-3.5 w-3.5" />
            run analysis
          </>
        )}
      </Button>
    </form>
  );
};

export default ControlPanel;
