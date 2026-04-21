'use client';

/**
 * PositionsPanel — shows open positions from the unified paper_trades table.
 * Pass a desk prop to scope it to a specific desk (FX / EQUITY / RATES), or
 * omit it to show the whole book on the Main dashboard.  Polls every 15 s.
 */

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

export type Desk = 'FX' | 'EQUITY' | 'RATES';

interface Trade {
  trade_id: number;
  desk: string;
  symbol: string;
  direction: string;
  notional_usd: number;
  entry_price: number;
  current_price: number | null;
  pnl_pct: number | null;
  pnl_usd: number | null;
  rationale: string | null;
  status: string;
  close_reason: string | null;
  opened_at: string | null;
  closed_at: string | null;
}

interface PositionsPanelProps {
  desk?: Desk;                     // filter to this desk only, or unscoped
  title?: string;
  maxRows?: number;
}

export default function PositionsPanel({
  desk,
  title,
  maxRows = 12,
}: PositionsPanelProps) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const url = new URL(`${API_BASE}/api/trades`);
      url.searchParams.set('status', 'OPEN');
      if (desk) url.searchParams.set('desk', desk);
      url.searchParams.set('limit', '50');
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTrades(data.trades || []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'fetch failed');
    } finally {
      setLoading(false);
    }
  }, [desk]);

  useEffect(() => {
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [load]);

  const closeTrade = useCallback(async (tradeId: number) => {
    try {
      await fetch(`${API_BASE}/api/trades/${tradeId}/close?reason=MANUAL`, { method: 'POST' });
      await load();
    } catch (e) {
      console.error('close failed', e);
    }
  }, [load]);

  const header = title || (desk ? `OPEN POSITIONS — ${desk}` : 'OPEN POSITIONS');

  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header accent-cyan">
        <span>{header}</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[9px] text-terminal-muted">{trades.length} open</span>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1 px-2 py-0.5 bg-terminal-black border border-terminal-border rounded text-[9px] text-hf-dim hover:text-hf-cyan hover:border-hf-cyan/30 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={9} className={loading ? 'animate-spin' : ''} />
            REFRESH
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-terminal-black/50">
        {err && (
          <div className="p-3 text-[10px] text-hf-red tracking-wider">ERROR: {err}</div>
        )}

        {trades.length === 0 && !err && !loading && (
          <div className="flex items-center justify-center h-full text-[10px] text-hf-dim tracking-wider">
            {desk ? `No open ${desk} positions — use BUY/SELL buttons to open one` : 'Book empty'}
          </div>
        )}

        {trades.length > 0 && (
          <table className="w-full text-[10px] tabular-nums">
            <thead className="sticky top-0 bg-terminal-dark border-b border-terminal-border text-hf-dim">
              <tr>
                <th className="text-left py-1.5 px-2 font-semibold">#</th>
                {!desk && <th className="text-left py-1.5 px-2 font-semibold">Desk</th>}
                <th className="text-left py-1.5 px-2 font-semibold">Sym</th>
                <th className="text-left py-1.5 px-2 font-semibold">Dir</th>
                <th className="text-right py-1.5 px-2 font-semibold">Entry</th>
                <th className="text-right py-1.5 px-2 font-semibold">Mark</th>
                <th className="text-right py-1.5 px-2 font-semibold">PnL %</th>
                <th className="text-right py-1.5 px-2 font-semibold">PnL $</th>
                <th className="text-center py-1.5 px-2 font-semibold">Close</th>
              </tr>
            </thead>
            <tbody>
              {trades.slice(0, maxRows).map(t => (
                <tr key={t.trade_id} className="border-b border-terminal-border/50 hover:bg-terminal-dark/50">
                  <td className="py-1 px-2 text-hf-dim">{t.trade_id}</td>
                  {!desk && <td className="py-1 px-2 text-hf-cyan">{t.desk}</td>}
                  <td className="py-1 px-2 text-hf-white">{t.symbol}</td>
                  <td className={`py-1 px-2 font-bold ${t.direction === 'LONG' ? 'text-hf-green' : 'text-hf-red'}`}>
                    {t.direction === 'LONG' ? 'LNG' : 'SHT'}
                  </td>
                  <td className="py-1 px-2 text-right text-hf-white">{t.entry_price?.toFixed(5)}</td>
                  <td className="py-1 px-2 text-right text-hf-white">
                    {t.current_price !== null ? t.current_price.toFixed(5) : '—'}
                  </td>
                  <td className={`py-1 px-2 text-right font-bold ${
                    (t.pnl_pct ?? 0) >= 0 ? 'text-hf-green' : 'text-hf-red'
                  }`}>
                    {t.pnl_pct !== null ? `${t.pnl_pct >= 0 ? '+' : ''}${t.pnl_pct.toFixed(2)}%` : '—'}
                  </td>
                  <td className={`py-1 px-2 text-right ${
                    (t.pnl_usd ?? 0) >= 0 ? 'text-hf-green' : 'text-hf-red'
                  }`}>
                    {t.pnl_usd !== null ? `${t.pnl_usd >= 0 ? '+' : ''}$${Math.abs(t.pnl_usd).toFixed(0)}` : '—'}
                  </td>
                  <td className="py-1 px-2 text-center">
                    <button
                      type="button"
                      onClick={() => closeTrade(t.trade_id)}
                      title="Close at market"
                      className="p-0.5 rounded border border-hf-dim/30 text-hf-dim hover:text-hf-red hover:border-hf-red/50 transition-colors"
                    >
                      <X size={10} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
