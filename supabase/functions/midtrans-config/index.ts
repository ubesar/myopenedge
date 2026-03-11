const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const serverKey = Deno.env.get("MIDTRANS_SERVER_KEY") || "";
  const clientKey = Deno.env.get("MIDTRANS_CLIENT_KEY") || "";
  const isProduction = !serverKey.startsWith("SB-");

  return new Response(
    JSON.stringify({ client_key: clientKey, is_production: isProduction }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
