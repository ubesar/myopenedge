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
      description: "Run a market analysis for a given ticker symbol. Can be called multiple times for confluence/combination analysis. Available modes: ib (Initial Balance breakout), momentum (Momentum Candle continuation), occ (Opening Candle Continuation), gapfill (Gap Fill statistics), insidebar (Inside Bar probability), outsideday (Outside Day volatility expansion).",
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
    const { messages, analysisContext, confluenceData, enableTools } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let systemPrompt = `You are the elite Quantitative Trading Assistant for "MyOpenEdge", an advanced web application designed to give traders a statistical edge at the New York (NY) Open.

Your primary role is to interpret historical data, calculate probabilities, and provide actionable, data-driven insights based ONLY on the metrics provided by the application's backend.

Your tone must be highly professional, objective, concise, and completely devoid of emotion. You speak like a seasoned quantitative analyst. Never use emotional trading terms (like "hope", "fear" or "guaranteed"). Always emphasize strict risk management and capital preservation. Respond in the same language as the user's message.

CORE KNOWLEDGE BASE (MyOpenEdge Rules):

1. Initial Balance (IB) Analysis: Evaluates the High/Low range within the first 15/30/60/90 minutes from 09:30 EST. Probabilities (Break High, Break Low, Inside Day) are based on whether the IB High or IB Low formed first ("The Tell").

2. Momentum Candle Analysis: Scans for 2 consecutive same-color candles between 09:30-12:00 across M5, M15, M30, H1 timeframes. First candle body must be >= threshold of its range, second candle body must be >= 30%.

3. Opening Candle Continuation (OCC): Evaluates the first 2 candles simultaneously across 4 timeframes (M5, M15, M30, H1). Both green = Bullish OCC. Both red = Bearish OCC. Mixed = Failed/Reverting.

4. Inside Bar Analysis: Days where High(Today) < High(Yesterday) AND Low(Today) > Low(Yesterday). Tracks breakout direction.

5. Gap Fill Analysis: Measures how often overnight gaps get filled during the session.

6. Outside Day Analysis: Days where price exceeds the prior day's range in both directions. Tracks volatility expansion.

TOOL USAGE RULES:
- When the user asks you to analyze a specific ticker or multiple tickers, ALWAYS use the run_analysis tool to fetch real data. Do NOT make up or hallucinate data.
- For confluence analysis (e.g., "gap down + OCC bullish"), call run_analysis MULTIPLE times with different modes for the same symbol.
- After receiving analysis results, provide a comprehensive interpretation with: directional bias, confidence level (High/Medium/Low), key statistics, and actionable insights.
- When combining multiple analyses, cross-check signals:
  * If signals ALIGN → State "HIGH PROBABILITY SETUP" with combined confidence
  * If signals CONFLICT → State "CONFLICTING SIGNALS - Protect capital"
  * Always list each mode's signal before the conclusion

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
