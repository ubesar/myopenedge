import type { ConditionConfig } from "@/lib/combo-analysis";

interface Props {
  label: string;
  value: ConditionConfig;
  onChange: (c: ConditionConfig) => void;
  otherCondition?: ConditionConfig;
}

const CONDITION_TYPES = [
  { value: "ib_breakout", label: "IB Breakout" },
  { value: "bb_breakout", label: "Bollinger Bands" },
  { value: "momentum_candle", label: "Momentum Candle" },
  { value: "occ", label: "Opening Candle Color" },
] as const;

function defaultCondition(type: string): ConditionConfig {
  switch (type) {
    case "ib_breakout": return { type: "ib_breakout", window: 60, direction: "any" };
    case "bb_breakout": return { type: "bb_breakout", timeframe: 15, band: "upper", period: 20, timing: "during_ib" };
    case "momentum_candle": return { type: "momentum_candle", bodyRatio: 0.6, direction: "any", timing: "during_ib" };
    case "occ": return { type: "occ", timeframe: 15, direction: "any" };
    default: return { type: "ib_breakout", window: 60, direction: "any" };
  }
}

const selectClass = "bg-card border border-border rounded-lg px-2.5 py-1.5 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary";

export default function ConditionPicker({ label, value, onChange }: Props) {
  const handleTypeChange = (type: string) => {
    onChange(defaultCondition(type));
  };

  return (
    <div className="rounded-xl border border-border bg-card/50 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-widest font-bold text-primary">{label}</span>
      </div>

      {/* Condition type */}
      <div>
        <label className="text-[10px] text-muted-foreground block mb-1">type</label>
        <select
          value={value.type}
          onChange={(e) => handleTypeChange(e.target.value)}
          className={selectClass + " w-full"}
        >
          {CONDITION_TYPES.map((ct) => (
            <option key={ct.value} value={ct.value}>{ct.label}</option>
          ))}
        </select>
      </div>

      {/* IB Breakout params */}
      {value.type === "ib_breakout" && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">window</label>
            <select
              value={value.window}
              onChange={(e) => onChange({ ...value, window: Number(e.target.value) as 30 | 60 })}
              className={selectClass + " w-full"}
            >
              <option value={30}>30 min</option>
              <option value={60}>60 min</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">direction</label>
            <select
              value={value.direction}
              onChange={(e) => onChange({ ...value, direction: e.target.value as "high" | "low" | "any" })}
              className={selectClass + " w-full"}
            >
              <option value="any">any</option>
              <option value="high">break high</option>
              <option value="low">break low</option>
            </select>
          </div>
        </div>
      )}

      {/* BB params */}
      {value.type === "bb_breakout" && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">timeframe</label>
            <select
              value={value.timeframe}
              onChange={(e) => onChange({ ...value, timeframe: Number(e.target.value) as 5 | 15 | 30 })}
              className={selectClass + " w-full"}
            >
              <option value={5}>5m</option>
              <option value={15}>15m</option>
              <option value={30}>30m</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">band</label>
            <select
              value={value.band}
              onChange={(e) => onChange({ ...value, band: e.target.value as "upper" | "lower" })}
              className={selectClass + " w-full"}
            >
              <option value="upper">upper</option>
              <option value="lower">lower</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">period</label>
            <select
              value={value.period}
              onChange={(e) => onChange({ ...value, period: Number(e.target.value) })}
              className={selectClass + " w-full"}
            >
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={20}>20</option>
              <option value={30}>30</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">timing</label>
            <select
              value={value.timing}
              onChange={(e) => onChange({ ...value, timing: e.target.value as "during_ib" | "after_ib" | "morning" })}
              className={selectClass + " w-full"}
            >
              <option value="during_ib">during IB</option>
              <option value="after_ib">after IB</option>
              <option value="morning">morning (9:30–12:00)</option>
            </select>
          </div>
        </div>
      )}

      {/* Momentum Candle params */}
      {value.type === "momentum_candle" && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">body ratio ≥</label>
            <select
              value={value.bodyRatio}
              onChange={(e) => onChange({ ...value, bodyRatio: Number(e.target.value) })}
              className={selectClass + " w-full"}
            >
              <option value={0.4}>40%</option>
              <option value={0.5}>50%</option>
              <option value={0.6}>60%</option>
              <option value={0.7}>70%</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">direction</label>
            <select
              value={value.direction}
              onChange={(e) => onChange({ ...value, direction: e.target.value as "bullish" | "bearish" | "any" })}
              className={selectClass + " w-full"}
            >
              <option value="any">any</option>
              <option value="bullish">bullish</option>
              <option value="bearish">bearish</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-[10px] text-muted-foreground block mb-1">timing</label>
            <select
              value={value.timing}
              onChange={(e) => onChange({ ...value, timing: e.target.value as "during_ib" | "after_ib" | "morning" })}
              className={selectClass + " w-full"}
            >
              <option value="during_ib">during IB</option>
              <option value="after_ib">after IB</option>
              <option value="morning">morning (9:30–12:00)</option>
            </select>
          </div>
        </div>
      )}

      {/* OCC params */}
      {value.type === "occ" && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">timeframe</label>
            <select
              value={value.timeframe}
              onChange={(e) => onChange({ ...value, timeframe: Number(e.target.value) as 15 | 30 })}
              className={selectClass + " w-full"}
            >
              <option value={15}>15m</option>
              <option value={30}>30m</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">direction</label>
            <select
              value={value.direction}
              onChange={(e) => onChange({ ...value, direction: e.target.value as "green" | "red" | "any" })}
              className={selectClass + " w-full"}
            >
              <option value="any">any</option>
              <option value="green">green</option>
              <option value="red">red</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
