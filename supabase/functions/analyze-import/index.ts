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
