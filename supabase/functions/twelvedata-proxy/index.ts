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

// Free-tier limits
const FREE_OUTPUTSIZE = 390; // ~1 day of 5min bars
const FREE_MAX_INTERVAL = "5min";

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
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userId = claimsData.claims.sub as string;

  // Check subscription status
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

  const isPro = profile?.subscription_status === "active" || profile?.subscription_status === "pro";

  // Rate limiting: use service role client to call security definer function
  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const maxRequests = isPro ? 100 : 20; // per hour
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

  // Parse request - support both GET query params and POST JSON body
  let symbol: string | null = null;
  let interval = "5min";
  let outputsize = "5000";
  let endpoint = "time_series"; // default

  if (req.method === "GET") {
    const url = new URL(req.url);
    symbol = url.searchParams.get("symbol");
    interval = url.searchParams.get("interval") || "5min";
    outputsize = url.searchParams.get("outputsize") || "5000";
    endpoint = url.searchParams.get("endpoint") || "time_series";
  } else {
    try {
      const body = await req.json();
      symbol = body.symbol;
      interval = body.interval || "5min";
      outputsize = body.outputsize || "5000";
      endpoint = body.endpoint || "time_series";
    } catch {
      // Fall through to validation
    }
  }

  if (!symbol || typeof symbol !== "string") {
    return new Response(JSON.stringify({ error: "Symbol is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Enforce free-tier limits (only for time_series)
  if (!isPro && endpoint === "time_series") {
    outputsize = String(FREE_OUTPUTSIZE);
    interval = FREE_MAX_INTERVAL;
  }

  // Load API keys from secret (comma-separated)
  const keysRaw = Deno.env.get("TWELVEDATA_API_KEYS") || "";
  const keys = keysRaw.split(",").map((k) => k.trim()).filter(Boolean);

  if (keys.length === 0) {
    return new Response(
      JSON.stringify({ error: "No API keys configured" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Try each key with auto-rotation
  for (let i = 0; i < keys.length; i++) {
    try {
      const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&outputsize=${encodeURIComponent(outputsize)}&apikey=${encodeURIComponent(keys[i])}&format=JSON&timezone=America/New_York`;
      const res = await fetch(url);
      const json = await res.json();

      // If quota exceeded, try next key
      if (
        json.status === "error" &&
        (json.message?.includes("quota") ||
          json.message?.includes("limit") ||
          json.code === 429)
      ) {
        console.log(`API key ${i + 1} exhausted, trying next...`);
        continue;
      }

      return new Response(JSON.stringify(json), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err) {
      console.log(`API key ${i + 1} failed: ${err}`);
      continue;
    }
  }

  return new Response(
    JSON.stringify({
      status: "error",
      message: "All API keys exhausted. Please try again later.",
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});
