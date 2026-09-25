import React from 'react';
import { ArrowLeft, BookOpen, Database, Sparkles, HardDrive } from 'lucide-react';
import { Book } from '../../types';
import { ThemeToggle } from './ThemeToggle';

interface MobileHeaderProps {
  currentBook?: Book | null;
  onBack?: () => void;
  onOpenSyncModal: () => void;
  onOpenAISettings: () => void;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  currentBook,
  onBack,
  onOpenSyncModal,
  onOpenAISettings,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-white/90 dark:bg-slate-950/85 border-b border-slate-200/90 dark:border-slate-800/80 px-3 sm:px-4 py-2.5 sm:py-3 safe-top transition-all">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        {/* Left: Back button or App Logo */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          {currentBook ? (
            <button
              onClick={onBack}
              className="p-2 -ml-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white active:scale-95 transition shadow-sm"
              aria-label="Kembali ke Beranda"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          ) : (
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 font-black shadow-md shadow-amber-500/20 flex-shrink-0">
              <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          )}

          <div className="min-w-0">
            {currentBook ? (
              <div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <h1 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate max-w-[170px] sm:max-w-md">
                    {currentBook.title}
                  </h1>
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${
                      currentBook.status === 'released' ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                  />
                </div>
                <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {currentBook.genre || 'Cerita Lokal'} • {currentBook.status === 'released' ? 'Published' : 'Draft'}
                </p>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                    Schemax
                  </h1>
                  <span className="text-[9px] uppercase font-bold tracking-widest px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                    Studio
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                  Story & Lore Engine
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right: AI Settings, IndexedDB, and Theme Toggle Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Theme Toggle (Dark/Light/Auto) */}
          <ThemeToggle />

          {/* AI Settings Button */}
          <button
            type="button"
            onClick={onOpenAISettings}
            className="flex items-center gap-1.5 py-1.5 px-2 sm:px-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 hover:border-amber-400 text-amber-800 dark:text-amber-300 text-xs font-bold active:scale-95 transition shadow-sm"
            title="Pengaturan Multi-AI (Gemini & Groq Fallback)"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">AI Config</span>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          </button>

          <button
            onClick={onOpenSyncModal}
            className="flex items-center gap-1.5 py-1.5 px-2 sm:px-3 rounded-xl bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium active:scale-95 transition shadow-sm"
            title="Penyimpanan IndexedDB & Sinkronisasi"
          >
            <HardDrive className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">IndexedDB</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </button>
        </div>
      </div>
    </header>
  );
};
