import React, { useState } from 'react';
import { StoryChapter, ChapterStatus } from '../../types';
import { AddPlannedStoryModal } from './AddPlannedStoryModal';
import { ChapterCard } from './ChapterCard';
import { ChapterActionSheet } from './ChapterActionSheet';
import {
  Plus,
  BookOpen,
  Filter,
  Sparkles,
  Info
} from 'lucide-react';
import { db } from '../../db';

interface StoryPlannerViewProps {
  bookId: string;
  chapters: StoryChapter[];
  onOpenEditor: (chapter: StoryChapter) => void;
  onRefresh: () => void;
}

export const StoryPlannerView: React.FC<StoryPlannerViewProps> = ({
  bookId,
  chapters,
  onOpenEditor,
  onRefresh,
}) => {
  const [filter, setFilter] = useState<'all' | ChapterStatus>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [activeSheetChapter, setActiveSheetChapter] = useState<{ chapter: StoryChapter; index: number } | null>(null);

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
    // Update local active sheet if open
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

  return (
    <div className="space-y-3 pb-24">
      {/* Top Stats Banner - Ultra Compact for Mobile Screen Space */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/30 to-slate-900 border border-slate-800/90 rounded-2xl p-3 sm:p-4 flex items-center justify-between shadow-sm">
        <div>
          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">
            Progres Naskah
          </span>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-lg sm:text-2xl font-black text-white">
              {totalWords.toLocaleString()}
            </span>
            <span className="text-[11px] text-slate-400">kata</span>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10px] font-medium text-slate-400 block">
            Target Bab Selesai
          </span>
          <span className="text-sm sm:text-base font-extrabold text-amber-400 mt-0.5 block">
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
                : 'bg-slate-900/90 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Semua ({chapters.length})
          </button>
          <button
            onClick={() => setFilter('planned')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition active:scale-95 ${
              filter === 'planned'
                ? 'bg-purple-500/25 text-purple-300 border border-purple-500/50 font-bold'
                : 'bg-slate-900/90 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Direncanakan
          </button>
          <button
            onClick={() => setFilter('in_progress')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition active:scale-95 ${
              filter === 'in_progress'
                ? 'bg-amber-500/25 text-amber-300 border border-amber-500/50 font-bold'
                : 'bg-slate-900/90 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Sedang Ditulis
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition active:scale-95 ${
              filter === 'completed'
                ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/50 font-bold'
                : 'bg-slate-900/90 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Selesai
          </button>
        </div>

        {/* Add Planned Story Button */}
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 py-2.5 px-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-95 text-slate-950 font-bold rounded-xl text-xs shadow-md shadow-amber-500/15 transition flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Bab Baru</span>
        </button>
      </div>

      {/* Helpful Mobile Micro-Hint */}
      {filteredChapters.length > 0 && (
        <div className="flex items-center gap-1.5 px-1 text-[11px] text-slate-500">
          <Info className="w-3.5 h-3.5 text-amber-400/80 flex-shrink-0" />
          <span>Tip: <strong>Tekan & tahan</strong> kartu bab untuk intip premis atau ganti status cepat.</span>
        </div>
      )}

      {/* Chapters List */}
      {filteredChapters.length === 0 ? (
        <div className="text-center py-12 px-4 border border-dashed border-slate-800 rounded-2xl bg-slate-900/30">
          <BookOpen className="w-9 h-9 mx-auto text-slate-600 mb-2" />
          <h3 className="text-sm font-bold text-white mb-1">Belum Ada Bab Terdaftar</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
            Rancang plot dan alur adegan ceritamu dengan menekan tombol Tambah Bab Baru.
          </p>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-2 py-2 px-4 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl text-xs border border-slate-700 transition"
          >
            <Plus className="w-4 h-4 text-amber-400" />
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
              onOpenActionSheet={(chap, i) => setActiveSheetChapter({ chapter: chap, index: i })}
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
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => onRefresh()}
      />

      {/* Long-Press Mobile Bottom Action Sheet */}
      <ChapterActionSheet
        chapter={activeSheetChapter?.chapter || null}
        chapterIndex={activeSheetChapter?.index || 0}
        isOpen={!!activeSheetChapter}
        onClose={() => setActiveSheetChapter(null)}
        onOpenEditor={onOpenEditor}
        onStatusChange={handleStatusChange}
        onDelete={handleDelete}
      />
    </div>
  );
};
