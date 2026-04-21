'use client';

import { useState, useEffect, useCallback } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

interface Trade {
  trade_id: number;
  pair: string;
  direction: string;
  entry_price: number;
  current_price: number | null;
  pnl_pct: number;
  ou_half_life: number | null;
  hurst_exponent: number | null;
  neural_sde_drift: number | null;
  rationale: string | null;
  status: string;
  opened_at: string | null;
  closed_at: string | null;
  forex_factory_event: string | null;
  hawkish_score: number | null;
}

export default function TradeLedgerPanel() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchTrades = useCallback(async () => {
    try {
      const statusParam = filter === 'open' ? '?status=open' : '';
      const res = await fetch(`${API}/api/fx/trades${statusParam}`);
      const json = await res.json();
      if (json.trades) setTrades(json.trades);
    } catch (e) {
      console.error('Trade ledger fetch failed:', e);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  // Auto-refresh: update prices then fetch trades every 30s
  const autoRefresh = useCallback(async () => {
    try {
      await fetch(`${API}/api/fx/trades/refresh-prices`, { method: 'POST' }).catch(() => {});
    } catch {}
    await fetchTrades();
  }, [fetchTrades]);

  useEffect(() => {
    autoRefresh();
    const iv = setInterval(autoRefresh, 30000);
    return () => clearInterval(iv);
  }, [autoRefresh]);

  const refreshPrices = async () => {
    try {
      await fetch(`${API}/api/fx/trades/refresh-prices`, { method: 'POST' });
      await fetchTrades();
    } catch (e) {
      console.error('Price refresh failed:', e);
    }
  };

  const executeNewTrade = async () => {
    setExecuting(true);
    try {
      await fetch(`${API}/api/fx/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pair: 'EUR/USD' }),
      });
      await fetchTrades();
    } catch (e) {
      console.error('Trade execution failed:', e);
    } finally {
      setExecuting(false);
    }
  };

  const closeTrade = async (tradeId: number) => {
    try {
      await fetch(`${API}/api/fx/trades/${tradeId}/close`, { method: 'POST' });
      await fetchTrades();
    } catch (e) {
      console.error('Trade close failed:', e);
    }
  };

  const filteredTrades = filter === 'closed'
    ? trades.filter(t => t.status === 'CLOSED')
    : trades;

  const totalPnL = trades.filter(t => t.status === 'OPEN').reduce((sum, t) => sum + (t.pnl_pct || 0), 0);
  const openCount = trades.filter(t => t.status === 'OPEN').length;

  if (loading) {
    return (
      <div className="panel h-full flex flex-col">
        <div className="panel-header accent-green">
          <span>AUTONOMOUS TRADE LEDGER // POSTGRESQL</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-hf-green/30 border-t-hf-green rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header accent-green">
        <span>AUTONOMOUS TRADE LEDGER // POSTGRESQL</span>
        <span className="ml-auto text-[8px] text-hf-dim">{trades.length} TRADES</span>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Controls */}
        <div className="px-2 pt-2 flex items-center gap-2">
          <button
            onClick={executeNewTrade}
            disabled={executing}
            className="px-3 py-1 bg-hf-green/20 border border-hf-green/40 rounded text-[9px] text-hf-green font-bold hover:bg-hf-green/30 disabled:opacity-50 transition-all"
          >
            {executing ? 'EXECUTING...' : 'EXECUTE TRADE'}
          </button>
          <button
            onClick={refreshPrices}
            className="px-2 py-1 bg-terminal-dark border border-terminal-border rounded text-[8px] text-hf-dim hover:text-hf-white transition-all"
          >
            REFRESH PnL
          </button>
          <div className="ml-auto flex gap-1">
            {(['all', 'open', 'closed'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2 py-0.5 rounded text-[7px] font-bold tracking-wider ${
                  filter === f
                    ? 'bg-hf-green/20 border border-hf-green/40 text-hf-green'
                    : 'bg-terminal-dark/50 border border-terminal-border text-hf-dim'
                }`}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="px-2 pt-2 grid grid-cols-3 gap-2">
          <div className="bg-terminal-dark/50 rounded p-1.5 text-center">
            <div className="text-[7px] text-hf-dim">OPEN POSITIONS</div>
            <div className="text-sm font-bold text-hf-cyan font-mono">{openCount}</div>
          </div>
          <div className="bg-terminal-dark/50 rounded p-1.5 text-center">
            <div className="text-[7px] text-hf-dim">TOTAL PnL</div>
            <div className={`text-sm font-bold font-mono ${totalPnL >= 0 ? 'text-hf-green' : 'text-red-400'}`}>
              {totalPnL >= 0 ? '+' : ''}{totalPnL.toFixed(4)}%
            </div>
          </div>
          <div className="bg-terminal-dark/50 rounded p-1.5 text-center">
            <div className="text-[7px] text-hf-dim">TOTAL TRADES</div>
            <div className="text-sm font-bold text-hf-white font-mono">{trades.length}</div>
          </div>
        </div>

        {/* Trade table */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {/* Header */}
          <div className="grid grid-cols-12 gap-1 px-1 py-1 text-[7px] text-hf-dim tracking-wider border-b border-terminal-border">
            <div className="col-span-1">#</div>
            <div className="col-span-2">PAIR</div>
            <div className="col-span-1">DIR</div>
            <div className="col-span-2">ENTRY</div>
            <div className="col-span-2">CURRENT</div>
            <div className="col-span-2">PnL</div>
            <div className="col-span-2">STATUS</div>
          </div>

          {filteredTrades.length === 0 ? (
            <div className="text-center text-[9px] text-hf-dim py-6">NO TRADES</div>
          ) : (
            filteredTrades.map(trade => (
              <div key={trade.trade_id}>
                <div
                  className="grid grid-cols-12 gap-1 px-1 py-1.5 text-[9px] font-mono cursor-pointer hover:bg-terminal-dark/40 transition-all border-b border-terminal-border/30"
                  onClick={() => setExpandedId(expandedId === trade.trade_id ? null : trade.trade_id)}
                >
                  <div className="col-span-1 text-hf-dim">{trade.trade_id}</div>
                  <div className="col-span-2 text-hf-white font-bold">{trade.pair}</div>
                  <div className={`col-span-1 font-bold ${trade.direction === 'LONG' ? 'text-hf-green' : 'text-red-400'}`}>
                    {trade.direction}
                  </div>
                  <div className="col-span-2 text-hf-white/70">
                    {trade.entry_price.toFixed(trade.pair.includes('JPY') ? 3 : 5)}
                  </div>
                  <div className="col-span-2 text-hf-white/70">
                    {trade.current_price?.toFixed(trade.pair.includes('JPY') ? 3 : 5) || '-'}
                  </div>
                  <div className={`col-span-2 font-bold ${(trade.pnl_pct || 0) >= 0 ? 'text-hf-green' : 'text-red-400'}`}>
                    {(trade.pnl_pct || 0) >= 0 ? '+' : ''}{(trade.pnl_pct || 0).toFixed(4)}%
                  </div>
                  <div className="col-span-2">
                    <span className={`px-1 py-0.5 rounded text-[7px] ${
                      trade.status === 'OPEN'
                        ? 'bg-hf-green/20 text-hf-green border border-hf-green/30'
                        : 'bg-red-500/20 text-red-400 border border-red-500/30'
                    }`}>
                      {trade.status}
                    </span>
                  </div>
                </div>

                {/* Expanded details */}
                {expandedId === trade.trade_id && (
                  <div className="bg-terminal-dark/30 px-2 py-2 border-b border-terminal-border/30 space-y-1">
                    <div className="grid grid-cols-4 gap-2 text-[8px]">
                      <div>
                        <span className="text-hf-dim">OU H/L: </span>
                        <span className="text-hf-cyan">{trade.ou_half_life?.toFixed(1) || '-'}d</span>
                      </div>
                      <div>
                        <span className="text-hf-dim">HURST: </span>
                        <span className="text-hf-cyan">{trade.hurst_exponent?.toFixed(4) || '-'}</span>
                      </div>
                      <div>
                        <span className="text-hf-dim">SDE DRIFT: </span>
                        <span className="text-hf-cyan">{trade.neural_sde_drift?.toFixed(4) || '-'}</span>
                      </div>
                      <div>
                        <span className="text-hf-dim">CB SCORE: </span>
                        <span className="text-hf-cyan">{trade.hawkish_score?.toFixed(3) || '-'}</span>
                      </div>
                    </div>
                    {trade.rationale && (
                      <div className="text-[8px] text-hf-white/60 italic">
                        &ldquo;{trade.rationale}&rdquo;
                      </div>
                    )}
                    {trade.opened_at && (
                      <div className="text-[7px] text-hf-dim">
                        OPENED: {trade.opened_at.replace('T', ' ').slice(0, 19)}
                        {trade.closed_at && ` | CLOSED: ${trade.closed_at.replace('T', ' ').slice(0, 19)}`}
                      </div>
                    )}
                    {trade.status === 'OPEN' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); closeTrade(trade.trade_id); }}
                        className="px-2 py-0.5 bg-red-500/20 border border-red-500/40 rounded text-[8px] text-red-400 font-bold hover:bg-red-500/30 transition-all"
                      >
                        CLOSE POSITION
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
