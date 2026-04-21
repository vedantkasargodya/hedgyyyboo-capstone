import type {
  FullAnalysisResult,
  GlobeEntity,
  LDAResult,
  MarketTicker,
  PCAResult,
} from './types';

const BASE_URL = 'http://localhost:8001';

async function request<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      ...options,
    });

    if (!res.ok) {
      throw new Error(`API error: ${res.status} ${res.statusText}`);
    }

    return (await res.json()) as T;
  } catch (error) {
    if (error instanceof Error) {
      console.error(`[Hedgyyyboo API] ${error.message}`);
    }
    throw error;
  }
}

export async function fetchMarketData(): Promise<MarketTicker[]> {
  return request<MarketTicker[]>('/api/market-data');
}

export async function fetchGlobeData(): Promise<GlobeEntity[]> {
  return request<GlobeEntity[]>('/api/globe-data');
}

export async function runPCAAnalysis(): Promise<PCAResult> {
  return request<PCAResult>('/api/analysis/pca', { method: 'POST' });
}

export async function runLDAAnalysis(): Promise<LDAResult> {
  return request<LDAResult>('/api/analysis/lda', { method: 'POST' });
}

export async function runFullAnalysis(): Promise<FullAnalysisResult> {
  return request<FullAnalysisResult>('/api/analysis/full', { method: 'POST' });
}

// Phase 2 APIs

export async function fetchNews(category = 'all', limit = 30) {
  return request<{ count: number; items: import('./types').NewsItem[] }>(`/api/news?category=${category}&limit=${limit}`);
}

export async function fetchTickerNews(ticker: string) {
  return request<{ items: import('./types').NewsItem[] }>(`/api/news/${ticker}`);
}

export async function fetchStockData(ticker: string) {
  return request<Record<string, unknown>>(`/api/stock/${ticker}`);
}

export async function fetchStockChart(ticker: string, period = '1mo') {
  return request<{ data: import('./types').ChartDataPoint[] }>(`/api/stock/${ticker}/chart?period=${period}`);
}

export async function fetchBatchQuotes(tickers = 'AAPL,MSFT,GOOGL,AMZN,NVDA,TSLA,META,JPM,GS,SPY') {
  return request<{ quotes: import('./types').StockQuote[] }>(`/api/stock/batch/quotes?tickers=${tickers}`);
}

export async function runFilingDelta(ticker: string, filingType = '10-K', section = 'risk_factors') {
  return request<import('./types').FilingDeltaResult>(`/api/filing-delta/${ticker}?filing_type=${filingType}&section=${section}`, { method: 'POST' });
}

export async function runAlphaCheck(ticker: string, filingDate: string, windowDays = 30) {
  return request<Record<string, unknown>>(`/api/alpha-check/${ticker}`, {
    method: 'POST',
    body: JSON.stringify({ filing_date: filingDate, window_days: windowDays }),
  });
}

export async function fetchMarketSummary() {
  return request<Record<string, unknown>>('/api/market-summary');
}
