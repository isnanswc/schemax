import React from 'react';
import { useMediaUrl } from '../../hooks/useMediaUrl';
import { BookOpen } from 'lucide-react';

interface BookCoverImageProps {
  mediaId?: string;
  title: string;
  className?: string;
  aspectRatio?: 'book' | 'square' | 'wide';
}

export const BookCoverImage: React.FC<BookCoverImageProps> = ({
  mediaId,
  title,
  className = '',
  aspectRatio = 'book',
}) => {
  const { url, loading } = useMediaUrl(mediaId);

  const aspectClass =
    aspectRatio === 'book'
      ? 'aspect-[3/4]'
      : aspectRatio === 'square'
      ? 'aspect-square'
      : 'aspect-video';

  if (loading) {
    return (
      <div
        className={`w-full ${aspectClass} rounded-xl bg-slate-800/80 animate-pulse flex items-center justify-center ${className}`}
      >
        <BookOpen className="w-8 h-8 text-slate-600 animate-bounce" />
      </div>
    );
  }

  if (url) {
    return (
      <div className={`relative w-full ${aspectClass} rounded-xl overflow-hidden bg-slate-900 border border-slate-800/60 shadow-md ${className}`}>
        <img
          src={url}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none" />
      </div>
    );
  }

  // Fallback cover if no image uploaded
  return (
    <div
      className={`relative w-full ${aspectClass} rounded-xl overflow-hidden bg-gradient-to-br from-indigo-950 via-slate-900 to-amber-950/40 border border-slate-800 p-4 flex flex-col justify-between shadow-md ${className}`}
    >
      <div className="flex justify-between items-center text-xs font-semibold text-amber-400/80 tracking-wider uppercase">
        <span>Schemax</span>
        <BookOpen className="w-4 h-4" />
      </div>
      <div>
        <p className="text-white font-bold text-sm sm:text-base line-clamp-2 leading-tight">
          {title || 'Tanpa Judul'}
        </p>
      </div>
    </div>
  );
};
