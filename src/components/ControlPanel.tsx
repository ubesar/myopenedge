import { useState } from "react";
import { Loader2, Play, Save } from "lucide-react";
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
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Custom Templates */}
      <div>
        <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
          custom templates
        </h3>
        <button
          type="button"
          className="w-full flex items-center justify-center gap-2 rounded-md border border-border/50 bg-secondary/50 px-3 py-2 text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors lowercase"
        >
          <Save className="h-3.5 w-3.5" />
          save as new template
        </button>
      </div>

      {/* Reports & Customizations */}
      <div>
        <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
          reports & customizations
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] text-muted-foreground lowercase mb-1.5 block">report</label>
            <Select value={isFree ? "ib" : mode} onValueChange={(v) => !isFree && setMode(v as AnalysisMode)} disabled={isFree}>
              <SelectTrigger className="bg-secondary/50 border-border/50 text-foreground text-xs h-9 rounded-md lowercase">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border/50">
                <SelectItem value="ib" className="lowercase text-xs">IB: initial balance breakout</SelectItem>
                {!isFree && <SelectItem value="momentum" className="lowercase text-xs">momentum candle</SelectItem>}
                {!isFree && <SelectItem value="occ" className="lowercase text-xs">opening candle continuation</SelectItem>}
                {!isFree && <SelectItem value="gapfill" className="lowercase text-xs">gap fill statistics</SelectItem>}
              </SelectContent>
            </Select>
            {isFree && <p className="text-[10px] text-muted-foreground mt-1">🔒 upgrade to pro for more reports</p>}
          </div>
        </div>
      </div>

      {/* Ticker & Timeframe */}
      <div>
        <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
          ticker & timeframe
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] text-muted-foreground lowercase mb-1.5 block">asset & ticker</label>
            <Input
              placeholder="QQQ"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="bg-secondary/50 border-border/50 text-foreground placeholder:text-muted-foreground uppercase text-xs h-9 rounded-md"
            />
          </div>

          {mode !== "occ" && mode !== "gapfill" && (
            <div>
              <label className="text-[11px] text-muted-foreground lowercase mb-1.5 block">session / IB window</label>
              <Select value={isFree ? "60" : ibWindow} onValueChange={(v) => !isFree && setIbWindow(v)} disabled={isFree}>
                <SelectTrigger className="bg-secondary/50 border-border/50 text-foreground text-xs h-9 rounded-md lowercase">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border/50">
                  {isFree
                    ? <SelectItem value="60" className="lowercase text-xs">first 60 min (09:30–10:30)</SelectItem>
                    : IB_WINDOWS.map((w) => <SelectItem key={w.value} value={w.value} className="lowercase text-xs">{w.label}</SelectItem>)
                  }
                </SelectContent>
              </Select>
              {isFree && <p className="text-[10px] text-muted-foreground mt-1">🔒 upgrade for more windows</p>}
            </div>
          )}

          <div>
            <label className="text-[11px] text-muted-foreground lowercase mb-1.5 block">date range</label>
            <Select value={isFree ? "7" : maxDays} onValueChange={(v) => !isFree && setMaxDays(v)} disabled={isFree}>
              <SelectTrigger className="bg-secondary/50 border-border/50 text-foreground text-xs h-9 rounded-md lowercase">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border/50">
                {isFree
                  ? <SelectItem value="7" className="lowercase text-xs">last 7 days</SelectItem>
                  : DAY_OPTIONS.map((d) => <SelectItem key={d.value} value={d.value} className="lowercase text-xs">{d.label}</SelectItem>)
                }
              </SelectContent>
            </Select>
            {isFree && <p className="text-[10px] text-muted-foreground mt-1">🔒 upgrade for more days</p>}
          </div>

          <div>
            <label className="text-[11px] text-muted-foreground lowercase mb-1.5 block">session</label>
            <Select defaultValue="rth">
              <SelectTrigger className="bg-secondary/50 border-border/50 text-foreground text-xs h-9 rounded-md lowercase">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border/50">
                <SelectItem value="rth" className="lowercase text-xs">regular trading hours (RTH)</SelectItem>
                <SelectItem value="eth" className="lowercase text-xs">extended trading hours (ETH)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Run Button */}
      <Button
        type="submit"
        disabled={loading}
        className="w-full h-10 rounded-md text-xs font-semibold lowercase bg-primary hover:bg-primary/90"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            analyzing…
          </>
        ) : (
          <>
            <Play className="mr-2 h-4 w-4" />
            run analysis
          </>
        )}
      </Button>
    </form>
  );
};

export default ControlPanel;
