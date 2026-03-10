import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = [
  "https://myopenedge.lovable.app",
  "https://id-preview--c6b96b0f-b08c-4fc5-9451-f9469e1fb477.lovable.app",
  "http://localhost:5173",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify user auth
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

    const userId = claimsData.claims.sub;

    // Create order using service role
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: order, error: orderError } = await adminClient
      .from("orders")
      .insert({ user_id: userId })
      .select("id")
      .single();

    if (orderError) {
      console.error("Failed to create order:", orderError.message);
      throw new Error("Order creation failed");
    }

    // Get the project URL for redirects
    const body = await req.json().catch(() => ({}));
    const origin = body.origin || "https://myopenedge.lovable.app";

    const ipnUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/nowpayments-ipn`;

    // Call NOWPayments API
    const invoiceRes = await fetch("https://api.nowpayments.io/v1/invoice", {
      method: "POST",
      headers: {
        "x-api-key": Deno.env.get("NOWPAYMENTS_API_KEY")!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        price_amount: 3,
        price_currency: "usd",
        order_id: order.id,
        order_description: "MyOpenEdge Pro - 1 Month Subscription",
        success_url: `${origin}/app?payment=success`,
        cancel_url: `${origin}/upgrade`,
        ipn_callback_url: ipnUrl,
      }),
    });

    const invoiceData = await invoiceRes.json();

    if (!invoiceRes.ok) {
      console.error("NOWPayments API error:", invoiceData.message);
      throw new Error("Payment processing failed");
    }

    // Update order with invoice_id
    await adminClient
      .from("orders")
      .update({ invoice_id: String(invoiceData.id) })
      .eq("id", order.id);

    return new Response(
      JSON.stringify({ invoice_url: invoiceData.invoice_url }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Invoice error:", err.message);
    return new Response(
      JSON.stringify({ error: "Payment processing failed. Please try again." }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
