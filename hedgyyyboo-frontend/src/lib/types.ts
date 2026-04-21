export interface GlobeEntity {
  name: string;
  lat: number;
  lng: number;
  risk_score: number;
  gdp_growth: number;
  top_sectors: string[];
  active_positions: number;
  alert_level: 'normal' | 'warning' | 'critical';
}

export interface PCAComponent {
  component: string;
  explained_variance: number;
  cumulative_variance: number;
}

export interface PCAResult {
  explained_variance_ratio: number[];
  cumulative_variance: number[];
  component_loadings: Record<string, number[]>;
  interpretation: string;
  systemic_risk: number;
  idiosyncratic_risk: number;
}

export interface LDATopic {
  topic_id: number;
  name: string;
  top_words: string[];
  weight: number;
}

export interface LDAResult {
  topics: LDATopic[];
  headline_assignments: Record<string, number>;
  regime_summary: string;
}

export interface FullAnalysisResult {
  pca: PCAResult;
  lda: LDAResult;
  ai_summary: string;
  timestamp: string;
}

export interface MarketTicker {
  symbol: string;
  name: string;
  sector: string;
  region: string;
  price: number;
  change_pct: number;
}

export interface StatData {
  title: string;
  value: number;
  change: number;
  icon: string;
}

// Phase 2 Types

export interface NewsItem {
  title: string;
  link: string;
  published: string;
  source: string;
  category: string;
  summary: string;
}

export interface StockQuote {
  symbol: string;
  price: number;
  change_pct: number;
  volume: number;
}

export interface ChartDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface FilingDeltaChunk {
  text: string;
  chunk_index: number;
  similarity?: number;
  old_text?: string;
}

export interface FilingDeltaResult {
  ticker: string;
  filing_type: string;
  section: string;
  current_filing_date: string;
  previous_filing_date: string;
  divergence_score: number;
  total_chunks_current: number;
  total_chunks_previous: number;
  added: FilingDeltaChunk[];
  modified: FilingDeltaChunk[];
  removed: FilingDeltaChunk[];
  unchanged_count: number;
  summary_stats: {
    added_pct: number;
    modified_pct: number;
    removed_pct: number;
    unchanged_pct: number;
  };
  error?: string;
}
