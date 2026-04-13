import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface DailyRecord {
  date: string;
  day_of_week: string;
  prev_close: number;
  ny_open: number;
  m15_close: number;
  gap_type: string;
  gap_pct: number;
  gap_filled: boolean;
  ib_high: number;
  ib_low: number;
  ib_high_first: boolean;
  ib_breakout: string;
  momentum: string;
  occ_bias: string;
  m15_direction: string;
  session_high: number;
  session_low: number;
}

function computeMetrics(
  filtered: DailyRecord[],
  total: DailyRecord[]
): Record<string, unknown> {
  if (filtered.length === 0) {
    return {
      total_trades: 0,
      win_rate: 0,
      profit_factor: 0,
      expectancy_usd: 0,
      avg_win_usd: 0,
      avg_loss_usd: 0,
      max_consecutive_wins: 0,
      max_consecutive_losses: 0,
      sample_size: total.length,
    };
  }

  // determine wins/losses based on m15 direction alignment with gap
  // a "win" = m15 direction follows the predicted edge
  // for simplicity: bullish m15 after gap down = win (gap fill), bearish m15 after gap up = win (gap fill)
  // but this depends on the strategy. let's use generic pnl based on m15 move
  let wins = 0;
  let losses = 0;
  let totalWinPnl = 0;
  let totalLossPnl = 0;
  let consecutiveWins = 0;
  let consecutiveLosses = 0;
  let maxConsecutiveWins = 0;
  let maxConsecutiveLosses = 0;

  for (const day of filtered) {
    const m15Move = day.m15_close - day.ny_open;
    const pnl = Math.abs(m15Move);

    // determine if this is a "win" based on the direction
    // if m15 moved in the "expected" direction (bullish = positive move)
    const isBullishM15 = day.m15_close > day.ny_open;
    // use the m15 direction as the outcome
    if (pnl > 0) {
      // count as win if move was meaningful
      if (isBullishM15 && day.m15_direction === "bullish") {
        wins++;
        totalWinPnl += pnl;
        consecutiveWins++;
        consecutiveLosses = 0;
        maxConsecutiveWins = Math.max(maxConsecutiveWins, consecutiveWins);
      } else if (!isBullishM15 && day.m15_direction === "bearish") {
        wins++;
        totalWinPnl += pnl;
        consecutiveWins++;
        consecutiveLosses = 0;
        maxConsecutiveWins = Math.max(maxConsecutiveWins, consecutiveWins);
      } else {
        losses++;
        totalLossPnl += pnl;
        consecutiveLosses++;
        consecutiveWins = 0;
        maxConsecutiveLosses = Math.max(maxConsecutiveLosses, consecutiveLosses);
      }
    }
  }

  const totalTrades = wins + losses;
  const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
  const avgWin = wins > 0 ? totalWinPnl / wins : 0;
  const avgLoss = losses > 0 ? totalLossPnl / losses : 0;
  const profitFactor = totalLossPnl > 0 ? totalWinPnl / totalLossPnl : totalWinPnl > 0 ? Infinity : 0;
  const expectancy = totalTrades > 0
    ? (winRate / 100) * avgWin - ((100 - winRate) / 100) * avgLoss
    : 0;

  return {
    total_trades: totalTrades,
    filtered_days: filtered.length,
    wins,
    losses,
    win_rate: Math.round(winRate * 100) / 100,
    profit_factor: profitFactor === Infinity ? "∞" : Math.round(profitFactor * 100) / 100,
    expectancy_usd: Math.round(expectancy * 100) / 100,
    avg_win_usd: Math.round(avgWin * 100) / 100,
    avg_loss_usd: Math.round(avgLoss * 100) / 100,
    total_pnl_usd: Math.round((totalWinPnl - totalLossPnl) * 100) / 100,
    max_consecutive_wins: maxConsecutiveWins,
    max_consecutive_losses: maxConsecutiveLosses,
    sample_size: total.length,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, dailyData, symbol, conversationHistory } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    if (!query || !dailyData || !Array.isArray(dailyData)) {
      return new Response(
        JSON.stringify({ error: "missing required fields: query, dailyData" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `you are the custom ai analysis engine for myopenedge, a quantitative trading analytics platform. your job is to interpret natural language trading queries and extract structured filter parameters from the user's request.

you have access to daily trading data with these fields per day:
- date, day_of_week (mon/tue/wed/thu/fri)
- prev_close, ny_open, m15_close (prices)
- gap_type ("up" or "down"), gap_pct (percentage), gap_filled (boolean)
- ib_high, ib_low, ib_high_first (boolean), ib_breakout ("high"/"low"/"inside")
- momentum ("bullish"/"bearish"/"choppy")
- occ_bias ("bullish"/"bearish"/"failed")
- m15_direction ("bullish"/"bearish")
- session_high, session_low

your task: analyze the user's natural language query and call the analyze_trading_data function with the appropriate filters. always respond in the same language as the user.

filter rules:
- gap_type: filter by "up" or "down"
- gap_pct_min/gap_pct_max: filter by gap percentage range
- gap_filled: filter by whether gap was filled
- ib_breakout: filter by ib breakout direction
- ib_high_first: filter by which ib extreme formed first
- momentum: filter by momentum bias
- occ_bias: filter by occ confirmation
- m15_direction: filter by first m15 candle direction
- day_of_week: filter by specific days (array)
- win_condition: what counts as a "win" for this strategy. options: "m15_bullish", "m15_bearish", "gap_filled", "gap_not_filled", "ib_break_high", "ib_break_low", "follow_gap" (m15 follows gap direction), "fade_gap" (m15 fades gap direction)

if the user's query is ambiguous or missing critical info, set needs_clarification to true and provide follow_up_options with dropdown choices.

important: all text output must be lowercase. be concise, data-driven, casual but professional.`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...(conversationHistory || []),
      { role: "user", content: `symbol: ${symbol}\ntotal data points: ${dailyData.length} trading days\n\nuser query: ${query}` },
    ];

    const tools = [
      {
        type: "function",
        function: {
          name: "analyze_trading_data",
          description: "filter and analyze trading data based on extracted criteria, then provide insights",
          parameters: {
            type: "object",
            properties: {
              filters: {
                type: "object",
                properties: {
                  gap_type: { type: "string", enum: ["up", "down"] },
                  gap_pct_min: { type: "number" },
                  gap_pct_max: { type: "number" },
                  gap_filled: { type: "boolean" },
                  ib_breakout: { type: "string", enum: ["high", "low", "inside"] },
                  ib_high_first: { type: "boolean" },
                  momentum: { type: "string", enum: ["bullish", "bearish", "choppy"] },
                  occ_bias: { type: "string", enum: ["bullish", "bearish", "failed"] },
                  m15_direction: { type: "string", enum: ["bullish", "bearish"] },
                  day_of_week: { type: "array", items: { type: "string", enum: ["mon", "tue", "wed", "thu", "fri"] } },
                  win_condition: { type: "string", enum: ["m15_bullish", "m15_bearish", "gap_filled", "gap_not_filled", "ib_break_high", "ib_break_low", "follow_gap", "fade_gap"] },
                },
                additionalProperties: false,
              },
              analysis_title: { type: "string", description: "short lowercase title for this analysis" },
              needs_clarification: { type: "boolean" },
              follow_up_options: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    field: { type: "string" },
                    label: { type: "string" },
                    options: { type: "array", items: { type: "string" } },
                  },
                  required: ["field", "label", "options"],
                },
              },
              insight: { type: "string", description: "brief data-driven insight in lowercase, 2-3 sentences" },
            },
            required: ["filters", "analysis_title", "needs_clarification", "insight"],
            additionalProperties: false,
          },
        },
      },
    ];

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages,
          tools,
          tool_choice: { type: "function", function: { name: "analyze_trading_data" } },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "rate limit exceeded. please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "ai credits exhausted. please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const text = await response.text();
      console.error("ai gateway error:", response.status, text);
      return new Response(
        JSON.stringify({ error: "ai service unavailable" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      return new Response(
        JSON.stringify({ error: "ai could not process your query" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    const { filters, analysis_title, needs_clarification, follow_up_options, insight } = parsed;

    // apply filters to daily data
    let filtered = [...dailyData] as DailyRecord[];

    if (filters.gap_type) {
      filtered = filtered.filter((d) => d.gap_type === filters.gap_type);
    }
    if (filters.gap_pct_min !== undefined) {
      filtered = filtered.filter((d) => Math.abs(d.gap_pct) >= filters.gap_pct_min);
    }
    if (filters.gap_pct_max !== undefined) {
      filtered = filtered.filter((d) => Math.abs(d.gap_pct) <= filters.gap_pct_max);
    }
    if (filters.gap_filled !== undefined) {
      filtered = filtered.filter((d) => d.gap_filled === filters.gap_filled);
    }
    if (filters.ib_breakout) {
      filtered = filtered.filter((d) => d.ib_breakout === filters.ib_breakout);
    }
    if (filters.ib_high_first !== undefined) {
      filtered = filtered.filter((d) => d.ib_high_first === filters.ib_high_first);
    }
    if (filters.momentum) {
      filtered = filtered.filter((d) => d.momentum === filters.momentum);
    }
    if (filters.occ_bias) {
      filtered = filtered.filter((d) => d.occ_bias === filters.occ_bias);
    }
    if (filters.m15_direction) {
      filtered = filtered.filter((d) => d.m15_direction === filters.m15_direction);
    }
    if (filters.day_of_week && filters.day_of_week.length > 0) {
      filtered = filtered.filter((d) => filters.day_of_week.includes(d.day_of_week));
    }

    // compute win/loss based on win_condition
    const winCondition = filters.win_condition || "follow_gap";
    const enriched = filtered.map((d) => {
      let isWin = false;
      switch (winCondition) {
        case "m15_bullish": isWin = d.m15_direction === "bullish"; break;
        case "m15_bearish": isWin = d.m15_direction === "bearish"; break;
        case "gap_filled": isWin = d.gap_filled; break;
        case "gap_not_filled": isWin = !d.gap_filled; break;
        case "ib_break_high": isWin = d.ib_breakout === "high"; break;
        case "ib_break_low": isWin = d.ib_breakout === "low"; break;
        case "follow_gap":
          isWin = (d.gap_type === "up" && d.m15_direction === "bullish") ||
                  (d.gap_type === "down" && d.m15_direction === "bearish");
          break;
        case "fade_gap":
          isWin = (d.gap_type === "up" && d.m15_direction === "bearish") ||
                  (d.gap_type === "down" && d.m15_direction === "bullish");
          break;
      }
      const pnl = Math.abs(d.m15_close - d.ny_open);
      return { ...d, is_win: isWin, pnl };
    });

    // compute metrics
    const wins = enriched.filter((d) => d.is_win);
    const lossEntries = enriched.filter((d) => !d.is_win);
    const totalWinPnl = wins.reduce((s, d) => s + d.pnl, 0);
    const totalLossPnl = lossEntries.reduce((s, d) => s + d.pnl, 0);
    const winRate = enriched.length > 0 ? (wins.length / enriched.length) * 100 : 0;
    const avgWin = wins.length > 0 ? totalWinPnl / wins.length : 0;
    const avgLoss = lossEntries.length > 0 ? totalLossPnl / lossEntries.length : 0;
    const profitFactor = totalLossPnl > 0 ? totalWinPnl / totalLossPnl : (totalWinPnl > 0 ? 999.99 : 0);
    const expectancy = enriched.length > 0
      ? (winRate / 100) * avgWin - ((100 - winRate) / 100) * avgLoss
      : 0;

    // consecutive streaks
    let maxConWins = 0, maxConLosses = 0, curWins = 0, curLosses = 0;
    for (const d of enriched) {
      if (d.is_win) { curWins++; curLosses = 0; maxConWins = Math.max(maxConWins, curWins); }
      else { curLosses++; curWins = 0; maxConLosses = Math.max(maxConLosses, curLosses); }
    }

    const metrics = {
      total_trades: enriched.length,
      wins: wins.length,
      losses: lossEntries.length,
      win_rate: Math.round(winRate * 100) / 100,
      profit_factor: Math.round(profitFactor * 100) / 100,
      expectancy_usd: Math.round(expectancy * 100) / 100,
      avg_win_usd: Math.round(avgWin * 100) / 100,
      avg_loss_usd: Math.round(avgLoss * 100) / 100,
      total_pnl_usd: Math.round((totalWinPnl - totalLossPnl) * 100) / 100,
      max_consecutive_wins: maxConWins,
      max_consecutive_losses: maxConLosses,
      sample_size: dailyData.length,
      win_condition: winCondition,
    };

    // day distribution
    const dayDist: Record<string, { total: number; wins: number }> = {};
    for (const d of enriched) {
      if (!dayDist[d.day_of_week]) dayDist[d.day_of_week] = { total: 0, wins: 0 };
      dayDist[d.day_of_week].total++;
      if (d.is_win) dayDist[d.day_of_week].wins++;
    }

    return new Response(
      JSON.stringify({
        analysis_title,
        filters,
        metrics,
        day_distribution: dayDist,
        insight,
        needs_clarification,
        follow_up_options: follow_up_options || [],
        filtered_dates: enriched.slice(-20).map((d) => ({
          date: d.date,
          gap_type: d.gap_type,
          gap_pct: d.gap_pct,
          m15_direction: d.m15_direction,
          is_win: d.is_win,
          pnl: d.pnl,
        })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("custom-ai-analysis error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
