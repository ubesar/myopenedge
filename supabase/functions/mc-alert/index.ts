import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TELEGRAM_GATEWAY = "https://connector-gateway.lovable.dev/telegram";
const BODY_RATIO = 0.50;
const SECOND_BODY_RATIO = 0.30;
const SYMBOL = "QQQ";

serve(async () => {
  try {
    const MASSIVE_API_KEY = Deno.env.get("MASSIVE_API_KEY");
    if (!MASSIVE_API_KEY) throw new Error("MASSIVE_API_KEY not configured");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY");
    if (!TELEGRAM_API_KEY) throw new Error("TELEGRAM_API_KEY not configured");

    const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");
    if (!TELEGRAM_CHAT_ID) throw new Error("TELEGRAM_CHAT_ID not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if market is open (Mon-Fri, 09:30-16:00 ET)
    const nowET = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
    const etDate = new Date(nowET);
    const dayOfWeek = etDate.getDay();
    const hours = etDate.getHours();
    const minutes = etDate.getMinutes();
    const timeMinutes = hours * 60 + minutes;

    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return new Response(JSON.stringify({ status: "weekend", skipped: true }));
    }
    if (timeMinutes < 9 * 60 + 30 || timeMinutes >= 16 * 60) {
      return new Response(JSON.stringify({ status: "market_closed", skipped: true }));
    }

    // Fetch today's 15m bars from Polygon via massive-bars pattern
    const today = etDate.toISOString().split("T")[0];
    // Use today as from/to for intraday
    const url = `https://api.polygon.io/v2/aggs/ticker/${SYMBOL}/range/15/minute/${today}/${today}?adjusted=true&sort=asc&limit=50000&apiKey=${MASSIVE_API_KEY}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      throw new Error(`Polygon API error: ${resp.status} ${JSON.stringify(errData)}`);
    }
    const data = await resp.json();
    const results = data.results || [];

    if (results.length < 2) {
      return new Response(JSON.stringify({ status: "not_enough_bars", count: results.length }));
    }

    // Convert to candles with ET time
    const candles = results.map((bar: any) => {
      const dt = new Date(bar.t);
      const etStr = dt.toLocaleString("en-US", { timeZone: "America/New_York", hour12: false });
      const [datePart, timePart] = etStr.split(", ");
      return {
        time: timePart,
        open: bar.o,
        high: bar.h,
        low: bar.l,
        close: bar.c,
        datetime: etStr,
      };
    }).filter((c: any) => {
      // Only RTH bars (09:30-16:00)
      return c.time >= "09:30:00" && c.time < "16:00:00";
    });

    if (candles.length < 2) {
      return new Response(JSON.stringify({ status: "not_enough_rth_bars", count: candles.length }));
    }

    // Check the last 2 candles for MC pattern
    const prev = candles[candles.length - 2];
    const curr = candles[candles.length - 1];

    const pBody = Math.abs(prev.close - prev.open);
    const pRange = prev.high - prev.low;
    const cBody = Math.abs(curr.close - curr.open);
    const cRange = curr.high - curr.low;

    const pBull = prev.close >= prev.open;
    const cBull = curr.close >= curr.open;

    const isMC =
      pRange > 0 && cRange > 0 &&
      pBody / pRange >= BODY_RATIO &&
      cBody / cRange >= SECOND_BODY_RATIO &&
      pBull === cBull;

    if (!isMC) {
      return new Response(JSON.stringify({ status: "no_mc", lastBars: [prev.time, curr.time] }));
    }

    const signalType = pBull ? "bullish" : "bearish";
    const alertKey = `${today}_${prev.time}_${curr.time}_${signalType}`;

    // Check if we already sent this alert
    const { data: state } = await supabase
      .from("mc_alert_state")
      .select("last_alert_time")
      .eq("id", 1)
      .single();

    if (state?.last_alert_time === alertKey) {
      return new Response(JSON.stringify({ status: "already_alerted", key: alertKey }));
    }

    // Send Telegram alert
    const emoji = signalType === "bullish" ? "🟢" : "🔴";
    const direction = signalType === "bullish" ? "BULLISH" : "BEARISH";
    const message = [
      `${emoji} <b>MC Alert — ${SYMBOL} 15m</b>`,
      ``,
      `<b>Signal:</b> ${direction} Momentum Candle`,
      `<b>Time:</b> ${prev.time} → ${curr.time} ET`,
      `<b>Candle 1:</b> O:${prev.open.toFixed(2)} H:${prev.high.toFixed(2)} L:${prev.low.toFixed(2)} C:${prev.close.toFixed(2)}`,
      `<b>Candle 2:</b> O:${curr.open.toFixed(2)} H:${curr.high.toFixed(2)} L:${curr.low.toFixed(2)} C:${curr.close.toFixed(2)}`,
      `<b>Body Ratio:</b> ${(pBody / pRange * 100).toFixed(0)}% / ${(cBody / cRange * 100).toFixed(0)}%`,
      ``,
      `📊 <i>MyOpenEdge — Momentum Candle Monitor</i>`,
    ].join("\n");

    const tgResp = await fetch(`${TELEGRAM_GATEWAY}/sendMessage`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TELEGRAM_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "HTML",
      }),
    });

    const tgData = await tgResp.json();
    if (!tgResp.ok) {
      throw new Error(`Telegram API failed [${tgResp.status}]: ${JSON.stringify(tgData)}`);
    }

    // Update state to prevent duplicate
    await supabase
      .from("mc_alert_state")
      .update({ last_alert_time: alertKey, last_signal_type: signalType, updated_at: new Date().toISOString() })
      .eq("id", 1);

    return new Response(JSON.stringify({
      status: "alert_sent",
      signal: signalType,
      times: [prev.time, curr.time],
      key: alertKey,
    }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("mc-alert error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
