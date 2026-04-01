import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify user with their token
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limiting: 30 requests/hour for admin
    const { data: allowed, error: rlError } = await adminClient.rpc("check_rate_limit", {
      _user_id: user.id,
      _endpoint: "admin-users",
      _max_requests: 30,
    });

    if (rlError || allowed === false) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please try again later.", retryAfterMinutes: 60 }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action, ...params } = await req.json();

    // LIST USERS
    if (action === "list") {
      // Get all users from auth
      const { data: authUsers, error: listErr } =
        await adminClient.auth.admin.listUsers({ perPage: 500 });
      if (listErr) throw listErr;

      // Get all profiles
      const { data: profiles } = await adminClient
        .from("profiles")
        .select("user_id, email, display_name, subscription_status, subscription_end_date, created_at");

      const profileMap = new Map(
        (profiles || []).map((p) => [p.user_id, p])
      );

      const users = (authUsers?.users || []).map((u) => {
        const profile = profileMap.get(u.id);
        return {
          id: u.id,
          email: u.email,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
          display_name: profile?.display_name || "",
          subscription_status: profile?.subscription_status || "free",
          subscription_end_date: profile?.subscription_end_date || null,
        };
      });

      return new Response(JSON.stringify({ users }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE USER
    if (action === "delete_user") {
      const { user_id } = params;
      if (!user_id) throw new Error("user_id required");
      if (user_id === user.id) throw new Error("Cannot delete yourself");

      const { error: delErr } = await adminClient.auth.admin.deleteUser(user_id);
      if (delErr) throw delErr;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // UPDATE SUBSCRIPTION
    if (action === "update_subscription") {
      const { user_id, status, days } = params;
      if (!user_id || !status) throw new Error("user_id and status required");

      const updateData: Record<string, unknown> = {
        subscription_status: status,
      };

      if (status === "active" || status === "pro") {
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + (days || 30));
        updateData.subscription_end_date = endDate.toISOString();
      } else {
        updateData.subscription_end_date = null;
      }

      const { error: upErr } = await adminClient
        .from("profiles")
        .update(updateData)
        .eq("user_id", user_id);

      if (upErr) throw upErr;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Admin error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
