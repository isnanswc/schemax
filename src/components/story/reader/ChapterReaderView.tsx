import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Sliders,
  Volume2,
  Edit3,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  List,
  Check,
  Sparkles,
  Bookmark
} from 'lucide-react';
import { StoryChapter, Book, ChapterEmotionScript } from '../../../types';
import { db } from '../../../db';
import {
  ReaderSettings,
  DEFAULT_READER_SETTINGS,
  ReaderSettingsModal,
  ReaderTheme
} from './ReaderSettingsModal';
import { ReaderTTSPlayer } from './ReaderTTSPlayer';
import { getTensionColor } from '../../../utils/tensionUtils';
import {
  analyzeChapterDramaScriptWithAI,
  getEmotionAcoustics
} from '../../../services/dramaDirectorService';

interface ChapterReaderViewProps {
  chapter: StoryChapter;
  bookTitle: string;
  allChapters: StoryChapter[];
  onBack: () => void;
  onOpenEditor: (chapter: StoryChapter) => void;
  onSwitchChapter: (chapter: StoryChapter) => void;
}

const STORAGE_SETTINGS_KEY = 'schemax_reader_settings_v1';

export const ChapterReaderView: React.FC<ChapterReaderViewProps> = ({
  chapter,
  bookTitle,
  allChapters,
  onBack,
  onOpenEditor,
  onSwitchChapter,
}) => {
  const [localChapter, setLocalChapter] = useState<StoryChapter>(chapter);
  const [isTaggingEmotion, setIsTaggingEmotion] = useState(false);

  useEffect(() => {
    setLocalChapter(chapter);
  }, [chapter]);

  // Load saved reader settings or use defaults
  const [settings, setSettings] = useState<ReaderSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_SETTINGS_KEY);
      if (saved) return { ...DEFAULT_READER_SETTINGS, ...JSON.parse(saved) };
    } catch {}
    return DEFAULT_READER_SETTINGS;
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isChapterListOpen, setIsChapterListOpen] = useState(false);
  const [isTTSActive, setIsTTSActive] = useState(false);
  const [activeTTSParagraph, setActiveTTSParagraph] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const lastScrollTopRef = useRef(0);

  // Save settings on update
  const handleUpdateSettings = (newSettings: Partial<ReaderSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Sort chapters by order for prev/next navigation
  const sortedChapters = [...allChapters].sort((a, b) => (a.order || 0) - (b.order || 0));
  const currentIndex = sortedChapters.findIndex((c) => c.id === chapter.id);
  const prevChapter = currentIndex > 0 ? sortedChapters[currentIndex - 1] : null;
  const nextChapter = currentIndex < sortedChapters.length - 1 ? sortedChapters[currentIndex + 1] : null;

  // Parse HTML into text paragraphs for reading & TTS
  const extractParagraphs = (html: string): string[] => {
    if (!html) return [];
    const div = document.createElement('div');
    div.innerHTML = html;

    const results: string[] = [];
    const pElements = div.querySelectorAll('p, div, blockquote');

    if (pElements.length > 0) {
      pElements.forEach((el) => {
        // Skip images or metadata figures
        if (el.tagName === 'FIGURE' || el.classList.contains('story-image-block')) return;
        const txt = el.textContent?.trim();
        if (txt) results.push(txt);
      });
    }

    if (results.length === 0) {
      const raw = div.textContent?.trim() || '';
      if (raw) {
        results.push(...raw.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean));
      }
    }

    return results;
  };

  const paragraphs = extractParagraphs(localChapter.contentHtml || '');

  // AI Drama Director Emotion Script analysis handler
  const handleRunEmotionTagging = async () => {
    if (paragraphs.length === 0 || isTaggingEmotion) return;
    setIsTaggingEmotion(true);
    try {
      const tags = await analyzeChapterDramaScriptWithAI(paragraphs, localChapter.title);
      const script: ChapterEmotionScript = {
        tags,
        lastTaggedAt: Date.now(),
      };
      const updated: StoryChapter = {
        ...localChapter,
        emotionScript: script,
      };
      setLocalChapter(updated);
      await db.chapters.update(localChapter.id, {
        emotionScript: script,
        updatedAt: Date.now(),
      });
    } catch (err) {
      console.error('Gagal analisis emosi suara sutradara AI:', err);
    } finally {
      setIsTaggingEmotion(false);
    }
  };

  // Track scroll progress and auto-hide header on scroll down
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const totalHeight = el.scrollHeight - el.clientHeight;
    if (totalHeight > 0) {
      const progress = Math.min(100, Math.round((el.scrollTop / totalHeight) * 100));
      setScrollProgress(progress);
    }

    const currentScroll = el.scrollTop;
    if (currentScroll > lastScrollTopRef.current && currentScroll > 80) {
      // Scrolling down -> hide header
      setIsHeaderVisible(false);
    } else {
      // Scrolling up -> show header
      setIsHeaderVisible(true);
    }
    lastScrollTopRef.current = currentScroll;
  };

  // Scroll active TTS paragraph into view
  useEffect(() => {
    if (!isTTSActive) return;
    const el = document.getElementById(`reader-p-${activeTTSParagraph}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeTTSParagraph, isTTSActive]);

  // Theme style mapping
  const themeClasses: Record<ReaderTheme, { bg: string; text: string; headerBg: string; border: string; accent: string }> = {
    light: {
      bg: 'bg-white',
      text: 'text-slate-800',
      headerBg: 'bg-white/95 border-slate-200',
      border: 'border-slate-200',
      accent: 'text-amber-600',
    },
    sepia: {
      bg: 'bg-[#fbf0d9]',
      text: 'text-[#433422]',
      headerBg: 'bg-[#f7ede2]/95 border-[#dfcca5]',
      border: 'border-[#dfcca5]',
      accent: 'text-[#8c501e]',
    },
    dark: {
      bg: 'bg-slate-900',
      text: 'text-slate-200',
      headerBg: 'bg-slate-900/95 border-slate-800',
      border: 'border-slate-800',
      accent: 'text-amber-400',
    },
    black: {
      bg: 'bg-black',
      text: 'text-slate-300',
      headerBg: 'bg-black/95 border-slate-900',
      border: 'border-slate-900',
      accent: 'text-amber-400',
    },
  };

  const currentTheme = themeClasses[settings.theme] || themeClasses.sepia;

  const fontClass =
    settings.fontFamily === 'serif'
      ? 'font-serif'
      : settings.fontFamily === 'mono'
      ? 'font-mono'
      : 'font-sans';

  const lineHeightClass =
    settings.lineHeight === 'tight'
      ? 'leading-normal'
      : settings.lineHeight === 'normal'
      ? 'leading-relaxed'
      : settings.lineHeight === 'loose'
      ? 'leading-loose'
      : 'leading-[1.9]';

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col ${currentTheme.bg} ${currentTheme.text} transition-colors duration-200 select-text overflow-hidden`}
    >
      {/* 1. Slim Reading Progress Bar at Top */}
      <div className="fixed top-0 inset-x-0 h-1 z-50 bg-black/10 dark:bg-white/10">
        <div
          className="h-full bg-amber-500 transition-all duration-150"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      {/* 2. Floating Minimal Reader Header */}
      <header
        className={`fixed top-1 inset-x-0 z-40 transition-transform duration-300 backdrop-blur-md border-b ${
          currentTheme.headerBg
        } ${isHeaderVisible ? 'translate-y-0' : '-translate-y-full'}`}
      >
        <div className="max-w-4xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-2">
          {/* Left: Back & Title info */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition flex-shrink-0"
              title="Kembali ke Daftar Bab"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => setIsChapterListOpen(true)}
              className="min-w-0 text-left hover:opacity-80 transition group flex items-center gap-1.5"
              title="Pilih Bab Lain"
            >
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 block truncate">
                  {bookTitle} • Bab {chapter.order || currentIndex + 1}
                </span>
                <h1 className="text-xs sm:text-sm font-black truncate max-w-[180px] sm:max-w-xs group-hover:underline">
                  {chapter.title || 'Bab Tanpa Judul'}
                </h1>
              </div>
              <List className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 ml-0.5" />
            </button>
          </div>

          {/* Right Action Icons: TTS, Settings, & Edit */}
          <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
            {/* Audio TTS Button */}
            <button
              type="button"
              onClick={() => setIsTTSActive(!isTTSActive)}
              className={`p-2 rounded-xl transition active:scale-95 flex items-center gap-1 text-xs font-bold ${
                isTTSActive
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'hover:bg-black/5 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300'
              }`}
              title="Putar Suara Narator Alami (TTS Emotif)"
            >
              <Volume2 className="w-4 h-4" />
              <span className="hidden sm:inline">Dengarkan</span>
            </button>

            {/* Reader Settings Modal Trigger */}
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition text-slate-600 dark:text-slate-300"
              title="Pengaturan Tampilan Font & Warna"
            >
              <Sliders className="w-4 h-4" />
            </button>

            {/* Switch to Editor Button */}
            <button
              type="button"
              onClick={() => onOpenEditor(chapter)}
              className="py-1.5 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-bold text-xs flex items-center gap-1.5 active:scale-95 transition"
              title="Beralih ke Mode Editor Penulisan"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Edit Bab</span>
            </button>
          </div>
        </div>
      </header>

      {/* 3. Main Reading Body Canvas */}
      <main
        ref={containerRef}
        onScroll={handleScroll}
        onClick={() => setIsHeaderVisible((prev) => !prev)}
        className="flex-1 overflow-y-auto px-4 sm:px-6 pt-20 pb-36"
      >
        <article
          className={`max-w-2xl mx-auto ${fontClass} ${lineHeightClass} transition-all duration-150`}
          style={{
            fontSize: `${settings.fontSize}px`,
            textAlign: settings.textAlign,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Chapter Header Banner */}
          <div className="text-center pt-4 pb-8 border-b border-black/10 dark:border-white/10 mb-8 space-y-2">
            <span className="text-xs sm:text-sm font-bold tracking-widest uppercase text-amber-600 dark:text-amber-400">
              Bab {chapter.order || currentIndex + 1}
            </span>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight">
              {chapter.title || 'Bab Tanpa Judul'}
            </h1>
            <div className="flex items-center justify-center gap-3 text-xs opacity-60 pt-1">
              <span>{(chapter.wordCount || 0).toLocaleString()} kata</span>
              <span>•</span>
              <span>~{Math.max(1, Math.round((chapter.wordCount || 0) / 200))} menit baca</span>
            </div>
          </div>

          {/* Paragraphs List */}
          {paragraphs.length > 0 ? (
            <div className="space-y-6">
              {paragraphs.map((para, idx) => {
                const isTTSCurrent = isTTSActive && activeTTSParagraph === idx;
                const tensionItem = localChapter.tensionData?.items?.find(
                  (it) => it.paragraphIndex === idx
                );
                const tensionColor =
                  settings.showTensionColors && tensionItem
                    ? getTensionColor(tensionItem.tensionScore)
                    : null;

                const emotionTag = localChapter.emotionScript?.tags?.find(
                  (t) => t.paragraphIndex === idx
                );
                const emotionAcoustics = emotionTag
                  ? getEmotionAcoustics(emotionTag.emotion, emotionTag.intensity)
                  : null;

                return (
                  <div key={idx} className="group/para space-y-1">
                    {/* Optional Drama & Emotion Actor Cue Badge */}
                    {settings.showEmotionCues && emotionTag && emotionAcoustics && (
                      <div className="flex items-center gap-1.5 opacity-70 group-hover/para:opacity-100 transition-opacity">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${emotionAcoustics.color}`}
                          title={`[Petunjuk Akting]: ${emotionTag.actingNotes}`}
                        >
                          <span>{emotionAcoustics.icon}</span>
                          <span>{emotionTag.speaker}</span>
                          <span className="opacity-40">•</span>
                          <span className="font-normal">{emotionTag.emotionLabel}</span>
                        </span>
                      </div>
                    )}

                    <p
                      id={`reader-p-${idx}`}
                      onClick={() => {
                        if (isTTSActive) {
                          setActiveTTSParagraph(idx);
                        }
                      }}
                      className={`transition-all duration-200 cursor-pointer ${
                        isTTSCurrent
                          ? 'p-3 rounded-2xl bg-amber-500/10 ring-2 ring-amber-500/40 shadow-sm font-medium'
                          : 'hover:opacity-90'
                      }`}
                      style={{
                        borderLeft: tensionColor ? `4px solid ${tensionColor.hex}` : undefined,
                        paddingLeft: tensionColor ? '12px' : undefined,
                      }}
                      title={
                        emotionTag
                          ? `[${emotionTag.speaker}] ${emotionTag.actingNotes}`
                          : tensionItem
                          ? `Intensitas: ${tensionItem.tensionScore}% (${tensionItem.label || 'Adegan'})`
                          : undefined
                      }
                    >
                      {para}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16 opacity-60 space-y-3">
              <BookOpen className="w-12 h-12 mx-auto stroke-1" />
              <p className="text-base font-medium">Naskah bab ini masih kosong.</p>
              <button
                type="button"
                onClick={() => onOpenEditor(chapter)}
                className="py-2 px-4 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs"
              >
                Mulai Tulis Sekarang ✍️
              </button>
            </div>
          )}

          {/* Bottom Chapter Switcher Navigation */}
          {paragraphs.length > 0 && (
            <div className="mt-14 pt-8 border-t border-black/10 dark:border-white/10 space-y-4">
              <div className="flex items-center justify-between gap-3">
                {prevChapter ? (
                  <button
                    type="button"
                    onClick={() => onSwitchChapter(prevChapter)}
                    className="flex-1 py-3 px-4 rounded-2xl border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-left transition active:scale-98 min-w-0"
                  >
                    <span className="text-[10px] opacity-60 block flex items-center gap-1">
                      <ChevronLeft className="w-3 h-3" />
                      Bab Sebelumnya
                    </span>
                    <span className="font-bold text-xs sm:text-sm truncate block mt-0.5">
                      Bab {prevChapter.order}: {prevChapter.title}
                    </span>
                  </button>
                ) : (
                  <div className="flex-1" />
                )}

                {nextChapter ? (
                  <button
                    type="button"
                    onClick={() => onSwitchChapter(nextChapter)}
                    className="flex-1 py-3 px-4 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-right transition active:scale-98 shadow-md min-w-0"
                  >
                    <span className="text-[10px] font-bold opacity-80 block flex items-center justify-end gap-1">
                      Bab Selanjutnya
                      <ChevronRight className="w-3 h-3" />
                    </span>
                    <span className="font-black text-xs sm:text-sm truncate block mt-0.5">
                      Bab {nextChapter.order}: {nextChapter.title}
                    </span>
                  </button>
                ) : (
                  <div className="flex-1 text-right py-3 px-4 text-xs opacity-60 font-semibold">
                    🎉 Ini adalah bab terakhir saat ini!
                  </div>
                )}
              </div>
            </div>
          )}
        </article>
      </main>

      {/* 4. Text-To-Speech (TTS) Natural Emotive Player (When Active) */}
      {isTTSActive && paragraphs.length > 0 && (
        <ReaderTTSPlayer
          paragraphs={paragraphs}
          tensionItems={localChapter.tensionData?.items}
          emotionTags={localChapter.emotionScript?.tags}
          onRunEmotionTagging={handleRunEmotionTagging}
          isTaggingEmotion={isTaggingEmotion}
          activeParagraphIndex={activeTTSParagraph}
          onParagraphChange={(idx) => setActiveTTSParagraph(idx)}
          onClose={() => setIsTTSActive(false)}
        />
      )}

      {/* 5. Reader Settings Modal */}
      <ReaderSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
      />

      {/* 6. Quick Chapter Switcher Drawer */}
      {isChapterListOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl max-w-md w-full max-h-[80vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200 safe-bottom">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Daftar Bab Novel ({sortedChapters.length})
              </h3>
              <button
                type="button"
                onClick={() => setIsChapterListOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>
            <div className="p-3 overflow-y-auto space-y-1">
              {sortedChapters.map((ch) => {
                const isSelected = ch.id === chapter.id;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => {
                      setIsChapterListOpen(false);
                      onSwitchChapter(ch);
                    }}
                    className={`w-full p-3 rounded-2xl text-left transition flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="min-w-0">
                      <span className="text-[10px] block opacity-70">
                        Bab {ch.order}
                      </span>
                      <span className="text-xs sm:text-sm font-bold truncate block">
                        {ch.title || 'Tanpa Judul'}
                      </span>
                    </div>
                    {isSelected && <Check className="w-4 h-4 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
