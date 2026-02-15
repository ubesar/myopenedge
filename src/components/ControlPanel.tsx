import { useState } from "react";
import { Loader2, Play, KeyRound, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ControlPanelProps {
  onRun: (apiKey: string, symbol: string) => void;
  loading: boolean;
}

const ControlPanel = ({ onRun, loading }: ControlPanelProps) => {
  const [apiKey, setApiKey] = useState("");
  const [symbol, setSymbol] = useState("QQQ");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim() || !symbol.trim()) return;
    onRun(apiKey.trim(), symbol.trim().toUpperCase());
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
