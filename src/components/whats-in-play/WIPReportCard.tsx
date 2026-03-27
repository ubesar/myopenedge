import { ArrowUpRight, ArrowDownRight, Minus, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";

export type Bias = "bullish" | "bearish" | "neutral";

export interface SubStat {
  label: string;
  value: string;
}

export interface ReportCardData {
  key: string;
  label: string;
  bias: Bias;
  mainStat: string;
  mainLabel: string;
  subStats: SubStat[];
  description?: string;
}

interface Props {
  report: ReportCardData;
  symbol: string;
}

const biasConfig: Record<Bias, { icon: typeof ArrowUpRight; color: string; bg: string; label: string }> = {
  bullish: { icon: ArrowUpRight, color: "text-profit", bg: "bg-profit/10", label: "bullish" },
  bearish: { icon: ArrowDownRight, color: "text-loss", bg: "bg-loss/10", label: "bearish" },
  neutral: { icon: Minus, color: "text-muted-foreground", bg: "bg-muted", label: "neutral" },
};

export default function WIPReportCard({ report, symbol }: Props) {
  const navigate = useNavigate();
  const bc = biasConfig[report.bias];
  const BiasIcon = bc.icon;

  const goToReport = () => {
    navigate("/");
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3 hover:border-primary/30 transition-all group">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">
          {report.label}
        </h4>
        <div className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${bc.bg} ${bc.color}`}>
          <BiasIcon className="h-3 w-3" />
          {bc.label}
        </div>
      </div>

      {/* Main stat */}
      <div>
        <p className={`text-[28px] font-extrabold leading-none ${bc.color}`}>
          {report.mainStat}
        </p>
        <p className="text-[10px] text-muted-foreground mt-1">{report.mainLabel}</p>
      </div>

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Sub stats */}
      <div className="space-y-1.5">
        {report.subStats.map((s) => (
          <div key={s.label} className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">{s.label}</span>
            <span className="text-foreground font-medium">{s.value}</span>
          </div>
        ))}
      </div>

      {/* Description */}
      {report.description && (
        <>
          <div className="h-px bg-border" />
          <p className="text-[10px] text-muted-foreground leading-relaxed">{report.description}</p>
        </>
      )}

      {/* Go to report */}
      <button
        onClick={goToReport}
        className="mt-auto flex items-center gap-1 text-[10px] text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity"
      >
        go to report <ExternalLink className="h-3 w-3" />
      </button>
    </div>
  );
}
