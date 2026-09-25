import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  BookOpen,
  FileText,
  Sparkles,
  Edit3,
  CheckCircle2,
  Clock,
  Plus,
  Trash2,
  Copy,
  Wand2,
  Layers,
  Film,
  Compass,
  Check,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  Loader2,
  Save,
} from 'lucide-react';
import { Book, StoryChapter, ChapterStatus, ChapterRawDraft, ChapterPlotBreakdown, ChapterSceneItem } from '../../types';
import { db } from '../../db';
import {
  generateChapterSummary,
  generateChapterAutoPlot,
  generateChapterAutoScenes,
  enhanceRawToProse,
} from '../../services/aiService';

interface ChapterStudioViewProps {
  chapter: StoryChapter;
  book: Book;
  onBack: () => void;
  onOpenEditor: (chapter: StoryChapter) => void;
  onChapterUpdated?: (updatedChapter: StoryChapter) => void;
}

type StudioTab = 'premise' | 'raw' | 'main' | 'ai';

export const ChapterStudioView: React.FC<ChapterStudioViewProps> = ({
  chapter: initialChapter,
  book,
  onBack,
  onOpenEditor,
  onChapterUpdated,
}) => {
  const [chapter, setChapter] = useState<StoryChapter>(initialChapter);
  const [activeTab, setActiveTab] = useState<StudioTab>('premise');

  // 1. Premis State
  const [premiseText, setPremiseText] = useState(initialChapter.premise || '');
  const [chapterNotes, setChapterNotes] = useState(initialChapter.notes || '');
  const [targetWords, setTargetWords] = useState(String(initialChapter.targetWordCount || 1500));
  const [isSavedPremise, setIsSavedPremise] = useState(false);

  // 2. Multi-Raw Drafts State
  const defaultRawList: ChapterRawDraft[] =
    initialChapter.rawDrafts && initialChapter.rawDrafts.length > 0
      ? initialChapter.rawDrafts
      : [
          {
            id: 'raw_1',
            title: 'Coretan Kasar 1',
            content: '',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ];

  const [rawDrafts, setRawDrafts] = useState<ChapterRawDraft[]>(defaultRawList);
  const [activeRawId, setActiveRawId] = useState<string>(
    initialChapter.activeRawDraftId || defaultRawList[0].id
  );
  const [isPolishingAi, setIsPolishingAi] = useState(false);
  const [polishedAiResult, setPolishedAiResult] = useState<string | null>(null);

  // 3. AI Studio States
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isGeneratingPlot, setIsGeneratingPlot] = useState(false);
  const [isGeneratingScenes, setIsGeneratingScenes] = useState(false);
  const [aiStudioError, setAiStudioError] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Keep state synced when prop changes
  useEffect(() => {
    setChapter(initialChapter);
    setPremiseText(initialChapter.premise || '');
    setChapterNotes(initialChapter.notes || '');
    setTargetWords(String(initialChapter.targetWordCount || 1500));

    if (initialChapter.rawDrafts && initialChapter.rawDrafts.length > 0) {
      setRawDrafts(initialChapter.rawDrafts);
      if (initialChapter.activeRawDraftId) {
        setActiveRawId(initialChapter.activeRawDraftId);
      }
    }
  }, [initialChapter]);

  const activeRawDraft =
    rawDrafts.find((r) => r.id === activeRawId) || rawDrafts[0];

  // Helper to strip HTML tags for plain text reading
  const stripHtml = (html: string) => {
    const tmp = document.createElement('DIV');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  const plainContent = stripHtml(chapter.contentHtml || '').trim();
  const wordCount = chapter.wordCount || (plainContent ? plainContent.split(/\s+/).filter(Boolean).length : 0);
  const readingTime = Math.ceil(wordCount / 200);

  // Status configuration
  const statusMeta: Record<ChapterStatus, { label: string; bg: string; dot: string }> = {
    planned: {
      label: 'Direncanakan',
      bg: 'bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/30',
      dot: 'bg-purple-500 dark:bg-purple-400',
    },
    in_progress: {
      label: 'Sedang Ditulis',
      bg: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30',
      dot: 'bg-amber-500 dark:bg-amber-400',
    },
    completed: {
      label: 'Selesai',
      bg: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30',
      dot: 'bg-emerald-500 dark:bg-emerald-400',
    },
  };

  // Quick Status Toggle
  const handleToggleStatus = async () => {
    const nextStatusMap: Record<ChapterStatus, ChapterStatus> = {
      planned: 'in_progress',
      in_progress: 'completed',
      completed: 'planned',
    };
    const newStatus = nextStatusMap[chapter.status];
    const updated = {
      ...chapter,
      status: newStatus,
      updatedAt: Date.now(),
    };
    await db.chapters.update(chapter.id, updated);
    setChapter(updated);
    onChapterUpdated?.(updated);
  };

  // Save Premise & Brief
  const handleSavePremise = async () => {
    const updated: StoryChapter = {
      ...chapter,
      premise: premiseText.trim(),
      notes: chapterNotes.trim(),
      targetWordCount: parseInt(targetWords) || 1500,
      updatedAt: Date.now(),
    };
    await db.chapters.update(chapter.id, updated);
    setChapter(updated);
    onChapterUpdated?.(updated);
    setIsSavedPremise(true);
    setTimeout(() => setIsSavedPremise(false), 2000);
  };

  // Raw Draft Handlers
  const handleUpdateRawContent = (content: string) => {
    const updatedDrafts = rawDrafts.map((r) =>
      r.id === activeRawDraft.id
        ? { ...r, content, updatedAt: Date.now() }
        : r
    );
    setRawDrafts(updatedDrafts);
    debouncedSaveRawDrafts(updatedDrafts, activeRawDraft.id);
  };

  const handleUpdateRawTitle = (title: string) => {
    const updatedDrafts = rawDrafts.map((r) =>
      r.id === activeRawDraft.id
        ? { ...r, title, updatedAt: Date.now() }
        : r
    );
    setRawDrafts(updatedDrafts);
    saveRawDraftsToDb(updatedDrafts, activeRawDraft.id);
  };

  const handleAddRawDraft = () => {
    const newId = 'raw_' + Math.random().toString(36).substring(2, 9);
    const newDraft: ChapterRawDraft = {
      id: newId,
      title: `Coretan Kasar ${rawDrafts.length + 1}`,
      content: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const updated = [...rawDrafts, newDraft];
    setRawDrafts(updated);
    setActiveRawId(newId);
    saveRawDraftsToDb(updated, newId);
  };

  const handleDeleteRawDraft = (draftId: string) => {
    if (rawDrafts.length <= 1) {
      alert('Minimal harus ada satu draf kasar.');
      return;
    }
    if (confirm('Hapus lembar tulisan kasar ini?')) {
      const filtered = rawDrafts.filter((r) => r.id !== draftId);
      setRawDrafts(filtered);
      setActiveRawId(filtered[0].id);
      saveRawDraftsToDb(filtered, filtered[0].id);
    }
  };

  const saveRawDraftsToDb = async (drafts: ChapterRawDraft[], activeId: string) => {
    const updated: StoryChapter = {
      ...chapter,
      rawDrafts: drafts,
      activeRawDraftId: activeId,
      updatedAt: Date.now(),
    };
    await db.chapters.update(chapter.id, updated);
    setChapter(updated);
    onChapterUpdated?.(updated);
  };

  // Debounced save for raw draft typing
  const debouncedSaveRawDrafts = (() => {
    let timer: any = null;
    return (drafts: ChapterRawDraft[], activeId: string) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        saveRawDraftsToDb(drafts, activeId);
      }, 700);
    };
  })();

  // Copy raw draft text directly to main chapter draft
  const handleTransferRawToMain = async () => {
    if (!activeRawDraft.content.trim()) {
      alert('Tulisan kasar masih kosong.');
      return;
    }
    if (
      confirm(
        'Gabungkan tulisan kasar ini ke naskah utama? (Akan ditambahkan di bagian bawah naskah cerita)'
      )
    ) {
      const rawParagraphs = activeRawDraft.content
        .split('\n\n')
        .map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
        .join('');

      const newContentHtml = chapter.contentHtml
        ? `${chapter.contentHtml}<br/><br/>${rawParagraphs}`
        : rawParagraphs;

      const words = stripHtml(newContentHtml).split(/\s+/).filter(Boolean).length;
      const updated: StoryChapter = {
        ...chapter,
        contentHtml: newContentHtml,
        wordCount: words,
        status: chapter.status === 'planned' ? 'in_progress' : chapter.status,
        updatedAt: Date.now(),
      };
      await db.chapters.update(chapter.id, updated);
      setChapter(updated);
      onChapterUpdated?.(updated);
      alert('Tulisan kasar berhasil digabungkan ke Naskah Utama!');
      setActiveTab('main');
    }
  };

  // AI Polish Raw Draft to Prose
  const handlePolishRawWithAi = async () => {
    if (!activeRawDraft.content.trim()) {
      alert('Tulis draf kasar terlebih dahulu sebelum dipoles AI.');
      return;
    }
    setIsPolishingAi(true);
    setAiStudioError(null);
    try {
      const result = await enhanceRawToProse(
        activeRawDraft.content,
        book.title,
        chapter.title,
        book.genre
      );
      setPolishedAiResult(result);
    } catch (err: any) {
      setAiStudioError(err.message || 'Gagal memoles dengan AI.');
    } finally {
      setIsPolishingAi(false);
    }
  };

  // Apply AI Polished Result to Main Chapter
  const handleApplyPolishedToMain = async () => {
    if (!polishedAiResult) return;
    const formattedHtml = polishedAiResult
      .split('\n\n')
      .map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
      .join('');

    const newContentHtml = chapter.contentHtml
      ? `${chapter.contentHtml}<br/><br/>${formattedHtml}`
      : formattedHtml;

    const words = stripHtml(newContentHtml).split(/\s+/).filter(Boolean).length;
    const updated: StoryChapter = {
      ...chapter,
      contentHtml: newContentHtml,
      wordCount: words,
      status: chapter.status === 'planned' ? 'in_progress' : chapter.status,
      updatedAt: Date.now(),
    };
    await db.chapters.update(chapter.id, updated);
    setChapter(updated);
    onChapterUpdated?.(updated);
    setPolishedAiResult(null);
    alert('Naskah hasil polesan AI berhasil disatukan ke Naskah Utama!');
    setActiveTab('main');
  };

  // ==========================================
  // AI STUDIO HANDLERS (Summary, Plot, Scenes)
  // ==========================================
  const getEffectiveSourceText = () => {
    if (plainContent.length > 50) return plainContent;
    if (activeRawDraft.content.trim().length > 30) return activeRawDraft.content;
    if (premiseText.trim().length > 20) return premiseText;
    return '';
  };

  const handleGenerateSummary = async () => {
    const text = getEffectiveSourceText();
    if (!text) {
      setAiStudioError('Belum ada isi naskah atau draf kasar untuk dirangkum.');
      return;
    }
    setIsGeneratingSummary(true);
    setAiStudioError(null);
    try {
      const summary = await generateChapterSummary(chapter.title, book.title, text);
      const updated: StoryChapter = {
        ...chapter,
        aiSummary: summary,
        updatedAt: Date.now(),
      };
      await db.chapters.update(chapter.id, updated);
      setChapter(updated);
      onChapterUpdated?.(updated);
    } catch (err: any) {
      setAiStudioError(err.message || 'Gagal generate ringkasan AI.');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleGeneratePlot = async () => {
    const text = getEffectiveSourceText();
    if (!text && !premiseText) {
      setAiStudioError('Isi premis atau naskah bab terlebih dahulu untuk memetakan plot.');
      return;
    }
    setIsGeneratingPlot(true);
    setAiStudioError(null);
    try {
      const plot = await generateChapterAutoPlot(chapter.title, book.title, text, premiseText);
      const updated: StoryChapter = {
        ...chapter,
        aiPlot: plot,
        updatedAt: Date.now(),
      };
      await db.chapters.update(chapter.id, updated);
      setChapter(updated);
      onChapterUpdated?.(updated);
    } catch (err: any) {
      setAiStudioError(err.message || 'Gagal memetakan plot AI.');
    } finally {
      setIsGeneratingPlot(false);
    }
  };

  const handleGenerateScenes = async () => {
    const text = getEffectiveSourceText();
    if (!text) {
      setAiStudioError('Isi naskah cerita atau draf kasar bab terlebih dahulu untuk membedah adegan.');
      return;
    }
    setIsGeneratingScenes(true);
    setAiStudioError(null);
    try {
      const scenes = await generateChapterAutoScenes(chapter.title, book.title, text);
      const updated: StoryChapter = {
        ...chapter,
        aiScenes: scenes,
        updatedAt: Date.now(),
      };
      await db.chapters.update(chapter.id, updated);
      setChapter(updated);
      onChapterUpdated?.(updated);
    } catch (err: any) {
      setAiStudioError(err.message || 'Gagal membedah adegan AI.');
    } finally {
      setIsGeneratingScenes(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopyFeedback(label);
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans">
      {/* 🌟 1. Top Chapter Studio Header */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-3 sm:px-6 py-2.5 sm:py-3 safe-top shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          {/* Left: Back & Title info */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="p-2 -ml-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white active:scale-95 transition"
              aria-label="Kembali ke Daftar Bab"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  Bab {chapter.order}
                </span>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <button
                  type="button"
                  onClick={handleToggleStatus}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusMeta[chapter.status].bg} active:scale-95 transition`}
                  title="Ketuk untuk ubah status bab"
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${statusMeta[chapter.status].dot}`} />
                  <span>{statusMeta[chapter.status].label}</span>
                </button>
              </div>

              <h1 className="text-sm sm:text-base font-extrabold truncate text-slate-900 dark:text-white leading-tight">
                {chapter.title}
              </h1>
            </div>
          </div>

          {/* Right: Primary Action to Open Fullscreen RichText Editor */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => onOpenEditor(chapter)}
              className="py-2 px-3 sm:px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-95 text-slate-950 font-bold text-xs sm:text-sm shadow-md shadow-amber-500/20 transition flex items-center gap-1.5"
            >
              <Edit3 className="w-4 h-4" />
              <span>Poles Naskah Utama</span>
            </button>
          </div>
        </div>

        {/* 📑 2. Studio Workstation Navigation Tabs */}
        <div className="max-w-5xl mx-auto flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-2.5">
          <button
            type="button"
            onClick={() => setActiveTab('premise')}
            className={`py-1.5 px-3 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
              activeTab === 'premise'
                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Compass className="w-3.5 h-3.5 text-amber-500" />
            <span>1. Cerita Singkat &amp; Premis</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('raw')}
            className={`py-1.5 px-3 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
              activeTab === 'raw'
                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-amber-500" />
            <span>2. Tulisan Kasar (Raw)</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
              {rawDrafts.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('main')}
            className={`py-1.5 px-3 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
              activeTab === 'main'
                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-amber-500" />
            <span>3. Naskah Cerita Utama</span>
            <span className="text-[10px] text-slate-400">({wordCount} kata)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ai')}
            className={`py-1.5 px-3 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
              activeTab === 'ai'
                ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            <span>4. AI Studio (Plot &amp; Scene)</span>
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
          </button>
        </div>
      </header>

      {/* 📦 Main Workstation Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-3 sm:p-6 space-y-4">
        {/* Error notification banner if any */}
        {aiStudioError && (
          <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 flex items-start gap-2.5 text-xs text-red-700 dark:text-red-300 animate-in fade-in">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-500" />
            <div className="flex-1 leading-relaxed">{aiStudioError}</div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 1: CERITA SINGKAT & PREMIS BAB (Before Writing Core Text)              */}
        {/* ========================================================================= */}
        {activeTab === 'premise' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <Compass className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      Cerita Singkat &amp; Premis Bab
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Rancang garis besar alur sebelum mulai menuangkan naskah lengkap
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSavePremise}
                  className="py-2 px-3.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-bold text-xs flex items-center gap-1.5 active:scale-95 transition shadow-sm"
                >
                  {isSavedPremise ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Tersimpan!</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Simpan Konsep</span>
                    </>
                  )}
                </button>
              </div>

              {/* Premise Editor */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Rangkuman Singkat Isi Bab *
                </label>
                <textarea
                  rows={4}
                  value={premiseText}
                  onChange={(e) => setPremiseText(e.target.value)}
                  placeholder="Ceritakan apa yang akan terjadi di bab ini secara singkat: Siapa yang bertemu, apa masalah yang muncul, dan kejutan apa yang terjadi..."
                  className="w-full p-3.5 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:border-amber-500 transition shadow-inner leading-relaxed resize-none"
                />
              </div>

              {/* Target & Research Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Target Kata Bab Ini
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={targetWords}
                      onChange={(e) => setTargetWords(e.target.value)}
                      placeholder="1500"
                      className="w-full py-2.5 px-3.5 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-amber-500 shadow-inner"
                    />
                    <span className="absolute right-3.5 top-2.5 text-xs text-slate-400 pointer-events-none">
                      kata
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Catatan Khusus / Riset Bab
                  </label>
                  <input
                    type="text"
                    value={chapterNotes}
                    onChange={(e) => setChapterNotes(e.target.value)}
                    placeholder="Contoh: Suasana hujan lebat, senjata panah perak..."
                    className="w-full py-2.5 px-3.5 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-amber-500 shadow-inner"
                  />
                </div>
              </div>

              {/* Next Step Banner */}
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-500/10 border border-amber-200/80 dark:border-amber-500/20 text-xs">
                <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
                  <Sparkles className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  <span>
                    Setelah premis siap, mulai tulis ide kasar di <strong>Tab Tulisan Kasar (Raw)</strong> sebelum dipoles.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('raw')}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold flex items-center justify-center gap-1 active:scale-95 transition"
                >
                  <span>Buka Tulisan Kasar</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: TULISAN KASAR (MULTI-RAW DRAFTS WORKSPACE)                          */}
        {/* ========================================================================= */}
        {activeTab === 'raw' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-6 shadow-sm space-y-4">
              {/* Header & Multi-Raw Tab Selector */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-amber-500" />
                    <span>Ruang Coretan Kasar (Raw Drafts)</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Tulis ide spontan, coretan dialog, atau alur mentah tanpa takut merusak naskah utama
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAddRawDraft}
                    className="py-1.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 transition active:scale-95 border border-slate-200 dark:border-slate-700"
                  >
                    <Plus className="w-3.5 h-3.5 text-amber-500" />
                    <span>+ Lembar Raw Baru</span>
                  </button>
                </div>
              </div>

              {/* Draft Switcher Tabs */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                {rawDrafts.map((draft, idx) => (
                  <div
                    key={draft.id}
                    className={`flex items-center gap-1 py-1.5 px-3 rounded-xl text-xs font-bold transition flex-shrink-0 cursor-pointer ${
                      draft.id === activeRawId
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                    onClick={() => setActiveRawId(draft.id)}
                  >
                    <span>{draft.title || `Raw ${idx + 1}`}</span>
                    {rawDrafts.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteRawDraft(draft.id);
                        }}
                        className="p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/20 transition ml-1"
                        title="Hapus lembar raw ini"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Title input for active raw */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-semibold">Nama Lembar:</span>
                <input
                  type="text"
                  value={activeRawDraft.title}
                  onChange={(e) => handleUpdateRawTitle(e.target.value)}
                  className="px-2.5 py-1 bg-transparent border-b border-dashed border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-amber-500 max-w-xs"
                />
              </div>

              {/* Raw Textarea */}
              <div className="relative">
                <textarea
                  rows={10}
                  value={activeRawDraft.content}
                  onChange={(e) => handleUpdateRawContent(e.target.value)}
                  placeholder="Ketik coretan bebas di sini... Contoh:&#10;- Budi berlari ke pasar&#10;- Ketemu pedagang misterius berkerudung hijau&#10;- Dialog: 'Bawa ini sebelum matahari tenggelam!'&#10;- Tiba-tiba ada suara ledakan di arah benteng..."
                  className="w-full p-4 bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-slate-100 placeholder-slate-400 text-sm focus:outline-none focus:border-amber-500 font-mono transition shadow-inner leading-relaxed"
                />
                <span className="absolute right-3 bottom-3 text-[11px] text-slate-400 font-sans pointer-events-none">
                  {activeRawDraft.content.length} karakter • Otomatis tersimpan
                </span>
              </div>

              {/* Actions on Raw Draft */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                  {/* Polish with AI Button */}
                  <button
                    type="button"
                    onClick={handlePolishRawWithAi}
                    disabled={isPolishingAi || !activeRawDraft.content.trim()}
                    className="py-2 px-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200 dark:border-indigo-500/30 hover:bg-indigo-100 dark:hover:bg-indigo-500/25 text-indigo-700 dark:text-indigo-300 text-xs font-bold flex items-center gap-1.5 active:scale-95 transition disabled:opacity-50"
                  >
                    {isPolishingAi ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Menyulap Jadi Prosa...</span>
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-3.5 h-3.5 text-amber-500" />
                        <span>Poles dengan AI ✨</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {/* Append directly to main chapter */}
                  <button
                    type="button"
                    onClick={handleTransferRawToMain}
                    disabled={!activeRawDraft.content.trim()}
                    className="py-2 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-xs font-bold flex items-center gap-1.5 active:scale-95 transition shadow-sm disabled:opacity-50"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin ke Naskah Utama 📋</span>
                  </button>
                </div>
              </div>

              {/* AI Polished Preview Area if Available */}
              {polishedAiResult && (
                <div className="p-4 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-500/30 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-800 dark:text-indigo-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>Hasil Polesan AI (Prosa Siap Pakai)</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setPolishedAiResult(null)}
                      className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      Tutup
                    </button>
                  </div>

                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl text-xs text-slate-800 dark:text-slate-200 leading-relaxed max-h-60 overflow-y-auto whitespace-pre-line border border-slate-200 dark:border-slate-800">
                    {polishedAiResult}
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(polishedAiResult, 'prose')}
                      className="py-1.5 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                    >
                      {copyFeedback === 'prose' ? 'Tersalin!' : 'Salin Teks'}
                    </button>
                    <button
                      type="button"
                      onClick={handleApplyPolishedToMain}
                      className="py-1.5 px-3.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-bold shadow-md shadow-indigo-500/20 active:scale-95 transition"
                    >
                      Satukan ke Naskah Utama ➔
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: NASKAH CERITA UTAMA (POLISHED READER & DIRECT LAUNCH)               */}
        {/* ========================================================================= */}
        {activeTab === 'main' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-7 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-500" />
                    <span>Naskah Cerita Utama</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Naskah resmi bab yang telah dipoles dan siap dinikmati pembaca
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenEditor(chapter)}
                    className="py-2 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-95 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition flex items-center gap-1.5"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Buka Editor Poles Naskah ✍️</span>
                  </button>
                </div>
              </div>

              {/* Reader View of Main Content */}
              {chapter.contentHtml && plainContent.length > 0 ? (
                <div className="space-y-4">
                  <div
                    className="prose dark:prose-invert max-w-none text-slate-800 dark:text-slate-200 text-sm leading-relaxed p-4 sm:p-6 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 rounded-2xl max-h-[60vh] overflow-y-auto"
                    dangerouslySetInnerHTML={{ __html: chapter.contentHtml }}
                  />

                  {/* Word Count & Stats Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800/60 text-xs text-slate-600 dark:text-slate-300">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1 font-bold text-slate-900 dark:text-white">
                        <FileText className="w-3.5 h-3.5 text-amber-500" />
                        {wordCount.toLocaleString()} Kata
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        ±{readingTime} Menit Baca
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400">
                      Terakhir diperbarui: {new Date(chapter.updatedAt).toLocaleDateString('id-ID')}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 px-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-slate-50/50 dark:bg-slate-950/30 space-y-3">
                  <FileText className="w-10 h-10 mx-auto text-slate-400 dark:text-slate-600" />
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Naskah Utama Masih Kosong
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                    Anda dapat menulis ide kasar terlebih dahulu di tab <strong>Tulisan Kasar (Raw)</strong>, atau langsung mulai memoles cerita lengkap di Fullscreen Editor.
                  </p>
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('raw')}
                      className="py-2 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-semibold text-xs transition"
                    >
                      Buka Tulisan Kasar
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenEditor(chapter)}
                      className="py-2 px-4 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 active:scale-95 transition flex items-center gap-1.5"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Mulai Menulis Naskah</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: AI INTELLIGENCE STUDIO (Ringkasan AI, Auto Plot, Auto Scene)       */}
        {/* ========================================================================= */}
        {activeTab === 'ai' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* 📑 1. RINGKASAN CERITA UTAMA BAB (AI Summary) */}
            <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-6 shadow-sm space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                      Ringkasan AI Bab Cerita
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Rangkuman otomatis dari naskah bab untuk review dan konsistensi cerita
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGenerateSummary}
                  disabled={isGeneratingSummary}
                  className="py-2 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-xs shadow-md shadow-indigo-500/20 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isGeneratingSummary ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Meringkas...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>{chapter.aiSummary ? 'Perbarui Ringkasan ✨' : 'Generate Ringkasan AI ✨'}</span>
                    </>
                  )}
                </button>
              </div>

              {chapter.aiSummary ? (
                <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-slate-950/60 border border-indigo-200/80 dark:border-indigo-500/20 text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed space-y-2">
                  <p className="whitespace-pre-line">{chapter.aiSummary}</p>
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(chapter.aiSummary || '', 'summary')}
                      className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                    >
                      {copyFeedback === 'summary' ? '✓ Tersalin' : 'Salin Ringkasan'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 px-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-950/20 text-xs text-slate-500 dark:text-slate-400">
                  Belum ada ringkasan AI untuk bab ini. Ketuk tombol di atas untuk merangkum otomatis isi bab.
                </div>
              )}
            </div>

            {/* 📈 2. AUTO PLOT BY AI (Hook, Rising Action, Climax, Resolution) */}
            <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-6 shadow-sm space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                      Auto Plot by AI
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Pemetaan dinamika 4 struktur plot bab: Hook, Eskalasi, Klimaks, &amp; Penutup
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGeneratePlot}
                  disabled={isGeneratingPlot}
                  className="py-2 px-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-95 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isGeneratingPlot ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Memetakan Plot...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{chapter.aiPlot ? 'Petakan Ulang Plot ✨' : 'Petakan Struktur Plot ✨'}</span>
                    </>
                  )}
                </button>
              </div>

              {chapter.aiPlot ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Hook */}
                  <div className="p-3.5 rounded-2xl bg-cyan-50/70 dark:bg-cyan-950/20 border border-cyan-200/80 dark:border-cyan-500/30 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-black uppercase text-cyan-800 dark:text-cyan-400">
                      <span className="w-2 h-2 rounded-full bg-cyan-500" />
                      <span>1. Hook (Pemicu)</span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                      {chapter.aiPlot.hook || 'Belum terdeteksi'}
                    </p>
                  </div>

                  {/* Rising Action */}
                  <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-200/80 dark:border-indigo-500/30 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-black uppercase text-indigo-800 dark:text-indigo-400">
                      <span className="w-2 h-2 rounded-full bg-indigo-500" />
                      <span>2. Rising Action (Eskalasi)</span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                      {chapter.aiPlot.risingAction || 'Belum terdeteksi'}
                    </p>
                  </div>

                  {/* Climax */}
                  <div className="p-3.5 rounded-2xl bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-500/30 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-black uppercase text-rose-800 dark:text-rose-400">
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                      <span>3. Climax (Puncak Konflik)</span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                      {chapter.aiPlot.climax || 'Belum terdeteksi'}
                    </p>
                  </div>

                  {/* Resolution */}
                  <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-500/30 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-black uppercase text-emerald-800 dark:text-emerald-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>4. Resolution (Penutup / Cliffhanger)</span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                      {chapter.aiPlot.resolution || 'Belum terdeteksi'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 px-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-950/20 text-xs text-slate-500 dark:text-slate-400">
                  Belum ada analisis plot. Ketuk tombol di atas agar AI menganalisis titik-titik ketegangan bab cerita.
                </div>
              )}
            </div>

            {/* 🎬 3. AUTO SCENE BY AI (Scene Breakdown) */}
            <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-6 shadow-sm space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                    <Film className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                      Auto Scene by AI (Pembagian Adegan)
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Breakdown naskah menjadi urutan adegan sinematik lengkap dengan latar &amp; tokoh
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGenerateScenes}
                  disabled={isGeneratingScenes}
                  className="py-2 px-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-bold text-xs shadow-md shadow-purple-500/20 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isGeneratingScenes ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Membedah Adegan...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>
                        {chapter.aiScenes && chapter.aiScenes.length > 0
                          ? 'Bedah Ulang Adegan ✨'
                          : 'Bedah Pembagian Adegan ✨'}
                      </span>
                    </>
                  )}
                </button>
              </div>

              {chapter.aiScenes && chapter.aiScenes.length > 0 ? (
                <div className="space-y-3 pt-1">
                  {chapter.aiScenes.map((scene, idx) => (
                    <div
                      key={scene.id || idx}
                      className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 space-y-2 hover:border-purple-300 dark:hover:border-purple-500/40 transition"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-lg bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 text-[10px] font-black uppercase">
                            Adegan {scene.sceneNumber || idx + 1}
                          </span>
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                            {scene.title}
                          </h4>
                        </div>

                        {scene.setting && (
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-800">
                            📍 {scene.setting}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                        {scene.summary}
                      </p>

                      {scene.characters && scene.characters.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[11px] text-slate-500 dark:text-slate-400">
                          <span>Tokoh:</span>
                          {scene.characters.map((char, cIdx) => (
                            <span
                              key={cIdx}
                              className="px-2 py-0.2 rounded-full bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium"
                            >
                              {char}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 px-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-950/20 text-xs text-slate-500 dark:text-slate-400">
                  Belum ada pembagian adegan. Ketuk tombol di atas agar AI menguraikan naskah bab menjadi adegan-adegan sinematik.
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
