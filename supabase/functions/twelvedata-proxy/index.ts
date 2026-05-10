import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://myopenedge.xyz",
  "https://www.myopenedge.xyz",
  "https://myopenedge.lovable.app",
  "https://myopenedge10.lovable.app",
  "https://id-preview--c30081a0-711d-47d1-882a-c2d9518a27ee.lovable.app",
  "https://c30081a0-711d-47d1-882a-c2d9518a27ee.lovableproject.com",
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

// Free-tier limits (preserved)
const FREE_OUTPUTSIZE = 1800;
const FREE_MAX_INTERVAL = "5min";

// Map TwelveData-style interval -> Polygon multiplier/timespan
function mapInterval(interval: string): { multiplier: number; timespan: string; minutesPerBar: number } {
  const m: Record<string, { multiplier: number; timespan: string; minutesPerBar: number }> = {
    "1min":   { multiplier: 1,  timespan: "minute", minutesPerBar: 1 },
    "5min":   { multiplier: 5,  timespan: "minute", minutesPerBar: 5 },
    "15min":  { multiplier: 15, timespan: "minute", minutesPerBar: 15 },
    "30min":  { multiplier: 30, timespan: "minute", minutesPerBar: 30 },
    "45min":  { multiplier: 45, timespan: "minute", minutesPerBar: 45 },
    "1h":     { multiplier: 1,  timespan: "hour",   minutesPerBar: 60 },
    "2h":     { multiplier: 2,  timespan: "hour",   minutesPerBar: 120 },
    "4h":     { multiplier: 4,  timespan: "hour",   minutesPerBar: 240 },
    "1day":   { multiplier: 1,  timespan: "day",    minutesPerBar: 60 * 24 },
    "1week":  { multiplier: 1,  timespan: "week",   minutesPerBar: 60 * 24 * 7 },
    "1month": { multiplier: 1,  timespan: "month",  minutesPerBar: 60 * 24 * 30 },
  };
  return m[interval] || m["5min"];
}

// Convert ms timestamp -> ET formatted "YYYY-MM-DD HH:mm:ss"
function toETString(ms: number, dailyOnly = false): string {
  const dt = new Date(ms);
  const etStr = dt.toLocaleString("en-US", { timeZone: "America/New_York", hour12: false });
  // etStr: "M/D/YYYY, HH:mm:ss"
  const [datePart, timePart] = etStr.split(", ");
  const [month, day, year] = datePart.split("/");
  const date = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  if (dailyOnly) return date;
  return `${date} ${timePart}`;
}

async function fetchPolygonAggs(
  apiKey: string,
  symbol: string,
  multiplier: number,
  timespan: string,
  from: string,
  to: string,
  limit: number,
): Promise<{ ok: boolean; status: number; results: any[]; errorMsg?: string }> {
  const url = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(
    symbol.toUpperCase()
  )}/range/${multiplier}/${timespan}/${from}/${to}?adjusted=true&sort=desc&limit=${limit}&apiKey=${apiKey}`;
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      results: [],
      errorMsg: json?.error || json?.message || `HTTP ${res.status}`,
    };
  }
  return { ok: true, status: 200, results: json.results || [] };
}

async function fetchPolygonPrev(
  apiKey: string,
  symbol: string,
): Promise<{ ok: boolean; status: number; result: any | null; errorMsg?: string }> {
  const url = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(
    symbol.toUpperCase()
  )}/prev?adjusted=true&apiKey=${apiKey}`;
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      result: null,
      errorMsg: json?.error || json?.message || `HTTP ${res.status}`,
    };
  }
  const r = (json.results && json.results[0]) || null;
  return { ok: true, status: 200, result: r };
}

Deno.serve(async (req) => {
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
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userId = claimsData.claims.sub as string;

  // Subscription check
  const { data: profile, error: profileError } = await supabase
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

  const isPro =
    profile?.subscription_status === "active" || profile?.subscription_status === "pro";

  // Rate limit (kept identical, endpoint name preserved)
  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const maxRequests = isPro ? 100 : 20;
  const { data: allowed, error: rlError } = await serviceClient.rpc("check_rate_limit", {
    _user_id: userId,
    _endpoint: "twelvedata-proxy",
    _max_requests: maxRequests,
  });

  if (rlError || allowed === false) {
    return new Response(
      JSON.stringify({ error: "Rate limit exceeded. Please try again later.", retryAfterMinutes: 60 }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Parse params
  let symbol: string | null = null;
  let interval = "5min";
  let outputsize = "5000";
  let endpoint = "time_series";
  let end_date: string | null = null;

  if (req.method === "GET") {
    const url = new URL(req.url);
    symbol = url.searchParams.get("symbol");
    interval = url.searchParams.get("interval") || "5min";
    outputsize = url.searchParams.get("outputsize") || "5000";
    endpoint = url.searchParams.get("endpoint") || "time_series";
    end_date = url.searchParams.get("end_date");
  } else {
    try {
      const body = await req.json();
      symbol = body.symbol;
      interval = body.interval || "5min";
      outputsize = String(body.outputsize ?? "5000");
      endpoint = body.endpoint || "time_series";
      end_date = body.end_date || null;
    } catch {
      // ignore
    }
  }

  if (!symbol || typeof symbol !== "string") {
    return new Response(JSON.stringify({ error: "Symbol is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Free-tier enforcement
  if (!isPro && endpoint === "time_series") {
    outputsize = String(FREE_OUTPUTSIZE);
    interval = FREE_MAX_INTERVAL;
  }

  // Load Massive API keys (comma-separated supported, single key works too)
  const keysRaw = Deno.env.get("MASSIVE_API_KEY") || "";
  const keys = keysRaw.split(",").map((k) => k.trim()).filter(Boolean);

  if (keys.length === 0) {
    return new Response(
      JSON.stringify({ status: "error", message: "MASSIVE_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // ===== QUOTE endpoint =====
  if (endpoint === "quote") {
    let lastErr = "";
    for (let i = 0; i < keys.length; i++) {
      const r = await fetchPolygonPrev(keys[i], symbol);
      if (!r.ok) {
        lastErr = r.errorMsg || "";
        if (r.status === 429 || /quota|limit/i.test(lastErr)) continue;
        break;
      }
      if (!r.result) {
        return new Response(
          JSON.stringify({ status: "error", message: "No quote data" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const bar = r.result;
      const change = bar.c - bar.o;
      const percent_change = bar.o ? (change / bar.o) * 100 : 0;
      // TwelveData-compatible quote payload
      const payload = {
        symbol: symbol.toUpperCase(),
        name: symbol.toUpperCase(),
        exchange: "",
        currency: "USD",
        datetime: toETString(bar.t, true),
        timestamp: Math.floor(bar.t / 1000),
        open: String(bar.o),
        high: String(bar.h),
        low: String(bar.l),
        close: String(bar.c),
        volume: String(bar.v ?? 0),
        previous_close: String(bar.o), // best effort
        change: String(change),
        percent_change: String(percent_change),
        is_market_open: false,
      };
      return new Response(JSON.stringify(payload), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(
      JSON.stringify({ status: "error", message: lastErr || "All API keys exhausted" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // ===== TIME SERIES endpoint =====
  const mapped = mapInterval(interval);
  const requestedSize = Math.max(1, Math.min(parseInt(outputsize, 10) || 5000, 50000));

  // Compute date range based on outputsize. Add buffer for non-trading days.
  const endMs = end_date
    ? new Date(end_date + "T23:59:59Z").getTime()
    : Date.now();

  // Approx calendar days needed: for intraday, ~390 RTH min/day on US equities.
  // We over-fetch and slice to be safe.
  let calendarDaysBack: number;
  if (mapped.timespan === "minute") {
    const barsPerDay = 390 / mapped.multiplier; // RTH minutes
    const tradingDays = Math.ceil(requestedSize / barsPerDay);
    calendarDaysBack = Math.ceil(tradingDays * 1.6) + 5;
  } else if (mapped.timespan === "hour") {
    const barsPerDay = 7 / mapped.multiplier;
    const tradingDays = Math.ceil(requestedSize / barsPerDay);
    calendarDaysBack = Math.ceil(tradingDays * 1.6) + 5;
  } else if (mapped.timespan === "day") {
    calendarDaysBack = Math.ceil(requestedSize * 1.5) + 5;
  } else if (mapped.timespan === "week") {
    calendarDaysBack = requestedSize * 7 + 14;
  } else {
    calendarDaysBack = requestedSize * 31 + 31;
  }
  // Polygon free tier limits ~2 years of history
  calendarDaysBack = Math.min(calendarDaysBack, 730);

  const fromMs = endMs - calendarDaysBack * 24 * 60 * 60 * 1000;
  const fromStr = new Date(fromMs).toISOString().split("T")[0];
  const toStr = new Date(endMs).toISOString().split("T")[0];

  let lastErr = "";
  for (let i = 0; i < keys.length; i++) {
    const r = await fetchPolygonAggs(
      keys[i],
      symbol,
      mapped.multiplier,
      mapped.timespan,
      fromStr,
      toStr,
      50000
    );
    if (!r.ok) {
      lastErr = r.errorMsg || "";
      if (r.status === 429 || /quota|limit|exceeded/i.test(lastErr)) {
        console.log(`Massive key ${i + 1} rate-limited, trying next...`);
        continue;
      }
      break;
    }

    // Sort desc by timestamp (latest first), take requestedSize
    const sorted = (r.results || []).sort((a: any, b: any) => b.t - a.t).slice(0, requestedSize);
    const dailyOnly = mapped.timespan === "day" || mapped.timespan === "week" || mapped.timespan === "month";

    const values = sorted.map((bar: any) => ({
      datetime: toETString(bar.t, dailyOnly),
      open: String(bar.o),
      high: String(bar.h),
      low: String(bar.l),
      close: String(bar.c),
      volume: String(bar.v ?? 0),
    }));

    // TwelveData-compatible response
    const payload = {
      meta: {
        symbol: symbol.toUpperCase(),
        interval,
        currency: "USD",
        exchange_timezone: "America/New_York",
        exchange: "",
        type: "Common Stock",
      },
      values,
      status: "ok",
    };

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({ status: "error", message: lastErr || "All API keys exhausted. Please try again later." }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
