import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Fetch a single batch from TwelveData with key rotation
async function fetchBatch(
  symbol: string,
  startDate: string,
  endDate: string,
  keys: string[]
): Promise<any[]> {
  for (const key of keys) {
    try {
      const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=5min&start_date=${startDate}&end_date=${endDate}&outputsize=5000&apikey=${encodeURIComponent(key)}&format=JSON&timezone=America/New_York`;
      const res = await fetch(url);
      const json = await res.json();

      if (
        json.status === "error" &&
        (json.message?.includes("quota") ||
          json.message?.includes("limit") ||
          json.code === 429)
      ) {
        console.log(`API key exhausted for batch ${startDate}→${endDate}, trying next...`);
        continue;
      }

      if (json.values && json.values.length > 0) {
        return json.values;
      }
      return [];
    } catch (err) {
      console.log(`API key failed for batch ${startDate}→${endDate}: ${err}`);
      continue;
    }
  }
  return [];
}

// Generate 6 date ranges of ~2 months each covering 12 months
function generateDateRanges(): { start: string; end: string }[] {
  const now = new Date();
  const ranges: { start: string; end: string }[] = [];

  for (let i = 0; i < 6; i++) {
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() - i * 2);

    const startDate = new Date(now);
    startDate.setMonth(startDate.getMonth() - (i + 1) * 2);
    // Add 1 day to start to avoid overlap (except first batch)
    if (i > 0) {
      startDate.setDate(startDate.getDate() + 1);
    }

    ranges.push({
      start: startDate.toISOString().split("T")[0],
      end: endDate.toISOString().split("T")[0],
    });
  }

  return ranges;
}

Deno.serve(async (req) => {
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

  const { data } = await supabase.auth.getUser();
  if (!data?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Parse request
  const { symbol } = await req.json();
  if (!symbol || typeof symbol !== "string") {
    return new Response(JSON.stringify({ error: "Symbol is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Load API keys
  const keysRaw = Deno.env.get("TWELVEDATA_API_KEYS") || "";
  const keys = keysRaw.split(",").map((k) => k.trim()).filter(Boolean);

  if (keys.length === 0) {
    return new Response(
      JSON.stringify({ error: "No API keys configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Fetch 6 batches of 2 months each
    const ranges = generateDateRanges();
    const allValues: any[] = [];
    const seen = new Set<string>();

    for (const range of ranges) {
      const batch = await fetchBatch(symbol, range.start, range.end, keys);
      for (const bar of batch) {
        // Deduplicate by datetime
        if (!seen.has(bar.datetime)) {
          seen.add(bar.datetime);
          allValues.push(bar);
        }
      }
    }

    // Sort descending by datetime (newest first, matching TwelveData default)
    allValues.sort((a, b) => b.datetime.localeCompare(a.datetime));

    return new Response(
      JSON.stringify({
        meta: {
          symbol: symbol.toUpperCase(),
          interval: "5min",
          currency: "USD",
          exchange_timezone: "America/New_York",
          type: "ETF",
        },
        values: allValues,
        status: "ok",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
