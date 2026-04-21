'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import {
  DollarSign,
  Target,
  ShieldAlert,
  TrendingUp,
  Activity,
  Zap,
} from 'lucide-react';

import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import TickerTape from '@/components/TickerTape';
import StatCard from '@/components/StatCard';
import PCAChart from '@/components/PCAChart';
import RegimePanel from '@/components/RegimePanel';
import AIBriefPanel from '@/components/AIBriefPanel';
import NewsFeed from '@/components/NewsFeed';
import WatchlistPanel from '@/components/WatchlistPanel';
import TailRiskPanel from '@/components/TailRiskPanel';
import MonteCarloPanel from '@/components/MonteCarloPanel';
import AskPMChat from '@/components/AskPMChat';
import MorningNotePanel from '@/components/MorningNotePanel';

const Globe = dynamic(() => import('@/components/Globe'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-hf-green/30 border-t-hf-green rounded-full animate-spin" />
        <span className="text-[10px] text-hf-dim tracking-wider">
          LOADING GLOBE...
        </span>
      </div>
    </div>
  ),
});

const VolSurface3D = dynamic(() => import('@/components/VolSurface3D'), {
  ssr: false,
  loading: () => (
    <div className="panel h-full flex flex-col">
      <div className="panel-header accent-cyan">
        <span>3D VOLATILITY SURFACE // SPY</span>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-hf-cyan/30 border-t-hf-cyan rounded-full animate-spin" />
          <span className="text-[10px] text-hf-dim tracking-wider">
            LOADING SURFACE...
          </span>
        </div>
      </div>
    </div>
  ),
});

const FilingDelta = dynamic(() => import('@/components/FilingDelta'), {
  ssr: false,
  loading: () => (
    <div className="panel">
      <div className="panel-header accent-red">
        <span>FILING DELTA ENGINE</span>
      </div>
    </div>
  ),
});

const statCards = [
  {
    title: 'Total AUM',
    value: 2.84,
    change: 3.42,
    icon: DollarSign,
    color: 'green' as const,
    prefix: '$',
    suffix: 'B',
    decimals: 2,
  },
  {
    title: 'Active Positions',
    value: 291,
    change: 1.8,
    icon: Target,
    color: 'cyan' as const,
    prefix: '',
    suffix: '',
    decimals: 0,
  },
  {
    title: 'Risk Score',
    value: 34.7,
    change: -2.1,
    icon: ShieldAlert,
    color: 'amber' as const,
    prefix: '',
    suffix: '/100',
    decimals: 1,
  },
  {
    title: 'Alpha Generated',
    value: 8.92,
    change: 5.63,
    icon: TrendingUp,
    color: 'green' as const,
    prefix: '+',
    suffix: '%',
    decimals: 2,
  },
  {
    title: 'VIX',
    value: 18.5,
    change: -3.2,
    icon: Activity,
    color: 'amber' as const,
    prefix: '',
    suffix: '',
    decimals: 1,
  },
  {
    title: 'Sharpe Ratio',
    value: 1.42,
    change: 0.8,
    icon: Zap,
    color: 'cyan' as const,
    prefix: '',
    suffix: '',
    decimals: 2,
  },
];

export default function Dashboard() {
  const [filingCollapsed, setFilingCollapsed] = useState(true);

  return (
    <div className="min-h-screen bg-terminal-black">
      {/* Ticker Tape - fixed top-0, z-50 */}
      <TickerTape />

      {/* TopBar - fixed top-7, z-40 */}
      <TopBar />

      {/* Sidebar - fixed left, top-[76px], z-30 */}
      <Sidebar />

      {/* Main content area */}
      <main className="ml-[60px] pt-[76px] px-3 pb-3">
        {/* Row 1: Stat Cards */}
        <div className="grid grid-cols-6 gap-2 mb-3">
          {statCards.map((stat, i) => (
            <div
              key={stat.title}
              className="animate-slide-up"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <StatCard {...stat} />
            </div>
          ))}
        </div>

        {/* Row 2: Globe + News + Watchlist */}
        <div
          className="grid grid-cols-12 gap-2 mb-3"
          style={{ height: '400px' }}
        >
          {/* Globe - col-span-5 */}
          <div className="col-span-5 panel animate-fade-in overflow-hidden">
            <div className="panel-header accent-green">
              <span>GLOBAL RISK MAP</span>
              <div className="ml-auto flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-hf-green animate-pulse-dot" />
                <span className="text-[9px] text-terminal-muted">LIVE</span>
              </div>
            </div>
            <div className="flex-1 overflow-hidden relative" style={{ height: 'calc(100% - 32px)' }}>
              <Globe />
            </div>
          </div>

          {/* News Feed - col-span-4 */}
          <div
            className="col-span-4 animate-fade-in h-full overflow-hidden"
            style={{ animationDelay: '100ms' }}
          >
            <NewsFeed />
          </div>

          {/* Watchlist - col-span-3 */}
          <div
            className="col-span-3 animate-fade-in h-full overflow-hidden"
            style={{ animationDelay: '200ms' }}
          >
            <WatchlistPanel />
          </div>
        </div>

        {/* Row 3: PCA + Regime + AI Brief */}
        <div
          className="grid grid-cols-3 gap-2 mb-3"
          style={{ height: '280px' }}
        >
          <div
            className="animate-slide-up h-full overflow-hidden"
            style={{ animationDelay: '250ms' }}
          >
            <PCAChart />
          </div>
          <div
            className="animate-slide-up h-full overflow-hidden"
            style={{ animationDelay: '350ms' }}
          >
            <RegimePanel />
          </div>
          <div
            className="animate-slide-up h-full overflow-hidden"
            style={{ animationDelay: '450ms' }}
          >
            <AIBriefPanel />
          </div>
        </div>

        {/* Row 4: Phase 3 - Derivatives Desk */}
        <div
          className="grid grid-cols-3 gap-2 mb-3"
          style={{ height: '380px' }}
        >
          <div
            className="animate-slide-up h-full overflow-hidden"
            style={{ animationDelay: '500ms' }}
          >
            <VolSurface3D />
          </div>
          <div
            className="animate-slide-up h-full overflow-hidden"
            style={{ animationDelay: '600ms' }}
          >
            <TailRiskPanel />
          </div>
          <div
            className="animate-slide-up h-full overflow-hidden"
            style={{ animationDelay: '700ms' }}
          >
            <MonteCarloPanel />
          </div>
        </div>

        {/* Row 5: Phase 4 - RAG Brain + Morning Note */}
        <div
          className="grid grid-cols-2 gap-2 mb-3"
          style={{ height: '420px' }}
        >
          <div
            className="animate-slide-up h-full overflow-hidden"
            style={{ animationDelay: '750ms' }}
          >
            <AskPMChat />
          </div>
          <div
            className="animate-slide-up h-full overflow-hidden"
            style={{ animationDelay: '850ms' }}
          >
            <MorningNotePanel />
          </div>
        </div>

        {/* Row 6: Filing Delta (collapsible) */}
        <div
          className="mb-3 animate-slide-up"
          style={{ animationDelay: '900ms' }}
        >
          <FilingDelta
            collapsed={filingCollapsed}
            onToggleCollapse={() => setFilingCollapsed(!filingCollapsed)}
          />
        </div>

        {/* Footer */}
        <footer className="mt-2 pt-3 border-t border-terminal-border flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-[9px] text-terminal-muted tracking-wider">
              HEDGYYYBOO RESEARCH TERMINAL v2.0
            </span>
            <span className="text-[9px] text-terminal-muted">|</span>
            <span className="text-[9px] text-hf-dim tracking-wider">
              DATA REFRESH: 15s
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-hf-green" />
              <span className="text-[9px] text-hf-dim">API</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-hf-green" />
              <span className="text-[9px] text-hf-dim">WS</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-hf-amber" />
              <span className="text-[9px] text-hf-dim">GPU</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
