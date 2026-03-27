import { Plus, X, Play, Loader2 } from "lucide-react";

interface Props {
  marketType: "futures" | "stocks";
  onSwitchMarket: (type: "futures" | "stocks") => void;
  tickers: string[];
  onRemoveTicker: (t: string) => void;
  customTicker: string;
  onCustomTickerChange: (v: string) => void;
  onAddTicker: () => void;
  running: boolean;
  onRun: () => void;
}

export default function WIPControls({
  marketType, onSwitchMarket, tickers, onRemoveTicker,
  customTicker, onCustomTickerChange, onAddTicker, running, onRun,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Market toggle */}
      <div className="flex rounded-lg border border-border overflow-hidden">
        {(["futures", "stocks"] as const).map((type) => (
          <button
            key={type}
            onClick={() => onSwitchMarket(type)}
            className={`px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-colors ${
              marketType === type
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Ticker chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        {tickers.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1.5 bg-secondary text-foreground rounded-lg px-2.5 py-1 text-[11px] font-semibold tracking-wide"
          >
            {t}
            <button onClick={() => onRemoveTicker(t)} className="text-muted-foreground hover:text-loss transition-colors">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>

      {/* Add ticker */}
      <div className="flex items-center gap-1">
        <input
          value={customTicker}
          onChange={(e) => onCustomTickerChange(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && onAddTicker()}
          placeholder="add ticker"
          className="w-[100px] bg-card border border-border rounded-lg px-2.5 py-1.5 text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button onClick={onAddTicker} className="p-1.5 rounded-lg bg-secondary hover:bg-accent transition-colors">
          <Plus className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* Run */}
      <button
        onClick={onRun}
        disabled={running || tickers.length === 0}
        className="flex items-center gap-2 bg-primary text-primary-foreground rounded-lg px-5 py-1.5 text-[12px] font-semibold disabled:opacity-50 transition-colors hover:bg-primary/90"
      >
        {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        {running ? "analyzing..." : "run all reports"}
      </button>
    </div>
  );
}
