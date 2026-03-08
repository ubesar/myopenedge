import { useNavigate } from "react-router-dom";
import { ArrowLeft, BarChart3, Activity, Target, Zap, TrendingUp, CandlestickChart, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import logo from "@/assets/logo.png";

export default function Docs() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/95 backdrop-blur px-4 sm:px-8 py-3">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/app")} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <img src={logo} alt="MyOpenEdge" className="h-8 w-8 rounded-full object-cover" />
          <div>
            <h1 className="text-lg font-bold text-foreground">MyOpenEdge Documentation</h1>
            <p className="text-xs text-muted-foreground">v1.0 — Product Requirements</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-8 py-8 space-y-10">
        {/* 1. Product Overview */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            1. Product Overview
          </h2>
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground leading-relaxed">
              <p>
                <span className="font-semibold text-foreground">MyOpenEdge</span> is a specialized web-based analytical platform designed to provide futures day traders and swing traders with a distinct statistical edge. By parsing historical data and real-time market structure during the New York (NY) open, the application calculates the probability of specific price action setups.
              </p>
              <p className="mt-3">
                The core objective is to shift trading decisions from intuition-based to data-driven, specifically for high-volatility instruments like <span className="font-medium text-foreground">Nasdaq (NQ)</span> and <span className="font-medium text-foreground">Gold (GC)</span>.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* 2. Target Audience */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" />
            2. Target Audience
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Scalpers & Swing Traders</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Traders looking for high-probability setups during the opening hours of the market.
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Systematic Traders</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Users who rely on strict rule-based execution, independent timeframe analysis, and historical backtesting to justify entries.
              </CardContent>
            </Card>
          </div>
        </section>

        {/* 3. Core Features */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            3. Core Features & Technical Logic
          </h2>

          {/* Feature 1: Momentum */}
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-5 w-5 text-primary" />
                Feature 1: Momentum Candle Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p><span className="font-semibold text-foreground">Objective:</span> To identify strong directional momentum during the morning session and validate it against historical probabilities.</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="rounded-lg bg-muted/30 border border-border/20 p-3 space-y-1.5">
                  <p className="text-xs font-semibold text-foreground">Time Window</p>
                  <p className="text-xs">09:30 – 12:00 (NY Time)</p>
                </div>
                <div className="rounded-lg bg-muted/30 border border-border/20 p-3 space-y-1.5">
                  <p className="text-xs font-semibold text-foreground">Monitored Timeframes</p>
                  <p className="text-xs">M5, M15, M30, H1</p>
                </div>
              </div>
              <div className="rounded-lg bg-muted/30 border border-border/20 p-3 space-y-2">
                <p className="text-xs font-semibold text-foreground">Trigger Criteria</p>
                <p className="text-xs">Scans for <span className="font-medium text-foreground">2 consecutive candles</span> of the same color (Bullish or Bearish).</p>
                <ul className="text-xs space-y-1 ml-4 list-disc">
                  <li><span className="font-medium text-foreground">Candle 1:</span> Body must be ≥ 50% of the total candle range (High-Low).</li>
                  <li><span className="font-medium text-foreground">Candle 2:</span> Body must be ≥ 30% of the total candle range.</li>
                </ul>
              </div>
              <div className="rounded-lg bg-muted/30 border border-border/20 p-3 space-y-1.5">
                <p className="text-xs font-semibold text-foreground">Bias Determination</p>
                <p className="text-xs">Timeframe independence. If the M5 timeframe meets the criteria, it is treated as a valid, standalone setup regardless of the H1 state. This allows for sequential execution (e.g., scalping the M5, then moving to an M15 setup).</p>
              </div>
            </CardContent>
          </Card>

          {/* Feature 2: OCC */}
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CandlestickChart className="h-5 w-5 text-primary" />
                Feature 2: Opening Candle Continuation (OCC)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p><span className="font-semibold text-foreground">Objective:</span> To evaluate the immediate directional bias established by the first two candles right at the market open.</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="rounded-lg bg-muted/30 border border-border/20 p-3 space-y-1.5">
                  <p className="text-xs font-semibold text-foreground">Evaluation Point</p>
                  <p className="text-xs">First 2 candles immediately following the 09:30 open.</p>
                </div>
                <div className="rounded-lg bg-muted/30 border border-border/20 p-3 space-y-1.5">
                  <p className="text-xs font-semibold text-foreground">Monitored Timeframes</p>
                  <p className="text-xs">M5, M15, M30, H1 (evaluated simultaneously but independently).</p>
                </div>
              </div>
              <div className="rounded-lg bg-muted/30 border border-border/20 p-3 space-y-2">
                <p className="text-xs font-semibold text-foreground">Signal Output</p>
                <ul className="text-xs space-y-1 ml-4 list-disc">
                  <li><span className="text-profit font-medium">Bullish OCC:</span> Both candles are green.</li>
                  <li><span className="text-loss font-medium">Bearish OCC:</span> Both candles are red.</li>
                  <li><span className="text-foreground font-medium">Failed OCC:</span> Mixed colors.</li>
                </ul>
              </div>
              <div className="rounded-lg bg-muted/30 border border-border/20 p-3 space-y-1.5">
                <p className="text-xs font-semibold text-foreground">Validation Rule</p>
                <p className="text-xs">A setup is only considered "Valid" if the overall body percentage of the directional move exceeds <span className="font-medium text-foreground">50%</span>.</p>
              </div>
            </CardContent>
          </Card>

          {/* Feature 3: IB */}
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-5 w-5 text-primary" />
                Feature 3: Initial Balance (IB) Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p><span className="font-semibold text-foreground">Objective:</span> To map the institutional opening range and calculate the statistical probability of a breakout direction based on sequence formation.</p>
              <div className="rounded-lg bg-muted/30 border border-border/20 p-3 space-y-1.5">
                <p className="text-xs font-semibold text-foreground">Data Source</p>
                <p className="text-xs">Strictly calculated using <span className="font-medium text-foreground">5-minute (M5)</span> bars to define the exact High and Low of the chosen opening window.</p>
              </div>
              <div className="rounded-lg bg-muted/30 border border-border/20 p-3 space-y-2">
                <p className="text-xs font-semibold text-foreground">Sequence Detection (The "Tell")</p>
                <p className="text-xs">The system tracks which extreme was formed first:</p>
                <ul className="text-xs space-y-1 ml-4 list-disc">
                  <li>IB High Formed First</li>
                  <li>IB Low Formed First</li>
                </ul>
              </div>
              <div className="rounded-lg bg-muted/30 border border-border/20 p-3 space-y-1.5">
                <p className="text-xs font-semibold text-foreground">Breakout Scanning</p>
                <p className="text-xs">Following the establishment of the IB, the system monitors the <span className="font-medium text-foreground">M15 timeframe</span> until 12:00. A breakout is only confirmed when an M15 candle closes outside the IB range.</p>
              </div>
              <div className="rounded-lg bg-muted/30 border border-border/20 p-3 space-y-2">
                <p className="text-xs font-semibold text-foreground">Probability Output</p>
                <ul className="text-xs space-y-1 ml-4 list-disc">
                  <li><span className="text-profit font-medium">Break High</span></li>
                  <li><span className="text-loss font-medium">Break Low</span></li>
                  <li><span className="text-foreground font-medium">Inside Day</span> (Price remains within IB until 12:00)</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* 4. UI Requirements */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            4. UI Requirements
          </h2>
          <Card>
            <CardContent className="pt-6 space-y-4 text-sm text-muted-foreground">
              <div className="space-y-2">
                <p className="font-semibold text-foreground text-xs">Independent Timeframe Toggles</p>
                <p className="text-xs">Users must be able to switch between M5, M15, M30, and H1 views to isolate valid setups.</p>
              </div>
              <div className="space-y-2">
                <p className="font-semibold text-foreground text-xs">Visual Chart Overlays</p>
                <ul className="text-xs space-y-1 ml-4 list-disc">
                  <li>Vertical dashed lines bounding the 09:30 – 12:00 window.</li>
                  <li>Highlighting boxes (e.g., yellow dashed boxes) around valid 2-candle momentum formations.</li>
                </ul>
              </div>
              <div className="space-y-2">
                <p className="font-semibold text-foreground text-xs">Probability Dashboards</p>
                <ul className="text-xs space-y-1 ml-4 list-disc">
                  <li>Clean bar charts displaying the historical win rate percentage for OCC validity and IB Breakouts.</li>
                  <li>Clear "Recommendation" or "Overall Bias" panels summarizing the real-time signals merged with historical statistical edges.</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* 5. Future Integrations */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            5. Future Integrations
          </h2>
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground leading-relaxed">
              <p className="font-semibold text-foreground text-xs mb-2">Automated Execution Bridge</p>
              <p className="text-xs">
                Exporting valid MyOpenEdge signals into MQL5 Expert Advisors (EAs) & Automated Trading Strategy (NinjaTrader) for automated or semi-automated trade execution, complete with progressive risk management parameters and strict 1:1 & 1:2 Risk-to-Reward enforcement.
              </p>
            </CardContent>
          </Card>
        </section>

        <div className="border-t border-border/30 pt-6 pb-12 text-center">
          <p className="text-xs text-muted-foreground">MyOpenEdge — Data-Driven Trading Edge</p>
        </div>
      </main>
    </div>
  );
}
