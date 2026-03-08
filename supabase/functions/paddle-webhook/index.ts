import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verify } from "https://deno.land/x/hmac@v2.0.1/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, paddle-signature",
};

function parseSignature(header: string) {
  const parts: Record<string, string> = {};
  for (const part of header.split(";")) {
    const [key, val] = part.split("=");
    if (key && val) parts[key.trim()] = val.trim();
  }
  return parts;
}

async function verifyPaddleSignature(
  rawBody: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const { ts, h1 } = parseSignature(signature);
  if (!ts || !h1) return false;

  const payload = `${ts}:${rawBody}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const computed = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return computed === h1;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();
    const signature = req.headers.get("paddle-signature") || "";
    const webhookSecret = Deno.env.get("PADDLE_WEBHOOK_SECRET")!;

    const valid = await verifyPaddleSignature(rawBody, signature, webhookSecret);
    if (!valid) {
      console.error("Invalid Paddle signature");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const event = JSON.parse(rawBody);
    const eventType = event.event_type;
    console.log("Paddle event:", eventType);

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Extract user_id from custom_data
    const customData =
      event.data?.custom_data ||
      event.data?.subscription?.custom_data ||
      {};
    const userId = customData.user_id;

    if (!userId) {
      console.error("No user_id in custom_data", JSON.stringify(event.data));
      return new Response(JSON.stringify({ error: "Missing user_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (
      eventType === "subscription.created" ||
      eventType === "subscription.updated"
    ) {
      const status = event.data.status; // active, paused, canceled, past_due
      const nextBilledAt = event.data.next_billed_at;
      const paddleSubId = event.data.id;

      let subStatus = "free";
      if (status === "active" || status === "trialing") {
        subStatus = "active";
      } else if (status === "past_due") {
        subStatus = "active"; // grace period
      } else if (status === "paused" || status === "canceled") {
        subStatus = "expired";
      }

      const { error } = await adminClient
        .from("profiles")
        .update({
          subscription_status: subStatus,
          subscription_end_date: nextBilledAt || null,
        })
        .eq("user_id", userId);

      if (error) {
        console.error("Update profile error:", error.message);
        throw error;
      }

      console.log(`Updated user ${userId} to ${subStatus}`);
    }

    if (eventType === "subscription.canceled") {
      const effectiveFrom = event.data.scheduled_change?.effective_at;

      const { error } = await adminClient
        .from("profiles")
        .update({
          subscription_status: "expired",
          subscription_end_date: effectiveFrom || new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (error) {
        console.error("Cancel profile error:", error.message);
        throw error;
      }

      console.log(`Canceled subscription for user ${userId}`);
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
