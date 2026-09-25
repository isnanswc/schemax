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
    { id: 'planned', label: 'Direncanakan', icon: Clock, color: 'text-purple-400 bg-purple-500/15 border-purple-500/30' },
    { id: 'in_progress', label: 'Sedang Ditulis', icon: Sparkles, color: 'text-amber-400 bg-amber-500/15 border-amber-500/30' },
    { id: 'completed', label: 'Selesai', icon: CheckCircle2, color: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Dim Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Draggable Bottom Sheet on Mobile / Centered Modal on Tablet */}
      <div className="relative w-full sm:max-w-lg bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl z-10 animate-in slide-in-from-bottom duration-250 safe-bottom">
        {/* Mobile Swipe Handle Indicator */}
        <div className="w-12 h-1.5 bg-slate-700/80 rounded-full mx-auto mb-4 sm:hidden" />

        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Bab {chapter.order || chapterIndex + 1}
              </span>
              <span className="text-xs text-slate-400">
                {(chapter.wordCount || 0).toLocaleString()} kata
              </span>
            </div>
            <h3 className="text-lg font-bold text-white truncate">
              {chapter.title || 'Bab Tanpa Judul'}
            </h3>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Premise & Notes Section */}
        <div className="space-y-3 mb-5 max-h-48 overflow-y-auto no-scrollbar bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Premis / Alur Adegan:
            </span>
            <p className="text-xs text-slate-200 leading-relaxed">
              {chapter.premise || 'Belum ada premis singkat untuk bab ini.'}
            </p>
          </div>

          {chapter.notes && (
            <div className="pt-2 border-t border-slate-800/60">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400/90 block mb-1">
                Catatan Penulis:
              </span>
              <p className="text-xs text-slate-300 italic leading-relaxed">
                {chapter.notes}
              </p>
            </div>
          )}
        </div>

        {/* Fast 1-Tap Status Switcher */}
        <div className="mb-5">
          <span className="text-[11px] font-semibold text-slate-400 block mb-2">
            Status Bab (1-Tap Ganti):
          </span>
          <div className="grid grid-cols-3 gap-2">
            {statuses.map((st) => {
              const Icon = st.icon;
              const isSelected = chapter.status === st.id;
              return (
                <button
                  key={st.id}
                  onClick={() => onStatusChange(chapter, st.id)}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-semibold transition active:scale-95 ${
                    isSelected
                      ? `${st.color} font-bold shadow-md`
                      : 'bg-slate-800/70 border-slate-700/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-4 h-4 mb-1" />
                  <span className="text-[11px] truncate max-w-full">{st.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
          <button
            onClick={() => onDelete(chapter.id, chapter.title)}
            className="flex items-center justify-center gap-1.5 py-3 px-3.5 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-bold transition active:scale-95"
            title="Hapus Bab"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">Hapus</span>
          </button>

          <button
            onClick={() => {
              onClose();
              onOpenEditor(chapter);
            }}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-xs shadow-lg shadow-amber-500/20 transition active:scale-[0.98]"
          >
            <Edit3 className="w-4 h-4 stroke-[2.5]" />
            <span>Buka & Tulis di Editor</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
