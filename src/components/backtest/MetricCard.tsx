import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  label: string;
  value: string;
  hint?: string;
  tone?: "pos" | "neg" | "muted";
  sub?: string;
}

const MetricCard = ({ label, value, hint, tone, sub }: Props) => (
  <div className="rounded-xl border border-border bg-card p-3">
    <div className="flex items-center gap-1 mb-1">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      {hint && (
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="text-muted-foreground/70 hover:text-foreground">
                <Info className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-[240px] text-[11px] leading-relaxed lowercase">
              {hint}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
    <p
      className={`text-[15px] font-mono font-semibold ${
        tone === "pos" ? "text-emerald-500" : tone === "neg" ? "text-destructive" : tone === "muted" ? "text-muted-foreground" : "text-foreground"
      }`}
    >
      {value}
    </p>
    {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
  </div>
);

export default MetricCard;
