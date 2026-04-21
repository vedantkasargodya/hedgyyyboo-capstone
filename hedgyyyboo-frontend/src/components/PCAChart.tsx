'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Line,
  ComposedChart,
  ResponsiveContainer,
} from 'recharts';

interface PCAChartProps {
  data?: {
    explained_variance_ratio: number[];
    cumulative_variance: number[];
    systemic_risk: number;
    idiosyncratic_risk: number;
  };
  loading?: boolean;
}

const defaultData = {
  explained_variance_ratio: [0.42, 0.23, 0.15, 0.11, 0.09],
  cumulative_variance: [0.42, 0.65, 0.80, 0.91, 1.0],
  systemic_risk: 67.4,
  idiosyncratic_risk: 32.6,
};

export default function PCAChart({ data, loading = false }: PCAChartProps) {
  const pcaData = data || defaultData;

  const chartData = pcaData.explained_variance_ratio.map((val, i) => ({
    name: `PC${i + 1}`,
    variance: parseFloat((val * 100).toFixed(1)),
    cumulative: parseFloat((pcaData.cumulative_variance[i] * 100).toFixed(1)),
  }));

  if (loading) {
    return (
      <div className="panel h-full">
        <div className="panel-header accent-cyan">PCA RISK DECOMPOSITION</div>
        <div className="p-4 space-y-3">
          <div className="skeleton h-[180px] w-full" />
          <div className="flex gap-4">
            <div className="skeleton h-4 w-32" />
            <div className="skeleton h-4 w-32" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header accent-cyan">
        <span>PCA RISK DECOMPOSITION</span>
        <span className="ml-auto text-[9px] text-terminal-muted">
          5 COMPONENTS
        </span>
      </div>
      <div className="flex-1 p-4">
        <div className="h-[180px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} barCategoryGap="20%">
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#222"
                vertical={false}
              />
              <XAxis
                dataKey="name"
                tick={{ fill: '#666', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                axisLine={{ stroke: '#333' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#666', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                axisLine={false}
                tickLine={false}
                domain={[0, 100]}
                tickFormatter={(v: number) => `${v}%`}
              />
              <Tooltip
                contentStyle={{
                  background: '#111',
                  border: '1px solid #333',
                  borderRadius: 4,
                  fontSize: 11,
                  fontFamily: 'JetBrains Mono',
                  color: '#e0e0e0',
                }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any, name: any) => [
                  `${value}%`,
                  name === 'variance' ? 'Explained' : 'Cumulative',
                ]}
              />
              <defs>
                <linearGradient id="pcaBarGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00d4ff" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#00ff00" stopOpacity={0.6} />
                </linearGradient>
              </defs>
              <Bar
                dataKey="variance"
                fill="url(#pcaBarGrad)"
                radius={[2, 2, 0, 0]}
              />
              <Line
                type="monotone"
                dataKey="cumulative"
                stroke="#ffaa00"
                strokeWidth={2}
                dot={{
                  fill: '#ffaa00',
                  r: 3,
                  stroke: '#111',
                  strokeWidth: 1,
                }}
                activeDot={{ r: 5, stroke: '#ffaa00', strokeWidth: 2 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Metrics */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-terminal-border">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-hf-red" />
            <span className="text-[10px] text-hf-dim tracking-wider">
              SYSTEMIC RISK
            </span>
            <span className="text-sm font-bold text-hf-red">
              {pcaData.systemic_risk.toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-hf-cyan" />
            <span className="text-[10px] text-hf-dim tracking-wider">
              IDIOSYNCRATIC
            </span>
            <span className="text-sm font-bold text-hf-cyan">
              {pcaData.idiosyncratic_risk.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
