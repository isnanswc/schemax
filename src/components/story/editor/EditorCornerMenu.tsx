import React from 'react';
import {
  X,
  Save,
  CheckCircle2,
  Sparkles,
  SlidersHorizontal,
  Maximize2,
  Minimize2,
  Type,
  FileText,
  Clock,
  Layers,
  Settings,
  Sun,
  Moon,
  Monitor
} from 'lucide-react';
import { ChapterStatus } from '../../../types';
import { ThemeMode, getStoredThemeMode, applyTheme } from '../../../services/themeService';

interface EditorCornerMenuProps {
  isOpen: boolean;
  onClose: () => void;
  status: ChapterStatus;
  onChangeStatus: (status: ChapterStatus) => void;
  isSaved: boolean;
  onSaveManual: () => void;
  isFocusMode: boolean;
  onToggleFocusMode: () => void;
  fontStyle: 'sans' | 'serif' | 'mono';
  onChangeFontStyle: (style: 'sans' | 'serif' | 'mono') => void;
  fontSize: 'sm' | 'base' | 'lg';
  onChangeFontSize: (size: 'sm' | 'base' | 'lg') => void;
  onOpenAIAssistant: () => void;
  onOpenAISettings: () => void;
  onNavigateToTab: (tab: 'info' | 'raw' | 'glossary' | 'plot') => void;
}

export const EditorCornerMenu: React.FC<EditorCornerMenuProps> = ({
  isOpen,
  onClose,
  status,
  onChangeStatus,
  isSaved,
  onSaveManual,
  isFocusMode,
  onToggleFocusMode,
  fontStyle,
  onChangeFontStyle,
  fontSize,
  onChangeFontSize,
  onOpenAIAssistant,
  onOpenAISettings,
  onNavigateToTab,
}) => {
  const [currentTheme, setCurrentTheme] = React.useState<ThemeMode>(getStoredThemeMode());

  if (!isOpen) return null;

  const cycleTheme = () => {
    let next: ThemeMode = 'dark';
    if (currentTheme === 'dark') next = 'light';
    else if (currentTheme === 'light') next = 'auto';
    else if (currentTheme === 'auto') next = 'dark';
    setCurrentTheme(next);
    applyTheme(next);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex justify-end animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-80 max-w-[85vw] h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl p-5 flex flex-col justify-between overflow-y-auto animate-slide-in-right"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-amber-500/15 text-amber-500 font-bold">
                <SlidersHorizontal className="w-4 h-4" />
              </span>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Menu Naskah Bab
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 1. Status Bab */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Status Bab
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: 'planned', label: 'Rencana', color: 'purple' },
                  { id: 'in_progress', label: 'Ditulis', color: 'amber' },
                  { id: 'completed', label: 'Selesai', color: 'emerald' },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onChangeStatus(item.id)}
                  className={`py-2 px-1 rounded-xl text-xs font-bold transition text-center active:scale-95 ${
                    status === item.id
                      ? item.id === 'planned'
                        ? 'bg-purple-600 text-white shadow-sm'
                        : item.id === 'in_progress'
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Manual Save & Auto-save Status */}
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  isSaved ? 'bg-emerald-500' : 'bg-amber-500 animate-ping'
                }`}
              />
              <span className="text-xs text-slate-700 dark:text-slate-300 font-semibold">
                {isSaved ? 'Tersimpan di IndexedDB' : 'Menyimpan...'}
              </span>
            </div>
            <button
              type="button"
              onClick={onSaveManual}
              className="py-1 px-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white hover:bg-slate-50 shadow-xs transition active:scale-95 flex items-center gap-1"
            >
              <Save className="w-3 h-3 text-amber-500" />
              <span>Simpan</span>
            </button>
          </div>

          {/* 3. Gaya & Ukuran Huruf */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Type className="w-3.5 h-3.5" />
              <span>Gaya Huruf Naskah</span>
            </label>

            {/* Font Family */}
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: 'serif', label: 'Serif (Buku)' },
                  { id: 'sans', label: 'Sans (Modern)' },
                  { id: 'mono', label: 'Monospace' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onChangeFontStyle(f.id)}
                  className={`py-1.5 px-1 rounded-xl text-xs font-bold transition text-center active:scale-95 ${
                    fontStyle === f.id
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Font Size */}
            <div className="grid grid-cols-3 gap-1.5 pt-1">
              {(
                [
                  { id: 'sm', label: 'Kecil' },
                  { id: 'base', label: 'Normal' },
                  { id: 'lg', label: 'Besar' },
                ] as const
              ).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onChangeFontSize(s.id)}
                  className={`py-1 px-1 rounded-xl text-xs font-semibold transition text-center active:scale-95 ${
                    fontSize === s.id
                      ? 'bg-slate-900 dark:bg-slate-700 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* 4. Tampilan & Mode */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Tampilan & Mode
            </label>

            {/* Focus Mode */}
            <button
              type="button"
              onClick={onToggleFocusMode}
              className={`w-full py-2.5 px-3 rounded-2xl border text-xs font-bold transition flex items-center justify-between active:scale-95 ${
                isFocusMode
                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-400'
                  : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                {isFocusMode ? (
                  <Minimize2 className="w-4 h-4 text-amber-500" />
                ) : (
                  <Maximize2 className="w-4 h-4 text-slate-500" />
                )}
                <span>Mode Fokus Menulis</span>
              </div>
              <span className="text-[10px] font-bold">
                {isFocusMode ? 'Aktif' : 'Nonaktif'}
              </span>
            </button>

            {/* Theme Switcher */}
            <button
              type="button"
              onClick={cycleTheme}
              className="w-full py-2.5 px-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition flex items-center justify-between active:scale-95"
            >
              <div className="flex items-center gap-2">
                {currentTheme === 'dark' ? (
                  <Moon className="w-4 h-4 text-indigo-400" />
                ) : currentTheme === 'light' ? (
                  <Sun className="w-4 h-4 text-amber-500" />
                ) : (
                  <Monitor className="w-4 h-4 text-cyan-400" />
                )}
                <span>Tema Tampilan</span>
              </div>
              <span className="text-[10px] font-bold capitalize">
                {currentTheme}
              </span>
            </button>
          </div>

          {/* 5. AI Writing Suite */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              AI Penulisan
            </label>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenAIAssistant();
              }}
              className="w-full py-2.5 px-3 rounded-2xl bg-gradient-to-r from-amber-500/15 via-indigo-500/15 to-purple-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs font-bold transition flex items-center justify-between active:scale-95 shadow-xs"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>AI Writing Co-Pilot</span>
              </div>
              <span className="text-[10px] bg-amber-500/20 px-2 py-0.5 rounded-full font-bold">
                Buka
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenAISettings();
              }}
              className="w-full py-2 px-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition flex items-center justify-between active:scale-95"
            >
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-slate-500" />
                <span>Pengaturan Multi-AI</span>
              </div>
              <span className="text-[10px] text-slate-400">Gemini/Groq</span>
            </button>
          </div>

          {/* 6. Navigasi Cepat Bab */}
          <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Lompat ke Tab Bab
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigateToTab('info');
                }}
                className="py-2 px-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold text-left hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                📋 Chapter Info
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigateToTab('raw');
                }}
                className="py-2 px-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold text-left hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                📝 Tulisan Kasar
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigateToTab('glossary');
                }}
                className="py-2 px-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold text-left hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                🧭 Glosarium
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigateToTab('plot');
                }}
                className="py-2 px-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold text-left hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                🌿 Ringkasan & Plot
              </button>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
          <p className="text-[10px] text-slate-400">
            Schemax Story Studio • Auto-Save Aktif
          </p>
        </div>
      </div>
    </div>
  );
};
