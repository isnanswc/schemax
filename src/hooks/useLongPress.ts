import { useRef, useCallback } from 'react';

interface UseLongPressOptions {
  threshold?: number; // ms to trigger long press (default: 450ms)
  moveTolerance?: number; // px movement before cancelling tap/long-press (default: 8px)
  pressDelay?: number; // ms before visual press state begins (default: 60ms)
  onStart?: () => void;
  onFinish?: () => void;
  onCancel?: () => void;
}

export function useLongPress(
  onLongPress: (e: any) => void,
  onClick?: (e: any) => void,
  {
    threshold = 450,
    moveTolerance = 8,
    pressDelay = 60,
    onStart,
    onFinish,
    onCancel,
  }: UseLongPressOptions = {}
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);
  const isMovedRef = useRef(false);
  const startCoordsRef = useRef<{ x: number; y: number } | null>(null);
  const suppressSyntheticClickUntilRef = useRef(0);

  const clearAllTimers = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (pressDelayTimerRef.current) {
      clearTimeout(pressDelayTimerRef.current);
      pressDelayTimerRef.current = null;
    }
  }, []);

  const handleStart = useCallback(
    (clientX: number, clientY: number, e: React.TouchEvent | React.MouseEvent, isTouch: boolean) => {
      clearAllTimers();
      isLongPressRef.current = false;
      isMovedRef.current = false;
      startCoordsRef.current = { x: clientX, y: clientY };

      if (isTouch) {
        suppressSyntheticClickUntilRef.current = Date.now() + 600;
      }

      // Small delay before showing visual press state so rapid scrolls do not cause jitter
      pressDelayTimerRef.current = setTimeout(() => {
        if (!isMovedRef.current) {
          onStart?.();
        }
      }, pressDelay);

      timerRef.current = setTimeout(() => {
        if (isMovedRef.current) return;
        isLongPressRef.current = true;

        // Subtle tactile vibration for mobile feel
        if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
          try {
            navigator.vibrate(35);
          } catch (_) {}
        }
        onLongPress(e);
        onFinish?.();
      }, threshold);
    },
    [clearAllTimers, onLongPress, threshold, pressDelay, onStart, onFinish]
  );

  const handleMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!startCoordsRef.current) return;
      const diffX = Math.abs(clientX - startCoordsRef.current.x);
      const diffY = Math.abs(clientY - startCoordsRef.current.y);

      // If finger or pointer moved beyond tolerance, it's a scroll/drag
      if (diffX > moveTolerance || diffY > moveTolerance) {
        isMovedRef.current = true;
        clearAllTimers();
        onCancel?.();
      }
    },
    [clearAllTimers, moveTolerance, onCancel]
  );

  const handleEnd = useCallback(
    (e: React.TouchEvent | React.MouseEvent, shouldTriggerClick = true) => {
      clearAllTimers();

      const wasLongPress = isLongPressRef.current;
      const wasMoved = isMovedRef.current;

      startCoordsRef.current = null;
      isLongPressRef.current = false;
      isMovedRef.current = false;

      // Always clear active visual pressing state
      onCancel?.();

      // If user moved/scrolled or long-press fired, NEVER trigger click
      if (wasMoved || wasLongPress) {
        return;
      }

      // Valid tap / click
      if (shouldTriggerClick && onClick) {
        onClick(e);
      }
    },
    [clearAllTimers, onClick, onCancel]
  );

  return {
    onMouseDown: (e: React.MouseEvent) => {
      if (Date.now() < suppressSyntheticClickUntilRef.current) return;
      if (e.button !== 0) return;
      handleStart(e.clientX, e.clientY, e, false);
    },
    onMouseMove: (e: React.MouseEvent) => {
      if (Date.now() < suppressSyntheticClickUntilRef.current) return;
      handleMove(e.clientX, e.clientY);
    },
    onMouseUp: (e: React.MouseEvent) => {
      if (Date.now() < suppressSyntheticClickUntilRef.current) return;
      if (e.button !== 0) return;
      handleEnd(e, true);
      suppressSyntheticClickUntilRef.current = Date.now() + 500;
    },
    onMouseLeave: (e: React.MouseEvent) => {
      if (Date.now() < suppressSyntheticClickUntilRef.current) return;
      clearAllTimers();
      startCoordsRef.current = null;
      isMovedRef.current = false;
      isLongPressRef.current = false;
      onCancel?.();
    },

    onTouchStart: (e: React.TouchEvent) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        handleStart(touch.clientX, touch.clientY, e, true);
      }
    },
    onTouchMove: (e: React.TouchEvent) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        handleMove(touch.clientX, touch.clientY);
      }
    },
    onTouchEnd: (e: React.TouchEvent) => {
      suppressSyntheticClickUntilRef.current = Date.now() + 600;
      handleEnd(e, true);
    },
    onTouchCancel: () => {
      clearAllTimers();
      startCoordsRef.current = null;
      isMovedRef.current = false;
      isLongPressRef.current = false;
      onCancel?.();
    },

    onClick: (e: React.MouseEvent) => {
      if (Date.now() < suppressSyntheticClickUntilRef.current) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
  };
}
