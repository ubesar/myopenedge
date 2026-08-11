import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TELEGRAM_GATEWAY = "https://connector-gateway.lovable.dev/telegram";
const BODY_RATIO = 0.60;
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

    // Globex opens Sun 6PM ET, closes Fri 4PM ET
    // Mon-Fri: active from 00:00 to 16:00 (NY session close)
    // Sun: active from 18:00 onwards (Globex open)
    // Sat: skip entirely
    const nowET = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
    const etDate = new Date(nowET);
    const dayOfWeek = etDate.getDay(); // 0=Sun, 6=Sat
    const hours = etDate.getHours();
    const minutes = etDate.getMinutes();
    const timeMinutes = hours * 60 + minutes;

    if (dayOfWeek === 6) {
      return new Response(JSON.stringify({ status: "saturday", skipped: true }));
    }
    // Sunday: only active after 18:00 (Globex open)
    if (dayOfWeek === 0 && timeMinutes < 18 * 60) {
      return new Response(JSON.stringify({ status: "sunday_before_globex", skipped: true }));
    }
    // Mon-Fri: skip after 16:00 (NY close) until 18:00 (next Globex open)
    if (dayOfWeek >= 1 && dayOfWeek <= 5 && timeMinutes >= 16 * 60 && timeMinutes < 18 * 60) {
      return new Response(JSON.stringify({ status: "between_sessions", skipped: true }));
    }

    // Fetch 15m bars — need today + yesterday to cover overnight Globex
    const today = etDate.toISOString().split("T")[0];
    const yesterday = new Date(etDate);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    const url = `https://api.polygon.io/v2/aggs/ticker/${SYMBOL}/range/15/minute/${yesterdayStr}/${today}?adjusted=true&sort=asc&limit=50000&apiKey=${MASSIVE_API_KEY}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      throw new Error(`Polygon API error: ${resp.status} ${JSON.stringify(errData)}`);
    }
    const data = await resp.json();
    const results = data.results || [];

    if (results.length < 1) {
      return new Response(JSON.stringify({ status: "not_enough_bars", count: results.length }));
    }

    // Convert to candles with ET time — include ALL bars (Globex + RTH)
    const candles = results.map((bar: any) => {
      const dt = new Date(bar.t);
      const etStr = dt.toLocaleString("en-US", { timeZone: "America/New_York", hour12: false });
      const [datePart, timePart] = etStr.split(", ");
      return {
        time: timePart,
        date: datePart,
        open: bar.o,
        high: bar.h,
        low: bar.l,
        close: bar.c,
        datetime: etStr,
      };
    });

    if (candles.length < 1) {
      return new Response(JSON.stringify({ status: "no_bars", count: candles.length }));
    }

    // Check the last candle for MC pattern (single candle, body ratio ≥60%)
    const lastCandle = candles[candles.length - 1];

    const body = Math.abs(lastCandle.close - lastCandle.open);
    const range = lastCandle.high - lastCandle.low;

    const isMC = range > 0 && body / range >= BODY_RATIO;

    if (!isMC) {
      return new Response(JSON.stringify({ status: "no_mc", lastBar: lastCandle.time }));
    }

    const signalType = lastCandle.close >= lastCandle.open ? "bullish" : "bearish";
    const alertKey = `${today}_${lastCandle.time}_${signalType}`;

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
    const bodyRatioPct = (body / range * 100).toFixed(0);
    const message = [
      `${emoji} <b>MC Alert — ${SYMBOL} 15m</b>`,
      ``,
      `<b>Signal:</b> ${direction} Momentum Candle`,
      `<b>Time:</b> ${lastCandle.time} ET`,
      `<b>OHLC:</b> O:${lastCandle.open.toFixed(2)} H:${lastCandle.high.toFixed(2)} L:${lastCandle.low.toFixed(2)} C:${lastCandle.close.toFixed(2)}`,
      `<b>Body Ratio:</b> ${bodyRatioPct}%`,
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
      time: lastCandle.time,
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
