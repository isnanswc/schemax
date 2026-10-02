import React from 'react';
import { LayoutDashboard, BookOpen, Sparkles } from 'lucide-react';

interface HomeBottomNavigationProps {
  currentView: 'dashboard' | 'works' | 'inspiration';
  onChangeView: (view: 'dashboard' | 'works' | 'inspiration') => void;
  worksCount: number;
}

export const HomeBottomNavigation: React.FC<HomeBottomNavigationProps> = ({
  currentView,
  onChangeView,
  worksCount,
}) => {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/80 dark:bg-slate-950/80 backdrop-blur-2xl border-t border-slate-200/80 dark:border-white/10 px-3 py-2 safe-bottom sm:max-w-md sm:mx-auto sm:rounded-t-2xl sm:border-x shadow-2xl transition-colors">
      <div className="grid grid-cols-3 gap-1.5">
        {/* Dashboard Tab */}
        <button
          type="button"
          onClick={() => onChangeView('dashboard')}
          className={`relative flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs sm:text-sm font-black transition-all active:scale-95 ${
            currentView === 'dashboard'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/25 ring-1 ring-amber-400/50'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.05]'
          }`}
        >
          <LayoutDashboard className={`w-4 h-4 ${currentView === 'dashboard' ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className="truncate">Dashboard</span>
        </button>

        {/* Works Tab */}
        <button
          type="button"
          onClick={() => onChangeView('works')}
          className={`relative flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs sm:text-sm font-black transition-all active:scale-95 ${
            currentView === 'works'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/25 ring-1 ring-amber-400/50'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.05]'
          }`}
        >
          <BookOpen className={`w-4 h-4 ${currentView === 'works' ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className="truncate">Works</span>
          <span
            className={`text-[10px] px-1 py-0.2 rounded-full font-mono font-bold ${
              currentView === 'works'
                ? 'bg-slate-950/20 text-slate-950'
                : 'bg-slate-200 dark:bg-white/[0.08] text-slate-700 dark:text-slate-300'
            }`}
          >
            {worksCount}
          </span>
        </button>

        {/* AI Inspiration Tab */}
        <button
          type="button"
          onClick={() => onChangeView('inspiration')}
          className={`relative flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs sm:text-sm font-black transition-all active:scale-95 ${
            currentView === 'inspiration'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/25 ring-1 ring-amber-400/50'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.05]'
          }`}
        >
          <Sparkles className={`w-4 h-4 ${currentView === 'inspiration' ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className="truncate">Inspirasi</span>
        </button>
      </div>
    </nav>
  );
};
