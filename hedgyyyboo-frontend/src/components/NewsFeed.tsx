'use client';

import { useEffect, useState, useCallback } from 'react';

const API_BASE = 'http://localhost:8001';

interface NewsItem {
  title: string;
  url: string;
  source: string;
  category: string;
  published_at: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  markets: 'bg-hf-green',
  macro: 'bg-hf-cyan',
  tech: 'bg-hf-amber',
  crypto: 'bg-purple-500',
  energy: 'bg-hf-red',
  geopolitical: 'bg-rose-500',
  forex: 'bg-blue-400',
  commodities: 'bg-yellow-500',
  bonds: 'bg-orange-400',
  india: 'bg-emerald-400',
  all: 'bg-hf-green',
};

const TABS = ['all', 'markets', 'macro', 'tech', 'forex', 'india'] as const;

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export default function NewsFeed() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchNews = useCallback(async (category: string, isAutoRefresh = false) => {
    try {
      // Only show loading spinner on initial load, not on auto-refresh
      if (!isAutoRefresh) setLoading(true);
      const res = await fetch(
        `${API_BASE}/api/news?category=${category}&limit=30`
      );
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      const raw: Record<string, unknown>[] = Array.isArray(data)
        ? data
        : data.articles || data.news || data.items || [];
      // Normalize field names from backend
      const items: NewsItem[] = raw.map((d) => ({
        title: (d.title || '') as string,
        url: (d.link || d.url || '') as string,
        source: (d.source || '') as string,
        category: (d.category || 'all') as string,
        published_at: (d.published_at || d.published || d.publishedAt || '') as string,
      }));
      setNews(items);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNews(activeTab);
    // Auto-refresh every 30 seconds (silent refresh, no loading spinner)
    const interval = setInterval(() => fetchNews(activeTab, true), 30000);
    return () => clearInterval(interval);
  }, [activeTab, fetchNews]);

  return (
    <div className="panel h-full flex flex-col">
      {/* Header */}
      <div className="panel-header accent-green">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-hf-green animate-pulse-dot" />
          <span>LIVE FEED</span>
        </div>
        <span className="ml-auto text-[9px] text-terminal-muted tabular-nums">
          {news.length} ITEMS
        </span>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center border-b border-terminal-border px-2 py-1.5 gap-1 bg-terminal-dark">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`text-[9px] font-semibold tracking-wider px-2 py-1 rounded transition-all ${
              activeTab === tab
                ? 'bg-hf-green/10 text-hf-green border border-hf-green/30'
                : 'text-hf-dim hover:text-hf-white hover:bg-terminal-border/30'
            }`}
          >
            {tab.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <div className="p-3 space-y-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="skeleton h-3 w-full" />
                <div className="skeleton h-3 w-3/4" />
                <div className="flex gap-2">
                  <div className="skeleton h-2.5 w-16" />
                  <div className="skeleton h-2.5 w-12" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-[10px] text-hf-amber tracking-wider">
              NEWS FEED OFFLINE
            </span>
          </div>
        ) : news.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-[10px] text-hf-dim tracking-wider">
              NO ITEMS
            </span>
          </div>
        ) : (
          <div className="divide-y divide-terminal-border">
            {news.map((item, i) => {
              const catColor =
                CATEGORY_COLORS[item.category?.toLowerCase()] || 'bg-hf-dim';
              return (
                <a
                  key={i}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-3 py-2.5 hover:bg-terminal-border/20 transition-colors group cursor-pointer"
                >
                  <div className="flex items-start gap-2">
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${catColor} mt-1.5 shrink-0`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] text-hf-white leading-tight line-clamp-2 group-hover:text-hf-cyan transition-colors">
                        {item.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] text-hf-dim truncate">
                          {item.source}
                        </span>
                        {item.published_at && (
                          <>
                            <span className="text-[8px] text-terminal-muted">
                              &#x2022;
                            </span>
                            <span className="text-[9px] text-terminal-muted tabular-nums">
                              {timeAgo(item.published_at)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
