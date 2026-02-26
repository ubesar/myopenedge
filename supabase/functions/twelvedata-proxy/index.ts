import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
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
      const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=5min&outputsize=5000&apikey=${encodeURIComponent(keys[i])}&format=JSON&timezone=America/New_York`;
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
