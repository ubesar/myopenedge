import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { aggregateBars, type CandleBar } from "@/lib/m15-aggregation";
import { computeMomentumFlags } from "@/lib/momentum-candle";


interface RawBar {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
}

export interface TradeForChart {
  date: string;
  time?: string;
  direction: "bullish" | "bearish";
  entry: number;
  stop: number;
  target: number;
  outcome: "win" | "loss";
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  trade: TradeForChart | null;
  bars: RawBar[];
  symbol: string;
  /** session window in minutes from midnight; end may exceed 1440 (next-day wrap) */
  sessionStartMin?: number;
  sessionEndMin?: number;
}

const DEFAULT_START = 9 * 60 + 30;
const DEFAULT_END = 16 * 60;

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function nextDay(date: string) {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export default function TradeChartDialog({
  open,
  onOpenChange,
  trade,
  bars,
  symbol,
  sessionStartMin = DEFAULT_START,
  sessionEndMin = DEFAULT_END,
}: Props) {
  if (!trade) return null;

  const wrapCutoff = sessionEndMin > 24 * 60 ? sessionEndMin - 24 * 60 : 0;
  const tomorrow = wrapCutoff > 0 ? nextDay(trade.date) : null;

  // bars belonging to this trade's session (may cross midnight into the next date)
  const m5: CandleBar[] = bars
    .map((b) => {
      const [date, time] = b.datetime.split(" ");
      const raw = toMinutes(time.slice(0, 5));
      if (date === trade.date) return { date, min: raw, bar: b };
      if (tomorrow && date === tomorrow && raw < wrapCutoff) return { date, min: raw + 24 * 60, bar: b };
      return null;
    })
    .filter((x): x is { date: string; min: number; bar: RawBar } => !!x)
    .filter((x) => x.min >= sessionStartMin && x.min < sessionEndMin)
    .sort((a, b) => a.min - b.min)
    .map((x) => ({
      time: `${pad2(Math.floor(x.min / 60))}:${pad2(x.min % 60)}`,
      open: parseFloat(x.bar.open),
      high: parseFloat(x.bar.high),
      low: parseFloat(x.bar.low),
      close: parseFloat(x.bar.close),
    }));

  const m15 = aggregateBars(m5, 15);
  const flags = computeMomentumFlags(m15);

  // scales — the whole session fits on screen (no horizontal scroll)
  const W = Math.max(900, Math.min(1800, m15.length * 14 + 110));
  const H = 460;


  const PL = 50, PR = 60, PT = 20, PB = 30;
  const cw = W - PL - PR;
  const ch = H - PT - PB;

  const highs = m15.map((b) => b.high);
  const lows = m15.map((b) => b.low);
  const levels = [trade.entry, trade.stop, trade.target];
  const yMax = Math.max(...highs, ...levels);
  const yMin = Math.min(...lows, ...levels);
  const pad = (yMax - yMin) * 0.08 || 1;
  const y0 = yMin - pad;
  const y1 = yMax + pad;

  const xFor = (i: number) => PL + (m15.length <= 1 ? cw / 2 : (i / (m15.length - 1)) * cw);
  const yFor = (v: number) => PT + ((y1 - v) / (y1 - y0)) * ch;
  const bw = m15.length > 1 ? Math.max(3, (cw / m15.length) * 0.7) : 12;

  const signalIdx = trade.time ? m15.findIndex((b) => b.time === trade.time) : -1;

  const gridTicks = 5;
  const gridVals: number[] = [];
  for (let i = 0; i <= gridTicks; i++) gridVals.push(y0 + ((y1 - y0) * i) / gridTicks);

  const levelColor = { entry: "#3b82f6", sl: "#ef4444", tp: "#10b981" };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="lowercase text-sm">
            {symbol} · {trade.date} · m15 · {trade.direction === "bullish" ? "long" : "short"} @ {trade.time ?? "-"} ·{" "}
            <span className={trade.outcome === "win" ? "text-emerald-500" : "text-red-500"}>
              {trade.outcome.toUpperCase()}
            </span>
          </DialogTitle>
        </DialogHeader>

        {m15.length === 0 ? (
          <div className="text-sm text-muted-foreground p-4 lowercase">no intraday data available for this date</div>
        ) : (
          <div className="overflow-x-auto">
            <svg width={W} height={H} className="text-muted-foreground">
              {/* grid */}
              {gridVals.map((v, i) => (
                <g key={i}>
                  <line x1={PL} x2={W - PR} y1={yFor(v)} y2={yFor(v)} stroke="currentColor" strokeOpacity={0.15} strokeDasharray="3 3" />
                  <text x={PL - 6} y={yFor(v) + 3} textAnchor="end" fontSize={10} fill="currentColor">
                    {v.toFixed(2)}
                  </text>
                </g>
              ))}

              {/* candles */}
              {m15.map((b, i) => {
                const x = xFor(i);
                const up = b.close >= b.open;
                const color = up ? "#10b981" : "#ef4444";
                const yO = yFor(b.open);
                const yC = yFor(b.close);
                const yH = yFor(b.high);
                const yL = yFor(b.low);
                const top = Math.min(yO, yC);
                const height = Math.max(1, Math.abs(yC - yO));
                return (
                  <g key={i}>
                    <line x1={x} x2={x} y1={yH} y2={yL} stroke={color} strokeWidth={1} />
                    <rect x={x - bw / 2} y={top} width={bw} height={height} fill={color} />
                  </g>
                );
              })}

              {/* time labels — every ~6 bars */}
              {m15.map((b, i) => {
                if (i % Math.max(1, Math.floor(m15.length / 6)) !== 0) return null;
                return (
                  <text key={`t-${i}`} x={xFor(i)} y={H - 10} textAnchor="middle" fontSize={10} fill="currentColor">
                    {b.time}
                  </text>
                );
              })}

              {/* levels */}
              {[
                { label: "TP", value: trade.target, color: levelColor.tp },
                { label: "Entry", value: trade.entry, color: levelColor.entry },
                { label: "SL", value: trade.stop, color: levelColor.sl },
              ].map((lv) => (
                <g key={lv.label}>
                  <line x1={PL} x2={W - PR} y1={yFor(lv.value)} y2={yFor(lv.value)} stroke={lv.color} strokeWidth={1.2} strokeDasharray="5 4" />
                  <text x={W - PR + 4} y={yFor(lv.value) + 3} fontSize={10} fill={lv.color}>
                    {lv.label} {lv.value.toFixed(2)}
                  </text>
                </g>
              ))}

              {/* signal marker */}
              {signalIdx >= 0 && (
                <g>
                  <line x1={xFor(signalIdx)} x2={xFor(signalIdx)} y1={PT} y2={H - PB} stroke={levelColor.entry} strokeOpacity={0.3} strokeDasharray="2 3" />
                  {trade.direction === "bullish" ? (
                    <polygon
                      points={`${xFor(signalIdx) - 5},${yFor(trade.entry) + 14} ${xFor(signalIdx) + 5},${yFor(trade.entry) + 14} ${xFor(signalIdx)},${yFor(trade.entry) + 4}`}
                      fill={levelColor.entry}
                    />
                  ) : (
                    <polygon
                      points={`${xFor(signalIdx) - 5},${yFor(trade.entry) - 14} ${xFor(signalIdx) + 5},${yFor(trade.entry) - 14} ${xFor(signalIdx)},${yFor(trade.entry) - 4}`}
                      fill={levelColor.entry}
                    />
                  )}
                </g>
              )}
            </svg>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
