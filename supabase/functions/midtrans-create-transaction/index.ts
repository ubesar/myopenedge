import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const MIDTRANS_SERVER_KEY = Deno.env.get("MIDTRANS_SERVER_KEY");
    if (!MIDTRANS_SERVER_KEY) {
      throw new Error("MIDTRANS_SERVER_KEY not configured");
    }

    const isProduction = Deno.env.get("MIDTRANS_IS_PRODUCTION") === "true";
    const baseUrl = isProduction
      ? "https://app.midtrans.com/snap/v1/transactions"
      : "https://app.sandbox.midtrans.com/snap/v1/transactions";

    const orderId = `MOE-${Date.now()}-${user.id.substring(0, 8)}`;

    // Create order in DB first
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    await adminClient.from("orders").insert({
      user_id: user.id,
      status: "pending",
      payment_method: "midtrans",
      midtrans_order_id: orderId,
      amount: 49000,
      currency: "IDR",
    });

    // Create Snap transaction
    const auth = btoa(`${MIDTRANS_SERVER_KEY}:`);
    const snapPayload = {
      transaction_details: {
        order_id: orderId,
        gross_amount: 49000,
      },
      customer_details: {
        email: user.email || "",
      },
      item_details: [
        {
          id: "pro-monthly",
          price: 49000,
          quantity: 1,
          name: "MyOpenEdge Pro - 1 Bulan",
        },
      ],
      callbacks: {
        finish: `${req.headers.get("origin") || "https://myopenedge.xyz"}/upgrade?status=success`,
      },
    };

    const snapRes = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(snapPayload),
    });

    const snapData = await snapRes.json();

    if (!snapRes.ok) {
      console.error("Midtrans Snap error:", JSON.stringify(snapData));
      throw new Error(`Midtrans API error [${snapRes.status}]: ${JSON.stringify(snapData)}`);
    }

    // Update order with snap token
    await adminClient
      .from("orders")
      .update({ snap_token: snapData.token })
      .eq("midtrans_order_id", orderId);

    return new Response(
      JSON.stringify({
        token: snapData.token,
        redirect_url: snapData.redirect_url,
        order_id: orderId,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Create transaction error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
