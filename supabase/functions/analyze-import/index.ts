import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://myopenedge.xyz",
  "https://www.myopenedge.xyz",
  "https://myopenedge.lovable.app",
  "https://id-preview--c6b96b0f-b08c-4fc5-9451-f9469e1fb477.lovable.app",
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

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userId = claimsData.claims.sub as string;

  // Check subscription - only Pro users can use analyze-import
  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_status")
    .eq("user_id", userId)
    .single();

  const isPro = profile?.subscription_status === "active" || profile?.subscription_status === "pro";
  if (!isPro) {
    return new Response(
      JSON.stringify({ error: "Pro subscription required." }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Rate limiting: 30 requests/hour for Pro users
  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const { data: allowed, error: rlError } = await serviceClient.rpc("check_rate_limit", {
    _user_id: userId,
    _endpoint: "analyze-import",
    _max_requests: 30,
  });

  if (rlError || allowed === false) {
    return new Response(
      JSON.stringify({ error: "Rate limit exceeded. Please try again later.", retryAfterMinutes: 60 }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const { trades, fileName } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are MyOpenEdge's Trade Import Analyst AI. You analyze CSV-imported trades and provide a comprehensive post-import report.

Your analysis must cover:
1. **Summary**: Total trades, symbols traded, total P&L, win rate, best/worst trade
2. **Per-Symbol Breakdown**: Group trades by symbol, show P&L per symbol, avg trade size
3. **Anomaly Detection**: Flag suspicious trades — $0 P&L (potential pairing errors), unusually large losses, duplicate entries, trades with identical timestamps
4. **Risk Assessment**: Largest single loss vs account risk, consecutive losses, position sizing consistency
5. **Recommendations**: Actionable trading insights based on the data

Point values for common futures: MNQ=$2, NQ=$20, MES=$5, ES=$50, MGC=$10, GC=$100, MYM=$0.5, YM=$5, MCL=$10, CL=$1000

IMPORTANT: If you detect trades with $0 P&L that should have non-zero P&L (entry ≠ exit price), flag them as potential calculation errors. Explain the expected PnL based on the entry/exit prices and point values.

Respond in the same language as the user. Format with markdown headers, tables, and emoji for readability.`;

    const tradesSummary = trades.map((t: any, i: number) => 
      `#${i+1} ${t.symbol} ${t.side} qty:${t.qty} entry:${t.entry_price} exit:${t.exit_price} pnl:$${t.pnl_net} ${t.valid ? '✓' : '✗ '+t.error} open:${t.open_time} close:${t.close_time}`
    ).join('\n');

    const userMessage = `Analyze this import from file "${fileName}":\n\n${tradesSummary}\n\nProvide a full analysis report. If any PnL looks wrong based on entry/exit/qty/pointValue, flag it and show the correct calculation.`;

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
          { role: "user", content: userMessage },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(JSON.stringify({ error: "AI service unavailable" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("analyze-import error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
