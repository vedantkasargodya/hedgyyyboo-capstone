'use client';

import { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:8001';

interface MarketVol {
  market: string;
  conditional_vol: number;
  vol_regime: 'low' | 'normal' | 'elevated' | 'extreme';
}

interface ContagionLink {
  pair: string;
  correlation: number;
  direction: 'positive' | 'negative';
}

interface TailRiskData {
  markets: string[];
  correlation_matrix: number[][];
  market_vols: MarketVol[];
  contagion_links: ContagionLink[];
  risk_summary: string;
  timestamp: string;
}

/* ========== Color helpers ========== */
function corrToColor(corr: number): string {
  // -1 (blue) -> 0 (dark) -> 1 (red/amber)
  const abs = Math.abs(corr);
  if (corr >= 0) {
    // low positive = dim, high positive = amber/red
    if (abs < 0.3) return `rgba(255, 170, 0, ${0.1 + abs * 0.3})`;
    if (abs < 0.6) return `rgba(255, 170, 0, ${0.2 + abs * 0.5})`;
    if (abs < 0.8) return `rgba(255, 80, 0, ${0.3 + abs * 0.5})`;
    return `rgba(255, 0, 51, ${0.4 + abs * 0.5})`;
  } else {
    // negative = blue tones
    if (abs < 0.3) return `rgba(0, 68, 255, ${0.1 + abs * 0.3})`;
    if (abs < 0.6) return `rgba(0, 68, 255, ${0.2 + abs * 0.5})`;
    return `rgba(0, 100, 255, ${0.3 + abs * 0.6})`;
  }
}

function corrTextColor(corr: number): string {
  const abs = Math.abs(corr);
  if (abs > 0.6) return '#ffffff';
  if (abs > 0.3) return '#cccccc';
  return '#888888';
}

function volRegimeColor(regime: string): string {
  switch (regime) {
    case 'extreme': return '#ff0033';
    case 'elevated': return '#ffaa00';
    case 'normal': return '#00ff00';
    case 'low': return '#00d4ff';
    default: return '#666666';
  }
}

function volRegimeBg(regime: string): string {
  switch (regime) {
    case 'extreme': return 'bg-hf-red/10 border-hf-red/30 text-hf-red';
    case 'elevated': return 'bg-hf-amber/10 border-hf-amber/30 text-hf-amber';
    case 'normal': return 'bg-hf-green/10 border-hf-green/30 text-hf-green';
    case 'low': return 'bg-hf-cyan/10 border-hf-cyan/30 text-hf-cyan';
    default: return 'bg-terminal-border/50 text-hf-dim border-terminal-border';
  }
}

/* ========== Main Component ========== */
export default function TailRiskPanel() {
  const [data, setData] = useState<TailRiskData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const res = await fetch(`${API_BASE}/api/tail-risk`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) {
          // Normalize API response to component's expected shape
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const raw = json as any;
          const marketNames = (raw.correlation_matrix?.labels || raw.markets?.map((m: any) => m.name) || []) as string[];
          const corrValues = (raw.correlation_matrix?.values || raw.correlation_matrix || []) as number[][];

          function volRegime(vol: number): 'low' | 'normal' | 'elevated' | 'extreme' {
            if (vol > 2.5) return 'extreme';
            if (vol > 1.5) return 'elevated';
            if (vol > 0.5) return 'normal';
            return 'low';
          }

          const marketVols: MarketVol[] = (raw.markets || []).map((m: any) => ({
            market: m.name || m.symbol || '',
            conditional_vol: (m.annualised_vol || m.conditional_vol || 0),
            vol_regime: volRegime(m.current_vol || 0),
          }));

          const contagionLinks: ContagionLink[] = (raw.contagion_links || []).map((l: any) => ({
            pair: `${l.source || ''} ↔ ${l.target || ''}`,
            correlation: Math.abs(l.correlation || 0),
            direction: (l.correlation || 0) >= 0 ? 'positive' as const : 'negative' as const,
          }));

          setData({
            markets: marketNames,
            correlation_matrix: corrValues,
            market_vols: marketVols,
            contagion_links: contagionLinks,
            risk_summary: raw.risk_summary || '',
            timestamp: new Date().toISOString(),
          });
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load');
          setLoading(false);
        }
      }
    }

    fetchData();

    // Auto-refresh every 5 minutes
    const interval = setInterval(() => {
      fetchData();
    }, 5 * 60 * 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Loading skeleton
  if (loading) {
    return (
      <div className="panel h-full flex flex-col">
        <div className="panel-header accent-red">
          <span>TAIL RISK CONTAGION // DCC-GARCH</span>
        </div>
        <div className="flex-1 p-3 space-y-3">
          <div className="skeleton h-[140px] w-full" />
          <div className="space-y-2">
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-3/4" />
          </div>
          <div className="skeleton h-8 w-full" />
        </div>
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div className="panel h-full flex flex-col">
        <div className="panel-header accent-red">
          <span>TAIL RISK CONTAGION // DCC-GARCH</span>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="bg-hf-red/5 border border-hf-red/20 rounded p-3">
            <span className="text-[10px] text-hf-red tracking-wider">
              ERROR: {error || 'No data available'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  const markets = data.markets;
  const matrix = data.correlation_matrix;

  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header accent-red">
        <span>TAIL RISK CONTAGION // DCC-GARCH</span>
        <div className="ml-auto flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-hf-red animate-pulse-dot" />
          <span className="text-[9px] text-terminal-muted">MONITORING</span>
        </div>
      </div>

      <div className="flex-1 p-3 overflow-y-auto space-y-3">
        {/* Correlation Heatmap */}
        <div>
          <div className="text-[8px] text-hf-dim tracking-widest mb-1.5">
            CORRELATION MATRIX
          </div>
          <div className="overflow-hidden rounded border border-terminal-border">
            {/* Header row */}
            <div className="flex">
              <div className="w-12 h-6 flex items-center justify-center bg-terminal-black border-b border-r border-terminal-border">
                <span className="text-[7px] text-hf-dim"></span>
              </div>
              {markets.map((m) => (
                <div
                  key={`hdr-${m}`}
                  className="flex-1 h-6 flex items-center justify-center bg-terminal-black border-b border-r border-terminal-border"
                >
                  <span className="text-[7px] text-hf-dim tracking-wider font-bold">
                    {m.slice(0, 4).toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
            {/* Matrix rows */}
            {matrix.map((row, ri) => (
              <div key={`row-${ri}`} className="flex">
                <div className="w-12 h-7 flex items-center justify-center bg-terminal-black border-b border-r border-terminal-border">
                  <span className="text-[7px] text-hf-dim tracking-wider font-bold">
                    {markets[ri]?.slice(0, 4).toUpperCase()}
                  </span>
                </div>
                {row.map((corr, ci) => (
                  <div
                    key={`cell-${ri}-${ci}`}
                    className="flex-1 h-7 flex items-center justify-center border-b border-r border-terminal-border/30 transition-all hover:brightness-125"
                    style={{ backgroundColor: corrToColor(corr) }}
                    title={`${markets[ri]} x ${markets[ci]}: ${corr.toFixed(3)}`}
                  >
                    <span
                      className="text-[8px] font-bold tabular-nums"
                      style={{ color: corrTextColor(corr) }}
                    >
                      {ri === ci ? '1.00' : corr.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Conditional Volatility Bars */}
        <div>
          <div className="text-[8px] text-hf-dim tracking-widest mb-1.5">
            CONDITIONAL VOLATILITY
          </div>
          <div className="space-y-1.5">
            {data.market_vols.map((mv) => {
              const maxVol = Math.max(...data.market_vols.map((v) => v.conditional_vol));
              const widthPct = (mv.conditional_vol / maxVol) * 100;
              return (
                <div key={mv.market} className="flex items-center gap-2">
                  <span className="text-[8px] text-hf-dim w-10 tracking-wider font-bold">
                    {mv.market.slice(0, 4).toUpperCase()}
                  </span>
                  <div className="flex-1 h-3 bg-terminal-black rounded-sm border border-terminal-border overflow-hidden">
                    <div
                      className="h-full rounded-sm transition-all duration-500"
                      style={{
                        width: `${widthPct}%`,
                        backgroundColor: volRegimeColor(mv.vol_regime),
                        opacity: 0.7,
                      }}
                    />
                  </div>
                  <span className="text-[8px] tabular-nums font-bold w-10 text-right" style={{ color: volRegimeColor(mv.vol_regime) }}>
                    {(mv.conditional_vol * 100).toFixed(1)}%
                  </span>
                  <span className={`text-[6px] px-1 py-0.5 rounded border tracking-wider ${volRegimeBg(mv.vol_regime)}`}>
                    {mv.vol_regime.toUpperCase()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Contagion Links */}
        <div>
          <div className="text-[8px] text-hf-dim tracking-widest mb-1.5">
            CONTAGION LINKS
          </div>
          <div className="space-y-1">
            {data.contagion_links.slice(0, 5).map((link, i) => (
              <div
                key={`link-${i}`}
                className="flex items-center gap-2 px-2 py-1 bg-terminal-black/50 rounded border border-terminal-border animate-fade-in"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <span className="text-[9px] text-hf-white font-bold tracking-wider flex-1">
                  {link.pair}
                </span>
                <span className={`text-[9px] font-bold tabular-nums ${link.correlation > 0.7 ? 'text-hf-red' : link.correlation > 0.4 ? 'text-hf-amber' : 'text-hf-dim'}`}>
                  {link.direction === 'negative' ? '-' : '+'}{link.correlation.toFixed(3)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Risk Summary */}
        <div className="pt-2 border-t border-terminal-border">
          <p className="text-[9px] text-hf-dim leading-relaxed">
            <span className="text-hf-red font-semibold">RISK ASSESSMENT: </span>
            {data.risk_summary}
          </p>
        </div>
      </div>
    </div>
  );
}
