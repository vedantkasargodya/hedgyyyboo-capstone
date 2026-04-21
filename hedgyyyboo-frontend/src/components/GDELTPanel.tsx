'use client';

import { useState, useEffect, useCallback } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

interface GDELTRegion {
  label: string;
  description: string;
  fx_impact: string[];
  stress_score: number;
  stress_level: string;
  tone?: number;
  article_count?: number;
}

interface GDELTData {
  global_stress_index: number;
  global_level: string;
  hotspot: string;
  hotspot_score: number;
  regions: GDELTRegion[];
}

export default function GDELTPanel() {
  const [data, setData] = useState<GDELTData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/fx/gdelt`);
      const json = await res.json();
      if (json.status === 'ok') setData(json);
    } catch (e) {
      console.error('GDELT fetch failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const levelColor = (level: string) => {
    switch (level) {
      case 'CRITICAL': return '#ef4444';
      case 'ELEVATED': return '#f59e0b';
      case 'MODERATE': return '#00d4ff';
      case 'LOW': return '#00ff88';
      case 'RISK-OFF': return '#ef4444';
      case 'CAUTIOUS': return '#f59e0b';
      case 'NEUTRAL': return '#00d4ff';
      case 'RISK-ON': return '#00ff88';
      default: return '#888';
    }
  };

  if (loading) {
    return (
      <div className="panel h-full flex flex-col">
        <div className="panel-header accent-red">
          <span>GDELT // GEOPOLITICAL STRESS</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header accent-red">
        <span>GDELT // GEOPOLITICAL STRESS</span>
        <span className="ml-auto text-[8px] text-hf-dim">LIVE</span>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2">
        {/* Global stress gauge */}
        <div className="text-center">
          <div className="text-[7px] text-hf-dim tracking-wider">GLOBAL STRESS INDEX</div>
          <div
            className="text-3xl font-bold font-mono"
            style={{ color: levelColor(data?.global_level || '') }}
          >
            {data?.global_stress_index?.toFixed(1) || '0'}
          </div>
          <div
            className="inline-block mt-1 px-2 py-0.5 rounded text-[8px] font-bold"
            style={{
              color: levelColor(data?.global_level || ''),
              backgroundColor: `${levelColor(data?.global_level || '')}15`,
              border: `1px solid ${levelColor(data?.global_level || '')}30`,
            }}
          >
            {data?.global_level || 'UNKNOWN'}
          </div>
        </div>

        {/* Stress bar */}
        <div className="relative h-2 bg-terminal-dark rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${data?.global_stress_index || 0}%`,
              background: `linear-gradient(90deg, #00ff88, #f59e0b, #ef4444)`,
            }}
          />
        </div>
        <div className="flex justify-between text-[7px] text-hf-dim">
          <span>RISK-ON (0)</span>
          <span>NEUTRAL (50)</span>
          <span>RISK-OFF (100)</span>
        </div>

        {/* Hotspot */}
        {data?.hotspot && (
          <div className="bg-red-500/10 border border-red-500/30 rounded p-1.5 text-center">
            <div className="text-[7px] text-red-400">HOTSPOT</div>
            <div className="text-[10px] font-bold text-red-400">{data.hotspot}</div>
          </div>
        )}

        {/* Region breakdown */}
        {data?.regions?.map((r) => (
          <div key={r.label} className="bg-terminal-dark/40 rounded px-2 py-1.5 border border-terminal-border/50">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-hf-white">{r.label}</span>
              <span
                className="text-[7px] font-bold"
                style={{ color: levelColor(r.stress_level) }}
              >
                {r.stress_score.toFixed(0)}/100
              </span>
            </div>
            <div className="h-1 bg-terminal-dark rounded-full overflow-hidden mt-0.5">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${r.stress_score}%`,
                  backgroundColor: levelColor(r.stress_level),
                }}
              />
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-[7px] text-hf-dim">
              <span>{r.stress_level}</span>
              {r.tone !== undefined && <span>Tone: {r.tone.toFixed(2)}</span>}
              <span className="ml-auto">{r.fx_impact.join(', ')}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
