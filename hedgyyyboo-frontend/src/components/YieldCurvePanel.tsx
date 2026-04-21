'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

interface CurvePoint {
  maturity: number;
  fitted_yield: number;
  forward_rate: number;
}

interface ObsVsFitted {
  maturity: number;
  observed: number;
  fitted: number;
  residual: number;
}

interface NSSData {
  status: string;
  parameters: {
    b0: number; b1: number; b2: number; b3: number; tau1: number; tau2: number;
  };
  rmse_pct: number;
  fitted_curve: CurvePoint[];
  observed_vs_fitted: ObsVsFitted[];
  interpretation: {
    long_term_rate: number;
    slope_factor: number;
    curvature_factor: number;
    second_hump: number;
    decay_1: number;
    decay_2: number;
    curve_shape: string;
  };
  num_observations: number;
}

export default function YieldCurvePanel() {
  const [data, setData] = useState<NSSData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForward, setShowForward] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/yield-curve/nss`, { method: 'POST' });
      const json = await res.json();
      if (json.status === 'ok') setData(json);
    } catch (e) {
      console.error('NSS fetch failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!data || !canvasRef.current) return;
    const canvas = canvasRef.current;
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

    const curve = data.fitted_curve;
    const obs = data.observed_vs_fitted;

    // Compute bounds
    const allYields = curve.map(p => showForward ? p.forward_rate : p.fitted_yield);
    const obsYields = obs.map(p => p.observed);
    const allY = [...allYields, ...obsYields];
    const minY = Math.min(...allY) - 0.1;
    const maxY = Math.max(...allY) + 0.1;
    const minX = 0;
    const maxX = 30;

    const pad = { top: 15, right: 15, bottom: 25, left: 40 };
    const plotW = W - pad.left - pad.right;
    const plotH = H - pad.top - pad.bottom;

    const xScale = (v: number) => pad.left + ((v - minX) / (maxX - minX)) * plotW;
    const yScale = (v: number) => pad.top + plotH - ((v - minY) / (maxY - minY)) * plotH;

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 0.5;
    const yTicks = 5;
    for (let i = 0; i <= yTicks; i++) {
      const y = pad.top + (i / yTicks) * plotH;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
      const val = maxY - (i / yTicks) * (maxY - minY);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '9px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${val.toFixed(2)}%`, pad.left - 4, y + 3);
    }

    // X-axis labels
    const xLabels = [0, 2, 5, 10, 20, 30];
    ctx.textAlign = 'center';
    for (const t of xLabels) {
      const x = xScale(t);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillText(`${t}Y`, x, H - 5);
      ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, pad.top + plotH); ctx.stroke();
    }

    // Fitted curve
    ctx.beginPath();
    ctx.strokeStyle = showForward ? '#f59e0b' : '#00d4ff';
    ctx.lineWidth = 2;
    ctx.shadowColor = showForward ? '#f59e0b' : '#00d4ff';
    ctx.shadowBlur = 6;
    curve.forEach((p, i) => {
      const x = xScale(p.maturity);
      const y = yScale(showForward ? p.forward_rate : p.fitted_yield);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Fill under curve
    ctx.lineTo(xScale(curve[curve.length - 1].maturity), yScale(minY));
    ctx.lineTo(xScale(curve[0].maturity), yScale(minY));
    ctx.closePath();
    const gradient = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotH);
    gradient.addColorStop(0, showForward ? 'rgba(245,158,11,0.15)' : 'rgba(0,212,255,0.15)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fill();

    // Observed points
    ctx.shadowBlur = 0;
    for (const pt of obs) {
      const x = xScale(pt.maturity);
      const y = yScale(pt.observed);
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#00ff88';
      ctx.fill();
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }, [data, showForward]);

  if (loading) {
    return (
      <div className="panel h-full flex flex-col">
        <div className="panel-header accent-cyan">
          <span>NSS YIELD CURVE FIT</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-hf-cyan/30 border-t-hf-cyan rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="panel h-full flex flex-col">
        <div className="panel-header accent-red">
          <span>NSS YIELD CURVE FIT</span>
        </div>
        <div className="flex-1 flex items-center justify-center text-hf-dim text-[10px]">
          INSUFFICIENT DATA
        </div>
      </div>
    );
  }

  const interp = data.interpretation;

  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header accent-cyan">
        <span>NSS YIELD CURVE FIT</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowForward(!showForward)}
            className={`text-[8px] px-2 py-0.5 rounded border ${
              showForward
                ? 'border-hf-amber/50 text-hf-amber bg-hf-amber/10'
                : 'border-hf-cyan/50 text-hf-cyan bg-hf-cyan/10'
            }`}
          >
            {showForward ? 'FORWARD' : 'SPOT'}
          </button>
          <span className={`text-[8px] px-1.5 py-0.5 rounded ${
            interp.curve_shape.includes('INVERTED') ? 'bg-red-500/20 text-red-400' :
            interp.curve_shape.includes('FLAT') ? 'bg-yellow-500/20 text-yellow-400' :
            'bg-green-500/20 text-green-400'
          }`}>
            {interp.curve_shape}
          </span>
        </div>
      </div>

      <div className="flex-1 relative min-h-0">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      </div>

      <div className="border-t border-terminal-border px-2 py-1.5 grid grid-cols-4 gap-2 text-[9px]">
        <div>
          <span className="text-hf-dim">RMSE</span>
          <div className="text-hf-cyan font-medium">{(data.rmse_pct * 100).toFixed(2)} bps</div>
        </div>
        <div>
          <span className="text-hf-dim">b0 (L-TERM)</span>
          <div className="text-hf-white font-medium">{interp.long_term_rate.toFixed(2)}%</div>
        </div>
        <div>
          <span className="text-hf-dim">SLOPE (b1)</span>
          <div className={`font-medium ${interp.slope_factor > 0 ? 'text-red-400' : 'text-green-400'}`}>
            {interp.slope_factor.toFixed(3)}
          </div>
        </div>
        <div>
          <span className="text-hf-dim">CURVE (b2)</span>
          <div className="text-hf-amber font-medium">{interp.curvature_factor.toFixed(3)}</div>
        </div>
      </div>
    </div>
  );
}
