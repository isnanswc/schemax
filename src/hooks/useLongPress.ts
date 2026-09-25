import { useRef, useCallback } from 'react';

interface UseLongPressOptions {
  threshold?: number; // ms to trigger long press (default: 420ms)
  onStart?: () => void;
  onFinish?: () => void;
  onCancel?: () => void;
}

export function useLongPress(
  onLongPress: (e: any) => void,
  onClick?: (e: any) => void,
  { threshold = 420, onStart, onFinish, onCancel }: UseLongPressOptions = {}
) {
  const timerRef = useRef<any>(null);
  const isLongPressRef = useRef(false);
  const startCoordsRef = useRef<{ x: number; y: number } | null>(null);

  const start = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      isLongPressRef.current = false;
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
      startCoordsRef.current = { x: clientX, y: clientY };

      onStart?.();

      timerRef.current = setTimeout(() => {
        isLongPressRef.current = true;
        // Subtle haptic vibration for mobile tactile feel
        if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
          try {
            navigator.vibrate(30);
          } catch (_) {}
        }
        onLongPress(e);
        onFinish?.();
      }, threshold);
    },
    [onLongPress, threshold, onStart, onFinish]
  );

  const move = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!startCoordsRef.current) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    // If finger moves more than 10px, cancel long-press (user is scrolling)
    const diffX = Math.abs(clientX - startCoordsRef.current.x);
    const diffY = Math.abs(clientY - startCoordsRef.current.y);

    if (diffX > 10 || diffY > 10) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      onCancel?.();
    }
  }, [onCancel]);

  const clear = useCallback(
    (e: React.TouchEvent | React.MouseEvent, shouldTriggerClick = true) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      if (shouldTriggerClick && !isLongPressRef.current && onClick) {
        onClick(e);
      }

      startCoordsRef.current = null;
      isLongPressRef.current = false;
    },
    [onClick]
  );

  return {
    onMouseDown: (e: React.MouseEvent) => start(e),
    onTouchStart: (e: React.TouchEvent) => start(e),
    onMouseUp: (e: React.MouseEvent) => clear(e, true),
    onTouchEnd: (e: React.TouchEvent) => clear(e, true),
    onMouseMove: (e: React.MouseEvent) => move(e),
    onTouchMove: (e: React.TouchEvent) => move(e),
    onMouseLeave: (e: React.MouseEvent) => clear(e, false),
  };
}
