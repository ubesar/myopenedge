const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BASE = "https://fapi.binance.com";

async function getJson(url: string): Promise<any> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url);
    if (res.ok) return await res.json();
    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      continue;
    }
    const txt = await res.text().catch(() => "");
    throw new Error(`binance ${res.status}: ${txt.slice(0, 200)}`);
  }
  throw new Error("binance request failed after retries");
}

function dayString(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

async function fetchKlines(symbol: string, startTime: number) {
  const out: any[] = [];
  let cursor = startTime;
  for (let i = 0; i < 6; i++) {
    const url = `${BASE}/fapi/v1/klines?symbol=${symbol}&interval=1d&limit=1500&startTime=${cursor}`;
    const rows: any[] = await getJson(url);
    if (!rows.length) break;
    for (const r of rows) {
      out.push({
        date: dayString(r[0]),
        open: Number(r[1]),
        high: Number(r[2]),
        low: Number(r[3]),
        close: Number(r[4]),
        volume: Number(r[5]),
      });
    }
    if (rows.length < 1500) break;
    cursor = Number(rows[rows.length - 1][0]) + 86_400_000;
  }
  const seen = new Set<string>();
  return out.filter((b) => (seen.has(b.date) ? false : (seen.add(b.date), true)));
}

async function fetchFunding(symbol: string, startTime: number) {
  const out: { time: number; rate: number }[] = [];
  let cursor = startTime;
  for (let i = 0; i < 8; i++) {
    const url = `${BASE}/fapi/v1/fundingRate?symbol=${symbol}&limit=1000&startTime=${cursor}`;
    const rows: any[] = await getJson(url);
    if (!rows.length) break;
    for (const r of rows) out.push({ time: Number(r.fundingTime), rate: Number(r.fundingRate) });
    if (rows.length < 1000) break;
    cursor = Number(rows[rows.length - 1].fundingTime) + 1;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { symbols, start, funding = true } = await req.json();
    if (!Array.isArray(symbols) || symbols.length === 0) {
      return new Response(JSON.stringify({ error: "symbols[] required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (symbols.length > 25) {
      return new Response(JSON.stringify({ error: "max 25 symbols per request" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const startTime = start ? Date.parse(`${start}T00:00:00Z`) : Date.now() - 1500 * 86_400_000;

    const result: Record<string, any> = {};
    for (const raw of symbols) {
      const symbol = String(raw).toUpperCase();
      try {
        const bars = await fetchKlines(symbol, startTime);
        const rates = funding ? await fetchFunding(symbol, startTime) : [];
        result[symbol] = { bars, funding: rates };
      } catch (e: any) {
        result[symbol] = { bars: [], funding: [], error: e?.message || "fetch failed" };
      }
    }

    return new Response(JSON.stringify({ data: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || "internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
