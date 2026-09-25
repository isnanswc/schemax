import React, { useState } from 'react';
import { Book } from '../../types';
import { BookCoverImage } from './BookCoverImage';
import { EditBookModal } from './EditBookModal';
import { useLongPress } from '../../hooks/useLongPress';
import { navStack } from '../../services/backNavigationService';
import { FileText, ArrowRight, MoreVertical, Trash2, CheckCircle2, Edit3, X } from 'lucide-react';
import { db } from '../../db';

interface BookCardProps {
  book: Book;
  onSelect: (book: Book) => void;
  chapterCount?: number;
  onBookUpdated?: (updatedBook: Book) => void;
}

export const BookCard: React.FC<BookCardProps> = ({
  book,
  onSelect,
  chapterCount = 0,
  onBookUpdated,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [isPressing, setIsPressing] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const handleOpenMenu = (e?: React.SyntheticEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    navStack.push('sheet-book-action', () => setShowMenu(false));
    setShowMenu(true);
  };

  const handleCloseMenu = () => {
    navStack.pop('sheet-book-action');
    setShowMenu(false);
  };

  const longPressEvents = useLongPress(
    () => {
      setIsPressing(false);
      handleOpenMenu();
    },
    () => {
      onSelect(book);
    },
    {
      threshold: 420,
      onStart: () => setIsPressing(true),
      onCancel: () => setIsPressing(false),
      onFinish: () => setIsPressing(false),
    }
  );

  const toggleStatus = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = book.status === 'draft' ? 'released' : 'draft';
    const updated = {
      ...book,
      status: newStatus,
      updatedAt: Date.now(),
    };
    await db.books.update(book.id, updated);
    onBookUpdated?.(updated);
    handleCloseMenu();
  };

  const deleteBook = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Hapus buku "${book.title}" beserta seluruh bab dan worldbuilding-nya?`)) {
      handleCloseMenu();
      await db.books.delete(book.id);
      await db.chapters.where('bookId').equals(book.id).delete();
      await db.worldEntities.where('bookId').equals(book.id).delete();
      await db.media.where('bookId').equals(book.id).delete();
    }
  };

  const isPublished = book.status === 'released';

  return (
    <>
      <div
        {...longPressEvents}
        onContextMenu={(e) => {
          e.preventDefault();
          handleOpenMenu(e);
        }}
        className={`group relative bg-white dark:bg-slate-900/90 hover:bg-slate-50 dark:hover:bg-slate-900 border rounded-2xl p-3 sm:p-3.5 transition-all duration-200 cursor-pointer select-none flex gap-3 sm:gap-4 shadow-sm hover:shadow-md dark:shadow-sm dark:hover:shadow-lg dark:hover:shadow-black/40 touch-pan-y ${
          isPressing
            ? 'scale-[0.98] border-amber-500/80 bg-amber-50/50 dark:bg-slate-900 ring-2 ring-amber-500/30'
            : 'border-slate-200/90 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700/80'
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

              {/* 3-Dots Action Sheet Trigger */}
              <div className="relative">
                <button
                  type="button"
                  onTouchStart={(e) => e.stopPropagation()}
                  onTouchEnd={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleOpenMenu(e);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenMenu(e);
                  }}
                  className="p-1.5 -mr-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-90"
                  title="Pilihan Buku"
                  aria-label="Pilihan Buku"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
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

      {/* 📱 Mobile & Desktop Action Sheet with Full Dismissable Backdrop */}
      {showMenu && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 dark:bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={(e) => {
            e.stopPropagation();
            handleCloseMenu();
          }}
          onTouchEnd={(e) => {
            e.stopPropagation();
            handleCloseMenu();
          }}
        >
          <div
            className="w-full sm:max-w-xs bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-2xl p-4 shadow-2xl space-y-3 animate-in slide-in-from-bottom duration-200 text-slate-900 dark:text-slate-100"
            onClick={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            {/* Header info in sheet */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800/80">
              <div className="min-w-0 pr-2">
                <h4 className="text-sm font-bold truncate text-slate-900 dark:text-white">
                  {book.title}
                </h4>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  {book.genre || 'Fiksi'} • {isPublished ? 'Published' : 'Draft'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseMenu}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Menu Options */}
            <div className="space-y-1">
              {/* 1. Edit Book Information */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCloseMenu();
                  setIsEditModalOpen(true);
                }}
                className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-3 transition text-xs font-semibold text-slate-700 dark:text-slate-200 active:scale-[0.98]"
              >
                <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="leading-tight font-bold text-slate-900 dark:text-white">Edit Informasi Buku</p>
                  <p className="text-[10px] text-slate-400 font-normal">Judul, cover, sinopsis AI, target & genre</p>
                </div>
              </button>

              {/* 2. Toggle Published/Draft */}
              <button
                type="button"
                onClick={toggleStatus}
                className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-3 transition text-xs font-semibold text-slate-700 dark:text-slate-200 active:scale-[0.98]"
              >
                <div
                  className={`p-1.5 rounded-lg flex-shrink-0 ${
                    isPublished
                      ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400'
                      : 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="leading-tight font-bold text-slate-900 dark:text-white">
                    Ubah ke {isPublished ? 'Draft' : 'Published'}
                  </p>
                  <p className="text-[10px] text-slate-400 font-normal">
                    {isPublished ? 'Kembalikan status jadi draft' : 'Tandai karya sudah siap rilis'}
                  </p>
                </div>
              </button>

              {/* 3. Delete Book */}
              <button
                type="button"
                onClick={deleteBook}
                className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center gap-3 transition text-xs font-semibold text-red-600 dark:text-red-400 active:scale-[0.98]"
              >
                <div className="p-1.5 rounded-lg bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 flex-shrink-0">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="leading-tight font-bold text-red-600 dark:text-red-400">Hapus Buku</p>
                  <p className="text-[10px] text-red-400/80 font-normal">Hapus bab, worldbuilding &amp; media</p>
                </div>
              </button>
            </div>

            {/* Cancel Button */}
            <button
              type="button"
              onClick={handleCloseMenu}
              className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition active:scale-[0.98]"
            >
              Batal / Tutup
            </button>
          </div>
        </div>
      )}

      {/* 📝 Edit Book Modal */}
      <EditBookModal
        isOpen={isEditModalOpen}
        book={book}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={(updated) => {
          onBookUpdated?.(updated);
        }}
      />
    </>
  );
};

