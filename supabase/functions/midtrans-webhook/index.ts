import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function verifySHA512(orderId: string, statusCode: string, grossAmount: string, serverKey: string, receivedSignature: string): Promise<boolean> {
  const input = orderId + statusCode + grossAmount + serverKey;
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-512", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  return hashHex === receivedSignature;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();
    const notification = JSON.parse(rawBody);

    console.log("Midtrans notification:", notification.transaction_status, notification.order_id);

    const MIDTRANS_SERVER_KEY = Deno.env.get("MIDTRANS_SERVER_KEY");
    if (!MIDTRANS_SERVER_KEY) {
      throw new Error("MIDTRANS_SERVER_KEY not configured");
    }

    // Verify signature (skip if not present, e.g. test notifications)
    const signatureKey = notification.signature_key;
    if (signatureKey) {
      const valid = await verifySHA512(
        notification.order_id,
        notification.status_code,
        notification.gross_amount,
        MIDTRANS_SERVER_KEY,
        signatureKey
      );
      if (!valid) {
        console.error("Invalid Midtrans signature");
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
      order_id: notification.order_id,
      transaction_status: notification.transaction_status,
      payment_type: notification.payment_type,
      raw_payload: notification,
    });

    const transactionStatus = notification.transaction_status;
    const orderId = notification.order_id;

    // Update order status
    let orderStatus = "pending";
    if (transactionStatus === "capture" || transactionStatus === "settlement") {
      orderStatus = "settlement";
    } else if (transactionStatus === "deny" || transactionStatus === "cancel" || transactionStatus === "expire") {
      orderStatus = "failed";
    } else if (transactionStatus === "pending") {
      orderStatus = "pending";
    }

    // Use maybeSingle() instead of single() to handle test/missing orders gracefully
    const { data: orderData, error: orderError } = await adminClient
      .from("orders")
      .update({
        status: orderStatus,
        payment_type: notification.payment_type,
        updated_at: new Date().toISOString(),
      })
      .eq("midtrans_order_id", orderId)
      .select("user_id")
      .maybeSingle();

    if (orderError) {
      console.error("Update order error:", orderError.message);
      // Don't throw - still return 200 so Midtrans doesn't retry
    }

    // If settlement, activate subscription
    if (orderStatus === "settlement" && orderData?.user_id) {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);

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

      console.log(`Activated subscription for user ${orderData.user_id}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook error:", err.message);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
