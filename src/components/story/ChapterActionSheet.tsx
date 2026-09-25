import React from 'react';
import { StoryChapter, ChapterStatus } from '../../types';
import {
  X,
  BookOpen,
  Edit3,
  Trash2,
  CheckCircle2,
  Clock,
  Sparkles,
  FileText,
  Target,
  ArrowRight
} from 'lucide-react';

interface ChapterActionSheetProps {
  chapter: StoryChapter | null;
  chapterIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onOpenEditor: (chapter: StoryChapter) => void;
  onStatusChange: (chapter: StoryChapter, newStatus: ChapterStatus) => void;
  onDelete: (chapterId: string, title: string) => void;
}

export const ChapterActionSheet: React.FC<ChapterActionSheetProps> = ({
  chapter,
  chapterIndex,
  isOpen,
  onClose,
  onOpenEditor,
  onStatusChange,
  onDelete,
}) => {
  if (!isOpen || !chapter) return null;

  const statuses: { id: ChapterStatus; label: string; icon: any; color: string }[] = [
    { id: 'planned', label: 'Direncanakan', icon: Clock, color: 'text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/15 border-purple-200 dark:border-purple-500/30' },
    { id: 'in_progress', label: 'Sedang Ditulis', icon: Sparkles, color: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/15 border-amber-200 dark:border-amber-500/30' },
    { id: 'completed', label: 'Selesai', icon: CheckCircle2, color: 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/30' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Dim Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/50 dark:bg-black/70 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Bottom Sheet */}
      <div className="relative w-full sm:max-w-lg bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl z-10 animate-in slide-in-from-bottom duration-250 safe-bottom">
        {/* Mobile Swipe Handle Indicator */}
        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700/80 rounded-full mx-auto mb-4 sm:hidden" />

        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                Bab {chapter.order || chapterIndex + 1}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {(chapter.wordCount || 0).toLocaleString()} kata
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">
              {chapter.title || 'Bab Tanpa Judul'}
            </h3>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Primary Action Button: Open Writer / Studio */}
        <button
          onClick={() => {
            onClose();
            onOpenEditor(chapter);
          }}
          className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm shadow-lg shadow-amber-500/20 active:scale-95 transition flex items-center justify-center gap-2 mb-4"
        >
          <BookOpen className="w-4 h-4" />
          <span>Buka Studio &amp; Naskah Bab Ini</span>
          <ArrowRight className="w-4 h-4" />
        </button>

        {/* Status Selector */}
        <div className="space-y-2 mb-4">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
            Ubah Status Bab
          </label>
          <div className="grid grid-cols-3 gap-2">
            {statuses.map((s) => {
              const Icon = s.icon;
              const isCurrent = chapter.status === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => onStatusChange(chapter, s.id)}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition active:scale-95 ${
                    isCurrent
                      ? `${s.color} ring-2 ring-amber-500/50`
                      : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-4 h-4 mb-1" />
                  <span className="text-[11px]">{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Delete Danger Action */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <button
            onClick={() => onDelete(chapter.id, chapter.title)}
            className="w-full py-2.5 px-3 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold flex items-center justify-center gap-2 transition active:scale-95"
          >
            <Trash2 className="w-4 h-4" />
            <span>Hapus Bab Ini</span>
          </button>
        </div>
      </div>
    </div>
  );
};
