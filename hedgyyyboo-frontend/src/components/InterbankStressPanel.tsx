'use client';

import { useState, useEffect, useCallback } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

interface Spread {
  name: string;
  value_bps: number;
  value_pct?: number;
  level: string;
  description: string;
}

interface StressComponent {
  name: string;
  score: number;
}

interface InterbankData {
  composite_stress_index: number;
  stress_level: string;
  fx_signal: string;
  rates: Record<string, number>;
  spreads: Record<string, Spread>;
  stress_components: StressComponent[];
}

export default function InterbankStressPanel() {
  const [data, setData] = useState<InterbankData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/fx/interbank-stress`);
      const json = await res.json();
      if (json.status === 'ok') setData(json);
    } catch (e) {
      console.error('Interbank stress fetch failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const levelColor = (level: string) => {
    switch (level) {
      case 'CRISIS': return '#ef4444';
      case 'ELEVATED': return '#f59e0b';
      case 'MODERATE': return '#00d4ff';
      case 'CALM': case 'NORMAL': return '#00ff88';
      case 'INVERTED': return '#ef4444';
      case 'FLAT': return '#f59e0b';
      default: return '#888';
    }
  };

  if (loading) {
    return (
      <div className="panel h-full flex flex-col">
        <div className="panel-header accent-amber">
          <span>INTERBANK STRESS // SOFR/OIS</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-hf-amber/30 border-t-hf-amber rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header accent-amber">
        <span>INTERBANK STRESS // SOFR/OIS</span>
        <span className="ml-auto text-[8px] text-hf-dim">FRED</span>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2">
        {/* Composite stress */}
        <div className="text-center">
          <div className="text-[7px] text-hf-dim tracking-wider">FUNDING STRESS INDEX</div>
          <div
            className="text-2xl font-bold font-mono"
            style={{ color: levelColor(data?.stress_level || '') }}
          >
            {data?.composite_stress_index?.toFixed(1) || '0'}
          </div>
          <div
            className="inline-block px-2 py-0.5 rounded text-[8px] font-bold"
            style={{
              color: levelColor(data?.stress_level || ''),
              backgroundColor: `${levelColor(data?.stress_level || '')}15`,
              border: `1px solid ${levelColor(data?.stress_level || '')}30`,
            }}
          >
            {data?.stress_level || 'UNKNOWN'}
          </div>
        </div>

        {/* FX Signal */}
        <div className="bg-terminal-dark/50 rounded p-1.5 text-center">
          <div className="text-[7px] text-hf-dim">FX IMPLICATION</div>
          <div className="text-[10px] font-bold text-hf-amber">{data?.fx_signal || 'N/A'}</div>
        </div>

        {/* Live rates */}
        <div>
          <div className="text-[7px] text-hf-dim tracking-wider mb-1">LIVE RATES</div>
          <div className="grid grid-cols-4 gap-1">
            {Object.entries(data?.rates || {}).map(([key, val]) => (
              <div key={key} className="bg-terminal-dark/40 rounded p-1 text-center">
                <div className="text-[6px] text-hf-dim">{key.replace('_', ' ').toUpperCase()}</div>
                <div className="text-[10px] font-bold text-hf-white font-mono">{val.toFixed(2)}%</div>
              </div>
            ))}
          </div>
        </div>

        {/* Spreads */}
        <div>
          <div className="text-[7px] text-hf-dim tracking-wider mb-1">KEY SPREADS</div>
          {Object.entries(data?.spreads || {}).map(([key, spread]) => (
            <div key={key} className="flex items-center justify-between py-1 border-b border-terminal-border/30">
              <div className="flex-1">
                <div className="text-[8px] text-hf-white">{spread.name}</div>
                <div className="text-[7px] text-hf-dim">{spread.description?.slice(0, 50)}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold font-mono" style={{ color: levelColor(spread.level) }}>
                  {spread.value_bps}bps
                </div>
                <div className="text-[7px]" style={{ color: levelColor(spread.level) }}>
                  {spread.level}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Stress components */}
        <div>
          <div className="text-[7px] text-hf-dim tracking-wider mb-1">STRESS DECOMPOSITION</div>
          {data?.stress_components?.map((comp) => (
            <div key={comp.name} className="flex items-center gap-2 mb-1">
              <span className="text-[8px] text-hf-dim w-16">{comp.name}</span>
              <div className="flex-1 h-1.5 bg-terminal-dark rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${comp.score}%`,
                    backgroundColor: comp.score > 60 ? '#ef4444' : comp.score > 30 ? '#f59e0b' : '#00ff88',
                  }}
                />
              </div>
              <span className="text-[8px] font-mono text-hf-white w-8 text-right">{comp.score.toFixed(0)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
