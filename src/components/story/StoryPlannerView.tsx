import React, { useState, useRef, useEffect } from 'react';
import { Book, StoryChapter, ChapterStatus } from '../../types';
import { AddPlannedStoryModal } from './AddPlannedStoryModal';
import { ChapterCard } from './ChapterCard';
import { ChapterActionSheet } from './ChapterActionSheet';
import {
  Plus,
  BookOpen,
  Filter,
  Sparkles,
  Info,
  Maximize2
} from 'lucide-react';
import { db } from '../../db';
import { navStack } from '../../services/backNavigationService';
import { useMediaUrl } from '../../hooks/useMediaUrl';
import { ImageViewerModal } from '../common/ImageViewerModal';
import { usePrivacy } from '../../contexts/PrivacyContext';

interface StoryPlannerViewProps {
  bookId: string;
  book?: Book | null;
  chapters: StoryChapter[];
  onOpenEditor: (chapter: StoryChapter) => void;
  onOpenReader?: (chapter: StoryChapter) => void;
  onRefresh: () => void;
}

export const StoryPlannerView: React.FC<StoryPlannerViewProps> = ({
  bookId,
  book,
  chapters,
  onOpenEditor,
  onOpenReader,
  onRefresh,
}) => {
  const [filter, setFilter] = useState<'all' | ChapterStatus>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [activeSheetChapter, setActiveSheetChapter] = useState<{ chapter: StoryChapter; index: number } | null>(null);
  const [isCoverViewerOpen, setIsCoverViewerOpen] = useState(false);
  const { url: bookCoverUrl } = useMediaUrl(book?.coverMediaId);
  const { getBlurImageClass, getBlurTitleClass, getBlurTextClass } = usePrivacy();

  const mountTimeRef = useRef(Date.now());

  useEffect(() => {
    mountTimeRef.current = Date.now();
    setIsAddModalOpen(false);
  }, [bookId]);

  const handleOpenAddModal = (e?: React.SyntheticEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    // Block ghost click / tap-through within 600ms of mounting
    if (Date.now() - mountTimeRef.current < 600) {
      return;
    }
    navStack.push('modal-add-chapter', () => setIsAddModalOpen(false));
    setIsAddModalOpen(true);
  };

  const handleCloseAddModal = () => {
    navStack.pop('modal-add-chapter');
    setIsAddModalOpen(false);
  };

  const handleOpenActionSheet = (chapter: StoryChapter, index: number) => {
    navStack.push('sheet-chapter-action', () => setActiveSheetChapter(null));
    setActiveSheetChapter({ chapter, index });
  };

  const handleCloseActionSheet = () => {
    navStack.pop('sheet-chapter-action');
    setActiveSheetChapter(null);
  };

  const filteredChapters = chapters.filter((c) => {
    if (filter === 'all') return true;
    return c.status === filter;
  });

  const totalWords = chapters.reduce((sum, c) => sum + (c.wordCount || 0), 0);
  const completedChapters = chapters.filter((c) => c.status === 'completed').length;

  const handleDelete = async (id: string, title: string) => {
    if (confirm(`Hapus bab "${title}"?`)) {
      setActiveSheetChapter(null);
      await db.chapters.delete(id);
      onRefresh();
    }
  };

  const handleStatusChange = async (chapter: StoryChapter, newStatus: ChapterStatus) => {
    await db.chapters.update(chapter.id, {
      status: newStatus,
      updatedAt: Date.now(),
    });
    if (activeSheetChapter && activeSheetChapter.chapter.id === chapter.id) {
      setActiveSheetChapter({
        ...activeSheetChapter,
        chapter: { ...chapter, status: newStatus },
      });
    }
    onRefresh();
  };

  const handleStatusToggle = async (chapter: StoryChapter, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextStatus: Record<ChapterStatus, ChapterStatus> = {
      planned: 'in_progress',
      in_progress: 'completed',
      completed: 'planned',
    };
    await handleStatusChange(chapter, nextStatus[chapter.status]);
  };

  const handleMoveChapter = async (chapter: StoryChapter, direction: 'up' | 'down') => {
    const sorted = [...chapters].sort((a, b) => (a.order || 0) - (b.order || 0));
    const currentIndex = sorted.findIndex((c) => c.id === chapter.id);
    if (currentIndex === -1) return;
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;

    const targetChapter = sorted[targetIndex];
    const currentOrder = chapter.order || currentIndex + 1;
    const targetOrder = targetChapter.order || targetIndex + 1;

    // Swap orders
    await db.chapters.update(chapter.id, { order: targetOrder, updatedAt: Date.now() });
    await db.chapters.update(targetChapter.id, { order: currentOrder, updatedAt: Date.now() });
    onRefresh();
  };

  return (
    <div className="space-y-4 pb-24">
      {/* 🌟 Aesthetic Panoramic Ambient Cover Banner (Blends seamlessly into canvas) */}
      {bookCoverUrl && (
        <div
          onClick={() => setIsCoverViewerOpen(true)}
          className="relative h-56 sm:h-72 -mx-2.5 sm:-mx-4 -mt-3 sm:-mt-6 overflow-hidden select-none cursor-zoom-in group/banner transition-all duration-300 mb-2"
        >
          {/* 1. Ambient Color Glow Background */}
          <div
            className="absolute inset-0 bg-cover bg-center scale-110 filter blur-3xl opacity-45 dark:opacity-35 pointer-events-none"
            style={{ backgroundImage: `url(${bookCoverUrl})` }}
          />

          {/* 2. Panoramic Crisp Main Image */}
          <img
            src={bookCoverUrl}
            alt={book?.title || 'Sampul Buku'}
            className={`w-full h-full object-cover object-center group-hover/banner:scale-105 transition-transform duration-700 ease-out ${getBlurImageClass()}`}
          />

          {/* 3. Multi-Layer Seamless Gradient & Blur fading into background color */}
          {/* Top subtle vignette */}
          <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-black/30 dark:from-black/50 to-transparent pointer-events-none" />

          {/* Bottom Primary Gradient: Fades to #f8fafc (light mode) or #030712 (dark mode) */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#f8fafc] dark:from-[#030712] via-[#f8fafc]/70 dark:via-[#030712]/75 via-40% to-transparent pointer-events-none" />

          {/* Bottom Soft Backdrop Blur Layer: Melts image pixels smoothly */}
          <div className="absolute bottom-0 inset-x-0 h-28 bg-gradient-to-t from-[#f8fafc] dark:from-[#030712] via-[#f8fafc]/90 dark:via-[#030712]/90 to-transparent pointer-events-none backdrop-blur-[3px]" />

          {/* Bottom Solid Feathering: Guarantees 100% seamless transition with no harsh line */}
          <div className="absolute bottom-0 inset-x-0 h-8 bg-[#f8fafc] dark:bg-[#030712] pointer-events-none" />

          {/* 4. Elegant Hero Content overlayed at bottom */}
          <div className="absolute bottom-3 left-4 right-4 sm:bottom-4 sm:left-6 sm:right-6 flex items-end justify-between gap-4 pointer-events-none z-10">
            <div className="min-w-0 pr-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider bg-amber-500/15 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30 backdrop-blur-md shadow-xs mb-1.5">
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>{book?.genre || 'Karya Sastra'}</span>
              </span>

              <h2 className={`text-xl sm:text-3xl font-black font-serif text-slate-900 dark:text-white tracking-tight drop-shadow-sm leading-tight ${getBlurTitleClass()}`}>
                {book?.title || 'Daftar Bab'}
              </h2>

              {book?.synopsis && (
                <p className={`text-xs sm:text-sm text-slate-600 dark:text-slate-300 line-clamp-2 max-w-xl mt-1 leading-relaxed ${getBlurTextClass()}`}>
                  {book.synopsis}
                </p>
              )}
            </div>

            <div className="p-2.5 rounded-2xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 shadow-lg group-hover/banner:scale-110 transition-transform flex-shrink-0">
              <Maximize2 className="w-4 h-4" />
            </div>
          </div>
        </div>
      )}

      {/* Top Stats Banner */}
      <div className="bg-gradient-to-r from-amber-50/70 via-indigo-50/40 to-slate-50 dark:from-slate-900 dark:via-indigo-950/30 dark:to-slate-900 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-3 sm:p-4 flex items-center justify-between shadow-sm">
        <div>
          <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">
            Progres Naskah
          </span>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white">
              {totalWords.toLocaleString()}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">kata</span>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 block">
            Target Bab Selesai
          </span>
          <span className="text-sm sm:text-base font-extrabold text-amber-600 dark:text-amber-400 mt-0.5 block">
            {completedChapters} / {chapters.length} Bab
          </span>
        </div>
      </div>

      {/* Filter Chips & Action Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        {/* Status Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition active:scale-95 ${
              filter === 'all'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Semua ({chapters.length})
          </button>
          <button
            onClick={() => setFilter('planned')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition active:scale-95 ${
              filter === 'planned'
                ? 'bg-purple-100 dark:bg-purple-500/25 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-500/50 font-bold'
                : 'bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Direncanakan
          </button>
          <button
            onClick={() => setFilter('in_progress')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition active:scale-95 ${
              filter === 'in_progress'
                ? 'bg-amber-100 dark:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/50 font-bold'
                : 'bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Sedang Ditulis
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition active:scale-95 ${
              filter === 'completed'
                ? 'bg-emerald-100 dark:bg-emerald-500/25 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/50 font-bold'
                : 'bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Selesai
          </button>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {chapters.length > 0 && onOpenReader && (
            <button
              onClick={() => {
                const sorted = [...chapters].sort((a, b) => (a.order || 0) - (b.order || 0));
                onOpenReader(sorted[0]);
              }}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 py-2 px-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 font-bold rounded-xl text-xs shadow-sm transition active:scale-95"
              title="Buka Mode Baca bebas distraksi mulai dari Bab 1"
            >
              <BookOpen className="w-4 h-4 text-amber-500" />
              <span>Mode Baca</span>
            </button>
          )}

          {/* Add Planned Story Button */}
          <button
            onClick={handleOpenAddModal}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 py-2 px-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-95 text-slate-950 font-bold rounded-xl text-xs shadow-md shadow-amber-500/15 transition flex-shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Tambah Bab</span>
          </button>
        </div>
      </div>

      {/* Chapters List */}
      {filteredChapters.length === 0 ? (
        <div className="text-center py-12 px-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-white/60 dark:bg-slate-900/40">
          <BookOpen className="w-10 h-10 mx-auto text-slate-400 dark:text-slate-600 mb-2" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Belum Ada Bab Terdaftar</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-3">
            Rancang alur dan premis adegan ceritamu dengan menekan tombol Tambah Rencana Bab.
          </p>
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-1.5 py-2 px-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-bold rounded-xl text-xs border border-slate-200 dark:border-slate-700 transition"
          >
            <Plus className="w-4 h-4 text-amber-500" />
            <span>Mulai Rencana Bab Baru</span>
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredChapters.map((chapter, idx) => (
            <ChapterCard
              key={chapter.id}
              chapter={chapter}
              index={idx}
              onOpenEditor={onOpenEditor}
              onOpenReader={onOpenReader}
              onOpenActionSheet={handleOpenActionSheet}
              onQuickStatusToggle={handleStatusToggle}
            />
          ))}
        </div>
      )}

      {/* Add Planned Story Modal */}
      <AddPlannedStoryModal
        isOpen={isAddModalOpen}
        bookId={bookId}
        nextOrder={chapters.length + 1}
        onClose={handleCloseAddModal}
        onSuccess={() => onRefresh()}
      />

      {/* Long-Press Mobile Bottom Action Sheet */}
      <ChapterActionSheet
        isOpen={Boolean(activeSheetChapter)}
        chapter={activeSheetChapter?.chapter || null}
        chapterIndex={activeSheetChapter?.index || 0}
        onClose={handleCloseActionSheet}
        onOpenEditor={onOpenEditor}
        onOpenReader={onOpenReader}
        onStatusChange={handleStatusChange}
        onDelete={handleDelete}
        onMoveUp={(c) => handleMoveChapter(c, 'up')}
        onMoveDown={(c) => handleMoveChapter(c, 'down')}
        canMoveUp={Boolean(
          activeSheetChapter &&
          chapters.findIndex((c) => c.id === activeSheetChapter.chapter.id) > 0
        )}
        canMoveDown={Boolean(
          activeSheetChapter &&
          chapters.findIndex((c) => c.id === activeSheetChapter.chapter.id) < chapters.length - 1
        )}
      />

      {/* Universal Image Viewer Modal for Book Cover */}
      {bookCoverUrl && (
        <ImageViewerModal
          isOpen={isCoverViewerOpen}
          imageUrl={bookCoverUrl}
          title={book?.title || 'Sampul Buku'}
          subtitle={book?.genre || 'Sampul Buku'}
          onClose={() => setIsCoverViewerOpen(false)}
        />
      )}
    </div>
  );
};
