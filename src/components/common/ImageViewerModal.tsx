import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, Eye, EyeOff, Download, Check, Maximize2 } from 'lucide-react';
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

  // Zoom & Pan state
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isInteracting, setIsInteracting] = useState(false);
  const [isHoldingUnblur, setIsHoldingUnblur] = useState(false);

  // Gesture refs for zero-latency 60fps tracking
  const containerRef = useRef<HTMLDivElement>(null);
  const isPinchingRef = useRef(false);
  const initialPinchDistRef = useRef(0);
  const initialPinchScaleRef = useRef(1);
  const initialPinchMidRef = useRef({ x: 0, y: 0 });

  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });

  const lastTapTimeRef = useRef(0);
  const holdTimerRef = useRef<any>(null);

  // Reset state when modal opens or closes
  useEffect(() => {
    if (!isOpen) return;
    navStack.push('modal-image-viewer', onClose);
    setScale(1);
    setPan({ x: 0, y: 0 });
    setIsHoldingUnblur(false);
    setIsInteracting(false);

    return () => {
      navStack.pop('modal-image-viewer');
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    };
  }, [isOpen]);

  // Reset pan when scale resets to 1
  const handleResetZoom = useCallback((e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setScale(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const handleZoomIn = (e: React.MouseEvent) => {
    e.stopPropagation();
    setScale((prev) => Math.min(prev + 0.4, 6));
  };

  const handleZoomOut = (e: React.MouseEvent) => {
    e.stopPropagation();
    setScale((prev) => {
      const next = Math.max(prev - 0.4, 0.8);
      if (next <= 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };

  // Double tap / double click to toggle 1x and 2.5x zoom
  const handleDoubleTap = (clientX: number, clientY: number) => {
    if (scale > 1.2) {
      setScale(1);
      setPan({ x: 0, y: 0 });
    } else {
      setScale(2.5);
      // Center zoom towards tap location
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const offsetX = (centerX - (clientX - rect.left)) * 0.8;
        const offsetY = (centerY - (clientY - rect.top)) * 0.8;
        setPan({ x: offsetX, y: offsetY });
      }
    }
  };

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const zoomFactor = e.deltaY < 0 ? 1.2 : 0.83;
    setScale((prev) => {
      const next = Math.min(Math.max(prev * zoomFactor, 0.8), 6);
      if (next <= 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };

  // Mouse drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    const now = Date.now();
    if (now - lastTapTimeRef.current < 280) {
      handleDoubleTap(e.clientX, e.clientY);
      lastTapTimeRef.current = 0;
      return;
    }
    lastTapTimeRef.current = now;

    isDraggingRef.current = true;
    setIsInteracting(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { ...pan };

    if (settings.privacyMode && settings.blurImages) {
      setIsHoldingUnblur(true);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPan({
      x: panStartRef.current.x + dx,
      y: panStartRef.current.y + dy,
    });
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    setIsInteracting(false);
    if (scale <= 1) {
      setPan({ x: 0, y: 0 });
    }
    if (settings.privacyMode && settings.blurImages) {
      setIsHoldingUnblur(false);
    }
  };

  // Touch gesture handlers (1 finger pan, 2 fingers pinch)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // 2-finger pinch
      isPinchingRef.current = true;
      isDraggingRef.current = false;
      setIsInteracting(true);

      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);

      initialPinchDistRef.current = dist;
      initialPinchScaleRef.current = scale;
      initialPinchMidRef.current = {
        x: (t1.clientX + t2.clientX) / 2,
        y: (t1.clientY + t2.clientY) / 2,
      };
      panStartRef.current = { ...pan };
    } else if (e.touches.length === 1) {
      // 1-finger drag or tap
      const t = e.touches[0];
      const now = Date.now();
      if (now - lastTapTimeRef.current < 300) {
        handleDoubleTap(t.clientX, t.clientY);
        lastTapTimeRef.current = 0;
        return;
      }
      lastTapTimeRef.current = now;

      isDraggingRef.current = true;
      isPinchingRef.current = false;
      setIsInteracting(true);
      dragStartRef.current = { x: t.clientX, y: t.clientY };
      panStartRef.current = { ...pan };

      if (settings.privacyMode && settings.blurImages) {
        setIsHoldingUnblur(true);
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isPinchingRef.current && e.touches.length === 2) {
      // Handle pinch zoom
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);

      if (initialPinchDistRef.current > 0) {
        const factor = dist / initialPinchDistRef.current;
        const newScale = Math.min(Math.max(initialPinchScaleRef.current * factor, 0.8), 6);
        setScale(newScale);

        // Adjust pan based on midpoint shift
        const midX = (t1.clientX + t2.clientX) / 2;
        const midY = (t1.clientY + t2.clientY) / 2;
        const dx = midX - initialPinchMidRef.current.x;
        const dy = midY - initialPinchMidRef.current.y;
        setPan({
          x: panStartRef.current.x + dx,
          y: panStartRef.current.y + dy,
        });
      }
    } else if (isDraggingRef.current && e.touches.length === 1) {
      // Handle 1-finger pan
      const t = e.touches[0];
      const dx = t.clientX - dragStartRef.current.x;
      const dy = t.clientY - dragStartRef.current.y;
      setPan({
        x: panStartRef.current.x + dx,
        y: panStartRef.current.y + dy,
      });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length === 0) {
      isDraggingRef.current = false;
      isPinchingRef.current = false;
      setIsInteracting(false);

      if (scale < 1) {
        setScale(1);
        setPan({ x: 0, y: 0 });
      }

      if (settings.privacyMode && settings.blurImages) {
        setIsHoldingUnblur(false);
      }
    } else if (e.touches.length === 1) {
      // Switched from pinch to single finger
      isPinchingRef.current = false;
      isDraggingRef.current = true;
      const t = e.touches[0];
      dragStartRef.current = { x: t.clientX, y: t.clientY };
      panStartRef.current = { ...pan };
    }
  };

  if (!isOpen || !imageUrl) return null;

  const isPrivacyBlur = settings.privacyMode && settings.blurImages && !isHoldingUnblur;

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = (title ? title.toLowerCase().replace(/[^a-z0-9]/g, '_') : 'image') + '.jpg';
    a.click();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md animate-in fade-in duration-200 select-none overflow-hidden touch-none"
      onClick={onClose}
    >
      {/* Top Bar with Title, Actions & Close */}
      <div
        className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between p-3 sm:p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent text-white pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0 pr-4">
          {title && (
            <h3 className="text-sm sm:text-base font-bold text-white truncate drop-shadow-md">
              {title}
            </h3>
          )}
          {subtitle ? (
            <p className="text-[11px] text-slate-300 truncate drop-shadow-sm">
              {subtitle}
            </p>
          ) : (
            <p className="text-[10px] text-slate-400">
              Cubit untuk zoom • Geser untuk jelajahi detail
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

      {/* Main Interactive Zoomable/Pannable Viewport */}
      <div
        ref={containerRef}
        className={`relative w-full h-full flex items-center justify-center overflow-hidden p-2 sm:p-6 ${
          scale > 1
            ? isInteracting
              ? 'cursor-grabbing'
              : 'cursor-grab'
            : 'cursor-default'
        }`}
        onClick={(e) => e.stopPropagation()}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        style={{ touchAction: 'none' }}
      >
        <img
          src={imageUrl}
          alt={title || 'Pratinjau Gambar'}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: 'center center',
          }}
          className={`max-w-[94vw] max-h-[82vh] object-contain rounded-2xl shadow-2xl pointer-events-none select-none ${
            isInteracting ? 'transition-none' : 'transition-transform duration-200 ease-out'
          } ${isPrivacyBlur ? 'filter blur-2xl scale-105 brightness-75' : 'filter blur-0'}`}
          draggable={false}
        />

        {/* Privacy Hold Indicator Banner */}
        {settings.privacyMode && settings.blurImages && (
          <div
            className={`absolute bottom-20 sm:bottom-24 px-4 py-2 rounded-2xl backdrop-blur-md border text-xs font-bold transition-all duration-300 flex items-center gap-2 pointer-events-none shadow-xl z-20 ${
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
                <span>Tahan layar untuk melihat tanpa blur</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Bottom Floating Control Bar */}
      <div
        className="absolute bottom-4 sm:bottom-6 z-30 flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-900/90 backdrop-blur-xl border border-white/15 text-white shadow-2xl pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleZoomOut}
          disabled={scale <= 0.8}
          className="p-2 rounded-xl hover:bg-white/10 active:scale-95 disabled:opacity-40 transition text-slate-300 hover:text-white"
          title="Perkecil (-)"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        <span className="text-[11px] font-mono font-bold px-2 text-amber-400 min-w-[50px] text-center select-none">
          {Math.round(scale * 100)}%
        </span>

        <button
          type="button"
          onClick={handleZoomIn}
          disabled={scale >= 6}
          className="p-2 rounded-xl hover:bg-white/10 active:scale-95 disabled:opacity-40 transition text-slate-300 hover:text-white"
          title="Perbesar (+)"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        <div className="w-px h-4 bg-white/20 mx-0.5" />

        <button
          type="button"
          onClick={handleResetZoom}
          className="p-2 rounded-xl hover:bg-white/10 active:scale-95 transition text-cyan-400"
          title="Reset Ukuran (Fit to Screen)"
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
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 active:scale-95 text-slate-950 font-bold text-xs transition flex items-center gap-1.5 shadow-md"
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
