import React from 'react';
import { ArrowLeft, BookOpen, MoreVertical, Shield } from 'lucide-react';
import { Book } from '../../types';
import { usePrivacy } from '../../contexts/PrivacyContext';
import { SchemaxLogo } from '../common/SchemaxLogo';

interface MobileHeaderProps {
  currentBook?: Book | null;
  onBack?: () => void;
  onOpenCornerMenu: () => void;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  currentBook,
  onBack,
  onOpenCornerMenu,
}) => {
  const { settings, getBlurTitleClass } = usePrivacy();

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
            <SchemaxLogo size={36} variant="badge" />
          )}

          <div className="min-w-0">
            {currentBook ? (
              <div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <h1 className={`text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate max-w-[170px] sm:max-w-md ${getBlurTitleClass()}`}>
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
                  <span className="text-[9px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
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

        {/* Right: Corner Menu Button */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={onOpenCornerMenu}
            className="flex items-center gap-1.5 py-1.5 px-2.5 sm:px-3 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900/90 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold active:scale-95 transition shadow-sm"
            title="Menu Pojok (Privasi, Multi-AI, Tema & Penyimpanan)"
          >
            {settings.privacyMode && (
              <span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/20">
                <Shield className="w-3 h-3" />
                <span className="hidden sm:inline">Privasi</span>
              </span>
            )}
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <MoreVertical className="w-4 h-4 text-slate-600 dark:text-slate-300" />
          </button>
        </div>
      </div>
    </header>
  );
};
