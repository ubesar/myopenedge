import { useEffect } from "react";
import ChartCard from "@/components/ChartCard";
import { supabase } from "@/integrations/supabase/client";
import type { ORBM15Result } from "@/lib/orbm15-analysis";

interface Props {
  result: ORBM15Result;
  symbol: string;
  dateRange: string;
  weekdays: string;
}

const ORBM15Dashboard = ({ result, symbol, dateRange, weekdays }: Props) => {
  const hf = result.highFirst;
  const lf = result.lowFirst;
  const bias = result.latestBias;

  // persist session bias history to the backend (ny_session_bias)
  useEffect(() => {
    const save = async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid || result.days.length === 0) return;
      const rows = result.days.slice(-200).map((d) => ({
        user_id: uid,
        symbol,
        session_date: d.date,
        orb_high_price: d.orbHigh,
        orb_low_price: d.orbLow,
        formed_first: d.formedFirst,
        first_breakout: d.firstBreakout,
      }));
      await supabase.from("ny_session_bias").upsert(rows, { onConflict: "user_id,symbol,session_date" });
    };
    save();
  }, [result, symbol]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-[12px] text-foreground/80 leading-relaxed">
        <strong className="text-foreground">ny open orb m15</strong> — opening range 09:30 – 09:45 ny (m5 candles 09:30 / 09:35 / 09:40).
        detect which extreme printed first inside the range, then measure which side price breaks first afterwards.
        the edge fades the extreme formed first (market entry @ 09:45 open, sl at the opposite orb extreme, rr 1:1).
      </div>

      {/* Bias conclusion */}
      {bias && (
        <div className="rounded-xl border border-border bg-card px-4 py-3 flex flex-wrap items-center gap-3">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">daily bias · {bias.date}</span>
          <span className="text-[12px] text-foreground">
            orb {bias.formedFirst} formed first →
          </span>
          <span className={`rounded-full px-3 py-1 text-[12px] font-semibold ${
            bias.expected === "high" ? "bg-emerald-500/15 text-emerald-500" : "bg-rose-500/15 text-rose-500"
          }`}>
            {bias.expected === "high" ? "bullish bias · break orb high" : "bearish bias · break orb low"}
          </span>
          <span className="text-[12px] text-muted-foreground">{bias.probability.toFixed(1)}% historical probability</span>
        </div>
      )}

      {/* Two main stat cards */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartCard
          title="orb high formed first"
          subtitle={`${symbol} · which side breaks first afterwards`}
          totalDays={hf.total}
          bars={[
            { name: "break orb high", value: hf.breakHighPct, color: "primary" },
            { name: "break orb low", value: hf.breakLowPct, color: "muted" },
          ]}
          legendItems={[
            { label: "break orb high (continuation)", color: "" },
            { label: "break orb low (reversal)", color: "" },
          ]}
          settingsGrid={[
            { label: "opening range", value: "09:30 – 09:45 ny" },
            { label: "candles scanned", value: "09:30 / 09:35 / 09:40" },
            { label: "no break", value: `${hf.noBreak} days` },
            { label: "date range", value: dateRange },
            { label: "weekdays", value: weekdays },
          ]}
        />
        <ChartCard
          title="orb low formed first"
          subtitle={`${symbol} · which side breaks first afterwards`}
          totalDays={lf.total}
          bars={[
            { name: "break orb high", value: lf.breakHighPct, color: "primary" },
            { name: "break orb low", value: lf.breakLowPct, color: "muted" },
          ]}
          legendItems={[
            { label: "break orb high (reversal)", color: "" },
            { label: "break orb low (continuation)", color: "" },
          ]}
          settingsGrid={[
            { label: "opening range", value: "09:30 – 09:45 ny" },
            { label: "candles scanned", value: "09:30 / 09:35 / 09:40" },
            { label: "no break", value: `${lf.noBreak} days` },
            { label: "date range", value: dateRange },
            { label: "weekdays", value: weekdays },
          ]}
        />
      </div>

      {/* Trade stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">sessions</p>
          <p className="text-[18px] font-semibold text-foreground">{result.totalDays}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">win rate (rr 1:1)</p>
          <p className="text-[18px] font-semibold text-foreground">{result.winRate.toFixed(1)}%</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">wins</p>
          <p className="text-[18px] font-semibold text-emerald-500">{result.wins}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">losses</p>
          <p className="text-[18px] font-semibold text-rose-500">{result.losses}</p>
        </div>
      </div>

      {/* Session history */}
      {result.days.length > 0 && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border">
            <h4 className="text-[13px] font-semibold lowercase">session bias history</h4>
            <p className="text-[10px] text-muted-foreground">{result.days.length} sessions</p>
          </div>
          <div className="max-h-[340px] overflow-y-auto">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 bg-card">
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left px-3 py-2 font-medium">date</th>
                  <th className="text-right px-3 py-2 font-medium">orb high</th>
                  <th className="text-right px-3 py-2 font-medium">orb low</th>
                  <th className="text-center px-3 py-2 font-medium">formed first</th>
                  <th className="text-center px-3 py-2 font-medium">first breakout</th>
                  <th className="text-center px-3 py-2 font-medium">time</th>
                </tr>
              </thead>
              <tbody>
                {[...result.days].reverse().map((d) => (
                  <tr key={d.date} className="border-b border-border/50">
                    <td className="px-3 py-1.5">{d.date}</td>
                    <td className="px-3 py-1.5 text-right">{d.orbHigh.toFixed(2)}</td>
                    <td className="px-3 py-1.5 text-right">{d.orbLow.toFixed(2)}</td>
                    <td className="px-3 py-1.5 text-center">{d.formedFirst}</td>
                    <td className={`px-3 py-1.5 text-center font-medium ${
                      d.firstBreakout === "high" ? "text-emerald-500" : d.firstBreakout === "low" ? "text-rose-500" : "text-muted-foreground"
                    }`}>{d.firstBreakout}</td>
                    <td className="px-3 py-1.5 text-center text-muted-foreground">{d.breakoutTime ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ORBM15Dashboard;
