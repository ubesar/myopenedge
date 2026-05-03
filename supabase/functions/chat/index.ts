import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://myopenedge.xyz",
  "https://www.myopenedge.xyz",
  "https://myopenedge.lovable.app",
  "https://id-preview--c6b96b0f-b08c-4fc5-9451-f9469e1fb477.lovable.app",
  "https://c6b96b0f-b08c-4fc5-9451-f9469e1fb477.lovableproject.com",
];

function getCorsHeaders(origin: string | null) {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

const ANALYSIS_TOOLS = [
  {
    type: "function",
    function: {
      name: "run_analysis",
      description: "Run a market analysis for a given ticker symbol. Can be called multiple times for confluence/combination analysis. Available modes: ib (Initial Balance breakout), momentum (Momentum Candle Continuation - MCC: probability that session closes same direction as the NY opening candle when that candle has valid momentum body ratio), occ (Opening Candle Continuation), gapfill (Gap Fill statistics), insidebar (Inside Bar probability), outsideday (Outside Day volatility expansion).",
      parameters: {
        type: "object",
        properties: {
          symbol: {
            type: "string",
            description: "Ticker symbol to analyze (e.g. QQQ, SPY, NQ, GC, AAPL)"
          },
          mode: {
            type: "string",
            enum: ["ib", "momentum", "occ", "gapfill", "insidebar", "outsideday"],
            description: "Analysis mode to run"
          },
          max_days: {
            type: "number",
            description: "Number of trading days to analyze. Options: 20 (1 month), 40 (2 months), 60 (3 months), 120 (6 months), 240 (12 months). Default 60."
          },
          ib_window: {
            type: "number",
            description: "IB window in minutes. Options: 15, 30, 60, 90. Only relevant for 'ib' and 'momentum' modes. Default 60."
          },
        },
        required: ["symbol", "mode"],
        additionalProperties: false,
      },
    },
  },
];

serve(async (req) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth check
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: userError } = await serviceClient.auth.getUser(token);
  if (userError || !user) {
    console.error("JWT validation error:", userError);
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userId = user.id;

  // Check subscription
  const { data: profile, error: profileError } = await serviceClient
    .from("profiles")
    .select("subscription_status")
    .eq("user_id", userId)
    .single();

  if (profileError) {
    return new Response(JSON.stringify({ error: "Failed to verify subscription" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const isPro = profile?.subscription_status === "active" || profile?.subscription_status === "pro";
  if (!isPro) {
    return new Response(
      JSON.stringify({ error: "Pro subscription required. Upgrade to access AI Assistant." }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Rate limiting
  const { data: allowed, error: rlError } = await serviceClient.rpc("check_rate_limit", {
    _user_id: userId,
    _endpoint: "chat",
    _max_requests: 50,
  });
  if (rlError || allowed === false) {
    return new Response(
      JSON.stringify({ error: "Rate limit exceeded. Please try again later.", retryAfterMinutes: 60 }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const { messages, analysisContext, confluenceData, enableTools, customKnowledge } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let systemPrompt = `You are the elite Quantitative Trading Assistant for "MyOpenEdge", an advanced web application designed to give traders a statistical edge at the New York (NY) Open. Your methodology is based on Edgeful's data-driven approach to trading.

Your primary role is twofold:
1. Interpret historical data, calculate probabilities, and provide actionable, data-driven insights based on the metrics provided by the application's backend.
2. Answer general questions from users on any topic — trading concepts, market terminology, technical analysis theory, risk management principles, or any other subject the user asks about.

When answering trading-related questions, your tone must be highly professional, objective, concise, and data-driven. Never use emotional trading terms (like "hope", "fear" or "guaranteed"). Always emphasize strict risk management and capital preservation.

When answering general questions outside of trading analysis, be helpful, friendly, and informative. Provide clear and accurate answers.

Always respond in the same language as the user's message.

CORE KNOWLEDGE BASE (Edgeful Model):

1. Initial Balance (IB) Analysis:
   - The IB is the high and low of the first hour (default) of the trading session (09:30-10:30 ET).
   - IB window options: 15, 30, 60, 90 minutes.
   - Three outcome types measured across the full session (09:30-16:00):
     * Single Break (~73-80% on NQ): Price breaks ONLY one side of the IB. Once it breaks one side, expect continuation, not reversal.
     * Double Break (~15-20%): Price breaks BOTH IB high and low. Best to sit out.
     * No Break (~5%): Price stays inside IB range all session. Very rare.
   - "The Tell": Track whether IB high or low formed first to predict breakout direction.
   - Key insight: When single break occurs, it provides a clear directional bias for the rest of the day.

2. Opening Candle Continuation (OCC):
   - Measures correlation between the color of the first candle (opening candle) and the session's close direction.
   - Opening candle sizes: 5m, 15m, 30m, 1h (default 30m).
   - If first candle is GREEN → session likely closes GREEN (continuation).
   - If first candle is RED → session likely closes RED (continuation).
   - Typical probabilities: 70-75% continuation rate on major indices (ES, NQ, YM).
   - Use as instant directional bias confirmation after first candle closes.

3. Gap Fill Analysis:
   - A gap occurs when price opens higher/lower than the previous session's close (PSC).
   - Gap Up: today's open > yesterday's close. Gap Down: today's open < yesterday's close.
   - Measures how often gaps fill (price retraces to touch PSC) vs. don't fill.
   - "By Close" subreport: after a gap fills, what color does the session close?
   - Key insight: On ES, gap ups that fill close green 56% of the time — use PSC as profit target, not a level to hold through.
   - Weekday impact: Gap fill rates vary significantly by day of week (e.g., NQ gap down fills 30% on Monday vs 77% on Wednesday).

4. Inside Bar Analysis:
   - An inside bar occurs when today's entire range is WITHIN yesterday's range (High < prev High AND Low > prev Low).
   - Represents consolidation before a breakout.
   - Relatively rare: ~12-22% occurrence rate depending on instrument.
   - When inside bar forms, ~78-88% chance of breaking previous day's range.
   - Strategy: Wait for first 30 minutes, enter on breakout of 30min range, target previous day's high/low.
   - "By Breakout" subreport: ~52% upside breaks vs ~40% downside on SPY (balanced but slight upside bias in bull markets).
   - Single break is most common — target one side only, not both.

5. Outside Day Analysis (Edgeful Model):
   - IMPORTANT: An outside day occurs when price OPENS outside the previous day's range:
     * Bullish outside day: today's open > yesterday's high (gaps above)
     * Bearish outside day: today's open < yesterday's low (gaps below)
   - This is NOT the same as an engulfing candle pattern.
   - Key metrics:
     * Gap Fill rate: How often does price retrace to touch the prior day's high (bullish) or low (bearish)?
     * By Close: After an outside day, does the session close green or red?
   - On NQ: Bullish outside days retrace to prior high ~65% of the time. Bearish outside days retrace to prior low ~58%.
   - Gap size matters: Small gaps (0.1-0.19%) fill 83-93% of the time. Large gaps (0.6%+) rarely fill.
   - Trading plan: Use prior day's high/low as profit targets for gap fill trades.

6. Momentum Candle Continuation (MCC):
   - Measures the probability that a session CLOSES in the same direction as the NY opening candle, ONLY when the opening candle has valid momentum.
   - Validation: (1) Direction = green/red close vs open, (2) Momentum filter = body ≥ threshold (default 70%) of total candle range (high-low), (3) Continuation = session close (16:00 ET) on the same side as the opening direction.
   - Days where the opening candle fails the body-ratio filter are treated as NEUTRAL / no signal and excluded from continuation rates.
   - Available opening-candle timeframes: M5, M15, M30, H1 (default M30 = 09:30–10:00 ET).
   - Use the bullish/bearish continuation rates as a directional bias only after the opening candle confirms momentum.

7. Market Session Breakout (Confluence Strategy):
   - Combines OCC + IB + Market Session data for high-confidence trades.
   - Wait for London session to close (11:00 AM ET).
   - Use OCC for directional bias, IB for breakout levels, London high/low for profit targets.
   - Single break of London range occurs ~83% of the time on YM.

CONFLUENCE RULES:
- IB single break + OCC continuation = HIGH CONFIDENCE directional bias
- Gap fill probability + Outside day retracement = data-backed profit targets
- Inside bar breakout + IB breakout direction = entry confirmation
- When signals ALIGN → State "HIGH PROBABILITY SETUP" with combined confidence
- When signals CONFLICT → State "CONFLICTING SIGNALS - Protect capital"

TOOL USAGE RULES:
- When the user asks you to analyze a specific ticker, ALWAYS use the run_analysis tool.
- For confluence analysis, call run_analysis MULTIPLE times with different modes.
- After receiving results, provide: directional bias, confidence level (High/Medium/Low), key stats, actionable insights.

BEHAVIORAL RULES:
- Never provide direct financial advice. You provide historical probabilities only.
- Always emphasize strict risk management.
- Format responses clearly with bullet points and markdown.`;

    if (analysisContext?.mode && analysisContext?.summary) {
      systemPrompt += `\n\n## CURRENT ANALYSIS DATA\nThe user is currently viewing ${analysisContext.mode.toUpperCase()} analysis for ${analysisContext.symbol}. Here is the live data:\n\n${analysisContext.summary}\n\nUse this data to provide specific, data-driven insights.`;
    }

    if (confluenceData && Object.keys(confluenceData).length > 1) {
      systemPrompt += `\n\n## CONFLUENCE DATA (Multiple Analysis Modes)\n`;
      for (const [mode, data] of Object.entries(confluenceData)) {
        const d = data as { symbol: string; summary: string };
        systemPrompt += `\n- ${mode.toUpperCase()} (${d.symbol}): ${d.summary}`;
      }
    }

    if (customKnowledge && typeof customKnowledge === "string" && customKnowledge.trim()) {
      systemPrompt += `\n\n## USER'S CUSTOM KNOWLEDGE BASE\nThe user has provided the following personal trading notes, rules, and insights. Incorporate this knowledge when answering:\n\n${customKnowledge}`;
    }

    const body: Record<string, unknown> = {
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
      stream: true,
    };

    // Enable tools when requested (for the full-page AI assistant)
    if (enableTools) {
      body.tools = ANALYSIS_TOOLS;
    }

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(
        JSON.stringify({ error: "AI service unavailable" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
