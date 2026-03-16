import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, BarChart3, Activity, Target, Zap, TrendingUp,
  CandlestickChart, FileText, FlaskConical, ArrowUpDown,
  Layers, SquareStack, LineChart, Bot, Cpu, Eye, Rocket
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import logo from "@/assets/logo.png";

/* ── tiny reusable info box ── */
const InfoBox = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="rounded-lg bg-muted/30 border border-border/20 p-3 space-y-1.5">
    <p className="text-xs font-semibold text-foreground">{title}</p>
    <div className="text-xs text-muted-foreground">{children}</div>
  </div>
);

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
          <div className="flex-1">
            <h1 className="text-lg font-bold text-foreground">MyOpenEdge Documentation</h1>
            <p className="text-xs text-muted-foreground">v2.0 — Complete Feature Reference</p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => navigate("/terms_conditions")}>
            <FileText className="h-3.5 w-3.5" /> Legal
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-8 py-8 space-y-10">

        {/* ─── 1. Product Overview ─── */}
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
                The core objective is to shift trading decisions from intuition-based to data-driven, specifically for high-volatility instruments like <span className="font-medium text-foreground">Nasdaq (NQ/QQQ)</span>, <span className="font-medium text-foreground">Gold (GC/GLD)</span>, and <span className="font-medium text-foreground">IDX futures</span>.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* ─── 2. Target Audience ─── */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" />
            2. Target Audience
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Scalpers & Swing Traders</CardTitle></CardHeader>
              <CardContent className="text-xs text-muted-foreground">Traders looking for high-probability setups during the opening hours of the market.</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Systematic Traders</CardTitle></CardHeader>
              <CardContent className="text-xs text-muted-foreground">Users who rely on strict rule-based execution, independent timeframe analysis, and historical backtesting to justify entries.</CardContent>
            </Card>
          </div>
        </section>

        {/* ─── 3. Platform Workflow ─── */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Rocket className="h-6 w-6 text-primary" />
            3. Platform Workflow
          </h2>
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground leading-relaxed space-y-3">
              <p>All analysis modules share a common data pipeline:</p>
              <div className="rounded-lg bg-muted/30 border border-border/20 p-4 font-mono text-xs space-y-1">
                <p className="text-foreground">1. User selects Symbol, Mode, Date Range, and Weekday Filter</p>
                <p className="text-foreground">2. System fetches 5-minute bars from TwelveData (batched 60-day windows)</p>
                <p className="text-foreground">3. Bars are aggregated to M15/M30/H1 as needed</p>
                <p className="text-foreground">4. Analysis logic processes bars → generates statistics</p>
                <p className="text-foreground">5. Results rendered as charts + probability dashboards</p>
              </div>
              <div className="grid sm:grid-cols-3 gap-3 mt-2">
                <InfoBox title="Date Range Options">
                  <p>1 Month (20 days), 2 Months (40), 3 Months (60), 6 Months (120), 12 Months (240)</p>
                </InfoBox>
                <InfoBox title="Weekday Filter">
                  <p>Select any combination of Monday–Friday to isolate day-of-week patterns.</p>
                </InfoBox>
                <InfoBox title="Supported Symbols">
                  <p>QQQ, GLD, SPY, AAPL, TSLA, NVDA, BTC/USD, ETH/USD, and more.</p>
                </InfoBox>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ─── 4. Edge Lab — Core Features ─── */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FlaskConical className="h-6 w-6 text-primary" />
            4. Edge Lab — Core Analysis Modules
          </h2>

          {/* Feature 1: IB */}
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-5 w-5 text-primary" />
                4.1 Initial Balance (IB) Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p><span className="font-semibold text-foreground">Objective:</span> Map the institutional opening range and calculate breakout probability based on sequence formation.</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <InfoBox title="IB Window Options">
                  <p>15 min (09:30–09:45), 30 min (09:30–10:00), 60 min (09:30–10:30), 90 min (09:30–11:00)</p>
                </InfoBox>
                <InfoBox title="Data Source">
                  <p>Strictly calculated using <span className="font-medium text-foreground">5-minute (M5)</span> bars to define the exact High and Low.</p>
                </InfoBox>
              </div>
              <InfoBox title="Sequence Detection — The 'Tell'">
                <p>The system tracks which extreme was formed first (IB High First vs IB Low First). This sequence is the key predictor for breakout direction.</p>
              </InfoBox>
              <InfoBox title="Breakout Confirmation (By Rejection)">
                <p>After the IB window, the system monitors M5 bars until 12:00 NY. A breakout is confirmed only when a candle <span className="font-medium text-foreground">closes</span> outside the IB range — not just wicks through it.</p>
              </InfoBox>
              <InfoBox title="Probability Output">
                <ul className="space-y-1 ml-4 list-disc">
                  <li><span className="text-green-400 font-medium">Break High</span> — Price closed above IB High</li>
                  <li><span className="text-red-400 font-medium">Break Low</span> — Price closed below IB Low</li>
                  <li><span className="text-foreground font-medium">Inside Day</span> — Price remained within IB until 12:00</li>
                </ul>
              </InfoBox>
            </CardContent>
          </Card>

          {/* Feature 2: Momentum */}
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-5 w-5 text-primary" />
                4.2 Momentum Candle Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p><span className="font-semibold text-foreground">Objective:</span> Identify strong directional momentum during the morning session and validate against historical probabilities.</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <InfoBox title="Time Window">
                  <p>09:30 – 12:00 (NY Time)</p>
                </InfoBox>
                <InfoBox title="Monitored Timeframes">
                  <p>M5, M15, M30, H1 (evaluated independently)</p>
                </InfoBox>
              </div>
              <InfoBox title="Trigger Criteria">
                <p>Scans for <span className="font-medium text-foreground">2 consecutive candles</span> of the same color (Bullish or Bearish).</p>
                <ul className="space-y-1 ml-4 list-disc mt-1.5">
                  <li><span className="font-medium text-foreground">Candle 1:</span> Body ratio ≥ threshold (40%, 50%, or 60%)</li>
                  <li><span className="font-medium text-foreground">Candle 2:</span> Body ratio ≥ 30%</li>
                </ul>
                <p className="mt-1.5">Body Ratio = <code className="bg-muted px-1 rounded text-foreground">abs(open − close) / (high − low)</code></p>
              </InfoBox>
              <InfoBox title="Timeframe Independence">
                <p>Each timeframe is treated as a standalone setup. A valid M5 signal does not require M15/H1 confirmation, enabling sequential execution (e.g., scalping M5 then swinging M15).</p>
              </InfoBox>
            </CardContent>
          </Card>

          {/* Feature 3: OCC */}
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CandlestickChart className="h-5 w-5 text-primary" />
                4.3 Opening Candle Continuation (OCC)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p><span className="font-semibold text-foreground">Objective:</span> Evaluate the immediate directional bias established by the first two candles at market open.</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <InfoBox title="Evaluation Point">
                  <p>First 2 candles immediately following the 09:30 open.</p>
                </InfoBox>
                <InfoBox title="Monitored Timeframes">
                  <p>M5, M15, M30, H1 (simultaneously but independently).</p>
                </InfoBox>
              </div>
              <InfoBox title="Signal Output">
                <ul className="space-y-1 ml-4 list-disc">
                  <li><span className="text-green-400 font-medium">Bullish Continuation:</span> Both candles are green (C1 bullish + C2 bullish).</li>
                  <li><span className="text-red-400 font-medium">Bearish Continuation:</span> Both candles are red (C1 bearish + C2 bearish).</li>
                  <li><span className="text-foreground font-medium">Reverting:</span> Mixed colors — no continuation signal, market is reverting.</li>
                </ul>
              </InfoBox>
              <InfoBox title="No Body Ratio Filter">
                <p>Unlike Momentum Candle, OCC does <span className="font-medium text-foreground">not</span> apply any body percentage threshold. Any bullish or bearish candle counts regardless of wick size.</p>
              </InfoBox>
            </CardContent>
          </Card>

          {/* Feature 4: Gap Fill */}
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ArrowUpDown className="h-5 w-5 text-primary" />
                4.4 Gap Fill Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p><span className="font-semibold text-foreground">Objective:</span> Measure the historical probability that the overnight gap between the previous close and today's open gets filled during the trading session.</p>
              <InfoBox title="Gap Detection">
                <p><span className="font-medium text-foreground">Gap Up:</span> Today's open &gt; yesterday's close. <span className="font-medium text-foreground">Gap Down:</span> Today's open &lt; yesterday's close.</p>
              </InfoBox>
              <InfoBox title="Fill Confirmation">
                <p>A gap is considered "filled" when intraday price action touches or passes through the previous close level during the session (09:30–16:00).</p>
              </InfoBox>
              <InfoBox title="Probability Output">
                <ul className="space-y-1 ml-4 list-disc">
                  <li>Gap Fill Rate — % of days where the gap was fully filled</li>
                  <li>Gap Not Filled — % of days where price failed to reach previous close</li>
                  <li>Breakdown by gap direction (up vs. down)</li>
                </ul>
              </InfoBox>
            </CardContent>
          </Card>

          {/* Feature 5: Inside Bar */}
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Layers className="h-5 w-5 text-primary" />
                4.5 Inside Bar Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p><span className="font-semibold text-foreground">Objective:</span> Detect daily range contraction (Inside Bar) and measure the probability and direction of the subsequent breakout.</p>
              <InfoBox title="Inside Bar Definition">
                <p>A day where today's <span className="font-medium text-foreground">High &lt; yesterday's High</span> AND today's <span className="font-medium text-foreground">Low &gt; yesterday's Low</span>. The entire day's range is "inside" the previous day's range — a sign of consolidation.</p>
              </InfoBox>
              <InfoBox title="Data Source">
                <p>Daily OHLC is constructed from intraday 5-minute bars (09:30–16:00) to ensure consistency with other modules.</p>
              </InfoBox>
              <InfoBox title="Breakout Tracking">
                <p>After an Inside Bar is identified, the system examines the <span className="font-medium text-foreground">next trading day</span> to determine breakout direction:</p>
                <ul className="space-y-1 ml-4 list-disc mt-1.5">
                  <li><span className="text-green-400 font-medium">Broke High</span> — Next day's high exceeded the mother bar's high</li>
                  <li><span className="text-red-400 font-medium">Broke Low</span> — Next day's low broke below the mother bar's low</li>
                  <li><span className="text-foreground font-medium">Stayed Inside</span> — Another inside day (double inside bar)</li>
                </ul>
              </InfoBox>
              <InfoBox title="Statistics Output">
                <ul className="space-y-1 ml-4 list-disc">
                  <li>Inside Bar frequency (% of total trading days)</li>
                  <li>Breakout direction probabilities (High vs. Low vs. Stayed)</li>
                </ul>
              </InfoBox>
            </CardContent>
          </Card>

          {/* Feature 6: Outside Day */}
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <SquareStack className="h-5 w-5 text-primary" />
                4.6 Outside Day Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p><span className="font-semibold text-foreground">Objective:</span> Identify days with range expansion (Outside Day / Engulfing Day) and analyze subsequent price behavior.</p>
              <InfoBox title="Outside Day Definition">
                <p>The inverse of Inside Bar — today's <span className="font-medium text-foreground">High &gt; yesterday's High</span> AND today's <span className="font-medium text-foreground">Low &lt; yesterday's Low</span>. The current day's range completely engulfs the previous day.</p>
              </InfoBox>
              <InfoBox title="Significance">
                <p>Outside Days signal high volatility and indecision. Tracking the follow-through direction helps determine whether the expansion was bullish or bearish in nature.</p>
              </InfoBox>
              <InfoBox title="Statistics Output">
                <ul className="space-y-1 ml-4 list-disc">
                  <li>Outside Day frequency (% of trading days)</li>
                  <li>Next-day follow-through direction and magnitude</li>
                  <li>Close position relative to the outside day's range</li>
                </ul>
              </InfoBox>
            </CardContent>
          </Card>
        </section>

        {/* ─── 5. Chart & Overlays ─── */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <LineChart className="h-6 w-6 text-primary" />
            5. Live Chart & Visual Overlays
          </h2>
          <Card>
            <CardContent className="pt-6 space-y-3 text-sm text-muted-foreground">
              <p>The Chart page provides a TradingView-powered interface with real-time data and built-in analytical overlays.</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <InfoBox title="Timeframes">
                  <p>5m, 15m, 30m, 1h — synced to New York Open (09:30 ET)</p>
                </InfoBox>
                <InfoBox title="Candle Colors">
                  <p>Bullish: Dark Green (#1b5e20) · Bearish: Default red · Wick: Dark Gray (#363A45)</p>
                </InfoBox>
              </div>
              <InfoBox title="Momentum Candle (MC) Overlay">
                <p>Active by default. Highlights valid 2-candle momentum pairs during 09:30–12:00 window:</p>
                <ul className="space-y-1 ml-4 list-disc mt-1.5">
                  <li><span className="font-medium" style={{ color: "#00FF66" }}>Neon Green (#00FF66)</span> — Bullish momentum pair</li>
                  <li><span className="font-medium" style={{ color: "#FF00FF" }}>Magenta (#FF00FF)</span> — Bearish momentum pair</li>
                </ul>
              </InfoBox>
              <InfoBox title="Initial Balance (IB) Overlay">
                <p>Active by default. Displays the IB range (High/Low) as a horizontal band on the chart for visual reference during the session.</p>
              </InfoBox>
            </CardContent>
          </Card>
        </section>

        {/* ─── 6. Additional Tools ─── */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            6. Additional Tools
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Bot className="h-4 w-4 text-primary" /> AI Assistant</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Chat-based AI powered by Gemini for chart analysis, market questions, and screenshot interpretation. Upload a chart screenshot for instant visual analysis.
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Cpu className="h-4 w-4 text-primary" /> Algos Command Center</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                PIN-protected (SHA-256 hashed) control panel for sending trading commands (BUY_STOP, SELL_STOP, CLOSE_ALL) to external MQL5 Expert Advisors. Configurable risk parameters: Lot Size, Risk USD, RR Ratio, SL/TP.
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Eye className="h-4 w-4 text-primary" /> Watchlist</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Persistent symbol watchlist saved to your account. Quickly add or remove tickers for fast access across sessions.
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /> Templates & History</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Save analysis parameter presets as templates for one-click re-runs. All analysis results are stored in history for comparison and review.
              </CardContent>
            </Card>
          </div>
        </section>

        {/* ─── 7. UI Requirements ─── */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            7. UI Requirements
          </h2>
          <Card>
            <CardContent className="pt-6 space-y-4 text-sm text-muted-foreground">
              <div className="space-y-2">
                <p className="font-semibold text-foreground text-xs">Independent Timeframe Toggles</p>
                <p className="text-xs">Users can switch between M5, M15, M30, and H1 views to isolate setups per timeframe.</p>
              </div>
              <div className="space-y-2">
                <p className="font-semibold text-foreground text-xs">Visual Chart Overlays</p>
                <ul className="text-xs space-y-1 ml-4 list-disc">
                  <li>Momentum Candle highlights (Neon Green / Magenta) during 09:30–12:00.</li>
                  <li>IB range band displayed as horizontal overlay on TradingView chart.</li>
                </ul>
              </div>
              <div className="space-y-2">
                <p className="font-semibold text-foreground text-xs">Probability Dashboards</p>
                <ul className="text-xs space-y-1 ml-4 list-disc">
                  <li>Bar charts displaying historical win rate for each module.</li>
                  <li>"Overall Bias" panels summarizing real-time signals merged with historical edges.</li>
                  <li>Execution parameters (date range, weekdays) displayed on every report for transparency.</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ─── 8. Future Integrations ─── */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            8. Future Integrations
          </h2>
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground leading-relaxed">
              <p className="font-semibold text-foreground text-xs mb-2">Automated Execution Bridge</p>
              <p className="text-xs">
                Exporting valid MyOpenEdge signals into MQL5 Expert Advisors (EAs) & NinjaTrader Automated Trading Strategies for automated or semi-automated trade execution, complete with progressive risk management parameters and strict 1:1 & 1:2 Risk-to-Reward enforcement.
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
