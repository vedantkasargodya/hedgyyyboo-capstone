'use client';

import { useEffect, useState, useCallback } from 'react';

const API_BASE = 'http://localhost:8001';
const TICKERS = 'AAPL,MSFT,NVDA,TSLA,AMZN,GOOGL,META,JPM,GS,BAC';

interface WatchlistQuote {
  symbol: string;
  price: number;
  change_percent: number;
  volume: number;
}

function formatVolume(vol: number): string {
  if (!vol || vol === 0) return '-';
  if (vol >= 1_000_000_000) return `${(vol / 1_000_000_000).toFixed(1)}B`;
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(1)}M`;
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(1)}K`;
  return vol.toString();
}

export default function WatchlistPanel() {
  const [quotes, setQuotes] = useState<WatchlistQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchQuotes = useCallback(async () => {
    try {
      const res = await fetch(
        `${API_BASE}/api/stock/batch/quotes?tickers=${TICKERS}`
      );
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();

      const arr = Array.isArray(data) ? data : Array.isArray(data?.quotes) ? data.quotes : [];
      const parsed: WatchlistQuote[] = arr.map((d: Record<string, unknown>) => ({
        symbol: (d.symbol || d.ticker || '') as string,
        price: Number(d.price || 0),
        change_percent: Number(d.change_pct ?? d.change_percent ?? 0),
        volume: Number(d.volume || 0),
      }));

      if (parsed.length > 0) {
        setQuotes(parsed);
        setError(false);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuotes();
    const interval = setInterval(fetchQuotes, 30000);
    return () => clearInterval(interval);
  }, [fetchQuotes]);

  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header accent-cyan">
        <span>WATCHLIST</span>
        <span className="ml-auto text-[9px] text-terminal-muted tabular-nums">
          {quotes.length} TICKERS
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-3 space-y-2">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="skeleton h-3 w-10" />
                <div className="skeleton h-3 w-14 ml-auto" />
                <div className="skeleton h-3 w-12" />
                <div className="skeleton h-3 w-10" />
              </div>
            ))}
          </div>
        ) : error && quotes.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-[10px] text-hf-amber tracking-wider">
              DATA UNAVAILABLE
            </span>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-terminal-border">
                <th className="text-[9px] font-semibold text-hf-dim tracking-wider text-left px-3 py-1.5">
                  TICKER
                </th>
                <th className="text-[9px] font-semibold text-hf-dim tracking-wider text-right px-2 py-1.5">
                  PRICE
                </th>
                <th className="text-[9px] font-semibold text-hf-dim tracking-wider text-right px-2 py-1.5">
                  CHG%
                </th>
                <th className="text-[9px] font-semibold text-hf-dim tracking-wider text-right px-3 py-1.5">
                  VOL
                </th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q, i) => {
                const isPositive = q.change_percent >= 0;
                return (
                  <tr
                    key={`${q.symbol}-${i}`}
                    className="border-b border-terminal-border/30 hover:bg-terminal-border/30 transition-colors"
                  >
                    <td className="text-[10px] font-semibold text-hf-white tracking-wider px-3 py-1.5">
                      {q.symbol}
                    </td>
                    <td className="text-[10px] text-hf-dim tabular-nums text-right px-2 py-1.5">
                      ${q.price.toFixed(2)}
                    </td>
                    <td
                      className={`text-[10px] font-semibold tabular-nums text-right px-2 py-1.5 ${
                        isPositive ? 'text-hf-green' : 'text-hf-red'
                      }`}
                    >
                      {isPositive ? '+' : ''}
                      {q.change_percent.toFixed(2)}%
                    </td>
                    <td className="text-[10px] text-terminal-muted tabular-nums text-right px-3 py-1.5">
                      {formatVolume(q.volume)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
