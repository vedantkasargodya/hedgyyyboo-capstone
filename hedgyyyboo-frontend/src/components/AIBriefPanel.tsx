'use client';

import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';

interface AIBriefPanelProps {
  text?: string;
  timestamp?: string;
  onReanalyze?: () => void;
  loading?: boolean;
}

const defaultText = `[STATUS] No live brief generated yet.

[ACTION] Click RE-ANALYZE to trigger the Gemma-3n-E4B-it LLM. The model will ingest live PCA factors, OU mean-reversion diagnostics, GARCH tail risk, and the last six hours of news headlines, then return grounded commentary across macro regime, alpha signal, positioning and risk alert.

[NOTE] Generation takes ~7 seconds on the OpenRouter free tier. Subsequent requests are served from the server-side cache until the next manual refresh or the 08:00 IST morning-brief cron.`;

export default function AIBriefPanel({
  text,
  timestamp,
  onReanalyze,
  loading = false,
}: AIBriefPanelProps) {
  const briefText = text || defaultText;
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const startTypewriter = useCallback(() => {
    setDisplayedText('');
    setIsTyping(true);
    let index = 0;

    const type = () => {
      if (index < briefText.length) {
        setDisplayedText(briefText.slice(0, index + 1));
        index++;
        const delay = briefText[index - 1] === '\n' ? 80 : briefText[index - 1] === '.' ? 40 : 8;
        setTimeout(type, delay);
      } else {
        setIsTyping(false);
      }
    };

    type();
  }, [briefText]);

  useEffect(() => {
    const timer = setTimeout(startTypewriter, 500);
    return () => clearTimeout(timer);
  }, [startTypewriter]);

  const handleReanalyze = () => {
    setIsAnalyzing(true);
    setDisplayedText('');
    if (onReanalyze) {
      onReanalyze();
    }
    setTimeout(() => {
      setIsAnalyzing(false);
      startTypewriter();
    }, 2000);
  };

  const [formattedTime, setFormattedTime] = useState('--:--:--');
  useEffect(() => {
    const now = timestamp || new Date().toISOString();
    setFormattedTime(new Date(now).toLocaleString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      month: 'short',
      day: 'numeric',
    }));
  }, [timestamp]);

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
