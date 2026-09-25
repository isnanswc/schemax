import React, { useState } from 'react';
import { Book, BookStatus, StoryChapter } from '../../types';
import { BookCard } from './BookCard';
import { AISparkModal } from './AISparkModal';
import {
  Plus,
  BookOpen,
  Search,
  Sparkles,
  Layers,
  CheckCircle2,
  Clock,
  Filter,
  ArrowRight,
  Flame,
  FileText,
  Lightbulb,
  Zap
} from 'lucide-react';
import { navStack } from '../../services/backNavigationService';

interface BookListDashboardProps {
  books: Book[];
  allChapters?: StoryChapter[];
  recentChapter?: StoryChapter | null;
  recentBook?: Book | null;
  chapterCounts: Record<string, number>;
  onSelectBook: (book: Book) => void;
  onResumeChapter?: (book: Book, chapter: StoryChapter) => void;
  onOpenCreateModal: (defaultStatus?: BookStatus) => void;
  onOpenStoryArchitect?: () => void;
  onOpenAISettings?: () => void;
}

export const BookListDashboard: React.FC<BookListDashboardProps> = ({
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
}) => {
  const [activeCategory, setActiveCategory] = useState<'all' | BookStatus>('draft');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSparkModalOpen, setIsSparkModalOpen] = useState(false);

  const handleOpenSparkModal = () => {
    navStack.push('modal-spark', () => setIsSparkModalOpen(false));
    setIsSparkModalOpen(true);
  };

  const handleCloseSparkModal = () => {
    navStack.pop('modal-spark');
    setIsSparkModalOpen(false);
  };

  const draftBooks = books.filter((b) => b.status === 'draft');
  const releasedBooks = books.filter((b) => b.status === 'released');

  const filteredBooks = books.filter((book) => {
    const matchesCategory =
      activeCategory === 'all' ? true : book.status === activeCategory;
    const matchesQuery =
      searchQuery.trim() === '' ||
      book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (book.synopsis && book.synopsis.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (book.genre && book.genre.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesCategory && matchesQuery;
  });

  const totalWords = allChapters.reduce((acc, c) => acc + (c.wordCount || 0), 0);

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

  return (
    <div className="space-y-4 pb-28">
      {/* 🌟 1. Hero Quick Resume Card ("Lanjutkan Menulis") */}
      {recentChapter && recentBook && onResumeChapter && (
        <div
          onClick={() => onResumeChapter(recentBook, recentChapter)}
          className="group relative bg-gradient-to-r from-amber-500/10 via-slate-900 to-indigo-500/10 border border-amber-500/30 hover:border-amber-400 rounded-3xl p-4 sm:p-5 shadow-lg shadow-black/40 cursor-pointer transition-all active:scale-[0.99]"
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                Lanjutkan Menulis
              </span>
              <span className="text-[11px] text-slate-400 truncate max-w-[150px] sm:max-w-xs">
                {recentBook.title}
              </span>
            </div>

            <span className="text-[10px] text-slate-500 flex-shrink-0">
              {formatTimeAgo(recentChapter.updatedAt)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-base sm:text-lg font-black text-white group-hover:text-amber-300 transition-colors truncate">
                Bab {recentChapter.order || 1}: {recentChapter.title || 'Bab Tanpa Judul'}
              </h3>
              <p className="text-xs text-slate-400 truncate mt-0.5">
                {(recentChapter.wordCount || 0).toLocaleString()} kata • Target{' '}
                {recentChapter.targetWordCount || 1500} kata
              </p>
            </div>

            <button
              type="button"
              className="py-2 px-3.5 rounded-2xl bg-amber-500 group-hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 transition flex items-center gap-1.5 flex-shrink-0 group-hover:translate-x-0.5"
            >
              <span>Tulis</span>
              <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          </div>

          {/* Micro Progress Bar */}
          <div className="w-full bg-slate-950/80 rounded-full h-1.5 mt-3 overflow-hidden border border-slate-800">
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

      {/* 🚀 AI Story Architect Card (From 1 Idea to Full Project) */}
      {onOpenStoryArchitect && (
        <div className="bg-gradient-to-r from-indigo-950/70 via-slate-900 to-amber-950/40 border border-indigo-500/30 hover:border-indigo-400/50 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 shadow-md">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center text-white font-black shadow-md shadow-indigo-500/20 flex-shrink-0">
              <Sparkles className="w-5 h-5 text-amber-200" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <h3 className="font-extrabold text-sm sm:text-base text-white">AI Story Architect</h3>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Planning
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-snug">
                Punya 1 kalimat ide? AI langsung merancang sinopsis, profil tokoh, lokasi, dan bab awal siap tulis!
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenStoryArchitect}
            className="py-2.5 px-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-extrabold text-xs shadow-lg shadow-indigo-500/20 active:scale-95 transition flex items-center justify-center gap-2 flex-shrink-0"
          >
            <span>Rancang Proyek dari Ide ✨</span>
          </button>
        </div>
      )}

      {/* 💡 2. AI Quick Spark Pad (Inkubator Ide Cepat) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-sm">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 flex-shrink-0">
            <Lightbulb className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5 truncate">
              <span>Inkubator Ide Cerita</span>
              <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-extrabold">
                AI Spark
              </span>
            </h4>
            <p className="text-[10px] text-slate-400 truncate">
              Pancing plot twist, konsep karakter, atau pembuka adegan baru
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenSparkModal}
          className="inline-flex items-center justify-center gap-1.5 py-2 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs border border-slate-700 active:scale-95 transition flex-shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Brainstorm Ide</span>
        </button>
      </div>

      {/* 📊 3. Studio Momentum Micro-Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-2.5 text-center">
          <span className="text-[10px] text-slate-500 font-semibold block">Total Karya</span>
          <span className="text-sm sm:text-base font-black text-white">{books.length} Buku</span>
        </div>
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-2.5 text-center">
          <span className="text-[10px] text-slate-500 font-semibold block">Total Bab</span>
          <span className="text-sm sm:text-base font-black text-amber-400">{allChapters.length} Bab</span>
        </div>
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-2.5 text-center">
          <span className="text-[10px] text-slate-500 font-semibold block">Kata Tertulis</span>
          <span className="text-sm sm:text-base font-black text-indigo-300">
            {totalWords > 1000 ? `${(totalWords / 1000).toFixed(1)}k` : totalWords}
          </span>
        </div>
      </div>

      {/* 📚 4. Category Segmented Control (Draft / Released / All) */}
      <div className="bg-slate-900/90 border border-slate-800/80 p-1 rounded-2xl shadow-sm">
        <div className="grid grid-cols-3 gap-1">
          {/* Draft Tab */}
          <button
            onClick={() => setActiveCategory('draft')}
            className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold transition-all ${
              activeCategory === 'draft'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Draft</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeCategory === 'draft'
                  ? 'bg-slate-950 text-amber-400'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {draftBooks.length}
            </span>
          </button>

          {/* Released Tab */}
          <button
            onClick={() => setActiveCategory('released')}
            className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold transition-all ${
              activeCategory === 'released'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Released</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeCategory === 'released'
                  ? 'bg-slate-950 text-emerald-400'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {releasedBooks.length}
            </span>
          </button>

          {/* All Tab */}
          <button
            onClick={() => setActiveCategory('all')}
            className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold transition-all ${
              activeCategory === 'all'
                ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Semua</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeCategory === 'all'
                  ? 'bg-slate-950 text-indigo-300'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {books.length}
            </span>
          </button>
        </div>
      </div>

      {/* Search & New Book Action Bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari judul cerita, genre, atau sinopsis..."
            className="w-full pl-9 pr-3 py-2 bg-slate-900/80 border border-slate-800 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60"
          />
        </div>

        <button
          onClick={() => onOpenCreateModal(activeCategory === 'released' ? 'released' : 'draft')}
          className="inline-flex items-center gap-1.5 py-2 px-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-95 text-slate-950 font-bold rounded-xl text-xs shadow-md shadow-amber-500/20 transition flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Buku Baru</span>
          <span className="sm:hidden">Baru</span>
        </button>
      </div>

      {/* Books List / Grid */}
      {filteredBooks.length === 0 ? (
        <div className="text-center py-12 px-4 border border-dashed border-slate-800 rounded-3xl bg-slate-900/30">
          <BookOpen className="w-10 h-10 mx-auto text-slate-600 mb-2" />
          <h3 className="text-sm font-bold text-white mb-1">
            {searchQuery
              ? 'Tidak Ada Cerita yang Cocok'
              : activeCategory === 'draft'
              ? 'Belum Ada Cerita Draft'
              : 'Belum Ada Cerita'}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
            Mulai rancang naskah baru, karakter, dan bab di IndexedDB lokal.
          </p>
          <button
            onClick={() => onOpenCreateModal(activeCategory === 'released' ? 'released' : 'draft')}
            className="inline-flex items-center gap-1.5 py-2 px-4 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold rounded-xl text-xs shadow-lg shadow-amber-500/20 active:scale-95 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Buku Baru</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3.5">
          {filteredBooks.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              onSelect={onSelectBook}
              chapterCount={chapterCounts[book.id] || 0}
            />
          ))}
        </div>
      )}

      {/* AI Quick Spark Modal */}
      <AISparkModal
        isOpen={isSparkModalOpen}
        onClose={handleCloseSparkModal}
        books={books}
      />
    </div>
  );
};
