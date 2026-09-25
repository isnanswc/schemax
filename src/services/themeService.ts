export type ThemeMode = 'dark' | 'light' | 'auto';

const THEME_STORAGE_KEY = 'schemax_theme_mode';

export function getStoredThemeMode(): ThemeMode {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'auto') {
      return saved;
    }
  } catch (e) {
    // fallback if localStorage restricted
  }
  return 'dark';
}

export function applyTheme(mode: ThemeMode): boolean {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch (e) {
    // ignore
  }

  const root = document.documentElement;
  const isDark =
    mode === 'dark' ||
    (mode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  if (isDark) {
    root.classList.add('dark');
    root.classList.remove('light');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', '#030712');
  } else {
    root.classList.remove('dark');
    root.classList.add('light');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', '#f8fafc');
  }

  return isDark;
}

export function initThemeListener(onSystemThemeChange?: (isDark: boolean) => void) {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const listener = (e: MediaQueryListEvent) => {
    const currentMode = getStoredThemeMode();
    if (currentMode === 'auto') {
      const isDark = applyTheme('auto');
      if (onSystemThemeChange) onSystemThemeChange(isDark);
    }
  };

  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  } else if (mediaQuery.addListener) {
    // Legacy Safari / Android webview
    mediaQuery.addListener(listener);
    return () => mediaQuery.removeListener(listener);
  }
  return () => {};
}
