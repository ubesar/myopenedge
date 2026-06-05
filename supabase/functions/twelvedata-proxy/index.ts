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

const FREE_OUTPUTSIZE = 1800;
const FREE_MAX_INTERVAL = "5min";

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

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

  if (!isPro && endpoint === "time_series") {
    outputsize = String(FREE_OUTPUTSIZE);
    interval = FREE_MAX_INTERVAL;
  }

  // Single TwelveData API key
  const rawKey = Deno.env.get("TWELVEDATA_API_KEY") || Deno.env.get("TWELVEDATA_API_KEYS") || "";
  // If multiple keys are stored (legacy comma-separated), use only the first
  const apiKey = rawKey.split(",")[0].trim();

  if (!apiKey) {
    return new Response(
      JSON.stringify({ status: "error", message: "TWELVEDATA_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Build TwelveData URL
  let tdUrl: string;
  if (endpoint === "quote") {
    tdUrl = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`;
  } else {
    const params = new URLSearchParams({
      symbol,
      interval,
      outputsize,
      apikey: apiKey,
      timezone: "America/New_York",
      order: "desc",
      format: "JSON",
    });
    if (end_date) params.set("end_date", end_date);
    tdUrl = `https://api.twelvedata.com/time_series?${params.toString()}`;
  }

  try {
    const res = await fetch(tdUrl);
    const json = await res.json().catch(() => ({}));

    if (!res.ok || json?.status === "error") {
      const msg = json?.message || `HTTP ${res.status}`;
      return new Response(
        JSON.stringify({ status: "error", message: msg }),
        { status: res.status === 429 ? 429 : 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(json), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ status: "error", message: err?.message || "Fetch failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
