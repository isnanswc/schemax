import React, { useState, useEffect } from 'react';
import {
  GitBranch,
  Sparkles,
  FileText,
  Zap,
  ArrowRight,
  TrendingUp,
  Flame,
  CheckCircle2,
  Clock,
  Plus,
  Loader2,
  HelpCircle,
  Compass
} from 'lucide-react';
import { StoryChapter, ChapterPlotBreakdown } from '../../../types';
import {
  generateChapterSummary,
  generateChapterAutoPlot,
  generateNextChapterBranches,
  ChapterBranchOption,
} from '../../../services/aiService';
import { db } from '../../../db';

interface ChapterPlotTabProps {
  chapter: StoryChapter;
  bookTitle: string;
  contentText: string;
  onUpdateChapter: (fields: Partial<StoryChapter>) => void;
  onSwitchChapter?: (chapter: StoryChapter) => void;
}

export const ChapterPlotTab: React.FC<ChapterPlotTabProps> = ({
  chapter,
  bookTitle,
  contentText,
  onUpdateChapter,
  onSwitchChapter,
}) => {
  const [summary, setSummary] = useState(chapter.aiSummary || '');
  const [plot, setPlot] = useState<ChapterPlotBreakdown | undefined>(chapter.aiPlot);
  const [branches, setBranches] = useState<ChapterBranchOption[]>([]);
  const [nextChapter, setNextChapter] = useState<StoryChapter | null>(null);

  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isGeneratingPlot, setIsGeneratingPlot] = useState(false);
  const [isGeneratingBranches, setIsGeneratingBranches] = useState(false);
  const [creatingBranchId, setCreatingBranchId] = useState<string | null>(null);

  // Check if next chapter already exists in database
  useEffect(() => {
    db.chapters
      .where('bookId')
      .equals(chapter.bookId)
      .filter((c) => c.order === chapter.order + 1)
      .first()
      .then((ch) => {
        setNextChapter(ch || null);
      })
      .catch((err) => console.error('Error fetching next chapter:', err));
  }, [chapter.id, chapter.order, chapter.bookId]);

  const handleGenerateSummary = async () => {
    if (!contentText.trim()) {
      alert('Tuliskan naskah bab terlebih dahulu agar AI dapat merangkum isinya.');
      return;
    }

    setIsSummarizing(true);
    try {
      const generated = await generateChapterSummary(chapter.title, bookTitle, contentText);
      if (generated) {
        setSummary(generated);
        onUpdateChapter({ aiSummary: generated });
      }
    } catch (err: any) {
      alert('Gagal membuat ringkasan: ' + (err.message || 'Periksa API Key di AI Config'));
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleGeneratePlot = async () => {
    if (!contentText.trim() && !chapter.premise) {
      alert('Tuliskan naskah bab atau premis terlebih dahulu.');
      return;
    }

    setIsGeneratingPlot(true);
    try {
      const generatedPlot = await generateChapterAutoPlot(
        chapter.title,
        bookTitle,
        contentText,
        chapter.premise
      );
      if (generatedPlot) {
        setPlot(generatedPlot);
        onUpdateChapter({ aiPlot: generatedPlot });
      }
    } catch (err: any) {
      alert('Gagal memetakan plot: ' + (err.message || 'Periksa API Key'));
    } finally {
      setIsGeneratingPlot(false);
    }
  };

  const handleGenerateBranches = async () => {
    setIsGeneratingBranches(true);
    try {
      const generatedBranches = await generateNextChapterBranches(
        chapter.title,
        bookTitle,
        contentText,
        chapter.premise
      );
      if (generatedBranches && generatedBranches.length > 0) {
        setBranches(generatedBranches);
      }
    } catch (err: any) {
      alert('Gagal menghasilkan rekomendasi cabang: ' + (err.message || 'Periksa API Key'));
    } finally {
      setIsGeneratingBranches(false);
    }
  };

  const handleCreateChapterFromBranch = async (branch: ChapterBranchOption) => {
    setCreatingBranchId(branch.id);
    try {
      const nextOrder = chapter.order + 1;
      const newId = 'chap_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
      const newChapter: StoryChapter = {
        id: newId,
        bookId: chapter.bookId,
        title: branch.title,
        order: nextOrder,
        status: 'planned',
        premise: branch.premise,
        notes: `Rekomendasi Cabang: ${branch.intensity}\nAlasan: ${branch.rationale}\n\nHook Awal: ${branch.hook}`,
        contentHtml: `<p><em>${branch.hook}</em></p><p><br></p>`,
        wordCount: 0,
        targetWordCount: 1500,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await db.chapters.add(newChapter);
      setNextChapter(newChapter);

      if (confirm(`Bab baru "Bab ${nextOrder}: ${branch.title}" berhasil dibuat! Ingin langsung membuka bab ini?`)) {
        if (onSwitchChapter) {
          onSwitchChapter(newChapter);
        }
      }
    } catch (err: any) {
      alert('Gagal membuat bab baru: ' + (err.message || 'Error IndexedDB'));
    } finally {
      setCreatingBranchId(null);
    }
  };

  return (
    <div className="space-y-4 pb-28 max-w-3xl mx-auto animate-fade-in-up px-1 sm:px-2">
      {/* 1. Header Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm space-y-2">
        <div className="flex items-center gap-1.5">
          <span className="p-1.5 rounded-xl bg-amber-500/15 text-amber-500 font-bold">
            <GitBranch className="w-4 h-4" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Ringkasan, Auto Plot & Cabang Cerita
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Analisis struktur bab dan rekomendasi arah alur untuk bab berikutnya
            </p>
          </div>
        </div>
      </div>

      {/* 2. RINGKASAN BAB (AI SUMMARY) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-amber-500" />
              <span>Ringkasan Isi Bab (AI Summary)</span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Rangkuman padat kronologis peristiwa di bab ini
            </p>
          </div>

          <button
            type="button"
            onClick={handleGenerateSummary}
            disabled={isSummarizing || !contentText.trim()}
            className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-gradient-to-r from-amber-500/15 to-indigo-500/15 hover:from-amber-500/25 hover:to-indigo-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-bold transition active:scale-95 disabled:opacity-50 flex-shrink-0"
            title="Buat rangkuman otomatis dari teks naskah"
          >
            {isSummarizing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                <span>Merangkum...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>{summary ? 'Regenerate Ringkasan' : 'Buat Ringkasan'}</span>
              </>
            )}
          </button>
        </div>

        {summary ? (
          <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
            {summary}
          </div>
        ) : (
          <div className="text-center py-6 px-4 bg-slate-50 dark:bg-slate-950/60 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
            <p className="text-xs text-slate-400">
              Belum ada ringkasan bab. Klik tombol di atas untuk membuat rangkuman otomatis dari naskah bab ini.
            </p>
          </div>
        )}
      </div>

      {/* 3. AUTO PLOT 4-ACT BREAKDOWN */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-indigo-500" />
              <span>Auto Plot 4-Babak Dramatis</span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Pemetaan struktur Hook ➔ Rising Action ➔ Climax ➔ Resolution
            </p>
          </div>

          <button
            type="button"
            onClick={handleGeneratePlot}
            disabled={isGeneratingPlot}
            className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-gradient-to-r from-indigo-500/15 to-purple-500/15 hover:from-indigo-500/25 hover:to-purple-500/25 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 text-xs font-bold transition active:scale-95 disabled:opacity-50 flex-shrink-0"
            title="Analisis dan petakan struktur plot dramatis"
          >
            {isGeneratingPlot ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                <span>Memetakan...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                <span>{plot ? 'Petakan Ulang' : 'Petakan Plot AI'}</span>
              </>
            )}
          </button>
        </div>

        {plot ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            {/* 1. Hook */}
            <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-extrabold text-xs">
                <span>🎣 1. Hook (Pembuka)</span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                {plot.hook || 'Belum terpetakan'}
              </p>
            </div>

            {/* 2. Rising Action */}
            <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-extrabold text-xs">
                <span>📈 2. Rising Action (Eskalasi)</span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                {plot.risingAction || 'Belum terpetakan'}
              </p>
            </div>

            {/* 3. Climax */}
            <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-extrabold text-xs">
                <span>⚡ 3. Climax (Titik Puncak)</span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                {plot.climax || 'Belum terpetakan'}
              </p>
            </div>

            {/* 4. Resolution */}
            <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-extrabold text-xs">
                <span>🚪 4. Resolution / Cliffhanger</span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                {plot.resolution || 'Belum terpetakan'}
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 px-4 bg-slate-50 dark:bg-slate-950/60 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
            <p className="text-xs text-slate-400">
              Struktur alur belum dipetakan. Tekan tombol "Petakan Plot AI" untuk membagi bab ini menjadi 4 babak.
            </p>
          </div>
        )}
      </div>

      {/* 4. REKOMENDASI CABANG CHAPTER SELANJUTNYA */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-purple-500" />
                <span>Rekomendasi Cabang Chapter Selanjutnya</span>
              </h3>
              {!nextChapter ? (
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500 border border-amber-500/30">
                  Bab Berikutnya Belum Ada
                </span>
              ) : (
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  Bab {nextChapter.order} Terdaftar
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {nextChapter
                ? `Bab ${nextChapter.order} ("${nextChapter.title}") sudah ada di buku. Anda tetap bisa meminta rekomendasi ide cabang alternatif di bawah ini.`
                : `Bab ${chapter.order + 1} belum dibuat. Minta AI memberikan 3 ide cabang plot menarik dan buat bab baru dengan 1 ketukan!`}
            </p>
          </div>

          <button
            type="button"
            onClick={handleGenerateBranches}
            disabled={isGeneratingBranches}
            className="flex items-center justify-center gap-1.5 py-2 px-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 text-white text-xs font-bold shadow-md shadow-purple-500/20 active:scale-95 transition flex-shrink-0 disabled:opacity-50"
          >
            {isGeneratingBranches ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Merancang Cabang...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Rancang 3 Cabang Plot ✨</span>
              </>
            )}
          </button>
        </div>

        {/* Existing next chapter quick link if available */}
        {nextChapter && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide block">
                Bab Selanjutnya Tersedia:
              </span>
              <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                Bab {nextChapter.order}: {nextChapter.title}
              </p>
            </div>

            {onSwitchChapter && (
              <button
                type="button"
                onClick={() => onSwitchChapter(nextChapter)}
                className="py-1 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition active:scale-95 flex items-center gap-1 flex-shrink-0"
              >
                <span>Buka Bab Ini</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Branches Options */}
        {branches.length > 0 ? (
          <div className="space-y-3 pt-1">
            {branches.map((b, idx) => (
              <div
                key={b.id || idx}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-purple-400 rounded-3xl p-4 sm:p-5 shadow-sm space-y-2.5 transition"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-black flex items-center justify-center">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
                      {b.title}
                    </h4>
                  </div>

                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30">
                    {b.intensity}
                  </span>
                </div>

                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  <strong>Premis:</strong> {b.premise}
                </p>

                {b.hook && (
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 italic bg-white dark:bg-slate-900/80 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                    <strong>Hook Awal:</strong> "{b.hook}"
                  </p>
                )}

                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200 dark:border-slate-800/80">
                  <span className="text-[10px] text-slate-400 truncate max-w-[200px]">
                    {b.rationale}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleCreateChapterFromBranch(b)}
                    disabled={creatingBranchId === b.id}
                    className="py-1.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 transition active:scale-95 flex items-center gap-1.5 flex-shrink-0 disabled:opacity-50"
                  >
                    {creatingBranchId === b.id ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Membuat...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5 stroke-[3]" />
                        <span>Buat Bab Berikutnya dari Cabang Ini 🚀</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          !nextChapter && (
            <div className="text-center py-6 px-4 bg-slate-50 dark:bg-slate-950/60 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
              <p className="text-xs text-slate-400">
                Tekan tombol "Rancang 3 Cabang Plot" di atas untuk mendapatkan ide alur bab berikutnya dari AI.
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
};
