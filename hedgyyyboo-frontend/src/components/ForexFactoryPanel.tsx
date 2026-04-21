'use client';

import { useState, useEffect, useCallback } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

interface FFEvent {
  title: string;
  country: string;
  impact: string;
  date: string;
  time: string;
  actual: string;
  forecast: string;
  previous: string;
  surprise_direction?: string;
  surprise_delta?: number;
}

interface FFData {
  total_events: number;
  high_impact_count: number;
  released_events: FFEvent[];
  upcoming_events: FFEvent[];
}

export default function ForexFactoryPanel() {
  const [data, setData] = useState<FFData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'released' | 'upcoming'>('upcoming');

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/forex-factory`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error('Forex Factory fetch failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="panel h-full flex flex-col">
        <div className="panel-header accent-amber">
          <span>FOREX FACTORY // ECONOMIC CALENDAR</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-hf-amber/30 border-t-hf-amber rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const impactColor = (impact: string) => {
    switch (impact?.toUpperCase()) {
      case 'HIGH': return '#ef4444';
      case 'MEDIUM': return '#f59e0b';
      case 'LOW': return '#888';
      default: return '#444';
    }
  };

  const surpriseIcon = (dir?: string) => {
    if (!dir) return '';
    if (dir === 'POSITIVE') return '\u25B2';
    if (dir === 'NEGATIVE') return '\u25BC';
    return '\u25CF';
  };

  const surpriseColor = (dir?: string) => {
    if (dir === 'POSITIVE') return '#00ff88';
    if (dir === 'NEGATIVE') return '#ef4444';
    return '#888';
  };

  const events = tab === 'released' ? data?.released_events || [] : data?.upcoming_events || [];

  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header accent-amber">
        <span>FOREX FACTORY // ECONOMIC CALENDAR</span>
        <span className="ml-auto text-[8px] text-hf-dim">
          {data?.high_impact_count || 0} HIGH IMPACT
        </span>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Summary bar */}
        <div className="px-2 pt-2 flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-[8px] text-hf-dim">HIGH: {data?.high_impact_count || 0}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-[8px] text-hf-dim">TOTAL: {data?.total_events || 0}</span>
          </div>
        </div>

        {/* Tab toggle */}
        <div className="px-2 pt-2 flex gap-1">
          {(['upcoming', 'released'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-1 rounded text-[8px] font-bold tracking-wider transition-all ${
                tab === t
                  ? 'bg-hf-amber/20 border border-hf-amber/40 text-hf-amber'
                  : 'bg-terminal-dark/50 border border-terminal-border text-hf-dim hover:text-hf-white'
              }`}
            >
              {t.toUpperCase()} ({t === 'released' ? data?.released_events?.length || 0 : data?.upcoming_events?.length || 0})
            </button>
          ))}
        </div>

        {/* Event list */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
          {events.length === 0 ? (
            <div className="text-center text-[9px] text-hf-dim py-4">NO {tab.toUpperCase()} EVENTS</div>
          ) : (
            events.map((evt, i) => (
              <div key={i} className="bg-terminal-dark/40 rounded px-2 py-1.5 border border-terminal-border/50">
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: impactColor(evt.impact) }}
                  />
                  <span className="text-[8px] text-hf-dim">{evt.country}</span>
                  <span className="text-[9px] text-hf-white font-medium flex-1 truncate">{evt.title}</span>
                  {evt.surprise_direction && (
                    <span className="text-[9px] font-bold" style={{ color: surpriseColor(evt.surprise_direction) }}>
                      {surpriseIcon(evt.surprise_direction)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-[8px]">
                  <span className="text-hf-dim">{evt.date} {evt.time}</span>
                  {evt.actual && <span className="text-hf-white">ACT: <strong>{evt.actual}</strong></span>}
                  {evt.forecast && <span className="text-hf-dim">FCST: {evt.forecast}</span>}
                  {evt.previous && <span className="text-hf-dim">PREV: {evt.previous}</span>}
                  {evt.surprise_delta != null && (
                    <span style={{ color: surpriseColor(evt.surprise_direction) }}>
                      {'\u0394'}{evt.surprise_delta > 0 ? '+' : ''}{evt.surprise_delta.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
