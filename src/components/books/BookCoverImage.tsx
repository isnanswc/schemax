import React, { useState } from 'react';
import { useMediaUrl } from '../../hooks/useMediaUrl';
import { BookOpen, Maximize2 } from 'lucide-react';
import { usePrivacy } from '../../contexts/PrivacyContext';
import { ImageViewerModal } from '../common/ImageViewerModal';

interface BookCoverImageProps {
  mediaId?: string;
  title: string;
  className?: string;
  aspectRatio?: 'book' | 'square' | 'wide';
  enableFullscreen?: boolean;
}

export const BookCoverImage: React.FC<BookCoverImageProps> = ({
  mediaId,
  title,
  className = '',
  aspectRatio = 'book',
  enableFullscreen = true,
}) => {
  const { url, loading } = useMediaUrl(mediaId);
  const { getBlurImageClass } = usePrivacy();
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  const aspectClass =
    aspectRatio === 'book'
      ? 'aspect-[3/4]'
      : aspectRatio === 'square'
      ? 'aspect-square'
      : 'aspect-video';

  const handleImageClick = (e: React.MouseEvent) => {
    if (enableFullscreen && url) {
      e.stopPropagation();
      e.preventDefault();
      setIsViewerOpen(true);
    }
  };

  return (
    <>
      {loading ? (
        <div
          className={`w-full ${aspectClass} rounded-xl bg-slate-800/80 animate-pulse flex items-center justify-center ${className}`}
        >
          <BookOpen className="w-8 h-8 text-slate-600 animate-bounce" />
        </div>
      ) : url ? (
        <div
          onClick={handleImageClick}
          className={`relative w-full ${aspectClass} rounded-xl overflow-hidden bg-slate-900 border border-slate-800/60 shadow-md group/cover ${
            enableFullscreen ? 'cursor-zoom-in' : ''
          } ${className}`}
        >
          <img
            src={url}
            alt={title}
            className={`w-full h-full object-cover transition-transform duration-300 group-hover/cover:scale-105 ${getBlurImageClass()}`}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none" />

          {enableFullscreen && (
            <div className="absolute bottom-1.5 right-1.5 p-1 rounded-md bg-black/60 text-white/80 opacity-0 group-hover/cover:opacity-100 transition-opacity">
              <Maximize2 className="w-3 h-3" />
            </div>
          )}
        </div>
      ) : (
        /* Fallback cover if no image uploaded */
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
      )}

      {/* Universal Image Viewer Modal */}
      {enableFullscreen && url && (
        <ImageViewerModal
          isOpen={isViewerOpen}
          imageUrl={url}
          title={title}
          subtitle="Sampul Buku"
          onClose={() => setIsViewerOpen(false)}
        />
      )}
    </>
  );
};
