import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function verifyHMAC(body: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const hashHex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hashHex === signature;
}

function sortObject(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.keys(obj)
    .sort()
    .reduce((result: Record<string, unknown>, key) => {
      result[key] = obj[key] != null && typeof obj[key] === "object" && !Array.isArray(obj[key])
        ? sortObject(obj[key] as Record<string, unknown>)
        : obj[key];
      return result;
    }, {});
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();
    const notification = JSON.parse(rawBody);

    console.log("NOWPayments IPN:", notification.payment_status, notification.order_id);

    const IPN_SECRET = Deno.env.get("NOWPAYMENTS_IPN_SECRET");
    if (!IPN_SECRET) {
      throw new Error("NOWPAYMENTS_IPN_SECRET not configured");
    }

    // Verify HMAC signature
    const receivedSig = req.headers.get("x-nowpayments-sig");
    if (receivedSig) {
      const sorted = sortObject(notification);
      const valid = await verifyHMAC(JSON.stringify(sorted), receivedSig, IPN_SECRET);
      if (!valid) {
        console.error("Invalid NOWPayments HMAC signature");
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Log webhook
    await adminClient.from("midtrans_webhook_logs").insert({
      order_id: notification.order_id || notification.invoice_id?.toString(),
      transaction_status: notification.payment_status,
      payment_type: notification.pay_currency || "crypto",
      raw_payload: notification,
    });

    const paymentStatus = notification.payment_status;
    const orderId = notification.order_id;

    if (!orderId) {
      console.log("No order_id in IPN, skipping");
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Map NOWPayments status to our status
    let orderStatus = "pending";
    if (paymentStatus === "finished" || paymentStatus === "confirmed") {
      orderStatus = "settlement";
    } else if (paymentStatus === "failed" || paymentStatus === "expired" || paymentStatus === "refunded") {
      orderStatus = "failed";
    } else if (paymentStatus === "partially_paid") {
      orderStatus = "pending";
    }

    const { data: orderData, error: orderError } = await adminClient
      .from("orders")
      .update({
        status: orderStatus,
        payment_type: notification.pay_currency || "crypto",
        updated_at: new Date().toISOString(),
      })
      .eq("midtrans_order_id", orderId)
      .select("user_id")
      .maybeSingle();

    if (orderError) {
      console.error("Update order error:", orderError.message);
    }

    // If settlement, activate subscription
    if (orderStatus === "settlement" && orderData?.user_id) {
      // Determine plan duration from order amount
      const { data: order } = await adminClient
        .from("orders")
        .select("amount")
        .eq("midtrans_order_id", orderId)
        .maybeSingle();

      // Yearly if amount >= 29 USD or >= 400000 IDR
      const amount = order?.amount || 0;
      const isYearly = amount >= 29 || amount >= 400000;
      const daysToAdd = isYearly ? 365 : 30;

      const endDate = new Date();
      endDate.setDate(endDate.getDate() + daysToAdd);

      const { error: profileError } = await adminClient
        .from("profiles")
        .update({
          subscription_status: "active",
          subscription_end_date: endDate.toISOString(),
        })
        .eq("user_id", orderData.user_id);

      if (profileError) {
        console.error("Update profile error:", profileError.message);
      }

      console.log(`Activated ${isYearly ? "yearly" : "monthly"} subscription for user ${orderData.user_id}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("IPN webhook error:", err.message);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
