import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Trash2, Bookmark, HelpCircle, TrendingUp, Eye } from "lucide-react";
import type { AnalysisRun } from "@/hooks/useAnalysisHistory";

interface RightSidebarProps {
  runs: AnalysisRun[];
  onDelete: (id: string) => void;
  onSelect: (run: AnalysisRun) => void;
  selectedId?: string;
  onSignOut: () => void;
}

const typeConfig: Record<string, { label: string; color: string }> = {
  ib: { label: "IB", color: "bg-primary/15 text-primary border-primary/30" },
  momentum: { label: "Momentum", color: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  occ: { label: "OCC", color: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
  gapfill: { label: "Gap Fill", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
};

const bookmarkStrategies = [
  "gap fill", "inside bars", "outside days", "ib breakout", "momentum continuation", "opening range",
];

const watchlistItems = [
  { ticker: "QQQ", change: "+1.24%", positive: true },
  { ticker: "TSLA", change: "-0.87%", positive: false },
  { ticker: "NQ", change: "+0.56%", positive: true },
  { ticker: "GC", change: "+0.12%", positive: true },
  { ticker: "ES", change: "-0.34%", positive: false },
  { ticker: "SPY", change: "+0.91%", positive: true },
];

function getTopFinding(run: AnalysisRun): string {
  const s = run.summary || {};
  if (run.analysis_type === "ib") {
    const hf = s.highFirst; const lf = s.lowFirst;
    if (!hf && !lf) return "";
    const candidates: { label: string; pct: number }[] = [];
    if (hf?.total > 0) {
      candidates.push({ label: "H1st→BH", pct: (hf.breakHigh / hf.total) * 100 });
      candidates.push({ label: "H1st→BL", pct: (hf.breakLow / hf.total) * 100 });
    }
    if (lf?.total > 0) {
      candidates.push({ label: "L1st→BH", pct: (lf.breakHigh / lf.total) * 100 });
      candidates.push({ label: "L1st→BL", pct: (lf.breakLow / lf.total) * 100 });
    }
    const top = candidates.sort((a, b) => b.pct - a.pct)[0];
    return top ? `${top.label} ${top.pct.toFixed(0)}%` : "";
  }
  if (run.analysis_type === "momentum") {
    const tfStats = s.tfStats;
    if (!tfStats) return "";
    const candidates: { label: string; pct: number }[] = [];
    for (const tf of Object.keys(tfStats)) {
      const st = tfStats[tf];
      if (st?.highFirst?.total > 0) candidates.push({ label: `${tf} Bull`, pct: (st.highFirst.bullish / st.highFirst.total) * 100 });
      if (st?.lowFirst?.total > 0) candidates.push({ label: `${tf} Bull`, pct: (st.lowFirst.bullish / st.lowFirst.total) * 100 });
    }
    const top = candidates.sort((a, b) => b.pct - a.pct)[0];
    return top ? `${top.label} ${top.pct.toFixed(0)}%` : "";
  }
  if (run.analysis_type === "occ") {
    const tfDir = s.tfDirectionStats;
    if (!tfDir) return "";
    const candidates: { label: string; pct: number }[] = [];
    for (const tf of Object.keys(tfDir)) {
      const d = tfDir[tf];
      if (d?.bullishFirst?.total > 0) candidates.push({ label: `${tf} Valid`, pct: (d.bullishFirst.valid / d.bullishFirst.total) * 100 });
      if (d?.bearishFirst?.total > 0) candidates.push({ label: `${tf} Valid`, pct: (d.bearishFirst.valid / d.bearishFirst.total) * 100 });
    }
    const top = candidates.sort((a, b) => b.pct - a.pct)[0];
    return top ? `${top.label} ${top.pct.toFixed(0)}%` : "";
  }
  if (run.analysis_type === "gapfill") {
    const st = s.stats;
    if (!st) return "";
    return `Fill ${st.overallFillRate?.toFixed(0)}%`;
  }
  return "";
}

const RightSidebar = ({ runs, onDelete, onSelect, selectedId, onSignOut }: RightSidebarProps) => {
  return (
    <aside className="w-[240px] shrink-0 border-l border-border/50 bg-sidebar flex flex-col h-full">
      {/* Help */}
      <div className="px-3 py-3 border-b border-border/30">
        <div className="flex items-center gap-2 mb-2">
          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
          <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">help</h3>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] text-primary cursor-pointer hover:underline lowercase">how to use the reports</p>
          <p className="text-[10px] text-primary cursor-pointer hover:underline lowercase">quick explainer video</p>
        </div>
      </div>

      {/* Bookmarks */}
      <div className="px-3 py-3 border-b border-border/30">
        <div className="flex items-center gap-2 mb-2">
          <Bookmark className="h-3.5 w-3.5 text-muted-foreground" />
          <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">bookmarks</h3>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {bookmarkStrategies.map((s) => (
            <span
              key={s}
              className="px-2 py-0.5 rounded-md bg-secondary/60 text-[10px] text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer transition-colors lowercase"
            >
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* Watchlist */}
      <div className="px-3 py-3 border-b border-border/30">
        <div className="flex items-center gap-2 mb-2">
          <Eye className="h-3.5 w-3.5 text-muted-foreground" />
          <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">watchlist</h3>
        </div>
        <div className="space-y-1">
          {watchlistItems.map((item) => (
            <div key={item.ticker} className="flex items-center justify-between py-1 px-1 rounded hover:bg-secondary/40 cursor-pointer transition-colors">
              <div className="flex items-center gap-1.5">
                <TrendingUp className={`h-3 w-3 ${item.positive ? "text-emerald-400" : "text-red-400"}`} />
                <span className="text-[11px] text-foreground font-medium uppercase">{item.ticker}</span>
              </div>
              <span className={`text-[10px] font-medium ${item.positive ? "text-emerald-400" : "text-red-400"}`}>
                {item.change}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Report History */}
      <div className="px-3 py-2 border-b border-border/30">
        <div className="flex items-center gap-2">
          <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">report history</h3>
          <span className="text-[10px] text-muted-foreground ml-auto">{runs.length}</span>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2 space-y-1">
          {runs.length === 0 && (
            <p className="text-[10px] text-muted-foreground text-center py-4 lowercase">no analysis runs yet</p>
          )}
          {runs.map((run) => {
            const cfg = typeConfig[run.analysis_type] || { label: run.analysis_type, color: "bg-muted text-muted-foreground" };
            const isSelected = run.id === selectedId;
            const topFinding = getTopFinding(run);
            const time = new Date(run.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

            return (
              <button
                key={run.id}
                onClick={() => onSelect(run)}
                className={`w-full text-left rounded-md border px-2.5 py-2 transition-colors text-[11px] group ${
                  isSelected
                    ? "ring-1 ring-primary border-primary/40 bg-primary/10"
                    : "border-border/20 bg-card/30 hover:bg-card/60"
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 shrink-0 ${cfg.color}`}>
                      {cfg.label}
                    </Badge>
                    <span className="font-semibold text-foreground truncate uppercase text-[10px]">{run.symbol}</span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(run.id); }}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
                {topFinding && (
                  <p className="mt-0.5 text-[10px] font-medium text-primary truncate">{topFinding}</p>
                )}
                <div className="flex items-center justify-between mt-0.5 text-[9px] text-muted-foreground">
                  <span>{run.summary?.totalDays ?? "—"} days</span>
                  <span>{time}</span>
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>

      {/* Sign out */}
      <div className="px-3 py-2 border-t border-border/30">
        <button
          onClick={onSignOut}
          className="w-full text-[11px] text-muted-foreground hover:text-foreground transition-colors lowercase py-1"
        >
          sign out
        </button>
      </div>
    </aside>
  );
};

export default RightSidebar;
