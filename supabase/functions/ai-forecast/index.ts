import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Check subscription
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("subscription_status")
    .eq("user_id", user.id)
    .single();

  const isPro = profile?.subscription_status === "active" || profile?.subscription_status === "pro";
  if (!isPro) {
    return new Response(
      JSON.stringify({ error: "Pro subscription required for AI Forecasting." }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Rate limit
  const { data: allowed } = await serviceClient.rpc("check_rate_limit", {
    _user_id: user.id,
    _endpoint: "ai-forecast",
    _max_requests: 30,
  });
  if (allowed === false) {
    return new Response(
      JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const { symbol, ibData, occData } = await req.json();

    if (!symbol) {
      return new Response(JSON.stringify({ error: "symbol is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `You are an elite quantitative forecasting AI for MyOpenEdge. You analyze IB (Initial Balance) and OCC (Opening Candle Continuation) historical data to produce a directional forecast.

RULES:
- You MUST return a JSON object using the provided tool. No free text.
- Base your analysis purely on the statistical data provided.
- confidence ranges from 0 to 100.
- direction is "bullish", "bearish", or "neutral".
- Provide 3-5 concise reasoning points.
- Include 2-3 key levels or targets if data supports them.
- Always add a risk warning.
- Never guarantee outcomes. Use probabilistic language.`;

    let userPrompt = `Analyze ${symbol} and provide a directional forecast based on the following historical pattern data:\n\n`;

    if (ibData) {
      userPrompt += `## IB (Initial Balance) Analysis:\n${JSON.stringify(ibData, null, 2)}\n\n`;
    }
    if (occData) {
      userPrompt += `## OCC (Opening Candle Continuation) Analysis:\n${JSON.stringify(occData, null, 2)}\n\n`;
    }

    if (!ibData && !occData) {
      userPrompt += `No analysis data provided. Give a general note that the user should run IB and/or OCC analysis first.`;
    }

    userPrompt += `\nBased on this data, what is your directional forecast for the next session?`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "forecast_result",
              description: "Return the directional forecast result",
              parameters: {
                type: "object",
                properties: {
                  direction: {
                    type: "string",
                    enum: ["bullish", "bearish", "neutral"],
                    description: "Predicted direction",
                  },
                  confidence: {
                    type: "number",
                    description: "Confidence score 0-100",
                  },
                  summary: {
                    type: "string",
                    description: "One-sentence summary of the forecast",
                  },
                  reasoning: {
                    type: "array",
                    items: { type: "string" },
                    description: "3-5 key reasoning points",
                  },
                  key_levels: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        label: { type: "string" },
                        description: { type: "string" },
                      },
                      required: ["label", "description"],
                    },
                    description: "Key price levels or targets",
                  },
                  risk_warning: {
                    type: "string",
                    description: "Risk disclaimer",
                  },
                },
                required: ["direction", "confidence", "summary", "reasoning", "risk_warning"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "forecast_result" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "AI rate limit exceeded." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI service error");
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      throw new Error("No forecast result from AI");
    }

    const forecast = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ forecast, symbol }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("forecast error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
