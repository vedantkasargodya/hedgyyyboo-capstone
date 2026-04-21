'use client';

import { useState, useEffect, useCallback } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

interface PCAComponent {
  factor: string;
  explained_variance_pct: number;
  loadings: Record<string, number>;
}

interface YieldPCAData {
  status: string;
  components: PCAComponent[];
  total_explained_pct: number;
  num_observations: number;
  tenors_used: string[];
}

export default function YieldPCAPanel() {
  const [data, setData] = useState<YieldPCAData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/yield-curve/pca`);
      const json = await res.json();
      if (json.status === 'ok') setData(json);
    } catch (e) {
      console.error('Yield PCA fetch failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="panel h-full flex flex-col">
        <div className="panel-header accent-cyan">
          <span>YIELD CURVE PCA</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-hf-cyan/30 border-t-hf-cyan rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const factorColors: Record<string, string> = {
    'LEVEL': '#00d4ff',
    'SLOPE': '#00ff88',
    'CURVATURE': '#f59e0b',
  };

  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header accent-cyan">
        <span>YIELD CURVE PCA</span>
        <span className="ml-auto text-[8px] text-hf-dim">
          {data ? `${data.num_observations} OBS` : ''}
        </span>
      </div>

      {!data || data.status !== 'ok' ? (
        <div className="flex-1 flex items-center justify-center text-hf-dim text-[10px]">
          {data?.status === 'insufficient_data' ? 'INSUFFICIENT DATA FOR PCA' : 'NO DATA'}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
          {/* Total variance explained */}
          <div className="text-center">
            <div className="text-[8px] text-hf-dim tracking-wider">TOTAL VARIANCE EXPLAINED</div>
            <div className="text-2xl font-bold text-hf-cyan">{data.total_explained_pct.toFixed(1)}%</div>
          </div>

          {/* Factor bars */}
          {data.components.map((comp) => {
            const color = factorColors[comp.factor] || '#888';
            return (
              <div key={comp.factor} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-medium" style={{ color }}>{comp.factor}</span>
                  <span className="text-[9px] text-hf-white">{comp.explained_variance_pct.toFixed(1)}%</span>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 bg-terminal-dark rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${comp.explained_variance_pct}%`,
                      backgroundColor: color,
                      boxShadow: `0 0 8px ${color}40`,
                    }}
                  />
                </div>

                {/* Loadings heatmap */}
                <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Object.keys(comp.loadings).length}, 1fr)` }}>
                  {Object.entries(comp.loadings).map(([tenor, loading]) => {
                    const absLoad = Math.abs(loading);
                    const isPositive = loading >= 0;
                    return (
                      <div key={tenor} className="text-center">
                        <div className="text-[7px] text-hf-dim">{tenor}</div>
                        <div
                          className="rounded text-[8px] font-mono py-0.5"
                          style={{
                            backgroundColor: isPositive
                              ? `rgba(0,255,136,${absLoad * 0.4})`
                              : `rgba(239,68,68,${absLoad * 0.4})`,
                            color: absLoad > 0.3 ? 'white' : 'rgba(255,255,255,0.5)',
                          }}
                        >
                          {loading > 0 ? '+' : ''}{loading.toFixed(2)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Interpretation */}
          <div className="border-t border-terminal-border pt-2">
            <div className="text-[8px] text-hf-dim mb-1">FACTOR INTERPRETATION</div>
            <div className="space-y-1 text-[9px]">
              {data.components[0] && (
                <div className="flex items-start gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: '#00d4ff' }} />
                  <span className="text-hf-white/80">
                    <strong className="text-hf-cyan">Level</strong> — parallel shifts ({data.components[0].explained_variance_pct.toFixed(0)}% of variance)
                  </span>
                </div>
              )}
              {data.components[1] && (
                <div className="flex items-start gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: '#00ff88' }} />
                  <span className="text-hf-white/80">
                    <strong className="text-green-400">Slope</strong> — steepening/flattening ({data.components[1].explained_variance_pct.toFixed(0)}%)
                  </span>
                </div>
              )}
              {data.components[2] && (
                <div className="flex items-start gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: '#f59e0b' }} />
                  <span className="text-hf-white/80">
                    <strong className="text-amber-400">Curvature</strong> — belly moves ({data.components[2].explained_variance_pct.toFixed(0)}%)
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
