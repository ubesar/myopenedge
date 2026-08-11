import { Input } from "@/components/ui/input";
import type { ExecConfig } from "@/lib/backtest-engine";

interface Props {
  cfg: ExecConfig;
  onChange: (c: ExecConfig) => void;
}

const F = ({
  label,
  value,
  onChange,
  step = "0.01",
  suffix,
}: { label: string; value: number; onChange: (v: number) => void; step?: string; suffix?: string }) => (
  <div className="space-y-1">
    <p className="text-[11px] text-muted-foreground lowercase">{label}</p>
    <div className="flex items-center gap-1">
      <Input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-24 h-8 bg-input border-border text-[12px] font-mono"
      />
      {suffix && <span className="text-[10px] text-muted-foreground">{suffix}</span>}
    </div>
  </div>
);

const ExecutionPanel = ({ cfg, onChange }: Props) => {
  const set = (k: keyof ExecConfig) => (v: number) => onChange({ ...cfg, [k]: v });
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-[12px] font-medium text-foreground lowercase mb-2">execution model — slippage &amp; cost</p>
      <div className="flex flex-wrap gap-3">
        <F label="tick size" value={cfg.tickSize} onChange={set("tickSize")} step="0.01" />
        <F label="tick value" value={cfg.tickValue} onChange={set("tickValue")} step="0.01" suffix="$" />
        <F label="slippage" value={cfg.slippageTicks} onChange={set("slippageTicks")} step="0.5" suffix="tick / side" />
        <F label="commission" value={cfg.commissionPerContract} onChange={set("commissionPerContract")} step="0.1" suffix="$ / contract / side" />
        <F label="fee per trade" value={cfg.commissionPerTrade} onChange={set("commissionPerTrade")} step="0.1" suffix="$" />
        <F label="fixed risk" value={cfg.fixedRiskUsd} onChange={set("fixedRiskUsd")} step="10" suffix="$" />
        <F label="account size" value={cfg.accountSize} onChange={set("accountSize")} step="1000" suffix="$" />
        <F label="risk free rate" value={cfg.riskFreeRatePct} onChange={set("riskFreeRatePct")} step="0.1" suffix="% / yr" />
      </div>
    </div>
  );
};

export default ExecutionPanel;
