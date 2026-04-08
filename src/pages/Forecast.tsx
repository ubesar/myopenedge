import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { useAIAnalysis, ToolCallArgs } from "@/hooks/useAIAnalysis";
import AppNavSidebar, { MobileHeader } from "@/components/AppNavSidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Brain, TrendingUp, TrendingDown, Minus, Loader2, AlertTriangle,
  Target, Shield, Zap, ChevronRight, BarChart3
} from "lucide-react";

interface Forecast {
  direction: "bullish" | "bearish" | "neutral";
  confidence: number;
  summary: string;
  reasoning: string[];
  key_levels?: { label: string; description: string }[];
  risk_warning: string;
}

const directionConfig = {
  bullish: { icon: TrendingUp, color: "text-green-400", bg: "bg-green-500/10 border-green-500/30", badge: "bg-green-500/20 text-green-400" },
  bearish: { icon: TrendingDown, color: "text-red-400", bg: "bg-red-500/10 border-red-500/30", badge: "bg-red-500/20 text-red-400" },
  neutral: { icon: Minus, color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30", badge: "bg-yellow-500/20 text-yellow-400" },
};

export default function Forecast() {
  const { user } = useAuth();
  const { isActive } = useSubscription();
  const { executeAnalysis } = useAIAnalysis();
  const isMobile = useIsMobile();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [symbol, setSymbol] = useState("NQ");
  const [ibWindow, setIbWindow] = useState("60");
  const [maxDays, setMaxDays] = useState("60");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("");
  const [forecast, setForecast] = useState<Forecast | null>(null);

  const handleForecast = async () => {
    if (!user || !isActive) {
      toast.error("Pro subscription required");
      return;
    }

    setLoading(true);
    setForecast(null);

    try {
      // Step 1: Run IB analysis
      setStep("Running IB analysis...");
      const ibArgs: ToolCallArgs = {
        symbol: symbol.toUpperCase(),
        mode: "ib",
        max_days: Number(maxDays),
        ib_window: Number(ibWindow),
      };
      const ibRaw = await executeAnalysis(ibArgs);
      const ibData = JSON.parse(ibRaw);

      if (ibData.error) {
        toast.error("IB analysis failed: " + ibData.error);
        setLoading(false);
        return;
      }

      // Step 2: Run OCC analysis
      setStep("Running OCC analysis...");
      const occArgs: ToolCallArgs = {
        symbol: symbol.toUpperCase(),
        mode: "occ",
        max_days: Number(maxDays),
      };
      const occRaw = await executeAnalysis(occArgs);
      const occData = JSON.parse(occRaw);

      if (occData.error) {
        toast.error("OCC analysis failed: " + occData.error);
        setLoading(false);
        return;
      }

      // Step 3: Send to AI forecasting
      setStep("AI generating forecast...");
      const { data, error } = await supabase.functions.invoke("ai-forecast", {
        body: { symbol: symbol.toUpperCase(), ibData, occData },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setForecast(data.forecast);
      setStep("");
    } catch (err: any) {
      toast.error(err.message || "Forecast failed");
      setStep("");
    } finally {
      setLoading(false);
    }
  };

  const config = forecast ? directionConfig[forecast.direction] : null;
  const DirIcon = config?.icon || Minus;

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <AppNavSidebar collapsed={collapsed} onToggle={() => isMobile ? setMobileOpen(!mobileOpen) : setCollapsed(!collapsed)} />
      {isMobile && mobileOpen && (
        <AppNavSidebar collapsed={false} onToggle={() => setMobileOpen(false)} />
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        {isMobile && (
          <MobileHeader onMenuToggle={() => setMobileOpen(!mobileOpen)} title="AI Forecast" />
        )}

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Brain className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">AI Forecast</h1>
              <p className="text-xs text-muted-foreground">Prediksi arah harga berdasarkan pola IB & OCC historis</p>
            </div>
          </div>

          {/* Input */}
          <Card className="border-border">
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Symbol</label>
                  <Input
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    placeholder="NQ"
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">IB Window</label>
                  <Select value={ibWindow} onValueChange={setIbWindow}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 min</SelectItem>
                      <SelectItem value="30">30 min</SelectItem>
                      <SelectItem value="60">60 min</SelectItem>
                      <SelectItem value="90">90 min</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Date Range</label>
                  <Select value={maxDays} onValueChange={setMaxDays}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="20">1 month</SelectItem>
                      <SelectItem value="40">2 months</SelectItem>
                      <SelectItem value="60">3 months</SelectItem>
                      <SelectItem value="120">6 months</SelectItem>
                      <SelectItem value="240">12 months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={handleForecast}
                    disabled={loading || !symbol}
                    className="w-full h-9 text-sm gap-2"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                    {loading ? step || "Analyzing..." : "Generate Forecast"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Loading state */}
          {loading && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="py-8 text-center space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                <p className="text-sm text-muted-foreground">{step}</p>
                <div className="flex justify-center gap-1">
                  {["IB Analysis", "OCC Analysis", "AI Forecast"].map((s, i) => (
                    <div key={s} className={`h-1.5 w-16 rounded-full ${
                      step.includes("IB") && i === 0 ? "bg-primary animate-pulse" :
                      step.includes("OCC") && i === 1 ? "bg-primary animate-pulse" :
                      step.includes("AI") && i === 2 ? "bg-primary animate-pulse" :
                      step.includes("OCC") && i === 0 ? "bg-primary" :
                      step.includes("AI") && i <= 1 ? "bg-primary" :
                      "bg-muted"
                    }`} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Forecast Result */}
          {forecast && config && (
            <div className="space-y-4">
              {/* Direction Card */}
              <Card className={`border ${config.bg}`}>
                <CardContent className="py-6">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${config.bg}`}>
                      <DirIcon className={`h-10 w-10 ${config.color}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={config.badge + " text-sm font-bold uppercase"}>
                          {forecast.direction}
                        </Badge>
                        <span className="text-2xl font-bold">{symbol}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{forecast.summary}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Confidence</p>
                      <p className={`text-3xl font-bold ${config.color}`}>{forecast.confidence}%</p>
                    </div>
                  </div>

                  {/* Confidence bar */}
                  <div className="mt-4 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ${
                        forecast.direction === "bullish" ? "bg-green-500" :
                        forecast.direction === "bearish" ? "bg-red-500" : "bg-yellow-500"
                      }`}
                      style={{ width: `${forecast.confidence}%` }}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Reasoning */}
              <Card className="border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    Analysis Reasoning
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {forecast.reasoning.map((r, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <ChevronRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{r}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Key Levels */}
              {forecast.key_levels && forecast.key_levels.length > 0 && (
                <Card className="border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Target className="h-4 w-4 text-primary" />
                      Key Levels
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {forecast.key_levels.map((l, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm p-2 rounded-lg bg-muted/50">
                        <Badge variant="outline" className="text-[11px] shrink-0">{l.label}</Badge>
                        <span className="text-muted-foreground">{l.description}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Risk Warning */}
              <Card className="border-yellow-500/30 bg-yellow-500/5">
                <CardContent className="py-3 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-yellow-500 mb-0.5">Risk Warning</p>
                    <p className="text-xs text-muted-foreground">{forecast.risk_warning}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
