import React, { useState } from 'react';
import { StoryChapter, ChapterStatus } from '../../types';
import { useLongPress } from '../../hooks/useLongPress';
import {
  FileText,
  ChevronRight,
  MoreVertical,
  Clock,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';

interface ChapterCardProps {
  chapter: StoryChapter;
  index: number;
  onOpenEditor: (chapter: StoryChapter) => void;
  onOpenActionSheet: (chapter: StoryChapter, index: number) => void;
  onQuickStatusToggle: (chapter: StoryChapter, e: React.MouseEvent) => void;
}

export const ChapterCard: React.FC<ChapterCardProps> = ({
  chapter,
  index,
  onOpenEditor,
  onOpenActionSheet,
  onQuickStatusToggle,
}) => {
  const [isPressing, setIsPressing] = useState(false);

  const longPressEvents = useLongPress(
    () => {
      setIsPressing(false);
      onOpenActionSheet(chapter, index);
    },
    () => {
      onOpenEditor(chapter);
    },
    {
      threshold: 400,
      onStart: () => setIsPressing(true),
      onCancel: () => setIsPressing(false),
      onFinish: () => setIsPressing(false),
    }
  );

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
  }[chapter.status] || {
    label: 'Direncanakan',
    bg: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    dot: 'bg-purple-400',
  };

  return (
    <div
      {...longPressEvents}
      onContextMenu={(e) => {
        e.preventDefault();
        onOpenActionSheet(chapter, index);
      }}
      className={`group relative bg-slate-900/90 border rounded-2xl p-3.5 transition-all duration-200 cursor-pointer select-none shadow-sm flex flex-col justify-between gap-2.5 ${
        isPressing
          ? 'scale-[0.98] border-amber-500/80 bg-slate-900 ring-2 ring-amber-500/30'
          : 'border-slate-800/80 hover:border-slate-700/80 active:scale-[0.99]'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {/* Badge & Order */}
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <span className="text-[11px] font-extrabold text-amber-400/90 tracking-wide uppercase">
              Bab {chapter.order || index + 1}
            </span>

            <button
              type="button"
              onClick={(e) => onQuickStatusToggle(chapter, e)}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusConfig.bg} hover:opacity-80 transition`}
              title="Ketuk untuk ubah status"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
              <span>{statusConfig.label}</span>
            </button>
          </div>

          {/* Title */}
          <h4 className="font-bold text-sm sm:text-base text-white group-hover:text-amber-300 transition-colors line-clamp-1">
            {chapter.title || 'Bab Tanpa Judul'}
          </h4>

          {/* Premise preview */}
          {chapter.premise && (
            <p className="text-xs text-slate-400 line-clamp-2 mt-1 leading-relaxed">
              {chapter.premise}
            </p>
          )}
        </div>

        {/* Action Button for 3 dots (Accessibility fallback) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenActionSheet(chapter, index);
          }}
          className="p-1.5 rounded-xl text-slate-500 hover:text-amber-400 hover:bg-slate-800 transition -mr-1"
          title="Menu Cepat"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>

      {/* Bottom Footer Stats */}
      <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-200 flex items-center gap-1.5 text-[11px] sm:text-xs">
            <FileText className="w-3.5 h-3.5 text-amber-400" />
            {(chapter.wordCount || 0).toLocaleString()} kata
          </span>
          <span className="text-slate-600">•</span>
          <span className="text-slate-500 text-[10px] sm:text-[11px]">
            Target {chapter.targetWordCount || 1500}
          </span>
        </div>

        <div className="inline-flex items-center gap-1 text-amber-400 font-bold group-hover:translate-x-0.5 transition-transform text-[11px] sm:text-xs">
          <span>Tulis</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </div>
      </div>
    </div>
  );
};
