'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { ArrowLeft, TrendingDown, BarChart3, Percent, Brain } from 'lucide-react';
import Link from 'next/link';

import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import TickerTape from '@/components/TickerTape';
import TreasuryDashPanel from '@/components/TreasuryDashPanel';
import YieldCurvePanel from '@/components/YieldCurvePanel';
import YieldPCAPanel from '@/components/YieldPCAPanel';
import RatesBriefPanel from '@/components/RatesBriefPanel';

const SwaptionPanel = dynamic(() => import('@/components/SwaptionPanel'), {
  ssr: false,
  loading: () => (
    <div className="panel h-full flex flex-col">
      <div className="panel-header accent-amber">
        <span>HULL-WHITE SWAPTION // MONTE CARLO</span>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-hf-amber/30 border-t-hf-amber rounded-full animate-spin" />
      </div>
    </div>
  ),
});

export default function FixedIncomePage() {
  return (
    <div className="min-h-screen bg-terminal-black">
      <TickerTape />
      <TopBar />
      <Sidebar />

      <main className="ml-[60px] pt-[76px] px-3 pb-3">
        {/* Page Header */}
        <div className="flex items-center gap-4 mb-3 animate-fade-in">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-hf-dim hover:text-hf-cyan transition-colors text-[10px]"
          >
            <ArrowLeft size={12} />
            <span>DASHBOARD</span>
          </Link>
          <div className="h-4 w-px bg-terminal-border" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-hf-amber/10 border border-hf-amber/30 flex items-center justify-center">
              <Percent size={12} className="text-hf-amber" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-hf-white tracking-wider">FIXED INCOME & RATES DESK</h1>
              <p className="text-[9px] text-hf-dim">
                Treasury Yields • NSS Curve Fitting • Hull-White Swaption Pricer • Credit Spreads
              </p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-hf-green animate-pulse-dot" />
              <span className="text-[8px] text-hf-dim">LIVE RATES</span>
            </div>
          </div>
        </div>

        {/* Row 1: Treasury Dashboard + NSS Yield Curve */}
        <div
          className="grid grid-cols-2 gap-2 mb-3"
          style={{ height: '450px' }}
        >
          <div className="animate-slide-up h-full overflow-hidden" style={{ animationDelay: '0ms' }}>
            <TreasuryDashPanel />
          </div>
          <div className="animate-slide-up h-full overflow-hidden" style={{ animationDelay: '100ms' }}>
            <YieldCurvePanel />
          </div>
        </div>

        {/* Row 2: Swaption Pricer + Yield PCA + Rates Brief */}
        <div
          className="grid grid-cols-3 gap-2 mb-3"
          style={{ height: '450px' }}
        >
          <div className="animate-slide-up h-full overflow-hidden" style={{ animationDelay: '200ms' }}>
            <SwaptionPanel />
          </div>
          <div className="animate-slide-up h-full overflow-hidden" style={{ animationDelay: '300ms' }}>
            <YieldPCAPanel />
          </div>
          <div className="animate-slide-up h-full overflow-hidden" style={{ animationDelay: '400ms' }}>
            <RatesBriefPanel />
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-2 pt-3 border-t border-terminal-border flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-[9px] text-terminal-muted tracking-wider">
              HEDGYYYBOO RATES DESK v5.0
            </span>
            <span className="text-[9px] text-terminal-muted">|</span>
            <span className="text-[9px] text-hf-dim tracking-wider">
              NSS MODEL • HULL-WHITE SDE • YIELD PCA
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-hf-green" />
              <span className="text-[9px] text-hf-dim">TREASURY</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-hf-green" />
              <span className="text-[9px] text-hf-dim">CREDIT</span>
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
