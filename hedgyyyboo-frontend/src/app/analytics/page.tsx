'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  LineChart, Line, ResponsiveContainer,
  XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
} from 'recharts';
import { ArrowLeft, Brain, RefreshCw, Download } from 'lucide-react';

import TopBar from '@/components/TopBar';
import Sidebar from '@/components/Sidebar';
import TickerTape from '@/components/TickerTape';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

interface PortfolioSummary {
  as_of: string;
  aum_usd: number;
  seed_cash_usd: number;
  gross_exposure_usd: number;
  open_positions: number;
  closed_trades: number;
  open_by_desk: Record<string, number>;
  unrealised_usd: number;
  realised_usd: number;
  unrealised_pct_of_aum: number;
  realised_sharpe: number | null;
  alpha_pct: number | null;
  vix: number | null;
  risk_score: number;
}

interface Trade {
  trade_id: number;
  desk: string;
  symbol: string;
  direction: string;
  notional_usd: number;
  entry_price: number;
  current_price: number | null;
  pnl_pct: number;
  pnl_usd: number;
  rationale: string | null;
  status: string;
  close_reason: string | null;
  opened_at: string | null;
  closed_at: string | null;
  meta: Record<string, unknown> | null;
}

interface MLStatus {
  ready: boolean;
  trades_with_signal_packet?: number;
  trades_min_required?: number;
  positive_class_rate?: number;
  sample_size?: number;
  train_size?: number;
  val_size?: number;
  trained_at?: string;
  val_auc?: number;
  val_accuracy?: number;
  train_accuracy?: number;
  top_features?: { name: string; importance: number }[];
  reason?: string;
}

function fmtUsd(n: number) {
  return (n >= 0 ? '+$' : '-$') + Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
}
function fmtPct(n: number, decimals = 3) {
  return (n >= 0 ? '+' : '') + n.toFixed(decimals) + '%';
}

// Build a cumulative-realised-PnL equity curve from closed trades,
// chronologically earliest → latest.
function buildEquityCurve(trades: Trade[], seedCash: number) {
  const closed = trades
    .filter((t) => t.status === 'CLOSED' && t.closed_at)
    .slice()
    .sort((a, b) => (a.closed_at! < b.closed_at! ? -1 : 1));

  let running = seedCash;
  let peak = seedCash;
  const points = [{ t: 'start', equity: seedCash, drawdown: 0 }];
  for (const tr of closed) {
    running += tr.pnl_usd || 0;
    peak = Math.max(peak, running);
    points.push({
      t: (tr.closed_at || '').slice(0, 16).replace('T', ' '),
      equity: Math.round(running * 100) / 100,
      drawdown: Math.round(((running - peak) / peak) * 10000) / 100, // %
    });
  }
  return points;
}

export default function Analytics() {
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [mlStatus, setMlStatus] = useState<MLStatus | null>(null);
  const [mlBusy, setMlBusy] = useState(false);
  const [backfillBusy, setBackfillBusy] = useState(false);
  const [backfillSummary, setBackfillSummary] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    try {
      const [pRes, tRes, mRes] = await Promise.all([
        fetch(`${API}/api/portfolio/summary`),
        fetch(`${API}/api/trades?limit=500`),
        fetch(`${API}/api/ml/status`),
      ]);
      if (pRes.ok) setPortfolio(await pRes.json());
      if (tRes.ok) {
        const j = await tRes.json();
        setTrades(j.trades || []);
      }
      if (mRes.ok) setMlStatus(await mRes.json());
    } catch (e) {
      console.error('analytics load failed:', e);
    }
  }, []);

  useEffect(() => {
    loadAll();
    const iv = setInterval(loadAll, 15_000);
    return () => clearInterval(iv);
  }, [loadAll]);

  const retrainModel = useCallback(async () => {
    setMlBusy(true);
    try {
      const r = await fetch(`${API}/api/ml/train`, { method: 'POST' });
      if (r.ok) setMlStatus(await r.json());
    } catch (e) {
      console.error('ml train failed:', e);
    } finally {
      setMlBusy(false);
    }
  }, []);

  const runBackfill = useCallback(async () => {
    setBackfillBusy(true);
    setBackfillSummary('Walking 2 years of history for every watchlist symbol…');
    try {
      const r = await fetch(`${API}/api/ml/backfill?years=2`, { method: 'POST' });
      const j = await r.json();
      if (r.ok) {
        setBackfillSummary(
          `Generated ${j.total_samples} synthetic trades in ${j.elapsed_s}s. Retraining…`
        );
        // retrain once backfill lands
        const tr = await fetch(`${API}/api/ml/train`, { method: 'POST' });
        if (tr.ok) setMlStatus(await tr.json());
      } else {
        setBackfillSummary(`Backfill failed: ${j.detail || j.reason || 'unknown'}`);
      }
    } catch (e) {
      setBackfillSummary(`Backfill error: ${String(e)}`);
    } finally {
      setBackfillBusy(false);
    }
  }, []);

  const openTrades = useMemo(() => trades.filter((t) => t.status === 'OPEN'), [trades]);
  const closedTrades = useMemo(() => trades.filter((t) => t.status === 'CLOSED'), [trades]);
  const equityCurve = useMemo(
    () => buildEquityCurve(trades, portfolio?.seed_cash_usd ?? 1_000_000),
    [trades, portfolio?.seed_cash_usd]
  );
  const seed = portfolio?.seed_cash_usd ?? 1_000_000;

  // Per-desk PnL breakdown
  const pnlByDesk = useMemo(() => {
    const m: Record<string, { realised: number; unrealised: number; open: number; closed: number }> = {};
    for (const t of trades) {
      const k = t.desk;
      m[k] = m[k] || { realised: 0, unrealised: 0, open: 0, closed: 0 };
      if (t.status === 'OPEN') {
        m[k].unrealised += t.pnl_usd || 0;
        m[k].open += 1;
      } else {
        m[k].realised += t.pnl_usd || 0;
        m[k].closed += 1;
      }
    }
    return m;
  }, [trades]);

  return (
    <div className="min-h-screen bg-terminal-black">
      <TickerTape />
      <TopBar />
      <Sidebar />
      <main className="ml-[60px] pt-[76px] px-3 pb-6">
        {/* Title bar */}
        <div className="panel mb-3">
          <div className="panel-header accent-green flex items-center">
            <Link href="/" className="flex items-center gap-1 text-hf-dim hover:text-hf-green text-[10px]">
              <ArrowLeft size={12} /> DASHBOARD
            </Link>
            <span className="ml-4 text-hf-green font-bold tracking-widest">ANALYTICS</span>
            <span className="ml-2 text-hf-dim text-[9px]">/ live positions · equity curve · ML screener</span>
          </div>
        </div>

        {/* Summary tiles */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          <Tile label="AUM" value={`$${((portfolio?.aum_usd ?? seed) / 1_000_000).toFixed(3)}M`} sub={`seed $${(seed/1_000_000).toFixed(2)}M`} />
          <Tile label="Realised PnL" value={fmtUsd(portfolio?.realised_usd ?? 0)} sub={`${portfolio?.closed_trades ?? 0} closed`} />
          <Tile label="Unrealised" value={fmtUsd(portfolio?.unrealised_usd ?? 0)} sub={`${portfolio?.open_positions ?? 0} open`} />
          <Tile label="Realised Sharpe" value={portfolio?.realised_sharpe != null ? portfolio.realised_sharpe.toFixed(2) : 'N/A'} sub={portfolio?.closed_trades && portfolio.closed_trades > 0 ? '√252 annualised' : 'need closed trades'} />
        </div>

        {/* Per-desk breakdown */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {(['FX', 'EQUITY', 'RATES'] as const).map((desk) => {
            const d = pnlByDesk[desk] || { realised: 0, unrealised: 0, open: 0, closed: 0 };
            return (
              <div key={desk} className="panel p-3">
                <div className="text-[10px] text-hf-dim tracking-widest">{desk}</div>
                <div className="grid grid-cols-2 gap-2 mt-2 text-[10px]">
                  <div>
                    <div className="text-hf-dim">REALISED</div>
                    <div className={`font-bold ${d.realised >= 0 ? 'text-hf-green' : 'text-hf-red'}`}>{fmtUsd(d.realised)}</div>
                    <div className="text-[8px] text-hf-dim">{d.closed} closed</div>
                  </div>
                  <div>
                    <div className="text-hf-dim">UNREALISED</div>
                    <div className={`font-bold ${d.unrealised >= 0 ? 'text-hf-green' : 'text-hf-red'}`}>{fmtUsd(d.unrealised)}</div>
                    <div className="text-[8px] text-hf-dim">{d.open} open</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Equity curve + ML card */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {/* Equity curve spans 2 cols */}
          <div className="col-span-2 panel p-3" style={{ height: 300 }}>
            <div className="flex items-center mb-2">
              <span className="text-[10px] text-hf-dim tracking-widest">REALISED EQUITY CURVE</span>
              <span className="ml-auto text-[8px] text-hf-dim">{closedTrades.length} closed trades</span>
            </div>
            <ResponsiveContainer width="100%" height="90%">
              <LineChart data={equityCurve}>
                <CartesianGrid stroke="#1b2942" strokeDasharray="3 3" />
                <XAxis dataKey="t" hide />
                <YAxis domain={['dataMin', 'dataMax']} tick={{ fill: '#8aa0b8', fontSize: 9 }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: '#0a0f1c', border: '1px solid #1b2942', fontSize: 10 }}
                  formatter={(val: number) => [`$${Math.round(val).toLocaleString()}`, 'Equity']}
                />
                <ReferenceLine y={seed} stroke="#555" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="equity" stroke="#00ff9f" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* ML status */}
          <MLCard
            status={mlStatus}
            onRetrain={retrainModel}
            busy={mlBusy}
            onBackfill={runBackfill}
            backfillBusy={backfillBusy}
            backfillSummary={backfillSummary}
          />
        </div>

        {/* Open Positions */}
        <div className="panel mb-3">
          <div className="panel-header accent-cyan">
            <span>OPEN POSITIONS</span>
            <span className="ml-auto text-[9px] text-hf-dim">{openTrades.length} live</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px] font-mono">
              <thead className="text-hf-dim border-b border-terminal-border">
                <tr>
                  <Th>#</Th><Th>DESK</Th><Th>DIR</Th><Th>SYMBOL</Th>
                  <Th className="text-right">ENTRY</Th>
                  <Th className="text-right">MARK</Th>
                  <Th className="text-right">PnL %</Th>
                  <Th className="text-right">PnL $</Th>
                  <Th>OPENED</Th>
                  <Th>RATIONALE</Th>
                </tr>
              </thead>
              <tbody>
                {openTrades.length === 0 ? (
                  <tr><td colSpan={10} className="text-center py-4 text-hf-dim">No open positions</td></tr>
                ) : openTrades.map((t) => (
                  <tr key={t.trade_id} className="border-b border-terminal-border/30 hover:bg-terminal-dark/40">
                    <Td>{t.trade_id}</Td>
                    <Td>{t.desk}</Td>
                    <Td className={t.direction === 'LONG' ? 'text-hf-green' : 'text-hf-red'}>{t.direction}</Td>
                    <Td className="font-bold">{t.symbol}</Td>
                    <Td className="text-right">{t.entry_price.toFixed(5)}</Td>
                    <Td className="text-right">{(t.current_price ?? 0).toFixed(5)}</Td>
                    <Td className={`text-right font-bold ${t.pnl_pct >= 0 ? 'text-hf-green' : 'text-hf-red'}`}>{fmtPct(t.pnl_pct)}</Td>
                    <Td className={`text-right font-bold ${t.pnl_usd >= 0 ? 'text-hf-green' : 'text-hf-red'}`}>{fmtUsd(t.pnl_usd)}</Td>
                    <Td className="text-[9px] text-hf-dim">{(t.opened_at || '').slice(0, 16).replace('T',' ')}</Td>
                    <Td className="text-[9px] text-hf-dim truncate max-w-[280px]" title={t.rationale || ''}>{(t.rationale || '').slice(0, 80)}{(t.rationale || '').length > 80 ? '…' : ''}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Closed trade history */}
        <div className="panel">
          <div className="panel-header accent-amber">
            <span>CLOSED TRADES</span>
            <span className="ml-auto text-[9px] text-hf-dim">{closedTrades.length} total</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px] font-mono">
              <thead className="text-hf-dim border-b border-terminal-border">
                <tr>
                  <Th>#</Th><Th>DESK</Th><Th>DIR</Th><Th>SYMBOL</Th>
                  <Th className="text-right">ENTRY</Th><Th className="text-right">EXIT</Th>
                  <Th className="text-right">PnL %</Th><Th className="text-right">PnL $</Th>
                  <Th>REASON</Th><Th>CLOSED</Th>
                </tr>
              </thead>
              <tbody>
                {closedTrades.map((t) => (
                  <tr key={t.trade_id} className="border-b border-terminal-border/30 hover:bg-terminal-dark/40">
                    <Td>{t.trade_id}</Td>
                    <Td>{t.desk}</Td>
                    <Td className={t.direction === 'LONG' ? 'text-hf-green' : 'text-hf-red'}>{t.direction}</Td>
                    <Td className="font-bold">{t.symbol}</Td>
                    <Td className="text-right">{t.entry_price.toFixed(5)}</Td>
                    <Td className="text-right">{(t.current_price ?? 0).toFixed(5)}</Td>
                    <Td className={`text-right font-bold ${t.pnl_pct >= 0 ? 'text-hf-green' : 'text-hf-red'}`}>{fmtPct(t.pnl_pct)}</Td>
                    <Td className={`text-right font-bold ${t.pnl_usd >= 0 ? 'text-hf-green' : 'text-hf-red'}`}>{fmtUsd(t.pnl_usd)}</Td>
                    <Td className="text-[9px] text-hf-amber">{t.close_reason}</Td>
                    <Td className="text-[9px] text-hf-dim">{(t.closed_at || '').slice(0, 16).replace('T',' ')}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-2 py-1.5 text-left tracking-widest text-[8px] ${className}`}>{children}</th>;
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-2 py-1.5 ${className}`}>{children}</td>;
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="panel p-3">
      <div className="text-[9px] text-hf-dim tracking-widest">{label}</div>
      <div className="text-xl font-bold text-hf-green tabular-nums">{value}</div>
      {sub && <div className="text-[9px] text-hf-dim mt-0.5">{sub}</div>}
    </div>
  );
}

function MLCard({
  status,
  onRetrain,
  busy,
  onBackfill,
  backfillBusy,
  backfillSummary,
}: {
  status: MLStatus | null;
  onRetrain: () => void;
  busy: boolean;
  onBackfill: () => void;
  backfillBusy: boolean;
  backfillSummary: string | null;
}) {
  const ready = status?.ready ?? false;
  const collected = status?.trades_with_signal_packet ?? 0;
  const required = status?.trades_min_required ?? 50;
  const pct = required > 0 ? Math.min(100, Math.round((collected / required) * 100)) : 0;
  return (
    <div className="panel p-3 flex flex-col" style={{ height: 300 }}>
      <div className="flex items-center gap-2">
        <Brain size={14} className="text-hf-cyan" />
        <span className="text-[10px] tracking-widest text-hf-cyan">XGBOOST SCREENER</span>
        <div className="ml-auto flex gap-1">
          <button
            onClick={onBackfill}
            disabled={backfillBusy || busy}
            title="Walk 2y of history and generate synthetic trades per watchlist symbol"
            className="px-2 py-0.5 bg-hf-green/10 border border-hf-green/40 rounded text-[8px] text-hf-green hover:bg-hf-green/20 disabled:opacity-50 flex items-center gap-1"
          >
            <RefreshCw size={9} className={backfillBusy ? 'animate-spin' : ''} />
            BACKFILL 2Y
          </button>
          <button
            onClick={onRetrain}
            disabled={busy || backfillBusy}
            className="px-2 py-0.5 bg-hf-cyan/10 border border-hf-cyan/40 rounded text-[8px] text-hf-cyan hover:bg-hf-cyan/20 disabled:opacity-50 flex items-center gap-1"
          >
            <RefreshCw size={9} className={busy ? 'animate-spin' : ''} />
            RETRAIN
          </button>
          <a
            href={`${API}/api/ml/download`}
            download
            className={`px-2 py-0.5 rounded text-[8px] flex items-center gap-1 ${
              status?.ready
                ? 'bg-hf-amber/10 border border-hf-amber/40 text-hf-amber hover:bg-hf-amber/20'
                : 'bg-terminal-dark/50 border border-terminal-border text-hf-dim pointer-events-none opacity-40'
            }`}
            title="Download the trained .pkl artifact"
          >
            <Download size={9} /> .PKL
          </a>
        </div>
      </div>
      <div className="text-[8px] text-hf-dim italic mt-0.5">
        Training-only artifact — NOT used to gate live trades.
      </div>
      {backfillSummary && (
        <div className="text-[9px] text-hf-amber mt-1 italic truncate">{backfillSummary}</div>
      )}

      {!ready ? (
        <div className="flex-1 flex flex-col justify-center items-center text-center">
          <div className="text-[11px] text-hf-dim mb-2">Collecting data</div>
          <div className="w-full bg-terminal-dark rounded h-2 mb-2">
            <div className="bg-hf-cyan h-2 rounded transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="text-[10px] text-hf-white">
            <span className="text-hf-cyan font-bold">{collected}</span>
            <span className="text-hf-dim"> / {required} closed trades with signal packet</span>
          </div>
          <div className="text-[9px] text-hf-dim mt-2 px-2">
            The screener will auto-train once this fills. Until then the auto-PM
            calls Gemma on every candidate (no ML gate).
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col justify-between text-[10px]">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
            <Metric label="val AUC"       value={status?.val_auc?.toFixed(3) ?? '—'} />
            <Metric label="val accuracy"  value={status?.val_accuracy?.toFixed(3) ?? '—'} />
            <Metric label="sample size"   value={String(status?.sample_size ?? 0)} />
            <Metric label="positive rate" value={status?.positive_class_rate?.toFixed(2) ?? '—'} />
          </div>
          <div className="mt-2">
            <div className="text-[9px] text-hf-dim mb-1">TOP FEATURES</div>
            {(status?.top_features ?? []).slice(0, 5).map((f) => (
              <div key={f.name} className="flex items-center text-[9px]">
                <span className="text-hf-white w-40 truncate">{f.name}</span>
                <div className="flex-1 bg-terminal-dark rounded h-1 mx-2">
                  <div className="bg-hf-cyan h-1 rounded" style={{ width: `${Math.min(100, f.importance * 100)}%` }} />
                </div>
                <span className="text-hf-dim tabular-nums">{f.importance.toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="text-[8px] text-hf-dim mt-2">
            Trained: {status?.trained_at?.slice(0, 16).replace('T', ' ') ?? '—'}
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[8px] text-hf-dim uppercase tracking-widest">{label}</div>
      <div className="text-sm font-bold text-hf-white tabular-nums">{value}</div>
    </div>
  );
}
