'use client';

interface RegimeTopic {
  topic_id: number;
  name: string;
  top_words: string[];
  weight: number;
}

interface RegimePanelProps {
  data?: {
    topics: RegimeTopic[];
    regime_summary: string;
  };
  loading?: boolean;
}

const defaultData = {
  topics: [
    {
      topic_id: 0,
      name: 'Risk-Off Rotation',
      top_words: ['volatility', 'treasury', 'flight', 'hedge', 'defensive'],
      weight: 0.34,
    },
    {
      topic_id: 1,
      name: 'Tech Momentum',
      top_words: ['AI', 'semiconductor', 'growth', 'NASDAQ', 'innovation'],
      weight: 0.26,
    },
    {
      topic_id: 2,
      name: 'Macro Divergence',
      top_words: ['rates', 'inflation', 'Fed', 'divergence', 'yield'],
      weight: 0.19,
    },
    {
      topic_id: 3,
      name: 'EM Stress',
      top_words: ['emerging', 'currency', 'contagion', 'spread', 'carry'],
      weight: 0.13,
    },
    {
      topic_id: 4,
      name: 'Sector Dispersion',
      top_words: ['rotation', 'value', 'cyclicals', 'earnings', 'quality'],
      weight: 0.08,
    },
  ],
  regime_summary:
    'Dominant risk-off regime with elevated volatility. Tech momentum persists as secondary driver. Monitor EM stress signals for potential contagion.',
};

const barColors = [
  'bg-hf-green',
  'bg-hf-cyan',
  'bg-hf-amber',
  'bg-hf-red/70',
  'bg-hf-dim',
];

const barGlows = [
  'shadow-[0_0_8px_rgba(0,255,0,0.3)]',
  'shadow-[0_0_8px_rgba(0,212,255,0.2)]',
  '',
  '',
  '',
];

export default function RegimePanel({
  data,
  loading = false,
}: RegimePanelProps) {
  const regimeData = data || defaultData;

  if (loading) {
    return (
      <div className="panel h-full">
        <div className="panel-header accent-amber">MARKET REGIME ANALYSIS</div>
        <div className="p-4 space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="skeleton h-3 w-24" />
              <div className="skeleton h-5 w-full" />
              <div className="flex gap-1">
                {[...Array(3)].map((_, j) => (
                  <div key={j} className="skeleton h-3 w-14" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const maxWeight = Math.max(...regimeData.topics.map((t) => t.weight));

  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header accent-amber">
        <span>MARKET REGIME ANALYSIS</span>
        <span className="ml-auto text-[9px] text-terminal-muted">
          LDA K=5
        </span>
      </div>
      <div className="flex-1 p-4 space-y-3 overflow-y-auto">
        {regimeData.topics.map((topic, idx) => {
          const widthPct = (topic.weight / maxWeight) * 100;
          return (
            <div key={topic.topic_id} className="animate-slide-up" style={{ animationDelay: `${idx * 80}ms` }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-semibold tracking-wider text-hf-white">
                  {topic.name.toUpperCase()}
                </span>
                <span className="text-[10px] font-bold text-hf-dim tabular-nums">
                  {(topic.weight * 100).toFixed(1)}%
                </span>
              </div>

              {/* Bar */}
              <div className="w-full h-4 bg-terminal-black rounded-sm overflow-hidden border border-terminal-border">
                <div
                  className={`h-full rounded-sm ${barColors[idx]} ${barGlows[idx]} transition-all duration-700`}
                  style={{
                    width: `${widthPct}%`,
                    opacity: 0.3 + (topic.weight / maxWeight) * 0.7,
                  }}
                />
              </div>

              {/* Keywords */}
              <div className="flex flex-wrap gap-1 mt-1.5">
                {topic.top_words.slice(0, 4).map((word) => (
                  <span
                    key={word}
                    className="text-[8px] px-1.5 py-0.5 bg-terminal-black border border-terminal-border rounded text-hf-dim"
                  >
                    {word}
                  </span>
                ))}
              </div>
            </div>
          );
        })}

        {/* Summary */}
        <div className="mt-4 pt-3 border-t border-terminal-border">
          <p className="text-[10px] text-hf-dim leading-relaxed">
            <span className="text-hf-amber font-semibold">REGIME: </span>
            {regimeData.regime_summary}
          </p>
        </div>
      </div>
    </div>
  );
}
