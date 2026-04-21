'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowLeft, Ship, MapPin, Send, Loader2 } from 'lucide-react';

import TopBar from '@/components/TopBar';
import Sidebar from '@/components/Sidebar';
import TickerTape from '@/components/TickerTape';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

// Cheap low-res world topology from the MDN CDN used by the d3 examples.
// This is static JSON so no client-side key or tile server is needed.
const WORLD_TOPO_URL =
  'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

// react-simple-maps is imported dynamically so the route renders on the
// server without pulling the d3 stack into the SSR bundle.
const ComposableMap = dynamic(
  () => import('react-simple-maps').then((m) => m.ComposableMap),
  { ssr: false }
) as unknown as React.ComponentType<{ projection: string; projectionConfig: { scale: number; center: [number, number] }; style: React.CSSProperties; children: React.ReactNode }>;

const Geographies = dynamic(
  () => import('react-simple-maps').then((m) => m.Geographies),
  { ssr: false }
) as unknown as React.ComponentType<{ geography: string; children: (args: { geographies: Array<{ rsmKey: string; properties: Record<string, unknown> }> }) => React.ReactNode }>;

const Geography = dynamic(
  () => import('react-simple-maps').then((m) => m.Geography),
  { ssr: false }
) as unknown as React.ComponentType<{ geography: { rsmKey?: string; properties?: Record<string, unknown> }; fill?: string; stroke?: string; strokeWidth?: number; style?: Record<string, React.CSSProperties> }>;

const Marker = dynamic(
  () => import('react-simple-maps').then((m) => m.Marker),
  { ssr: false }
) as unknown as React.ComponentType<{ coordinates: [number, number]; children: React.ReactNode }>;


interface Ship {
  mmsi: number;
  lat: number | null;
  lon: number | null;
  speed_kn: number | null;
  course: number | null;
  ship_name: string | null;
  ship_type: number | null;
  destination: string | null;
  updated_at: string;
}

interface Chokepoint {
  name: string;
  count: number;
  description: string;
  bbox: { sw: [number, number]; ne: [number, number] };
  sample_ships: { name: string | null; type: number | null; dest: string | null }[];
}

interface StatusBlock {
  key_present: boolean;
  connected: boolean;
  ships_cached: number;
  last_error: string | null;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  ts: string;
}

const SUGGESTIONS = [
  'Are tanker flows through Hormuz elevated?',
  'Any unusual container traffic in Singapore vs Rotterdam?',
  'Given current marine + portfolio, should we BUY or SELL BRENT?',
  'Which chokepoint flow is most relevant to our USD/JPY position?',
];

export default function Research() {
  const [ships, setShips] = useState<Ship[]>([]);
  const [chokepoints, setChokepoints] = useState<Chokepoint[]>([]);
  const [status, setStatus] = useState<StatusBlock | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEnd = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try {
      const [sRes, cRes] = await Promise.all([
        fetch(`${API}/api/research/ships?limit=800`),
        fetch(`${API}/api/research/chokepoints`),
      ]);
      if (sRes.ok) {
        const j = await sRes.json();
        setShips(j.ships || []);
        setStatus(j.status);
      }
      if (cRes.ok) {
        const j = await cRes.json();
        setChokepoints(j.chokepoints || []);
      }
    } catch (e) {
      console.error('research load failed:', e);
    }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 15_000);
    return () => clearInterval(iv);
  }, [load]);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendChat = useCallback(
    async (q?: string) => {
      const text = (q ?? input).trim();
      if (!text || sending) return;
      setInput('');
      const userMsg: ChatMessage = {
        id: 'u' + Date.now(),
        role: 'user',
        content: text,
        ts: new Date().toISOString(),
      };
      setMessages((m) => [...m, userMsg]);
      setSending(true);
      try {
        const res = await fetch(`${API}/api/research/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: text }),
        });
        const j = await res.json();
        const reply = (j?.reply || j?.detail || 'No reply').toString();
        setMessages((m) => [
          ...m,
          { id: 'a' + Date.now(), role: 'assistant', content: reply, ts: new Date().toISOString() },
        ]);
      } catch (e) {
        setMessages((m) => [
          ...m,
          { id: 'e' + Date.now(), role: 'assistant', content: `Error: ${String(e)}`, ts: new Date().toISOString() },
        ]);
      } finally {
        setSending(false);
      }
    },
    [input, sending]
  );

  const totalShips = ships.length;
  const totalAtChokepoints = chokepoints.reduce((acc, c) => acc + c.count, 0);
  const mostBusyChoke = useMemo(() => {
    const copy = [...chokepoints];
    copy.sort((a, b) => b.count - a.count);
    return copy[0];
  }, [chokepoints]);

  // Colour for a ship dot based on speed-over-ground.
  function dotColour(speed: number | null): string {
    if (speed == null) return '#5a7ea4';
    if (speed < 2) return '#5a7ea4';   // anchored
    if (speed < 8) return '#ffb020';   // slow / canal transit
    return '#00ff9f';                  // underway
  }

  return (
    <div className="min-h-screen bg-terminal-black">
      <TickerTape />
      <TopBar />
      <Sidebar />
      <main className="ml-[60px] pt-[76px] px-3 pb-6">
        <div className="panel mb-3">
          <div className="panel-header accent-cyan flex items-center">
            <Link href="/" className="flex items-center gap-1 text-hf-dim hover:text-hf-cyan text-[10px]">
              <ArrowLeft size={12} /> DASHBOARD
            </Link>
            <span className="ml-4 text-hf-cyan font-bold tracking-widest">RESEARCH — MARINE AIS</span>
            <span className="ml-2 text-hf-dim text-[9px]">/ live ship positions · chokepoint flows · LLM analyst</span>
            <div className="ml-auto flex items-center gap-2 text-[9px]">
              <span
                className={`inline-block w-1.5 h-1.5 rounded-full ${
                  status?.connected ? 'bg-hf-green animate-pulse-dot' : 'bg-hf-red'
                }`}
              />
              <span className={status?.connected ? 'text-hf-green' : 'text-hf-red'}>
                AISSTREAM {status?.connected ? 'LIVE' : 'OFFLINE'}
              </span>
              <span className="text-hf-dim">· {status?.ships_cached ?? 0} cached</span>
            </div>
          </div>
        </div>

        {!status?.key_present && (
          <div className="panel p-3 mb-3 border border-hf-amber/40">
            <div className="text-[10px] text-hf-amber font-bold">AISSTREAM_KEY not set</div>
            <div className="text-[10px] text-hf-dim mt-1">
              Get a free key at{' '}
              <a href="https://aisstream.io/authenticate" target="_blank" rel="noreferrer" className="text-hf-cyan underline">
                aisstream.io/authenticate
              </a>{' '}
              and add <code className="bg-terminal-dark px-1 rounded">AISSTREAM_KEY=...</code> to{' '}
              <code className="bg-terminal-dark px-1 rounded">backend/.env</code>, then restart the
              backend. The map and chokepoint counts will populate within ~30 seconds.
            </div>
          </div>
        )}

        {/* Top tiles */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          <Tile label="LIVE SHIPS" value={totalShips.toString()} sub="last 60 min" />
          <Tile label="AT CHOKEPOINTS" value={totalAtChokepoints.toString()} sub="summed across zones" />
          <Tile label="BUSIEST CHOKE" value={mostBusyChoke?.name || '—'} sub={mostBusyChoke ? `${mostBusyChoke.count} ships` : '—'} />
          <Tile label="FEED" value={status?.connected ? 'ONLINE' : 'OFFLINE'} sub={status?.last_error || 'all good'} />
        </div>

        <div className="grid grid-cols-12 gap-2 mb-3">
          {/* Map + chokepoints */}
          <div className="col-span-8 panel p-3" style={{ height: 520 }}>
            <div className="flex items-center mb-2">
              <MapPin size={12} className="text-hf-cyan" />
              <span className="ml-1 text-[10px] tracking-widest text-hf-cyan">GLOBAL MARITIME MAP</span>
              <div className="ml-auto text-[8px] text-hf-dim flex items-center gap-2">
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-[#00ff9f]" /> underway
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-[#ffb020]" /> slow
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-[#5a7ea4]" /> anchored
                </span>
              </div>
            </div>
            <div style={{ height: 'calc(100% - 20px)', width: '100%' }}>
              <ComposableMap
                projection="geoEqualEarth"
                projectionConfig={{ scale: 420, center: [30, 30] }}
                style={{ width: '100%', height: '100%' }}
              >
                <Geographies geography={WORLD_TOPO_URL}>
                  {({ geographies }) =>
                    geographies.map((geo) => (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill="#0e1a2a"
                        stroke="#1b2942"
                        strokeWidth={0.4}
                        style={{
                          default: { outline: 'none' },
                          hover: { outline: 'none', fill: '#132339' },
                          pressed: { outline: 'none' },
                        }}
                      />
                    ))
                  }
                </Geographies>

                {/* Chokepoint markers */}
                {chokepoints.map((c) => {
                  const [loLat, loLon] = c.bbox.sw;
                  const [hiLat, hiLon] = c.bbox.ne;
                  const lat = (loLat + hiLat) / 2;
                  const lon = (loLon + hiLon) / 2;
                  const intensity = Math.min(1, c.count / 40);
                  const r = 4 + intensity * 10;
                  return (
                    <Marker key={c.name} coordinates={[lon, lat]}>
                      <circle
                        r={r}
                        fill="rgba(0,212,255,0.15)"
                        stroke="rgba(0,212,255,0.7)"
                        strokeWidth={0.8}
                      />
                      <circle r={2} fill="#00d4ff" />
                      <text
                        y={-r - 3}
                        textAnchor="middle"
                        style={{
                          fontFamily: 'JetBrains Mono, monospace',
                          fontSize: 7,
                          fill: '#00d4ff',
                          paintOrder: 'stroke',
                          stroke: '#000',
                          strokeWidth: 2,
                        }}
                      >
                        {c.name} ({c.count})
                      </text>
                    </Marker>
                  );
                })}

                {/* Ship dots (down-sample to 600 to keep SVG reasonable) */}
                {ships.slice(0, 600).map((s) =>
                  s.lat != null && s.lon != null ? (
                    <Marker key={s.mmsi} coordinates={[s.lon, s.lat]}>
                      <circle r={1.1} fill={dotColour(s.speed_kn)} opacity={0.85} />
                    </Marker>
                  ) : null
                )}
              </ComposableMap>
            </div>
          </div>

          {/* Chokepoint sidebar */}
          <div className="col-span-4 panel p-3 flex flex-col" style={{ height: 520 }}>
            <div className="flex items-center mb-2 flex-shrink-0">
              <Ship size={12} className="text-hf-amber" />
              <span className="ml-1 text-[10px] tracking-widest text-hf-amber">CHOKEPOINT FLOWS</span>
              <span className="ml-auto text-[8px] text-hf-dim">{chokepoints.length} zones</span>
            </div>
            <div className="space-y-2 overflow-y-auto flex-1 pr-1">
              {chokepoints.map((c) => (
                <div key={c.name} className="bg-terminal-dark/50 rounded p-2">
                  <div className="flex items-center">
                    <span className="text-[11px] text-hf-white font-bold">{c.name}</span>
                    <span className="ml-auto text-[11px] text-hf-cyan tabular-nums font-bold">{c.count}</span>
                  </div>
                  <div className="text-[9px] text-hf-dim mt-0.5">{c.description}</div>
                  {c.sample_ships.length > 0 && (
                    <div className="text-[8px] text-hf-dim mt-1">
                      Sample: {c.sample_ships.map((sh) => sh.name || `MMSI type=${sh.type}`).join(', ')}
                    </div>
                  )}
                </div>
              ))}
              {chokepoints.length === 0 && (
                <div className="text-[10px] text-hf-dim text-center py-6">
                  No chokepoint data yet. AIS feed needs a minute to populate.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Chatbot */}
        <div className="panel p-3" style={{ minHeight: 320 }}>
          <div className="flex items-center mb-2">
            <span className="text-[10px] tracking-widest text-hf-green">ASK THE MARINE ANALYST</span>
            <span className="ml-2 text-[9px] text-hf-dim">
              Gemma-3n · grounded in live AIS + portfolio + news
            </span>
          </div>

          {messages.length === 0 ? (
            <div className="grid grid-cols-2 gap-2 mb-3">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendChat(s)}
                  className="text-left text-[10px] text-hf-dim hover:text-hf-green px-2 py-1.5 border border-terminal-border hover:border-hf-green/40 rounded bg-terminal-dark/30 transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-2 mb-3 max-h-[320px] overflow-y-auto pr-1">
              {messages.map((m) => (
                <div key={m.id} className={m.role === 'user' ? 'text-right' : 'text-left'}>
                  <div
                    className={
                      'inline-block px-3 py-1.5 rounded text-[11px] max-w-[85%] whitespace-pre-wrap ' +
                      (m.role === 'user'
                        ? 'bg-hf-cyan/15 border border-hf-cyan/40 text-hf-cyan'
                        : 'bg-terminal-dark border border-terminal-border text-hf-white')
                    }
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              <div ref={messagesEnd} />
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') sendChat(); }}
              placeholder="Ask about ship flows, trade recommendations, supply-chain risk…"
              className="flex-1 bg-terminal-dark border border-terminal-border rounded px-3 py-2 text-[11px] text-hf-white focus:outline-none focus:border-hf-green/40"
            />
            <button
              onClick={() => sendChat()}
              disabled={sending || !input.trim()}
              className="px-3 py-2 bg-hf-green/10 border border-hf-green/40 rounded text-[10px] text-hf-green hover:bg-hf-green/20 disabled:opacity-40 flex items-center gap-1"
            >
              {sending ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
              SEND
            </button>
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
      <div className="text-xl font-bold text-hf-cyan tabular-nums truncate">{value}</div>
      {sub && <div className="text-[9px] text-hf-dim mt-0.5 truncate">{sub}</div>}
    </div>
  );
}
