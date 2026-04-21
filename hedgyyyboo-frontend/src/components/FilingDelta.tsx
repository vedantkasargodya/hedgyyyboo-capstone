'use client';

import { useState, useCallback } from 'react';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';

const API_BASE = 'http://localhost:8001';

interface DiffItem {
  type: 'added' | 'modified' | 'removed' | 'unchanged';
  text: string;
  old_text?: string;
  new_text?: string;
  similarity?: number;
}

interface FilingDeltaResult {
  ticker: string;
  filing_type: string;
  section: string;
  divergence_score: number;
  current_filing_date: string;
  previous_filing_date: string;
  stats: {
    added_pct: number;
    modified_pct: number;
    removed_pct: number;
    unchanged_pct: number;
  };
  diffs: DiffItem[];
}

const PROGRESS_STEPS = [
  'Downloading 10-K filing...',
  'Extracting Risk Factors...',
  'Computing embeddings...',
  'Calculating divergence...',
];

function DivergenceColor(score: number): string {
  if (score < 30) return 'text-hf-green';
  if (score < 60) return 'text-hf-amber';
  return 'text-hf-red';
}

function DivergenceBgColor(score: number): string {
  if (score < 30) return 'bg-hf-green/10 border-hf-green/30';
  if (score < 60) return 'bg-hf-amber/10 border-hf-amber/30';
  return 'bg-hf-red/10 border-hf-red/30';
}

function DiffItemCard({
  item,
  index,
}: {
  item: DiffItem;
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);

  const text =
    item.type === 'modified'
      ? item.new_text || item.text
      : item.text;
  const oldText = item.type === 'modified' ? item.old_text || '' : '';
  const truncLen = 150;
  const isTruncated = text.length > truncLen || oldText.length > truncLen;

  const borderClass =
    item.type === 'added'
      ? 'border-l-2 border-l-hf-green bg-hf-green/5'
      : item.type === 'modified'
      ? 'border-l-2 border-l-hf-amber bg-hf-amber/5'
      : item.type === 'removed'
      ? 'border-l-2 border-l-hf-red bg-hf-red/5'
      : 'border-l-2 border-l-terminal-border bg-transparent';

  const tagClass =
    item.type === 'added'
      ? 'bg-hf-green/10 text-hf-green border-hf-green/30'
      : item.type === 'modified'
      ? 'bg-hf-amber/10 text-hf-amber border-hf-amber/30'
      : item.type === 'removed'
      ? 'bg-hf-red/10 text-hf-red border-hf-red/30'
      : 'bg-terminal-border/50 text-hf-dim border-terminal-border';

  if (item.type === 'unchanged') return null;

  return (
    <div
      key={index}
      className={`${borderClass} rounded-r p-3 mb-2 animate-fade-in`}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span
          className={`text-[8px] font-bold tracking-widest px-1.5 py-0.5 rounded border ${tagClass}`}
        >
          {item.type.toUpperCase()}
        </span>
        {isTruncated && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[9px] text-hf-cyan hover:text-hf-white transition-colors"
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>

      {item.type === 'modified' ? (
        <div className="space-y-1.5">
          {oldText && (
            <p className="text-[10px] text-hf-red/80 line-through leading-relaxed">
              {expanded ? oldText : oldText.slice(0, truncLen)}
              {!expanded && oldText.length > truncLen && '...'}
            </p>
          )}
          <p className="text-[10px] text-hf-green/90 leading-relaxed">
            {expanded ? text : text.slice(0, truncLen)}
            {!expanded && text.length > truncLen && '...'}
          </p>
        </div>
      ) : (
        <p
          className={`text-[10px] leading-relaxed ${
            item.type === 'removed'
              ? 'text-hf-red/80 line-through'
              : 'text-hf-white/80'
          }`}
        >
          {expanded ? text : text.slice(0, truncLen)}
          {!expanded && text.length > truncLen && '...'}
        </p>
      )}
    </div>
  );
}

interface FilingDeltaProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function FilingDelta({
  collapsed = true,
  onToggleCollapse,
}: FilingDeltaProps) {
  const [ticker, setTicker] = useState('');
  const [loading, setLoading] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [result, setResult] = useState<FilingDeltaResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async () => {
    if (!ticker.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setProgressStep(0);

    // Animate progress steps
    const stepIntervals: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i < PROGRESS_STEPS.length; i++) {
      stepIntervals.push(
        setTimeout(() => setProgressStep(i), i * 1500)
      );
    }

    try {
      // SEC EDGAR embedding pipeline can take 30-60s on first fetch
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120000);

      const res = await fetch(
        `${API_BASE}/api/filing-delta/${ticker.trim().toUpperCase()}?filing_type=10-K&section=risk_factors`,
        { method: 'POST', signal: controller.signal }
      );
      clearTimeout(timeout);

      if (!res.ok) {
        // Try to parse JSON {detail: "..."} from FastAPI
        let friendly = `HTTP ${res.status}`;
        try {
          const body = await res.json();
          if (body?.detail) friendly = body.detail;
        } catch {
          const txt = await res.text();
          if (txt) friendly = txt;
        }
        if (res.status === 404) {
          friendly = `${friendly} · Tip: this engine uses SEC EDGAR, so Indian tickers (INFY, RELIANCE, TCS) aren't supported. Try AAPL, MSFT, GOOGL, TSLA, NVDA, META.`;
        }
        throw new Error(friendly);
      }
      const raw = await res.json();

      // Backend shape: { summary_stats, added[], modified[], removed[], ... }
      // Frontend shape: { stats, diffs[], ... } — adapt here.
      const summary = raw.summary_stats || {};
      const addedItems = (raw.added || []).map((c: { text: string; similarity?: number; chunk_index?: number }) => ({
        type: 'added' as const,
        text: c.text,
        similarity: c.similarity,
      }));
      const modifiedItems = (raw.modified || []).map((c: { text: string; old_text?: string; similarity?: number; chunk_index?: number }) => ({
        type: 'modified' as const,
        text: c.text,
        old_text: c.old_text,
        new_text: c.text,
        similarity: c.similarity,
      }));
      const removedItems = (raw.removed || []).map((c: { text: string; similarity?: number; chunk_index?: number }) => ({
        type: 'removed' as const,
        text: c.text,
        similarity: c.similarity,
      }));

      const data: FilingDeltaResult = {
        ticker: raw.ticker,
        filing_type: raw.filing_type,
        section: raw.section,
        divergence_score: raw.divergence_score ?? 0,
        current_filing_date: raw.current_filing_date,
        previous_filing_date: raw.previous_filing_date,
        stats: {
          added_pct:     summary.added_pct     ?? 0,
          modified_pct:  summary.modified_pct  ?? 0,
          removed_pct:   summary.removed_pct   ?? 0,
          unchanged_pct: summary.unchanged_pct ?? 0,
        },
        diffs: [...addedItems, ...modifiedItems, ...removedItems],
      };
      setResult(data);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Request timed out after 120 s — SEC EDGAR may be throttling. Try again in a minute.');
      } else {
        setError(
          err instanceof Error ? err.message : 'Analysis failed'
        );
      }
    } finally {
      setLoading(false);
      stepIntervals.forEach(clearTimeout);
    }
  }, [ticker]);

  return (
    <div className="panel">
      {/* Header with collapse toggle */}
      <div className="panel-header accent-red">
        <span>FILING DELTA ENGINE</span>
        <div className="ml-auto flex items-center gap-2">
          {result && (
            <span className="text-[9px] text-terminal-muted">
              {result.ticker}
            </span>
          )}
          <button
            onClick={onToggleCollapse}
            className="p-1 text-hf-dim hover:text-hf-white transition-colors"
          >
            {collapsed ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronUp size={14} />
            )}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="p-4 animate-fade-in">
          {/* Input Row */}
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1 max-w-xs">
              <Search
                size={12}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-hf-dim"
              />
              <input
                type="text"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && analyze()}
                placeholder="TICKER"
                className="w-full bg-terminal-black border border-terminal-border rounded pl-8 pr-3 py-2 text-[11px] text-hf-white tracking-wider placeholder:text-terminal-muted focus:border-hf-green focus:outline-none transition-colors"
              />
            </div>
            <button
              onClick={analyze}
              disabled={loading || !ticker.trim()}
              className="px-4 py-2 bg-hf-red/10 border border-hf-red/30 rounded text-[10px] font-bold text-hf-red tracking-widest hover:bg-hf-red/20 hover:border-hf-red/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ANALYZE
            </button>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="space-y-3 py-4">
              {PROGRESS_STEPS.map((step, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 transition-all duration-300 ${
                    i <= progressStep
                      ? 'opacity-100'
                      : 'opacity-20'
                  }`}
                >
                  {i < progressStep ? (
                    <div className="w-3 h-3 rounded-full bg-hf-green/20 border border-hf-green/50 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-hf-green" />
                    </div>
                  ) : i === progressStep ? (
                    <div className="w-3 h-3 rounded-full border border-hf-amber/50 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-hf-amber animate-pulse" />
                    </div>
                  ) : (
                    <div className="w-3 h-3 rounded-full border border-terminal-border" />
                  )}
                  <span
                    className={`text-[10px] tracking-wider ${
                      i <= progressStep
                        ? i === progressStep
                          ? 'text-hf-amber'
                          : 'text-hf-green'
                        : 'text-hf-dim'
                    }`}
                  >
                    {step}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-hf-red/5 border border-hf-red/20 rounded p-3 my-3">
              <span className="text-[10px] text-hf-red tracking-wider">
                ERROR: {error}
              </span>
            </div>
          )}

          {/* Results */}
          {result && !loading && (
            <div className="space-y-4 animate-fade-in">
              {/* Divergence Score */}
              <div className="flex items-center gap-4">
                <div
                  className={`border rounded px-4 py-3 text-center ${DivergenceBgColor(
                    result.divergence_score
                  )}`}
                >
                  <div
                    className={`text-3xl font-bold tabular-nums ${DivergenceColor(
                      result.divergence_score
                    )}`}
                  >
                    {result.divergence_score.toFixed(1)}
                  </div>
                  <div className="text-[8px] text-hf-dim tracking-widest mt-1">
                    DIVERGENCE SCORE
                  </div>
                </div>

                {/* Stats Bar */}
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center gap-3">
                    <StatChip
                      label="ADDED"
                      value={result.stats?.added_pct ?? 0}
                      color="text-hf-green"
                    />
                    <StatChip
                      label="MODIFIED"
                      value={result.stats?.modified_pct ?? 0}
                      color="text-hf-amber"
                    />
                    <StatChip
                      label="REMOVED"
                      value={result.stats?.removed_pct ?? 0}
                      color="text-hf-red"
                    />
                    <StatChip
                      label="UNCHANGED"
                      value={result.stats?.unchanged_pct ?? 0}
                      color="text-hf-dim"
                    />
                  </div>

                  {/* Filing Dates */}
                  <div className="text-[9px] text-terminal-muted tracking-wider mt-2">
                    {result.current_filing_date} vs{' '}
                    {result.previous_filing_date}
                  </div>
                </div>
              </div>

              {/* Diff List */}
              {result.diffs && result.diffs.length > 0 && (
                <div className="max-h-[400px] overflow-y-auto pr-1">
                  {result.diffs.map((item, i) => (
                    <DiffItemCard key={i} item={item} index={i} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatChip({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-1.5 bg-terminal-black/50 border border-terminal-border rounded px-2 py-1">
      <span className="text-[8px] text-hf-dim tracking-wider">{label}</span>
      <span className={`text-[10px] font-bold tabular-nums ${color}`}>
        {value.toFixed(1)}%
      </span>
    </div>
  );
}
