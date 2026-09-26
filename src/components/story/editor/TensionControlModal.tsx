import React from 'react';
import {
  X,
  Activity,
  Sparkles,
  Flame,
  Check,
  Eye,
  EyeOff,
  BarChart2,
  TrendingUp,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { TensionDisplayMode, ParagraphTensionItem } from '../../../types';
import { getTensionColor } from '../../../utils/tensionUtils';

interface TensionControlModalProps {
  isOpen: boolean;
  onClose: () => void;
  displayMode: TensionDisplayMode;
  onChangeDisplayMode: (mode: TensionDisplayMode) => void;
  tensionItems: ParagraphTensionItem[];
  totalParagraphs: number;
  evaluatedCount: number;
  unEvaluatedCount: number;
  isAnalyzing: boolean;
  onRunAnalysis: () => void;
  lastAnalyzedAt?: number;
}

export const TensionControlModal: React.FC<TensionControlModalProps> = ({
  isOpen,
  onClose,
  displayMode,
  onChangeDisplayMode,
  tensionItems,
  totalParagraphs,
  evaluatedCount,
  unEvaluatedCount,
  isAnalyzing,
  onRunAnalysis,
  lastAnalyzedAt,
}) => {
  if (!isOpen) return null;

  // Calculate statistics
  const avgScore =
    tensionItems.length > 0
      ? Math.round(
          tensionItems.reduce((acc, it) => acc + it.tensionScore, 0) /
            tensionItems.length
        )
      : 0;

  const peakItem =
    tensionItems.length > 0
      ? [...tensionItems].sort((a, b) => b.tensionScore - a.tensionScore)[0]
      : null;

  const modes: Array<{
    id: TensionDisplayMode;
    label: string;
    desc: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'both',
      label: 'Keduanya (Rekomendasi)',
      desc: 'Garis margin samping (Gutter) + Aksen garis bawah teks',
      icon: <Activity className="w-4 h-4 text-amber-500" />,
    },
    {
      id: 'gutter',
      label: 'Hanya Gutter Bar',
      desc: 'Garis margin vertikal di sisi kiri paragraf',
      icon: <span className="w-1.5 h-4 bg-amber-500 rounded-full inline-block" />,
    },
    {
      id: 'underline',
      label: 'Hanya Underline Teks',
      desc: 'Aksen garis bawah warna ketegangan pada teks',
      icon: <span className="border-b-2 border-amber-500 font-bold text-xs px-1">Abc</span>,
    },
    {
      id: 'none',
      label: 'Nonaktifkan',
      desc: 'Sembunyikan semua warna tensi pada naskah',
      icon: <EyeOff className="w-4 h-4 text-slate-400" />,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl max-w-lg w-full max-h-[88vh] sm:max-h-[90vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-200 safe-bottom">
        {/* Mobile Drag Indicator */}
        <div className="w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-2.5 sm:hidden" />

        {/* Header */}
        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-850/50">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 text-white shadow-md shadow-rose-500/20">
              <Activity className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white leading-tight flex items-center gap-1.5">
                <span>Intensitas &amp; Tensi Cerita</span>
                <span className="text-[10px] font-bold py-0.5 px-2 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                  AI Arc
                </span>
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Deteksi ritme emosi, aksi, dan klimaks adegan bab
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Tutup (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* 1. Tension Waveform / Mini Sparkline Chart */}
          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
              <span className="font-extrabold flex items-center gap-1.5 text-xs">
                <TrendingUp className="w-3.5 h-3.5 text-rose-500" />
                <span>Kurva Ketegangan Narasi ({tensionItems.length} Paragraf)</span>
              </span>
              {peakItem && (
                <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 font-mono">
                  Puncak: {peakItem.tensionScore}% (P#{peakItem.paragraphIndex + 1})
                </span>
              )}
            </div>

            {tensionItems.length > 0 ? (
              <div className="space-y-2">
                {/* Horizontal Bar Visualizer */}
                <div className="h-16 flex items-end gap-1.5 px-2 py-1 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl overflow-x-auto no-scrollbar">
                  {tensionItems.map((it, idx) => {
                    const c = getTensionColor(it.tensionScore);
                    const heightPercent = Math.max(15, it.tensionScore);
                    return (
                      <div
                        key={idx}
                        className="flex-1 min-w-[10px] max-w-[20px] rounded-t-sm transition-all duration-300 hover:opacity-80 group relative cursor-pointer"
                        style={{
                          height: `${heightPercent}%`,
                          backgroundColor: c.hex,
                        }}
                        title={`P#${it.paragraphIndex + 1}: ${it.tensionScore}% (${it.label || c.label}) - ${it.note || ''}`}
                      >
                        {/* Hover Tooltip */}
                        <div className="opacity-0 group-hover:opacity-100 pointer-events-none absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] py-1 px-2 rounded-md shadow-lg whitespace-nowrap z-30 transition">
                          P#{it.paragraphIndex + 1}: {it.tensionScore}% ({it.label})
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Score Summary Metrics */}
                <div className="grid grid-cols-3 gap-2 text-center pt-1">
                  <div className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Rata-rata Tensi</span>
                    <span className="text-sm font-black font-mono text-slate-800 dark:text-slate-100">
                      {avgScore}%
                    </span>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Status Dinilai</span>
                    <span className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">
                      {evaluatedCount} / {totalParagraphs}
                    </span>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Belum Dinilai</span>
                    <span className={`text-sm font-black font-mono ${unEvaluatedCount > 0 ? 'text-amber-500 font-bold' : 'text-slate-400'}`}>
                      {unEvaluatedCount}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-slate-400 dark:text-slate-500 space-y-1">
                <BarChart2 className="w-8 h-8 mx-auto opacity-30" />
                <p className="text-[11px]">Belum ada data tensi untuk bab ini.</p>
                <p className="text-[10px]">Klik tombol analisis AI di bawah untuk mulai memetakan.</p>
              </div>
            )}
          </div>

          {/* 2. Display Mode Selector */}
          <div className="space-y-2">
            <label className="font-extrabold text-slate-700 dark:text-slate-300 block text-xs">
              Pilihan Tampilan Warna Tensi di Naskah:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {modes.map((m) => {
                const isSelected = displayMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onChangeDisplayMode(m.id)}
                    className={`p-3 rounded-2xl border text-left transition flex items-start gap-2.5 active:scale-98 ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500/50 shadow-xs ring-1 ring-amber-500/30'
                        : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="mt-0.5">{m.icon}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className={`font-bold text-xs ${isSelected ? 'text-amber-700 dark:text-amber-400' : 'text-slate-800 dark:text-slate-200'}`}>
                          {m.label}
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                        {m.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Color Scale Legend */}
          <div className="bg-slate-50 dark:bg-slate-950/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Tingkatan Warna Intensitas (Hanya yang dinilai AI)
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px]">
              <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0" />
                <span className="font-semibold truncate">0-30: Tenang</span>
              </div>
              <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 flex-shrink-0" />
                <span className="font-semibold truncate">31-60: Sedang</span>
              </div>
              <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-orange-500/10 text-orange-700 dark:text-orange-300 border border-orange-500/20">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500 flex-shrink-0" />
                <span className="font-semibold truncate">61-80: Konflik</span>
              </div>
              <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 flex-shrink-0" />
                <span className="font-semibold truncate">81-100: Puncak</span>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 italic">
              💡 Paragraf baru atau teks yang baru Anda edit akan tetap polos tanpa warna sampai Anda mengklik tombol analisis di bawah.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[10px] text-slate-500 dark:text-slate-400 text-center sm:text-left">
            {lastAnalyzedAt ? (
              <span>Dianalisis: {new Date(lastAnalyzedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            ) : (
              <span>Hemat Kuota: Berjalan hanya saat diklik</span>
            )}
          </div>

          <button
            type="button"
            onClick={onRunAnalysis}
            disabled={isAnalyzing || totalParagraphs === 0}
            className="w-full sm:w-auto min-h-[44px] py-2.5 px-4 rounded-xl font-black text-xs transition active:scale-95 flex items-center justify-center gap-2 bg-gradient-to-r from-rose-500 via-amber-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-slate-950 shadow-md shadow-rose-500/20 disabled:opacity-50 disabled:pointer-events-none"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                <span>Menganalisis Tensi Narasi...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-slate-950" />
                <span>
                  {tensionItems.length > 0 ? 'Perbarui Analisis Tensi (AI)' : 'Analisis Tensi Adegan (AI)'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
