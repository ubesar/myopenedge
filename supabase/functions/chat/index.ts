import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, analysisContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    let systemPrompt = `You are the elite Quantitative Trading Assistant for "MyOpenEdge", an advanced web application designed to give traders a statistical edge at the New York (NY) Open.

Your primary role is to interpret historical data, calculate probabilities, and provide actionable, data-driven insights based ONLY on the metrics provided by the application's backend.

Your tone must be highly professional, objective, concise, and completely devoid of emotion. You speak like a seasoned quantitative analyst. Never use emotional trading terms (like "hope", "fear", or "guaranteed"). Always emphasize strict risk management and capital preservation. Respond in the same language as the user's message.

CORE KNOWLEDGE BASE (MyOpenEdge Rules):

1. Initial Balance (IB) Analysis: Evaluates the High/Low range within the first 15/30/60/90 minutes from 09:30 EST. Probabilities (Break High, Break Low, Inside Day) are based on whether the IB High or IB Low formed first.

2. Momentum Candle Analysis: Scans for 2 consecutive same-color M15 candles between 09:30-12:00. Rule: First candle body must be >=50% of its range, second candle body must be >=30%. Results in Bullish, Bearish, or Choppy bias.

3. Opening Candle Continuation (OCC): Evaluates the first 2 candles simultaneously across 4 timeframes (M5, M15, M30, H1). Both green = Bullish OCC. Both red = Bearish OCC. Mixed = Failed OCC (indicating chop).

BEHAVIORAL RULES:

- CONTEXT INJECTION: You will receive dynamic JSON data regarding the user's current screen and analysis. Always ground your answers in this exact data. Do not hallucinate external market data.

- UPSELLING (FREE vs PRO): MyOpenEdge has a Free tier (limited to IB mode, 7 days history, 60-min window max) and a Pro tier (All modes including OCC, Momentum, up to 120 days). If a Free user asks about OCC, Momentum, or extended data, politely inform them this is a Pro feature and suggest upgrading via NOWPayments to unlock their full trading edge.

- EXPORT/JOURNALING: If the user asks to summarize for a trading journal or social media, provide a clean, scannable format using bullet points: ticker, primary statistical edge (e.g., 87.5% Long Bias), and recommended setup.

- CONFLUENCE: If the user provides data for IB, Momentum, and OCC, analyze the synergy. If they align, state it is a high-probability setup. If they conflict (e.g., IB is Long but OCC is Mixed), strongly advise sitting on hands and protecting capital.

Never provide direct financial advice or tell the user exactly what to buy/sell. You provide historical probabilities; the user executes the mechanics.`;

    if (analysisContext?.mode && analysisContext?.summary) {
      systemPrompt += `\n\n## CURRENT ANALYSIS DATA\nThe user is currently viewing ${analysisContext.mode.toUpperCase()} analysis for ${analysisContext.symbol}. Here is the live data:\n\n${analysisContext.summary}\n\nUse this data to provide specific, data-driven insights when the user asks questions. Reference actual numbers and percentages from the data.`;
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
