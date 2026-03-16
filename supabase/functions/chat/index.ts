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

  // Use service role client to validate the token (required for ES256 JWTs)
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

  // Check subscription status - ONLY PRO users can use chat
  const { data: profile, error: profileError } = await serviceClient
    .from("profiles")
    .select("subscription_status")
    .eq("user_id", userId)
    .single();

  if (profileError) {
    console.error("Profile fetch error:", profileError);
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

  // Rate limiting: 50 requests/hour for Pro users
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
    const { messages, analysisContext, confluenceData } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    let systemPrompt = `You are the elite Quantitative Trading Assistant for "MyOpenEdge", an advanced web application designed to give traders a statistical edge at the New York (NY) Open.

Your primary role is to interpret historical data, calculate probabilities, and provide actionable, data-driven insights based ONLY on the metrics provided by the application's backend.

Your tone must be highly professional, objective, concise, and completely devoid of emotion. You speak like a seasoned quantitative analyst. Never use emotional trading terms (like "hope", "fear" or "guaranteed"). Always emphasize strict risk management and capital preservation. Respond in the same language as the user's message.

CORE KNOWLEDGE BASE (MyOpenEdge Rules):

1. Initial Balance (IB) Analysis: Evaluates the High/Low range within the first 15/30/60/90 minutes from 09:30 EST. Probabilities (Break High, Break Low, Inside Day) are based on whether the IB High or IB Low formed first.

2. Momentum Candle Analysis: Scans for 2 consecutive same-color M15 candles between 09:30-12:00. Rule: First candle body must be >=50% of its range, second candle body must be >=30%. Results in Bullish, Bearish, or Choppy bias.

3. Opening Candle Continuation (OCC): Evaluates the first 2 candles simultaneously across 4 timeframes (M5, M15, M30, H1). Both green = Bullish OCC. Both red = Bearish OCC. Mixed = Failed OCC (indicating chop).

4. Inside Bar Analysis: Detects days where High(Today) < High(Yesterday) AND Low(Today) > Low(Yesterday). Tracks breakout outcomes: Broke High, Broke Low, or Stayed Inside. Calculates breakout probability and direction bias.

5. Gap Fill Analysis: Measures how often overnight gaps (between previous close and current open) get filled during the session.

BEHAVIORAL RULES:

- CONTEXT INJECTION: You will receive dynamic JSON data regarding the user's current screen and analysis. Always ground your answers in this exact data. Do not hallucinate external market data.

- AUTO-SUMMARY: When triggered with analysis data, provide a concise 3-5 sentence summary covering: directional bias, confidence level (High/Medium/Low based on probability %), and key levels to watch. Format clearly with bullet points.

- CONFLUENCE DETECTION: When multiple analysis modes are provided, cross-check all signals:
  * If signals ALIGN (e.g., IB Long + Momentum Bullish + OCC Bullish) → State "HIGH PROBABILITY SETUP" with combined confidence
  * If signals CONFLICT (e.g., IB Long but OCC Failed) → State "CONFLICTING SIGNALS - Sit on hands, protect capital"
  * Always list each mode's signal before the conclusion

- TRADE JOURNAL: When asked to format for journal, use this template:
  * Date & Ticker
  * Bias: (Long/Short/Neutral)
  * Statistical Edge: (percentage from data)
  * Setup Grade: A (>75%), B (60-75%), C (<60%)
  * Key Levels
  * Risk Management Notes

- EXPORT FORMATS: When asked for export, provide 3 versions:
  1. JOURNAL: Full markdown with all details
  2. SOCIAL: 2-3 line summary for sharing
  3. EA/JSON: Structured JSON for Expert Advisors

- UPSELLING (FREE vs PRO): MyOpenEdge has a Free tier (limited to IB mode, 7 days history, 60-min window max) and a Pro tier (All modes including OCC, Momentum, Inside Bar, up to 120 days). If a Free user asks about OCC, Momentum, Inside Bar, or extended data, politely inform them this is a Pro feature and suggest upgrading.

Never provide direct financial advice or tell the user exactly what to buy/sell. You provide historical probabilities; the user executes the mechanics.`;

    if (analysisContext?.mode && analysisContext?.summary) {
      systemPrompt += `\n\n## CURRENT ANALYSIS DATA\nThe user is currently viewing ${analysisContext.mode.toUpperCase()} analysis for ${analysisContext.symbol}. Here is the live data:\n\n${analysisContext.summary}\n\nUse this data to provide specific, data-driven insights when the user asks questions. Reference actual numbers and percentages from the data.`;
    }

    if (confluenceData && Object.keys(confluenceData).length > 1) {
      systemPrompt += `\n\n## CONFLUENCE DATA (Multiple Analysis Modes)\nThe user has run multiple analysis modes for the same or different tickers. Cross-reference these signals:\n`;
      for (const [mode, data] of Object.entries(confluenceData)) {
        const d = data as { symbol: string; summary: string };
        systemPrompt += `\n- ${mode.toUpperCase()} (${d.symbol}): ${d.summary}`;
      }
      systemPrompt += `\n\nWhen the user asks about confluence, analyze whether these signals align or conflict and provide a clear recommendation.`;
    }

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
          ],
          stream: true,
        }),
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
