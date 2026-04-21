'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

interface SwaptionData {
  status: string;
  swaption_price: number;
  swaption_price_bps: number;
  standard_error: number;
  delta_01: number;
  params: {
    r0_pct: number;
    mean_reversion: number;
    volatility: number;
    fixed_rate_pct: number;
    option_expiry: number;
    swap_tenor: number;
    notional: number;
  };
  num_paths: number;
  num_steps: number;
  device_used: string;
  computation_time_ms: number;
  sample_paths: number[][];
  rate_distribution: {
    bins: number[];
    counts: number[];
    mean: number;
    std: number;
    percentile_5: number;
    percentile_95: number;
  };
}

export default function SwaptionPanel() {
  const [data, setData] = useState<SwaptionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expiry, setExpiry] = useState(1);
  const [tenor, setTenor] = useState(5);
  const pathsRef = useRef<HTMLCanvasElement>(null);
  const distRef = useRef<HTMLCanvasElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${API}/api/swaption/price?option_expiry=${expiry}&swap_tenor=${tenor}&num_paths=50000`,
        { method: 'POST' }
      );
      const json = await res.json();
      if (json.status === 'ok') setData(json);
    } catch (e) {
      console.error('Swaption fetch failed:', e);
    } finally {
      setLoading(false);
    }
  }, [expiry, tenor]);

  // Draw sample paths
  useEffect(() => {
    if (!data || !pathsRef.current) return;
    const canvas = pathsRef.current;
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

    const paths = data.sample_paths;
    if (!paths.length) return;

    const allRates = paths.flat();
    const minR = Math.min(...allRates) - 0.1;
    const maxR = Math.max(...allRates) + 0.1;
    const pad = { top: 8, right: 8, bottom: 20, left: 32 };
    const plotW = W - pad.left - pad.right;
    const plotH = H - pad.top - pad.bottom;

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (i / 4) * plotH;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
      const val = maxR - (i / 4) * (maxR - minR);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '8px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${val.toFixed(1)}%`, pad.left - 3, y + 3);
    }

    // Strike line
    const strikeY = pad.top + plotH - ((data.params.fixed_rate_pct - minR) / (maxR - minR)) * plotH;
    ctx.strokeStyle = 'rgba(239,68,68,0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(pad.left, strikeY); ctx.lineTo(W - pad.right, strikeY); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(239,68,68,0.6)';
    ctx.font = '7px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`K=${data.params.fixed_rate_pct.toFixed(2)}%`, W - pad.right - 45, strikeY - 3);

    // Expiry line
    const expiryX = pad.left + (data.params.option_expiry / (data.params.option_expiry + data.params.swap_tenor)) * plotW;
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.setLineDash([2, 3]);
    ctx.beginPath(); ctx.moveTo(expiryX, pad.top); ctx.lineTo(expiryX, pad.top + plotH); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '7px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('EXPIRY', expiryX, pad.top + plotH + 12);

    // Draw paths
    const colors = ['#00d4ff', '#00ff88', '#f59e0b', '#ef4444', '#a855f7'];
    paths.forEach((path, idx) => {
      ctx.beginPath();
      ctx.strokeStyle = colors[idx % colors.length];
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.6;
      path.forEach((rate, i) => {
        const x = pad.left + (i / (path.length - 1)) * plotW;
        const y = pad.top + plotH - ((rate - minR) / (maxR - minR)) * plotH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }, [data]);

  // Draw rate distribution
  useEffect(() => {
    if (!data || !distRef.current) return;
    const canvas = distRef.current;
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

    const dist = data.rate_distribution;
    const maxCount = Math.max(...dist.counts);
    const pad = { top: 5, right: 5, bottom: 15, left: 5 };
    const plotW = W - pad.left - pad.right;
    const plotH = H - pad.top - pad.bottom;
    const barW = plotW / dist.bins.length;

    dist.bins.forEach((bin, i) => {
      const count = dist.counts[i];
      const barH = (count / maxCount) * plotH;
      const x = pad.left + i * barW;
      const y = pad.top + plotH - barH;

      // Color by distance from mean
      const distFromMean = Math.abs(bin - dist.mean);
      const alpha = distFromMean > dist.std * 2 ? 0.9 : distFromMean > dist.std ? 0.6 : 0.4;
      ctx.fillStyle = distFromMean > dist.std * 2 ? `rgba(239,68,68,${alpha})` :
                       distFromMean > dist.std ? `rgba(245,158,11,${alpha})` :
                       `rgba(0,212,255,${alpha})`;
      ctx.fillRect(x, y, barW - 1, barH);
    });

    // Mean line
    const meanX = pad.left + ((dist.mean - dist.bins[0]) / (dist.bins[dist.bins.length - 1] - dist.bins[0])) * plotW;
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 2]);
    ctx.beginPath(); ctx.moveTo(meanX, pad.top); ctx.lineTo(meanX, pad.top + plotH); ctx.stroke();
    ctx.setLineDash([]);

    // Labels
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '7px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${dist.bins[0].toFixed(1)}%`, pad.left, H - 2);
    ctx.fillText(`${dist.bins[dist.bins.length - 1].toFixed(1)}%`, W - pad.right, H - 2);
  }, [data]);

  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header accent-amber">
        <span>HULL-WHITE SWAPTION // MONTE CARLO</span>
        <div className="ml-auto flex items-center gap-2">
          {data && (
            <span className="text-[8px] text-hf-dim">
              {data.device_used.toUpperCase()} • {data.computation_time_ms.toFixed(0)}ms
            </span>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="px-2 py-1.5 border-b border-terminal-border flex items-center gap-3">
        <div className="flex items-center gap-1">
          <span className="text-[8px] text-hf-dim">EXPIRY</span>
          {[0.5, 1, 2, 5].map(e => (
            <button
              key={e}
              onClick={() => setExpiry(e)}
              className={`text-[8px] px-1.5 py-0.5 rounded border ${
                expiry === e ? 'border-hf-amber/50 text-hf-amber bg-hf-amber/10' : 'border-terminal-border text-hf-dim'
              }`}
            >
              {e}Y
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[8px] text-hf-dim">TENOR</span>
          {[2, 5, 10].map(t => (
            <button
              key={t}
              onClick={() => setTenor(t)}
              className={`text-[8px] px-1.5 py-0.5 rounded border ${
                tenor === t ? 'border-hf-amber/50 text-hf-amber bg-hf-amber/10' : 'border-terminal-border text-hf-dim'
              }`}
            >
              {t}Y
            </button>
          ))}
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="ml-auto text-[8px] px-3 py-1 rounded border border-hf-amber/50 text-hf-amber hover:bg-hf-amber/10 disabled:opacity-50"
        >
          {loading ? 'PRICING...' : 'PRICE'}
        </button>
      </div>

      {loading && !data ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-hf-amber/30 border-t-hf-amber rounded-full animate-spin" />
            <span className="text-[9px] text-hf-dim">SIMULATING {expiry}Y x {tenor}Y SWAPTION...</span>
          </div>
        </div>
      ) : data ? (
        <>
          {/* Stats row */}
          <div className="px-2 py-2 grid grid-cols-4 gap-2 border-b border-terminal-border">
            <div className="text-center">
              <div className="text-[7px] text-hf-dim">PRICE</div>
              <div className="text-lg font-bold text-hf-amber">${(data.swaption_price / 1000).toFixed(1)}K</div>
              <div className="text-[8px] text-hf-dim">{data.swaption_price_bps.toFixed(1)} bps</div>
            </div>
            <div className="text-center">
              <div className="text-[7px] text-hf-dim">DV01</div>
              <div className="text-sm font-bold text-hf-white">${Math.abs(data.delta_01).toFixed(2)}</div>
            </div>
            <div className="text-center">
              <div className="text-[7px] text-hf-dim">STD ERR</div>
              <div className="text-sm font-bold text-hf-dim">${data.standard_error.toFixed(0)}</div>
            </div>
            <div className="text-center">
              <div className="text-[7px] text-hf-dim">PATHS</div>
              <div className="text-sm font-bold text-hf-white">{(data.num_paths / 1000).toFixed(0)}K</div>
            </div>
          </div>

          {/* Charts */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 relative min-h-0 px-1 flex flex-col">
              <div className="text-[7px] text-hf-dim px-1 pt-1 shrink-0">SHORT RATE PATHS (r(t))</div>
              <div className="flex-1 min-h-0 relative">
                <canvas ref={pathsRef} className="absolute inset-0 w-full h-full" />
              </div>
            </div>
            <div className="shrink-0 h-[60px] relative px-1 border-t border-terminal-border flex flex-col">
              <div className="text-[7px] text-hf-dim px-1 pt-0.5 shrink-0">
                RATE DIST @ EXPIRY — μ={data.rate_distribution.mean.toFixed(2)}% σ={data.rate_distribution.std.toFixed(2)}%
              </div>
              <div className="flex-1 min-h-0 relative">
                <canvas ref={distRef} className="absolute inset-0 w-full h-full" />
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <button
            onClick={fetchData}
            className="px-6 py-3 rounded border border-hf-amber/50 text-hf-amber hover:bg-hf-amber/10 text-xs"
          >
            PRICE SWAPTION
          </button>
        </div>
      )}
    </div>
  );
}
