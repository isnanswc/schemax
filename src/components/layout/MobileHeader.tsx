import React from 'react';
import { ArrowLeft, BookOpen, Database, Sparkles, HardDrive } from 'lucide-react';
import { Book } from '../../types';

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
    <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-slate-950/85 border-b border-slate-800/80 px-4 py-3 safe-top transition-all">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        {/* Left: Back button or App Logo */}
        <div className="flex items-center gap-3 min-w-0">
          {currentBook ? (
            <button
              onClick={onBack}
              className="p-2 -ml-1 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white active:scale-95 transition"
              aria-label="Kembali ke Beranda"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          ) : (
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20">
              <BookOpen className="w-5 h-5" />
            </div>
          )}

          <div className="min-w-0">
            {currentBook ? (
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-sm font-bold text-white truncate max-w-[200px] sm:max-w-md">
                    {currentBook.title}
                  </h1>
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${
                      currentBook.status === 'released' ? 'bg-emerald-400' : 'bg-amber-400'
                    }`}
                  />
                </div>
                <p className="text-[11px] text-slate-400 truncate">
                  {currentBook.genre || 'Cerita Lokal'} • {currentBook.status === 'released' ? 'Rilis' : 'Draf'}
                </p>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className="text-base font-extrabold text-white tracking-tight">
                    Schemax
                  </h1>
                  <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Studio
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-medium">
                  Client-Side Story & Lore Engine
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right: AI Settings & IndexedDB Sync Buttons */}
        <div className="flex items-center gap-2">
          {/* AI Settings Button */}
          <button
            type="button"
            onClick={onOpenAISettings}
            className="flex items-center gap-1.5 py-1.5 px-2.5 rounded-xl bg-gradient-to-r from-amber-500/10 to-indigo-500/10 border border-amber-500/30 hover:border-amber-400 text-amber-300 text-xs font-bold active:scale-95 transition shadow-sm"
            title="Pengaturan Multi-AI (Gemini & Groq Fallback)"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">AI Config</span>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          </button>

          <button
            onClick={onOpenSyncModal}
            className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-medium active:scale-95 transition shadow-sm"
            title="Penyimpanan IndexedDB & Sinkronisasi"
          >
            <HardDrive className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">IndexedDB</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </button>
        </div>
      </div>
    </header>
  );
};
