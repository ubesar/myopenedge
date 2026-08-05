import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "missing LOVABLE_API_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => null);
    const report = body?.report;
    if (!report || typeof report !== "object") {
      return new Response(JSON.stringify({ error: "report is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `Kamu adalah quant data engineer. Periksa laporan sinkronisasi dua file CSV OHLC untuk backtest:
- file scan (untuk mendeteksi momentum candle m15): ${body.scanFile ?? "-"} rentang ${JSON.stringify(body.scanRange ?? [])}
- file intrabar (untuk menentukan SL atau TP kena duluan): ${body.intraFile ?? "-"} rentang ${JSON.stringify(body.intraRange ?? [])}

Laporan otomatis:
${JSON.stringify(report, null, 2)}

Jawab ringkas dalam bahasa Indonesia (maksimal 6 kalimat, tanpa markdown): apakah data aman dipakai backtest, apa yang berpotensi miss atau tidak sinkron, dan langkah perbaikan konkret (mis. re-export rentang tanggal tertentu, samakan timezone/shift, atau ganti timeframe file).`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return new Response(JSON.stringify({ error: text || "ai gateway error" }), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const json = await res.json();
    const review = json?.choices?.[0]?.message?.content ?? "";
    return new Response(JSON.stringify({ review }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
