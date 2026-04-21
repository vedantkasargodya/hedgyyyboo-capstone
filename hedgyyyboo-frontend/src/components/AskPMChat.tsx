'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageSquare, Send, Zap, Brain, BarChart3, Globe, Loader2 } from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  route?: string;
  dataSources?: string[];
  timestamp: string;
}

const ROUTE_ICONS: Record<string, typeof Brain> = {
  derivatives: Zap,
  fundamental: BarChart3,
  macro: Globe,
};

const ROUTE_COLORS: Record<string, string> = {
  derivatives: 'text-hf-amber',
  fundamental: 'text-hf-cyan',
  macro: 'text-hf-green',
};

const SUGGESTED_QUERIES = [
  'What is the current IV skew on SPY?',
  'Show me AAPL stock data',
  'What is the macro regime right now?',
  'Analyse tail risk contagion across markets',
];

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

export default function AskPMChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'system',
      content: 'Hedgyyyboo RAG Brain online. Ask me anything about derivatives, fundamentals, or macro. I route queries through live Phase 1-3 data engines.',
      timestamp: '',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentRoute, setCurrentRoute] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Set welcome timestamp client-side to avoid hydration mismatch
  useEffect(() => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === 'welcome' ? { ...m, timestamp: new Date().toISOString() } : m
      )
    );
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  const sendMessage = async (query: string) => {
    if (!query.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    setStreamingContent('');
    setCurrentRoute(null);

    try {
      // Use REST endpoint (more reliable than WebSocket for single queries)
      const res = await fetch(`${API_BASE}/api/ask-pm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }),
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);

      const data = await res.json();

      setCurrentRoute(data.route);

      // Simulate typewriter streaming
      const fullText = data.response || 'No response generated.';
      const words = fullText.split(' ');
      let accumulated = '';

      for (let i = 0; i < words.length; i++) {
        accumulated += (i > 0 ? ' ' : '') + words[i];
        setStreamingContent(accumulated);
        await new Promise((r) => setTimeout(r, 30));
      }

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: fullText,
        route: data.route,
        dataSources: data.data_sources,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setStreamingContent('');
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : 'Unknown error'}. Check if the backend is running on port 8001.`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      setCurrentRoute(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const formatTime = (ts: string) => {
    if (!ts) return '';
    try {
      return new Date(ts).toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  return (
    <div className="panel h-full flex flex-col">
      {/* Header */}
      <div className="panel-header accent-cyan">
        <div className="flex items-center gap-2">
          <MessageSquare size={12} />
          <span>ASK PM // RAG BRAIN</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-hf-cyan animate-pulse-dot" />
          <span className="text-[9px] text-terminal-muted">GEMMA 3B</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin scrollbar-thumb-terminal-border">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 ${
                msg.role === 'user'
                  ? 'bg-hf-cyan/15 border border-hf-cyan/30 text-hf-white'
                  : msg.role === 'system'
                  ? 'bg-terminal-dark border border-terminal-border text-hf-dim'
                  : 'bg-terminal-black/80 border border-terminal-border text-hf-white'
              }`}
            >
              {/* Route badge */}
              {msg.route && (
                <div className="flex items-center gap-1.5 mb-1.5">
                  {(() => {
                    const Icon = ROUTE_ICONS[msg.route] || Brain;
                    return <Icon size={10} className={ROUTE_COLORS[msg.route] || 'text-hf-dim'} />;
                  })()}
                  <span className={`text-[8px] font-bold tracking-wider uppercase ${ROUTE_COLORS[msg.route] || 'text-hf-dim'}`}>
                    {msg.route} route
                  </span>
                </div>
              )}

              <p className="text-[11px] leading-relaxed whitespace-pre-wrap">
                {msg.content}
              </p>

              {/* Data sources */}
              {msg.dataSources && msg.dataSources.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {msg.dataSources.map((src) => (
                    <span
                      key={src}
                      className="text-[7px] px-1.5 py-0.5 rounded bg-terminal-dark border border-terminal-border text-terminal-muted"
                    >
                      {src}
                    </span>
                  ))}
                </div>
              )}

              <span className="text-[8px] text-terminal-muted mt-1 block">
                {formatTime(msg.timestamp)}
              </span>
            </div>
          </div>
        ))}

        {/* Streaming response */}
        {streamingContent && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-lg px-3 py-2 bg-terminal-black/80 border border-hf-cyan/30 text-hf-white">
              {currentRoute && (
                <div className="flex items-center gap-1.5 mb-1.5">
                  {(() => {
                    const Icon = ROUTE_ICONS[currentRoute] || Brain;
                    return <Icon size={10} className={ROUTE_COLORS[currentRoute] || 'text-hf-dim'} />;
                  })()}
                  <span className={`text-[8px] font-bold tracking-wider uppercase ${ROUTE_COLORS[currentRoute] || 'text-hf-dim'}`}>
                    {currentRoute} route
                  </span>
                </div>
              )}
              <p className="text-[11px] leading-relaxed whitespace-pre-wrap">
                {streamingContent}
                <span className="inline-block w-1.5 h-3 bg-hf-cyan ml-0.5 animate-pulse" />
              </p>
            </div>
          </div>
        )}

        {/* Loading indicator */}
        {isLoading && !streamingContent && (
          <div className="flex justify-start">
            <div className="rounded-lg px-3 py-2 bg-terminal-black/80 border border-terminal-border">
              <div className="flex items-center gap-2">
                <Loader2 size={12} className="text-hf-cyan animate-spin" />
                <span className="text-[10px] text-hf-dim">
                  {currentRoute
                    ? `Routing via ${currentRoute}...`
                    : 'Classifying query...'}
                </span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested queries */}
      {messages.length <= 1 && (
        <div className="px-3 pb-2">
          <p className="text-[8px] text-terminal-muted tracking-wider mb-1.5">SUGGESTED</p>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_QUERIES.map((q) => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                className="text-[9px] px-2 py-1 rounded border border-terminal-border text-hf-dim hover:text-hf-cyan hover:border-hf-cyan/30 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-terminal-border p-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask the PM desk..."
            disabled={isLoading}
            className="flex-1 bg-terminal-black border border-terminal-border rounded px-3 py-2 text-[11px] text-hf-white placeholder-terminal-muted focus:outline-none focus:border-hf-cyan/50 disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={isLoading || !input.trim()}
            className="w-8 h-8 rounded bg-hf-cyan/15 border border-hf-cyan/30 flex items-center justify-center text-hf-cyan hover:bg-hf-cyan/25 transition-colors disabled:opacity-30"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
