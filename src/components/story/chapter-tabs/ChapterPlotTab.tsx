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
  Compass,
  Copy,
  Check,
  Users,
  ShieldAlert,
  SlidersHorizontal,
  Bookmark
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
  // Sync summary with chapter.aiSummary or chapter.premise
  const [summary, setSummary] = useState(chapter.aiSummary || chapter.premise || '');
  const [plot, setPlot] = useState<ChapterPlotBreakdown | undefined>(chapter.aiPlot);
  const [branches, setBranches] = useState<ChapterBranchOption[]>([]);
  const [nextChapter, setNextChapter] = useState<StoryChapter | null>(null);

  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isGeneratingPlot, setIsGeneratingPlot] = useState(false);
  const [isGeneratingBranches, setIsGeneratingBranches] = useState(false);
  const [creatingBranchId, setCreatingBranchId] = useState<string | null>(null);

  // Generate Semua with sequential delay state
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [generateAllStep, setGenerateAllStep] = useState<string>('');

  // Copy toast state
  const [copiedSummary, setCopiedSummary] = useState(false);

  // Keep summary synchronized if prop updates
  useEffect(() => {
    if (chapter.aiSummary || chapter.premise) {
      setSummary(chapter.aiSummary || chapter.premise || '');
    }
    if (chapter.aiPlot) {
      setPlot(chapter.aiPlot);
    }
  }, [chapter.aiSummary, chapter.premise, chapter.aiPlot]);

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

  const getEffectiveText = (): string => {
    if (contentText && contentText.trim()) return contentText.trim();
    if (chapter.contentHtml && chapter.contentHtml.trim()) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = chapter.contentHtml;
      const stripped = (tempDiv.textContent || tempDiv.innerText || '').trim();
      if (stripped) return stripped;
    }
    return (chapter.premise || chapter.notes || '').trim();
  };

  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const handleCopySummary = () => {
    if (!summary) return;
    navigator.clipboard.writeText(summary);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2200);
  };

  const handleGenerateSummary = async () => {
    const textToSummarize = getEffectiveText();
    if (!textToSummarize) {
      alert('Tuliskan naskah bab atau premis terlebih dahulu agar AI dapat merangkum isinya.');
      return;
    }

    setIsSummarizing(true);
    try {
      const generated = await generateChapterSummary(chapter.title, bookTitle, textToSummarize);
      if (generated) {
        setSummary(generated);
        // Synchronize: Ringkasan Isi Bab = Premis & Cerita Singkat
        onUpdateChapter({ aiSummary: generated, premise: generated });
      }
    } catch (err: any) {
      alert('Gagal membuat ringkasan: ' + (err.message || 'Periksa API Key di AI Config'));
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleGeneratePlot = async () => {
    const textToPlot = getEffectiveText();
    if (!textToPlot) {
      alert('Tuliskan naskah bab atau premis terlebih dahulu.');
      return;
    }

    setIsGeneratingPlot(true);
    try {
      const generatedPlot = await generateChapterAutoPlot(
        chapter.title,
        bookTitle,
        textToPlot,
        summary || chapter.premise
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
    const textToBranch = getEffectiveText();
    setIsGeneratingBranches(true);
    try {
      const generatedBranches = await generateNextChapterBranches(
        chapter.title,
        bookTitle,
        textToBranch,
        summary || chapter.premise
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

  // 🚀 Generate Semua Analisis secara berurutan dengan jeda 2.5 detik untuk menghindari rate limit API
  const handleGenerateAll = async () => {
    const text = getEffectiveText();
    if (!text) {
      alert('Tuliskan naskah bab atau premis terlebih dahulu agar AI dapat menganalisis.');
      return;
    }

    setIsGeneratingAll(true);
    try {
      // 1. Ringkasan Isi Bab
      setGenerateAllStep('1/3 Merangkum isi bab...');
      const genSummary = await generateChapterSummary(chapter.title, bookTitle, text);
      let effectiveSummary = summary;
      if (genSummary) {
        effectiveSummary = genSummary;
        setSummary(genSummary);
        onUpdateChapter({ aiSummary: genSummary, premise: genSummary });
      }

      // Jeda 2.5 detik agar kuota TPM/RPM tidak terkena limit
      setGenerateAllStep('Jeda aman kuota AI (2.5 detik)...');
      await delay(2500);

      // 2. Auto Plot 4-Babak
      setGenerateAllStep('2/3 Memetakan struktur plot 4-babak...');
      const genPlot = await generateChapterAutoPlot(
        chapter.title,
        bookTitle,
        text,
        effectiveSummary || chapter.premise
      );
      if (genPlot) {
        setPlot(genPlot);
        onUpdateChapter({ aiPlot: genPlot });
      }

      // Jeda 2.5 detik lagi
      setGenerateAllStep('Jeda aman kuota AI (2.5 detik)...');
      await delay(2500);

      // 3. Rekomendasi Cabang Cerita Berkelanjutan
      setGenerateAllStep('3/3 Merancang 3 cabang alur cerita...');
      const genBranches = await generateNextChapterBranches(
        chapter.title,
        bookTitle,
        text,
        effectiveSummary || chapter.premise
      );
      if (genBranches && genBranches.length > 0) {
        setBranches(genBranches);
      }
    } catch (err: any) {
      alert('Terjadi kendala saat Generate Semua: ' + (err.message || 'Periksa koneksi atau API Key'));
    } finally {
      setIsGeneratingAll(false);
      setGenerateAllStep('');
    }
  };

  const handleCreateChapterFromBranch = async (branch: ChapterBranchOption) => {
    setCreatingBranchId(branch.id);
    try {
      const nextOrder = chapter.order + 1;
      const newId = 'chap_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
      
      const detailedNotes = [
        `Rekomendasi Cabang: ${branch.intensity}`,
        `Alasan Alur: ${branch.rationale}`,
        branch.storyPlan ? `\nRencana Alur Cerita:\n${branch.storyPlan}` : '',
        branch.involvedCharacters && branch.involvedCharacters.length > 0
          ? `\nKarakter Terlibat: ${branch.involvedCharacters.join(', ')}`
          : '',
        branch.characterConditions ? `\nKondisi Tokoh: ${branch.characterConditions}` : '',
        branch.climax ? `\nTitik Puncak Klimaks: ${branch.climax}` : '',
        branch.potentialTwist ? `\nPotensi Twist/Kejutan: ${branch.potentialTwist}` : '',
        `\nHook Awal: ${branch.hook}`,
      ]
        .filter(Boolean)
        .join('\n');

      const newChapter: StoryChapter = {
        id: newId,
        bookId: chapter.bookId,
        title: branch.title,
        order: nextOrder,
        status: 'planned',
        premise: branch.premise,
        notes: detailedNotes,
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
      {/* 1. Header Card with Generate Semua */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-2xl bg-gradient-to-r from-amber-500/20 to-purple-500/20 text-amber-500 font-bold flex-shrink-0">
              <GitBranch className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                Ringkasan, Auto Plot &amp; Cabang Cerita
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Analisis kontinuitas bab &amp; pemetaan arah bab berikutnya
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGenerateAll}
            disabled={isGeneratingAll || !getEffectiveText()}
            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 via-pink-500 to-purple-600 hover:opacity-95 text-white font-black text-xs shadow-md shadow-pink-500/20 active:scale-95 transition flex-shrink-0 disabled:opacity-50"
            title="Jalankan otomatis Ringkasan Bab, Auto Plot 4-Babak, dan Rekomendasi 3 Cabang Alur dengan jeda kuota aman"
          >
            {isGeneratingAll ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                <span className="text-xs truncate max-w-[220px]">{generateAllStep || 'Menganalisis...'}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Generate Semua Analisis ✨</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. RINGKASAN BAB (AI SUMMARY = PREMIS & CERITA SINGKAT) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-amber-500" />
                <span>Ringkasan Isi Bab</span>
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                = Premis &amp; Cerita Singkat
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Rangkuman padat isi bab yang terhubung langsung dengan Premis di Menu Chapter Info
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            {summary && (
              <button
                type="button"
                onClick={handleCopySummary}
                className="flex items-center gap-1 py-1.5 px-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition active:scale-95 border border-slate-200 dark:border-slate-700"
                title="Salin ringkasan ke clipboard"
              >
                {copiedSummary ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={handleGenerateSummary}
              disabled={isSummarizing || isGeneratingAll || !getEffectiveText()}
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
        </div>

        {summary ? (
          <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed space-y-2">
            <p className="whitespace-pre-line">{summary}</p>
            <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-800/60 text-[10px] text-slate-400">
              <span>Sinkron otomatis dengan Chapter Info</span>
              <button
                type="button"
                onClick={handleCopySummary}
                className="hover:text-amber-500 inline-flex items-center gap-1 font-semibold"
              >
                <Copy className="w-3 h-3" />
                <span>Salin Teks Ringkasan</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 px-4 bg-slate-50 dark:bg-slate-950/60 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
            <p className="text-xs text-slate-400">
              Belum ada ringkasan bab. Klik tombol di atas atau gunakan "Generate Semua Analisis" untuk merangkum naskah.
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
            disabled={isGeneratingPlot || isGeneratingAll}
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
              Rekomendasi alur terstruktur yang sangat masuk akal berdasar peristiwa di bab ini
            </p>
          </div>

          <button
            type="button"
            onClick={handleGenerateBranches}
            disabled={isGeneratingBranches || isGeneratingAll}
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

        {/* Branches Options with Detailed Narrative Architecture */}
        {branches.length > 0 ? (
          <div className="space-y-3.5 pt-1">
            {branches.map((b, idx) => (
              <div
                key={b.id || idx}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-purple-400 rounded-3xl p-4 sm:p-5 shadow-sm space-y-3 transition"
              >
                {/* Header: Title and Intensity */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-black flex items-center justify-center flex-shrink-0">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
                      {b.title}
                    </h4>
                  </div>

                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 flex-shrink-0">
                    {b.intensity}
                  </span>
                </div>

                {/* Premise */}
                <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-white/70 dark:bg-slate-900/60 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800/80">
                  <span className="font-bold text-slate-900 dark:text-white block mb-0.5">Premis Cabang:</span>
                  <p>{b.premise}</p>
                </div>

                {/* Detailed Story Plan (Rencana Alur Cerita yang Masuk Akal) */}
                {b.storyPlan && (
                  <div className="text-xs space-y-1 bg-amber-50/60 dark:bg-amber-950/20 p-3 rounded-2xl border border-amber-200/70 dark:border-amber-500/30">
                    <span className="font-bold text-amber-800 dark:text-amber-400 flex items-center gap-1.5 text-[11px]">
                      <Bookmark className="w-3.5 h-3.5 text-amber-500" />
                      <span>Rencana Cerita Berkelanjutan:</span>
                    </span>
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line text-xs">
                      {b.storyPlan}
                    </p>
                  </div>
                )}

                {/* Characters Involved & Their Conditions */}
                {((b.involvedCharacters && b.involvedCharacters.length > 0) || b.characterConditions) && (
                  <div className="text-xs space-y-1.5 bg-blue-50/50 dark:bg-blue-950/20 p-3 rounded-2xl border border-blue-200/60 dark:border-blue-500/20">
                    {b.involvedCharacters && b.involvedCharacters.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-blue-900 dark:text-blue-300 text-[11px] flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-blue-500" />
                          <span>Tokoh Terlibat:</span>
                        </span>
                        {b.involvedCharacters.map((cName, cIdx) => (
                          <span
                            key={cIdx}
                            className="px-2 py-0.5 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 font-semibold text-[10px]"
                          >
                            {cName}
                          </span>
                        ))}
                      </div>
                    )}

                    {b.characterConditions && (
                      <p className="text-slate-700 dark:text-slate-300 text-[11px] leading-relaxed pt-0.5">
                        <strong className="text-slate-900 dark:text-white">Kondisi &amp; Peran:</strong> {b.characterConditions}
                      </p>
                    )}
                  </div>
                )}

                {/* Climax & Twist Badges */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {b.climax && (
                    <div className="p-2.5 rounded-2xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/70 dark:border-rose-500/30 space-y-0.5">
                      <span className="font-extrabold text-rose-700 dark:text-rose-400 text-[10px] flex items-center gap-1 uppercase tracking-wide">
                        <Flame className="w-3 h-3 text-rose-500" />
                        <span>Puncak Klimaks:</span>
                      </span>
                      <p className="text-slate-700 dark:text-slate-300 text-[11px] leading-snug">
                        {b.climax}
                      </p>
                    </div>
                  )}

                  {b.potentialTwist && (
                    <div className="p-2.5 rounded-2xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200/70 dark:border-purple-500/30 space-y-0.5">
                      <span className="font-extrabold text-purple-700 dark:text-purple-400 text-[10px] flex items-center gap-1 uppercase tracking-wide">
                        <Zap className="w-3 h-3 text-purple-500" />
                        <span>Potensi Twist:</span>
                      </span>
                      <p className="text-slate-700 dark:text-slate-300 text-[11px] leading-snug">
                        {b.potentialTwist}
                      </p>
                    </div>
                  )}
                </div>

                {/* Opening Hook Quote */}
                {b.hook && (
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 italic bg-white dark:bg-slate-900/80 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                    <strong>Hook Awal:</strong> "{b.hook}"
                  </p>
                )}

                {/* Footer Action */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800/80">
                  <span className="text-[10px] text-slate-400 truncate max-w-[200px]" title={b.rationale}>
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
