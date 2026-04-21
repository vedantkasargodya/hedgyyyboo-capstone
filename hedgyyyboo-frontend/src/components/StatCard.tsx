'use client';

import { useEffect, useState, useRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowUp, ArrowDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number;
  change: number;
  icon: LucideIcon;
  color: 'green' | 'cyan' | 'amber' | 'red';
  prefix?: string;
  suffix?: string;
  decimals?: number;
}

const colorMap = {
  green: {
    border: 'border-hf-green/20',
    glow: 'hover:shadow-[0_0_15px_rgba(0,255,0,0.15)]',
    accent: 'bg-hf-green',
    text: 'text-hf-green',
    iconBg: 'bg-hf-green/10',
  },
  cyan: {
    border: 'border-hf-cyan/20',
    glow: 'hover:shadow-[0_0_15px_rgba(0,212,255,0.15)]',
    accent: 'bg-hf-cyan',
    text: 'text-hf-cyan',
    iconBg: 'bg-hf-cyan/10',
  },
  amber: {
    border: 'border-hf-amber/20',
    glow: 'hover:shadow-[0_0_15px_rgba(255,170,0,0.15)]',
    accent: 'bg-hf-amber',
    text: 'text-hf-amber',
    iconBg: 'bg-hf-amber/10',
  },
  red: {
    border: 'border-hf-red/20',
    glow: 'hover:shadow-[0_0_15px_rgba(255,0,51,0.15)]',
    accent: 'bg-hf-red',
    text: 'text-hf-red',
    iconBg: 'bg-hf-red/10',
  },
};

export default function StatCard({
  title,
  value,
  change,
  icon: Icon,
  color,
  prefix = '',
  suffix = '',
  decimals = 1,
}: StatCardProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const duration = 1500;

  useEffect(() => {
    startTimeRef.current = null;

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(eased * value);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value]);

  const colors = colorMap[color];
  const isPositive = change >= 0;

  return (
    <div
      className={`panel border ${colors.border} ${colors.glow} transition-all duration-300 animate-fade-in`}
    >
      <div className={`h-[2px] ${colors.accent}`} />
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-semibold tracking-[0.15em] uppercase text-hf-dim">
            {title}
          </span>
          <div className={`p-1.5 rounded ${colors.iconBg}`}>
            <Icon size={14} className={colors.text} />
          </div>
        </div>

        <div className="flex items-end justify-between">
          <div className={`text-2xl font-bold ${colors.text} tracking-tight`}>
            {prefix}
            {displayValue.toFixed(decimals)}
            {suffix}
          </div>

          <div
            className={`flex items-center gap-0.5 text-xs font-medium ${
              isPositive ? 'text-hf-green' : 'text-hf-red'
            }`}
          >
            {isPositive ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
            <span>{Math.abs(change).toFixed(2)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
