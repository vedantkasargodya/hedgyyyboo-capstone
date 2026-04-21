'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Globe,
  BarChart3,
  Brain,
  MessageSquare,
  Percent,
  TrendingUp,
} from 'lucide-react';

interface NavItem {
  icon: typeof Globe;
  label: string;
  id: string;
  href?: string;
}

const navItems: NavItem[] = [
  { icon: Globe, label: 'Global Markets', id: 'globe', href: '/' },
  { icon: Percent, label: 'Fixed Income & Rates', id: 'rates', href: '/fixed-income' },
  { icon: TrendingUp, label: 'FX Macro Desk', id: 'fx', href: '/fx-desk' },
  { icon: BarChart3, label: 'Analytics', id: 'analytics', href: '/analytics' },
  { icon: Brain, label: 'AI Models', id: 'ai', href: '/ai-models' },
  { icon: MessageSquare, label: 'Research', id: 'research', href: '/research' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const activeFromPath =
    pathname === '/fixed-income' ? 'rates' :
    pathname === '/fx-desk'      ? 'fx' :
    pathname === '/analytics'    ? 'analytics' :
    pathname === '/ai-models'    ? 'ai' :
    pathname === '/research'     ? 'research' : 'globe';
  const [active, setActive] = useState(activeFromPath);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <aside className="fixed left-0 top-[76px] h-[calc(100vh-76px)] w-[60px] bg-terminal-dark border-r border-terminal-border z-30 flex flex-col items-center py-4">
      {/* Logo mark */}
      <div className="w-8 h-8 rounded bg-hf-green/10 border border-hf-green/30 flex items-center justify-center mb-8">
        <span className="text-hf-green font-bold text-sm glow-green-text">
          H
        </span>
      </div>

      {/* Navigation icons */}
      <nav className="flex flex-col items-center gap-2 flex-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          const isHovered = hoveredId === item.id;

          const ButtonContent = (
            <>
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[5px] w-[3px] h-5 bg-hf-cyan rounded-r shadow-[0_0_8px_rgba(0,212,255,0.6)]" />
              )}
              <Icon size={18} />
            </>
          );

          const btnClass = `
            w-10 h-10 rounded flex items-center justify-center
            transition-all duration-200 relative
            ${
              isActive
                ? 'bg-hf-cyan/15 text-white shadow-[0_0_12px_rgba(0,212,255,0.25)]'
                : 'text-hf-dim hover:text-hf-cyan hover:bg-hf-cyan/5'
            }
          `;

          return (
            <div key={item.id} className="relative">
              {item.href ? (
                <Link
                  href={item.href}
                  onClick={() => setActive(item.id)}
                  onMouseEnter={() => setHoveredId(item.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className={btnClass}
                >
                  {ButtonContent}
                </Link>
              ) : (
                <button
                  onClick={() => setActive(item.id)}
                  onMouseEnter={() => setHoveredId(item.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className={btnClass}
                >
                  {ButtonContent}
                </button>
              )}

              {/* Tooltip */}
              {isHovered && (
                <div className="absolute left-14 top-1/2 -translate-y-1/2 bg-terminal-dark border border-terminal-border px-3 py-1.5 rounded text-[10px] font-medium text-hf-white whitespace-nowrap z-50 animate-fade-in shadow-lg">
                  {item.label}
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 bg-terminal-dark border-l border-b border-terminal-border rotate-45" />
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Bottom indicator */}
      <div className="w-2 h-2 rounded-full bg-hf-green animate-pulse-dot" />
    </aside>
  );
}
