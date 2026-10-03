import React, { useState } from 'react';
import { Book, BookStatus } from '../../types';
import { BookCard } from '../books/BookCard';
import {
  Plus,
  BookOpen,
  Search,
  CheckCircle2,
  Clock,
  Layers,
  Filter,
  Sparkles,
  Upload
} from 'lucide-react';

interface WorksViewProps {
  books: Book[];
  chapterCounts: Record<string, number>;
  onSelectBook: (book: Book) => void;
  onOpenCreateModal: (defaultStatus?: BookStatus) => void;
  onOpenStoryArchitect?: () => void;
  onReadBook?: (book: Book) => void;
  onOpenRestoreModal?: () => void;
}

export const WorksView: React.FC<WorksViewProps> = ({
  books,
  chapterCounts,
  onSelectBook,
  onOpenCreateModal,
  onOpenStoryArchitect,
  onReadBook,
  onOpenRestoreModal,
}) => {
  const [activeCategory, setActiveCategory] = useState<'all' | BookStatus>('released');
  const [searchQuery, setSearchQuery] = useState('');

  // 'released' maps to Published in the UI
  const publishedBooks = books.filter((b) => b.status === 'released');
  const draftBooks = books.filter((b) => b.status === 'draft');

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

  return (
    <div className="space-y-4 pb-28">
      {/* Header Info Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-1">
        <div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight">
            Koleksi Karya (Works)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Daftar seluruh naskah dan buku Anda di IndexedDB
          </p>
        </div>

        <div className="grid grid-cols-3 gap-1.5 sm:flex sm:items-center sm:gap-2 flex-shrink-0">
          {onOpenRestoreModal && (
            <button
              type="button"
              onClick={onOpenRestoreModal}
              className="inline-flex items-center justify-center gap-1.5 py-2 px-2 sm:px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs active:scale-95 transition shadow-sm"
              title="Pulihkan Buku dari File Cadangan Komputer atau Google Drive"
            >
              <Upload className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
              <span className="hidden sm:inline">Pulihkan Cadangan</span>
              <span className="sm:hidden truncate">Pulihkan</span>
            </button>
          )}

          {onOpenStoryArchitect && (
            <button
              type="button"
              onClick={onOpenStoryArchitect}
              className="inline-flex items-center justify-center gap-1.5 py-2 px-2 sm:px-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl text-xs shadow-md shadow-indigo-500/20 active:scale-95 transition"
              title="Rancang Cerita dengan AI Story Architect"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300 flex-shrink-0" />
              <span className="hidden sm:inline">AI Story Architect</span>
              <span className="sm:hidden truncate">Architect</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onOpenCreateModal(activeCategory === 'released' ? 'released' : 'draft')}
            className="inline-flex items-center justify-center gap-1.5 py-2 px-2 sm:px-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl text-xs shadow-md shadow-amber-500/20 active:scale-95 transition"
            title="Tambah Buku Baru"
          >
            <Plus className="w-4 h-4 stroke-[2.5] flex-shrink-0" />
            <span className="truncate">Buku Baru</span>
          </button>
        </div>
      </div>

      {/* 📚 Category Segmented Control: Published & Draft */}
      <div className="bg-slate-100/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800/80 p-1 rounded-2xl shadow-sm">
        <div className="grid grid-cols-3 gap-1">
          {/* Published Tab */}
          <button
            onClick={() => setActiveCategory('released')}
            className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold transition-all ${
              activeCategory === 'released'
                ? 'bg-white dark:bg-emerald-500 text-emerald-700 dark:text-slate-950 shadow-sm border border-slate-200/80 dark:border-transparent'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800/60'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 dark:text-current" />
            <span>Published</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeCategory === 'released'
                  ? 'bg-emerald-50 dark:bg-slate-950 text-emerald-700 dark:text-emerald-400'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              {publishedBooks.length}
            </span>
          </button>

          {/* Draft Tab */}
          <button
            onClick={() => setActiveCategory('draft')}
            className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold transition-all ${
              activeCategory === 'draft'
                ? 'bg-white dark:bg-amber-500 text-amber-800 dark:text-slate-950 shadow-sm border border-slate-200/80 dark:border-transparent'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800/60'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-amber-500 dark:text-current" />
            <span>Draft</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeCategory === 'draft'
                  ? 'bg-amber-50 dark:bg-slate-950 text-amber-700 dark:text-amber-400'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              {draftBooks.length}
            </span>
          </button>

          {/* All Tab */}
          <button
            onClick={() => setActiveCategory('all')}
            className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold transition-all ${
              activeCategory === 'all'
                ? 'bg-white dark:bg-indigo-500 text-indigo-700 dark:text-white shadow-sm border border-slate-200/80 dark:border-transparent'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800/60'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-indigo-500 dark:text-current" />
            <span>Semua</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeCategory === 'all'
                  ? 'bg-indigo-50 dark:bg-slate-950 text-indigo-700 dark:text-indigo-300'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              {books.length}
            </span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari judul cerita, genre, atau sinopsis..."
          className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500/60 shadow-sm"
        />
      </div>

      {/* Books Grid */}
      {filteredBooks.length === 0 ? (
        <div className="text-center py-14 px-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-white/60 dark:bg-slate-900/30">
          <BookOpen className="w-10 h-10 mx-auto text-slate-400 dark:text-slate-600 mb-2" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
            {searchQuery
              ? 'Tidak Ada Cerita yang Cocok'
              : activeCategory === 'released'
              ? 'Belum Ada Cerita yang Dirilis (Published)'
              : activeCategory === 'draft'
              ? 'Belum Ada Cerita Draft'
              : 'Belum Ada Cerita'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-4">
            {searchQuery
              ? 'Coba gunakan kata kunci pencarian yang lain.'
              : 'Mulai buat buku baru Anda dan atur alur cerita serta worldbuilding-nya.'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {onOpenRestoreModal && (
              <button
                type="button"
                onClick={onOpenRestoreModal}
                className="inline-flex items-center gap-1.5 py-2 px-4 rounded-xl border border-indigo-300 dark:border-indigo-700/60 bg-indigo-50/70 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-bold text-xs transition active:scale-95 shadow-xs"
              >
                <Upload className="w-4 h-4 text-indigo-500" />
                <span>Pulihkan dari Cadangan (Restore)</span>
              </button>
            )}
            {onOpenStoryArchitect && (
              <button
                onClick={onOpenStoryArchitect}
                className="inline-flex items-center gap-1.5 py-2 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl text-xs shadow-md shadow-indigo-500/20 active:scale-95 transition"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>AI Story Architect ✨</span>
              </button>
            )}
            <button
              onClick={() => onOpenCreateModal(activeCategory === 'released' ? 'released' : 'draft')}
              className="inline-flex items-center gap-1.5 py-2 px-4 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold rounded-xl text-xs shadow-md shadow-amber-500/20 active:scale-95 transition"
            >
              <Plus className="w-4 h-4" />
              <span>
                Buat Buku Baru ({activeCategory === 'released' ? 'Published' : 'Draft'})
              </span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3.5">
          {filteredBooks.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              onSelect={onSelectBook}
              onRead={onReadBook}
              chapterCount={chapterCounts[book.id] || 0}
            />
          ))}
        </div>
      )}
    </div>
  );
};
