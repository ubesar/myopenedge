import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function formatBar(bar: any): { datetime: string; open: string; high: string; low: string; close: string; volume: number } {
  const dt = new Date(bar.t);
  const etStr = dt.toLocaleString("en-US", { timeZone: "America/New_York", hour12: false });
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
}

async function fetchChunk(
  apiKey: string,
  symbol: string,
  from: string,
  to: string,
  multiplier: number,
  timespan: string,
  limit: number
): Promise<any[]> {
  const url = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(symbol.toUpperCase())}/range/${multiplier}/${timespan}/${from}/${to}?adjusted=true&sort=asc&limit=${limit}&apiKey=${apiKey}`;
  const resp = await fetch(url);
  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    throw new Error(data.error || data.message || `API error ${resp.status}`);
  }
  const data = await resp.json();
  return data.results || [];
}

// Split date range into chunks of ~90 calendar days to stay under 50k bar limit
function splitDateRange(from: string, to: string, chunkDays = 90): { from: string; to: string }[] {
  const chunks: { from: string; to: string }[] = [];
  const start = new Date(from + "T00:00:00Z");
  const end = new Date(to + "T00:00:00Z");

  let current = new Date(start);
  while (current < end) {
    const chunkEnd = new Date(current);
    chunkEnd.setDate(chunkEnd.getDate() + chunkDays);
    if (chunkEnd > end) chunkEnd.setTime(end.getTime());

    chunks.push({
      from: current.toISOString().split("T")[0],
      to: chunkEnd.toISOString().split("T")[0],
    });

    // Next chunk starts the day after this chunk ends
    current = new Date(chunkEnd);
    current.setDate(current.getDate() + 1);
  }

  return chunks;
}

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

    // Calculate date range span in days
    const startDate = new Date(from + "T00:00:00Z");
    const endDate = new Date(to + "T00:00:00Z");
    const spanDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    let allResults: any[] = [];

    if (spanDays <= 90) {
      // Single request for short ranges
      allResults = await fetchChunk(MASSIVE_API_KEY, symbol, from, to, multiplier, timespan, limit);
    } else {
      // Batch requests for long ranges (>90 days)
      const chunks = splitDateRange(from, to, 90);
      console.log(`Batching ${chunks.length} chunks for ${spanDays}-day range`);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        try {
          const results = await fetchChunk(MASSIVE_API_KEY, symbol, chunk.from, chunk.to, multiplier, timespan, limit);
          allResults = allResults.concat(results);
          console.log(`Chunk ${i + 1}/${chunks.length}: ${results.length} bars (${chunk.from} to ${chunk.to})`);
        } catch (err: any) {
          console.error(`Chunk ${i + 1} failed:`, err.message);
          // Continue with remaining chunks
        }

        // Small delay between chunks to avoid rate limiting
        if (i < chunks.length - 1) {
          await new Promise(r => setTimeout(r, 500));
        }
      }
    }

    // Deduplicate by timestamp (in case chunks overlap)
    const seen = new Set<number>();
    const unique: any[] = [];
    for (const bar of allResults) {
      if (!seen.has(bar.t)) {
        seen.add(bar.t);
        unique.push(bar);
      }
    }

    // Sort by timestamp ascending
    unique.sort((a, b) => a.t - b.t);

    const bars = unique.map(formatBar);

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
