'use client';

import { useState, useEffect } from 'react';
import { FileText, Download, Loader2, Clock, CheckCircle, RefreshCw } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

interface NoteResult {
  status: string;
  briefing: string | null;
  pdf_base64?: string;
  generated_at: string | null;
  data_sources?: string[];
}

export default function MorningNotePanel() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [result, setResult] = useState<NoteResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load cached brief on mount
  useEffect(() => {
    const loadCached = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/morning-note/cached`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'ok' && data.briefing) {
            setResult(data);
          }
        }
      } catch {
        // Silently fail — will show generate button
      } finally {
        setIsLoading(false);
      }
    };
    loadCached();
  }, []);

  const refreshNote = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/morning-note?refresh=true`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadPDF = () => {
    if (!result?.pdf_base64) return;
    const binary = atob(result.pdf_base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hedgyyyboo_morning_note_${result.generated_at?.slice(0, 10) || 'latest'}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="panel h-full flex flex-col">
      {/* Header */}
      <div className="panel-header accent-amber">
        <div className="flex items-center gap-2">
          <FileText size={12} />
          <span>MORNING BRIEF</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Clock size={10} className="text-terminal-muted" />
          <span className="text-[9px] text-terminal-muted">08:00 IST DAILY</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Initial loading */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Loader2 size={20} className="text-hf-amber animate-spin" />
            <p className="text-[10px] text-hf-dim">Loading morning brief...</p>
          </div>
        )}

        {/* No cached result + not loading — show generate */}
        {!isLoading && !result && !isGenerating && (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="w-16 h-16 rounded-full bg-hf-amber/10 border border-hf-amber/30 flex items-center justify-center">
              <FileText size={24} className="text-hf-amber" />
            </div>
            <div className="text-center">
              <p className="text-[11px] text-hf-white mb-1">Morning Brief</p>
              <p className="text-[9px] text-hf-dim max-w-[250px]">
                Generating on startup... If this persists, click below to generate manually.
              </p>
            </div>
            <button
              onClick={refreshNote}
              className="px-4 py-2 rounded bg-hf-amber/15 border border-hf-amber/30 text-hf-amber text-[10px] font-semibold tracking-wider hover:bg-hf-amber/25 transition-colors"
            >
              GENERATE BRIEF
            </button>
            {error && (
              <p className="text-[9px] text-hf-red">{error}</p>
            )}
          </div>
        )}

        {/* Refreshing */}
        {isGenerating && (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <Loader2 size={28} className="text-hf-amber animate-spin" />
            <div className="text-center">
              <p className="text-[11px] text-hf-white mb-1">Refreshing Morning Brief...</p>
              <p className="text-[9px] text-hf-dim">
                Pulling news from all sources & generating via LLM. ~30-60s.
              </p>
            </div>
            <div className="w-48 space-y-1.5">
              {['PCA/LDA Analysis', 'Batch Quotes', 'Vol Surface', 'GARCH Tail Risk', 'News (All Sources)', 'LLM Briefing', 'PDF Render'].map((step, i) => (
                <div key={step} className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${i < 4 ? 'bg-hf-green' : 'bg-terminal-muted'} animate-pulse`} />
                  <span className="text-[8px] text-hf-dim">{step}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Result */}
        {result && result.briefing && !isGenerating && (
          <>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle size={14} className="text-hf-green" />
              <span className="text-[10px] text-hf-green font-semibold">BRIEF READY</span>
              <span className="text-[8px] text-terminal-muted ml-auto">
                {result.generated_at ? new Date(result.generated_at).toLocaleString() : ''}
              </span>
            </div>

            {/* Data sources */}
            <div className="flex flex-wrap gap-1 mb-2">
              {result.data_sources?.map((src) => (
                <span
                  key={src}
                  className="text-[7px] px-1.5 py-0.5 rounded bg-terminal-dark border border-terminal-border text-terminal-muted"
                >
                  {src}
                </span>
              ))}
            </div>

            {/* Briefing */}
            <div className="bg-terminal-black/80 border border-terminal-border rounded p-3">
              <p className="text-[8px] text-hf-amber font-bold tracking-wider mb-2">PM BRIEFING</p>
              <p className="text-[10px] text-hf-white leading-relaxed whitespace-pre-wrap">
                {result.briefing}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-2">
              <button
                onClick={downloadPDF}
                disabled={!result.pdf_base64}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-hf-cyan/15 border border-hf-cyan/30 text-hf-cyan text-[9px] font-semibold tracking-wider hover:bg-hf-cyan/25 transition-colors disabled:opacity-30"
              >
                <Download size={10} />
                DOWNLOAD PDF
              </button>
              <button
                onClick={refreshNote}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-hf-amber/15 border border-hf-amber/30 text-hf-amber text-[9px] font-semibold tracking-wider hover:bg-hf-amber/25 transition-colors"
              >
                <RefreshCw size={10} />
                REFRESH BRIEF
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
