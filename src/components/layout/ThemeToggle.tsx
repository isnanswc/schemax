import React, { useState, useEffect } from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { ThemeMode, getStoredThemeMode, applyTheme, initThemeListener } from '../../services/themeService';

export const ThemeToggle: React.FC = () => {
  const [mode, setMode] = useState<ThemeMode>(getStoredThemeMode());

  useEffect(() => {
    // Initial sync
    applyTheme(mode);

    // Listen to OS system theme changes if in 'auto' mode
    const cleanup = initThemeListener(() => {
      setMode(getStoredThemeMode());
    });

    return cleanup;
  }, []);

  const cycleTheme = () => {
    let nextMode: ThemeMode = 'dark';
    if (mode === 'dark') nextMode = 'light';
    else if (mode === 'light') nextMode = 'auto';
    else if (mode === 'auto') nextMode = 'dark';

    setMode(nextMode);
    applyTheme(nextMode);
  };

  const getLabel = () => {
    switch (mode) {
      case 'dark':
        return 'Gelap';
      case 'light':
        return 'Terang';
      case 'auto':
        return 'Auto';
    }
  };

  const getIcon = () => {
    switch (mode) {
      case 'dark':
        return <Moon className="w-3.5 h-3.5 text-indigo-400 transition-transform duration-300 group-hover:rotate-12" />;
      case 'light':
        return <Sun className="w-3.5 h-3.5 text-amber-500 transition-transform duration-500 group-hover:rotate-90" />;
      case 'auto':
        return <Monitor className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 transition-transform duration-300 group-hover:scale-110" />;
    }
  };

  return (
    <button
      type="button"
      onClick={cycleTheme}
      className="group flex items-center gap-1.5 py-1.5 px-2 sm:px-2.5 rounded-xl bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-semibold active:scale-95 transition-all shadow-sm"
      title={`Tema: ${getLabel()} (Klik untuk mengganti: Gelap ➔ Terang ➔ Auto)`}
      aria-label="Ganti mode tema"
    >
      {getIcon()}
      <span className="text-[11px] font-medium hidden xs:inline">{getLabel()}</span>
    </button>
  );
};
