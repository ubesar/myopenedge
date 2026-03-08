import { useState } from "react";
import { Loader2, Play, Plus, Bookmark } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AnalysisMode } from "@/components/ControlPanel";

export type OCCTimeframe = "M5" | "M15" | "M30" | "H1";

interface ParameterPanelProps {
  onRun: (symbol: string, ibWindow: number, maxDays: number, mode: AnalysisMode) => void;
  loading: boolean;
  isFree?: boolean;
  occTimeframe?: OCCTimeframe;
  onOccTimeframeChange?: (tf: OCCTimeframe) => void;
}

const IB_WINDOWS = [
  { value: "15", label: "First 15 min" },
  { value: "30", label: "First 30 min" },
  { value: "60", label: "First 60 min" },
  { value: "90", label: "First 90 min" },
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

const TF_OPTIONS = [
  { value: "M5", label: "M5 (5 min)" },
  { value: "M15", label: "M15 (15 min)" },
  { value: "M30", label: "M30 (30 min)" },
  { value: "H1", label: "H1 (60 min)" },
];

const ParameterPanel = ({ onRun, loading, isFree = false, occTimeframe = "M15", onOccTimeframeChange }: ParameterPanelProps) => {
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
    <div className="h-full border-r border-border bg-surface overflow-y-auto w-[260px] shrink-0">
      <form onSubmit={handleSubmit} className="p-4 space-y-5">

        {/* Custom Templates */}
        <div className="space-y-2">
          <p className="section-label">custom templates</p>
          <Select defaultValue="custom">
            <SelectTrigger className="bg-input border-border text-[13px] text-foreground">
              <SelectValue placeholder="template" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="custom">custom – not saved</SelectItem>
            </SelectContent>
          </Select>
          <button
            type="button"
            className="w-full flex items-center justify-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg px-3 py-2 text-[13px] font-medium transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            save as new template
          </button>
        </div>

        {/* Reports & Customizations */}
        <div className="space-y-2">
          <p className="section-label">reports & customizations</p>
          <p className="text-[11px] text-muted-foreground">report</p>
          <Select value={isFree ? "ib" : mode} onValueChange={(v) => !isFree && setMode(v as AnalysisMode)} disabled={isFree}>
            <SelectTrigger className="bg-input border-border text-[13px] text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ib">IB: initial balance breakout</SelectItem>
              {!isFree && <SelectItem value="momentum">momentum candle</SelectItem>}
              {!isFree && <SelectItem value="occ">opening candle continuation</SelectItem>}
              {!isFree && <SelectItem value="gapfill">gap fill statistics</SelectItem>}
            </SelectContent>
          </Select>
          {isFree && <p className="text-[10px] text-muted-foreground">🔒 upgrade to pro for all modes</p>}

          <p className="text-[11px] text-muted-foreground">subreport</p>
          <Select defaultValue="rejection">
            <SelectTrigger className="bg-input border-border text-[13px] text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rejection">by rejection</SelectItem>
              <SelectItem value="extension">by extension</SelectItem>
            </SelectContent>
          </Select>

          <button
            type="button"
            className="w-full flex items-center justify-center gap-1.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg px-3 py-2 text-[13px] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            customize
          </button>
        </div>

        {/* Ticker & Timeframe */}
        <div className="space-y-2">
          <p className="section-label">ticker & timeframe</p>

          <p className="text-[11px] text-muted-foreground">asset & ticker</p>
          <Input
            placeholder="QQQ"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="bg-input border-border text-[13px] text-foreground placeholder:text-muted-foreground uppercase"
          />

          <p className="text-[11px] text-muted-foreground">date range</p>
          <Select value={isFree ? "7" : maxDays} onValueChange={(v) => !isFree && setMaxDays(v)} disabled={isFree}>
            <SelectTrigger className="bg-input border-border text-[13px] text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {isFree
                ? <SelectItem value="7">Last 7 Days</SelectItem>
                : DAY_OPTIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))
              }
            </SelectContent>
          </Select>
          {isFree && <p className="text-[10px] text-muted-foreground">🔒 upgrade to pro for more days</p>}

          {mode !== "occ" && mode !== "gapfill" && (
            <>
              <p className="text-[11px] text-muted-foreground">IB window</p>
              <Select value={isFree ? "60" : ibWindow} onValueChange={(v) => !isFree && setIbWindow(v)} disabled={isFree}>
                <SelectTrigger className="bg-input border-border text-[13px] text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {isFree
                    ? <SelectItem value="60">First 60 min</SelectItem>
                    : IB_WINDOWS.map((w) => (
                        <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>
                      ))
                  }
                </SelectContent>
              </Select>
              {isFree && <p className="text-[10px] text-muted-foreground">🔒 upgrade to pro for more windows</p>}
            </>
          )}
        </div>

        {/* Run button */}
        <button
          type="submit"
          disabled={loading || !symbol.trim()}
          className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors"
        >
          {loading ? (
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
      </form>
    </div>
  );
};

export default ParameterPanel;
