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
  Type,
  Compass,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { StoryChapter, WorldEntity } from '../../types';
import { db } from '../../db';
import { LoreSidebarDrawer } from './LoreSidebarDrawer';
import { AIAssistantSheet } from './AIAssistantSheet';
import { AISettingsModal } from '../settings/AISettingsModal';
import { ThemeToggle } from '../layout/ThemeToggle';
import { navStack } from '../../services/backNavigationService';

interface RichTextEditorProps {
  chapter: StoryChapter;
  bookTitle: string;
  entities?: WorldEntity[];
  onBack: () => void;
  onChapterUpdated: (updated: StoryChapter) => void;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  chapter,
  bookTitle,
  entities = [],
  onBack,
  onChapterUpdated,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState(chapter.title);
  const [status, setStatus] = useState(chapter.status);
  const [wordCount, setWordCount] = useState(chapter.wordCount || 0);
  const [charCount, setCharCount] = useState(0);
  const [isSaved, setIsSaved] = useState(true);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isToolbarOpen, setIsToolbarOpen] = useState(true);
  const [isLoreDrawerOpen, setIsLoreDrawerOpen] = useState(false);
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);
  const [isAISettingsOpen, setIsAISettingsOpen] = useState(false);
  const [selectedTextForAI, setSelectedTextForAI] = useState('');
  const [fontStyle, setFontStyle] = useState<'sans' | 'serif'>('serif');
  const [activeFormats, setActiveFormats] = useState<{ [key: string]: boolean }>({});
  const saveTimeoutRef = useRef<any>(null);

  const handleOpenAIAssistant = () => {
    const sel = window.getSelection()?.toString() || '';
    setSelectedTextForAI(sel);
    navStack.push('editor-ai-assistant', () => setIsAIAssistantOpen(false));
    setIsAIAssistantOpen(true);
  };

  const handleCloseAIAssistant = () => {
    navStack.pop('editor-ai-assistant');
    setIsAIAssistantOpen(false);
  };

  const handleOpenLoreDrawer = () => {
    navStack.push('editor-lore-drawer', () => setIsLoreDrawerOpen(false));
    setIsLoreDrawerOpen(true);
  };

  const handleCloseLoreDrawer = () => {
    navStack.pop('editor-lore-drawer');
    setIsLoreDrawerOpen(false);
  };

  const handleOpenAISettings = () => {
    navStack.push('editor-ai-settings', () => setIsAISettingsOpen(false));
    setIsAISettingsOpen(true);
  };

  const handleCloseAISettings = () => {
    navStack.pop('editor-ai-settings');
    setIsAISettingsOpen(false);
  };

  const handleApplyAIResult = (aiText: string, mode: 'insert' | 'replace') => {
    if (!editorRef.current) return;
    editorRef.current.focus();

    if (mode === 'replace') {
      document.execCommand('insertText', false, aiText);
    } else {
      document.execCommand('insertText', false, `\n\n${aiText}\n\n`);
    }

    handleContentChange();
  };

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

  // Insert Entity Name into Editor cursor position
  const handleInsertEntityName = (name: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand('insertText', false, ` ${name} `);
    handleContentChange();
    setIsLoreDrawerOpen(false);
  };

  // Save and safely exit to chapter list
  const handleBack = async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    if (editorRef.current) {
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
      } catch (err) {
        console.error('Gagal menyimpan bab:', err);
      }
    }
    onBack();
  };

  const readingTime = Math.ceil(wordCount / 200);

  return (
    <div
      className={`fixed inset-0 z-50 bg-slate-950 flex flex-col text-slate-100 h-[100dvh] overflow-hidden ${
        isFocusMode ? 'focus-mode' : ''
      }`}
    >
      {/* Top Navbar - Compact & Zero Wasted Space */}
      <header className="flex items-center justify-between px-2.5 sm:px-4 py-2 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 z-20 safe-top flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={handleBack}
            className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white transition active:scale-95"
            title="Kembali"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="min-w-0">
            <p className="text-[10px] text-amber-400 font-bold truncate leading-none mb-0.5">
              {bookTitle}
            </p>
            <h2 className="text-xs sm:text-sm font-bold text-white truncate max-w-[130px] sm:max-w-md">
              {title || 'Bab Tanpa Judul'}
            </h2>
          </div>
        </div>

        {/* Right Header Controls */}
        <div className="flex items-center gap-1.5">
          {/* Quick Status Dropdown */}
          <select
            value={status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="bg-slate-800/90 border border-slate-700/80 text-slate-200 text-[11px] rounded-xl px-2 py-1 focus:outline-none focus:border-amber-400 font-semibold"
          >
            <option value="planned">Direncanakan</option>
            <option value="in_progress">Sedang Ditulis</option>
            <option value="completed">Selesai</option>
          </select>

          {/* AI Co-Pilot Button */}
          <button
            type="button"
            onClick={handleOpenAIAssistant}
            className="flex items-center gap-1 py-1 px-2.5 rounded-xl bg-gradient-to-r from-indigo-500/20 to-purple-500/20 hover:from-indigo-500/30 hover:to-purple-500/30 text-indigo-300 border border-indigo-500/40 text-xs font-black transition active:scale-95 shadow-sm"
            title="Bantuan AI Writing Co-Pilot"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">AI Co-Pilot</span>
          </button>

          {/* Lore Drawer Button */}
          <button
            type="button"
            onClick={handleOpenLoreDrawer}
            className="flex items-center gap-1 py-1 px-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-bold transition active:scale-95 shadow-sm"
            title="Buka Glosarium Lore"
          >
            <Compass className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Lore</span>
            {entities.length > 0 && (
              <span className="px-1 text-[9px] rounded-full bg-amber-400 text-slate-950 font-black">
                {entities.length}
              </span>
            )}
          </button>

          {/* Theme Toggle (Dark/Light/Auto) */}
          <ThemeToggle />

          {/* Auto-save Status Icon */}
          <button
            onClick={saveToIndexedDB}
            className={`p-1.5 rounded-xl border transition ${
              isSaved
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/15 text-amber-300 border-amber-500/30 animate-pulse'
            }`}
            title={isSaved ? 'Tersimpan di IndexedDB' : 'Menyimpan...'}
          >
            {isSaved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          </button>

          {/* Toggle Toolbar Icon */}
          <button
            onClick={() => setIsToolbarOpen(!isToolbarOpen)}
            className={`p-1.5 rounded-xl border transition ${
              isToolbarOpen
                ? 'bg-slate-800 text-amber-400 border-slate-700'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
            }`}
            title="Sembunyikan/Tampilkan Toolbar Format"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>

          {/* Focus Mode Toggle */}
          <button
            onClick={() => setIsFocusMode(!isFocusMode)}
            className="p-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white transition hidden sm:flex items-center"
            title={isFocusMode ? 'Keluar Mode Fokus' : 'Mode Fokus Layar Penuh'}
          >
            {isFocusMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Formatting Toolbar (Can be collapsed to save 100% vertical space on mobile) */}
      {isToolbarOpen && (
        <div className="w-full bg-slate-900 border-b border-slate-800/80 px-2 py-1.5 flex items-center gap-1 overflow-x-auto no-scrollbar z-10 flex-shrink-0 animate-in slide-in-from-top-1 duration-150">
          <div className="flex items-center gap-0.5 bg-slate-950/70 p-0.5 rounded-xl border border-slate-800/60 flex-shrink-0">
            <button
              type="button"
              onClick={() => format('bold')}
              className={`p-1.5 rounded-lg text-xs transition ${
                activeFormats.bold ? 'bg-amber-500/20 text-amber-300' : 'text-slate-300 hover:bg-slate-800'
              }`}
              title="Tebal"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => format('italic')}
              className={`p-1.5 rounded-lg text-xs transition ${
                activeFormats.italic ? 'bg-amber-500/20 text-amber-300' : 'text-slate-300 hover:bg-slate-800'
              }`}
              title="Miring"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => format('underline')}
              className={`p-1.5 rounded-lg text-xs transition ${
                activeFormats.underline ? 'bg-amber-500/20 text-amber-300' : 'text-slate-300 hover:bg-slate-800'
              }`}
              title="Garis Bawah"
            >
              <Underline className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-0.5 bg-slate-950/70 p-0.5 rounded-xl border border-slate-800/60 flex-shrink-0">
            <button
              type="button"
              onClick={() => format('formatBlock', '<h2>')}
              className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-800 transition"
              title="Judul Bab (H2)"
            >
              <Heading1 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => format('formatBlock', '<h3>')}
              className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-800 transition"
              title="Subjudul (H3)"
            >
              <Heading2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => format('formatBlock', '<blockquote>')}
              className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-800 transition"
              title="Kutipan / Monolog"
            >
              <Quote className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-0.5 bg-slate-950/70 p-0.5 rounded-xl border border-slate-800/60 flex-shrink-0">
            <button
              type="button"
              onClick={() => format('insertUnorderedList')}
              className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-800 transition"
              title="Poin"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => format('insertOrderedList')}
              className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-800 transition"
              title="Nomor"
            >
              <ListOrdered className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => format('insertHorizontalRule')}
              className="px-2 py-1 text-[11px] font-bold text-slate-300 hover:bg-slate-800 rounded-lg transition"
              title="Pemisah Adegan (***)"
            >
              ***
            </button>
          </div>

          {/* Font Toggle */}
          <button
            type="button"
            onClick={() => setFontStyle(fontStyle === 'serif' ? 'sans' : 'serif')}
            className="p-1.5 rounded-xl bg-slate-950/70 border border-slate-800/60 text-slate-300 hover:text-white transition flex-shrink-0 text-xs font-bold px-2"
            title="Ganti Font Serif / Sans"
          >
            {fontStyle === 'serif' ? 'Serif' : 'Sans'}
          </button>

          {/* Undo / Redo */}
          <div className="flex items-center gap-0.5 ml-auto flex-shrink-0">
            <button
              type="button"
              onClick={() => format('undo')}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Undo"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => format('redo')}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Redo"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Editor Main Canvas - Maximum Width & Edge-to-Edge reading comfort */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 flex justify-center bg-slate-950">
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
            className="w-full bg-transparent text-xl sm:text-3xl font-extrabold text-white placeholder-slate-600 focus:outline-none border-b border-slate-800/80 pb-2.5 mb-3 tracking-tight"
          />

          {/* Premise & Notes Helper bar (Collapsible) */}
          {chapter.premise && (
            <div className="mb-4 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/60 text-xs text-slate-300">
              <span className="font-bold text-amber-400/90 block mb-0.5 text-[11px]">
                📌 Alur Bab Ini:
              </span>
              <p className="italic leading-relaxed">{chapter.premise}</p>
            </div>
          )}

          {/* Rich Text Editable Area */}
          <div
            ref={editorRef}
            contentEditable
            onInput={handleContentChange}
            onKeyUp={checkActiveFormats}
            onMouseUp={checkActiveFormats}
            className={`flex-1 min-h-[60vh] text-slate-200 text-base sm:text-lg leading-relaxed focus:outline-none pb-24 ${
              fontStyle === 'serif' ? 'font-serif' : 'font-sans'
            } prose prose-invert prose-amber max-w-none`}
            data-placeholder="Mulai tulis adegan ceritamu di sini..."
          />
        </div>
      </div>

      {/* Floating Bottom Lore & AI Buttons (Thumb-Friendly on Mobile) */}
      <div className="fixed bottom-12 right-4 sm:hidden z-30 flex items-center gap-2">
        <button
          type="button"
          onClick={handleOpenAIAssistant}
          className="flex items-center gap-1.5 py-2 px-3 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-black text-xs shadow-xl shadow-purple-500/25 border border-purple-400/40 active:scale-95 transition"
          title="AI Assistant"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>AI</span>
        </button>

        <button
          type="button"
          onClick={handleOpenLoreDrawer}
          className="flex items-center gap-1.5 py-2 px-3 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black text-xs shadow-xl shadow-amber-500/25 border border-amber-400/40 active:scale-95 transition"
          title="Lore Drawer"
        >
          <Compass className="w-3.5 h-3.5" />
          <span>Lore</span>
        </button>
      </div>

      {/* Bottom Sticky Status & Word Count Bar */}
      <footer className="sticky bottom-0 z-20 bg-slate-900/95 backdrop-blur-md border-t border-slate-800/80 px-3 py-1.5 flex items-center justify-between text-xs text-slate-400 safe-bottom flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-white text-[11px] sm:text-xs">
            {wordCount.toLocaleString()} <span className="font-normal text-slate-400">kata</span>
          </span>
          <span className="text-slate-600">•</span>
          <span className="text-[11px] text-slate-400">
            {charCount.toLocaleString()} huruf
          </span>
          <span className="hidden sm:inline-block text-slate-600">•</span>
          <span className="hidden sm:inline-flex items-center gap-1 text-slate-400 text-[11px]">
            <Clock className="w-3 h-3 text-amber-400/80" />
            ~{readingTime} mnt
          </span>
        </div>

        <div className="text-[10px] sm:text-[11px] text-slate-400">
          Target: <span className="font-semibold text-slate-300">{chapter.targetWordCount || 1500}</span>
        </div>
      </footer>

      {/* Slide-Over Lore Drawer */}
      <LoreSidebarDrawer
        isOpen={isLoreDrawerOpen}
        onClose={handleCloseLoreDrawer}
        entities={entities}
        onInsertEntityName={handleInsertEntityName}
      />

      {/* AI Assistant Co-Pilot Sheet */}
      <AIAssistantSheet
        isOpen={isAIAssistantOpen}
        onClose={handleCloseAIAssistant}
        selectedText={selectedTextForAI}
        chapterPremise={chapter.premise}
        bookTitle={bookTitle}
        entities={entities}
        onApplyResult={handleApplyAIResult}
        onOpenAISettings={handleOpenAISettings}
      />

      {/* Multi-AI Settings Modal */}
      <AISettingsModal
        isOpen={isAISettingsOpen}
        onClose={handleCloseAISettings}
      />
    </div>
  );
};
