import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function sortObject(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.keys(obj)
    .sort()
    .reduce((result: Record<string, unknown>, key) => {
      const val = obj[key];
      if (val !== null && typeof val === "object" && !Array.isArray(val)) {
        result[key] = sortObject(val as Record<string, unknown>);
      } else {
        result[key] = val;
      }
      return result;
    }, {});
}

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validStatuses = ['waiting', 'confirming', 'confirmed', 'finished', 'failed', 'refunded', 'expired'];

Deno.serve(async (req) => {
  // No CORS needed - server-to-server webhook
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  try {
    const sig = req.headers.get("x-nowpayments-sig");
    const rawBody = await req.text();
    const body = JSON.parse(rawBody);

    // Signature verification
    const ipnSecret = Deno.env.get("NOWPAYMENTS_IPN_SECRET")!;
    const sorted = sortObject(body);
    const sortedString = JSON.stringify(sorted);

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(ipnSecret),
      { name: "HMAC", hash: "SHA-512" },
      false,
      ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(sortedString));
    const hexHash = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    if (hexHash !== sig) {
      console.error("IPN signature mismatch");
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { payment_status, order_id, price_amount } = body;

    // Validate required fields
    if (!order_id || !payment_status) {
      console.error("Missing required fields");
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // Validate order_id format
    if (!uuidRegex.test(order_id)) {
      console.error("Invalid order_id format:", order_id);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // Validate payment status
    if (!validStatuses.includes(payment_status)) {
      console.error("Invalid payment_status:", payment_status);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Idempotency check
    const { data: existingOrder } = await adminClient
      .from("orders")
      .select("status, user_id")
      .eq("id", order_id)
      .single();

    if (!existingOrder) {
      console.error("Order not found:", order_id);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    if (existingOrder.status === "finished") {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // Process finished payment
    if (payment_status === "finished") {
      // Verify payment amount if provided
      if (price_amount && parseFloat(price_amount) < 3) {
        console.error("Payment amount mismatch:", price_amount);
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }

      await adminClient
        .from("orders")
        .update({ status: "finished" })
        .eq("id", order_id);

      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);

      await adminClient
        .from("profiles")
        .update({
          subscription_status: "active",
          subscription_end_date: endDate.toISOString(),
        })
        .eq("user_id", existingOrder.user_id);

      console.log("Subscription activated for user:", existingOrder.user_id);
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    console.error("IPN error:", err.message);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }
});
