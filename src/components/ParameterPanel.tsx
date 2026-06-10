import { useState } from "react";
import { Loader2, Play, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { AnalysisMode } from "@/components/ControlPanel";
import type { AnalysisTemplate, TemplateParams } from "@/hooks/useTemplates";

export type OCCTimeframe = "M5" | "M15" | "M30" | "H1";
export type MomentumBodyRatio = "0.50" | "0.60" | "0.70" | "0.80";
export type OCCBodyRatio = "0.40" | "0.50" | "0.60";

interface ParameterPanelProps {
  onRun: (symbol: string, ibWindow: number, maxDays: number, mode: AnalysisMode, bodyRatio: MomentumBodyRatio, occBodyRatio: OCCBodyRatio, weekdays: number[]) => void;
  loading: boolean;
  isFree?: boolean;
  occTimeframe?: OCCTimeframe;
  onOccTimeframeChange?: (tf: OCCTimeframe) => void;
  templates?: AnalysisTemplate[];
  onSaveTemplate?: (name: string, params: TemplateParams) => void;
  onDeleteTemplate?: (id: string) => void;
  onLoadTemplate?: (params: TemplateParams) => void;
  templateLoading?: boolean;
}

const IB_WINDOWS = [
  { value: "15", label: "First 15 min" },
  { value: "30", label: "First 30 min" },
  { value: "60", label: "First 60 min" },
  { value: "90", label: "First 90 min" },
];

const DAY_OPTIONS = [
  { value: "20", label: "1 Month" },
  { value: "40", label: "2 Months" },
  { value: "60", label: "3 Months" },
  { value: "120", label: "6 Months" },
  { value: "240", label: "12 Months" },
  { value: "480", label: "24 Months" },
  { value: "720", label: "36 Months" },
];

const WEEKDAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
];

const ParameterPanel = ({
  onRun, loading, isFree = false, occTimeframe = "M15", onOccTimeframeChange,
  templates = [], onSaveTemplate, onDeleteTemplate, onLoadTemplate, templateLoading = false,
}: ParameterPanelProps) => {
  const [symbol, setSymbol] = useState("QQQ");
  const [ibWindow, setIbWindow] = useState(isFree ? "60" : "30");
  const [maxDays, setMaxDays] = useState(isFree ? "20" : "20");
  const [mode, setMode] = useState<AnalysisMode>("ib");
  const [bodyRatio, setBodyRatio] = useState<MomentumBodyRatio>("0.70");
  const [occBodyRatio, setOccBodyRatio] = useState<OCCBodyRatio>("0.50");
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);

  const [selectedTemplateId, setSelectedTemplateId] = useState("custom");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const isTemplateLocked = selectedTemplateId !== "custom";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol.trim()) return;
    onRun(symbol.trim().toUpperCase(), parseInt(ibWindow), parseInt(maxDays), mode, bodyRatio, occBodyRatio, weekdays);
  };

  const handleTemplateSelect = (id: string) => {
    setSelectedTemplateId(id);
    if (id === "custom") return;
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;
    setMode(tpl.mode as AnalysisMode);
    setSymbol(tpl.symbol);
    setIbWindow(String(tpl.ib_window));
    setMaxDays(String(tpl.max_days));
    setBodyRatio((tpl.body_ratio || "0.70") as MomentumBodyRatio);
    setOccBodyRatio((tpl.occ_body_ratio || "0.50") as OCCBodyRatio);
    setWeekdays(tpl.weekdays || [1, 2, 3, 4, 5]);
    onLoadTemplate?.({
      mode: tpl.mode as AnalysisMode,
      symbol: tpl.symbol,
      ibWindow: tpl.ib_window,
      maxDays: tpl.max_days,
      bodyRatio: (tpl.body_ratio || "0.70") as MomentumBodyRatio,
      occBodyRatio: (tpl.occ_body_ratio || "0.50") as OCCBodyRatio,
      occTimeframe: (tpl.occ_timeframe || "M15") as OCCTimeframe,
      weekdays: tpl.weekdays || [1, 2, 3, 4, 5],
    });
  };

  const handleSave = () => {
    if (!templateName.trim()) return;
    onSaveTemplate?.(templateName.trim(), {
      mode,
      symbol: symbol.trim().toUpperCase() || "QQQ",
      ibWindow: parseInt(ibWindow),
      maxDays: parseInt(maxDays),
      bodyRatio,
      occBodyRatio,
      occTimeframe,
      weekdays,
    });
    setTemplateName("");
    setShowSaveDialog(false);
  };

  return (
    <div className="h-full border-r border-border bg-surface overflow-y-auto w-[260px] shrink-0">
      <form onSubmit={handleSubmit} className="p-4 space-y-5">

        {/* Custom Templates */}
        <div className="space-y-2">
          <p className="section-label">custom templates</p>
          <Select value={selectedTemplateId} onValueChange={handleTemplateSelect}>
            <SelectTrigger className="bg-input border-border text-[13px] text-foreground">
              <SelectValue placeholder="template" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="custom">custom – not saved</SelectItem>
              {templates.map((t) => (
                <div key={t.id} className="flex items-center group relative">
                  <SelectItem value={t.id} className="flex-1 pr-8">{t.name}</SelectItem>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      if (selectedTemplateId === t.id) setSelectedTemplateId("custom");
                      onDeleteTemplate?.(t.id);
                    }}
                    className="absolute right-1.5 p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all z-10"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </SelectContent>
          </Select>

          <button
            type="button"
            onClick={() => setShowSaveDialog(true)}
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
          <Select value={isFree && mode !== "ib" && mode !== "occ" ? "ib" : mode} onValueChange={(v) => { const freeAllowed = ["ib", "occ"]; if (!isFree || freeAllowed.includes(v)) { setMode(v as AnalysisMode); setSelectedTemplateId("custom"); } }} disabled={isFree && mode !== "ib" && mode !== "occ" ? true : false}>
            <SelectTrigger className="bg-input border-border text-[13px] text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ib">IB: initial balance breakout</SelectItem>
              {!isFree && <SelectItem value="globex-ib">IB: globex overnight</SelectItem>}
              {!isFree && <SelectItem value="london-ib">IB: london session</SelectItem>}
              {!isFree && <SelectItem value="momentum">momentum candle continuation (mcc)</SelectItem>}
              <SelectItem value="occ">opening candle continuation</SelectItem>
              {!isFree && <SelectItem value="gapfill">gap fill statistics</SelectItem>}
              {!isFree && <SelectItem value="insidebar">inside bar</SelectItem>}
              {!isFree && <SelectItem value="outsideday">outside day</SelectItem>}
              {!isFree && <SelectItem value="pullback">pullback 50% (m15)</SelectItem>}
              {!isFree && <SelectItem value="ib-pullback">IB pullback 25/50/75%</SelectItem>}
            </SelectContent>
          </Select>
          {isFree && <p className="text-[10px] text-muted-foreground">🔒 upgrade to pro for all modes</p>}

          {mode === "momentum" && (
            <>
              <p className="text-[11px] text-muted-foreground">opening candle body threshold</p>
              <Select value={bodyRatio} onValueChange={(v) => { setBodyRatio(v as MomentumBodyRatio); setSelectedTemplateId("custom"); }}>
                <SelectTrigger className="bg-input border-border text-[13px] text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.50">body ≥ 50% (loose)</SelectItem>
                  <SelectItem value="0.60">body ≥ 60%</SelectItem>
                  <SelectItem value="0.70">body ≥ 70% (recommended)</SelectItem>
                  <SelectItem value="0.80">body ≥ 80% (strict)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">strong momentum = large body, small wicks. days with weak opening candles are skipped.</p>
            </>
          )}


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
            onChange={(e) => { setSymbol(e.target.value); setSelectedTemplateId("custom"); }}
            className="bg-input border-border text-[13px] text-foreground placeholder:text-muted-foreground uppercase"
          />

          <p className="text-[11px] text-muted-foreground">date range</p>
          <Select value={isFree ? "20" : maxDays} onValueChange={(v) => { if (!isFree) { setMaxDays(v); setSelectedTemplateId("custom"); } }} disabled={isFree}>
            <SelectTrigger className="bg-input border-border text-[13px] text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {isFree
                ? <SelectItem value="20">1 Month</SelectItem>
                : DAY_OPTIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))
              }
            </SelectContent>
          </Select>
          {isFree && <p className="text-[10px] text-muted-foreground">🔒 upgrade to pro for more days</p>}

          {(mode === "ib" || mode === "momentum" || mode === "globex-ib" || mode === "london-ib" || mode === "ib-pullback") && (
            <>
              <p className="text-[11px] text-muted-foreground">IB window</p>
              <Select value={isFree ? "60" : ibWindow} onValueChange={(v) => { if (!isFree) { setIbWindow(v); setSelectedTemplateId("custom"); } }} disabled={isFree}>
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
          <p className="text-[11px] text-muted-foreground mt-2">weekdays to use {isTemplateLocked && <span className="text-[10px] text-primary/70">🔒 locked by template</span>}</p>
          <div className="flex flex-wrap gap-2">
            <label className={`flex items-center gap-1.5 ${isTemplateLocked ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
              <Checkbox
                checked={weekdays.length === 5}
                disabled={isTemplateLocked}
                onCheckedChange={(checked) => {
                  setSelectedTemplateId("custom");
                  setWeekdays(checked ? [1, 2, 3, 4, 5] : []);
                }}
              />
              <span className="text-[12px] text-foreground font-medium">All</span>
            </label>
            {WEEKDAYS.map((wd) => (
              <label key={wd.value} className={`flex items-center gap-1.5 ${isTemplateLocked ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
                <Checkbox
                  checked={weekdays.includes(wd.value)}
                  disabled={isTemplateLocked}
                  onCheckedChange={(checked) => {
                    setSelectedTemplateId("custom");
                    if (checked) {
                      setWeekdays((prev) => [...prev.filter((d) => d !== wd.value), wd.value].sort());
                    } else {
                      setWeekdays((prev) => prev.filter((d) => d !== wd.value));
                    }
                  }}
                />
                <span className="text-[12px] text-foreground">{wd.label}</span>
              </label>
            ))}
          </div>
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

      {/* Save Template Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="text-sm">Save Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-[12px] text-muted-foreground">Nama template</p>
            <Input
              placeholder="e.g. QQQ IB 30min"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              className="text-[13px]"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
            <p className="text-[11px] text-muted-foreground">
              Mode: {mode} · {symbol || "QQQ"} · {maxDays === "0" ? "All" : maxDays} days · IB {ibWindow}min · Days: {weekdays.length === 5 ? "All" : weekdays.map(d => ["","Mon","Tue","Wed","Thu","Fri"][d]).join(",")}
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setShowSaveDialog(false)}>Batal</Button>
            <Button size="sm" onClick={handleSave} disabled={!templateName.trim() || templateLoading}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ParameterPanel;
