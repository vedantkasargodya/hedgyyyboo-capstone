'use client';

import { useEffect, useState, useCallback } from 'react';

const API_BASE = 'http://localhost:8001';
const TICKERS = 'AAPL,MSFT,GOOGL,AMZN,NVDA,TSLA,META,JPM,GS,SPY';

interface TickerQuote {
  symbol: string;
  price: number;
  change_percent: number;
}

export default function TickerTape() {
  const [quotes, setQuotes] = useState<TickerQuote[]>([]);
  const [error, setError] = useState(false);

  const fetchQuotes = useCallback(async () => {
    try {
      const res = await fetch(
        `${API_BASE}/api/stock/batch/quotes?tickers=${TICKERS}`
      );
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();

      const arr = Array.isArray(data) ? data : Array.isArray(data?.quotes) ? data.quotes : [];
      const parsed: TickerQuote[] = arr.map((d: Record<string, unknown>) => ({
        symbol: (d.symbol || d.ticker || '') as string,
        price: Number(d.price || 0),
        change_percent: Number(d.change_pct ?? d.change_percent ?? 0),
      }));

      if (parsed.length > 0) {
        setQuotes(parsed);
        setError(false);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    fetchQuotes();
    const interval = setInterval(fetchQuotes, 60000);
    return () => clearInterval(interval);
  }, [fetchQuotes]);

  if (error && quotes.length === 0) {
    return (
      <div className="h-7 bg-[#080808] border-b border-terminal-border flex items-center justify-center z-50 fixed top-0 left-0 right-0">
        <span className="text-[10px] text-hf-amber tracking-wider font-semibold animate-pulse">
          MARKET DATA OFFLINE
        </span>
      </div>
    );
  }

  return (
    <div className="h-7 bg-[#080808] border-b border-terminal-border overflow-hidden z-50 fixed top-0 left-0 right-0">
      <div className="ticker-scroll flex items-center h-full whitespace-nowrap">
        {/* Duplicate content for seamless loop */}
        {[0, 1].map((dup) => (
          <div key={dup} className="flex items-center shrink-0 ticker-content">
            {quotes.map((q, i) => {
              const isPositive = q.change_percent >= 0;
              return (
                <span key={`${dup}-${q.symbol}-${i}`} className="flex items-center">
                  <span className="text-[10px] font-semibold text-hf-white tracking-wider mx-2">
                    {q.symbol}
                  </span>
                  <span className="text-[10px] text-hf-dim tabular-nums">
                    ${q.price.toFixed(2)}
                  </span>
                  <span
                    className={`text-[10px] font-semibold tabular-nums ml-1 ${
                      isPositive ? 'text-hf-green' : 'text-hf-red'
                    }`}
                  >
                    {isPositive ? '+' : ''}
                    {q.change_percent.toFixed(2)}%
                  </span>
                  <span className="text-terminal-muted text-[8px] mx-3">
                    &#x2022;
                  </span>
                </span>
              );
            })}
          </div>
        ))}
      </div>

      <style jsx>{`
        .ticker-scroll {
          animation: ticker-marquee 30s linear infinite;
        }
        .ticker-scroll:hover {
          animation-play-state: paused;
        }
        @keyframes ticker-marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </div>
  );
}
