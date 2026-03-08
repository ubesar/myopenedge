// --- NEW UI LAYOUT --- Right sidebar panel (Edgeful-inspired)
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, HelpCircle, Bookmark, List } from "lucide-react";
import type { AnalysisRun } from "@/hooks/useAnalysisHistory";

interface RightPanelProps {
  runs: AnalysisRun[];
  onDelete: (id: string) => void;
  onSelect: (run: AnalysisRun) => void;
  selectedId?: string;
  isActive: boolean;
  endDate: string | null;
}

const typeColor: Record<string, string> = {
  ib: "text-primary",
  momentum: "text-[hsl(38,92%,50%)]",
  occ: "text-[hsl(280,65%,60%)]",
  gapfill: "text-[hsl(160,84%,39%)]",
};

const RightPanel = ({ runs, onDelete, onSelect, selectedId, isActive, endDate }: RightPanelProps) => {
  return (
    <aside className="hidden lg:flex flex-col w-[260px] shrink-0 border-l border-border/20 bg-card overflow-hidden">
      {/* Help */}
      <div className="px-4 py-3 border-b border-border/20">
        <div className="flex items-center gap-2 mb-2">
          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
          <h3 className="text-xs font-semibold text-foreground lowercase">help</h3>
        </div>
        <div className="space-y-1">
          <button className="text-[11px] text-primary hover:underline block lowercase">→ how to use the reports</button>
          <button className="text-[11px] text-primary hover:underline block lowercase">→ quick explainer video</button>
        </div>
      </div>

      {/* Bookmarks / Report History */}
      <div className="px-4 py-3 border-b border-border/20">
        <div className="flex items-center gap-2 mb-2">
          <Bookmark className="h-3.5 w-3.5 text-muted-foreground" />
          <h3 className="text-xs font-semibold text-foreground lowercase">report history</h3>
          <span className="ml-auto text-[10px] text-muted-foreground">{runs.length} runs</span>
        </div>
      </div>

      {/* Runs List */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-3 py-2 space-y-1">
          {runs.length === 0 && (
            <p className="text-[10px] text-muted-foreground text-center py-6 lowercase">no analysis runs yet</p>
          )}
          {runs.map((run) => {
            const isSelected = run.id === selectedId;
            const time = new Date(run.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });
            const date = new Date(run.created_at).toLocaleDateString([], {
              month: "short",
              day: "numeric",
            });

            return (
              <button
                key={run.id}
                onClick={() => onSelect(run)}
                className={`w-full text-left rounded-lg px-3 py-2 transition-colors text-[11px] group ${
                  isSelected
                    ? "bg-primary/10 border border-primary/30"
                    : "border border-transparent hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`text-[9px] font-bold uppercase ${typeColor[run.analysis_type] || "text-muted-foreground"}`}>
                      {run.analysis_type}
                    </span>
                    <span className="font-semibold text-foreground truncate">{run.symbol}</span>
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
                <div className="flex items-center justify-between mt-0.5 text-[10px] text-muted-foreground">
                  <span>{run.summary?.totalDays ?? "—"} days</span>
                  <span>
                    {date} {time}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>

      {/* Watchlist */}
      <div className="px-4 py-3 border-t border-border/20">
        <div className="flex items-center gap-2 mb-2">
          <List className="h-3.5 w-3.5 text-muted-foreground" />
          <h3 className="text-xs font-semibold text-foreground lowercase">watchlist</h3>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {["NQ", "ES", "GC", "QQQ", "SPY", "TSLA"].map((t) => (
            <div key={t} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
              {t}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
};

export default RightPanel;
