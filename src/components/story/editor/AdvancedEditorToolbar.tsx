import React, { useState, useEffect } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignJustify,
  Undo2,
  Redo2,
  Image as ImageIcon,
  Minus,
  Sparkles,
  BarChart3,
  ArrowLeft,
  Eraser,
  Search,
  Layers,
  Activity,
  MessageSquare
} from 'lucide-react';
import { TensionDisplayMode } from '../../../types';

interface AdvancedEditorToolbarProps {
  onFormat: (command: string, value?: string) => void;
  activeFormats: { [key: string]: boolean };
  wordCount: number;
  readingTimeMin: number;
  onOpenStatsModal: () => void;
  onOpenInsertImageModal: () => void;
  onOpenAIAssistant: () => void;
  onOpenFindReplace?: () => void;
  isPeekRawOpen?: boolean;
  onTogglePeekRaw?: () => void;
  rawDraftCount?: number;
  onOpenTensionModal?: () => void;
  tensionDisplayMode?: TensionDisplayMode;
  hasTensionData?: boolean;
  onExitToTabs: () => void;
}

export const AdvancedEditorToolbar: React.FC<AdvancedEditorToolbarProps> = ({
  onFormat,
  activeFormats,
  wordCount,
  readingTimeMin,
  onOpenStatsModal,
  onOpenInsertImageModal,
  onOpenAIAssistant,
  onOpenFindReplace,
  isPeekRawOpen = false,
  onTogglePeekRaw,
  rawDraftCount = 0,
  onOpenTensionModal,
  tensionDisplayMode = 'both',
  hasTensionData = false,
  onExitToTabs,
}) => {
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  // Auto-lift toolbar to stick directly above mobile virtual keyboard
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const handleViewportChange = () => {
      if (!window.visualViewport) return;
      // Calculate how much the virtual keyboard pushed the viewport
      const offset = window.innerHeight - window.visualViewport.height;
      setKeyboardOffset(Math.max(0, Math.round(offset)));
    };

    window.visualViewport.addEventListener('resize', handleViewportChange);
    window.visualViewport.addEventListener('scroll', handleViewportChange);

    return () => {
      window.visualViewport?.removeEventListener('resize', handleViewportChange);
      window.visualViewport?.removeEventListener('scroll', handleViewportChange);
    };
  }, []);

  return (
    <div
      style={{
        transform: keyboardOffset > 0 ? `translateY(-${keyboardOffset}px)` : undefined,
        transition: 'transform 0.1s ease-out',
      }}
      className="fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 shadow-xl safe-bottom"
    >
      {/* Floating Info & Quick Action Bar (Top of toolbar) */}
      <div className="max-w-4xl mx-auto px-2 sm:px-3 py-1 flex items-center justify-between gap-1.5 overflow-x-auto no-scrollbar border-b border-slate-100 dark:border-slate-800/60 text-xs">
        <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
          {/* Exit back to tabs */}
          <button
            type="button"
            onClick={onExitToTabs}
            className="flex items-center gap-1 py-1 px-1.5 sm:px-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95 text-[11px] font-bold"
            title="Kembali ke Ringkasan &amp; Tab Bab"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tab Bab</span>
          </button>

          {/* Peek Story Plot */}
          {onTogglePeekRaw && (
            <button
              type="button"
              onClick={onTogglePeekRaw}
              className={`flex items-center gap-1 py-1 px-2 sm:px-2.5 rounded-full transition active:scale-95 text-[11px] font-bold ${
                isPeekRawOpen
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700/80'
              }`}
              title="Lihat / Contek Story Plot & Coretan Bab"
            >
              <Layers className={`w-3 h-3 ${isPeekRawOpen ? 'text-slate-950' : 'text-amber-500'}`} />
              <span><span className="hidden sm:inline">Peek </span>Plot</span>
              {rawDraftCount > 0 && (
                <span className={`text-[9px] px-1 rounded-full ${isPeekRawOpen ? 'bg-black/20 text-slate-950' : 'bg-amber-400/30 text-amber-900 dark:text-amber-200'}`}>
                  {rawDraftCount}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Center: AI Tools (Co-Pilot & Tension Meter) */}
        <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={onOpenAIAssistant}
            className="flex items-center gap-1 py-1 px-2 sm:px-2.5 rounded-full bg-gradient-to-r from-amber-500/15 to-indigo-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:border-amber-500/60 transition active:scale-95 text-[11px] font-bold shadow-xs"
          >
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span><span className="hidden sm:inline">AI </span>Co-Pilot</span>
          </button>

          {onOpenTensionModal && (
            <button
              type="button"
              onClick={onOpenTensionModal}
              className={`flex items-center gap-1 py-1 px-2 sm:px-2.5 rounded-full border transition active:scale-95 text-[11px] font-bold ${
                tensionDisplayMode !== 'none'
                  ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40 shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border-slate-200 dark:border-slate-700/80'
              }`}
              title="Analisis & Pengaturan Tensi Cerita (AI Arc)"
            >
              <Activity className={`w-3 h-3 ${tensionDisplayMode !== 'none' ? 'text-rose-500' : 'text-slate-400'}`} />
              <span>Tensi</span>
              {hasTensionData && (
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              )}
            </button>
          )}
        </div>

        {/* Right: Floating Word Counter Button (Click to open Stats) */}
        <button
          type="button"
          onClick={onOpenStatsModal}
          className="flex items-center gap-1 py-1 px-2 sm:px-2.5 rounded-full bg-slate-100 dark:bg-slate-800/80 hover:bg-amber-500/15 border border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 transition active:scale-95 text-[11px] font-mono font-bold flex-shrink-0"
          title="Klik untuk membuka detail statistik kata, karakter & waktu baca"
        >
          <BarChart3 className="w-3.5 h-3.5 text-amber-500" />
          <span>{wordCount.toLocaleString()} <span className="hidden sm:inline">kata</span></span>
          <span className="hidden md:inline text-[10px] text-slate-400 font-sans">
            (~{readingTimeMin} mnt)
          </span>
        </button>
      </div>

      {/* Main Rich Text Formatting Bar */}
      <div className="max-w-4xl mx-auto px-2 py-1.5 flex items-center gap-1 overflow-x-auto no-scrollbar">
        {/* Undo / Redo */}
        <button
          type="button"
          onClick={() => onFormat('undo')}
          className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-90 flex-shrink-0"
          title="Urungkan (Undo)"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onFormat('redo')}
          className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-90 flex-shrink-0"
          title="Ulangi (Redo)"
        >
          <Redo2 className="w-4 h-4" />
        </button>

        {/* Find & Replace (Cari & Ganti Kata) */}
        {onOpenFindReplace && (
          <button
            type="button"
            onClick={onOpenFindReplace}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-90 flex-shrink-0"
            title="Cari & Ganti Kata (Find & Replace)"
          >
            <Search className="w-4 h-4" />
          </button>
        )}

        <div className="w-[1px] h-5 bg-slate-200 dark:bg-slate-800 mx-1 flex-shrink-0" />

        {/* 🖼️ INSERT IMAGE WITH WORLDBUILDING TAGS (Highlighted) */}
        <button
          type="button"
          onClick={onOpenInsertImageModal}
          className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition active:scale-95 flex-shrink-0"
          title="Sisipkan Gambar dengan Tag Worldbuilding"
        >
          <ImageIcon className="w-4 h-4" />
          <span>Gambar Cerita</span>
        </button>

        <div className="w-[1px] h-5 bg-slate-200 dark:bg-slate-800 mx-1 flex-shrink-0" />

        {/* Bold, Italic, Underline, Strike */}
        <button
          type="button"
          onClick={() => onFormat('bold')}
          className={`p-2 rounded-xl transition active:scale-90 flex-shrink-0 ${
            activeFormats.bold
              ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title="Tebal (Ctrl+B)"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onFormat('italic')}
          className={`p-2 rounded-xl transition active:scale-90 flex-shrink-0 ${
            activeFormats.italic
              ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title="Miring (Ctrl+I)"
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onFormat('underline')}
          className={`p-2 rounded-xl transition active:scale-90 flex-shrink-0 ${
            activeFormats.underline
              ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title="Garis Bawah (Ctrl+U)"
        >
          <Underline className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onFormat('strikeThrough')}
          className={`p-2 rounded-xl transition active:scale-90 flex-shrink-0 ${
            activeFormats.strikeThrough
              ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title="Coretan (Strikethrough)"
        >
          <Strikethrough className="w-4 h-4" />
        </button>

        <div className="w-[1px] h-5 bg-slate-200 dark:bg-slate-800 mx-1 flex-shrink-0" />

        {/* Headings */}
        <button
          type="button"
          onClick={() => onFormat('formatBlock', '<h2>')}
          className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-90 flex-shrink-0"
          title="Judul Bab / Bagian (H2)"
        >
          <Heading2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onFormat('formatBlock', '<h3>')}
          className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-90 flex-shrink-0"
          title="Sub-judul Adegan (H3)"
        >
          <Heading3 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onFormat('formatBlock', '<p>')}
          className="py-1 px-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition active:scale-90 flex-shrink-0"
          title="Paragraf Normal"
        >
          Teks
        </button>

        <div className="w-[1px] h-5 bg-slate-200 dark:bg-slate-800 mx-1 flex-shrink-0" />

        {/* Blockquote & Dialog */}
        <button
          type="button"
          onClick={() => onFormat('formatBlock', '<blockquote>')}
          className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-90 flex-shrink-0"
          title="Kutipan / Monolog Batin"
        >
          <Quote className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            // Insert dialogue quotes
            const selection = window.getSelection();
            if (selection && selection.toString()) {
              document.execCommand('insertText', false, `"${selection.toString()}"`);
            } else {
              document.execCommand('insertText', false, '""');
            }
          }}
          className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-90 flex-shrink-0"
          title="Sisipkan Kutipan Dialog"
        >
          <MessageSquare className="w-4 h-4" />
        </button>

        <div className="w-[1px] h-5 bg-slate-200 dark:bg-slate-800 mx-1 flex-shrink-0" />

        {/* Alignment */}
        <button
          type="button"
          onClick={() => onFormat('justifyLeft')}
          className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-90 flex-shrink-0"
          title="Rata Kiri"
        >
          <AlignLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onFormat('justifyCenter')}
          className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-90 flex-shrink-0"
          title="Rata Tengah"
        >
          <AlignCenter className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onFormat('justifyFull')}
          className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-90 flex-shrink-0"
          title="Rata Kiri Kanan (Justify)"
        >
          <AlignJustify className="w-4 h-4" />
        </button>

        <div className="w-[1px] h-5 bg-slate-200 dark:bg-slate-800 mx-1 flex-shrink-0" />

        {/* Lists & Divider */}
        <button
          type="button"
          onClick={() => onFormat('insertUnorderedList')}
          className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-90 flex-shrink-0"
          title="Daftar Poin"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onFormat('insertOrderedList')}
          className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-90 flex-shrink-0"
          title="Daftar Angka"
        >
          <ListOrdered className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onFormat('insertHorizontalRule')}
          className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-90 flex-shrink-0"
          title="Garis Pemisah Adegan (Scene Break)"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onFormat('removeFormat')}
          className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-90 flex-shrink-0"
          title="Hapus Format"
        >
          <Eraser className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
