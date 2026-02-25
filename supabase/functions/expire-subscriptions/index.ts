import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  // Authenticate via CRON_SECRET
  const cronSecret = Deno.env.get("CRON_SECRET");
  const authHeader = req.headers.get("Authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await adminClient
      .from("profiles")
      .update({ subscription_status: "expired" })
      .eq("subscription_status", "active")
      .lt("subscription_end_date", new Date().toISOString())
      .select("user_id, email");

    if (error) {
      console.error("Expire error:", error.message);
      throw error;
    }

    console.log(`Expired ${data?.length || 0} subscriptions`, data);

    return new Response(
      JSON.stringify({ expired: data?.length || 0 }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Cron error:", err.message);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
