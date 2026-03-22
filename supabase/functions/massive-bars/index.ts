import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://myopenedge.xyz",
  "https://www.myopenedge.xyz",
  "https://myopenedge.lovable.app",
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

  // Rate limiting
  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: profile } = await serviceClient
    .from("profiles")
    .select("subscription_status")
    .eq("user_id", userId)
    .single();

  const isPro = profile?.subscription_status === "active" || profile?.subscription_status === "pro";
  const maxRequests = isPro ? 100 : 20;

  const { data: allowed } = await serviceClient.rpc("check_rate_limit", {
    _user_id: userId,
    _endpoint: "massive-bars",
    _max_requests: maxRequests,
  });

  if (allowed === false) {
    return new Response(
      JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Parse request
  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { symbol, timespan = "minute", multiplier = "5", from, to, asset_type = "futures" } = body;

  if (!symbol || !from || !to) {
    return new Response(JSON.stringify({ error: "symbol, from, to are required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("MASSIVE_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "MASSIVE_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    let url: string;
    if (asset_type === "futures") {
      url = `https://api.polygon.io/futures/vX/aggs/ticker/${encodeURIComponent(symbol)}/range/${multiplier}/${timespan}/${from}/${to}?adjusted=true&sort=asc&limit=50000&apiKey=${apiKey}`;
    } else {
      url = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(symbol)}/range/${multiplier}/${timespan}/${from}/${to}?adjusted=true&sort=asc&limit=50000&apiKey=${apiKey}`;
    }

    const res = await fetch(url);
    const json = await res.json();

    if (res.status === 403 || json.status === "NOT_AUTHORIZED") {
      return new Response(
        JSON.stringify({ error: "Not authorized. Check your API key or subscription plan.", status: "NOT_AUTHORIZED" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize futures response: polygon uses o,h,l,c,t fields
    const results = (json.results || []).map((bar: Record<string, number>) => ({
      timestamp: bar.t,
      open: bar.o,
      high: bar.h,
      low: bar.l,
      close: bar.c,
      volume: bar.v,
    }));

    return new Response(
      JSON.stringify({ results, resultsCount: json.resultsCount || results.length, ticker: json.ticker || symbol }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Massive API error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to fetch from Massive API" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
