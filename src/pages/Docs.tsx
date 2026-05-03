import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, BarChart3, Activity, Target, Zap, TrendingUp,
  FileText, ArrowUpDown, Layers, Bot, Moon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import logo from "@/assets/logo.png";

const InfoBox = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="rounded-lg bg-muted/30 border border-border/20 p-3 space-y-1.5">
    <p className="text-xs font-semibold text-foreground">{title}</p>
    <div className="text-xs text-muted-foreground">{children}</div>
  </div>
);

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="text-center p-2 rounded-lg bg-muted/20">
    <p className="text-lg font-bold text-primary">{value}</p>
    <p className="text-[10px] text-muted-foreground">{label}</p>
  </div>
);

export default function Docs() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/95 backdrop-blur px-4 sm:px-8 py-3">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/app")} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <img src={logo} alt="MyOpenEdge" className="h-8 w-8 rounded-full object-cover" />
          <div className="flex-1">
            <h1 className="text-lg font-bold text-foreground">MyOpenEdge Documentation</h1>
            <p className="text-xs text-muted-foreground">Edgeful Model — Data-Driven Trading Edge</p>
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
            <CardContent className="pt-6 text-sm text-muted-foreground leading-relaxed space-y-3">
              <p>
                <strong className="text-foreground">MyOpenEdge</strong> is a data-driven trading analysis platform.
                It provides traders with statistical probabilities based on historical price data to build trading plans rooted in data, not emotions.
              </p>
              <p>
                The platform analyzes Regular Trading Hours (RTH) data from 09:30 AM – 04:00 PM ET using 5-minute intraday bars from TwelveData, then computes probabilities across six core reports.
              </p>
              <p className="font-medium text-foreground">
                Core philosophy: "Build a bias based on data, not your gut feelings or emotions."
              </p>
            </CardContent>
          </Card>
        </section>

        {/* ─── 2. Initial Balance ─── */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" />
            2. Initial Balance (IB)
          </h2>
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground leading-relaxed space-y-4">
              <p>
                The initial balance is the <strong className="text-foreground">high and low of the first hour</strong> of the trading session (09:30–10:30 ET by default).
                It sets up two critical levels every single day that dictate the probability of price action for the rest of the session.
              </p>

              <InfoBox title="What is the IB?">
                <p>The IB high and IB low are automatically calculated from the first N minutes of RTH (configurable: 15, 30, 60, or 90 min). These levels act as key support/resistance for the entire trading day.</p>
              </InfoBox>

              <h3 className="text-base font-semibold text-foreground">Three Outcome Types</h3>
              <p>The IB report tracks what happens <strong className="text-foreground">across the full session</strong> (09:30–16:00 ET) after the IB forms:</p>
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Single Break" value="~73-80%" />
                <Stat label="Double Break" value="~15-20%" />
                <Stat label="No Break" value="~5%" />
              </div>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong className="text-foreground">Single Break:</strong> Price breaks ONLY one side of the IB. Once it breaks one side, expect continuation — don't fight the direction.</li>
                <li><strong className="text-foreground">Double Break:</strong> Price breaks both IB high and IB low. This is rare and typically a chop day — best to sit out.</li>
                <li><strong className="text-foreground">No Break:</strong> Price stays entirely within the IB range. Extremely rare.</li>
              </ul>

              <InfoBox title="The Tell">
                <p>Track whether the IB high or IB low formed first. This "tell" helps predict which direction the breakout will occur. If the high forms first, there's a higher probability of breaking to the downside, and vice versa.</p>
              </InfoBox>

              <h3 className="text-base font-semibold text-foreground">Key Trading Insight</h3>
              <p>
                On NQ during the NY session, price single breaks <strong className="text-foreground">73% of the time</strong> over the last 6 months.
                That means once it breaks to one side, you should expect continuation in that direction. The IB provides your directional bias for the rest of the day.
              </p>


            </CardContent>
          </Card>
        </section>

        {/* ─── 3. Opening Candle Continuation ─── */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            3. Opening Candle Continuation (OCC)
          </h2>
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground leading-relaxed space-y-4">
              <p>
                The OCC measures the <strong className="text-foreground">correlation between the color of the first candle</strong> (opening candle) and the session's closing direction.
                If the first candle is green, the session is likely to close green. If the first candle is red, the session is likely to close red.
              </p>

              <InfoBox title="How it works">
                <p>After the opening candle completes (default: 30 min from 09:30), the system checks: did the candle close green (close &gt; open) or red (close &lt; open)?
                Then it tracks whether the entire session (09:30–16:00) closed in the same direction.</p>
              </InfoBox>

              <h3 className="text-base font-semibold text-foreground">Continuation Rates (6-month data)</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-semibold text-foreground mb-2">YM (Dow Futures)</p>
                  <Stat label="Green OC → Green Day" value="74.32%" />
                  <div className="mt-2"><Stat label="Red OC → Red Day" value="70.18%" /></div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground mb-2">ES (S&P 500 Futures)</p>
                  <Stat label="Green OC → Green Day" value="71.62%" />
                  <div className="mt-2"><Stat label="Red OC → Red Day" value="71.93%" /></div>
                </div>
              </div>

              <InfoBox title="Available Candle Sizes">
                <p>5 min (9:30–9:35), 15 min (9:30–9:45), 30 min (9:30–10:00), 1 hour (9:30–10:30). The default is 30 minutes.</p>
              </InfoBox>

              <h3 className="text-base font-semibold text-foreground">Trading Application</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>Green box → lean bullish for the session, look for long setups</li>
                <li>Red box → lean bearish for the session, look for short setups</li>
                <li>Combine with IB report: OCC gives bias, IB gives breakout levels</li>
              </ul>


            </CardContent>
          </Card>
        </section>

        {/* ─── 4. Gap Fill ─── */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ArrowUpDown className="h-6 w-6 text-primary" />
            4. Gap Fill
          </h2>
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground leading-relaxed space-y-4">
              <p>
                A <strong className="text-foreground">gap</strong> occurs when price opens higher or lower than the previous session's close (PSC).
                The gap fill report measures how often gaps fill (price retraces to touch the PSC) and what happens after they fill.
              </p>

              <InfoBox title="Gap Types">
                <ul className="list-disc pl-4 space-y-1">
                  <li><strong>Gap Up:</strong> Today's open &gt; yesterday's close</li>
                  <li><strong>Gap Down:</strong> Today's open &lt; yesterday's close</li>
                  <li><strong>Gap Fill:</strong> Price retraces to touch the PSC during the session</li>
                  <li><strong>No Fill:</strong> Price never touches the PSC during the session</li>
                </ul>
              </InfoBox>

              <h3 className="text-base font-semibold text-foreground">Key Statistics (ES, 6 months)</h3>
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Gap Up Fill Rate" value="59%" />
                <Stat label="Gap Down Fill Rate" value="66%" />
              </div>

              <h3 className="text-base font-semibold text-foreground">The "By Close" Edge</h3>
              <p>
                After a gap fills, what color does the session close? On ES, gap ups that fill close <strong className="text-foreground">green 56% of the time</strong>.
                This means you should use the PSC as your profit target on short trades — don't hold hoping for more.
              </p>

              <InfoBox title="Weekday Impact">
                <p>Gap fill rates vary dramatically by day of week. On NQ: gap downs fill 30% on Monday but 77% on Wednesday. Always check the weekday filter for your specific instrument.</p>
              </InfoBox>

              <h3 className="text-base font-semibold text-foreground">Gap Fill Strategy</h3>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Identify gap up/down at market open</li>
                <li>Check fill probability for your instrument and timeframe</li>
                <li>Entry: Break of consolidation in gap fill direction</li>
                <li>Target: Previous session close (PSC)</li>
                <li>Stop: Above/below current day's high/low</li>
              </ol>


            </CardContent>
          </Card>
        </section>

        {/* ─── 5. Inside Bar ─── */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Layers className="h-6 w-6 text-primary" />
            5. Inside Bar
          </h2>
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground leading-relaxed space-y-4">
              <p>
                An <strong className="text-foreground">inside bar</strong> occurs when today's entire price range is contained within yesterday's range
                (today's high &lt; yesterday's high AND today's low &gt; yesterday's low). It represents consolidation before a breakout.
              </p>

              <InfoBox title="Key Statistics (SPY, 6 months)">
                <ul className="list-disc pl-4 space-y-1">
                  <li>Inside days occurred only <strong>22%</strong> of the time (rare)</li>
                  <li>Price breaks out of previous day's range <strong>77.78%</strong> of the time</li>
                  <li>~52% break to the upside, ~40% break to the downside</li>
                  <li>Double breaks (both sides) only happen ~15% of the time</li>
                </ul>
              </InfoBox>

              <h3 className="text-base font-semibold text-foreground">Previous Day's Range Power</h3>
              <p>When price breaks above the previous day's high, <strong className="text-foreground">74% of the time</strong> the session closes green (SPY).
              When price breaks below the previous day's low, <strong className="text-foreground">80% of the time</strong> the session closes red.</p>

              <h3 className="text-base font-semibold text-foreground">Inside Bar Strategy</h3>
              <ol className="list-decimal pl-5 space-y-1">
                <li><strong>Identify:</strong> Spot inside day when price opens within yesterday's range</li>
                <li><strong>Wait:</strong> Let the first 30 minutes develop a trading range</li>
                <li><strong>Enter:</strong> Trade breakout of the 30-minute range</li>
                <li><strong>Stop:</strong> Opposite side of the 30-minute range</li>
                <li><strong>Target:</strong> Previous day's high (longs) or low (shorts)</li>
                <li><strong>Runners:</strong> Hold partial position through close — breakouts tend to continue</li>
              </ol>


            </CardContent>
          </Card>
        </section>

        {/* ─── 6. Outside Day ─── */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            6. Outside Day (Bullish & Bearish)
          </h2>
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground leading-relaxed space-y-4">
              <p>
                An <strong className="text-foreground">outside day</strong> occurs when the market opens OUTSIDE of the previous day's range:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong className="text-foreground">Bullish outside day:</strong> Price opens ABOVE yesterday's high</li>
                <li><strong className="text-foreground">Bearish outside day:</strong> Price opens BELOW yesterday's low</li>
              </ul>

              <InfoBox title="Important Distinction">
                <p>This is NOT the same as an engulfing candle pattern. Outside days are specifically about price gapping outside the prior day's range at the open — they signal a significant overnight shift in sentiment.</p>
              </InfoBox>

              <h3 className="text-base font-semibold text-foreground">Key Statistics (NQ, 12 months)</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold text-foreground mb-2">Bullish Outside Days (open &gt; yesterday's high):</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Stat label="Retrace to prior high" value="65%" />
                    <Stat label="Continue higher" value="35%" />
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground mb-2">Bearish Outside Days (open &lt; yesterday's low):</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Stat label="Retrace to prior low" value="58%" />
                    <Stat label="Continue lower" value="42%" />
                  </div>
                </div>
              </div>

              <h3 className="text-base font-semibold text-foreground">The "By Close" Edge</h3>
              <p>72% of bullish outside days close above the prior day's high. 64% of bearish outside days close below the prior day's low.</p>

              <InfoBox title="Gap Size Matters">
                <ul className="list-disc pl-4 space-y-1">
                  <li>Small gap (0.1–0.19%): fills 83–93% of the time → great gap fill setups</li>
                  <li>Large gap (0.6%+): fills 0–25% of the time → don't expect a retracement</li>
                  <li>Best gap fill trades: gap size &lt; 0.2%</li>
                </ul>
              </InfoBox>

              <h3 className="text-base font-semibold text-foreground">Outside Day Trading Plan</h3>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Identify outside day at the market open (bullish or bearish?)</li>
                <li>Check gap size — small gaps have much higher fill rates</li>
                <li>Check edgeful probabilities for continuation vs. reversal</li>
                <li>Set profit targets at prior day's high (bullish) or low (bearish)</li>
                <li>Manage position using weekday-specific data</li>
              </ol>


            </CardContent>
          </Card>
        </section>

        {/* ─── 7. Momentum Candle Continuation (MCC) ─── */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            7. Momentum Candle Continuation (MCC)
          </h2>
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground leading-relaxed space-y-4">
              <p>
                MCC measures the probability that the trading session <strong className="text-foreground">closes in the same direction as the NY opening candle</strong>,
                but only when that opening candle shows valid momentum. Days where the opening candle is weak (long wicks, small body) are treated as
                <strong className="text-foreground"> neutral / no signal</strong> and excluded from the continuation rate.
              </p>
              <InfoBox title="3-Step Validation Logic">
                <ol className="list-decimal pl-4 space-y-1">
                  <li><strong>Direction</strong> — opening candle closes green (close &gt; open) or red (close &lt; open).</li>
                  <li><strong>Momentum filter</strong> — body size <code>|close − open|</code> must be ≥ threshold of the total range <code>high − low</code> (default 70%).</li>
                  <li><strong>Session tracking</strong> — if both pass, check whether the full session close (16:00 ET) lands on the same side as the opening direction.</li>
                </ol>
              </InfoBox>
              <InfoBox title="Configuration">
                <ul className="list-disc pl-4 space-y-1">
                  <li><strong>Opening candle timeframe:</strong> M5, M15, M30 (default), H1</li>
                  <li><strong>Body threshold:</strong> 50% / 60% / 70% (recommended) / 80% (strict)</li>
                  <li><strong>Output:</strong> separate continuation rate for bullish openings vs bearish openings, plus a neutral-day count.</li>
                </ul>
              </InfoBox>
              <p>
                Use MCC as a directional bias filter — only take continuation trades on days where the opening candle confirms strong momentum;
                skip neutral days entirely.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* ─── 8. Globex IB ─── */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Moon className="h-6 w-6 text-primary" />
            8. Globex IB (Overnight Session)
          </h2>
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground leading-relaxed space-y-4">
              <p>
                The Globex IB module analyzes the <strong className="text-foreground">overnight futures session</strong> (6:00 PM – 9:30 AM ET)
                and tracks how RTH price action interacts with the overnight range.
              </p>
              <InfoBox title="Data Source">
                <p>Uses Massive API for overnight bar data (not TwelveData which only covers RTH).</p>
              </InfoBox>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Globex IB Window:</strong> First 30 or 60 minutes from Globex open</li>
                <li><strong>Overnight Break Tracking:</strong> Did the Globex IB get broken during the overnight session?</li>
                <li><strong>RTH Breakout:</strong> After 9:30 AM, does RTH break the full Globex range?</li>
              </ul>
            </CardContent>
          </Card>
        </section>

        {/* ─── 9. Confluence Strategy ─── */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bot className="h-6 w-6 text-primary" />
            9. Confluence: Combining Reports
          </h2>
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground leading-relaxed space-y-4">
              <p>
                The real power of MyOpenEdge comes from <strong className="text-foreground">combining multiple reports</strong> to build a complete trading plan.
                This approach is directly based on Edgeful's "3 Powerful Reports" methodology.
              </p>

              <h3 className="text-base font-semibold text-foreground">Step-by-Step Confluence Trading Plan</h3>
              <ol className="list-decimal pl-5 space-y-2">
                <li><strong>Wait</strong> for the London session to close (11:00 AM ET)</li>
                <li><strong>Check OCC:</strong> Was the first hour green or red? → This sets your directional bias</li>
                <li><strong>Check IB:</strong> Has the IB broken? Which side? → Single break = expect continuation</li>
                <li><strong>Check Market Session Breakout:</strong> Has NY broken the London range? → Target London high/low</li>
                <li><strong>Set profit targets</strong> at London high/low based on your bias</li>
              </ol>

              <InfoBox title="YM Example (6 months)">
                <ul className="list-disc pl-4 space-y-1">
                  <li>NY breaks London range (single break): <strong>83.2%</strong> of the time</li>
                  <li>Red OCC → red session close: <strong>66.23%</strong> of the time</li>
                  <li>IB single break: <strong>76%</strong> of the time</li>
                  <li>Combined: Red OCC + IB low break = target London low with high confidence</li>
                </ul>
              </InfoBox>

              <h3 className="text-base font-semibold text-foreground">AI Trading Assistant</h3>
              <p>
                The AI Trading Assistant can automatically run multiple analyses and combine signals for you.
                Use quick actions like "IB + OCC Analysis" to get instant confluence reads.
              </p>


            </CardContent>
          </Card>
        </section>

        {/* ─── 10. Data Sources ─── */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            10. Data & Parameters
          </h2>
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground leading-relaxed space-y-3">
              <InfoBox title="Data Source">
                <ul className="list-disc pl-4 space-y-1">
                  <li><strong>RTH Data:</strong> TwelveData API — 5-minute intraday bars</li>
                  <li><strong>Globex Data:</strong> Massive API — 5-minute overnight bars</li>
                  <li><strong>Session:</strong> RTH 09:30–16:00 ET (default)</li>
                </ul>
              </InfoBox>
              <InfoBox title="Date Range Options">
                <p>1 month (20 days), 2 months (40 days), 3 months (60 days), 6 months (120 days), 12 months (240 days)</p>
              </InfoBox>
              <InfoBox title="Weekday Filter">
                <p>Analyze all days or filter by specific weekdays (Mon–Fri). Edgeful data shows significant weekday-based variations in probabilities.</p>
              </InfoBox>
            </CardContent>
          </Card>
        </section>

      </main>
    </div>
  );
}
