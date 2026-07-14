import { useMemo, useState } from "react";
import { Helmet, HelmetProvider } from "react-helmet-async";
import { Plus, X } from "lucide-react";

const PLANS = ["Premium Plan", "Rapid Pro Plan", "Standard Plan"];
const ACCOUNT_SIZES = ["5K", "10K", "25K", "50K", "100K", "150K", "200K"];
const PHASES = ["Evaluation", "FundedNext Account"];

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

type Result = {
  total: number;
  highest: number;
  contribution: number;
  pass: boolean;
  shortfall: number;
  recommendation: number;
  progress: number;
};

const ConsistencyCalculator = () => {
  const [plan, setPlan] = useState(PLANS[0]);
  const [accountSize, setAccountSize] = useState("50K");
  const [phase, setPhase] = useState(PHASES[0]);
  const [target, setTarget] = useState(3000);
  const [rows, setRows] = useState<string[]>(["1200", "1200", "600"]);
  const [result, setResult] = useState<Result | null>(null);

  const total = useMemo(
    () => rows.reduce((s, v) => s + (parseFloat(v) || 0), 0),
    [rows]
  );

  const check = () => {
    const nums = rows.map((v) => parseFloat(v) || 0);
    const net = nums.reduce((s, v) => s + v, 0);
    const highest = nums.length ? Math.max(...nums) : 0;
    const contribution = net > 0 ? (highest / net) * 100 : 0;
    const pass = contribution <= 40;
    const shortfall = Math.max(0, target - net);
    const recommendation = pass ? 0 : Math.max(0, highest / 0.4 - net);
    const progress = target > 0 ? Math.min(100, (net / target) * 100) : 0;
    setResult({ total: net, highest, contribution, pass, shortfall, recommendation, progress });
  };

  const updateRow = (i: number, v: string) => setRows(rows.map((r, idx) => (idx === i ? v : r)));
  const removeRow = (i: number) => setRows(rows.filter((_, idx) => idx !== i));
  const addRow = () => setRows([...rows, ""]);

  return (
    <HelmetProvider>
      <Helmet>
        <title>FundedNext Consistency Rule Calculator — check your 40% rule</title>
        <meta
          name="description"
          content="Free calculator to check the FundedNext Rapid Pro Challenge consistency rule. Enter daily P/L and see if your highest day stays within the 40% limit."
        />
        <meta property="og:title" content="FundedNext Consistency Rule Calculator" />
        <meta
          property="og:description"
          content="Check whether your daily P/L passes the FundedNext 40% consistency rule."
        />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="FundedNext Consistency Rule Calculator" />
        <meta
          name="twitter:description"
          content="Check whether your daily P/L passes the FundedNext 40% consistency rule."
        />
      </Helmet>

      <div
        className="fn-calc min-h-screen w-full py-10 px-4"
        style={{
          // scoped design tokens (oklch) — dark teal theme
          ["--fn-bg" as string]: "oklch(0.18 0.03 165)",
          ["--fn-fg" as string]: "oklch(0.96 0.01 160)",
          ["--fn-card" as string]: "oklch(0.22 0.035 165)",
          ["--fn-input" as string]: "oklch(0.14 0.025 165)",
          ["--fn-border" as string]: "oklch(0.32 0.03 165)",
          ["--fn-muted" as string]: "oklch(0.65 0.02 160)",
          ["--fn-primary" as string]: "oklch(0.75 0.15 165)",
          ["--fn-primary-fg" as string]: "oklch(0.15 0.02 165)",
          ["--fn-success" as string]: "oklch(0.78 0.16 160)",
          ["--fn-danger" as string]: "oklch(0.65 0.22 25)",
          background:
            "radial-gradient(ellipse 80% 50% at 50% 0%, oklch(0.25 0.06 165 / 0.5), transparent), var(--fn-bg)",
          color: "var(--fn-fg)",
        }}
      >
        <div className="max-w-3xl mx-auto space-y-6">
          <header className="text-center space-y-2 mb-2">
            <h1 className="text-2xl md:text-3xl font-semibold" style={{ color: "var(--fn-fg)" }}>
              FundedNext Consistency Rule Calculator
            </h1>
            <p style={{ color: "var(--fn-muted)" }} className="text-sm">
              Rapid Pro Challenge — 40% daily profit limit
            </p>
          </header>

          {/* PLAN CARD */}
          <Card>
            <Field label="Plan">
              <Select value={plan} onChange={setPlan} options={PLANS} />
            </Field>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Account Size">
                <Select value={accountSize} onChange={setAccountSize} options={ACCOUNT_SIZES} />
              </Field>
              <Field label="Phase">
                <Select value={phase} onChange={setPhase} options={PHASES} />
              </Field>
              <Field label="Target">
                <div className="relative">
                  <span
                    className="absolute left-3 top-1/2 -translate-y-1/2 font-semibold"
                    style={{ color: "var(--fn-primary)" }}
                  >
                    $
                  </span>
                  <input
                    type="number"
                    value={target}
                    onChange={(e) => setTarget(parseFloat(e.target.value) || 0)}
                    className="w-full pl-7 pr-3 py-2.5 rounded-lg outline-none font-semibold"
                    style={{
                      background: "var(--fn-input)",
                      border: "1px solid var(--fn-border)",
                      color: "var(--fn-primary)",
                    }}
                  />
                </div>
              </Field>
            </div>
          </Card>

          {/* DAILY P/L CARD */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold">Daily P/L</h2>
              <button
                onClick={addRow}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-90"
                style={{ background: "var(--fn-primary)", color: "var(--fn-primary-fg)" }}
              >
                <Plus className="h-4 w-4" /> Add Row
              </button>
            </div>
            <div
              className="border-t mb-3"
              style={{ borderColor: "var(--fn-border)" }}
            />
            <div className="space-y-2">
              {rows.map((val, i) => {
                const num = parseFloat(val) || 0;
                const pct = total > 0 ? (num / total) * 100 : 0;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <input
                      type="number"
                      value={val}
                      onChange={(e) => updateRow(i, e.target.value)}
                      className="flex-1 px-3 py-2.5 rounded-lg outline-none"
                      style={{
                        background: "var(--fn-input)",
                        border: "1px solid var(--fn-border)",
                        color: "var(--fn-fg)",
                      }}
                    />
                    <span className="w-12 text-sm text-right" style={{ color: "var(--fn-muted)" }}>
                      {pct.toFixed(0)}%
                    </span>
                    <button
                      onClick={() => removeRow(i)}
                      className="p-2 rounded-lg transition-opacity hover:opacity-80"
                      style={{
                        background: "oklch(0.28 0.08 25)",
                        color: "var(--fn-danger)",
                      }}
                      aria-label="Remove row"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-sm font-semibold">
              Total Net PnL: <span>{usd(total)}</span>
            </p>
            <button
              onClick={check}
              className="mt-4 w-full py-3 rounded-lg font-semibold text-base transition-opacity hover:opacity-90"
              style={{ background: "var(--fn-primary)", color: "var(--fn-primary-fg)" }}
            >
              Check Consistency
            </button>
          </Card>

          {/* RESULT CARD */}
          {result && (
            <Card>
              <div className="flex flex-col md:flex-row items-start gap-5">
                <Donut percent={result.contribution} pass={result.pass} />
                <div className="flex-1 space-y-3 w-full">
                  <div
                    className="px-4 py-3 rounded-lg text-sm font-medium"
                    style={{
                      background: result.pass
                        ? "oklch(0.3 0.08 165 / 0.5)"
                        : "oklch(0.3 0.12 25 / 0.35)",
                      color: result.pass ? "var(--fn-success)" : "var(--fn-danger)",
                      border: `1px solid ${
                        result.pass ? "var(--fn-success)" : "var(--fn-danger)"
                      }`,
                    }}
                  >
                    {result.pass
                      ? "🚀 You meet the consistency rule"
                      : "⚠️ You exceeded the 40% daily profit limit"}
                  </div>
                  <div className="text-sm space-y-1.5" style={{ color: "var(--fn-fg)" }}>
                    <p>
                      Largest day: <b>{result.contribution.toFixed(0)}%</b> of net{" "}
                      <b>{usd(result.total)}</b>. Limit <b>40%</b>.
                    </p>
                    <p>
                      Target shortfall: <b>{usd(result.shortfall)}</b>
                    </p>
                    {!result.pass && result.recommendation > 0 && (
                      <p>
                        Recommendation: You need to make{" "}
                        <b>{usd(result.recommendation)}</b> more to satisfy your consistency rule
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-5">
                <p className="text-xs mb-2" style={{ color: "var(--fn-muted)" }}>
                  Profit Target Progress
                </p>
                <div
                  className="h-2 rounded-full overflow-hidden"
                  style={{ background: "var(--fn-input)" }}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${result.progress}%`,
                      background:
                        "linear-gradient(90deg, oklch(0.6 0.2 250), oklch(0.75 0.16 165))",
                    }}
                  />
                </div>
                <p className="text-xs text-right mt-1" style={{ color: "var(--fn-primary)" }}>
                  {usd(result.total)} / {usd(target)}
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </HelmetProvider>
  );
};

const Card = ({ children }: { children: React.ReactNode }) => (
  <section
    className="rounded-2xl p-5 md:p-6 space-y-4 shadow-lg"
    style={{
      background: "var(--fn-card)",
      border: "1px solid var(--fn-border)",
    }}
  >
    {children}
  </section>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block space-y-1.5">
    <span className="text-xs" style={{ color: "var(--fn-muted)" }}>
      {label}
    </span>
    {children}
  </label>
);

const Select = ({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className="w-full px-3 py-2.5 rounded-lg outline-none appearance-none cursor-pointer"
    style={{
      background: "var(--fn-input)",
      border: "1px solid var(--fn-border)",
      color: "var(--fn-fg)",
      backgroundImage:
        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8' fill='none'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%2394a3b8' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E\")",
      backgroundRepeat: "no-repeat",
      backgroundPosition: "right 0.75rem center",
      paddingRight: "2rem",
    }}
  >
    {options.map((o) => (
      <option key={o} value={o} style={{ background: "var(--fn-card)" }}>
        {o}
      </option>
    ))}
  </select>
);

const Donut = ({ percent, pass }: { percent: number; pass: boolean }) => {
  const p = Math.min(100, Math.max(0, percent));
  const color = pass ? "var(--fn-success)" : "var(--fn-danger)";
  return (
    <div
      className="relative rounded-full flex items-center justify-center flex-shrink-0"
      style={{
        width: 110,
        height: 110,
        background: `conic-gradient(${color} ${p}%, oklch(0.28 0.03 165) ${p}%)`,
      }}
    >
      <div
        className="rounded-full flex items-center justify-center"
        style={{
          width: 82,
          height: 82,
          background: "var(--fn-card)",
        }}
      >
        <span className="font-bold text-lg" style={{ color: "var(--fn-fg)" }}>
          {p.toFixed(0)}%
        </span>
      </div>
    </div>
  );
};

export default ConsistencyCalculator;
