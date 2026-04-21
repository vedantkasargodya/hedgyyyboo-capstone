'use client';

import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

interface AIBriefPanelProps {
  text?: string;
  timestamp?: string;
  onReanalyze?: () => void;
  loading?: boolean;
}

const PLACEHOLDER = `[STATUS] No live brief generated yet. Click RE-ANALYZE to ask Gemma-3n to produce a commentary grounded in current portfolio positions, live VIX, top headlines and macro feeds.`;

export default function AIBriefPanel({
  text: textProp,
  timestamp: timestampProp,
  onReanalyze,
  loading = false,
}: AIBriefPanelProps) {
  // Local state so the panel can self-fetch when no controlling parent exists.
  const [briefText, setBriefText] = useState<string>(textProp || PLACEHOLDER);
  const [briefTimestamp, setBriefTimestamp] = useState<string | undefined>(timestampProp);
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep in sync with props if a parent ever passes them
  useEffect(() => {
    if (textProp) setBriefText(textProp);
  }, [textProp]);
  useEffect(() => {
    if (timestampProp) setBriefTimestamp(timestampProp);
  }, [timestampProp]);

  // Try to load a cached brief immediately so the user doesn't stare at
  // placeholder copy while the LLM round-trips.
  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/ai-brief/cached`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d || !d.text) return;
        setBriefText(d.text);
        setBriefTimestamp(d.generated_at);
      })
      .catch(() => { /* silent */ });
    return () => {
      cancelled = true;
    };
  }, []);

  const startTypewriter = useCallback((fullText: string) => {
    setDisplayedText('');
    setIsTyping(true);
    let index = 0;
    const type = () => {
      if (index < fullText.length) {
        setDisplayedText(fullText.slice(0, index + 1));
        index++;
        const ch = fullText[index - 1];
        const delay = ch === '\n' ? 80 : ch === '.' ? 40 : 8;
        setTimeout(type, delay);
      } else {
        setIsTyping(false);
      }
    };
    type();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => startTypewriter(briefText), 300);
    return () => clearTimeout(timer);
  }, [briefText, startTypewriter]);

  const handleReanalyze = useCallback(async () => {
    setIsAnalyzing(true);
    setDisplayedText('');
    setError(null);
    if (onReanalyze) onReanalyze();
    try {
      const res = await fetch(`${API_BASE}/api/ai-brief?refresh=true`, {
        method: 'POST',
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setBriefText(data.text || PLACEHOLDER);
      setBriefTimestamp(data.generated_at);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setBriefText(
        `[STATUS] Failed to generate brief.\n\n[ERROR] ${msg}\n\nCheck that the OpenRouter key in backend/.env is valid.`
      );
    } finally {
      setIsAnalyzing(false);
    }
  }, [onReanalyze]);

  const [formattedTime, setFormattedTime] = useState('--:--:--');
  useEffect(() => {
    const now = briefTimestamp || new Date().toISOString();
    setFormattedTime(
      new Date(now).toLocaleString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        month: 'short',
        day: 'numeric',
      })
    );
  }, [briefTimestamp]);

  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header accent-green">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Sparkles size={12} className="text-hf-green" />
            <div className="absolute inset-0 animate-pulse-glow rounded-full" />
          </div>
          <span>AI PM BRIEF</span>
          <span className="text-hf-dim">|</span>
          <span className="text-hf-amber">VEDANT</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-[9px] text-terminal-muted tabular-nums">
            {formattedTime}
          </span>
          <button
            onClick={handleReanalyze}
            disabled={isAnalyzing || loading}
            className="flex items-center gap-1 px-2 py-1 bg-terminal-black border border-terminal-border rounded text-[9px] text-hf-dim hover:text-hf-cyan hover:border-hf-cyan/30 transition-all disabled:opacity-30"
          >
            <RefreshCw
              size={10}
              className={isAnalyzing || loading ? 'animate-spin' : ''}
            />
            RE-ANALYZE
          </button>
        </div>
      </div>

      <div className="flex-1 p-4 overflow-y-auto bg-terminal-black/50">
        {/* AI Badge */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[8px] px-1.5 py-0.5 bg-hf-green/10 border border-hf-green/30 rounded text-hf-green font-bold tracking-widest animate-pulse-glow">
            AI
          </span>
          <span className="text-[9px] text-hf-dim">
            GEMMA-3N-E4B-IT // OPENROUTER RAG
          </span>
          {error && (
            <span className="text-[9px] text-hf-red ml-auto">
              error — see brief body
            </span>
          )}
        </div>

        {/* Terminal-style output */}
        <div className="font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
          {isAnalyzing ? (
            <div className="flex items-center gap-2 text-hf-amber">
              <RefreshCw size={12} className="animate-spin" />
              <span className="animate-pulse">
                Running full analysis pipeline...
              </span>
            </div>
          ) : (
            <div className="relative">
              {displayedText.split('\n').map((line, i) => {
                if (line.startsWith('[') && line.includes(']')) {
                  const bracketEnd = line.indexOf(']');
                  const tag = line.slice(0, bracketEnd + 1);
                  const rest = line.slice(bracketEnd + 1);

                  let tagColor = 'text-hf-cyan';
                  if (tag.includes('RISK') || tag.includes('ALERT'))
                    tagColor = 'text-hf-red';
                  if (tag.includes('ALPHA')) tagColor = 'text-hf-green';
                  if (tag.includes('POSITION')) tagColor = 'text-hf-amber';

                  return (
                    <span key={i}>
                      <span className={`${tagColor} font-bold`}>{tag}</span>
                      <span className="text-hf-white/80">{rest}</span>
                      {'\n'}
                    </span>
                  );
                }
                return (
                  <span key={i} className="text-hf-white/70">
                    {line}
                    {'\n'}
                  </span>
                );
              })}
              {isTyping && (
                <span className="inline-block w-2 h-4 bg-hf-green animate-pulse ml-0.5" />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
