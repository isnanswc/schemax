import React, { useState, useEffect, useRef } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, Eye, EyeOff, Download, Sparkles, Check } from 'lucide-react';
import { usePrivacy } from '../../contexts/PrivacyContext';
import { navStack } from '../../services/backNavigationService';

interface ImageViewerModalProps {
  isOpen: boolean;
  imageUrl: string | null;
  title?: string;
  subtitle?: string;
  onClose: () => void;
  onAction?: () => void;
  actionLabel?: string;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  isOpen,
  imageUrl,
  title,
  subtitle,
  onClose,
  onAction,
  actionLabel,
}) => {
  const { settings } = usePrivacy();
  const [scale, setScale] = useState(1);
  const [isHoldingUnblur, setIsHoldingUnblur] = useState(false);
  const holdTimerRef = useRef<any>(null);

  // Register with backNavigationService
  useEffect(() => {
    if (!isOpen) return;
    navStack.push('modal-image-viewer', onClose);
    setScale(1);
    setIsHoldingUnblur(false);
    return () => {
      navStack.pop('modal-image-viewer');
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    };
  }, [isOpen]);

  if (!isOpen || !imageUrl) return null;

  const isPrivacyBlur = settings.privacyMode && settings.blurImages && !isHoldingUnblur;

  const handleZoomIn = (e: React.MouseEvent) => {
    e.stopPropagation();
    setScale((prev) => Math.min(prev + 0.3, 3));
  };

  const handleZoomOut = (e: React.MouseEvent) => {
    e.stopPropagation();
    setScale((prev) => Math.max(prev - 0.3, 0.7));
  };

  const handleResetZoom = (e: React.MouseEvent) => {
    e.stopPropagation();
    setScale(1);
  };

  const handleStartHold = () => {
    if (settings.privacyMode && settings.blurImages) {
      setIsHoldingUnblur(true);
    }
  };

  const handleEndHold = () => {
    if (settings.privacyMode && settings.blurImages) {
      setIsHoldingUnblur(false);
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = (title ? title.toLowerCase().replace(/[^a-z0-9]/g, '_') : 'image') + '.jpg';
    a.click();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 sm:bg-black/95 backdrop-blur-md animate-in fade-in duration-200 select-none touch-none"
      onClick={onClose}
    >
      {/* Top Bar with Title & Close */}
      <div
        className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-3 sm:p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0 pr-4">
          {title && (
            <h3 className="text-sm sm:text-base font-bold text-white truncate drop-shadow-md">
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="text-[11px] text-slate-300 truncate drop-shadow-sm">
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={handleDownload}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white transition backdrop-blur-sm"
            title="Unduh Gambar"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-white/15 hover:bg-white/25 active:scale-95 text-white transition backdrop-blur-sm"
            title="Tutup Pratinjau (ESC)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Image Container */}
      <div
        className="relative max-w-full max-h-full w-full h-full flex items-center justify-center p-2 sm:p-6 overflow-hidden cursor-grab active:cursor-grabbing"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={handleStartHold}
        onMouseUp={handleEndHold}
        onMouseLeave={handleEndHold}
        onTouchStart={handleStartHold}
        onTouchEnd={handleEndHold}
        onTouchCancel={handleEndHold}
      >
        <img
          src={imageUrl}
          alt={title || 'Pratinjau Gambar'}
          style={{ transform: `scale(${scale})` }}
          className={`max-w-[94vw] max-h-[82vh] object-contain rounded-2xl shadow-2xl transition-all duration-300 pointer-events-none select-none ${
            isPrivacyBlur ? 'filter blur-2xl scale-105 brightness-75' : 'filter blur-0'
          }`}
          draggable={false}
        />

        {/* Privacy Hold Indicator Banner */}
        {settings.privacyMode && settings.blurImages && (
          <div
            className={`absolute bottom-20 sm:bottom-24 px-4 py-2 rounded-2xl backdrop-blur-md border text-xs font-bold transition-all duration-300 flex items-center gap-2 pointer-events-none shadow-xl ${
              isHoldingUnblur
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse'
                : 'bg-black/75 text-amber-300 border-amber-500/40'
            }`}
          >
            {isHoldingUnblur ? (
              <>
                <Eye className="w-4 h-4 text-emerald-400" />
                <span>Melihat jelas (Lepas untuk mengaburkan kembali)</span>
              </>
            ) : (
              <>
                <EyeOff className="w-4 h-4 text-amber-400 animate-bounce" />
                <span>Tekan &amp; Tahan layar untuk melihat tanpa blur</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Bottom Floating Control Bar */}
      <div
        className="absolute bottom-4 sm:bottom-6 z-20 flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-white/10 text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleZoomOut}
          disabled={scale <= 0.7}
          className="p-2 rounded-xl hover:bg-white/10 active:scale-95 disabled:opacity-40 transition"
          title="Perkecil"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        <span className="text-[11px] font-mono px-2 text-slate-300 select-none">
          {Math.round(scale * 100)}%
        </span>

        <button
          type="button"
          onClick={handleZoomIn}
          disabled={scale >= 3}
          className="p-2 rounded-xl hover:bg-white/10 active:scale-95 disabled:opacity-40 transition"
          title="Perbesar"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        <div className="w-px h-4 bg-white/20 mx-0.5" />

        <button
          type="button"
          onClick={handleResetZoom}
          className="p-2 rounded-xl hover:bg-white/10 active:scale-95 transition"
          title="Reset Zoom"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {onAction && (
          <>
            <div className="w-px h-4 bg-white/20 mx-0.5" />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAction();
              }}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold text-xs transition flex items-center gap-1.5 shadow-md"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{actionLabel || 'Pilih Gambar'}</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};
