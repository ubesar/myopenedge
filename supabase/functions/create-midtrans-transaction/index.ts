import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Ensure profile exists
    await adminClient
      .from("profiles")
      .upsert({ user_id: user.id, email: user.email }, { onConflict: "user_id" });

    // Create order
    const orderId = `MOE-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const amount = 50000; // Rp 50.000

    const { data: order, error: orderError } = await adminClient
      .from("orders")
      .insert({
        user_id: user.id,
        midtrans_order_id: orderId,
        amount,
        status: "pending",
      })
      .select("id")
      .single();

    if (orderError) {
      console.error("Order creation failed:", orderError.message);
      throw new Error("Order creation failed");
    }

    // Create Midtrans Snap transaction
    const serverKey = Deno.env.get("MIDTRANS_SERVER_KEY")!;
    const isProduction = !serverKey.startsWith("SB-");
    const snapUrl = isProduction
      ? "https://app.midtrans.com/snap/v1/transactions"
      : "https://app.sandbox.midtrans.com/snap/v1/transactions";

    const authString = btoa(serverKey + ":");

    const snapRes = await fetch(snapUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${authString}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        transaction_details: {
          order_id: orderId,
          gross_amount: amount,
        },
        customer_details: {
          email: user.email,
        },
        item_details: [
          {
            id: "pro-subscription",
            price: amount,
            quantity: 1,
            name: "MyOpenEdge Pro - 1 Bulan",
          },
        ],
      }),
    });

    const snapData = await snapRes.json();

    if (!snapRes.ok) {
      console.error("Midtrans Snap error:", JSON.stringify(snapData));
      throw new Error("Failed to create payment");
    }

    // Update order with snap_token
    await adminClient
      .from("orders")
      .update({ snap_token: snapData.token })
      .eq("id", order.id);

    return new Response(
      JSON.stringify({
        snap_token: snapData.token,
        redirect_url: snapData.redirect_url,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Midtrans error:", err.message);
    return new Response(
      JSON.stringify({ error: "Payment processing failed. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
