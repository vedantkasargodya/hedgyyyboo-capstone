'use client';

import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';

export default function TopBar() {
  const [time, setTime] = useState<string>('');
  const [date, setDate] = useState<string>('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
      setDate(
        now.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      );
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="fixed top-7 left-[60px] right-0 h-12 bg-terminal-dark/95 backdrop-blur-sm border-b border-terminal-border z-40 flex items-center justify-between px-5">
      {/* Left: Logo */}
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-bold tracking-[0.3em] text-hf-green glow-green-text animate-pulse-glow">
          HEDGYYYBOO
        </h1>
        <span className="text-[9px] text-terminal-muted font-medium tracking-wider border border-terminal-border px-2 py-0.5 rounded">
          v2.0
        </span>
      </div>

      {/* Center: Clock + Market Status */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3 text-center">
          <span className="text-base font-semibold text-hf-white tracking-wider tabular-nums">
            {time}
          </span>
          <span className="text-[10px] text-hf-dim tracking-wide">
            {date}
          </span>
        </div>

        <div className="h-4 w-px bg-terminal-border" />

        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="w-2 h-2 rounded-full bg-hf-green animate-pulse-dot" />
            <div className="absolute inset-0 w-2 h-2 rounded-full bg-hf-green/30 animate-ping" />
          </div>
          <span className="text-[10px] font-semibold tracking-[0.15em] text-hf-green">
            MARKETS LIVE
          </span>
        </div>
      </div>

      {/* Right: User Badge + Notifications */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <button className="text-hf-dim hover:text-hf-cyan transition-colors p-1">
            <Bell size={16} />
          </button>
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-hf-red text-[8px] font-bold text-white rounded-full flex items-center justify-center">
            3
          </span>
        </div>

        <div className="h-4 w-px bg-terminal-border" />

        <div className="flex items-center gap-2 bg-terminal-black/50 border border-terminal-border rounded px-3 py-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-hf-cyan" />
          <span className="text-[10px] font-semibold tracking-[0.1em] text-hf-white">
            VEDANT
          </span>
          <span className="text-[10px] text-hf-dim">|</span>
          <span className="text-[10px] text-hf-amber tracking-wider">
            PM DESK
          </span>
        </div>
      </div>
    </header>
  );
}
