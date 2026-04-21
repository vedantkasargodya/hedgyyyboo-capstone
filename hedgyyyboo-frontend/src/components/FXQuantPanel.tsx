'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

interface OUResult {
  pair?: string;
  spot_price?: number;
  half_life_days: number;
  kappa: number;
  mu: number;
  sigma: number;
  is_mean_reverting: boolean;
  t_stat: number;
}

interface HurstResult {
  pair?: string;
  hurst_exponent: number;
  roughness_label: string;
  interpretation: string;
}

interface NeuralSDEResult {
  pair?: string;
  learned_drift: number;
  learned_diffusion: number;
  drift_direction: string;
  final_loss: number;
  sample_forward_paths?: number[][];
}

export default function FXQuantPanel() {
  const [pair, setPair] = useState('EUR/USD');
  const [ou, setOU] = useState<OUResult | null>(null);
  const [hurst, setHurst] = useState<HurstResult | null>(null);
  const [nsde, setNSDE] = useState<NeuralSDEResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'ou' | 'hurst' | 'nsde'>('ou');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const pairs = ['EUR/USD', 'USD/JPY', 'GBP/USD', 'USD/INR', 'AUD/USD', 'USD/CHF'];

  const runQuant = useCallback(async () => {
    setLoading(true);
    try {
      // Run OU + Hurst in parallel first (fast), then Neural SDE (slow ~5s)
      const [ouRes, hurstRes] = await Promise.all([
        fetch(`${API}/api/fx/ou-mle`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pair }),
        }).then(r => r.json()).catch(() => null),
        fetch(`${API}/api/fx/hurst`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pair }),
        }).then(r => r.json()).catch(() => null),
      ]);
      if (ouRes?.status === 'ok') setOU(ouRes);
      if (hurstRes?.status === 'ok') setHurst(hurstRes);

      // Neural SDE takes longer — run separately with extended timeout
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        const nsdeRes = await fetch(`${API}/api/fx/neural-sde`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pair }),
          signal: controller.signal,
        }).then(r => r.json());
        clearTimeout(timeout);
        if (nsdeRes?.status === 'ok') setNSDE(nsdeRes);
      } catch (nsdeErr) {
        console.warn('Neural SDE timed out or failed:', nsdeErr);
      }
    } catch (e) {
      console.error('Quant engine failed:', e);
    } finally {
      setLoading(false);
    }
  }, [pair]);

  // Draw neural SDE forward paths
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !nsde?.sample_forward_paths?.length || activeTab !== 'nsde') return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width;
    const H = rect.height;
    ctx.clearRect(0, 0, W, H);

    const paths = nsde.sample_forward_paths;
    const allVals = paths.flat();
    const min = Math.min(...allVals);
    const max = Math.max(...allVals);
    const range = max - min || 1;
    const pad = 8;

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 4; i++) {
      const y = pad + (i / 3) * (H - pad * 2);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    const colors = ['#00d4ff', '#00ff88', '#f59e0b', '#ef4444', '#a855f7'];
    paths.forEach((path, idx) => {
      ctx.beginPath();
      for (let i = 0; i < path.length; i++) {
        const x = (i / (path.length - 1)) * W;
        const y = pad + (1 - (path[i] - min) / range) * (H - pad * 2);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = colors[idx % colors.length];
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.7;
      ctx.stroke();
      ctx.globalAlpha = 1;
    });

    // Label
    ctx.fillStyle = '#666';
    ctx.font = '8px monospace';
    ctx.fillText('FORWARD SIMULATION', 4, H - 4);
  }, [nsde, activeTab]);

  const driftColor = nsde?.drift_direction === 'BULLISH' ? '#00ff88' : nsde?.drift_direction === 'BEARISH' ? '#ef4444' : '#888';

  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header accent-cyan">
        <span>FX QUANT ENGINE</span>
        <span className="ml-auto text-[8px] text-hf-dim">OU + HURST + NEURAL SDE</span>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2">
        {/* Pair selector + Run */}
        <div className="flex items-center gap-1">
          <select
            value={pair}
            onChange={(e) => setPair(e.target.value)}
            className="bg-terminal-dark border border-terminal-border rounded px-2 py-1 text-[9px] text-hf-white font-mono flex-1"
          >
            {pairs.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <button
            onClick={runQuant}
            disabled={loading}
            className="px-3 py-1 bg-hf-cyan/20 border border-hf-cyan/40 rounded text-[9px] text-hf-cyan font-bold hover:bg-hf-cyan/30 disabled:opacity-50 transition-all"
          >
            {loading ? 'RUNNING...' : 'ANALYSE'}
          </button>
        </div>

        {/* Tab selector */}
        <div className="flex gap-1">
          {(['ou', 'hurst', 'nsde'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-1 rounded text-[8px] font-bold tracking-wider transition-all ${
                activeTab === tab
                  ? 'bg-hf-cyan/20 border border-hf-cyan/40 text-hf-cyan'
                  : 'bg-terminal-dark/50 border border-terminal-border text-hf-dim hover:text-hf-white'
              }`}
            >
              {tab === 'ou' ? 'OU MLE' : tab === 'hurst' ? 'HURST' : 'NEURAL SDE'}
            </button>
          ))}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-hf-cyan/30 border-t-hf-cyan rounded-full animate-spin" />
          </div>
        )}

        {/* OU Tab */}
        {!loading && activeTab === 'ou' && ou && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-terminal-dark/50 rounded p-2 text-center">
                <div className="text-[7px] text-hf-dim">HALF-LIFE</div>
                <div className="text-lg font-bold text-hf-cyan font-mono">{ou.half_life_days.toFixed(1)}d</div>
              </div>
              <div className="bg-terminal-dark/50 rounded p-2 text-center">
                <div className="text-[7px] text-hf-dim">MEAN-REVERTING</div>
                <div className={`text-lg font-bold font-mono ${ou.is_mean_reverting ? 'text-hf-green' : 'text-red-400'}`}>
                  {ou.is_mean_reverting ? 'YES' : 'NO'}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <div className="text-center">
                <div className="text-[7px] text-hf-dim">&kappa; (SPEED)</div>
                <div className="text-[10px] font-mono text-hf-white">{ou.kappa.toFixed(4)}</div>
              </div>
              <div className="text-center">
                <div className="text-[7px] text-hf-dim">&mu; (MEAN)</div>
                <div className="text-[10px] font-mono text-hf-white">{ou.mu.toFixed(6)}</div>
              </div>
              <div className="text-center">
                <div className="text-[7px] text-hf-dim">&sigma;</div>
                <div className="text-[10px] font-mono text-hf-white">{ou.sigma.toFixed(6)}</div>
              </div>
            </div>
            <div className="text-center">
              <div className="text-[7px] text-hf-dim">T-STATISTIC</div>
              <div className="text-[10px] font-mono text-hf-white">{ou.t_stat?.toFixed(3) ?? '-'}</div>
            </div>
            <div className="border-t border-terminal-border pt-2 text-[8px] text-hf-dim">
              <strong className="text-hf-cyan">OU PROCESS:</strong> Mean-reversion speed &kappa;={ou.kappa?.toFixed(4) ?? '-'},
              half-life {ou.half_life_days?.toFixed(1) ?? '-'} days.
              {ou.is_mean_reverting
                ? ` Statistically significant (|t|=${Math.abs(ou.t_stat ?? 0).toFixed(2)} > 1.96). Pair reverts to log-mean ${ou.mu?.toFixed(4) ?? '-'}.`
                : ' Not statistically significant at 95% level.'}
            </div>
          </div>
        )}

        {/* Hurst Tab */}
        {!loading && activeTab === 'hurst' && hurst && (
          <div className="space-y-2">
            <div className="text-center">
              <div className="text-[7px] text-hf-dim tracking-wider">HURST EXPONENT (H)</div>
              <div className="text-3xl font-bold text-hf-cyan font-mono">{hurst.hurst_exponent.toFixed(4)}</div>
              <div
                className="inline-block mt-1 px-2 py-0.5 rounded text-[8px] font-bold"
                style={{
                  backgroundColor: hurst.hurst_exponent < 0.4 ? 'rgba(239,68,68,0.2)' :
                    hurst.hurst_exponent < 0.5 ? 'rgba(245,158,11,0.2)' :
                    hurst.hurst_exponent < 0.6 ? 'rgba(136,136,136,0.2)' : 'rgba(0,255,136,0.2)',
                  color: hurst.hurst_exponent < 0.4 ? '#ef4444' :
                    hurst.hurst_exponent < 0.5 ? '#f59e0b' :
                    hurst.hurst_exponent < 0.6 ? '#888' : '#00ff88',
                  border: `1px solid ${
                    hurst.hurst_exponent < 0.4 ? 'rgba(239,68,68,0.3)' :
                    hurst.hurst_exponent < 0.5 ? 'rgba(245,158,11,0.3)' :
                    hurst.hurst_exponent < 0.6 ? 'rgba(136,136,136,0.3)' : 'rgba(0,255,136,0.3)'
                  }`,
                }}
              >
                {hurst.roughness_label}
              </div>
            </div>

            {/* Hurst scale bar */}
            <div className="relative h-3 bg-terminal-dark rounded-full overflow-hidden">
              <div className="absolute inset-0 flex">
                <div className="flex-1 bg-red-500/20" />
                <div className="flex-1 bg-amber-500/20" />
                <div className="flex-1 bg-gray-500/20" />
                <div className="flex-1 bg-green-500/20" />
              </div>
              <div
                className="absolute top-0 w-0.5 h-full bg-white"
                style={{ left: `${Math.min(100, hurst.hurst_exponent * 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-[7px] text-hf-dim">
              <span>ROUGH (H&lt;0.4)</span>
              <span>RANDOM (H=0.5)</span>
              <span>SMOOTH (H&gt;0.6)</span>
            </div>

            <div className="border-t border-terminal-border pt-2 text-[8px] text-hf-dim">
              <strong className="text-hf-cyan">INTERPRETATION:</strong> {hurst.interpretation}
            </div>
          </div>
        )}

        {/* Neural SDE Tab */}
        {!loading && activeTab === 'nsde' && nsde && (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-terminal-dark/50 rounded p-2 text-center">
                <div className="text-[7px] text-hf-dim">DRIFT</div>
                <div className="text-sm font-bold font-mono" style={{ color: driftColor }}>
                  {nsde.learned_drift.toFixed(4)}
                </div>
              </div>
              <div className="bg-terminal-dark/50 rounded p-2 text-center">
                <div className="text-[7px] text-hf-dim">DIFFUSION</div>
                <div className="text-sm font-bold font-mono text-hf-white">
                  {nsde.learned_diffusion.toFixed(4)}
                </div>
              </div>
              <div className="bg-terminal-dark/50 rounded p-2 text-center">
                <div className="text-[7px] text-hf-dim">DIRECTION</div>
                <div className="text-sm font-bold font-mono" style={{ color: driftColor }}>
                  {nsde.drift_direction}
                </div>
              </div>
            </div>

            <div className="text-center text-[8px] text-hf-dim">
              TRAINING LOSS: <span className="text-hf-white font-mono">{nsde.final_loss.toFixed(6)}</span>
            </div>

            {/* Forward paths canvas */}
            {nsde.sample_forward_paths && nsde.sample_forward_paths.length > 0 && (
              <div className="h-[120px]">
                <canvas ref={canvasRef} className="w-full h-full" />
              </div>
            )}

            <div className="border-t border-terminal-border pt-2 text-[8px] text-hf-dim">
              <strong className="text-hf-cyan">NEURAL SDE:</strong> Neural network learned drift f(t,X)={nsde.learned_drift.toFixed(4)} and
              diffusion g(t,X)={nsde.learned_diffusion.toFixed(4)}. Market signal: <strong style={{ color: driftColor }}>{nsde.drift_direction}</strong>.
            </div>
          </div>
        )}

        {!loading && !ou && !hurst && !nsde && (
          <div className="flex-1 flex items-center justify-center text-hf-dim text-[10px] py-8">
            SELECT A PAIR AND CLICK ANALYSE
          </div>
        )}
      </div>
    </div>
  );
}
