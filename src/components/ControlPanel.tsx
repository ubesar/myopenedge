import { useState } from "react";
import { Loader2, Play, KeyRound, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ControlPanelProps {
  onRun: (apiKey: string, symbol: string, ibWindow: number) => void;
  loading: boolean;
}

const IB_WINDOWS = [
  { value: "15", label: "First 15 min (09:30–09:45)" },
  { value: "30", label: "First 30 min (09:30–10:00)" },
  { value: "60", label: "First 60 min (09:30–10:30)" },
  { value: "90", label: "First 90 min (09:30–11:00)" },
];

const ControlPanel = ({ onRun, loading }: ControlPanelProps) => {
  const [apiKey, setApiKey] = useState("");
  const [symbol, setSymbol] = useState("QQQ");
  const [ibWindow, setIbWindow] = useState("60");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim() || !symbol.trim()) return;
    onRun(apiKey.trim(), symbol.trim().toUpperCase(), parseInt(ibWindow));
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-card p-6 space-y-5">
      <div className="flex items-center gap-2 mb-2">
        <BarChart3 className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-card-foreground">IB Analysis</h2>
      </div>

      <div className="space-y-2">
        <Label htmlFor="apiKey" className="text-sm text-muted-foreground flex items-center gap-1.5">
          <KeyRound className="h-3.5 w-3.5" /> Twelve Data API Key
        </Label>
        <Input
          id="apiKey"
          type="password"
          placeholder="Enter your API key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="symbol" className="text-sm text-muted-foreground">
          Ticker Symbol
        </Label>
        <Input
          id="symbol"
          placeholder="QQQ"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          className="bg-muted border-border text-foreground placeholder:text-muted-foreground uppercase"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-sm text-muted-foreground">IB Window</Label>
        <Select value={ibWindow} onValueChange={setIbWindow}>
          <SelectTrigger className="bg-muted border-border text-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {IB_WINDOWS.map((w) => (
              <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button type="submit" disabled={loading || !apiKey.trim()} className="w-full">
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Analyzing…
          </>
        ) : (
          <>
            <Play className="mr-2 h-4 w-4" />
            Run Analysis
          </>
        )}
      </Button>
    </form>
  );
};

export default ControlPanel;
