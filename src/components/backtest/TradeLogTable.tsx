import { useMemo } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ExecTrade, Regime } from "@/lib/backtest-engine";

interface Props {
  trades: ExecTrade[];
  symbol: string;
  regimes?: Map<string, Regime>;
}

const money = (v: number) => `${v < 0 ? "-" : ""}$${Math.abs(v).toFixed(2)}`;

const TradeLogTable = ({ trades, symbol, regimes }: Props) => {
  const worst = useMemo(() => {
    const ids = trades
      .slice()
      .sort((a, b) => a.netPnl - b.netPnl)
      .slice(0, 5)
      .filter((t) => t.netPnl < 0)
      .map((t) => `${t.date}-${t.entryTime}`);
    return new Set(ids);
  }, [trades]);

  const exportCsv = () => {
    const head = [
      "date", "side", "signal_time", "entry_time", "exit_time", "entry_price", "exit_price",
      "stop", "target", "size", "risk_points", "gross_pnl", "commission", "slippage_cost",
      "net_pnl", "r_multiple", "hold_minutes", "outcome", "regime", "reason",
    ];
    const rows = trades.map((t) => [
      t.date, t.side, t.signalTime, t.entryTime, t.exitTime, t.entry.toFixed(2), t.exit.toFixed(2),
      t.stop.toFixed(2), t.target.toFixed(2), t.size, t.riskPoints.toFixed(2), t.grossPnl.toFixed(2),
      t.commission.toFixed(2), t.slippageCost.toFixed(2), t.netPnl.toFixed(2), t.rMultiple.toFixed(3),
      t.holdMinutes, t.outcome, regimes?.get(t.date) ?? "", `"${t.reason.replace(/"/g, "'")}"`,
    ]);
    const csv = [head.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${symbol.toLowerCase()}-trade-log.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!trades.length) return null;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-2 border-b border-border flex items-center justify-between">
        <p className="text-[12px] font-medium text-foreground lowercase">trade log — {trades.length} trades (net, after slippage &amp; commission)</p>
        <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1.5" onClick={exportCsv}>
          <Download className="h-3 w-3" /> export csv
        </Button>
      </div>
      <div className="max-h-[420px] overflow-auto">
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 bg-card border-b border-border">
            <tr className="text-muted-foreground">
              {["date", "side", "entry @", "exit @", "entry", "exit", "size", "hold", "gross", "cost", "net", "r", "regime", "reason"].map((h) => (
                <th key={h} className="px-2 py-1.5 text-left font-normal lowercase whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {trades.map((t) => {
              const flagged = worst.has(`${t.date}-${t.entryTime}`);
              return (
                <tr
                  key={`${t.date}-${t.entryTime}`}
                  className={`border-b border-border/50 ${flagged ? "bg-destructive/10" : ""}`}
                >
                  <td className="px-2 py-1 font-mono whitespace-nowrap">
                    {flagged && <span className="mr-1 text-destructive">▲</span>}
                    {t.date}
                  </td>
                  <td className="px-2 py-1">{t.side}</td>
                  <td className="px-2 py-1 font-mono">{t.entryTime}</td>
                  <td className="px-2 py-1 font-mono">{t.exitTime}</td>
                  <td className="px-2 py-1 font-mono">{t.entry.toFixed(2)}</td>
                  <td className="px-2 py-1 font-mono">{t.exit.toFixed(2)}</td>
                  <td className="px-2 py-1 font-mono">{t.size}</td>
                  <td className="px-2 py-1 font-mono">{t.holdMinutes}m</td>
                  <td className="px-2 py-1 font-mono text-muted-foreground">{money(t.grossPnl)}</td>
                  <td className="px-2 py-1 font-mono text-muted-foreground">{money(-(t.commission + t.slippageCost))}</td>
                  <td className={`px-2 py-1 font-mono ${t.netPnl >= 0 ? "text-emerald-500" : "text-destructive"}`}>{money(t.netPnl)}</td>
                  <td className="px-2 py-1 font-mono">{t.rMultiple.toFixed(2)}</td>
                  <td className="px-2 py-1 text-muted-foreground whitespace-nowrap">{regimes?.get(t.date) ?? "—"}</td>
                  <td className="px-2 py-1 text-muted-foreground max-w-[280px] truncate" title={t.reason}>{t.reason}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-1.5 border-t border-border text-[10px] text-muted-foreground lowercase">
        ▲ = top 5 largest losses (audit for gap / news anomaly)
      </div>
    </div>
  );
};

export default TradeLogTable;
