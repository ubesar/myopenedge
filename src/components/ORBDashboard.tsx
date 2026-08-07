import { useState } from "react";
import ContinuationStackCard from "@/components/ContinuationStackCard";
import ORBDayChart from "@/components/ORBDayChart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ORB_TARGETS, type ORBResult } from "@/lib/orb-analysis";

interface Props {
  result: ORBResult;
  symbol: string;
  dateRange: string;
  weekdays: string;
  targetR: number;
  onTargetChange: (t: number) => void;
}

const pct = (v: number, d = 1) => `${v.toFixed(d)}%`;

const ORBDashboard = ({ result, symbol, dateRange, weekdays, targetR, onTargetChange }: Props) => {
  const chartDays = result.days.filter((d) => d.bars.length > 0);
  const availableDates = chartDays.map((d) => d.date);
  const [selectedDate, setSelectedDate] = useState<string>(availableDates[availableDates.length - 1] || "");
  const activeDay = chartDays.find((d) => d.date === selectedDate) || chartDays[chartDays.length - 1];

  const targetCols = result.targetStats.map((t) => {
    const resolved = t.wins + t.losses;
    return {
      label: `${t.targetR}R`,
      bottomPct: resolved > 0 ? (t.wins / resolved) * 100 : 0,
      topPct: resolved > 0 ? (t.losses / resolved) * 100 : 0,
      bottomLabel: "win", topLabel: "loss", total: resolved,
    };
  });

  const active = result.targetStats.find((t) => t.targetR === targetR) || result.targetStats[1];
  const longRes = active.longWins + active.longLosses;
  const shortRes = active.shortWins + active.shortLosses;
  const sideCols = [
    {
      label: "long", bottomLabel: "win", topLabel: "loss", total: longRes,
      bottomPct: longRes > 0 ? (active.longWins / longRes) * 100 : 0,
      topPct: longRes > 0 ? (active.longLosses / longRes) * 100 : 0,
    },
    {
      label: "short", bottomLabel: "win", topLabel: "loss", total: shortRes,
      bottomPct: shortRes > 0 ? (active.shortWins / shortRes) * 100 : 0,
      topPct: shortRes > 0 ? (active.shortLosses / shortRes) * 100 : 0,
    },
  ];

  const orEndMin = 570 + result.orMinutes;
  const settings = [
    { label: "opening range", value: `09:30 – ${String(Math.floor(orEndMin / 60)).padStart(2, "0")}:${String(orEndMin % 60).padStart(2, "0")} ET (${result.orMinutes}m)` },
    { label: "entry", value: "first trade beyond OR high / OR low" },
    { label: "stop loss", value: "opposite OR extreme (1R = 1 × OR size)" },
    { label: "session end", value: "16:00 ET (exit at close if unresolved)" },
    { label: "date range", value: dateRange },
    { label: "weekdays", value: weekdays },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-[12px] text-foreground/80 leading-relaxed">
        <strong className="text-foreground">opening range breakout (orb)</strong> — opening range dibentuk dari {result.orMinutes} menit pertama sesi RTH. entry pada breakout pertama keluar dari range, SL di sisi berlawanan sehingga <span className="font-medium">1R = 1 × ukuran OR</span>. subreport di bawah menguji beberapa profit target sekaligus, menganalisa kuintil ukuran OR, dan menghitung anatomi retest (rate, waktu, MFE sebelum retest, continuation vs failure).
        <span className="block mt-1 text-[11px] text-muted-foreground">catatan metodologi: perhitungan memakai bar M5 (granularitas data yang tersedia), bukan M1 — urutan sentuhan intrabar diasumsikan konservatif (SL didahulukan bila TP &amp; SL kena di bar yang sama).</span>
      </div>

      {/* Headline */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {[
          { l: "days", v: String(result.totalDays) },
          { l: "breakout rate", v: pct(result.breakoutRate) },
          { l: "long / short", v: `${result.longBreakouts} / ${result.shortBreakouts}` },
          { l: "avg OR size", v: pct(result.avgOrSizePct, 2) },
          { l: "avg mins to breakout", v: `${result.avgBreakoutMinute.toFixed(0)}m` },
          { l: "retest rate", v: pct(result.retestRate) },
        ].map((s) => (
          <div key={s.l} className="rounded-xl border border-border bg-card p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.l}</p>
            <p className="text-[16px] font-semibold text-foreground font-mono mt-1">{s.v}</p>
          </div>
        ))}
      </div>

      {/* Target selector */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-muted-foreground">active profit target</span>
        <Select value={String(targetR)} onValueChange={(v) => onTargetChange(Number(v))}>
          <SelectTrigger className="h-8 w-[120px] text-[12px] bg-input border-border"><SelectValue /></SelectTrigger>
          <SelectContent>
            {ORB_TARGETS.map((t) => <SelectItem key={t} value={String(t)} className="text-[12px]">{t}R</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ContinuationStackCard
          title="profit target subreport"
          subtitle={`${symbol} · ${result.breakoutDays} breakouts · ${dateRange}`}
          columns={targetCols}
          legend={[
            { label: "% win (target hit)", colorClass: "bg-chart-bar-a" },
            { label: "% loss (SL hit)", colorClass: "bg-chart-bar-b" },
          ]}
        />
        <ContinuationStackCard
          title={`long vs short @ ${targetR}R`}
          subtitle={`${symbol} · win/loss by side`}
          columns={sideCols}
          legend={[
            { label: "% win", colorClass: "bg-chart-bar-a" },
            { label: "% loss", colorClass: "bg-chart-bar-b" },
          ]}
        />
      </div>

      {/* Target table */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h4 className="text-[12px] font-semibold text-foreground mb-3 lowercase">profit target performance</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="text-left py-2 pr-3">target</th>
                <th className="text-right py-2 pr-3">trades</th>
                <th className="text-right py-2 pr-3">wins</th>
                <th className="text-right py-2 pr-3">losses</th>
                <th className="text-right py-2 pr-3">eod exit</th>
                <th className="text-right py-2 pr-3">win rate</th>
                <th className="text-right py-2">expectancy</th>
              </tr>
            </thead>
            <tbody>
              {result.targetStats.map((t) => (
                <tr key={t.targetR} className={`border-b border-border/40 ${t.targetR === targetR ? "bg-primary/5" : ""}`}>
                  <td className="py-1.5 pr-3 font-medium text-foreground">{t.targetR}R</td>
                  <td className="py-1.5 pr-3 text-right font-mono">{t.total}</td>
                  <td className="py-1.5 pr-3 text-right font-mono text-emerald-500">{t.wins}</td>
                  <td className="py-1.5 pr-3 text-right font-mono text-red-500">{t.losses}</td>
                  <td className="py-1.5 pr-3 text-right font-mono text-muted-foreground">{t.eod}</td>
                  <td className="py-1.5 pr-3 text-right font-mono">{pct(t.winRate)}</td>
                  <td className={`py-1.5 text-right font-mono font-semibold ${t.expectancyR >= 0 ? "text-emerald-500" : "text-red-500"}`}>{t.expectancyR.toFixed(2)}R</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quintiles */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h4 className="text-[12px] font-semibold text-foreground mb-3 lowercase">or size quintile</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="text-left py-2 pr-3">quintile</th>
                <th className="text-right py-2 pr-3">or size range</th>
                <th className="text-right py-2 pr-3">days</th>
                <th className="text-right py-2 pr-3">breakout rate</th>
                <th className="text-right py-2 pr-3">avg mfe</th>
                <th className="text-right py-2 pr-3">avg mae</th>
                <th className="text-right py-2">win rate @1R</th>
              </tr>
            </thead>
            <tbody>
              {result.quintiles.map((q) => (
                <tr key={q.label} className="border-b border-border/40">
                  <td className="py-1.5 pr-3 font-medium text-foreground">{q.label}</td>
                  <td className="py-1.5 pr-3 text-right font-mono text-muted-foreground">{q.minPct.toFixed(2)}% – {q.maxPct.toFixed(2)}%</td>
                  <td className="py-1.5 pr-3 text-right font-mono">{q.n}</td>
                  <td className="py-1.5 pr-3 text-right font-mono">{pct(q.breakoutRate)}</td>
                  <td className="py-1.5 pr-3 text-right font-mono text-emerald-500">{q.avgMfeR.toFixed(2)}R</td>
                  <td className="py-1.5 pr-3 text-right font-mono text-red-500">{q.avgMaeR.toFixed(2)}R</td>
                  <td className="py-1.5 text-right font-mono font-semibold">{pct(q.winRate1R)}</td>
                </tr>
              ))}
              {result.quintiles.length === 0 && <tr><td colSpan={7} className="py-4 text-center text-muted-foreground">not enough days</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Retest */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h4 className="text-[12px] font-semibold text-foreground mb-1 lowercase">retest analysis</h4>
        <p className="text-[11px] text-muted-foreground mb-3">
          {result.retestDays} dari {result.breakoutDays} breakout kembali menguji level ({pct(result.retestRate)}) · continuation setelah retest {pct(result.continuationRate)}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="text-left py-2 pr-3">mins to retest</th>
                <th className="text-right py-2 pr-3">n</th>
                <th className="text-right py-2 pr-3">continuation</th>
                <th className="text-right py-2 pr-3">rate</th>
                <th className="text-right py-2 pr-3">95% CI</th>
                <th className="text-right py-2">avg mfe_pre</th>
              </tr>
            </thead>
            <tbody>
              {result.retestBuckets.map((b) => (
                <tr key={b.label} className="border-b border-border/40">
                  <td className="py-1.5 pr-3 font-medium text-foreground">{b.label}</td>
                  <td className="py-1.5 pr-3 text-right font-mono">{b.n}</td>
                  <td className="py-1.5 pr-3 text-right font-mono text-emerald-500">{b.continuations}</td>
                  <td className="py-1.5 pr-3 text-right font-mono font-semibold">{b.n ? pct(b.continuationRate) : "—"}</td>
                  <td className="py-1.5 pr-3 text-right font-mono text-muted-foreground">{b.n ? `${b.ciLow.toFixed(0)}–${b.ciHigh.toFixed(0)}%` : "—"}</td>
                  <td className="py-1.5 text-right font-mono">{b.n ? `${b.avgMfePreR.toFixed(2)}R` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Day chart */}
      {activeDay && (
        <ORBDayChart
          day={activeDay}
          symbol={symbol}
          orMinutes={result.orMinutes}
          availableDates={availableDates}
          selectedDate={activeDay.date}
          onDateChange={setSelectedDate}
          targetR={targetR}
        />
      )}

      {/* Settings */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h5 className="text-[11px] text-muted-foreground mb-2 uppercase tracking-wider">custom settings</h5>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
          {settings.map((row) => (
            <div key={row.label} className="flex justify-between">
              <span className="text-muted-foreground">{row.label}:</span>
              <span className="text-primary font-medium text-right">{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* History */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h4 className="text-[13px] font-semibold text-foreground mb-3 lowercase">orb history</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="text-left py-2 pr-3">date</th>
                <th className="text-right py-2 pr-3">or high</th>
                <th className="text-right py-2 pr-3">or low</th>
                <th className="text-right py-2 pr-3">or size</th>
                <th className="text-left py-2 pr-3">direction</th>
                <th className="text-left py-2 pr-3">breakout</th>
                <th className="text-right py-2 pr-3">mfe</th>
                <th className="text-right py-2 pr-3">mae</th>
                <th className="text-left py-2 pr-3">retest</th>
                <th className="text-right py-2 pr-3">mins</th>
                <th className="text-left py-2 pr-3">after retest</th>
                <th className="text-left py-2">{targetR}R outcome</th>
              </tr>
            </thead>
            <tbody>
              {[...result.days].reverse().slice(0, 300).map((d) => {
                const o = d.targets[String(targetR)];
                return (
                  <tr key={d.date} className="border-b border-border/40">
                    <td className="py-1.5 pr-3 text-foreground">{d.date}</td>
                    <td className="py-1.5 pr-3 text-right font-mono">{d.orHigh.toFixed(2)}</td>
                    <td className="py-1.5 pr-3 text-right font-mono">{d.orLow.toFixed(2)}</td>
                    <td className="py-1.5 pr-3 text-right font-mono text-muted-foreground">{d.orSize.toFixed(2)} ({d.orSizePct.toFixed(2)}%)</td>
                    <td className={`py-1.5 pr-3 font-medium ${d.direction === "long" ? "text-emerald-500" : d.direction === "short" ? "text-red-500" : "text-muted-foreground"}`}>{d.direction}</td>
                    <td className="py-1.5 pr-3 font-mono text-muted-foreground">{d.breakoutTime || "—"}</td>
                    <td className="py-1.5 pr-3 text-right font-mono text-emerald-500">{d.direction === "none" ? "—" : `${d.mfeR.toFixed(2)}R`}</td>
                    <td className="py-1.5 pr-3 text-right font-mono text-red-500">{d.direction === "none" ? "—" : `${d.maeR.toFixed(2)}R`}</td>
                    <td className="py-1.5 pr-3 font-mono text-muted-foreground">{d.retest ? d.retest.time : d.direction === "none" ? "—" : "no"}</td>
                    <td className="py-1.5 pr-3 text-right font-mono text-muted-foreground">{d.retest ? d.retest.minutes : "—"}</td>
                    <td className={`py-1.5 pr-3 ${d.retest ? (d.retest.continuation ? "text-emerald-500" : "text-amber-500") : "text-muted-foreground"}`}>{d.retest ? (d.retest.continuation ? "continuation" : "failure") : "—"}</td>
                    <td className={`py-1.5 font-medium ${o === "win" ? "text-emerald-500" : o === "loss" ? "text-red-500" : "text-muted-foreground"}`}>{o || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ORBDashboard;
