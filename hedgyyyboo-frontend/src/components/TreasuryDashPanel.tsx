'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

interface FIData {
  yields: Record<string, number | null>;
  yield_history: Record<string, { date: string; yield: number }[]>;
  spreads: Record<string, number | null>;
  inversion_status: string;
  credit: { name: string; symbol: string; price: number; change_pct: number; direction: string }[];
  curve_points: { maturity: number; yield: number }[];
}

export default function TreasuryDashPanel() {
  const [data, setData] = useState<FIData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTenor, setSelectedTenor] = useState<string>('10Y');
  const chartRef = useRef<HTMLCanvasElement>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/fixed-income`);
      const json = await res.json();
      if (json.status === 'ok') setData(json);
    } catch (e) {
      console.error('FI fetch failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); const iv = setInterval(fetchData, 120000); return () => clearInterval(iv); }, [fetchData]);

  // Mini chart for selected tenor
  useEffect(() => {
    if (!data || !chartRef.current) return;
    const history = data.yield_history[selectedTenor];
    if (!history || history.length < 2) return;

    const canvas = chartRef.current;
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

    const yields = history.map(p => p.yield);
    const minY = Math.min(...yields) - 0.05;
    const maxY = Math.max(...yields) + 0.05;

    const pad = 4;
    const plotW = W - pad * 2;
    const plotH = H - pad * 2;

    // Sparkline
    ctx.beginPath();
    const trend = yields[yields.length - 1] >= yields[0];
    ctx.strokeStyle = trend ? '#00ff88' : '#ef4444';
    ctx.lineWidth = 1.5;

    yields.forEach((y, i) => {
      const x = pad + (i / (yields.length - 1)) * plotW;
      const yPos = pad + plotH - ((y - minY) / (maxY - minY)) * plotH;
      if (i === 0) ctx.moveTo(x, yPos);
      else ctx.lineTo(x, yPos);
    });
    ctx.stroke();

    // Gradient fill
    const lastX = pad + plotW;
    const lastY = pad + plotH - ((yields[yields.length - 1] - minY) / (maxY - minY)) * plotH;
    ctx.lineTo(lastX, pad + plotH);
    ctx.lineTo(pad, pad + plotH);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, trend ? 'rgba(0,255,136,0.12)' : 'rgba(239,68,68,0.12)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fill();
  }, [data, selectedTenor]);

  if (loading) {
    return (
      <div className="panel h-full flex flex-col">
        <div className="panel-header accent-green">
          <span>TREASURY YIELDS // LIVE</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-hf-green/30 border-t-hf-green rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const tenors = ['3M', '2Y', '5Y', '10Y', '30Y'];
  const inversion = data.inversion_status;

  return (
    <div className="panel h-full flex flex-col overflow-hidden">
      <div className="panel-header accent-green">
        <span>TREASURY YIELDS // LIVE</span>
        <div className="ml-auto flex items-center gap-2">
          <span className={`text-[8px] px-1.5 py-0.5 rounded font-medium ${
            inversion === 'INVERTED' ? 'bg-red-500/20 text-red-400 animate-pulse' :
            inversion === 'FLAT' ? 'bg-yellow-500/20 text-yellow-400' :
            'bg-green-500/20 text-green-400'
          }`}>
            {inversion}
          </span>
        </div>
      </div>

      {/* Yield table */}
      <div className="px-2 py-1.5">
        <div className="grid grid-cols-5 gap-1">
          {tenors.map(tenor => {
            const y = data.yields[tenor];
            const isSelected = selectedTenor === tenor;
            return (
              <button
                key={tenor}
                onClick={() => setSelectedTenor(tenor)}
                className={`text-center py-1.5 rounded border transition-all ${
                  isSelected
                    ? 'border-hf-cyan/50 bg-hf-cyan/10'
                    : 'border-terminal-border hover:border-terminal-border/60 bg-transparent'
                }`}
              >
                <div className="text-[8px] text-hf-dim tracking-wider">{tenor}</div>
                <div className={`text-sm font-bold ${y !== null ? 'text-hf-white' : 'text-hf-dim'}`}>
                  {y !== null ? `${y.toFixed(2)}%` : 'N/A'}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mini chart */}
      <div className="flex-1 relative min-h-0 px-2 flex flex-col">
        <div className="text-[8px] text-hf-dim shrink-0">{selectedTenor} YIELD — 3M HISTORY</div>
        <div className="flex-1 min-h-0 relative">
          <canvas ref={chartRef} className="absolute inset-0 w-full h-full" />
        </div>
      </div>

      {/* Spreads */}
      <div className="border-t border-terminal-border px-2 py-1.5">
        <div className="text-[8px] text-hf-dim mb-1 tracking-wider">KEY SPREADS</div>
        <div className="grid grid-cols-4 gap-2">
          {Object.entries(data.spreads).map(([name, val]) => (
            <div key={name}>
              <div className="text-[7px] text-hf-dim uppercase">{name}</div>
              <div className={`text-[10px] font-bold ${
                val === null ? 'text-hf-dim' :
                val < 0 ? 'text-red-400' :
                val < 0.15 ? 'text-yellow-400' :
                'text-green-400'
              }`}>
                {val !== null ? `${(val * 100).toFixed(0)}bps` : 'N/A'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Credit ETFs */}
      <div className="border-t border-terminal-border px-2 py-1.5">
        <div className="text-[8px] text-hf-dim mb-1 tracking-wider">CREDIT MARKETS</div>
        <div className="space-y-0.5">
          {data.credit.map(c => (
            <div key={c.name} className="flex items-center justify-between text-[9px]">
              <span className="text-hf-dim">{c.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-hf-white">${c.price.toFixed(2)}</span>
                <span className={c.change_pct >= 0 ? 'text-green-400' : 'text-red-400'}>
                  {c.change_pct >= 0 ? '+' : ''}{c.change_pct.toFixed(2)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
