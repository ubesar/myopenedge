import type { OCCResult } from "@/lib/occ-analysis";
import { validateOCCResult } from "@/lib/occ-formatter";

interface OCCSummaryProps {
  result: unknown;
}

const Row = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "red" | "muted";
}) => (
  <div className="flex items-center justify-between text-[12px]">
    <span className="text-muted-foreground">{label}</span>
    <span
      className={
        tone === "green"
          ? "font-semibold text-chart-bar-a"
          : tone === "red"
            ? "font-semibold text-chart-bar-b"
            : "font-medium text-foreground"
      }
    >
      {value}
    </span>
  </div>
);

const OCCSummary = ({ result }: OCCSummaryProps) => {
  const err = validateOCCResult(result);
  if (err) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-[12px] text-destructive">
        {err.error}
      </div>
    );
  }

  const r = result as OCCResult;
  const g = r.greenCandle;
  const rd = r.redCandle;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="rounded-lg border border-border bg-card p-3 space-y-1.5">
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-[11px] uppercase tracking-wider text-muted-foreground">
            green opening candle
          </h4>
          <span className="text-[10px] text-muted-foreground">{g.total} days</span>
        </div>
        <Row
          label="continues green"
          value={`${g.greenDayPct.toFixed(2)}%`}
          tone="green"
        />
        <Row
          label="reverses to red"
          value={`${g.redDayPct.toFixed(2)}%`}
          tone="red"
        />
      </div>

      <div className="rounded-lg border border-border bg-card p-3 space-y-1.5">
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-[11px] uppercase tracking-wider text-muted-foreground">
            red opening candle
          </h4>
          <span className="text-[10px] text-muted-foreground">{rd.total} days</span>
        </div>
        <Row
          label="continues red"
          value={`${rd.redDayPct.toFixed(2)}%`}
          tone="red"
        />
        <Row
          label="reverses to green"
          value={`${rd.greenDayPct.toFixed(2)}%`}
          tone="green"
        />
      </div>
    </div>
  );
};

export default OCCSummary;
