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
    const MASSIVE_API_KEY = Deno.env.get("MASSIVE_API_KEY");
    if (!MASSIVE_API_KEY) {
      return new Response(JSON.stringify({ error: "MASSIVE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { symbol, from, to, multiplier = 5, timespan = "minute", limit = 50000 } = await req.json();

    if (!symbol || !from || !to) {
      return new Response(JSON.stringify({ error: "symbol, from, to are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = `https://api.massive.com/v2/aggs/ticker/${encodeURIComponent(symbol.toUpperCase())}/range/${multiplier}/${timespan}/${from}/${to}?adjusted=true&sort=asc&limit=${limit}&apiKey=${MASSIVE_API_KEY}`;

    const resp = await fetch(url);
    const data = await resp.json();

    if (!resp.ok) {
      return new Response(JSON.stringify({ error: data.error || data.message || "Massive API error", status: "error" }), {
        status: resp.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Massive returns { results: [{t, o, h, l, c, v, ...}], resultsCount, ... }
    // Convert to our standard bar format with ET timestamps
    const results = data.results || [];
    const bars = results.map((bar: any) => {
      // bar.t is Unix ms timestamp in UTC. Convert to ET datetime string.
      const dt = new Date(bar.t);
      const etStr = dt.toLocaleString("en-US", { timeZone: "America/New_York", hour12: false });
      // Parse "M/D/YYYY, HH:MM:SS" -> "YYYY-MM-DD HH:MM:SS"
      const [datePart, timePart] = etStr.split(", ");
      const [month, day, year] = datePart.split("/");
      const formatted = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")} ${timePart}`;
      return {
        datetime: formatted,
        open: String(bar.o),
        high: String(bar.h),
        low: String(bar.l),
        close: String(bar.c),
        volume: bar.v,
      };
    });

    return new Response(JSON.stringify({ values: bars, count: bars.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
