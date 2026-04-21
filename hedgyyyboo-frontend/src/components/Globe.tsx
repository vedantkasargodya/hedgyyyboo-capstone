'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import {
  geoNaturalEarth1,
  geoPath,
  geoGraticule,
  type GeoPermissibleObjects,
} from 'd3-geo';

const API_BASE = 'http://localhost:8001';

/* ===================== TYPES ===================== */
interface MarkerData {
  name: string;
  lat: number;
  lng: number;
  risk_score: number;
  alert_level: 'normal' | 'warning' | 'critical';
  top_sectors: string[];
  active_positions: number;
}

interface GeoEvent {
  title: string;
  source: string;
  event_type: string;
  lat: number;
  lng: number;
  region: string;
}

/* ===================== DATA ===================== */
const defaultMarkers: MarkerData[] = [
  {
    name: 'United States', lat: 39.8283, lng: -98.5795,
    risk_score: 34, alert_level: 'normal',
    top_sectors: ['Technology', 'Healthcare', 'Financials'],
    active_positions: 127,
  },
  {
    name: 'India', lat: 20.5937, lng: 78.9629,
    risk_score: 52, alert_level: 'warning',
    top_sectors: ['IT Services', 'Pharma', 'Banking'],
    active_positions: 43,
  },
  {
    name: 'United Kingdom', lat: 55.3781, lng: -3.436,
    risk_score: 28, alert_level: 'normal',
    top_sectors: ['Energy', 'Mining', 'Insurance'],
    active_positions: 61,
  },
  {
    name: 'Japan', lat: 36.2048, lng: 138.2529,
    risk_score: 41, alert_level: 'warning',
    top_sectors: ['Automotive', 'Electronics', 'Trading'],
    active_positions: 38,
  },
  {
    name: 'China', lat: 35.8617, lng: 104.1954,
    risk_score: 78, alert_level: 'critical',
    top_sectors: ['E-Commerce', 'Semiconductor', 'EV'],
    active_positions: 22,
  },
];

/* ===================== HELPERS ===================== */
function alertColor(level: string): string {
  switch (level) {
    case 'critical': return '#ff0033';
    case 'warning': return '#ffaa00';
    default: return '#00ff00';
  }
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  conflict: '#ff0033',
  sanctions: '#ff6600',
  diplomacy: '#00aaff',
  energy: '#ffaa00',
  crisis: '#ff3366',
  general: '#888888',
};

const LAND_GEOJSON_URL =
  'https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json';

/* ===================== COMPONENT ===================== */
interface GlobeProps {
  markers?: MarkerData[];
}

export default function Globe({ markers }: GlobeProps) {
  const data = markers || defaultMarkers;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredMarker, setHoveredMarker] = useState<MarkerData | null>(null);
  const [hoveredEvent, setHoveredEvent] = useState<GeoEvent | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [geoEvents, setGeoEvents] = useState<GeoEvent[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const landRef = useRef<any>(null);
  const animFrameRef = useRef<number>(0);
  const pulseRef = useRef(0);

  // Load land GeoJSON
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(LAND_GEOJSON_URL);
        const topo = await res.json();
        if (topo.type === 'Topology' && topo.objects?.land) {
          const land = topoFeature(topo, topo.objects.land);
          landRef.current = land;
        }
      } catch {
        landRef.current = null;
      }
    })();
  }, []);

  // Fetch geopolitical events
  useEffect(() => {
    async function fetchEvents() {
      try {
        const res = await fetch(`${API_BASE}/api/geo-events?limit=20`);
        if (!res.ok) return;
        const json = await res.json();
        setGeoEvents(json.events || []);
      } catch {
        // Silently fail — events are supplementary
      }
    }
    fetchEvents();
    const interval = setInterval(fetchEvents, 120000);
    return () => clearInterval(interval);
  }, []);

  // Simple TopoJSON to GeoJSON conversion
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function topoFeature(topology: any, object: any): GeoPermissibleObjects {
    const arcs = topology.arcs;

    function decodeArc(arcIdx: number): [number, number][] {
      const arc = arcs[arcIdx < 0 ? ~arcIdx : arcIdx];
      const coords: [number, number][] = [];
      let x = 0, y = 0;
      for (const [dx, dy] of arc) {
        x += dx;
        y += dy;
        const lon = x * topology.transform.scale[0] + topology.transform.translate[0];
        const lat = y * topology.transform.scale[1] + topology.transform.translate[1];
        coords.push([lon, lat]);
      }
      if (arcIdx < 0) coords.reverse();
      return coords;
    }

    function decodeRing(indices: number[]): [number, number][] {
      const ring: [number, number][] = [];
      for (const idx of indices) {
        const arc = decodeArc(idx);
        const start = ring.length > 0 ? 1 : 0;
        for (let i = start; i < arc.length; i++) {
          ring.push(arc[i]);
        }
      }
      return ring;
    }

    if (object.type === 'GeometryCollection') {
      return {
        type: 'FeatureCollection',
        features: object.geometries.map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (geom: any) => ({
            type: 'Feature',
            properties: {},
            geometry: decodeGeometry(geom),
          } as GeoJSON.Feature)
        ),
      } as GeoJSON.FeatureCollection;
    }

    return {
      type: 'Feature',
      properties: {},
      geometry: decodeGeometry(object),
    } as GeoJSON.Feature;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function decodeGeometry(geom: any): GeoJSON.Geometry {
      switch (geom.type) {
        case 'Polygon':
          return { type: 'Polygon', coordinates: geom.arcs.map(decodeRing) };
        case 'MultiPolygon':
          return {
            type: 'MultiPolygon',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            coordinates: geom.arcs.map((polygon: any) => polygon.map(decodeRing)),
          };
        default:
          return { type: 'Polygon', coordinates: [] };
      }
    }
  }

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = rect.width;
    const height = rect.height;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // Projection — fit inside with padding
    const projection = geoNaturalEarth1()
      .fitSize([width - 16, height - 16], { type: 'Sphere' })
      .translate([width / 2, height / 2]);

    const pathGen = geoPath(projection, ctx);

    // Sphere outline
    ctx.beginPath();
    pathGen({ type: 'Sphere' });
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Graticule
    const graticule = geoGraticule().step([15, 15]);
    ctx.beginPath();
    pathGen(graticule());
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.08)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Land
    if (landRef.current) {
      ctx.beginPath();
      pathGen(landRef.current);
      ctx.fillStyle = 'rgba(0, 255, 0, 0.06)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 255, 0, 0.15)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    // Connection lines
    for (let i = 0; i < data.length; i++) {
      for (let j = i + 1; j < data.length; j++) {
        const p1 = projection([data[i].lng, data[i].lat]);
        const p2 = projection([data[j].lng, data[j].lat]);
        if (p1 && p2) {
          ctx.beginPath();
          ctx.moveTo(p1[0], p1[1]);
          const midX = (p1[0] + p2[0]) / 2;
          const midY = (p1[1] + p2[1]) / 2 - 20;
          ctx.quadraticCurveTo(midX, midY, p2[0], p2[1]);
          ctx.strokeStyle = 'rgba(0, 212, 255, 0.15)';
          ctx.lineWidth = 0.8;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }

    // Pulse
    pulseRef.current = (pulseRef.current + 0.03) % (Math.PI * 2);
    const pulseScale = 1 + Math.sin(pulseRef.current) * 0.4;

    // Risk markers
    for (const marker of data) {
      const pos = projection([marker.lng, marker.lat]);
      if (!pos) continue;
      const [mx, my] = pos;
      const color = alertColor(marker.alert_level);
      const rgb = color.replace('#', '').match(/.{2}/g)!.map(h => parseInt(h, 16));

      ctx.beginPath();
      ctx.arc(mx, my, 12 * pulseScale, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${0.1 * (2 - pulseScale)})`;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(mx, my, 4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(mx, my, 6, 0, Math.PI * 2);
      ctx.strokeStyle = color + '60';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Geopolitical event markers (diamonds)
    for (const event of geoEvents) {
      const pos = projection([event.lng, event.lat]);
      if (!pos) continue;
      const [ex, ey] = pos;
      const evtColor = EVENT_TYPE_COLORS[event.event_type] || '#888888';
      const evtRgb = evtColor.replace('#', '').match(/.{2}/g)!.map(h => parseInt(h, 16));

      // Pulsing ring
      ctx.beginPath();
      ctx.arc(ex, ey, 8 * pulseScale, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${evtRgb[0]},${evtRgb[1]},${evtRgb[2]},${0.12 * (2 - pulseScale)})`;
      ctx.fill();

      // Diamond
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(Math.PI / 4);
      ctx.beginPath();
      ctx.rect(-2.5, -2.5, 5, 5);
      ctx.fillStyle = evtColor;
      ctx.fill();
      ctx.strokeStyle = evtColor + '80';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      // Label
      ctx.font = '7px monospace';
      ctx.fillStyle = evtColor + 'CC';
      ctx.textAlign = 'left';
      ctx.fillText(event.event_type.toUpperCase(), ex + 6, ey + 3);
    }

    animFrameRef.current = requestAnimationFrame(draw);
  }, [data, geoEvents]);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [draw]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => {});
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const projection = geoNaturalEarth1()
        .fitSize([rect.width - 16, rect.height - 16], { type: 'Sphere' })
        .translate([rect.width / 2, rect.height / 2]);

      let foundMarker: MarkerData | null = null;
      for (const marker of data) {
        const pos = projection([marker.lng, marker.lat]);
        if (!pos) continue;
        const dx = mx - pos[0];
        const dy = my - pos[1];
        if (Math.sqrt(dx * dx + dy * dy) < 14) {
          foundMarker = marker;
          break;
        }
      }

      let foundEvent: GeoEvent | null = null;
      if (!foundMarker) {
        for (const event of geoEvents) {
          const pos = projection([event.lng, event.lat]);
          if (!pos) continue;
          const dx = mx - pos[0];
          const dy = my - pos[1];
          if (Math.sqrt(dx * dx + dy * dy) < 12) {
            foundEvent = event;
            break;
          }
        }
      }

      setHoveredMarker(foundMarker);
      setHoveredEvent(foundEvent);
      if (foundMarker || foundEvent) {
        setTooltipPos({ x: mx, y: my });
      }
    },
    [data, geoEvents]
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredMarker(null);
    setHoveredEvent(null);
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ cursor: (hoveredMarker || hoveredEvent) ? 'pointer' : 'default' }}
      />

      {/* Risk Marker Tooltip */}
      {hoveredMarker && (
        <div
          className="absolute z-10 pointer-events-none animate-fade-in"
          style={{
            left: Math.min(tooltipPos.x + 16, (containerRef.current?.offsetWidth || 300) - 180),
            top: Math.max(tooltipPos.y - 10, 0),
          }}
        >
          <div className="bg-terminal-dark/95 backdrop-blur border border-terminal-border rounded px-3 py-2 min-w-[160px] shadow-lg">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold text-hf-white tracking-wider">
                {hoveredMarker.name.toUpperCase()}
              </span>
              <span
                className="text-[8px] font-bold px-1 py-0.5 rounded"
                style={{
                  color: alertColor(hoveredMarker.alert_level),
                  backgroundColor: alertColor(hoveredMarker.alert_level) + '20',
                  border: `1px solid ${alertColor(hoveredMarker.alert_level)}40`,
                }}
              >
                {hoveredMarker.alert_level.toUpperCase()}
              </span>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-[9px]">
                <span className="text-hf-dim">Risk Score</span>
                <span style={{ color: alertColor(hoveredMarker.alert_level) }} className="font-semibold">
                  {hoveredMarker.risk_score}/100
                </span>
              </div>
              <div className="flex justify-between text-[9px]">
                <span className="text-hf-dim">Positions</span>
                <span className="text-hf-white font-semibold">{hoveredMarker.active_positions}</span>
              </div>
              <div className="text-[8px] text-hf-dim mt-1.5 pt-1.5 border-t border-terminal-border">
                <span className="text-hf-cyan">SECTORS: </span>
                {hoveredMarker.top_sectors.join(' / ')}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Geo Event Tooltip */}
      {hoveredEvent && !hoveredMarker && (
        <div
          className="absolute z-10 pointer-events-none animate-fade-in"
          style={{
            left: Math.min(tooltipPos.x + 16, (containerRef.current?.offsetWidth || 300) - 200),
            top: Math.max(tooltipPos.y - 10, 0),
          }}
        >
          <div className="bg-terminal-dark/95 backdrop-blur border border-terminal-border rounded px-3 py-2 min-w-[180px] max-w-[220px] shadow-lg">
            <div className="flex items-center gap-1.5 mb-1">
              <div
                className="w-2 h-2 rounded-sm shrink-0"
                style={{ backgroundColor: EVENT_TYPE_COLORS[hoveredEvent.event_type] || '#888' }}
              />
              <span className="text-[8px] font-bold tracking-wider" style={{ color: EVENT_TYPE_COLORS[hoveredEvent.event_type] || '#888' }}>
                {hoveredEvent.event_type.toUpperCase()} — {hoveredEvent.region.toUpperCase()}
              </span>
            </div>
            <p className="text-[9px] text-hf-white leading-tight line-clamp-3">
              {hoveredEvent.title}
            </p>
            {hoveredEvent.source && (
              <span className="text-[7px] text-hf-dim mt-1 block">{hoveredEvent.source}</span>
            )}
          </div>
        </div>
      )}

      {/* Event count */}
      {geoEvents.length > 0 && (
        <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-terminal-dark/80 border border-terminal-border rounded px-2 py-1">
          <div className="w-1.5 h-1.5 rounded-full bg-hf-red animate-pulse" />
          <span className="text-[8px] text-hf-dim tracking-wider">
            {geoEvents.length} EVENTS
          </span>
        </div>
      )}

      {/* Corner label */}
      <div className="absolute bottom-2 left-2 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-hf-green animate-pulse-dot" />
        <span className="text-[8px] text-hf-dim tracking-wider">
          GLOBAL RISK MAP // LIVE
        </span>
      </div>
    </div>
  );
}
