import React from 'react';
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
  MessageSquareQuote,
  ChevronUp
} from 'lucide-react';

interface AdvancedEditorToolbarProps {
  onFormat: (command: string, value?: string) => void;
  activeFormats: { [key: string]: boolean };
  wordCount: number;
  readingTimeMin: number;
  onOpenStatsModal: () => void;
  onOpenInsertImageModal: () => void;
  onOpenAIAssistant: () => void;
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
  onExitToTabs,
}) => {
  return (
    <div className="fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 shadow-xl transition-all duration-200 safe-bottom">
      {/* Floating Info & Quick Action Bar (Top of toolbar) */}
      <div className="max-w-4xl mx-auto px-3 py-1 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 text-xs">
        {/* Exit back to tabs */}
        <button
          type="button"
          onClick={onExitToTabs}
          className="flex items-center gap-1.5 py-1 px-2.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95 text-[11px] font-bold"
          title="Kembali ke Ringkasan & Tab Bab"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Tab Bab</span>
        </button>

        {/* Center: AI Quick Co-Pilot Button */}
        <button
          type="button"
          onClick={onOpenAIAssistant}
          className="flex items-center gap-1 py-1 px-2.5 rounded-full bg-gradient-to-r from-amber-500/15 to-indigo-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:border-amber-500/60 transition active:scale-95 text-[11px] font-bold shadow-xs"
        >
          <Sparkles className="w-3 h-3 text-amber-500" />
          <span>AI Co-Pilot</span>
        </button>

        {/* Right: Floating Word Counter Button (Click to open Stats) */}
        <button
          type="button"
          onClick={onOpenStatsModal}
          className="flex items-center gap-1.5 py-1 px-2.5 rounded-full bg-slate-100 dark:bg-slate-800/80 hover:bg-amber-500/15 border border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 transition active:scale-95 text-[11px] font-mono font-bold"
          title="Klik untuk membuka detail statistik kata, karakter & waktu baca"
        >
          <BarChart3 className="w-3.5 h-3.5 text-amber-500" />
          <span>{wordCount.toLocaleString()} kata</span>
          <span className="text-[10px] text-slate-400 font-sans">
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
          <MessageSquareQuote className="w-4 h-4" />
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
