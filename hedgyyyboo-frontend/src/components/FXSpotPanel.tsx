'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

interface FXPair {
  pair: string;
  price: number;
  change: number;
  change_pct: number;
  direction: string;
  sparkline: number[];
}

export default function FXSpotPanel() {
  const [pairs, setPairs] = useState<FXPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPair, setSelectedPair] = useState<string>('EUR/USD');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/fx/spot`);
      const json = await res.json();
      if (json.pairs) setPairs(json.pairs);
    } catch (e) {
      console.error('FX spot fetch failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); const iv = setInterval(fetchData, 30000); return () => clearInterval(iv); }, [fetchData]);

  // Draw sparkline for selected pair
  useEffect(() => {
    const canvas = canvasRef.current;
    const pair = pairs.find(p => p.pair === selectedPair);
    if (!canvas || !pair || !pair.sparkline.length) return;

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

    const data = pair.sparkline;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const padY = 10;

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 5; i++) {
      const y = padY + (i / 4) * (H - padY * 2);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // Line
    const isUp = data[data.length - 1] >= data[0];
    const color = isUp ? '#00ff88' : '#ef4444';

    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const x = (i / (data.length - 1)) * W;
      const y = padY + (1 - (data[i] - min) / range) * (H - padY * 2);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Gradient fill
    const lastX = W;
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, isUp ? 'rgba(0,255,136,0.15)' : 'rgba(239,68,68,0.15)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.lineTo(lastX, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Current price line
    const curY = padY + (1 - (data[data.length - 1] - min) / range) * (H - padY * 2);
    ctx.setLineDash([2, 2]);
    ctx.strokeStyle = `${color}60`;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, curY);
    ctx.lineTo(W, curY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Price label
    ctx.fillStyle = color;
    ctx.font = '9px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(data[data.length - 1].toFixed(4), W - 4, curY - 4);

  }, [pairs, selectedPair]);

  if (loading) {
    return (
      <div className="panel h-full flex flex-col">
        <div className="panel-header accent-green">
          <span>FX SPOT RATES // LIVE</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-hf-green/30 border-t-hf-green rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header accent-green">
        <span>FX SPOT RATES // LIVE</span>
        <span className="ml-auto text-[8px] text-hf-dim">{pairs.length} PAIRS</span>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Pair selector row */}
        <div className="px-2 pt-2 flex gap-1 flex-wrap max-h-[80px] overflow-y-auto shrink-0">
          {pairs.map((p) => {
            const isActive = p.pair === selectedPair;
            const isUp = p.change_pct >= 0;
            return (
              <button
                key={p.pair}
                onClick={() => setSelectedPair(p.pair)}
                className={`px-2 py-1 rounded text-[9px] font-mono transition-all ${
                  isActive
                    ? 'bg-hf-green/20 border border-hf-green/40 text-hf-green'
                    : 'bg-terminal-dark/50 border border-terminal-border text-hf-dim hover:text-hf-white hover:border-hf-green/30'
                }`}
              >
                <div className="font-bold">{p.pair}</div>
                <div className={isUp ? 'text-hf-green' : 'text-red-400'}>
                  {p.price.toFixed(p.pair.includes('JPY') ? 2 : 4)}
                </div>
              </button>
            );
          })}
        </div>

        {/* Sparkline chart */}
        <div className="px-2 pt-2 flex-1 min-h-0">
          <canvas ref={canvasRef} className="w-full h-full" />
        </div>

        {/* Selected pair details */}
        {(() => {
          const p = pairs.find(x => x.pair === selectedPair);
          if (!p) return null;
          const isUp = p.change_pct >= 0;
          return (
            <div className="px-2 pb-2">
              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <div className="text-[7px] text-hf-dim">PRICE</div>
                  <div className="text-[11px] font-bold text-hf-white font-mono">
                    {p.price.toFixed(p.pair.includes('JPY') ? 3 : 5)}
                  </div>
                </div>
                <div>
                  <div className="text-[7px] text-hf-dim">CHG %</div>
                  <div className={`text-[11px] font-bold font-mono ${isUp ? 'text-hf-green' : 'text-red-400'}`}>
                    {isUp ? '+' : ''}{p.change_pct.toFixed(2)}%
                  </div>
                </div>
                <div>
                  <div className="text-[7px] text-hf-dim">CHG (ABS)</div>
                  <div className={`text-[11px] font-bold font-mono ${isUp ? 'text-hf-green' : 'text-red-400'}`}>
                    {p.change > 0 ? '+' : ''}{p.change.toFixed(p.pair.includes('JPY') ? 3 : 5)}
                  </div>
                </div>
                <div>
                  <div className="text-[7px] text-hf-dim">DIRECTION</div>
                  <div className={`text-[11px] font-bold font-mono ${p.direction === 'up' ? 'text-hf-green' : 'text-red-400'}`}>
                    {p.direction === 'up' ? '\u25B2 UP' : '\u25BC DOWN'}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
