import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    const NOWPAYMENTS_API_KEY = Deno.env.get("NOWPAYMENTS_API_KEY");
    if (!NOWPAYMENTS_API_KEY) {
      throw new Error("NOWPAYMENTS_API_KEY not configured");
    }

    const body = await req.json().catch(() => ({}));
    const plan = body.plan || "monthly";
    const currency = body.currency || "idr";

    // Pricing
    const prices: Record<string, Record<string, { amount: number; label: string }>> = {
      monthly: {
        idr: { amount: 49000, label: "Rp 49.000/bulan" },
        usd: { amount: 2.99, label: "$2.99/month" },
      },
      yearly: {
        idr: { amount: 490000, label: "Rp 490.000/tahun" },
        usd: { amount: 29.90, label: "$29.90/year" },
      },
    };

    let pricing = prices[plan]?.[currency];
    if (!pricing) {
      return new Response(JSON.stringify({ error: "Invalid plan or currency" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Special discount for specific users
    if (user.email === "basoukkas.pnup09@gmail.com") {
      pricing = { amount: 0.1, label: "$0.10 (discount)" };
    }

    const orderId = `MOE-${Date.now()}-${user.id.substring(0, 8)}`;
    const daysToAdd = plan === "yearly" ? 365 : 30;

    // Create order in DB
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    await adminClient.from("orders").insert({
      user_id: user.id,
      status: "pending",
      payment_method: "nowpayments",
      midtrans_order_id: orderId, // reuse column for order reference
      amount: pricing.amount,
      currency: currency.toUpperCase(),
    });

    // Create NOWPayments invoice
    const origin = req.headers.get("origin") || "https://myopenedge.lovable.app";
    const invoicePayload = {
      price_amount: pricing.amount,
      price_currency: currency,
      order_id: orderId,
      order_description: `MyOpenEdge Pro - ${plan === "yearly" ? "1 Year" : "1 Month"}`,
      ipn_callback_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/nowpayments-ipn`,
      success_url: `${origin}/upgrade?status=success`,
      cancel_url: `${origin}/upgrade?status=cancel`,
    };

    const invoiceRes = await fetch("https://api.nowpayments.io/v1/invoice", {
      method: "POST",
      headers: {
        "x-api-key": NOWPAYMENTS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(invoicePayload),
    });

    const invoiceData = await invoiceRes.json();

    if (!invoiceRes.ok) {
      console.error("NOWPayments error:", JSON.stringify(invoiceData));
      throw new Error(`NOWPayments API error [${invoiceRes.status}]: ${JSON.stringify(invoiceData)}`);
    }

    // Update order with invoice ID
    await adminClient
      .from("orders")
      .update({ invoice_id: invoiceData.id?.toString() })
      .eq("midtrans_order_id", orderId);

    return new Response(
      JSON.stringify({
        invoice_url: invoiceData.invoice_url,
        order_id: orderId,
        invoice_id: invoiceData.id,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Create invoice error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
