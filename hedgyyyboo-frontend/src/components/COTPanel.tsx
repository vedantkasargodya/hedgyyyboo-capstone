'use client';

import { useState, useEffect, useCallback } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

interface COTContract {
  pair: string;
  contract_name: string;
  net_speculative: number;
  net_pct_of_oi: number;
  wow_change: number;
  positioning_signal: string;
  open_interest: number;
  noncommercial_long: number;
  noncommercial_short: number;
  report_date: string;
}

interface COTData {
  contracts: COTContract[];
  usd_bias: string;
  aggregate_net_speculative: number;
}

export default function COTPanel() {
  const [data, setData] = useState<COTData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/fx/cot`);
      const json = await res.json();
      if (json.status === 'ok') setData(json);
    } catch (e) {
      console.error('COT fetch failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="panel h-full flex flex-col">
        <div className="panel-header accent-red">
          <span>CFTC COT // HEDGE FUND POSITIONING</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const signalColor = (signal: string) => {
    if (signal.includes('EXTREME LONG')) return '#00ff88';
    if (signal.includes('NET LONG')) return '#00d4ff';
    if (signal.includes('EXTREME SHORT')) return '#ef4444';
    if (signal.includes('NET SHORT')) return '#f59e0b';
    return '#888';
  };

  const biasColor = (bias: string) => {
    if (bias === 'USD WEAK') return '#00ff88';
    if (bias === 'USD STRONG') return '#ef4444';
    return '#888';
  };

  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header accent-red">
        <span>CFTC COT // HEDGE FUND POSITIONING</span>
        <span className="ml-auto text-[8px] text-hf-dim">WEEKLY</span>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2">
        {/* USD Bias */}
        <div className="text-center">
          <div className="text-[7px] text-hf-dim tracking-wider">AGGREGATE USD BIAS</div>
          <div className="text-lg font-bold" style={{ color: biasColor(data?.usd_bias || '') }}>
            {data?.usd_bias || 'N/A'}
          </div>
          <div className="text-[8px] text-hf-dim font-mono">
            Net spec: {(data?.aggregate_net_speculative || 0).toLocaleString()} contracts
          </div>
        </div>

        {/* Contract table */}
        {data?.contracts?.map((c) => {
          const barWidth = Math.min(100, Math.abs(c.net_pct_of_oi) * 3);
          const isLong = c.net_speculative > 0;
          return (
            <div key={c.pair} className="bg-terminal-dark/40 rounded px-2 py-1.5 border border-terminal-border/50">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-hf-white">{c.pair}</span>
                <span
                  className="text-[7px] font-bold px-1.5 py-0.5 rounded"
                  style={{
                    color: signalColor(c.positioning_signal),
                    backgroundColor: `${signalColor(c.positioning_signal)}15`,
                    border: `1px solid ${signalColor(c.positioning_signal)}30`,
                  }}
                >
                  {c.positioning_signal}
                </span>
              </div>

              {/* Net position bar */}
              <div className="mt-1 relative h-1.5 bg-terminal-dark rounded-full overflow-hidden">
                <div className="absolute inset-0 flex">
                  <div className="flex-1" /> {/* center marker */}
                </div>
                <div
                  className="absolute h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${barWidth}%`,
                    left: isLong ? '50%' : `${50 - barWidth}%`,
                    backgroundColor: isLong ? '#00ff88' : '#ef4444',
                    boxShadow: `0 0 6px ${isLong ? 'rgba(0,255,136,0.3)' : 'rgba(239,68,68,0.3)'}`,
                  }}
                />
                <div className="absolute top-0 left-1/2 w-px h-full bg-white/20" />
              </div>

              <div className="flex items-center justify-between mt-1 text-[8px]">
                <span className={isLong ? 'text-hf-green' : 'text-red-400'}>
                  NET: {c.net_speculative > 0 ? '+' : ''}{c.net_speculative.toLocaleString()}
                </span>
                <span className="text-hf-dim">
                  {c.net_pct_of_oi > 0 ? '+' : ''}{c.net_pct_of_oi.toFixed(1)}% OI
                </span>
                <span className={c.wow_change > 0 ? 'text-hf-green' : c.wow_change < 0 ? 'text-red-400' : 'text-hf-dim'}>
                  WoW: {c.wow_change > 0 ? '+' : ''}{c.wow_change.toLocaleString()}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
