'use client';

/**
 * TradeButton — compact BUY / SELL pair used inside every desk's watchlist
 * rows.  Posts to POST /api/trades/open which:
 *    1. Fetches the live price via yfinance for the desk/symbol.
 *    2. Inserts a row in the unified `paper_trades` table.
 *    3. Returns the trade dict so we can flash the UI with the entry price.
 *
 * The 60-second cron will then MTM this trade and apply stop-loss /
 * take-profit / time-stop rules; no extra wiring is needed.
 */

import { useCallback, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Loader2, X } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

export type Desk = 'FX' | 'EQUITY' | 'RATES';

interface TradeButtonProps {
  desk: Desk;
  symbol: string;                 // "EUR/USD" or "AAPL" or "UST10Y"
  /** Optional label override — defaults to "BUY" / "SELL" */
  buyLabel?: string;
  sellLabel?: string;
  /** Callback fired after the POST succeeds (so parent can refresh its trades list). */
  onTradeOpened?: (trade: { trade_id: number; entry_price: number; direction: string }) => void;
  /** Optional rationale to attach (defaults to "manual user trade"). */
  rationale?: string;
  size?: 'xs' | 'sm';
}

type FlashState = null | { kind: 'ok' | 'err'; text: string };

export default function TradeButton({
  desk,
  symbol,
  buyLabel = 'BUY',
  sellLabel = 'SELL',
  onTradeOpened,
  rationale,
  size = 'xs',
}: TradeButtonProps) {
  const [busy, setBusy] = useState<null | 'LONG' | 'SHORT'>(null);
  const [flash, setFlash] = useState<FlashState>(null);

  const submit = useCallback(async (direction: 'LONG' | 'SHORT') => {
    if (busy) return;
    setBusy(direction);
    setFlash(null);
    try {
      const res = await fetch(`${API_BASE}/api/trades/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          desk, symbol, direction,
          rationale: rationale || `Manual ${direction === 'LONG' ? buyLabel : sellLabel} on ${desk}/${symbol}`,
        }),
      });
      const body = await res.json().catch(() => ({} as Record<string, unknown>));
      if (!res.ok) {
        const bodyErr = body as { detail?: string };
        throw new Error(bodyErr.detail || `HTTP ${res.status}`);
      }
      const bodyOk = body as { trade?: { trade_id: number; entry_price: number; direction: string } };
      if (bodyOk.trade && onTradeOpened) onTradeOpened(bodyOk.trade);
      setFlash({
        kind: 'ok',
        text: bodyOk.trade ? `#${bodyOk.trade.trade_id} @ ${bodyOk.trade.entry_price.toFixed(5)}` : 'opened',
      });
    } catch (err) {
      setFlash({ kind: 'err', text: err instanceof Error ? err.message.slice(0, 40) : 'failed' });
    } finally {
      setBusy(null);
      setTimeout(() => setFlash(null), 5000);
    }
  }, [busy, desk, symbol, rationale, buyLabel, sellLabel, onTradeOpened]);

  const pad = size === 'sm' ? 'px-2 py-1 text-[10px]' : 'px-1.5 py-0.5 text-[9px]';
  const gap = size === 'sm' ? 'gap-1.5' : 'gap-1';

  return (
    <div className={`flex items-center ${gap}`}>
      <button
        type="button"
        onClick={() => submit('LONG')}
        disabled={!!busy}
        title={`${buyLabel} ${desk} ${symbol}`}
        className={`flex items-center gap-1 ${pad} font-bold tracking-wider rounded border border-hf-green/40 bg-hf-green/10 text-hf-green hover:bg-hf-green/25 disabled:opacity-40 transition-colors`}
      >
        {busy === 'LONG' ? <Loader2 size={10} className="animate-spin" /> : <ArrowUp size={10} />}
        {buyLabel}
      </button>
      <button
        type="button"
        onClick={() => submit('SHORT')}
        disabled={!!busy}
        title={`${sellLabel} ${desk} ${symbol}`}
        className={`flex items-center gap-1 ${pad} font-bold tracking-wider rounded border border-hf-red/40 bg-hf-red/10 text-hf-red hover:bg-hf-red/25 disabled:opacity-40 transition-colors`}
      >
        {busy === 'SHORT' ? <Loader2 size={10} className="animate-spin" /> : <ArrowDown size={10} />}
        {sellLabel}
      </button>
      {flash && (
        <span
          className={`flex items-center gap-1 text-[9px] ${
            flash.kind === 'ok' ? 'text-hf-green' : 'text-hf-red'
          }`}
          title={flash.text}
        >
          {flash.kind === 'ok' ? <Check size={10} /> : <X size={10} />}
          <span className="truncate max-w-[80px]">{flash.text}</span>
        </span>
      )}
    </div>
  );
}
