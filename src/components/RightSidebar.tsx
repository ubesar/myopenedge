import { HelpCircle, PlayCircle, Plus, Filter, TrendingUp } from "lucide-react";
import type { AnalysisTemplate, TemplateParams } from "@/hooks/useTemplates";
import type { AnalysisMode } from "@/components/ControlPanel";
import type { OCCTimeframe, MomentumBodyRatio, OCCBodyRatio } from "@/components/ParameterPanel";

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

const modeLabels: Record<string, string> = {
  ib: "IB",
  momentum: "Mom",
  occ: "OCC",
  gapfill: "Gap",
  insidebar: "InsB",
};

interface RightSidebarProps {
  templates?: AnalysisTemplate[];
  activeMode?: AnalysisMode;
  onLoadTemplate?: (params: TemplateParams) => void;
}

const RightSidebar = ({ templates = [], activeMode, onLoadTemplate }: RightSidebarProps) => {
  const filteredTemplates = activeMode
    ? templates.filter((t) => t.mode === activeMode)
    : templates;

  const handleClick = (tpl: AnalysisTemplate) => {
    onLoadTemplate?.({
      mode: tpl.mode as AnalysisMode,
      symbol: tpl.symbol,
      ibWindow: tpl.ib_window,
      maxDays: tpl.max_days,
      bodyRatio: (tpl.body_ratio || "0.50") as MomentumBodyRatio,
      occBodyRatio: (tpl.occ_body_ratio || "0.50") as OCCBodyRatio,
      occTimeframe: (tpl.occ_timeframe || "M15") as OCCTimeframe,
    });
  };

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
            <button className={`px-3 py-1 rounded-lg text-[11px] font-medium ${activeMode ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
              this report ({filteredTemplates.length})
            </button>
            <button className={`px-3 py-1 rounded-lg text-[11px] ${activeMode ? "bg-secondary text-secondary-foreground" : "bg-primary text-primary-foreground"}`}>
              all ({templates.length})
            </button>
          </div>
          {(activeMode ? filteredTemplates : templates).length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic">no saved templates</p>
          ) : (
            <div className="space-y-1">
              {(activeMode ? filteredTemplates : templates).map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleClick(t)}
                  className="w-full flex items-center gap-2 text-[12px] text-foreground hover:text-primary transition-colors py-1 text-left"
                >
                  <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                  <span className="truncate flex-1">{t.name}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">{modeLabels[t.mode] || t.mode}</span>
                </button>
              ))}
            </div>
          )}
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
