import { useState, useEffect } from "react";
import { Loader2, Play, KeyRound, BarChart3, ChevronDown, ChevronUp, ClipboardPaste, Save, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type AnalysisMode = "ib" | "momentum" | "occ";

interface ControlPanelProps {
  onRun: (apiKey: string, symbol: string, ibWindow: number, maxDays: number, mode: AnalysisMode) => void;
  loading: boolean;
  isFree?: boolean;
}

const IB_WINDOWS = [
{ value: "15", label: "First 15 min (09:30–09:45)", ibOnly: true },
{ value: "30", label: "First 30 min (09:30–10:00)" },
{ value: "60", label: "First 60 min (09:30–10:30)" },
{ value: "90", label: "First 90 min (09:30–11:00)" }];


const DAY_OPTIONS = [
{ value: "0", label: "All Days" },
{ value: "7", label: "Last 7 Days" },
{ value: "15", label: "Last 15 Days" },
{ value: "30", label: "Last 30 Days" },
{ value: "60", label: "Last 60 Days" },
{ value: "90", label: "Last 90 Days" },
{ value: "120", label: "Last 120 Days" }];


const ControlPanel = ({ onRun, loading, isFree = false }: ControlPanelProps) => {
  const { user } = useAuth();
  const [apiKey, setApiKey] = useState("");
  const [apiKeyLoaded, setApiKeyLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [symbol, setSymbol] = useState("QQQ");
  const [ibWindow, setIbWindow] = useState(isFree ? "60" : "30");
  const [maxDays, setMaxDays] = useState(isFree ? "7" : "15");
  const [mode, setMode] = useState<AnalysisMode>("ib");
  const [showApiKey, setShowApiKey] = useState(false);

  // Load API key from database on mount
  useEffect(() => {
    if (!user) return;
    const loadKey = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("twelvedata_api_key")
        .eq("user_id", user.id)
        .single();
      if (data?.twelvedata_api_key) {
        setApiKey(data.twelvedata_api_key);
      }
      setApiKeyLoaded(true);
    };
    loadKey();
  }, [user]);

  // Auto-switch IB window if current selection is invalid for momentum mode
  useEffect(() => {
    if (mode === "momentum" && ibWindow === "15") {
      setIbWindow("30");
    }
  }, [mode, ibWindow]);

  const saveApiKey = async () => {
    if (!user || !apiKey.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ twelvedata_api_key: apiKey.trim() } as any)
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Failed to save API key");
    } else {
      toast.success("API key saved to your account!");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim() || !symbol.trim()) return;
    onRun(apiKey.trim(), symbol.trim().toUpperCase(), parseInt(ibWindow), parseInt(maxDays), mode);
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-border/30 bg-card/40 backdrop-blur-md p-3 space-y-2.5 mt-2 lg:mt-4 shadow-lg text-xs">
      <div className="flex items-center gap-1.5 mb-1">
        <BarChart3 className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-card-foreground">IB Analysis</h2>
      </div>

      <div className="space-y-2">
        <Label className="text-sm text-muted-foreground">Analysis Type</Label>
        <Select value={isFree ? "ib" : mode} onValueChange={(v) => !isFree && setMode(v as AnalysisMode)} disabled={isFree}>
          <SelectTrigger className="bg-muted border-border text-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ib">Initial Balance (IB)</SelectItem>
            {!isFree && <SelectItem value="momentum">Momentum Candle</SelectItem>}
            {!isFree && <SelectItem value="occ">Opening Candle Continuation</SelectItem>}
          </SelectContent>
        </Select>
        {isFree && <p className="text-[10px] text-muted-foreground">🔒 Upgrade to Pro for Momentum analysis</p>}
        <div className="rounded-md border border-border/20 bg-muted/30 px-2.5 py-2 text-[10px] text-muted-foreground leading-relaxed mt-1">
          {(() => {
            const currentMode = isFree ? "ib" : mode;
            if (currentMode === "ib") return (
              <>
                <span className="font-semibold text-foreground/80">IB Analysis</span> — Calculates the IB range (High & Low) from 5-min bars within the selected window. Detects which side formed first (High/Low First), then scans for breakouts using <span className="font-medium text-foreground/70">M15 candle close</span> from IB end until 12:00. Output: probability of Break High / Break Low / Inside Day.
              </>
            );
            if (currentMode === "momentum") return (
              <>
                <span className="font-semibold text-foreground/80">Momentum Candle</span> — Scans for 2 consecutive M15 candles with the same color (bullish/bearish) in the 09:30–12:00 window. First candle must have body ≥50% of range, second ≥30%. The first signal determines the day's bias: Bullish, Bearish, or Choppy.
              </>
            );
            return (
              <>
                <span className="font-semibold text-foreground/80">Opening Candle Continuation</span> — Evaluates the first 2 candles after market open (09:30) simultaneously across 4 timeframes: M5, M15, M30, H1. If both candles are <span className="font-medium text-foreground/70">green → Bullish OCC</span>, both red → Bearish OCC, mixed colors → Failed OCC. Overall bias is determined by the majority of 4 TFs.
              </>
            );
          })()}
        </div>
      </div>

      {!apiKeyLoaded ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading API key…
        </div>
      ) : !apiKey ? (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-[11px] text-amber-300 space-y-1.5">
          <p className="font-medium">⚠️ No API key found</p>
          <p className="text-muted-foreground">Enter your Twelve Data API key to get started:</p>
          <div className="flex gap-1.5">
            <Input
              type="password"
              placeholder="Paste API key here"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="bg-muted border-border text-foreground placeholder:text-muted-foreground flex-1 h-8 text-xs" />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs"
              onClick={saveApiKey}
              disabled={saving || !apiKey.trim()}
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Save className="h-3.5 w-3.5 mr-1" /> Save</>}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">Get a free key at <a href="https://twelvedata.com" target="_blank" rel="noopener noreferrer" className="underline text-primary">twelvedata.com</a></p>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 py-0.5">
          <Check className="h-3.5 w-3.5" /> API key loaded from cloud
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="symbol" className="text-sm text-muted-foreground">
          Ticker Symbol
        </Label>
        <Input
          id="symbol"
          placeholder="QQQ"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          className="bg-muted border-border text-foreground placeholder:text-muted-foreground uppercase" />

      </div>

      <div className="space-y-2">
        <Label className="text-sm text-muted-foreground">Trading Days</Label>
        <Select value={isFree ? "7" : maxDays} onValueChange={(v) => !isFree && setMaxDays(v)} disabled={isFree}>
          <SelectTrigger className="bg-muted border-border text-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {isFree
              ? <SelectItem value="7">Last 7 Days</SelectItem>
              : DAY_OPTIONS.map((d) =>
                <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
              )
            }
          </SelectContent>
        </Select>
        {isFree && <p className="text-[10px] text-muted-foreground">🔒 Upgrade to Pro for more days</p>}
      </div>

      {mode !== "occ" && (
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">IB Window</Label>
          <Select value={isFree ? "60" : ibWindow} onValueChange={(v) => !isFree && setIbWindow(v)} disabled={isFree}>
            <SelectTrigger className="bg-muted border-border text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {isFree
                ? <SelectItem value="60">First 60 min (09:30–10:30)</SelectItem>
                : IB_WINDOWS
                  .filter((w) => mode === "ib" || !w.ibOnly)
                  .map((w) =>
                    <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>
                  )
              }
            </SelectContent>
          </Select>
          {isFree && <p className="text-[10px] text-muted-foreground">🔒 Upgrade to Pro for more windows</p>}
        </div>
      )}

      <Button type="submit" disabled={loading || !apiKey.trim()} className="w-full">
        {loading ?
        <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Analyzing…
          </> :

        <>
            <Play className="mr-2 h-4 w-4" />
            Run Analysis
          </>
        }
      </Button>
    </form>);

};

export default ControlPanel;