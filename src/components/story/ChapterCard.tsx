import React, { useState } from 'react';
import { StoryChapter, ChapterStatus } from '../../types';
import { useLongPress } from '../../hooks/useLongPress';
import { useMediaUrl } from '../../hooks/useMediaUrl';
import {
  FileText,
  ChevronRight,
  MoreVertical,
  Clock,
  Sparkles,
  CheckCircle2,
  BookOpen
} from 'lucide-react';

interface ChapterCardProps {
  chapter: StoryChapter;
  index: number;
  onOpenEditor: (chapter: StoryChapter) => void;
  onOpenReader?: (chapter: StoryChapter) => void;
  onOpenActionSheet: (chapter: StoryChapter, index: number) => void;
  onQuickStatusToggle: (chapter: StoryChapter, e: React.MouseEvent) => void;
}

export const ChapterCard: React.FC<ChapterCardProps> = ({
  chapter,
  index,
  onOpenEditor,
  onOpenReader,
  onOpenActionSheet,
  onQuickStatusToggle,
}) => {
  const [isPressing, setIsPressing] = useState(false);
  const { url: coverUrl } = useMediaUrl(chapter.coverMediaId);
  const effectiveCover = coverUrl || chapter.coverImageUrl;

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
      bg: 'bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/30',
      dot: 'bg-purple-500 dark:bg-purple-400',
    },
    in_progress: {
      label: 'Sedang Ditulis',
      bg: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30',
      dot: 'bg-amber-500 dark:bg-amber-400',
    },
    completed: {
      label: 'Selesai',
      bg: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30',
      dot: 'bg-emerald-500 dark:bg-emerald-400',
    },
  }[chapter.status] || {
    label: 'Direncanakan',
    bg: 'bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/30',
    dot: 'bg-purple-500 dark:bg-purple-400',
  };

  return (
    <div
      {...longPressEvents}
      onContextMenu={(e) => {
        e.preventDefault();
        onOpenActionSheet(chapter, index);
      }}
      className={`group relative bg-white dark:bg-slate-900/90 border rounded-2xl p-3.5 transition-all duration-200 cursor-pointer select-none shadow-sm flex flex-col justify-between gap-2.5 touch-pan-y ${
        isPressing
          ? 'scale-[0.98] border-amber-500/80 bg-amber-50/50 dark:bg-slate-900 ring-2 ring-amber-500/30'
          : 'border-slate-200/90 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700/80'
      }`}
    >
      <div className="flex items-start gap-3">
        {effectiveCover && (
          <div className="w-14 h-20 sm:w-16 sm:h-22 rounded-xl overflow-hidden flex-shrink-0 border border-slate-200/80 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 shadow-xs">
            <img
              src={effectiveCover}
              alt={chapter.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        )}

        <div className="min-w-0 flex-1">
          {/* Badge & Order */}
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <span className="text-[11px] font-extrabold text-amber-600 dark:text-amber-400/90 tracking-wide uppercase">
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
          <h4 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-300 transition-colors line-clamp-1">
            {chapter.title || 'Bab Tanpa Judul'}
          </h4>

          {/* Premise preview */}
          {chapter.premise && (
            <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mt-1 leading-relaxed">
              {chapter.premise}
            </p>
          )}
        </div>

        {/* Action Button for 3 dots */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenActionSheet(chapter, index);
          }}
          className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition -mr-1"
          title="Menu Cepat"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>

      {/* Bottom Footer Stats */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 text-[11px] sm:text-xs">
            <FileText className="w-3.5 h-3.5 text-amber-500" />
            {(chapter.wordCount || 0).toLocaleString()} kata
          </span>
          <span className="text-slate-300 dark:text-slate-600">•</span>
          <span className="text-slate-500 text-[10px] sm:text-[11px]">
            Target {chapter.targetWordCount || 1500}
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {onOpenReader && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenReader(chapter);
              }}
              className="py-1 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[11px] flex items-center gap-1 active:scale-95 transition"
              title="Baca Bab Ini (Mode Baca Bebas Distraksi)"
            >
              <BookOpen className="w-3 h-3 text-amber-500" />
              <span>Baca</span>
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenEditor(chapter);
            }}
            className="py-1 px-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-bold text-[11px] flex items-center gap-1 active:scale-95 transition"
            title="Edit / Lanjut Menulis di Studio"
          >
            <span>Tulis</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
