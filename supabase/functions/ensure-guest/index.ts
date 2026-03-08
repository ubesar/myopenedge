import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GUEST_EMAIL = "guest@myopenedge.app";
const GUEST_PASSWORD = "GuestDemo2024!";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if guest user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const guestExists = existingUsers?.users?.some(
      (u) => u.email === GUEST_EMAIL
    );

    if (!guestExists) {
      // Create the guest user with confirmed email
      const { error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: GUEST_EMAIL,
        password: GUEST_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: "Guest User" },
      });

      if (createError) {
        throw createError;
      }
    }

    return new Response(
      JSON.stringify({ email: GUEST_EMAIL, password: GUEST_PASSWORD }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
