import { HelpCircle, PlayCircle, Plus, Filter, TrendingUp } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { AnalysisRun } from "@/hooks/useAnalysisHistory";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";

interface RightSidebarProps {
  runs: AnalysisRun[];
  onDelete: (id: string) => void;
  onSelect: (run: AnalysisRun) => void;
  selectedId?: string;
}

const bookmarks = [
  "gap fill by size",
  "IB: init... by rejection",
  "inside bars",
  "IB: initial balance breakout",
  "IB: initial ... by levels",
  "outside days",
  "opening range indicator",
];

const stockWatchlist = ["QQQ", "TSLA", "NVDA", "SPY", "BULL", "GLD", "HIMS"];
const futuresWatchlist = ["MNQ", "MGC", "MYM", "MES"];

const typeConfig: Record<string, { label: string; color: string }> = {
  ib: { label: "IB", color: "bg-primary/15 text-primary border-primary/30" },
  momentum: { label: "Mom", color: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  occ: { label: "OCC", color: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
  gapfill: { label: "Gap", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
};

const RightSidebar = ({ runs, onDelete, onSelect, selectedId }: RightSidebarProps) => {
  return (
    <div className="h-full border-l border-border bg-surface w-[240px] shrink-0 overflow-y-auto">
      <div className="p-4 space-y-5">

        {/* Help */}
        <div className="space-y-2">
          <p className="section-label">help</p>
          <button className="w-full flex items-center gap-2 text-[12px] text-muted-foreground hover:text-foreground transition-colors py-1">
            <HelpCircle className="h-4 w-4 shrink-0" />
            how to use the reports
          </button>
          <button className="w-full flex items-center gap-2 text-[12px] text-muted-foreground hover:text-foreground transition-colors py-1">
            <PlayCircle className="h-4 w-4 shrink-0" />
            quick explainer video
          </button>
        </div>

        {/* Custom Templates */}
        <div className="space-y-2">
          <p className="section-label">custom templates</p>
          <div className="flex gap-1">
            <button className="px-3 py-1 rounded-lg bg-primary text-primary-foreground text-[11px] font-medium">
              this report
            </button>
            <button className="px-3 py-1 rounded-lg bg-secondary text-secondary-foreground text-[11px]">
              all templates
            </button>
          </div>
          <div className="flex items-center gap-2 text-[12px] text-foreground py-1">
            <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
            IB By Rejection Template
          </div>
        </div>

        {/* Report History */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="section-label">report history</p>
            <span className="text-[10px] text-muted-foreground">{runs.length}</span>
          </div>
          <div className="space-y-1">
            {runs.length === 0 && (
              <p className="text-[11px] text-muted-foreground py-2">no runs yet</p>
            )}
            {runs.map((run) => {
              const cfg = typeConfig[run.analysis_type] || { label: run.analysis_type, color: "bg-muted text-muted-foreground" };
              const isSelected = run.id === selectedId;
              const time = new Date(run.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
              return (
                <button
                  key={run.id}
                  onClick={() => onSelect(run)}
                  className={`w-full text-left rounded-lg border px-2.5 py-1.5 text-[11px] group transition-colors ${
                    isSelected
                      ? "border-primary/40 bg-primary/10"
                      : "border-border bg-card hover:bg-secondary"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className={`text-[9px] px-1 py-0 h-4 ${cfg.color}`}>
                        {cfg.label}
                      </Badge>
                      <span className="font-medium text-foreground">{run.symbol}</span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(run.id); }}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-0.5 text-[10px] text-muted-foreground">
                    <span>{run.summary?.totalDays ?? "—"} days</span>
                    <span>{time}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bookmarks */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="section-label">bookmarks</p>
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <p className="text-[11px] text-muted-foreground font-medium">price action</p>
          <div className="space-y-1">
            {bookmarks.map((b) => (
              <div key={b} className="flex items-center gap-2 text-[12px] text-foreground/70 py-0.5">
                <div className="h-2.5 w-2.5 rounded-sm bg-primary/60 shrink-0" />
                {b}
              </div>
            ))}
          </div>
        </div>

        {/* Watchlist */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <p className="section-label">watchlist</p>
            <Plus className="h-3.5 w-3.5 text-muted-foreground" />
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <p className="text-[11px] text-muted-foreground font-medium">stock</p>
          <div className="space-y-0.5">
            {stockWatchlist.map((t) => (
              <div key={t} className="flex items-center gap-2 text-[12px] text-foreground/70 py-0.5">
                <TrendingUp className="h-3.5 w-3.5 text-profit shrink-0" />
                {t}
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground font-medium mt-2">futures</p>
          <div className="space-y-0.5">
            {futuresWatchlist.map((t) => (
              <div key={t} className="flex items-center gap-2 text-[12px] text-foreground/70 py-0.5">
                <TrendingUp className="h-3.5 w-3.5 text-profit shrink-0" />
                {t}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RightSidebar;
