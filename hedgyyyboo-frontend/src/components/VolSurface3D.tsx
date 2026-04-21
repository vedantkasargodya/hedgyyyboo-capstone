'use client';

import { useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';

const API_BASE = 'http://localhost:8001';

interface VolSurfaceData {
  ticker: string;
  spot_price: number;
  strikes: number[];
  maturities: number[];
  iv_matrix: number[][];
  put_iv_avg: number;
  call_iv_avg: number;
  skew_ratio: number;
  timestamp: string;
}

/* ========== Color mapping: IV value -> color ========== */
function ivToColor(iv: number, minIV: number, maxIV: number): THREE.Color {
  const t = Math.max(0, Math.min(1, (iv - minIV) / (maxIV - minIV || 1)));
  if (t < 0.5) {
    // blue (#0044ff) -> green (#00ff00)
    const s = t / 0.5;
    return new THREE.Color(
      0,
      s,
      1 - s * 0.73
    );
  } else {
    // green (#00ff00) -> red (#ff0033)
    const s = (t - 0.5) / 0.5;
    return new THREE.Color(
      s,
      1 - s,
      s * 0.2
    );
  }
}

/* ========== Surface Mesh Sub-component ========== */
function VolSurfaceMesh({ data }: { data: VolSurfaceData }) {
  const meshRef = useRef<THREE.Mesh>(null);

  const { geometry, minIV, maxIV } = useMemo(() => {
    const rows = data.iv_matrix.length; // maturities
    const cols = data.iv_matrix[0]?.length || 0; // strikes

    if (rows === 0 || cols === 0) {
      return { geometry: new THREE.PlaneGeometry(1, 1), minIV: 0, maxIV: 1 };
    }

    // Fill nulls with neighbor interpolation before processing
    const filledMatrix: number[][] = data.iv_matrix.map((row) => {
      const filled = [...row];
      // Forward fill nulls
      for (let i = 0; i < filled.length; i++) {
        if (filled[i] == null || isNaN(filled[i])) {
          filled[i] = i > 0 ? filled[i - 1] : 0;
        }
      }
      // Backward fill any remaining leading nulls
      for (let i = filled.length - 2; i >= 0; i--) {
        if (filled[i] === 0 && filled[i + 1] !== 0) filled[i] = filled[i + 1];
      }
      return filled;
    });

    // Find min/max IV for color normalization
    let minV = Infinity;
    let maxV = -Infinity;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const v = filledMatrix[r][c];
        if (v != null && !isNaN(v)) {
          if (v < minV) minV = v;
          if (v > maxV) maxV = v;
        }
      }
    }
    if (!isFinite(minV)) minV = 0;
    if (!isFinite(maxV)) maxV = 1;

    const geom = new THREE.PlaneGeometry(
      6, // width (strikes axis)
      4, // height (maturity axis)
      cols - 1,
      rows - 1
    );

    const posAttr = geom.getAttribute('position');
    const colors = new Float32Array(posAttr.count * 3);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const iv = filledMatrix[r][c] ?? 0;

        // Set Z (height) based on IV value, scaled for visibility
        const z = ((iv - minV) / (maxV - minV || 1)) * 2.5;
        posAttr.setZ(idx, isNaN(z) ? 0 : z);

        // Set vertex color
        const color = ivToColor(iv, minV, maxV);
        colors[idx * 3] = color.r;
        colors[idx * 3 + 1] = color.g;
        colors[idx * 3 + 2] = color.b;
      }
    }

    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geom.computeVertexNormals();
    posAttr.needsUpdate = true;

    return { geometry: geom, minIV: minV, maxIV: maxV };
  }, [data]);

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.x = -0.6;
    }
  });

  return (
    <mesh ref={meshRef} geometry={geometry} position={[0, 0.3, 0]}>
      <meshStandardMaterial
        vertexColors
        side={THREE.DoubleSide}
        wireframe={false}
        transparent
        opacity={0.9}
      />
    </mesh>
  );
}

/* ========== Wireframe overlay ========== */
function WireframeOverlay({ data }: { data: VolSurfaceData }) {
  const meshRef = useRef<THREE.Mesh>(null);

  const geometry = useMemo(() => {
    const rows = data.iv_matrix.length;
    const cols = data.iv_matrix[0]?.length || 0;
    if (rows === 0 || cols === 0) return new THREE.PlaneGeometry(1, 1);

    // Fill nulls same as surface mesh
    const filledMatrix: number[][] = data.iv_matrix.map((row) => {
      const filled = [...row];
      for (let i = 0; i < filled.length; i++) {
        if (filled[i] == null || isNaN(filled[i])) filled[i] = i > 0 ? filled[i - 1] : 0;
      }
      for (let i = filled.length - 2; i >= 0; i--) {
        if (filled[i] === 0 && filled[i + 1] !== 0) filled[i] = filled[i + 1];
      }
      return filled;
    });

    let minV = Infinity;
    let maxV = -Infinity;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const v = filledMatrix[r][c];
        if (v != null && !isNaN(v)) {
          if (v < minV) minV = v;
          if (v > maxV) maxV = v;
        }
      }
    }
    if (!isFinite(minV)) minV = 0;
    if (!isFinite(maxV)) maxV = 1;

    const geom = new THREE.PlaneGeometry(6, 4, cols - 1, rows - 1);
    const posAttr = geom.getAttribute('position');

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const iv = filledMatrix[r][c] ?? 0;
        const z = ((iv - minV) / (maxV - minV || 1)) * 2.5;
        posAttr.setZ(idx, isNaN(z) ? 0 : z);
      }
    }
    posAttr.needsUpdate = true;
    return geom;
  }, [data]);

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.x = -0.6;
    }
  });

  return (
    <mesh ref={meshRef} geometry={geometry} position={[0, 0.3, 0.005]}>
      <meshBasicMaterial
        wireframe
        color="#00ff00"
        transparent
        opacity={0.12}
      />
    </mesh>
  );
}

/* ========== Axis labels ========== */
function AxisLabels() {
  return (
    <group>
      <Text
        position={[0, -2.5, 0]}
        fontSize={0.2}
        color="#666666"
        anchorX="center"
        font={undefined}
      >
        STRIKE PRICE
      </Text>
      <Text
        position={[-3.8, 0, 0]}
        fontSize={0.2}
        color="#666666"
        rotation={[0, 0, Math.PI / 2]}
        anchorX="center"
        font={undefined}
      >
        TIME TO MATURITY
      </Text>
      <Text
        position={[3.8, 1.2, 0]}
        fontSize={0.18}
        color="#666666"
        rotation={[0, 0, -Math.PI / 2]}
        anchorX="center"
        font={undefined}
      >
        IMPLIED VOL
      </Text>
    </group>
  );
}

/* ========== Scene ========== */
function Scene({ data }: { data: VolSurfaceData }) {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} />
      <directionalLight position={[-3, 3, -3]} intensity={0.3} />
      <VolSurfaceMesh data={data} />
      <WireframeOverlay data={data} />
      <AxisLabels />
      <OrbitControls
        enableDamping
        dampingFactor={0.1}
        rotateSpeed={0.5}
        zoomSpeed={0.8}
        minDistance={3}
        maxDistance={12}
      />
      <gridHelper
        args={[8, 20, '#1a1a1a', '#1a1a1a']}
        position={[0, -2.2, 0]}
        rotation={[0, 0, 0]}
      />
    </>
  );
}

/* ========== Main Component ========== */
export default function VolSurface3D() {
  const [data, setData] = useState<VolSurfaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const res = await fetch(`${API_BASE}/api/vol-surface`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const json = await res.json() as any;
        if (!cancelled) {
          // Normalize: API nests skew data under skew_analysis
          const skew = json.skew_analysis || {};
          setData({
            ticker: json.ticker || 'SPY',
            spot_price: json.spot_price || 0,
            strikes: json.strikes || [],
            maturities: json.maturities || [],
            iv_matrix: json.iv_matrix || [],
            put_iv_avg: skew.put_iv_avg ?? json.put_iv_avg ?? 0,
            call_iv_avg: skew.call_iv_avg ?? json.call_iv_avg ?? 0,
            skew_ratio: skew.skew_ratio ?? json.skew_ratio ?? 0,
            timestamp: json.timestamp || new Date().toISOString(),
          });
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load');
          setLoading(false);
        }
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, []);

  // Loading skeleton
  if (loading) {
    return (
      <div className="panel h-full flex flex-col">
        <div className="panel-header accent-cyan">
          <span>3D VOLATILITY SURFACE // SPY</span>
        </div>
        <div className="flex-1 p-4 flex flex-col">
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-hf-cyan/30 border-t-hf-cyan rounded-full animate-spin" />
              <span className="text-[10px] text-hf-dim tracking-wider">
                LOADING SURFACE DATA...
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-terminal-border">
            <div className="skeleton h-4 w-24" />
            <div className="skeleton h-4 w-24" />
            <div className="skeleton h-4 w-24" />
            <div className="skeleton h-4 w-24" />
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div className="panel h-full flex flex-col">
        <div className="panel-header accent-cyan">
          <span>3D VOLATILITY SURFACE // SPY</span>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="bg-hf-red/5 border border-hf-red/20 rounded p-3">
            <span className="text-[10px] text-hf-red tracking-wider">
              ERROR: {error || 'No data available'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header accent-cyan">
        <span>3D VOLATILITY SURFACE // {data.ticker || 'SPY'}</span>
        <div className="ml-auto flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-hf-cyan animate-pulse-dot" />
          <span className="text-[9px] text-terminal-muted">LIVE</span>
        </div>
      </div>

      {/* 3D Canvas */}
      <div className="flex-1 relative" style={{ minHeight: 0 }}>
        <Canvas
          camera={{ position: [4, 3, 5], fov: 45 }}
          style={{ background: 'transparent' }}
          gl={{ antialias: true, alpha: true }}
        >
          <Scene data={data} />
        </Canvas>

        {/* Color legend */}
        <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[7px] text-hf-dim tracking-wider">LOW IV</span>
            <div className="w-12 h-1.5 rounded-full" style={{
              background: 'linear-gradient(to right, #0044ff, #00ff00, #ff0033)'
            }} />
            <span className="text-[7px] text-hf-dim tracking-wider">HIGH IV</span>
          </div>
        </div>
      </div>

      {/* Bottom stats bar */}
      <div className="flex items-center gap-3 px-3 py-2 border-t border-terminal-border text-[9px]">
        <div className="flex items-center gap-1.5">
          <span className="text-hf-dim tracking-wider">SPOT:</span>
          <span className="text-hf-white font-bold tabular-nums">
            ${data.spot_price.toFixed(2)}
          </span>
        </div>
        <div className="w-px h-3 bg-terminal-border" />
        <div className="flex items-center gap-1.5">
          <span className="text-hf-dim tracking-wider">PUT IV:</span>
          <span className="text-hf-red font-bold tabular-nums">
            {(data.put_iv_avg * 100).toFixed(1)}%
          </span>
        </div>
        <div className="w-px h-3 bg-terminal-border" />
        <div className="flex items-center gap-1.5">
          <span className="text-hf-dim tracking-wider">CALL IV:</span>
          <span className="text-hf-green font-bold tabular-nums">
            {(data.call_iv_avg * 100).toFixed(1)}%
          </span>
        </div>
        <div className="w-px h-3 bg-terminal-border" />
        <div className="flex items-center gap-1.5">
          <span className="text-hf-dim tracking-wider">SKEW:</span>
          <span className="text-hf-cyan font-bold tabular-nums">
            {data.skew_ratio.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}
