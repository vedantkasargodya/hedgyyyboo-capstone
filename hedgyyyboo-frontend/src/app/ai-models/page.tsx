'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Brain, Activity, Zap, Download } from 'lucide-react';

import TopBar from '@/components/TopBar';
import Sidebar from '@/components/Sidebar';
import TickerTape from '@/components/TickerTape';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

interface RecentCall {
  ts: string;
  endpoint: string;
  ok: boolean;
  status_code: number | null;
  latency_ms: number;
  tokens_prompt: number;
  tokens_completion: number;
  model: string | null;
  decision: string | null;
  prompt_preview: string;
  response_preview: string;
  error: string | null;
}

interface EndpointAgg {
  requests: number;
  success: number;
  failure: number;
  tokens_prompt: number;
  tokens_completion: number;
  latency_ms: number;
}

interface LLMStats {
  started_at: string;
  requests_total: number;
  requests_success: number;
  requests_failure: number;
  tokens_prompt: number;
  tokens_completion: number;
  latency_total_ms: number;
  decisions: Record<string, number>;
  by_endpoint: Record<string, EndpointAgg>;
  recent: RecentCall[];
}

interface MLStatus {
  ready: boolean;
  trades_with_signal_packet?: number;
  trades_min_required?: number;
  sample_size?: number;
  trained_at?: string;
  val_auc?: number;
  val_accuracy?: number;
  train_accuracy?: number;
  top_features?: { name: string; importance: number }[];
  reason?: string;
}

export default function AIModels() {
  const [stats, setStats] = useState<LLMStats | null>(null);
  const [mlStatus, setMlStatus] = useState<MLStatus | null>(null);

  const load = useCallback(async () => {
    try {
      const [sRes, mRes] = await Promise.all([
        fetch(`${API}/api/llm/stats`),
        fetch(`${API}/api/ml/status`),
      ]);
      if (sRes.ok) setStats(await sRes.json());
      if (mRes.ok) setMlStatus(await mRes.json());
    } catch (e) {
      console.error('ai-models load failed:', e);
    }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 5_000);
    return () => clearInterval(iv);
  }, [load]);

  const total = stats?.requests_total ?? 0;
  const success = stats?.requests_success ?? 0;
  const failure = stats?.requests_failure ?? 0;
  const avgLatency = total > 0 ? Math.round((stats!.latency_total_ms || 0) / total) : 0;
  const tokensTotal = (stats?.tokens_prompt ?? 0) + (stats?.tokens_completion ?? 0);

  return (
    <div className="min-h-screen bg-terminal-black">
      <TickerTape />
      <TopBar />
      <Sidebar />
      <main className="ml-[60px] pt-[76px] px-3 pb-6">
        <div className="panel mb-3">
          <div className="panel-header accent-amber flex items-center">
            <Link href="/" className="flex items-center gap-1 text-hf-dim hover:text-hf-amber text-[10px]">
              <ArrowLeft size={12} /> DASHBOARD
            </Link>
            <span className="ml-4 text-hf-amber font-bold tracking-widest">AI MODELS</span>
            <span className="ml-2 text-hf-dim text-[9px]">/ Gemma-3n call stats + XGBoost trade screener</span>
          </div>
        </div>

        {/* Top stat tiles */}
        <div className="grid grid-cols-5 gap-2 mb-3">
          <Tile label="TOTAL REQUESTS" value={String(total)} sub={`${success} ok · ${failure} fail`} />
          <Tile label="AVG LATENCY" value={avgLatency ? `${avgLatency} ms` : '—'} sub="per call" />
          <Tile label="PROMPT TOKENS" value={(stats?.tokens_prompt ?? 0).toLocaleString()} sub="sent to Gemma" />
          <Tile label="COMPLETION TOKENS" value={(stats?.tokens_completion ?? 0).toLocaleString()} sub="from Gemma" />
          <Tile label="TOTAL TOKENS" value={tokensTotal.toLocaleString()} sub="this session" />
        </div>

        {/* Decision tally + per-endpoint */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="panel p-3">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={14} className="text-hf-green" />
              <span className="text-[10px] tracking-widest text-hf-green">DECISION TALLY (AUTO-PM)</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {(['BUY', 'SELL', 'HOLD', 'OTHER'] as const).map((d) => (
                <div key={d} className="bg-terminal-dark/50 rounded p-2">
                  <div className="text-[8px] text-hf-dim tracking-widest">{d}</div>
                  <div className="text-lg font-bold text-hf-white tabular-nums">{stats?.decisions?.[d] ?? 0}</div>
                </div>
              ))}
            </div>
            <div className="text-[9px] text-hf-dim mt-3">
              Only decisions made by the auto-PM ⟶ trade engine are counted here. Conversational PM queries (Ask-PM) do not produce BUY/SELL labels.
            </div>
          </div>

          <div className="panel p-3">
            <div className="flex items-center gap-2 mb-2">
              <Activity size={14} className="text-hf-cyan" />
              <span className="text-[10px] tracking-widest text-hf-cyan">BY ENDPOINT</span>
            </div>
            <div className="overflow-auto max-h-44">
              <table className="w-full text-[9px] font-mono">
                <thead className="text-hf-dim tracking-widest">
                  <tr>
                    <Th>endpoint</Th><Th className="text-right">req</Th>
                    <Th className="text-right">ok</Th><Th className="text-right">fail</Th>
                    <Th className="text-right">avg ms</Th><Th className="text-right">tokens</Th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(stats?.by_endpoint ?? {}).map(([k, v]) => (
                    <tr key={k} className="border-b border-terminal-border/30">
                      <Td className="truncate max-w-[220px]" title={k}>{k}</Td>
                      <Td className="text-right">{v.requests}</Td>
                      <Td className="text-right text-hf-green">{v.success}</Td>
                      <Td className="text-right text-hf-red">{v.failure}</Td>
                      <Td className="text-right">{v.requests ? Math.round(v.latency_ms / v.requests) : 0}</Td>
                      <Td className="text-right">{(v.tokens_prompt + v.tokens_completion).toLocaleString()}</Td>
                    </tr>
                  ))}
                  {Object.keys(stats?.by_endpoint ?? {}).length === 0 && (
                    <tr><td colSpan={6} className="text-center py-3 text-hf-dim">no LLM calls yet this session</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ML card */}
        <div className="panel p-3 mb-3">
          <div className="flex items-center gap-2 mb-2">
            <Brain size={14} className="text-hf-cyan" />
            <span className="text-[10px] tracking-widest text-hf-cyan">XGBOOST TRADE SCREENER</span>
            <span className="ml-2 text-[9px] text-hf-dim">(training-only artifact — NOT used to gate live trades)</span>
            <a
              href={`${API}/api/ml/download`}
              download
              className={`ml-auto px-2 py-0.5 rounded text-[8px] flex items-center gap-1 ${
                mlStatus?.ready
                  ? 'bg-hf-green/10 border border-hf-green/40 text-hf-green hover:bg-hf-green/20'
                  : 'bg-terminal-dark/50 border border-terminal-border text-hf-dim pointer-events-none opacity-40'
              }`}
            >
              <Download size={9} /> DOWNLOAD .PKL
            </a>
          </div>

          {!mlStatus?.ready ? (
            <div className="text-[10px] text-hf-dim">
              {mlStatus?.reason || 'collecting data'} — go to Analytics to run BACKFILL 2Y and train.
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-3">
              <Metric label="samples"      value={String(mlStatus.sample_size ?? 0)} />
              <Metric label="val AUC"      value={mlStatus.val_auc != null ? mlStatus.val_auc.toFixed(3) : '—'} />
              <Metric label="val accuracy" value={mlStatus.val_accuracy != null ? mlStatus.val_accuracy.toFixed(3) : '—'} />
              <Metric label="train acc"    value={mlStatus.train_accuracy != null ? mlStatus.train_accuracy.toFixed(3) : '—'} />
              <Metric label="trained at"   value={(mlStatus.trained_at || '').slice(0, 16).replace('T', ' ') || '—'} />
            </div>
          )}
        </div>

        {/* Recent call feed */}
        <div className="panel">
          <div className="panel-header accent-amber">
            <span>RECENT CALLS</span>
            <span className="ml-auto text-[9px] text-hf-dim">{stats?.recent?.length ?? 0} logged</span>
          </div>
          <div className="overflow-auto max-h-[500px]">
            <table className="w-full text-[9px] font-mono">
              <thead className="text-hf-dim sticky top-0 bg-terminal-dark">
                <tr>
                  <Th>ts</Th><Th>endpoint</Th><Th className="text-right">status</Th>
                  <Th className="text-right">ms</Th><Th className="text-right">p_tok</Th>
                  <Th className="text-right">c_tok</Th><Th>decision</Th>
                  <Th>response preview</Th>
                </tr>
              </thead>
              <tbody>
                {(stats?.recent ?? []).map((r, i) => (
                  <tr key={i} className="border-b border-terminal-border/30 hover:bg-terminal-dark/40 align-top">
                    <Td className="text-hf-dim">{r.ts.slice(11, 19)}</Td>
                    <Td className="max-w-[200px] truncate" title={r.endpoint}>{r.endpoint}</Td>
                    <Td className={`text-right ${r.ok ? 'text-hf-green' : 'text-hf-red'}`}>{r.status_code ?? (r.ok ? 'ok' : 'err')}</Td>
                    <Td className="text-right">{r.latency_ms}</Td>
                    <Td className="text-right">{r.tokens_prompt}</Td>
                    <Td className="text-right">{r.tokens_completion}</Td>
                    <Td className={r.decision === 'BUY' ? 'text-hf-green' : r.decision === 'SELL' ? 'text-hf-red' : 'text-hf-dim'}>{r.decision || '—'}</Td>
                    <Td className="text-hf-dim max-w-[400px] truncate" title={r.response_preview || r.error || ''}>
                      {(r.ok ? r.response_preview : r.error) || '—'}
                    </Td>
                  </tr>
                ))}
                {(stats?.recent ?? []).length === 0 && (
                  <tr><td colSpan={8} className="text-center py-6 text-hf-dim">no recent calls</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="panel p-3">
      <div className="text-[9px] text-hf-dim tracking-widest">{label}</div>
      <div className="text-xl font-bold text-hf-amber tabular-nums">{value}</div>
      {sub && <div className="text-[9px] text-hf-dim mt-0.5">{sub}</div>}
    </div>
  );
}
function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-2 py-1.5 text-left tracking-widest text-[8px] ${className}`}>{children}</th>;
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-2 py-1.5 ${className}`}>{children}</td>;
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] text-hf-dim tracking-widest">{label}</div>
      <div className="text-base font-bold text-hf-white tabular-nums">{value}</div>
    </div>
  );
}
