// --- NEW UI LAYOUT --- Left parameter panel (Edgeful-inspired)
// --- EXISTING LOGIC PRESERVED --- All form state and handlers from ControlPanel
import { useState } from "react";
import { Loader2, Play } from "lucide-react";
import type { AnalysisMode } from "@/components/ControlPanel";

interface ParameterPanelProps {
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

const ANALYSIS_TYPES = [
  { value: "ib", label: "IB: initial balance breakout" },
  { value: "momentum", label: "momentum candle" },
  { value: "occ", label: "opening candle continuation" },
  { value: "gapfill", label: "gap fill statistics" },
];

const selectClass =
  "w-full bg-secondary border border-border/40 rounded-lg px-3 py-2.5 text-sm text-foreground appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary/50 lowercase";

const ParameterPanel = ({ onRun, loading, isFree = false }: ParameterPanelProps) => {
  // --- EXISTING LOGIC PRESERVED ---
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
    <aside className="w-full lg:w-[280px] shrink-0 border-r border-border/20 bg-card overflow-y-auto">
      <form onSubmit={handleSubmit} className="p-4 space-y-5">
        {/* Reports & Customizations */}
        <div>
          <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3 font-semibold">
            reports & customizations
          </h3>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block lowercase">report</label>
              <select
                value={isFree ? "ib" : mode}
                onChange={(e) => !isFree && setMode(e.target.value as AnalysisMode)}
                disabled={isFree}
                className={selectClass}
              >
                {ANALYSIS_TYPES.map((t) =>
                  isFree && t.value !== "ib" ? null : (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  )
                )}
              </select>
              {isFree && (
                <p className="text-[10px] text-muted-foreground mt-1">🔒 upgrade to pro for more reports</p>
              )}
            </div>
          </div>
        </div>

        {/* Ticker & Timeframe */}
        <div>
          <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3 font-semibold">
            ticker & timeframe
          </h3>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block lowercase">asset & ticker</label>
              <input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder="QQQ"
                className="w-full bg-secondary border border-border/40 rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 uppercase"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block lowercase">date range</label>
              <select
                value={isFree ? "7" : maxDays}
                onChange={(e) => !isFree && setMaxDays(e.target.value)}
                disabled={isFree}
                className={selectClass}
              >
                {isFree ? (
                  <option value="7">last 7 days</option>
                ) : (
                  DAY_OPTIONS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))
                )}
              </select>
              {isFree && (
                <p className="text-[10px] text-muted-foreground mt-1">🔒 upgrade to pro for more days</p>
              )}
            </div>

            {mode !== "occ" && mode !== "gapfill" && (
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block lowercase">session / IB window</label>
                <select
                  value={isFree ? "60" : ibWindow}
                  onChange={(e) => !isFree && setIbWindow(e.target.value)}
                  disabled={isFree}
                  className={selectClass}
                >
                  {isFree ? (
                    <option value="60">first 60 min (09:30–10:30)</option>
                  ) : (
                    IB_WINDOWS.map((w) => (
                      <option key={w.value} value={w.value}>
                        {w.label}
                      </option>
                    ))
                  )}
                </select>
                {isFree && (
                  <p className="text-[10px] text-muted-foreground mt-1">🔒 upgrade to pro for more windows</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Run Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50 lowercase"
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
    </aside>
  );
};

export default ParameterPanel;
