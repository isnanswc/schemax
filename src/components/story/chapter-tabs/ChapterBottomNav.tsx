import React from 'react';
import {
  FileText,
  FileEdit,
  Feather,
  Compass,
  GitBranch,
  Sparkles
} from 'lucide-react';

export type ChapterActiveTab = 'info' | 'raw' | 'manuscript' | 'glossary' | 'plot';

interface ChapterBottomNavProps {
  activeTab: ChapterActiveTab;
  onChangeTab: (tab: ChapterActiveTab) => void;
  rawDraftCount?: number;
  glossaryCount?: number;
  hasAiPlot?: boolean;
}

export const ChapterBottomNav: React.FC<ChapterBottomNavProps> = ({
  activeTab,
  onChangeTab,
  rawDraftCount = 0,
  glossaryCount = 0,
  hasAiPlot = false,
}) => {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800/80 px-2 py-1 safe-bottom shadow-lg transition-colors duration-200">
      <div className="max-w-md mx-auto grid grid-cols-5 items-end justify-items-center h-14">
        {/* 1. Chapter Information (Kiri 1) */}
        <button
          type="button"
          onClick={() => onChangeTab('info')}
          className={`flex flex-col items-center justify-center w-full py-1 rounded-xl transition-all duration-200 active:scale-95 ${
            activeTab === 'info'
              ? 'text-amber-600 dark:text-amber-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
          title="Chapter Information (Premis, Target & Info Bab)"
        >
          <div className="relative">
            <FileText className={`w-5 h-5 ${activeTab === 'info' ? 'stroke-[2.5]' : 'stroke-2'}`} />
            {activeTab === 'info' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-amber-500" />
            )}
          </div>
          <span className="text-[9px] mt-1 tracking-tight truncate max-w-full">
            Info Bab
          </span>
        </button>

        {/* 2. Tulisan Kasar (Kiri 2) */}
        <button
          type="button"
          onClick={() => onChangeTab('raw')}
          className={`flex flex-col items-center justify-center w-full py-1 rounded-xl transition-all duration-200 active:scale-95 ${
            activeTab === 'raw'
              ? 'text-amber-600 dark:text-amber-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
          title="Tulisan Kasar (Draf Coretan & Ide Mentah)"
        >
          <div className="relative">
            <FileEdit className={`w-5 h-5 ${activeTab === 'raw' ? 'stroke-[2.5]' : 'stroke-2'}`} />
            {rawDraftCount > 0 && (
              <span className="absolute -top-1 -right-2 px-1 min-w-[13px] text-[8px] font-black rounded-full bg-indigo-500 text-white flex items-center justify-center">
                {rawDraftCount}
              </span>
            )}
            {activeTab === 'raw' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-amber-500" />
            )}
          </div>
          <span className="text-[9px] mt-1 tracking-tight truncate max-w-full">
            Draf Kasar
          </span>
        </button>

        {/* 3. DI TENGAH: ICON BESAR PENA MENULIS (Naskah Utama) */}
        <div className="flex flex-col items-center justify-center -mt-5">
          <button
            type="button"
            onClick={() => onChangeTab('manuscript')}
            className={`w-13 h-13 p-3 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 active:scale-90 ${
              activeTab === 'manuscript'
                ? 'bg-gradient-to-tr from-amber-500 to-amber-600 text-slate-950 shadow-amber-500/40 ring-4 ring-amber-400/25 scale-105'
                : 'bg-gradient-to-tr from-slate-800 to-slate-900 dark:from-slate-800 dark:to-slate-700 text-amber-400 hover:scale-105 border border-slate-700 shadow-black/40'
            }`}
            title="Naskah Utama (Editor Penulisan Cerita Penuh)"
            aria-label="Buka Naskah Utama"
          >
            <Feather className="w-6 h-6 stroke-[2.4]" />
          </button>
          <span
            className={`text-[9px] mt-1 font-extrabold tracking-tight truncate ${
              activeTab === 'manuscript'
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Naskah Utama
          </span>
        </div>

        {/* 4. Glosarium (Kanan 1) */}
        <button
          type="button"
          onClick={() => onChangeTab('glossary')}
          className={`flex flex-col items-center justify-center w-full py-1 rounded-xl transition-all duration-200 active:scale-95 ${
            activeTab === 'glossary'
              ? 'text-amber-600 dark:text-amber-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
          title="Glosarium Bab (Karakter, Latar, Item, Auto Scene & Visual)"
        >
          <div className="relative">
            <Compass className={`w-5 h-5 ${activeTab === 'glossary' ? 'stroke-[2.5]' : 'stroke-2'}`} />
            {glossaryCount > 0 && (
              <span className="absolute -top-1 -right-2 px-1 min-w-[13px] text-[8px] font-black rounded-full bg-amber-500 text-slate-950 flex items-center justify-center">
                {glossaryCount}
              </span>
            )}
            {activeTab === 'glossary' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-amber-500" />
            )}
          </div>
          <span className="text-[9px] mt-1 tracking-tight truncate max-w-full">
            Glosarium
          </span>
        </button>

        {/* 5. Ringkasan & Auto Plot + Cabang (Kanan 2) */}
        <button
          type="button"
          onClick={() => onChangeTab('plot')}
          className={`flex flex-col items-center justify-center w-full py-1 rounded-xl transition-all duration-200 active:scale-95 ${
            activeTab === 'plot'
              ? 'text-amber-600 dark:text-amber-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
          title="Ringkasan, Auto Plot & Rekomendasi Cabang Bab Selanjutnya"
        >
          <div className="relative">
            <GitBranch className={`w-5 h-5 ${activeTab === 'plot' ? 'stroke-[2.5]' : 'stroke-2'}`} />
            {hasAiPlot && (
              <span className="absolute -top-1 -right-2 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
            {activeTab === 'plot' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-amber-500" />
            )}
          </div>
          <span className="text-[9px] mt-1 tracking-tight truncate max-w-full">
            Ringkasan & Plot
          </span>
        </button>
      </div>
    </nav>
  );
};
