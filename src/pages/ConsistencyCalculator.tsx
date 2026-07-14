import { useMemo, useState } from "react";
import { Helmet, HelmetProvider } from "react-helmet-async";
import { Plus, X, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

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
  const navigate = useNavigate();
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
      </Helmet>

      <div className="min-h-screen w-full bg-background text-foreground py-8 px-4">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4 mr-1.5" /> back
            </Button>
          </div>

          <header className="text-center space-y-2">
            <h1 className="text-2xl md:text-3xl font-semibold lowercase">
              fundednext consistency rule calculator
            </h1>
            <p className="text-sm text-muted-foreground lowercase">
              rapid pro challenge — 40% daily profit limit
            </p>
          </header>

          {/* PLAN CARD */}
          <Card>
            <Field label="plan">
              <Select value={plan} onChange={setPlan} options={PLANS} />
            </Field>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="account size">
                <Select value={accountSize} onChange={setAccountSize} options={ACCOUNT_SIZES} />
              </Field>
              <Field label="phase">
                <Select value={phase} onChange={setPhase} options={PHASES} />
              </Field>
              <Field label="target">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-semibold text-primary">
                    $
                  </span>
                  <input
                    type="number"
                    value={target}
                    onChange={(e) => setTarget(parseFloat(e.target.value) || 0)}
                    className="w-full pl-7 pr-3 py-2.5 rounded-md bg-input border border-border text-primary font-semibold outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </Field>
            </div>
          </Card>

          {/* DAILY P/L CARD */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold lowercase">daily p/l</h2>
              <button
                onClick={addRow}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity lowercase"
              >
                <Plus className="h-4 w-4" /> add row
              </button>
            </div>
            <div className="border-t border-border mb-3" />
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
                      className="flex-1 px-3 py-2.5 rounded-md bg-input border border-border text-foreground outline-none focus:ring-1 focus:ring-ring"
                    />
                    <span className="w-12 text-sm text-right text-muted-foreground">
                      {pct.toFixed(0)}%
                    </span>
                    <button
                      onClick={() => removeRow(i)}
                      className="p-2 rounded-md bg-destructive/15 text-destructive hover:bg-destructive/25 transition-colors"
                      aria-label="remove row"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-sm font-semibold lowercase">
              total net pnl: <span className="text-primary">{usd(total)}</span>
            </p>
            <button
              onClick={check}
              className="mt-4 w-full py-3 rounded-md font-semibold text-base bg-primary text-primary-foreground hover:opacity-90 transition-opacity lowercase"
            >
              check consistency
            </button>
          </Card>

          {/* RESULT CARD */}
          {result && (
            <Card>
              <div className="flex flex-col md:flex-row items-start gap-5">
                <Donut percent={result.contribution} pass={result.pass} />
                <div className="flex-1 space-y-3 w-full">
                  <div
                    className={`px-4 py-3 rounded-md text-sm font-medium border ${
                      result.pass
                        ? "border-[hsl(var(--profit))] bg-[hsl(var(--profit)/0.12)] text-[hsl(var(--profit))]"
                        : "border-destructive bg-destructive/10 text-destructive"
                    }`}
                  >
                    {result.pass
                      ? "🚀 you meet the consistency rule"
                      : "⚠️ you exceeded the 40% daily profit limit"}
                  </div>
                  <div className="text-sm space-y-1.5 text-foreground">
                    <p>
                      largest day: <b>{result.contribution.toFixed(0)}%</b> of net{" "}
                      <b>{usd(result.total)}</b>. limit <b>40%</b>.
                    </p>
                    <p>
                      target shortfall: <b>{usd(result.shortfall)}</b>
                    </p>
                    {!result.pass && result.recommendation > 0 && (
                      <p className="text-muted-foreground">
                        recommendation: you need to make{" "}
                        <b className="text-foreground">{usd(result.recommendation)}</b> more to
                        satisfy your consistency rule
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-5">
                <p className="text-xs mb-2 text-muted-foreground lowercase">
                  profit target progress
                </p>
                <div className="h-2 rounded-full overflow-hidden bg-input">
                  <div
                    className="h-full rounded-full transition-all bg-primary"
                    style={{ width: `${result.progress}%` }}
                  />
                </div>
                <p className="text-xs text-right mt-1 text-primary">
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
  <section className="rounded-xl p-5 md:p-6 space-y-4 bg-card border border-border shadow-lg">
    {children}
  </section>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block space-y-1.5">
    <span className="text-xs text-muted-foreground lowercase">{label}</span>
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
    className="w-full px-3 py-2.5 rounded-md bg-input border border-border text-foreground outline-none appearance-none cursor-pointer focus:ring-1 focus:ring-ring"
    style={{
      backgroundImage:
        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8' fill='none'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%2394a3b8' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E\")",
      backgroundRepeat: "no-repeat",
      backgroundPosition: "right 0.75rem center",
      paddingRight: "2rem",
    }}
  >
    {options.map((o) => (
      <option key={o} value={o} className="bg-card">
        {o}
      </option>
    ))}
  </select>
);

const Donut = ({ percent, pass }: { percent: number; pass: boolean }) => {
  const p = Math.min(100, Math.max(0, percent));
  const color = pass ? "hsl(var(--profit))" : "hsl(var(--destructive))";
  return (
    <div
      className="relative rounded-full flex items-center justify-center flex-shrink-0"
      style={{
        width: 110,
        height: 110,
        background: `conic-gradient(${color} ${p}%, hsl(var(--muted)) ${p}%)`,
      }}
    >
      <div className="rounded-full flex items-center justify-center bg-card" style={{ width: 82, height: 82 }}>
        <span className="font-bold text-lg text-foreground">{p.toFixed(0)}%</span>
      </div>
    </div>
  );
};

export default ConsistencyCalculator;
