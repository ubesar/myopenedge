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
    _endpoint: "twelvedata-bars",
    _max_requests: maxRequests,
  });

  if (allowed === false) {
    return new Response(
      JSON.stringify({ error: "Rate limit exceeded." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const {
    symbol,
    interval = "5min",
    outputsize = "5000",
    end_date,
    start_date,
    key_index: keyIndexStr,
  } = body;

  if (!symbol) {
    return new Response(JSON.stringify({ error: "symbol is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const keysRaw = Deno.env.get("TWELVEDATA_API_KEYS") || "";
  const keys = keysRaw.split(",").map((k) => k.trim()).filter(Boolean);

  if (keys.length === 0) {
    return new Response(JSON.stringify({ error: "No API keys configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const keyIndex = keyIndexStr ? parseInt(keyIndexStr, 10) : 0;
  const startIdx = keyIndex >= 0 ? keyIndex % keys.length : 0;

  for (let attempt = 0; attempt < keys.length; attempt++) {
    const i = (startIdx + attempt) % keys.length;
    try {
      let url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&outputsize=${encodeURIComponent(outputsize)}&apikey=${encodeURIComponent(keys[i])}&format=JSON&timezone=America/New_York&prepost=true`;
      if (end_date) url += `&end_date=${encodeURIComponent(end_date)}`;
      if (start_date) url += `&start_date=${encodeURIComponent(start_date)}`;

      const res = await fetch(url);
      const json = await res.json();

      if (json.status === "error" && (json.message?.includes("quota") || json.message?.includes("limit") || json.code === 429)) {
        continue;
      }

      // Normalize: convert to NormalizedBar format
      const values = json.values || [];
      const normalized = values.map((v: Record<string, string>) => {
        const dt = v.datetime;
        // TwelveData datetime: "2024-01-15 09:30:00"
        const ts = new Date(dt.replace(" ", "T") + "-05:00").getTime(); // ET offset approx
        return {
          timestamp: ts,
          open: parseFloat(v.open),
          high: parseFloat(v.high),
          low: parseFloat(v.low),
          close: parseFloat(v.close),
          datetime: dt,
        };
      });

      return new Response(
        JSON.stringify({ results: normalized, meta: json.meta }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (err) {
      console.log(`TwelveData key ${i + 1} failed: ${err}`);
      continue;
    }
  }

  return new Response(
    JSON.stringify({ error: "All API keys exhausted." }),
    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
