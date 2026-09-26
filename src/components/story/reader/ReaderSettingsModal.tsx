import React from 'react';
import {
  X,
  Type,
  Sun,
  Moon,
  AlignLeft,
  AlignJustify,
  Check,
  Eye,
  Sliders,
  Sparkles
} from 'lucide-react';

export type ReaderTheme = 'light' | 'sepia' | 'dark' | 'black';
export type ReaderFontFamily = 'serif' | 'sans' | 'mono';
export type ReaderLineHeight = 'tight' | 'normal' | 'relaxed' | 'loose';

export interface ReaderSettings {
  theme: ReaderTheme;
  fontFamily: ReaderFontFamily;
  fontSize: number; // 14 to 28 px
  lineHeight: ReaderLineHeight;
  textAlign: 'left' | 'justify';
  showTensionColors: boolean;
  showEmotionCues: boolean;
}

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  theme: 'sepia',
  fontFamily: 'serif',
  fontSize: 18,
  lineHeight: 'relaxed',
  textAlign: 'justify',
  showTensionColors: false,
  showEmotionCues: true,
};

interface ReaderSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ReaderSettings;
  onUpdateSettings: (newSettings: Partial<ReaderSettings>) => void;
}

export const ReaderSettingsModal: React.FC<ReaderSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  if (!isOpen) return null;

  const themes: Array<{ id: ReaderTheme; label: string; previewBg: string; previewText: string; border: string }> = [
    { id: 'light', label: 'Terang', previewBg: 'bg-white', previewText: 'text-slate-900', border: 'border-slate-300' },
    { id: 'sepia', label: 'Sepia (Kertas)', previewBg: 'bg-[#fbf0d9]', previewText: 'text-[#433422]', border: 'border-[#dfcca5]' },
    { id: 'dark', label: 'Gelap', previewBg: 'bg-slate-900', previewText: 'text-slate-100', border: 'border-slate-700' },
    { id: 'black', label: 'OLED Hitam', previewBg: 'bg-black', previewText: 'text-slate-200', border: 'border-slate-800' },
  ];

  const fonts: Array<{ id: ReaderFontFamily; label: string; preview: string; fontClass: string }> = [
    { id: 'serif', label: 'Serif (Sastra Klasik)', preview: 'Abc', fontClass: 'font-serif' },
    { id: 'sans', label: 'Sans-Serif (Modern)', preview: 'Abc', fontClass: 'font-sans' },
    { id: 'mono', label: 'Monospace (Mesin Tik)', preview: 'Abc', fontClass: 'font-mono' },
  ];

  const lineHeights: Array<{ id: ReaderLineHeight; label: string }> = [
    { id: 'tight', label: 'Rapat' },
    { id: 'normal', label: 'Normal' },
    { id: 'relaxed', label: 'Lega' },
    { id: 'loose', label: 'Sangat Lega' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl max-w-md w-full max-h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200 safe-bottom">
        {/* Mobile Swipe Handle */}
        <div className="w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-2.5 sm:hidden" />

        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Sliders className="w-4 h-4" />
            </span>
            <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
              Pengaturan Tampilan Baca
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs">
          {/* 1. Theme Color (Light, Sepia, Dark, OLED) */}
          <div className="space-y-2">
            <label className="font-bold text-slate-700 dark:text-slate-300 block">
              Warna Latar &amp; Tema:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {themes.map((t) => {
                const isSelected = settings.theme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onUpdateSettings({ theme: t.id })}
                    className={`p-2.5 rounded-2xl border transition text-center flex flex-col items-center gap-1.5 active:scale-95 ${t.previewBg} ${t.previewText} ${
                      isSelected ? 'ring-2 ring-amber-500 shadow-md font-bold' : `${t.border} opacity-80 hover:opacity-100`
                    }`}
                  >
                    <span className="text-xs font-serif font-black">Aa</span>
                    <span className="text-[10px] leading-tight truncate w-full">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Font Size */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
              <span className="font-bold">Ukuran Font:</span>
              <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400">
                {settings.fontSize}px
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onUpdateSettings({ fontSize: Math.max(14, settings.fontSize - 1) })}
                className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center active:scale-95"
                title="Perkecil Font"
              >
                A-
              </button>
              <input
                type="range"
                min={14}
                max={26}
                step={1}
                value={settings.fontSize}
                onChange={(e) => onUpdateSettings({ fontSize: Number(e.target.value) })}
                className="flex-1 accent-amber-500 cursor-pointer"
              />
              <button
                type="button"
                onClick={() => onUpdateSettings({ fontSize: Math.min(26, settings.fontSize + 1) })}
                className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-sm flex items-center justify-center active:scale-95"
                title="Perbesar Font"
              >
                A+
              </button>
            </div>
          </div>

          {/* 3. Font Family */}
          <div className="space-y-2">
            <label className="font-bold text-slate-700 dark:text-slate-300 block">
              Gaya Tulisan (Tipografi):
            </label>
            <div className="grid grid-cols-3 gap-2">
              {fonts.map((f) => {
                const isSelected = settings.fontFamily === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => onUpdateSettings({ fontFamily: f.id })}
                    className={`p-2.5 rounded-2xl border text-center transition flex flex-col items-center gap-1 active:scale-95 ${
                      isSelected
                        ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    <span className={`text-base ${f.fontClass}`}>Aa</span>
                    <span className="text-[10px] leading-tight truncate w-full">{f.label.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Line Spacing & Alignment */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                Jarak Antar Baris:
              </label>
              <div className="grid grid-cols-2 gap-1">
                {lineHeights.map((lh) => {
                  const isSel = settings.lineHeight === lh.id;
                  return (
                    <button
                      key={lh.id}
                      type="button"
                      onClick={() => onUpdateSettings({ lineHeight: lh.id })}
                      className={`py-1.5 px-2 rounded-xl text-[10px] font-bold border transition ${
                        isSel
                          ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {lh.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                Perataan Teks:
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ textAlign: 'justify' })}
                  className={`py-2 px-2.5 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-bold transition ${
                    settings.textAlign === 'justify'
                      ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <AlignJustify className="w-3.5 h-3.5" />
                  <span>Rata Kiri Kanan</span>
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ textAlign: 'left' })}
                  className={`py-2 px-2.5 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-bold transition ${
                    settings.textAlign === 'left'
                      ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <AlignLeft className="w-3.5 h-3.5" />
                  <span>Rata Kiri</span>
                </button>
              </div>
            </div>
          </div>

          {/* 5. Tension Color Accent Toggle */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
            <div>
              <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs">
                Tampilkan Aksen Tensi Cerita
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                Munculkan garis margin halus sesuai tensi adegan bab
              </span>
            </div>
            <button
              type="button"
              onClick={() => onUpdateSettings({ showTensionColors: !settings.showTensionColors })}
              className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                settings.showTensionColors ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  settings.showTensionColors ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* 6. Drama & Emotion Cues Toggle */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
            <div>
              <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs">
                Petunjuk Dialog & Emosi Suara
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                Tampilkan label pembicara & emosi akting dari Sutradara AI
              </span>
            </div>
            <button
              type="button"
              onClick={() => onUpdateSettings({ showEmotionCues: !settings.showEmotionCues })}
              className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                settings.showEmotionCues ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  settings.showEmotionCues ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto py-2.5 px-6 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs transition active:scale-95 shadow-sm"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
};
