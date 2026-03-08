import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Trash2, Bookmark, HelpCircle, FileText } from "lucide-react";
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

function getTopFinding(run: AnalysisRun): string {
  const s = run.summary || {};
  if (run.analysis_type === "ib") {
    const hf = s.highFirst;
    const lf = s.lowFirst;
    if (!hf && !lf) return "";
    const candidates: { label: string; pct: number }[] = [];
    if (hf && hf.total > 0) {
      candidates.push(
        { label: `High 1st → BH`, pct: (hf.breakHigh / hf.total) * 100 },
        { label: `High 1st → BL`, pct: (hf.breakLow / hf.total) * 100 },
      );
    }
    if (lf && lf.total > 0) {
      candidates.push(
        { label: `Low 1st → BH`, pct: (lf.breakHigh / lf.total) * 100 },
        { label: `Low 1st → BL`, pct: (lf.breakLow / lf.total) * 100 },
      );
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
      if (st?.highFirst?.total > 0) {
        candidates.push({ label: `${tf} H1st → Bull`, pct: (st.highFirst.bullish / st.highFirst.total) * 100 });
      }
      if (st?.lowFirst?.total > 0) {
        candidates.push({ label: `${tf} L1st → Bull`, pct: (st.lowFirst.bullish / st.lowFirst.total) * 100 });
      }
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
      if (d?.bullishFirst?.total > 0) candidates.push({ label: `${tf} Bull → Valid`, pct: (d.bullishFirst.valid / d.bullishFirst.total) * 100 });
      if (d?.bearishFirst?.total > 0) candidates.push({ label: `${tf} Bear → Valid`, pct: (d.bearishFirst.valid / d.bearishFirst.total) * 100 });
    }
    const top = candidates.sort((a, b) => b.pct - a.pct)[0];
    return top ? `${top.label} ${top.pct.toFixed(0)}%` : "";
  }
  if (run.analysis_type === "gapfill") {
    const st = s.stats;
    if (!st) return "";
    return `Overall Fill ${st.overallFillRate?.toFixed(0)}%`;
  }
  return "";
}

const RightSidebar = ({ runs, onDelete, onSelect, selectedId, onSignOut }: RightSidebarProps) => {
  return (
    <aside className="w-[260px] shrink-0 border-l border-border/30 bg-sidebar flex flex-col h-full">
      {/* Help section */}
      <div className="px-3 py-3 border-b border-border/20">
        <div className="flex items-center gap-2 mb-2">
          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
          <h3 className="text-xs font-semibold text-foreground lowercase">help</h3>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] text-primary cursor-pointer hover:underline lowercase">how to use the reports</p>
          <p className="text-[10px] text-primary cursor-pointer hover:underline lowercase">quick explainer video</p>
        </div>
      </div>

      {/* Bookmarks / Report History */}
      <div className="px-3 py-3 border-b border-border/20">
        <div className="flex items-center gap-2 mb-2">
          <Bookmark className="h-3.5 w-3.5 text-muted-foreground" />
          <h3 className="text-xs font-semibold text-foreground lowercase">report history</h3>
          <span className="text-[10px] text-muted-foreground ml-auto">{runs.length}</span>
        </div>
      </div>

      {/* Runs list */}
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
            const date = new Date(run.created_at).toLocaleDateString([], { month: "short", day: "numeric" });

            return (
              <button
                key={run.id}
                onClick={() => onSelect(run)}
                className={`w-full text-left rounded-lg border px-2.5 py-2 transition-colors text-[11px] group ${
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
                    <span className="font-semibold text-foreground truncate uppercase">{run.symbol}</span>
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
                <div className="flex items-center justify-between mt-0.5 text-[10px] text-muted-foreground">
                  <span>{run.summary?.totalDays ?? "—"} days</span>
                  <span>{date} {time}</span>
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>

      {/* Sign out */}
      <div className="px-3 py-2 border-t border-border/20">
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
