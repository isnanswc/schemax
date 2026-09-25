import React from 'react';
import { Book } from '../../types';
import { BookCoverImage } from './BookCoverImage';
import { useLongPress } from '../../hooks/useLongPress';
import { Calendar, FileText, ArrowRight, MoreVertical, Trash2, CheckCircle2, Edit3, Sparkles } from 'lucide-react';
import { db } from '../../db';

interface BookCardProps {
  book: Book;
  onSelect: (book: Book) => void;
  chapterCount?: number;
}

export const BookCard: React.FC<BookCardProps> = ({ book, onSelect, chapterCount = 0 }) => {
  const [showMenu, setShowMenu] = React.useState(false);
  const [isPressing, setIsPressing] = React.useState(false);

  const longPressEvents = useLongPress(
    () => {
      setIsPressing(false);
      setShowMenu(true);
    },
    () => {
      onSelect(book);
    },
    {
      threshold: 400,
      onStart: () => setIsPressing(true),
      onCancel: () => setIsPressing(false),
      onFinish: () => setIsPressing(false),
    }
  );

  const toggleStatus = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = book.status === 'draft' ? 'released' : 'draft';
    await db.books.update(book.id, {
      status: newStatus,
      updatedAt: Date.now()
    });
    setShowMenu(false);
  };

  const deleteBook = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Hapus buku "${book.title}" beserta seluruh bab dan worldbuilding-nya?`)) {
      await db.books.delete(book.id);
      await db.chapters.where('bookId').equals(book.id).delete();
      await db.worldEntities.where('bookId').equals(book.id).delete();
      await db.media.where('bookId').equals(book.id).delete();
    }
  };

  const isPublished = book.status === 'released';

  return (
    <div
      {...longPressEvents}
      onContextMenu={(e) => {
        e.preventDefault();
        setShowMenu(true);
      }}
      className={`group relative bg-white dark:bg-slate-900/90 hover:bg-slate-50 dark:hover:bg-slate-900 border rounded-2xl p-3 sm:p-3.5 transition-all duration-200 cursor-pointer select-none flex gap-3 sm:gap-4 shadow-sm hover:shadow-md dark:shadow-sm dark:hover:shadow-lg dark:hover:shadow-black/40 ${
        isPressing
          ? 'scale-[0.98] border-amber-500/80 bg-amber-50/50 dark:bg-slate-900 ring-2 ring-amber-500/30'
          : 'border-slate-200/90 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700/80 active:scale-[0.99]'
      }`}
    >
      {/* Visual Cover Thumbnail */}
      <div className="w-20 sm:w-28 flex-shrink-0">
        <BookCoverImage
          mediaId={book.coverMediaId}
          title={book.title}
          aspectRatio="book"
          className="rounded-xl ring-1 ring-slate-200 dark:ring-white/5"
        />
      </div>

      {/* Book Information */}
      <div className="flex-1 flex flex-col justify-between min-w-0">
        <div>
          {/* Top Status & Genre */}
          <div className="flex items-center justify-between gap-1.5 mb-1">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase ${
                isPublished
                  ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30'
                  : 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isPublished ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-amber-500 dark:bg-amber-400'
                }`}
              />
              {isPublished ? 'Published' : 'Draft'}
            </span>

            {/* Dropdown Menu Trigger */}
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(!showMenu);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                title="Pilihan Buku"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {showMenu && (
                <div 
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 top-6 w-44 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-30 py-1 text-xs animate-in fade-in zoom-in-95 text-slate-700 dark:text-slate-200"
                >
                  <button
                    onClick={toggleStatus}
                    className="w-full text-left px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 transition"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-500" />
                    <span>Ubah ke {book.status === 'draft' ? 'Published' : 'Draft'}</span>
                  </button>
                  <button
                    onClick={deleteBook}
                    className="w-full text-left px-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center gap-2 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Buku</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Book Title */}
          <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-300 transition-colors line-clamp-1 leading-snug">
            {book.title}
          </h3>

          {/* Synopsis */}
          <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mt-0.5 leading-relaxed">
            {book.synopsis || 'Belum ada sinopsis. Ketuk untuk mulai menulis naskah.'}
          </p>
        </div>

        {/* Bottom Metadata */}
        <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800/60 mt-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
              <FileText className="w-3 h-3 text-amber-500" />
              {chapterCount} Bab
            </span>
            <span className="text-slate-300 dark:text-slate-600">•</span>
            <span className="text-slate-500 dark:text-slate-400 truncate max-w-[90px] sm:max-w-none">
              {book.genre || 'Fiksi'}
            </span>
          </div>

          <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold group-hover:translate-x-0.5 transition-transform text-xs">
            <span>Buka</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
    </div>
  );
};
