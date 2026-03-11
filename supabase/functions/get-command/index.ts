import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const magic = url.searchParams.get("magic");
    const format = url.searchParams.get("format");

    if (!magic) {
      return new Response("MISSING_MAGIC", {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );

    const { data, error } = await supabase
      .from("ea_control")
      .select("current_command, lot_size, risk_usd, stop_loss, take_profit, max_orders, trailing_stop, breakeven, slippage, order_distance, rr_ratio")
      .eq("magic_number", parseInt(magic))
      .limit(1)
      .single();

    if (error) {
      if (format === "json") {
        return new Response(JSON.stringify({ command: "NONE" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response("NONE", {
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    if (format === "json") {
      return new Response(
        JSON.stringify({
          command: data.current_command,
          lot_size: data.lot_size,
          risk_usd: data.risk_usd,
          stop_loss: data.stop_loss,
          take_profit: data.take_profit,
          max_orders: data.max_orders,
          trailing_stop: data.trailing_stop,
          breakeven: data.breakeven,
          slippage: data.slippage,
          order_distance: data.order_distance,
          rr_ratio: data.rr_ratio,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(data.current_command, {
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  } catch (err) {
    return new Response("ERROR", {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  }
});
