import React, { useState } from 'react';
import { Book, StoryChapter } from '../../types';
import { AISparkModal } from '../books/AISparkModal';
import { BookCard } from '../books/BookCard';
import {
  Plus,
  BookOpen,
  Sparkles,
  ArrowRight,
  Flame,
  FileText,
  Lightbulb,
  Zap,
  BookCopy,
  TrendingUp,
  Clock,
  Compass
} from 'lucide-react';
import { navStack } from '../../services/backNavigationService';

interface DashboardViewProps {
  books: Book[];
  allChapters?: StoryChapter[];
  recentChapter?: StoryChapter | null;
  recentBook?: Book | null;
  chapterCounts: Record<string, number>;
  onSelectBook: (book: Book) => void;
  onResumeChapter?: (book: Book, chapter: StoryChapter) => void;
  onOpenCreateModal: () => void;
  onOpenStoryArchitect?: () => void;
  onOpenAISettings?: () => void;
  onNavigateToWorks: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  books,
  allChapters = [],
  recentChapter,
  recentBook,
  chapterCounts,
  onSelectBook,
  onResumeChapter,
  onOpenCreateModal,
  onOpenStoryArchitect,
  onOpenAISettings,
  onNavigateToWorks,
}) => {
  const [isSparkModalOpen, setIsSparkModalOpen] = useState(false);

  const handleOpenSparkModal = () => {
    navStack.push('modal-spark', () => setIsSparkModalOpen(false));
    setIsSparkModalOpen(true);
  };

  const handleCloseSparkModal = () => {
    navStack.pop('modal-spark');
    setIsSparkModalOpen(false);
  };

  const totalWords = allChapters.reduce((acc, c) => acc + (c.wordCount || 0), 0);
  const publishedBooks = books.filter((b) => b.status === 'released');
  const draftBooks = books.filter((b) => b.status === 'draft');

  // Time formatter for recent chapter
  const formatTimeAgo = (timestamp?: number) => {
    if (!timestamp) return 'Baru saja';
    const diffMs = Date.now() - timestamp;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) return 'Baru saja';
    if (diffMins < 60) return `${diffMins} menit lalu`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} jam lalu`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} hari lalu`;
  };

  // Recent 2 books
  const recentBooks = [...books]
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, 2);

  return (
    <div className="space-y-4 pb-24">
      {/* 🌟 1. Hero Quick Resume Card ("Lanjutkan Menulis") */}
      {recentChapter && recentBook && onResumeChapter && (
        <div
          onClick={() => onResumeChapter(recentBook, recentChapter)}
          className="group relative bg-gradient-to-r from-amber-50/80 via-white to-indigo-50/80 dark:from-amber-500/10 dark:via-slate-900 dark:to-indigo-500/10 border border-amber-200/80 dark:border-amber-500/30 hover:border-amber-400/80 dark:hover:border-amber-400 rounded-3xl p-4 sm:p-5 shadow-sm hover:shadow-md dark:shadow-lg dark:shadow-black/30 cursor-pointer transition-all duration-300 hover:translate-y-[-2px] active:scale-[0.99] animate-fade-in-up"
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/40">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400 animate-ping" />
                Lanjutkan Menulis
              </span>
              <span className="text-[11px] text-slate-600 dark:text-slate-400 truncate max-w-[150px] sm:max-w-xs font-semibold">
                {recentBook.title}
              </span>
            </div>

            <span className="text-[10px] text-slate-500 dark:text-slate-500 flex-shrink-0">
              {formatTimeAgo(recentChapter.updatedAt)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors truncate">
                Bab {recentChapter.order || 1}: {recentChapter.title || 'Bab Tanpa Judul'}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 truncate mt-0.5">
                {(recentChapter.wordCount || 0).toLocaleString()} kata • Target{' '}
                {recentChapter.targetWordCount || 1500} kata
              </p>
            </div>

            <button
              type="button"
              className="py-2 px-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 transition flex items-center gap-1.5 flex-shrink-0 group-hover:translate-x-0.5 active:scale-95"
            >
              <span>Tulis</span>
              <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          </div>

          {/* Micro Progress Bar */}
          <div className="w-full bg-slate-200/80 dark:bg-slate-800/80 rounded-full h-1.5 mt-3 overflow-hidden border border-slate-300/60 dark:border-slate-700/60">
            <div
              className="bg-gradient-to-r from-amber-500 to-amber-400 h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.min(
                  100,
                  Math.round(
                    ((recentChapter.wordCount || 0) /
                      (recentChapter.targetWordCount || 1500)) *
                      100
                  )
                )}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* 🚀 AI Story Architect Card */}
      {onOpenStoryArchitect && (
        <div className="animate-fade-in-up bg-gradient-to-r from-indigo-50/90 via-purple-50/60 to-white dark:from-indigo-950/70 dark:via-slate-900 dark:to-amber-950/40 border border-indigo-200/80 dark:border-indigo-500/40 hover:border-indigo-400/80 dark:hover:border-indigo-400 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 shadow-sm hover:shadow-md dark:shadow-lg transition-all duration-300 hover:translate-y-[-2px]">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center text-white font-black shadow-md shadow-indigo-500/20 flex-shrink-0">
              <Sparkles className="w-5 h-5 text-amber-200" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">AI Story Architect</h3>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30">
                  Planning
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-snug">
                Punya 1 kalimat ide? AI langsung merancang sinopsis, profil tokoh, lokasi, dan bab awal siap tulis!
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenStoryArchitect}
            className="py-2.5 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold text-xs shadow-md shadow-indigo-500/20 active:scale-95 transition flex items-center justify-center gap-2 flex-shrink-0"
          >
            <span>Rancang Proyek dari Ide ✨</span>
          </button>
        </div>
      )}

      {/* 💡 2. AI Quick Spark Pad (Inkubator Ide Cepat) */}
      <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-sm">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex-shrink-0">
            <Lightbulb className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
              <span>Inkubator Ide Cerita</span>
              <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 font-extrabold">
                AI Spark
              </span>
            </h4>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
              Pancing plot twist, konsep karakter, atau pembuka adegan baru
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenSparkModal}
          className="inline-flex items-center justify-center gap-1.5 py-2 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-amber-700 dark:text-amber-300 font-bold text-xs border border-slate-200 dark:border-slate-700 active:scale-95 transition flex-shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Brainstorm Ide</span>
        </button>
      </div>

      {/* 📊 3. Studio Momentum Micro-Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-2.5 text-center shadow-sm">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold block">Total Karya</span>
          <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white">{books.length} Buku</span>
        </div>
        <div className="bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-2.5 text-center shadow-sm">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold block">Total Bab</span>
          <span className="text-sm sm:text-base font-black text-amber-600 dark:text-amber-400">{allChapters.length} Bab</span>
        </div>
        <div className="bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-2.5 text-center shadow-sm">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold block">Kata Tertulis</span>
          <span className="text-sm sm:text-base font-black text-indigo-600 dark:text-indigo-300">
            {totalWords > 1000 ? `${(totalWords / 1000).toFixed(1)}k` : totalWords}
          </span>
        </div>
      </div>

      {/* 📚 4. Sekilas Karya Terkini (Recent Works Quick Access) */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
              Karya Terkini
            </h3>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              ({publishedBooks.length} Published, {draftBooks.length} Draft)
            </span>
          </div>

          <button
            type="button"
            onClick={onNavigateToWorks}
            className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 flex items-center gap-1 transition"
          >
            <span>Semua di Works</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentBooks.length === 0 ? (
          <div className="text-center py-10 px-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-white/60 dark:bg-slate-900/30">
            <BookOpen className="w-10 h-10 mx-auto text-slate-400 dark:text-slate-600 mb-2" />
            <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Belum Ada Karya</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto mb-3">
              Mulai buat buku pertama Anda dan eksplorasi worldbuilding.
            </p>
            <button
              onClick={onOpenCreateModal}
              className="inline-flex items-center gap-1.5 py-2 px-4 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold rounded-xl text-xs shadow-md shadow-amber-500/20 active:scale-95 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Buat Buku Pertama</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3.5">
            {recentBooks.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                onSelect={onSelectBook}
                chapterCount={chapterCounts[book.id] || 0}
              />
            ))}
          </div>
        )}
      </div>

      {/* AI Quick Spark Modal */}
      <AISparkModal
        isOpen={isSparkModalOpen}
        onClose={handleCloseSparkModal}
        books={books}
      />
    </div>
  );
};
