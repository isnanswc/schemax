/**
 * Auto-resize Textarea Utility
 * 
 * Provides automated height expansion for all textarea elements across the app:
 * 1. Leverages native CSS `field-sizing: content` on modern browsers (Chromium 123+)
 * 2. Implements a high-performance JavaScript fallback for browsers without native field-sizing
 * 3. Handles user typing, pasting, React state updates, and dynamic DOM mounting
 */

export function isFieldSizingSupported(): boolean {
  return typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('field-sizing', 'content');
}

/**
 * Recalculates and adjusts a textarea's height based on its scrollHeight
 */
export function adjustTextareaHeight(textarea: HTMLTextAreaElement | null) {
  if (!textarea || textarea.dataset.noAutoResize === 'true') return;

  // If the browser natively supports CSS field-sizing, let CSS engine handle it natively
  if (isFieldSizingSupported()) {
    return;
  }

  // Save window scroll to prevent any layout jumps
  const scrollY = window.scrollY;

  // Temporarily reset height to auto to compute the true scrollHeight
  textarea.style.height = 'auto';

  const computedStyle = window.getComputedStyle(textarea);
  const minHeight = parseFloat(computedStyle.minHeight) || 0;
  const maxHeight = computedStyle.maxHeight && computedStyle.maxHeight !== 'none'
    ? parseFloat(computedStyle.maxHeight)
    : Infinity;

  const targetHeight = Math.max(textarea.scrollHeight, minHeight);

  if (targetHeight >= maxHeight) {
    textarea.style.height = `${maxHeight}px`;
    textarea.style.overflowY = 'auto';
  } else {
    textarea.style.height = `${targetHeight}px`;
    textarea.style.overflowY = 'hidden';
  }

  // Restore scroll position
  if (window.scrollY !== scrollY) {
    window.scrollTo(window.scrollX, scrollY);
  }
}

/**
 * Initializes global event delegation and MutationObserver so that
 * any textarea added to the DOM automatically expands to match its content.
 */
export function initAutoResizeTextareas() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  // 1. Delegated listener for typing, pasting, cutting
  document.addEventListener(
    'input',
    (e) => {
      if (e.target instanceof HTMLTextAreaElement) {
        adjustTextareaHeight(e.target);
      }
    },
    { passive: true }
  );

  // 2. Adjust on focusin (in case value changed while invisible/unmounted)
  document.addEventListener(
    'focusin',
    (e) => {
      if (e.target instanceof HTMLTextAreaElement) {
        adjustTextareaHeight(e.target);
      }
    },
    { passive: true }
  );

  // 3. Fallback MutationObserver only needed if field-sizing is not supported
  if (!isFieldSizingSupported()) {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node instanceof HTMLTextAreaElement) {
              adjustTextareaHeight(node);
            } else if (node instanceof HTMLElement) {
              const textareas = node.querySelectorAll('textarea');
              textareas.forEach(adjustTextareaHeight);
            }
          });
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  // 4. Initial pass for any existing textareas on page load
  document.querySelectorAll('textarea').forEach((ta) => {
    adjustTextareaHeight(ta);
  });
}
