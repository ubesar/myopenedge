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
    const { imageBase64, mimeType } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "No image provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are a trading screenshot analyzer. Extract ALL trade data from the screenshot image.

For each trade you find, extract:
- symbol: the trading instrument/ticker (e.g., MNQ, ES, MGC, NQ, AAPL)
- side: LONG or SHORT (Buy=LONG, Sell=SHORT)
- qty: number of contracts/shares
- entry_price: entry/open price
- exit_price: exit/close price  
- open_time: when the trade was opened (ISO 8601 format, use best guess if only date shown)
- close_time: when the trade was closed (ISO 8601 format)
- pnl_net: the net profit/loss amount
- fees: commission/fees if visible, otherwise 0

Known futures point values for PnL verification:
MNQ=$2, NQ=$20, MES=$5, ES=$50, MYM=$0.5, YM=$5, MGC=$10, GC=$100, MCL=$10, CL=$1000, M2K=$5, RTY=$50

If you can see entry/exit prices, verify the PnL: 
- LONG PnL = (exit - entry) * qty * pointValue
- SHORT PnL = (entry - exit) * qty * pointValue

Return the data using the extract_trades tool.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract all trades from this trading screenshot. Be thorough and accurate with prices and PnL values.",
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType || "image/png"};base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_trades",
              description: "Extract structured trade data from the screenshot",
              parameters: {
                type: "object",
                properties: {
                  trades: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        symbol: { type: "string", description: "Trading instrument symbol" },
                        side: { type: "string", enum: ["LONG", "SHORT"] },
                        qty: { type: "number", description: "Number of contracts/shares" },
                        entry_price: { type: "number" },
                        exit_price: { type: "number" },
                        open_time: { type: "string", description: "ISO 8601 datetime" },
                        close_time: { type: "string", description: "ISO 8601 datetime" },
                        pnl_net: { type: "number", description: "Net P&L in dollars" },
                        fees: { type: "number", description: "Fees/commissions" },
                      },
                      required: ["symbol", "side", "qty", "entry_price", "exit_price", "pnl_net"],
                      additionalProperties: false,
                    },
                  },
                  summary: {
                    type: "string",
                    description: "Brief summary of what was found in the screenshot",
                  },
                  warnings: {
                    type: "array",
                    items: { type: "string" },
                    description: "Any warnings about data quality or uncertain extractions",
                  },
                },
                required: ["trades", "summary"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_trades" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(JSON.stringify({ error: "AI service unavailable" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "AI could not extract trades from the image" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const extracted = JSON.parse(toolCall.function.arguments);
    
    // Post-process trades
    const trades = (extracted.trades || []).map((t: any) => ({
      symbol: t.symbol || "UNKNOWN",
      side: t.side || "LONG",
      qty: t.qty || 1,
      entry_price: t.entry_price || 0,
      exit_price: t.exit_price || 0,
      open_time: t.open_time || new Date().toISOString(),
      close_time: t.close_time || new Date().toISOString(),
      pnl_gross: t.pnl_net || 0,
      fees: t.fees || 0,
      pnl_net: t.pnl_net || 0,
      valid: t.entry_price > 0 && t.exit_price > 0,
      error: t.entry_price <= 0 || t.exit_price <= 0 ? "Missing price data" : undefined,
    }));

    return new Response(JSON.stringify({
      trades,
      summary: extracted.summary || "",
      warnings: extracted.warnings || [],
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-screenshot error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
