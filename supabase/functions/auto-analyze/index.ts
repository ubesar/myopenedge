import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Constants ──────────────────────────────────────────────
const IB_START = 9 * 60 + 30; // 09:30
const NOON = 12 * 60; // 12:00
const MARKET_CLOSE = 16 * 60; // 16:00
const TF_CONFIGS = [
  { tf: "M15", minutes: 15 },
  { tf: "M30", minutes: 30 },
  { tf: "H1", minutes: 60 },
];

// ── Helpers ────────────────────────────────────────────────
interface Bar { datetime: string; open: string; high: string; low: string; close: string; }
interface Candle { time: string; open: number; high: number; low: number; close: number; }

function getTimeMinutes(dt: string): number {
  const timePart = dt.includes(" ") ? dt.split(" ")[1] : dt;
  const [h, m] = timePart.split(":").map(Number);
  return h * 60 + m;
}

function aggregateBars(bars: Candle[], tfMinutes: number): Candle[] {
  if (tfMinutes <= 5) return bars;
  const groups: Candle[][] = [];
  let current: Candle[] = [];
  for (const bar of bars) {
    const [h, m] = bar.time.split(":").map(Number);
    const totalMin = h * 60 + m;
    if (current.length > 0) {
      const [fh, fm] = current[0].time.split(":").map(Number);
      if (totalMin - (fh * 60 + fm) >= tfMinutes) {
        groups.push(current);
        current = [];
      }
    }
    current.push(bar);
  }
  if (current.length > 0) groups.push(current);
  return groups.map((g) => ({
    time: g[0].time,
    open: g[0].open,
    high: Math.max(...g.map((b) => b.high)),
    low: Math.min(...g.map((b) => b.low)),
    close: g[g.length - 1].close,
  }));
}

// ── IB Analysis (ported from client) ──────────────────────
function analyzeIB(bars: Bar[], ibWindowMinutes: number, maxDays: number) {
  const ibEnd = IB_START + ibWindowMinutes;
  const byDate = new Map<string, Bar[]>();
  for (const bar of bars) {
    const date = bar.datetime.split(" ")[0];
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(bar);
  }
  let dates = Array.from(byDate.keys()).sort();
  if (maxDays > 0) dates = dates.slice(-maxDays);

  const results: { date: string; ibHigh: number; ibLow: number; highFirstFormed: boolean; breakout: string }[] = [];

  for (const date of dates) {
    const dayBars = byDate.get(date)!.sort((a, b) => a.datetime.localeCompare(b.datetime));
    const ibBars = dayBars.filter((b) => { const m = getTimeMinutes(b.datetime); return m >= IB_START && m < ibEnd; });
    if (ibBars.length < 2) continue;

    let ibHigh = -Infinity, ibLow = Infinity;
    for (const bar of ibBars) {
      const h = parseFloat(bar.high), l = parseFloat(bar.low);
      if (h > ibHigh) ibHigh = h;
      if (l < ibLow) ibLow = l;
    }

    let firstHighTouch = "", firstLowTouch = "";
    for (const bar of ibBars) {
      if (!firstHighTouch && parseFloat(bar.high) >= ibHigh) firstHighTouch = bar.datetime;
      if (!firstLowTouch && parseFloat(bar.low) <= ibLow) firstLowTouch = bar.datetime;
    }
    const highFirstFormed = firstHighTouch < firstLowTouch;

    // Post-IB breakout using M15 close
    const postIBBars = dayBars.filter((b) => { const m = getTimeMinutes(b.datetime); return m >= ibEnd && m < NOON; });
    const postIBCandles: Candle[] = postIBBars.map(b => ({
      time: b.datetime.split(" ")[1].slice(0, 5),
      open: parseFloat(b.open), high: parseFloat(b.high), low: parseFloat(b.low), close: parseFloat(b.close),
    }));
    const m15Candles = aggregateBars(postIBCandles, 15);

    let breakout = "inside";
    for (const c of m15Candles) {
      if (c.close > ibHigh) { breakout = "high"; break; }
      if (c.close < ibLow) { breakout = "low"; break; }
    }

    results.push({ date, ibHigh, ibLow, highFirstFormed, breakout });
  }

  const highFirst = results.filter(r => r.highFirstFormed);
  const lowFirst = results.filter(r => !r.highFirstFormed);

  return {
    totalDays: results.length,
    insideDays: results.filter(r => r.breakout === "inside").length,
    ibWindowMinutes,
    highFirst: {
      total: highFirst.length,
      breakHigh: highFirst.filter(r => r.breakout === "high").length,
      breakLow: highFirst.filter(r => r.breakout === "low").length,
      inside: highFirst.filter(r => r.breakout === "inside").length,
    },
    lowFirst: {
      total: lowFirst.length,
      breakHigh: lowFirst.filter(r => r.breakout === "high").length,
      breakLow: lowFirst.filter(r => r.breakout === "low").length,
      inside: lowFirst.filter(r => r.breakout === "inside").length,
    },
  };
}

// ── Momentum Analysis (ported from client) ────────────────
function detectSignals(candles: Candle[]) {
  const signals: { type: string; times: [string, string] }[] = [];
  let i = 0;
  while (i < candles.length - 1) {
    const prev = candles[i], curr = candles[i + 1];
    const prevBody = Math.abs(prev.close - prev.open);
    const prevRange = prev.high - prev.low;
    const currBody = Math.abs(curr.close - curr.open);
    const currRange = curr.high - curr.low;
    const prevBullish = prev.close >= prev.open;
    const currBullish = curr.close >= curr.open;

    if (prevRange > 0 && currRange > 0 && prevBody / prevRange >= 0.50 && currBody / currRange >= 0.30 && prevBullish === currBullish) {
      signals.push({ type: prevBullish ? "bullish" : "bearish", times: [prev.time, curr.time] });
      i += 2;
    } else { i++; }
  }
  return signals;
}

function analyzeMomentum(bars: Bar[], ibWindowMinutes: number, maxDays: number) {
  const ibEnd = IB_START + ibWindowMinutes;
  const byDate = new Map<string, Bar[]>();
  for (const bar of bars) {
    const date = bar.datetime.split(" ")[0];
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(bar);
  }
  let dates = Array.from(byDate.keys()).sort();
  if (maxDays > 0) dates = dates.slice(-maxDays);

  const tfStats: Record<string, { highFirst: Record<string, number>; lowFirst: Record<string, number> }> = {};
  for (const cfg of TF_CONFIGS) {
    tfStats[cfg.tf] = {
      highFirst: { total: 0, bullish: 0, bearish: 0, choppy: 0 },
      lowFirst: { total: 0, bullish: 0, bearish: 0, choppy: 0 },
    };
  }

  let totalDays = 0, bullishDays = 0, bearishDays = 0, choppyDays = 0;

  for (const date of dates) {
    const dayBars = byDate.get(date)!.sort((a, b) => a.datetime.localeCompare(b.datetime));
    const ibBars = dayBars.filter(b => { const m = getTimeMinutes(b.datetime); return m >= IB_START && m < ibEnd; });
    if (ibBars.length < 2) continue;

    let ibHigh = -Infinity, ibLow = Infinity;
    for (const bar of ibBars) {
      const h = parseFloat(bar.high), l = parseFloat(bar.low);
      if (h > ibHigh) ibHigh = h;
      if (l < ibLow) ibLow = l;
    }
    let firstHighTouch = "", firstLowTouch = "";
    for (const bar of ibBars) {
      if (!firstHighTouch && parseFloat(bar.high) >= ibHigh) firstHighTouch = bar.datetime;
      if (!firstLowTouch && parseFloat(bar.low) <= ibLow) firstLowTouch = bar.datetime;
    }
    const highFirstFormed = firstHighTouch < firstLowTouch;

    const momBars = dayBars.filter(b => { const m = getTimeMinutes(b.datetime); return m >= IB_START && m < NOON; });
    const momCandles: Candle[] = momBars.map(b => ({
      time: b.datetime.split(" ")[1].slice(0, 5),
      open: parseFloat(b.open), high: parseFloat(b.high), low: parseFloat(b.low), close: parseFloat(b.close),
    }));

    let bullCount = 0, bearCount = 0;
    for (const cfg of TF_CONFIGS) {
      const agg = aggregateBars(momCandles, cfg.minutes);
      const signals = detectSignals(agg);
      const momentum = signals.length > 0 ? signals[0].type : "choppy";
      const bucket = highFirstFormed ? tfStats[cfg.tf].highFirst : tfStats[cfg.tf].lowFirst;
      bucket.total++;
      bucket[momentum]++;
      if (momentum === "bullish") bullCount++;
      else if (momentum === "bearish") bearCount++;
    }

    totalDays++;
    const overall = bullCount > bearCount ? "bullish" : bearCount > bullCount ? "bearish" : "choppy";
    if (overall === "bullish") bullishDays++;
    else if (overall === "bearish") bearishDays++;
    else choppyDays++;
  }

  return { totalDays, bullishDays, bearishDays, choppyDays, tfStats };
}

// ── Main handler ──────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth: accept cron secret, service role, or valid user JWT
  const cronSecret = Deno.env.get("CRON_SECRET");
  const authHeader = req.headers.get("Authorization");
  const isAuthorized =
    (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
    (authHeader === `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`) ||
    (authHeader === `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`);

  // Also allow authenticated users (for manual trigger from UI)
  let isUserAuth = false;
  if (!isAuthorized && authHeader?.startsWith("Bearer ")) {
    const tempClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data } = await tempClient.auth.getUser();
    if (data?.user) isUserAuth = true;
  }

  if (!isAuthorized && !isUserAuth && authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const SYMBOL = "QQQ";
    const MAX_DAYS = 0; // 0 = use all available data (12 months)
    const IB_WINDOWS = [15, 30, 60]; // M15, M30, H1

    // 1. Fetch data from TwelveData
    const keysRaw = Deno.env.get("TWELVEDATA_API_KEYS") || "";
    const keys = keysRaw.split(",").map((k) => k.trim()).filter(Boolean);
    if (keys.length === 0) {
      throw new Error("No TWELVEDATA_API_KEYS configured");
    }

    let marketData: any = null;
    for (const key of keys) {
      try {
        const now = new Date();
        const endDate = now.toISOString().split("T")[0];
        const startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString().split("T")[0];
        const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(SYMBOL)}&interval=5min&start_date=${startDate}&end_date=${endDate}&apikey=${encodeURIComponent(key)}&format=JSON&timezone=America/New_York`;
        const res = await fetch(url);
        const json = await res.json();
        if (json.status === "error" && (json.message?.includes("quota") || json.message?.includes("limit") || json.code === 429)) {
          continue;
        }
        if (json.values && json.values.length > 0) {
          marketData = json;
          break;
        }
      } catch { continue; }
    }

    if (!marketData || !marketData.values) {
      throw new Error("Failed to fetch market data from TwelveData");
    }

    const bars: Bar[] = marketData.values;

    // 2. Run IB analysis for each window
    const ibResults: Record<string, any> = {};
    for (const window of IB_WINDOWS) {
      ibResults[`M${window}`] = analyzeIB(bars, window, MAX_DAYS);
    }

    // 3. Run Momentum analysis for each window
    const momentumResults: Record<string, any> = {};
    for (const window of IB_WINDOWS) {
      momentumResults[`M${window}`] = analyzeMomentum(bars, window, MAX_DAYS);
    }

    // 4. Generate AI insight
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    let aiInsight = "";

    if (LOVABLE_API_KEY) {
      const summaryData = buildSummaryForAI(SYMBOL, ibResults, momentumResults);

      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `You are an elite quantitative trading analyst for MyOpenEdge. Analyze the following pre-market statistical data for ${SYMBOL} covering the last 12 months and provide a concise daily briefing. Include:
1. **IB Bias**: Which direction has the statistical edge based on IB breakout probabilities across M15/M30/H1?
2. **Momentum Bias**: What do the momentum candle statistics suggest across timeframes?
3. **Confluence**: Do IB and Momentum agree? Rate the setup quality (High/Medium/Low).
4. **Key Takeaway**: One sentence actionable summary.

Be precise, data-driven, and reference actual percentages. Use markdown formatting. Keep it under 300 words. Respond in English.`
            },
            { role: "user", content: summaryData }
          ],
          stream: false,
        }),
      });

      if (aiResp.ok) {
        const aiJson = await aiResp.json();
        aiInsight = aiJson.choices?.[0]?.message?.content || "";
      } else {
        console.error("AI gateway error:", aiResp.status, await aiResp.text());
      }
    }

    // 5. Store in database
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const today = new Date().toISOString().split("T")[0];

    const { error: dbError } = await adminClient
      .from("auto_analyses")
      .upsert({
        symbol: SYMBOL,
        analysis_date: today,
        ib_results: ibResults,
        momentum_results: momentumResults,
        ai_insight: aiInsight,
      }, { onConflict: "symbol,analysis_date" });

    if (dbError) {
      console.error("DB insert error:", dbError.message);
      throw new Error("Failed to store analysis: " + dbError.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        symbol: SYMBOL,
        date: today,
        ib_windows: IB_WINDOWS,
        ai_insight_length: aiInsight.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("auto-analyze error:", (err as Error).message);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildSummaryForAI(symbol: string, ibResults: Record<string, any>, momentumResults: Record<string, any>): string {
  let summary = `## ${symbol} Pre-Market Analysis (Last 15 Trading Days)\n\n`;

  summary += "### IB Breakout Probabilities (Last 12 Months)\n";
  for (const [tf, data] of Object.entries(ibResults)) {
    const d = data as any;
    const hfT = d.highFirst.total || 1;
    const lfT = d.lowFirst.total || 1;
    summary += `\n**${tf} Window (${d.ibWindowMinutes}min):** ${d.totalDays} trading days, ${d.insideDays} inside days\n`;
    summary += `- High First (${d.highFirst.total}d): Break High ${(d.highFirst.breakHigh / hfT * 100).toFixed(1)}%, Break Low ${(d.highFirst.breakLow / hfT * 100).toFixed(1)}%, Inside ${(d.highFirst.inside / hfT * 100).toFixed(1)}%\n`;
    summary += `- Low First (${d.lowFirst.total}d): Break High ${(d.lowFirst.breakHigh / lfT * 100).toFixed(1)}%, Break Low ${(d.lowFirst.breakLow / lfT * 100).toFixed(1)}%, Inside ${(d.lowFirst.inside / lfT * 100).toFixed(1)}%\n`;
  }

  summary += "\n### Momentum Candle Probabilities\n";
  for (const [window, data] of Object.entries(momentumResults)) {
    const d = data as any;
    const total = d.totalDays || 1;
    summary += `\n**${window} Window:** ${d.totalDays} days — Bullish ${(d.bullishDays / total * 100).toFixed(1)}%, Bearish ${(d.bearishDays / total * 100).toFixed(1)}%, Choppy ${(d.choppyDays / total * 100).toFixed(1)}%\n`;

    for (const [tf, stats] of Object.entries(d.tfStats)) {
      const s = stats as any;
      const hfT = s.highFirst.total || 1;
      const lfT = s.lowFirst.total || 1;
      summary += `  ${tf}: HF(${s.highFirst.total}) Bull ${(s.highFirst.bullish / hfT * 100).toFixed(0)}% Bear ${(s.highFirst.bearish / hfT * 100).toFixed(0)}% | LF(${s.lowFirst.total}) Bull ${(s.lowFirst.bullish / lfT * 100).toFixed(0)}% Bear ${(s.lowFirst.bearish / lfT * 100).toFixed(0)}%\n`;
    }
  }

  return summary;
}
