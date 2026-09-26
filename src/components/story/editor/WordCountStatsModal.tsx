import React from 'react';
import {
  X,
  FileText,
  Clock,
  Mic,
  AlignLeft,
  CheckCircle2,
  Target,
  Sparkles,
  BarChart3
} from 'lucide-react';

interface WordCountStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  wordCount: number;
  charCount: number;
  charCountNoSpaces: number;
  paragraphCount: number;
  sentenceCount: number;
  targetWordCount: number;
}

export const WordCountStatsModal: React.FC<WordCountStatsModalProps> = ({
  isOpen,
  onClose,
  wordCount,
  charCount,
  charCountNoSpaces,
  paragraphCount,
  sentenceCount,
  targetWordCount,
}) => {
  if (!isOpen) return null;

  const target = targetWordCount > 0 ? targetWordCount : 1500;
  const progressPercent = Math.min(100, Math.round((wordCount / target) * 100));

  // Estimation: average silent reading speed ~200 wpm
  const readingTimeMin = Math.max(1, Math.round(wordCount / 200));

  // Estimation: narration / speaking speed ~130 wpm
  const speakingTimeMin = Math.max(1, Math.round(wordCount / 130));

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4 animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/15 text-amber-500 font-bold">
              <BarChart3 className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Statistik Naskah
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Analisis panjang kata & waktu baca
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Target Progress Bar */}
        <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-500/10 border border-amber-200/80 dark:border-amber-500/20 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-amber-500" />
              Target Bab Ini
            </span>
            <span className="font-mono font-bold text-amber-700 dark:text-amber-400">
              {wordCount.toLocaleString()} / {target.toLocaleString()} kata ({progressPercent}%)
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-amber-600 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* 2x2 Grid Counts */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider block mb-0.5">
              Total Kata
            </span>
            <span className="text-xl font-black text-slate-900 dark:text-white font-mono">
              {wordCount.toLocaleString()}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider block mb-0.5">
              Karakter
            </span>
            <span className="text-xl font-black text-slate-900 dark:text-white font-mono">
              {charCount.toLocaleString()}
            </span>
            <span className="block text-[9px] text-slate-400 font-mono mt-0.5">
              {charCountNoSpaces.toLocaleString()} tanpa spasi
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider block mb-0.5">
              Paragraf
            </span>
            <span className="text-xl font-black text-slate-900 dark:text-white font-mono">
              {paragraphCount}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider block mb-0.5">
              Kalimat
            </span>
            <span className="text-xl font-black text-slate-900 dark:text-white font-mono">
              {sentenceCount}
            </span>
          </div>
        </div>

        {/* Time Estimations */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/40 text-xs">
            <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-300">
              <Clock className="w-4 h-4 text-indigo-500" />
              <span>Estimasi Waktu Baca (200 wpm)</span>
            </div>
            <span className="font-bold font-mono text-indigo-700 dark:text-indigo-300">
              ~{readingTimeMin} menit
            </span>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-800/40 text-xs">
            <div className="flex items-center gap-2 text-purple-900 dark:text-purple-300">
              <Mic className="w-4 h-4 text-purple-500" />
              <span>Estimasi Bicara / Audio (130 wpm)</span>
            </div>
            <span className="font-bold font-mono text-purple-700 dark:text-purple-300">
              ~{speakingTimeMin} menit
            </span>
          </div>
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs transition active:scale-95 shadow"
        >
          Tutup
        </button>
      </div>
    </div>
  );
};
