'use client';

import { useState, useEffect, useCallback } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

interface HawkDove {
  score: number;
  label: string;
  hawkish_hits: number;
  dovish_hits: number;
  hawkish_keywords: string[];
  dovish_keywords: string[];
}

interface Divergence {
  current_score: number;
  prior_score: number;
  delta: number;
  shift: string;
}

interface BankData {
  status: string;
  bank: string;
  hawk_dove: HawkDove;
  divergence?: Divergence | null;
  statements?: { title: string; date: string; summary: string; link: string }[];
}

interface CBData {
  banks: BankData[];
  overall_tone: string;
  overall_score: number;
}

export default function CBAnalysisPanel() {
  const [data, setData] = useState<CBData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/cb-analysis`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error('CB analysis fetch failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="panel h-full flex flex-col">
        <div className="panel-header accent-purple">
          <span>CENTRAL BANK NLP</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const toneColor = (label: string) => {
    if (label === 'HAWKISH') return '#ef4444';
    if (label === 'DOVISH') return '#00ff88';
    return '#888';
  };

  const shiftColor = (shift: string) => {
    if (shift === 'MORE HAWKISH') return '#ef4444';
    if (shift === 'MORE DOVISH') return '#00ff88';
    return '#888';
  };

  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header accent-purple">
        <span>CENTRAL BANK NLP // HAWK-DOVE</span>
        <span className="ml-auto text-[8px] text-hf-dim">FED RSS</span>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
        {/* Overall tone */}
        <div className="text-center">
          <div className="text-[7px] text-hf-dim tracking-wider">OVERALL TONE</div>
          <div
            className="text-2xl font-bold"
            style={{ color: toneColor(data?.overall_tone || 'NEUTRAL') }}
          >
            {data?.overall_tone || 'NEUTRAL'}
          </div>
          <div className="text-[9px] text-hf-dim font-mono">
            SCORE: {(data?.overall_score || 0).toFixed(3)}
          </div>
        </div>

        {/* Score gauge */}
        <div className="relative">
          <div className="h-2 bg-terminal-dark rounded-full overflow-hidden flex">
            <div className="flex-1 bg-green-500/30" />
            <div className="flex-1 bg-gray-500/20" />
            <div className="flex-1 bg-red-500/30" />
          </div>
          <div
            className="absolute top-0 w-1 h-2 bg-white rounded-full"
            style={{ left: `${50 + (data?.overall_score || 0) * 50}%`, transform: 'translateX(-50%)' }}
          />
          <div className="flex justify-between mt-1 text-[7px] text-hf-dim">
            <span>DOVISH (-1)</span>
            <span>NEUTRAL (0)</span>
            <span>HAWKISH (+1)</span>
          </div>
        </div>

        {/* Bank details */}
        {data?.banks?.map((bank, idx) => (
          <div key={idx} className="border border-terminal-border/50 rounded p-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-hf-white">{bank.bank}</span>
              <span
                className="text-[8px] font-bold px-1.5 py-0.5 rounded"
                style={{
                  color: toneColor(bank.hawk_dove.label),
                  backgroundColor: `${toneColor(bank.hawk_dove.label)}15`,
                  border: `1px solid ${toneColor(bank.hawk_dove.label)}30`,
                }}
              >
                {bank.hawk_dove.label}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[8px]">
              <div>
                <span className="text-hf-dim">Hawkish hits: </span>
                <span className="text-red-400 font-mono">{bank.hawk_dove.hawkish_hits}</span>
              </div>
              <div>
                <span className="text-hf-dim">Dovish hits: </span>
                <span className="text-green-400 font-mono">{bank.hawk_dove.dovish_hits}</span>
              </div>
            </div>

            {/* Keywords */}
            {bank.hawk_dove.hawkish_keywords.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {bank.hawk_dove.hawkish_keywords.slice(0, 3).map((kw, i) => (
                  <span key={i} className="text-[7px] px-1 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                    {kw}
                  </span>
                ))}
                {bank.hawk_dove.dovish_keywords.slice(0, 3).map((kw, i) => (
                  <span key={`d-${i}`} className="text-[7px] px-1 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">
                    {kw}
                  </span>
                ))}
              </div>
            )}

            {/* Divergence */}
            {bank.divergence && (
              <div className="bg-terminal-dark/50 rounded p-1.5">
                <div className="text-[7px] text-hf-dim">STATEMENT DIVERGENCE</div>
                <div className="flex items-center gap-2">
                  <span
                    className="text-[9px] font-bold"
                    style={{ color: shiftColor(bank.divergence.shift) }}
                  >
                    {bank.divergence.shift}
                  </span>
                  <span className="text-[8px] text-hf-dim font-mono">
                    ({'\u0394'}{bank.divergence.delta > 0 ? '+' : ''}{bank.divergence.delta.toFixed(4)})
                  </span>
                </div>
              </div>
            )}

            {/* Recent statements */}
            {bank.statements && bank.statements.length > 0 && (
              <div className="space-y-1">
                <div className="text-[7px] text-hf-dim">RECENT STATEMENTS</div>
                {bank.statements.slice(0, 2).map((stmt, si) => (
                  <div key={si} className="text-[8px] text-hf-white/60 truncate">
                    <span className="text-hf-dim">{stmt.date?.slice(0, 10)}</span>{' '}
                    {stmt.title}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
