import React, { useState, useEffect, useRef } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Heading2,
  Heading3,
  Quote,
  List,
  ListOrdered,
  Undo2,
  Redo2,
  Save,
  ArrowLeft,
  Maximize2,
  Minimize2,
  Sparkles,
  CheckCircle2,
  Type,
  SlidersHorizontal,
  ChevronRight
} from 'lucide-react';
import { StoryChapter, WorldEntity, ChapterStatus } from '../../types';
import { db } from '../../db';
import { AIAssistantSheet } from './AIAssistantSheet';
import { AISettingsModal } from '../settings/AISettingsModal';
import { ThemeToggle } from '../layout/ThemeToggle';
import { navStack } from '../../services/backNavigationService';
import { ChapterBottomNav, ChapterActiveTab } from './chapter-tabs/ChapterBottomNav';
import { ChapterInfoTab } from './chapter-tabs/ChapterInfoTab';
import { ChapterRawDraftsTab } from './chapter-tabs/ChapterRawDraftsTab';
import { ChapterGlossaryTab } from './chapter-tabs/ChapterGlossaryTab';
import { ChapterPlotTab } from './chapter-tabs/ChapterPlotTab';

interface RichTextEditorProps {
  chapter: StoryChapter;
  bookTitle: string;
  entities?: WorldEntity[];
  onBack: () => void;
  onChapterUpdated: (updated: StoryChapter) => void;
  onSwitchChapter?: (chapter: StoryChapter) => void;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  chapter,
  bookTitle,
  entities = [],
  onBack,
  onChapterUpdated,
  onSwitchChapter,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [currentChapter, setCurrentChapter] = useState<StoryChapter>(chapter);
  const [activeTab, setActiveTab] = useState<ChapterActiveTab>('manuscript');
  const [title, setTitle] = useState(chapter.title);
  const [status, setStatus] = useState<ChapterStatus>(chapter.status);
  const [wordCount, setWordCount] = useState(chapter.wordCount || 0);
  const [charCount, setCharCount] = useState(0);
  const [isSaved, setIsSaved] = useState(true);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isToolbarOpen, setIsToolbarOpen] = useState(true);
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);
  const [isAISettingsOpen, setIsAISettingsOpen] = useState(false);
  const [selectedTextForAI, setSelectedTextForAI] = useState('');
  const [fontStyle, setFontStyle] = useState<'sans' | 'serif'>('serif');
  const [activeFormats, setActiveFormats] = useState<{ [key: string]: boolean }>({});
  const saveTimeoutRef = useRef<any>(null);

  // Sync internal chapter when prop changes
  useEffect(() => {
    setCurrentChapter(chapter);
    setTitle(chapter.title);
    setStatus(chapter.status);
    if (editorRef.current && chapter.contentHtml) {
      editorRef.current.innerHTML = chapter.contentHtml;
      updateCounts();
    }
  }, [chapter.id]);

  // Tab change with back navigation integration
  const handleTabChange = (tab: ChapterActiveTab) => {
    if (tab !== 'manuscript' && activeTab === 'manuscript') {
      navStack.push('chapter-tab-' + tab, () => setActiveTab('manuscript'));
    } else if (tab === 'manuscript' && activeTab !== 'manuscript') {
      navStack.pop('chapter-tab-' + activeTab);
    }
    setActiveTab(tab);
  };

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
    const currentHtml = editorRef.current ? editorRef.current.innerHTML : currentChapter.contentHtml;
    const text = editorRef.current ? editorRef.current.innerText || '' : '';
    const words = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : wordCount;

    const updatedChapter: StoryChapter = {
      ...currentChapter,
      title: title.trim(),
      contentHtml: currentHtml,
      wordCount: words,
      status: status,
      updatedAt: Date.now(),
    };

    try {
      await db.chapters.put(updatedChapter);
      setCurrentChapter(updatedChapter);
      setIsSaved(true);
      onChapterUpdated(updatedChapter);
    } catch (err) {
      console.error('Gagal menyimpan bab ke IndexedDB:', err);
    }
  };

  // Save on status change
  const handleStatusChange = (newStatus: ChapterStatus) => {
    setStatus(newStatus);
    setCurrentChapter((prev) => ({ ...prev, status: newStatus }));
    setIsSaved(false);
    setTimeout(() => {
      saveToIndexedDB();
    }, 100);
  };

  // Update specific chapter fields from tabs (premise, notes, rawDrafts, aiSummary, aiPlot, aiScenes)
  const handleUpdateChapterFields = async (fields: Partial<StoryChapter>) => {
    const updated: StoryChapter = {
      ...currentChapter,
      ...fields,
      updatedAt: Date.now(),
    };
    setCurrentChapter(updated);
    if (fields.status) setStatus(fields.status);
    if (fields.title) setTitle(fields.title);

    try {
      await db.chapters.put(updated);
      onChapterUpdated(updated);
    } catch (err) {
      console.error('Gagal update bab:', err);
    }
  };

  // Append raw draft text to manuscript
  const handleAppendToManuscript = (text: string) => {
    const formatted = text
      .split('\n\n')
      .filter(Boolean)
      .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
      .join('');

    if (editorRef.current) {
      editorRef.current.innerHTML = (editorRef.current.innerHTML || '') + formatted;
      handleContentChange();
    }
    setActiveTab('manuscript');
  };

  // Insert entity name at cursor position in manuscript
  const handleInsertEntityName = (name: string) => {
    if (editorRef.current) {
      editorRef.current.focus();
      document.execCommand('insertText', false, ` ${name} `);
      handleContentChange();
    }
    setActiveTab('manuscript');
  };

  // Save and safely exit to chapter list
  const handleBack = async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    await saveToIndexedDB();
    onBack();
  };

  const contentText = editorRef.current ? editorRef.current.innerText || '' : '';

  return (
    <div
      className={`fixed inset-0 z-50 bg-slate-50 dark:bg-slate-950 flex flex-col text-slate-900 dark:text-slate-100 h-[100dvh] overflow-hidden ${
        isFocusMode ? 'focus-mode' : ''
      }`}
    >
      {/* 1. TOP HEADER - Compact & Edge-to-Edge */}
      <header className="flex items-center justify-between px-2.5 sm:px-4 py-2 bg-white/95 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/80 z-20 safe-top flex-shrink-0 transition-colors">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={handleBack}
            className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition active:scale-95"
            title="Kembali ke Daftar Bab"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="min-w-0">
            <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold truncate leading-none mb-0.5">
              {bookTitle}
            </p>
            <h2 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate max-w-[130px] sm:max-w-md">
              Bab {currentChapter.order}: {title || 'Bab Tanpa Judul'}
            </h2>
          </div>
        </div>

        {/* Right Header Controls */}
        <div className="flex items-center gap-1.5">
          {/* Status Selector */}
          <select
            value={status}
            onChange={(e) => handleStatusChange(e.target.value as ChapterStatus)}
            className="bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 text-slate-800 dark:text-slate-200 text-[11px] rounded-xl px-2 py-1 focus:outline-none focus:border-amber-500 font-bold"
          >
            <option value="planned">Direncanakan</option>
            <option value="in_progress">Sedang Ditulis</option>
            <option value="completed">Selesai</option>
          </select>

          {/* AI Co-Pilot Button (Writing Assistant) */}
          <button
            type="button"
            onClick={handleOpenAIAssistant}
            className="flex items-center gap-1 py-1 px-2.5 rounded-xl bg-gradient-to-r from-indigo-500/15 to-purple-500/15 hover:from-indigo-500/25 hover:to-purple-500/25 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 text-xs font-black transition active:scale-95 shadow-sm"
            title="Bantuan AI Writing Co-Pilot"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">AI Co-Pilot</span>
          </button>

          {/* Theme Toggle (Dark/Light/Auto) */}
          <ThemeToggle />

          {/* Auto-save Status Icon */}
          <button
            onClick={saveToIndexedDB}
            className={`p-1.5 rounded-xl border transition ${
              isSaved
                ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'
                : 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30 animate-pulse'
            }`}
            title={isSaved ? 'Tersimpan di IndexedDB' : 'Menyimpan...'}
          >
            {isSaved ? <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <Save className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
          </button>

          {/* Manuscript Toolbar Toggle */}
          {activeTab === 'manuscript' && (
            <button
              onClick={() => setIsToolbarOpen(!isToolbarOpen)}
              className={`p-1.5 rounded-xl border transition ${
                isToolbarOpen
                  ? 'bg-slate-100 dark:bg-slate-800 text-amber-600 dark:text-amber-400 border-slate-200 dark:border-slate-700'
                  : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Sembunyikan/Tampilkan Toolbar Format"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          )}

          {/* Focus Mode Toggle */}
          <button
            onClick={() => setIsFocusMode(!isFocusMode)}
            className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition hidden sm:flex items-center"
            title={isFocusMode ? 'Keluar Mode Fokus' : 'Mode Fokus Layar Penuh'}
          >
            {isFocusMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* 2. FORMATTING TOOLBAR (Only shown in Manuscript tab) */}
      {activeTab === 'manuscript' && isToolbarOpen && (
        <div className="w-full bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800/80 px-2 py-1.5 flex items-center gap-1 overflow-x-auto no-scrollbar z-10 flex-shrink-0 animate-in slide-in-from-top-1 duration-150">
          <div className="flex items-center gap-0.5 bg-white dark:bg-slate-950/70 p-0.5 rounded-xl border border-slate-200 dark:border-slate-800/60 shadow-sm flex-shrink-0">
            <button
              type="button"
              onClick={() => format('bold')}
              className={`p-1.5 rounded-lg text-xs transition ${
                activeFormats.bold
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title="Tebal (Ctrl+B)"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => format('italic')}
              className={`p-1.5 rounded-lg text-xs transition ${
                activeFormats.italic
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title="Miring (Ctrl+I)"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => format('underline')}
              className={`p-1.5 rounded-lg text-xs transition ${
                activeFormats.underline
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title="Garis Bawah (Ctrl+U)"
            >
              <Underline className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-0.5 bg-white dark:bg-slate-950/70 p-0.5 rounded-xl border border-slate-200 dark:border-slate-800/60 shadow-sm flex-shrink-0">
            <button
              type="button"
              onClick={() => format('formatBlock', '<h2>')}
              className="px-2 py-1 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Heading 2 (Judul Bagian)"
            >
              H2
            </button>
            <button
              type="button"
              onClick={() => format('formatBlock', '<h3>')}
              className="px-2 py-1 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Heading 3 (Sub-judul / Adegan)"
            >
              H3
            </button>
            <button
              type="button"
              onClick={() => format('formatBlock', '<blockquote>')}
              className="p-1.5 rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Kutipan / Monolog Batin"
            >
              <Quote className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-0.5 bg-white dark:bg-slate-950/70 p-0.5 rounded-xl border border-slate-200 dark:border-slate-800/60 shadow-sm flex-shrink-0">
            <button
              type="button"
              onClick={() => format('insertUnorderedList')}
              className="p-1.5 rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Daftar Poin"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => format('insertOrderedList')}
              className="p-1.5 rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Daftar Angka"
            >
              <ListOrdered className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-0.5 bg-white dark:bg-slate-950/70 p-0.5 rounded-xl border border-slate-200 dark:border-slate-800/60 shadow-sm flex-shrink-0">
            <button
              type="button"
              onClick={() => format('undo')}
              className="p-1.5 rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Batal (Ctrl+Z)"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => format('redo')}
              className="p-1.5 rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Ulangi (Ctrl+Y)"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="ml-auto flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={() => setFontStyle(fontStyle === 'serif' ? 'sans' : 'serif')}
              className="flex items-center gap-1 px-2 py-1 rounded-xl bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/60 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              title="Ganti Jenis Huruf (Serif Lora / Sans)"
            >
              <Type className="w-3 h-3 text-amber-500" />
              <span>{fontStyle === 'serif' ? 'Lora (Serif)' : 'Sans'}</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. MAIN WORKSPACE CONTENT AREA - Dynamically rendered based on activeTab */}
      <main className="flex-1 overflow-y-auto no-scrollbar relative w-full px-2.5 sm:px-4 py-3">
        {/* TAB 1: Chapter Information */}
        {activeTab === 'info' && (
          <ChapterInfoTab
            chapter={currentChapter}
            bookTitle={bookTitle}
            contentText={contentText}
            onUpdateChapter={handleUpdateChapterFields}
            onNavigateToManuscript={() => handleTabChange('manuscript')}
          />
        )}

        {/* TAB 2: Tulisan Kasar */}
        {activeTab === 'raw' && (
          <ChapterRawDraftsTab
            chapter={currentChapter}
            bookTitle={bookTitle}
            onUpdateChapter={handleUpdateChapterFields}
            onAppendToManuscript={handleAppendToManuscript}
            onNavigateToManuscript={() => handleTabChange('manuscript')}
          />
        )}

        {/* TAB 3: Naskah Utama (Editor) */}
        {activeTab === 'manuscript' && (
          <div className="max-w-2xl mx-auto flex flex-col min-h-full pb-24">
            {/* Chapter Title Field */}
            <div className="mb-3 pt-1">
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setIsSaved(false);
                  handleContentChange();
                }}
                placeholder="Judul Bab..."
                className="w-full bg-transparent text-xl sm:text-2xl font-black text-slate-900 dark:text-white focus:outline-none placeholder:text-slate-400 border-none p-0 tracking-tight"
              />
            </div>

            {/* Editable Manuscript Canvas */}
            <div
              ref={editorRef}
              contentEditable
              onInput={handleContentChange}
              onKeyUp={checkActiveFormats}
              onMouseUp={checkActiveFormats}
              className={`flex-1 min-h-[65vh] text-slate-800 dark:text-slate-200 text-base sm:text-lg leading-relaxed focus:outline-none pb-28 ${
                fontStyle === 'serif' ? 'font-serif' : 'font-sans'
              } prose dark:prose-invert prose-amber max-w-none`}
              data-placeholder="Mulai tulis naskah adegan ceritamu di sini..."
            />
          </div>
        )}

        {/* TAB 4: Glosarium */}
        {activeTab === 'glossary' && (
          <ChapterGlossaryTab
            chapter={currentChapter}
            bookTitle={bookTitle}
            entities={entities}
            contentText={contentText}
            onUpdateChapter={handleUpdateChapterFields}
            onInsertTextToManuscript={handleInsertEntityName}
          />
        )}

        {/* TAB 5: Ringkasan & Plot */}
        {activeTab === 'plot' && (
          <ChapterPlotTab
            chapter={currentChapter}
            bookTitle={bookTitle}
            contentText={contentText}
            onUpdateChapter={handleUpdateChapterFields}
            onSwitchChapter={onSwitchChapter}
          />
        )}
      </main>

      {/* 4. CHAPTER BOTTOM NAVIGATION (5 Tabs with Big Pen in the Center) */}
      <ChapterBottomNav
        activeTab={activeTab}
        onChangeTab={handleTabChange}
        rawDraftCount={currentChapter.rawDrafts?.length || 0}
        glossaryCount={entities.length}
        hasAiPlot={!!currentChapter.aiPlot}
      />

      {/* 5. AI Assistant Writing Co-Pilot Sheet */}
      <AIAssistantSheet
        isOpen={isAIAssistantOpen}
        onClose={handleCloseAIAssistant}
        selectedText={selectedTextForAI}
        chapterPremise={currentChapter.premise}
        bookTitle={bookTitle}
        entities={entities}
        onApplyResult={handleApplyAIResult}
        onOpenAISettings={handleOpenAISettings}
      />

      {/* 6. Multi-AI Settings Modal */}
      <AISettingsModal
        isOpen={isAISettingsOpen}
        onClose={handleCloseAISettings}
      />
    </div>
  );
};
