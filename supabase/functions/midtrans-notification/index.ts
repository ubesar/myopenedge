import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  try {
    const body = await req.json();
    const {
      order_id,
      transaction_status,
      fraud_status,
      gross_amount,
      signature_key,
      status_code,
    } = body;

    console.log("Midtrans notification:", { order_id, transaction_status, fraud_status });

    if (!order_id || !transaction_status) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // Verify signature
    const serverKey = Deno.env.get("MIDTRANS_SERVER_KEY")!;
    const expectedSig = order_id + status_code + gross_amount + serverKey;
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-512", encoder.encode(expectedSig));
    const hashHex = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    if (hashHex !== signature_key) {
      console.error("Signature mismatch");
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find order
    const { data: order } = await adminClient
      .from("orders")
      .select("id, user_id, status")
      .eq("midtrans_order_id", order_id)
      .single();

    if (!order) {
      console.error("Order not found:", order_id);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // Already processed
    if (order.status === "settlement" || order.status === "capture") {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // Map Midtrans status
    let newStatus = transaction_status;
    const isSuccess =
      (transaction_status === "capture" && fraud_status === "accept") ||
      transaction_status === "settlement";

    // Update order status
    await adminClient
      .from("orders")
      .update({ status: newStatus })
      .eq("id", order.id);

    // Activate subscription on success
    if (isSuccess) {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);

      await adminClient
        .from("profiles")
        .update({
          subscription_status: "active",
          subscription_end_date: endDate.toISOString(),
        })
        .eq("user_id", order.user_id);

      console.log("Subscription activated for user:", order.user_id);
    }

    // Handle failed/expired
    if (["deny", "cancel", "expire"].includes(transaction_status)) {
      console.log("Payment failed/expired:", order_id, transaction_status);
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    console.error("Notification error:", err.message);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }
});
