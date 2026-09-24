import React, { useState, useEffect, useRef } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Heading1,
  Heading2,
  Quote,
  List,
  ListOrdered,
  Undo2,
  Redo2,
  Save,
  ArrowLeft,
  Eye,
  Maximize2,
  Minimize2,
  BookOpen,
  Sparkles,
  CheckCircle2,
  Clock,
  Type
} from 'lucide-react';
import { StoryChapter } from '../../types';
import { db } from '../../db';

interface RichTextEditorProps {
  chapter: StoryChapter;
  bookTitle: string;
  onBack: () => void;
  onChapterUpdated: (updated: StoryChapter) => void;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  chapter,
  bookTitle,
  onBack,
  onChapterUpdated,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState(chapter.title);
  const [content, setContent] = useState(chapter.contentHtml || '');
  const [status, setStatus] = useState(chapter.status);
  const [wordCount, setWordCount] = useState(chapter.wordCount || 0);
  const [charCount, setCharCount] = useState(0);
  const [isSaved, setIsSaved] = useState(true);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [fontStyle, setFontStyle] = useState<'sans' | 'serif'>('serif');
  const [activeFormats, setActiveFormats] = useState<{ [key: string]: boolean }>({});
  const saveTimeoutRef = useRef<any>(null);

  // Set initial content
  useEffect(() => {
    if (editorRef.current && chapter.contentHtml) {
      editorRef.current.innerHTML = chapter.contentHtml;
      updateCounts();
    }
  }, [chapter.id]);

  // Calculate words and characters
  const updateCounts = () => {
    if (!editorRef.current) return;
    const text = editorRef.current.innerText || '';
    const cleanText = text.trim();
    const words = cleanText ? cleanText.split(/\s+/).filter(Boolean).length : 0;
    setWordCount(words);
    setCharCount(cleanText.length);
  };

  // Check active formatting for toolbar buttons
  const checkActiveFormats = () => {
    setActiveFormats({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
    });
  };

  // Execute formatting command
  const format = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      editorRef.current.focus();
    }
    handleContentChange();
    checkActiveFormats();
  };

  // Debounced auto-save to IndexedDB
  const handleContentChange = () => {
    if (!editorRef.current) return;
    setIsSaved(false);
    updateCounts();

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveToIndexedDB();
    }, 1000);
  };

  const saveToIndexedDB = async () => {
    if (!editorRef.current) return;
    const currentHtml = editorRef.current.innerHTML;
    const text = editorRef.current.innerText || '';
    const words = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;

    const updatedChapter: StoryChapter = {
      ...chapter,
      title: title.trim(),
      contentHtml: currentHtml,
      wordCount: words,
      status: status,
      updatedAt: Date.now(),
    };

    try {
      await db.chapters.put(updatedChapter);
      setIsSaved(true);
      onChapterUpdated(updatedChapter);
    } catch (err) {
      console.error('Gagal menyimpan bab ke IndexedDB:', err);
    }
  };

  // Save on status change
  const handleStatusChange = (newStatus: any) => {
    setStatus(newStatus);
    setIsSaved(false);
    setTimeout(() => {
      saveToIndexedDB();
    }, 100);
  };

  const readingTime = Math.ceil(wordCount / 200);

  return (
    <div
      className={`fixed inset-0 z-50 bg-slate-950 flex flex-col text-slate-100 ${
        isFocusMode ? 'focus-mode' : ''
      }`}
    >
      {/* Top Navbar */}
      <header className="flex items-center justify-between px-3 sm:px-6 py-2.5 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 z-20">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => {
              saveToIndexedDB();
              onBack();
            }}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white transition active:scale-95"
            title="Kembali"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="min-w-0">
            <p className="text-[11px] text-amber-400 font-semibold truncate">
              {bookTitle}
            </p>
            <h2 className="text-xs sm:text-sm font-bold text-white truncate max-w-[150px] sm:max-w-md">
              {title || 'Bab Tanpa Judul'}
            </h2>
          </div>
        </div>

        {/* Right Action: Status Pill & Save Status */}
        <div className="flex items-center gap-2">
          {/* Status selector */}
          <select
            value={status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-amber-400 font-medium"
          >
            <option value="planned">Direncanakan</option>
            <option value="in_progress">Sedang Ditulis</option>
            <option value="completed">Selesai</option>
          </select>

          {/* Auto-save Badge */}
          <button
            onClick={saveToIndexedDB}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition ${
              isSaved
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/15 text-amber-300 border-amber-500/30 animate-pulse'
            }`}
          >
            {isSaved ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tersimpan</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Menyimpan...</span>
              </>
            )}
          </button>

          {/* Focus Mode & Font Toggle */}
          <button
            onClick={() => setFontStyle(fontStyle === 'serif' ? 'sans' : 'serif')}
            className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white transition hidden sm:flex items-center"
            title="Ganti Font (Serif / Sans)"
          >
            <Type className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsFocusMode(!isFocusMode)}
            className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white transition"
            title={isFocusMode ? 'Keluar Mode Fokus' : 'Mode Fokus Menulis'}
          >
            {isFocusMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Formatting Toolbar (Mobile-friendly horizontal scroll) */}
      <div className="w-full bg-slate-900 border-b border-slate-800/80 px-3 py-2 flex items-center gap-1 overflow-x-auto no-scrollbar z-10">
        <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/60 flex-shrink-0">
          <button
            type="button"
            onClick={() => format('bold')}
            className={`p-2 rounded-lg text-xs transition ${
              activeFormats.bold ? 'bg-amber-500/20 text-amber-300' : 'text-slate-300 hover:bg-slate-800'
            }`}
            title="Tebal (Ctrl+B)"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => format('italic')}
            className={`p-2 rounded-lg text-xs transition ${
              activeFormats.italic ? 'bg-amber-500/20 text-amber-300' : 'text-slate-300 hover:bg-slate-800'
            }`}
            title="Miring (Ctrl+I)"
          >
            <Italic className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => format('underline')}
            className={`p-2 rounded-lg text-xs transition ${
              activeFormats.underline ? 'bg-amber-500/20 text-amber-300' : 'text-slate-300 hover:bg-slate-800'
            }`}
            title="Garis Bawah (Ctrl+U)"
          >
            <Underline className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/60 flex-shrink-0">
          <button
            type="button"
            onClick={() => format('formatBlock', '<h2>')}
            className="p-2 rounded-lg text-slate-300 hover:bg-slate-800 transition"
            title="Judul Bab (H2)"
          >
            <Heading1 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => format('formatBlock', '<h3>')}
            className="p-2 rounded-lg text-slate-300 hover:bg-slate-800 transition"
            title="Subjudul (H3)"
          >
            <Heading2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => format('formatBlock', '<blockquote>')}
            className="p-2 rounded-lg text-slate-300 hover:bg-slate-800 transition"
            title="Kutipan / Monolog Batin"
          >
            <Quote className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/60 flex-shrink-0">
          <button
            type="button"
            onClick={() => format('insertUnorderedList')}
            className="p-2 rounded-lg text-slate-300 hover:bg-slate-800 transition"
            title="Daftar Poin"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => format('insertOrderedList')}
            className="p-2 rounded-lg text-slate-300 hover:bg-slate-800 transition"
            title="Daftar Nomor"
          >
            <ListOrdered className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => format('insertHorizontalRule')}
            className="px-2 py-1 text-xs font-bold text-slate-300 hover:bg-slate-800 rounded-lg transition"
            title="Pemisah Adegan (Divider)"
          >
            ***
          </button>
        </div>

        <div className="flex items-center gap-1 ml-auto flex-shrink-0">
          <button
            type="button"
            onClick={() => format('undo')}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Undo"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => format('redo')}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Redo"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Editor Main Canvas */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 flex justify-center bg-slate-950">
        <div className="w-full max-w-2xl flex flex-col">
          {/* Chapter Title Input */}
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setIsSaved(false);
              if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
              saveTimeoutRef.current = setTimeout(saveToIndexedDB, 1000);
            }}
            placeholder="Judul Bab Cerita..."
            className="w-full bg-transparent text-2xl sm:text-3xl font-extrabold text-white placeholder-slate-600 focus:outline-none border-b border-slate-800/80 pb-3 mb-4 tracking-tight"
          />

          {/* Premise & Notes Accordion / Helper bar */}
          {chapter.premise && (
            <div className="mb-6 p-3 rounded-xl bg-slate-900/60 border border-slate-800/60 text-xs text-slate-400">
              <span className="font-semibold text-amber-400/90 block mb-1">
                📌 Catatan Premis Alur:
              </span>
              <p className="italic">{chapter.premise}</p>
            </div>
          )}

          {/* Rich Text Editable Area */}
          <div
            ref={editorRef}
            contentEditable
            onInput={handleContentChange}
            onKeyUp={checkActiveFormats}
            onMouseUp={checkActiveFormats}
            className={`flex-1 min-h-[50vh] text-slate-200 text-base sm:text-lg leading-relaxed focus:outline-none pb-28 ${
              fontStyle === 'serif' ? 'font-serif' : 'font-sans'
            } prose prose-invert prose-amber max-w-none`}
            data-placeholder="Mulai tulis ceritamu di sini..."
          />
        </div>
      </div>

      {/* Bottom Floating Word Count & Reading Time Bar */}
      <footer className="sticky bottom-0 z-20 bg-slate-900/95 backdrop-blur-md border-t border-slate-800/80 px-4 py-2 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-white">
            {wordCount.toLocaleString()} <span className="font-normal text-slate-400">kata</span>
          </span>
          <span className="text-slate-600">•</span>
          <span>
            {charCount.toLocaleString()} <span className="text-slate-500">karakter</span>
          </span>
          <span className="hidden sm:inline-block text-slate-600">•</span>
          <span className="hidden sm:inline-flex items-center gap-1 text-slate-400">
            <Clock className="w-3.5 h-3.5 text-amber-400/80" />
            ~{readingTime} menit baca
          </span>
        </div>

        <div className="text-[11px] text-slate-400">
          Target: <span className="font-semibold text-slate-300">{chapter.targetWordCount || 1500} kata</span>
        </div>
      </footer>
    </div>
  );
};
