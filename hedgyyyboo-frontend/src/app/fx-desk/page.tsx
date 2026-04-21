'use client';

import dynamic from 'next/dynamic';
import { ArrowLeft, TrendingUp } from 'lucide-react';
import Link from 'next/link';

import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import TickerTape from '@/components/TickerTape';
import FXSpotPanel from '@/components/FXSpotPanel';
import ForexFactoryPanel from '@/components/ForexFactoryPanel';
import CBAnalysisPanel from '@/components/CBAnalysisPanel';
import TradeLedgerPanel from '@/components/TradeLedgerPanel';
import COTPanel from '@/components/COTPanel';
import GDELTPanel from '@/components/GDELTPanel';
import InterbankStressPanel from '@/components/InterbankStressPanel';
import PositionsPanel from '@/components/PositionsPanel';

const FXQuantPanel = dynamic(() => import('@/components/FXQuantPanel'), {
  ssr: false,
  loading: () => (
    <div className="panel h-full flex flex-col">
      <div className="panel-header accent-cyan">
        <span>FX QUANT ENGINE</span>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-hf-cyan/30 border-t-hf-cyan rounded-full animate-spin" />
      </div>
    </div>
  ),
});

export default function FXDeskPage() {
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
            <div className="w-6 h-6 rounded bg-hf-green/10 border border-hf-green/30 flex items-center justify-center">
              <TrendingUp size={12} className="text-hf-green" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-hf-white tracking-wider">FX MACRO DESK</h1>
              <p className="text-[9px] text-hf-dim">
                OU MLE {'\u2022'} Hurst/fBM {'\u2022'} Neural SDE {'\u2022'} CFTC COT {'\u2022'} BIS REER {'\u2022'} GDELT {'\u2022'} SOFR/OIS {'\u2022'} AI PM
              </p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/30">
              <span className="text-[8px] text-purple-400 font-bold">POSTGRESQL</span>
            </div>
            <div className="px-2 py-0.5 rounded bg-hf-cyan/10 border border-hf-cyan/30">
              <span className="text-[8px] text-hf-cyan font-bold">9 DATA SOURCES</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-hf-green animate-pulse-dot" />
              <span className="text-[8px] text-hf-dim">LIVE FX</span>
            </div>
          </div>
        </div>

        {/* Row 1: FX Spot Rates + FX Quant Engine + Forex Factory */}
        <div
          className="grid grid-cols-3 gap-2 mb-3"
          style={{ height: '450px' }}
        >
          <div className="animate-slide-up h-full overflow-hidden" style={{ animationDelay: '0ms' }}>
            <FXSpotPanel />
          </div>
          <div className="animate-slide-up h-full overflow-hidden" style={{ animationDelay: '100ms' }}>
            <FXQuantPanel />
          </div>
          <div className="animate-slide-up h-full overflow-hidden" style={{ animationDelay: '200ms' }}>
            <ForexFactoryPanel />
          </div>
        </div>

        {/* Row 2: Trade Ledger (wide) + CB NLP */}
        <div
          className="grid grid-cols-3 gap-2 mb-3"
          style={{ height: '420px' }}
        >
          <div className="col-span-2 animate-slide-up h-full overflow-hidden" style={{ animationDelay: '300ms' }}>
            <TradeLedgerPanel />
          </div>
          <div className="animate-slide-up h-full overflow-hidden" style={{ animationDelay: '400ms' }}>
            <CBAnalysisPanel />
          </div>
        </div>

        {/* Row 2.5: Live FX positions from the unified paper_trades table */}
        <div className="grid grid-cols-1 gap-2 mb-3" style={{ height: '260px' }}>
          <div className="animate-slide-up h-full overflow-hidden" style={{ animationDelay: '450ms' }}>
            <PositionsPanel desk="FX" title="FX POSITIONS — LIVE" maxRows={10} />
          </div>
        </div>

        {/* Row 3: CFTC COT + GDELT Geopolitical + Interbank Stress */}
        <div
          className="grid grid-cols-3 gap-2 mb-3"
          style={{ height: '450px' }}
        >
          <div className="animate-slide-up h-full overflow-hidden" style={{ animationDelay: '500ms' }}>
            <COTPanel />
          </div>
          <div className="animate-slide-up h-full overflow-hidden" style={{ animationDelay: '600ms' }}>
            <GDELTPanel />
          </div>
          <div className="animate-slide-up h-full overflow-hidden" style={{ animationDelay: '700ms' }}>
            <InterbankStressPanel />
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-2 pt-3 border-t border-terminal-border flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-[9px] text-terminal-muted tracking-wider">
              HEDGYYYBOO FX DESK v6.1
            </span>
            <span className="text-[9px] text-terminal-muted">|</span>
            <span className="text-[9px] text-hf-dim tracking-wider">
              OU {'\u2022'} HURST {'\u2022'} NEURAL SDE {'\u2022'} COT {'\u2022'} BIS {'\u2022'} GDELT {'\u2022'} SOFR/OIS {'\u2022'} CB NLP {'\u2022'} FF
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-hf-green" />
              <span className="text-[9px] text-hf-dim">FX DATA</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
              <span className="text-[9px] text-hf-dim">POSTGRES</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-hf-cyan" />
              <span className="text-[9px] text-hf-dim">CFTC</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
              <span className="text-[9px] text-hf-dim">GDELT</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-hf-amber" />
              <span className="text-[9px] text-hf-dim">torchsde</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
