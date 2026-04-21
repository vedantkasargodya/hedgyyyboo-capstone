'use client';

import { useState, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

const API_BASE = 'http://localhost:8001';

interface SamplePath {
  step: number;
  price: number;
}

interface MonteCarloResult {
  option_type: string;
  barrier_type: string;
  spot: number;
  strike: number;
  barrier: number;
  implied_vol: number;
  maturity: number;
  risk_free_rate: number;
  option_price: number;
  standard_error: number;
  knockout_pct: number;
  num_paths: number;
  num_steps: number;
  device: string;
  computation_time_ms: number;
  sample_paths: SamplePath[][];
}

const PROGRESS_STEPS = [
  'Initializing simulation engine...',
  'Generating random paths...',
  'Simulating barrier crossings...',
  'Computing option payoffs...',
  'Aggregating results...',
];

const PATH_COLORS = ['#00ff00', '#00d4ff', '#ffaa00', '#ff0033', '#aa44ff'];

function deviceBadgeClass(device: string): string {
  const d = device.toLowerCase();
  if (d.includes('gpu') || d.includes('cuda')) return 'bg-hf-green/10 border-hf-green/40 text-hf-green';
  if (d.includes('mps')) return 'bg-hf-cyan/10 border-hf-cyan/40 text-hf-cyan';
  return 'bg-hf-amber/10 border-hf-amber/40 text-hf-amber';
}

export default function MonteCarloPanel() {
  const [loading, setLoading] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [result, setResult] = useState<MonteCarloResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runSimulation = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setProgressStep(0);

    // Animate progress steps
    const stepIntervals: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i < PROGRESS_STEPS.length; i++) {
      stepIntervals.push(
        setTimeout(() => setProgressStep(i), i * 800)
      );
    }

    try {
      const res = await fetch(`${API_BASE}/api/monte-carlo/barrier`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(errBody || `HTTP ${res.status}`);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await res.json() as any;
      // Normalize API response field names
      setResult({
        option_type: data.option_type || 'Down-and-Out Barrier Put',
        barrier_type: data.barrier_type || 'Down-and-Out',
        spot: data.spot_price ?? data.spot ?? 0,
        strike: data.strike ?? 0,
        barrier: data.barrier ?? 0,
        implied_vol: data.iv_used ?? data.implied_vol ?? 0,
        maturity: data.maturity ?? 0,
        risk_free_rate: data.risk_free_rate ?? 0.05,
        option_price: data.option_price ?? 0,
        standard_error: data.standard_error ?? 0,
        knockout_pct: data.knockout_pct ?? data.paths_knocked_out_pct ?? 0,
        num_paths: data.num_paths ?? 100000,
        num_steps: data.num_steps ?? 63,
        device: data.device_used ?? data.device ?? 'cpu',
        computation_time_ms: data.computation_time_ms ?? 0,
        sample_paths: data.sample_paths ?? [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Simulation failed');
    } finally {
      setLoading(false);
      stepIntervals.forEach(clearTimeout);
    }
  }, []);

  // Build chart data from sample paths
  const chartData = result?.sample_paths
    ? (() => {
        const maxLen = Math.max(...result.sample_paths.map((p) => p.length));
        const rows: Record<string, number>[] = [];
        for (let step = 0; step < maxLen; step++) {
          const row: Record<string, number> = { step };
          result.sample_paths.forEach((path, pi) => {
            if (step < path.length) {
              row[`path${pi}`] = path[step].price;
            }
          });
          rows.push(row);
        }
        return rows;
      })()
    : [];

  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header accent-green">
        <span>OTC BARRIER PRICER // MONTE CARLO</span>
        <div className="ml-auto flex items-center gap-2">
          {result && (
            <span className={`text-[7px] font-bold px-1.5 py-0.5 rounded border tracking-wider ${deviceBadgeClass(result.device)}`}>
              {result.device.toUpperCase()}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 p-3 overflow-y-auto">
        {/* Initial state: price button */}
        {!loading && !result && !error && (
          <div className="h-full flex flex-col items-center justify-center gap-4">
            <div className="text-center">
              <div className="text-[10px] text-hf-dim tracking-widest mb-1">
                BARRIER OPTION SIMULATION
              </div>
              <div className="text-[8px] text-terminal-muted tracking-wider">
                100K PATHS // GPU ACCELERATED
              </div>
            </div>
            <button
              onClick={runSimulation}
              className="px-6 py-2.5 bg-hf-green/10 border border-hf-green/30 rounded text-[10px] font-bold text-hf-green tracking-widest hover:bg-hf-green/20 hover:border-hf-green/50 hover:shadow-[0_0_15px_rgba(0,255,0,0.15)] transition-all"
            >
              PRICE BARRIER OPTION
            </button>
          </div>
        )}

        {/* Loading state with step indicators */}
        {loading && (
          <div className="space-y-3 py-4">
            {PROGRESS_STEPS.map((step, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 transition-all duration-300 ${
                  i <= progressStep ? 'opacity-100' : 'opacity-20'
                }`}
              >
                {i < progressStep ? (
                  <div className="w-3 h-3 rounded-full bg-hf-green/20 border border-hf-green/50 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-hf-green" />
                  </div>
                ) : i === progressStep ? (
                  <div className="w-3 h-3 rounded-full border border-hf-amber/50 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-hf-amber animate-pulse" />
                  </div>
                ) : (
                  <div className="w-3 h-3 rounded-full border border-terminal-border" />
                )}
                <span
                  className={`text-[10px] tracking-wider ${
                    i <= progressStep
                      ? i === progressStep
                        ? 'text-hf-amber'
                        : 'text-hf-green'
                      : 'text-hf-dim'
                  }`}
                >
                  {step}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="space-y-3">
            <div className="bg-hf-red/5 border border-hf-red/20 rounded p-3">
              <span className="text-[10px] text-hf-red tracking-wider">
                ERROR: {error}
              </span>
            </div>
            <button
              onClick={runSimulation}
              className="px-4 py-2 bg-hf-green/10 border border-hf-green/30 rounded text-[10px] font-bold text-hf-green tracking-widest hover:bg-hf-green/20 transition-all"
            >
              RETRY
            </button>
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div className="space-y-3 animate-fade-in">
            {/* Option parameters */}
            <div className="grid grid-cols-3 gap-1.5">
              <ParamCell label="SPOT" value={`$${result.spot.toFixed(2)}`} />
              <ParamCell label="STRIKE" value={`$${result.strike.toFixed(2)}`} />
              <ParamCell label="BARRIER" value={`$${result.barrier.toFixed(2)}`} />
              <ParamCell label="IV" value={`${(result.implied_vol * 100).toFixed(1)}%`} />
              <ParamCell label="MATURITY" value={`${result.maturity}Y`} />
              <ParamCell label="RATE" value={`${(result.risk_free_rate * 100).toFixed(1)}%`} />
            </div>

            {/* Price result */}
            <div className="flex items-center gap-3 p-2.5 bg-hf-green/5 border border-hf-green/20 rounded">
              <div className="flex-1">
                <div className="text-[8px] text-hf-dim tracking-widest mb-0.5">OPTION PRICE</div>
                <div className="text-xl font-bold text-hf-green tabular-nums">
                  ${result.option_price.toFixed(4)}
                </div>
              </div>
              <div className="text-right space-y-1">
                <div className="text-[8px] text-hf-dim tracking-wider">
                  SE: <span className="text-hf-white font-bold">${result.standard_error.toFixed(4)}</span>
                </div>
                <div className="text-[8px] text-hf-dim tracking-wider">
                  KO: <span className="text-hf-red font-bold">{(result.knockout_pct * 100).toFixed(1)}%</span>
                </div>
                <div className="text-[8px] text-hf-dim tracking-wider">
                  TIME: <span className="text-hf-cyan font-bold">{result.computation_time_ms.toFixed(0)}ms</span>
                </div>
              </div>
            </div>

            {/* Sample Paths Chart */}
            {result.sample_paths && result.sample_paths.length > 0 && (
              <div>
                <div className="text-[8px] text-hf-dim tracking-widest mb-1.5">
                  SAMPLE PATHS ({result.sample_paths.length})
                </div>
                <div className="h-[100px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#1a1a1a"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="step"
                        tick={false}
                        axisLine={{ stroke: '#333' }}
                      />
                      <YAxis
                        tick={{ fill: '#444', fontSize: 8, fontFamily: 'JetBrains Mono' }}
                        axisLine={false}
                        tickLine={false}
                        domain={['auto', 'auto']}
                        tickFormatter={(v: number) => `$${v.toFixed(0)}`}
                        width={35}
                      />
                      <Tooltip
                        contentStyle={{
                          background: '#111',
                          border: '1px solid #333',
                          borderRadius: 4,
                          fontSize: 9,
                          fontFamily: 'JetBrains Mono',
                          color: '#e0e0e0',
                        }}
                        formatter={(value: number) => [`$${value.toFixed(2)}`, '']}
                        labelFormatter={() => ''}
                      />
                      {/* Barrier line */}
                      <ReferenceLine
                        y={result.barrier}
                        stroke="#ff0033"
                        strokeDasharray="6 3"
                        strokeWidth={1.5}
                        label={{
                          value: `BARRIER $${result.barrier.toFixed(0)}`,
                          position: 'right',
                          fill: '#ff0033',
                          fontSize: 7,
                          fontFamily: 'JetBrains Mono',
                        }}
                      />
                      {/* Strike line */}
                      <ReferenceLine
                        y={result.strike}
                        stroke="#ffaa00"
                        strokeDasharray="3 3"
                        strokeWidth={1}
                        label={{
                          value: `K=$${result.strike.toFixed(0)}`,
                          position: 'left',
                          fill: '#ffaa00',
                          fontSize: 7,
                          fontFamily: 'JetBrains Mono',
                        }}
                      />
                      {/* Sample path lines */}
                      {result.sample_paths.map((_, pi) => (
                        <Line
                          key={`path-${pi}`}
                          type="monotone"
                          dataKey={`path${pi}`}
                          stroke={PATH_COLORS[pi % PATH_COLORS.length]}
                          strokeWidth={1}
                          dot={false}
                          strokeOpacity={0.7}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Re-run button */}
            <div className="flex items-center justify-between pt-2 border-t border-terminal-border">
              <div className="flex items-center gap-2">
                <span className={`text-[7px] font-bold px-1.5 py-0.5 rounded border tracking-wider ${deviceBadgeClass(result.device)}`}>
                  {result.device.toUpperCase()}
                </span>
                <span className="text-[8px] text-hf-dim tracking-wider">
                  {result.num_paths.toLocaleString()} PATHS
                </span>
              </div>
              <button
                onClick={runSimulation}
                className="px-3 py-1.5 bg-hf-green/10 border border-hf-green/30 rounded text-[8px] font-bold text-hf-green tracking-widest hover:bg-hf-green/20 transition-all"
              >
                RE-PRICE
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ========== Small param cell ========== */
function ParamCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-terminal-black/50 border border-terminal-border rounded px-2 py-1.5 text-center">
      <div className="text-[7px] text-hf-dim tracking-widest">{label}</div>
      <div className="text-[10px] text-hf-white font-bold tabular-nums mt-0.5">{value}</div>
    </div>
  );
}
