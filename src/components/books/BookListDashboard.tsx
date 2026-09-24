import React, { useState } from 'react';
import { Book, BookStatus } from '../../types';
import { BookCard } from './BookCard';
import {
  Plus,
  BookOpen,
  Search,
  Sparkles,
  Layers,
  CheckCircle2,
  Clock,
  Filter
} from 'lucide-react';

interface BookListDashboardProps {
  books: Book[];
  chapterCounts: Record<string, number>;
  onSelectBook: (book: Book) => void;
  onOpenCreateModal: (defaultStatus?: BookStatus) => void;
}

export const BookListDashboard: React.FC<BookListDashboardProps> = ({
  books,
  chapterCounts,
  onSelectBook,
  onOpenCreateModal,
}) => {
  const [activeCategory, setActiveCategory] = useState<'all' | BookStatus>('draft');
  const [searchQuery, setSearchQuery] = useState('');

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

  return (
    <div className="space-y-5 pb-28">
      {/* Category Segmented Control (Mobile-First Sheet / Tab Bar) */}
      <div className="bg-slate-900/90 border border-slate-800/80 p-1.5 rounded-2xl shadow-sm">
        <div className="grid grid-cols-3 gap-1.5">
          {/* Draft Tab */}
          <button
            onClick={() => setActiveCategory('draft')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
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
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
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
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
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
                  ? 'bg-slate-950 text-indigo-400'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {books.length}
            </span>
          </button>
        </div>
      </div>

      {/* Search Bar & Header CTA */}
      <div className="flex items-center gap-2.5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari judul cerita, genre, atau sinopsis..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60 text-xs sm:text-sm"
          />
        </div>

        {/* Desktop / Tablet New Book Button */}
        <button
          onClick={() => onOpenCreateModal(activeCategory === 'released' ? 'released' : 'draft')}
          className="hidden sm:inline-flex items-center gap-2 py-2.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl text-xs shadow-md shadow-amber-500/20 transition active:scale-95 flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Buku Baru</span>
        </button>
      </div>

      {/* Book Cards Grid */}
      {filteredBooks.length === 0 ? (
        <div className="text-center py-16 px-4 border border-dashed border-slate-800 rounded-3xl bg-slate-900/40">
          <BookOpen className="w-12 h-12 mx-auto text-slate-600 mb-3" />
          <h3 className="text-base font-bold text-white mb-1">
            {searchQuery
              ? 'Tidak Ada Cerita yang Cocok'
              : activeCategory === 'draft'
              ? 'Belum Ada Cerita Draft'
              : activeCategory === 'released'
              ? 'Belum Ada Cerita yang Dirilis'
              : 'Belum Ada Cerita Tersimpan'}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mb-5 leading-relaxed">
            {searchQuery
              ? 'Coba gunakan kata kunci pencarian yang lain.'
              : 'Mulai buat buku baru Anda sekarang, atur sampul visual, alur cerita, dan worldbuilding.'}
          </p>
          <button
            onClick={() => onOpenCreateModal(activeCategory === 'released' ? 'released' : 'draft')}
            className="inline-flex items-center gap-2 py-2.5 px-5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl text-xs shadow-lg shadow-amber-500/20 transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>
              Buat Buku Baru ({activeCategory === 'released' ? 'Released' : 'Draft'})
            </span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
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

      {/* Mobile Floating Action Button (FAB) for Creating New Book */}
      <div className="fixed bottom-5 right-5 sm:hidden z-30">
        <button
          onClick={() => onOpenCreateModal(activeCategory === 'released' ? 'released' : 'draft')}
          className="flex items-center gap-2 py-3 px-4.5 bg-gradient-to-r from-amber-500 to-amber-600 active:scale-95 text-slate-950 font-extrabold rounded-full shadow-xl shadow-amber-500/30 border border-amber-400/50 transition-transform"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
          <span className="text-xs pr-1">Buku Baru</span>
        </button>
      </div>
    </div>
  );
};
