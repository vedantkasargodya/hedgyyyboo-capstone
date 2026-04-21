'use client';

import { useState, useEffect, useCallback } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

interface RatesBrief {
  status: string;
  brief: string;
  yields: Record<string, number | null>;
  inversion_status: string;
}

export default function RatesBriefPanel() {
  const [data, setData] = useState<RatesBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayedText, setDisplayedText] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setDisplayedText('');
    try {
      const res = await fetch(`${API}/api/rates-brief`);
      const json = await res.json();
      if (json.status === 'ok') {
        setData(json);
        // Typewriter effect
        const text = json.brief;
        let i = 0;
        const interval = setInterval(() => {
          if (i < text.length) {
            setDisplayedText(text.slice(0, i + 1));
            i++;
          } else {
            clearInterval(interval);
          }
        }, 15);
        return () => clearInterval(interval);
      }
    } catch (e) {
      console.error('Rates brief failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header accent-green">
        <span>AI RATES BRIEF</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[8px] px-1.5 py-0.5 rounded bg-green-500/10 border border-green-500/30 text-green-400">
            GEMMA 3B
          </span>
          <button
            onClick={fetchData}
            disabled={loading}
            className="text-[8px] text-hf-dim hover:text-hf-green"
          >
            ↻
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {loading && !data ? (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-hf-green/30 border-t-hf-green rounded-full animate-spin" />
            <span className="text-[10px] text-hf-dim">Analysing rates landscape...</span>
          </div>
        ) : (
          <>
            {/* Yield pills */}
            {data && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {Object.entries(data.yields).map(([tenor, y]) => (
                  y !== null && (
                    <span key={tenor} className="text-[8px] px-2 py-0.5 rounded-full bg-terminal-dark border border-terminal-border text-hf-white">
                      {tenor}: {y.toFixed(2)}%
                    </span>
                  )
                ))}
                {data.inversion_status && (
                  <span className={`text-[8px] px-2 py-0.5 rounded-full border font-medium ${
                    data.inversion_status === 'INVERTED' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                    data.inversion_status === 'FLAT' ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' :
                    'bg-green-500/10 border-green-500/30 text-green-400'
                  }`}>
                    {data.inversion_status}
                  </span>
                )}
              </div>
            )}

            {/* Brief text */}
            <div className="text-[11px] text-hf-white/90 leading-relaxed font-light">
              {displayedText}
              {loading && <span className="inline-block w-1.5 h-3 bg-hf-green ml-0.5 animate-pulse" />}
            </div>

            {/* Data sources */}
            <div className="mt-4 pt-2 border-t border-terminal-border">
              <div className="text-[8px] text-hf-dim mb-1">DATA SOURCES</div>
              <div className="flex flex-wrap gap-1">
                {['Treasury Yields', 'Credit Spreads', 'NSS Model'].map(src => (
                  <span key={src} className="text-[7px] px-1.5 py-0.5 rounded bg-hf-cyan/5 border border-hf-cyan/20 text-hf-cyan">
                    {src}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
