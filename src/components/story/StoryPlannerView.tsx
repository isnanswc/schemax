import React, { useState } from 'react';
import { StoryChapter, ChapterStatus } from '../../types';
import { AddPlannedStoryModal } from './AddPlannedStoryModal';
import {
  Plus,
  BookOpen,
  Edit3,
  Trash2,
  CheckCircle2,
  Clock,
  Sparkles,
  FileText,
  ChevronRight,
  Filter
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

  const filteredChapters = chapters.filter((c) => {
    if (filter === 'all') return true;
    return c.status === filter;
  });

  const totalWords = chapters.reduce((sum, c) => sum + (c.wordCount || 0), 0);
  const completedChapters = chapters.filter((c) => c.status === 'completed').length;

  const handleDelete = async (id: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Hapus bab "${title}"?`)) {
      await db.chapters.delete(id);
      onRefresh();
    }
  };

  const handleStatusToggle = async (chapter: StoryChapter, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextStatus: Record<ChapterStatus, ChapterStatus> = {
      planned: 'in_progress',
      in_progress: 'completed',
      completed: 'planned',
    };
    const newStatus = nextStatus[chapter.status];
    await db.chapters.update(chapter.id, {
      status: newStatus,
      updatedAt: Date.now(),
    });
    onRefresh();
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Top Stats Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950/40 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-sm">
        <div>
          <span className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider block mb-0.5">
            Progres Naskah
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-extrabold text-white">
              {totalWords.toLocaleString()}
            </span>
            <span className="text-xs text-slate-400">total kata</span>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[11px] font-medium text-slate-400 block mb-0.5">
            Selesai / Total Bab
          </span>
          <span className="text-base font-bold text-amber-400">
            {completedChapters} / {chapters.length} Bab
          </span>
        </div>
      </div>

      {/* Action Header & Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Status Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              filter === 'all'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Semua ({chapters.length})
          </button>
          <button
            onClick={() => setFilter('planned')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              filter === 'planned'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Direncanakan
          </button>
          <button
            onClick={() => setFilter('in_progress')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              filter === 'in_progress'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Sedang Ditulis
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              filter === 'completed'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Selesai
          </button>
        </div>

        {/* Add Planned Story Button */}
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-95 text-slate-950 font-bold rounded-xl text-xs shadow-md shadow-amber-500/15 transition flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Rencana Bab</span>
        </button>
      </div>

      {/* Chapters List */}
      {filteredChapters.length === 0 ? (
        <div className="text-center py-12 px-4 border border-dashed border-slate-800 rounded-2xl bg-slate-900/40">
          <BookOpen className="w-10 h-10 mx-auto text-slate-600 mb-3" />
          <h3 className="text-sm font-bold text-white mb-1">Belum Ada Bab Terdaftar</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
            Rancang plot dan premis cerita pertama Anda dengan menekan tombol Tambah Rencana Bab.
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
        <div className="space-y-3">
          {filteredChapters.map((chapter, idx) => {
            const statusConfig = {
              planned: {
                label: 'Direncanakan',
                bg: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
                dot: 'bg-purple-400',
              },
              in_progress: {
                label: 'Sedang Ditulis',
                bg: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
                dot: 'bg-amber-400',
              },
              completed: {
                label: 'Selesai',
                bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
                dot: 'bg-emerald-400',
              },
            }[chapter.status];

            return (
              <div
                key={chapter.id}
                onClick={() => onOpenEditor(chapter)}
                className="group bg-slate-900/80 hover:bg-slate-900 border border-slate-800/80 hover:border-slate-700/80 rounded-2xl p-4 transition-all duration-200 cursor-pointer active:scale-[0.99] shadow-sm flex flex-col justify-between gap-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-[11px] font-bold text-amber-400/90 tracking-wide uppercase">
                        Bab {chapter.order || idx + 1}
                      </span>
                      <button
                        onClick={(e) => handleStatusToggle(chapter, e)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusConfig.bg} hover:opacity-80 transition`}
                        title="Klik untuk ubah status"
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                        <span>{statusConfig.label}</span>
                      </button>
                    </div>

                    <h4 className="font-bold text-base text-white group-hover:text-amber-300 transition-colors line-clamp-1">
                      {chapter.title}
                    </h4>

                    {chapter.premise && (
                      <p className="text-xs text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                        {chapter.premise}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => handleDelete(chapter.id, chapter.title, e)}
                      className="p-1.5 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition"
                      title="Hapus Bab"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Bottom Card Footer */}
                <div className="pt-2.5 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-amber-400" />
                      {(chapter.wordCount || 0).toLocaleString()} kata
                    </span>
                    <span className="text-slate-600">•</span>
                    <span className="text-slate-400 text-[11px]">
                      Target {chapter.targetWordCount || 1500}
                    </span>
                  </div>

                  <div className="inline-flex items-center gap-1 text-amber-400 font-bold group-hover:translate-x-0.5 transition-transform text-xs">
                    <span>Tulis Cerita</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            );
          })}
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
    </div>
  );
};
