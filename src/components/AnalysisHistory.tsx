import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";
import type { AnalysisRun } from "@/hooks/useAnalysisHistory";

interface AnalysisHistoryProps {
  runs: AnalysisRun[];
  onDelete: (id: string) => void;
  onSelect: (run: AnalysisRun) => void;
  selectedId?: string;
}

const typeConfig: Record<string, { label: string; color: string }> = {
  ib: { label: "IB", color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
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
    const ibMin = s.ibWindow || 30;
    const candidates: { label: string; pct: number }[] = [];
    if (hf && hf.total > 0) {
      candidates.push(
        { label: `High 1st → Break High`, pct: (hf.breakHigh / hf.total) * 100 },
        { label: `High 1st → Break Low`, pct: (hf.breakLow / hf.total) * 100 },
        { label: `High 1st → Inside`, pct: (hf.inside / hf.total) * 100 },
      );
    }
    if (lf && lf.total > 0) {
      candidates.push(
        { label: `Low 1st → Break High`, pct: (lf.breakHigh / lf.total) * 100 },
        { label: `Low 1st → Break Low`, pct: (lf.breakLow / lf.total) * 100 },
        { label: `Low 1st → Inside`, pct: (lf.inside / lf.total) * 100 },
      );
    }
    const top = candidates.sort((a, b) => b.pct - a.pct)[0];
    if (!top) return "";
    return `${ibMin}min ${top.label} ${top.pct.toFixed(0)}%`;
  }

  if (run.analysis_type === "momentum") {
    const tfStats = s.tfStats;
    if (!tfStats) return "";
    const candidates: { label: string; pct: number }[] = [];
    for (const tf of Object.keys(tfStats)) {
      const st = tfStats[tf];
      if (st?.highFirst?.total > 0) {
        const t = st.highFirst.total;
        candidates.push(
          { label: `${tf} High 1st → Bull`, pct: (st.highFirst.bullish / t) * 100 },
          { label: `${tf} High 1st → Bear`, pct: (st.highFirst.bearish / t) * 100 },
        );
      }
      if (st?.lowFirst?.total > 0) {
        const t = st.lowFirst.total;
        candidates.push(
          { label: `${tf} Low 1st → Bull`, pct: (st.lowFirst.bullish / t) * 100 },
          { label: `${tf} Low 1st → Bear`, pct: (st.lowFirst.bearish / t) * 100 },
        );
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
      if (d?.bullishFirst?.total > 0) {
        const t = d.bullishFirst.total;
        candidates.push({ label: `${tf} C1 Bull → Valid`, pct: (d.bullishFirst.valid / t) * 100 });
      }
      if (d?.bearishFirst?.total > 0) {
        const t = d.bearishFirst.total;
        candidates.push({ label: `${tf} C1 Bear → Valid`, pct: (d.bearishFirst.valid / t) * 100 });
      }
    }
    const top = candidates.sort((a, b) => b.pct - a.pct)[0];
    return top ? `${top.label} ${top.pct.toFixed(0)}%` : "";
  }

  if (run.analysis_type === "gapfill") {
    const st = s.stats;
    if (!st) return "";
    const candidates: { label: string; pct: number }[] = [];
    if (st.totalGapUp > 0) candidates.push({ label: "Gap Up Fill", pct: st.gapUpFillRate });
    if (st.totalGapDown > 0) candidates.push({ label: "Gap Down Fill", pct: st.gapDownFillRate });
    candidates.push({ label: "Overall Fill", pct: st.overallFillRate });
    const top = candidates.sort((a, b) => b.pct - a.pct)[0];
    return top ? `${top.label} ${top.pct.toFixed(0)}%` : "";
  }

  return "";
}

const AnalysisHistory = ({ runs, onDelete, onSelect, selectedId }: AnalysisHistoryProps) => {
  return (
    <div className="rounded-lg border border-border/30 bg-card/40 backdrop-blur-md shadow-lg flex flex-col h-full">
      <div className="px-3 py-2.5 border-b border-border/20">
        <h3 className="text-xs font-semibold text-card-foreground">📊 Report History</h3>
        <p className="text-[10px] text-muted-foreground mt-0.5">{runs.length} runs recorded</p>
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2 space-y-1">
          {runs.length === 0 && (
            <p className="text-[10px] text-muted-foreground text-center py-4">No analysis runs yet</p>
          )}
          {runs.map((run) => {
            const cfg = typeConfig[run.analysis_type] || { label: run.analysis_type, color: "bg-muted text-muted-foreground" };
            const isSelected = run.id === selectedId;
            const totalDays = run.summary?.totalDays ?? "—";
            const topFinding = getTopFinding(run);
            const time = new Date(run.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            const date = new Date(run.created_at).toLocaleDateString([], { month: "short", day: "numeric" });

            return (
              <button
                key={run.id}
                onClick={() => onSelect(run)}
                className={`w-full text-left rounded-md border px-2.5 py-1.5 transition-colors text-[11px] group ${
                  isSelected
                    ? "ring-1 ring-primary border-primary/40 bg-primary/10"
                    : "border-border/20 bg-muted/20 hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 shrink-0 ${cfg.color}`}>
                      {cfg.label}
                    </Badge>
                    <span className="font-semibold text-card-foreground truncate">{run.symbol}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(run.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
                {topFinding && (
                  <p className="mt-0.5 text-[10px] font-medium text-primary truncate">{topFinding}</p>
                )}
                <div className="flex items-center justify-between mt-0.5 text-[10px] text-muted-foreground">
                  <span>{totalDays} days</span>
                  <span>{date} {time}</span>
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};

export default AnalysisHistory;
