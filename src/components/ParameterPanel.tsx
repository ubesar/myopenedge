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
export type MomentumBodyRatio = "0.40" | "0.50" | "0.60";
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
  const [bodyRatio, setBodyRatio] = useState<MomentumBodyRatio>("0.50");
  const [occBodyRatio, setOccBodyRatio] = useState<OCCBodyRatio>("0.50");
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);

  const [selectedTemplateId, setSelectedTemplateId] = useState("custom");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [templateName, setTemplateName] = useState("");

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
    setBodyRatio((tpl.body_ratio || "0.50") as MomentumBodyRatio);
    setOccBodyRatio((tpl.occ_body_ratio || "0.50") as OCCBodyRatio);
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
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Delete selected template */}
          {selectedTemplateId !== "custom" && (
            <button
              type="button"
              onClick={() => {
                onDeleteTemplate?.(selectedTemplateId);
                setSelectedTemplateId("custom");
              }}
              className="w-full flex items-center justify-center gap-1.5 bg-destructive/10 hover:bg-destructive/20 text-destructive rounded-lg px-3 py-2 text-[13px] transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              delete template
            </button>
          )}

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
          <Select value={isFree ? "ib" : mode} onValueChange={(v) => { if (!isFree) { setMode(v as AnalysisMode); setSelectedTemplateId("custom"); } }} disabled={isFree}>
            <SelectTrigger className="bg-input border-border text-[13px] text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ib">IB: initial balance breakout</SelectItem>
              {!isFree && <SelectItem value="globex-ib">IB: globex overnight</SelectItem>}
              {!isFree && <SelectItem value="momentum">momentum candle</SelectItem>}
              {!isFree && <SelectItem value="occ">opening candle continuation</SelectItem>}
              {!isFree && <SelectItem value="gapfill">gap fill statistics</SelectItem>}
              {!isFree && <SelectItem value="insidebar">inside bar</SelectItem>}
              {!isFree && <SelectItem value="outsideday">outside day</SelectItem>}
            </SelectContent>
          </Select>
          {isFree && <p className="text-[10px] text-muted-foreground">🔒 upgrade to pro for all modes</p>}

          {mode === "momentum" && (
            <>
              <p className="text-[11px] text-muted-foreground">subreport (candle 1 body)</p>
              <Select value={bodyRatio} onValueChange={(v) => { setBodyRatio(v as MomentumBodyRatio); setSelectedTemplateId("custom"); }}>
                <SelectTrigger className="bg-input border-border text-[13px] text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.40">body ≥ 40%</SelectItem>
                  <SelectItem value="0.50">body ≥ 50%</SelectItem>
                  <SelectItem value="0.60">body ≥ 60%</SelectItem>
                </SelectContent>
              </Select>
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
          <Select value={isFree ? "7" : maxDays} onValueChange={(v) => { if (!isFree) { setMaxDays(v); setSelectedTemplateId("custom"); } }} disabled={isFree}>
            <SelectTrigger className="bg-input border-border text-[13px] text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {isFree
                ? <SelectItem value="22">1 Month</SelectItem>
                : DAY_OPTIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))
              }
            </SelectContent>
          </Select>
          {isFree && <p className="text-[10px] text-muted-foreground">🔒 upgrade to pro for more days</p>}

          {(mode === "ib" || mode === "momentum" || mode === "globex-ib") && (
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
          <p className="text-[11px] text-muted-foreground mt-2">weekdays to use</p>
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <Checkbox
                checked={weekdays.length === 5}
                onCheckedChange={(checked) => {
                  setSelectedTemplateId("custom");
                  setWeekdays(checked ? [1, 2, 3, 4, 5] : []);
                }}
              />
              <span className="text-[12px] text-foreground font-medium">All</span>
            </label>
            {WEEKDAYS.map((wd) => (
              <label key={wd.value} className="flex items-center gap-1.5 cursor-pointer">
                <Checkbox
                  checked={weekdays.includes(wd.value)}
                  onCheckedChange={(checked) => {
                    setSelectedTemplateId("custom");
                    if (checked) {
                      // If clicking a single day, set ONLY that day
                      setWeekdays([wd.value]);
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
              Mode: {mode} · {symbol || "QQQ"} · {maxDays === "0" ? "All" : maxDays} days · IB {ibWindow}min
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
