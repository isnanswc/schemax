import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  SlidersHorizontal,
  Sparkles,
  CheckCircle2,
  Save,
  Feather
} from 'lucide-react';
import { StoryChapter, WorldEntity, WorldCategory, ChapterStatus } from '../../types';
import { db } from '../../db';
import { AIAssistantSheet } from './AIAssistantSheet';
import { AISettingsModal } from '../settings/AISettingsModal';
import { navStack } from '../../services/backNavigationService';
import { ChapterBottomNav, ChapterActiveTab } from './chapter-tabs/ChapterBottomNav';
import { ChapterInfoTab } from './chapter-tabs/ChapterInfoTab';
import { ChapterRawDraftsTab } from './chapter-tabs/ChapterRawDraftsTab';
import { ChapterGlossaryTab } from './chapter-tabs/ChapterGlossaryTab';
import { ChapterPlotTab } from './chapter-tabs/ChapterPlotTab';
import { WordCountStatsModal } from './editor/WordCountStatsModal';
import { InsertStoryImageModal } from './editor/InsertStoryImageModal';
import { EditorCornerMenu } from './editor/EditorCornerMenu';
import { AdvancedEditorToolbar } from './editor/AdvancedEditorToolbar';
import { WorldEntityHologramModal } from '../world/WorldEntityHologramModal';

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

  // 1. Default to 'info' (Chapter Information) on first open
  const [activeTab, setActiveTab] = useState<ChapterActiveTab>('info');

  const [title, setTitle] = useState(chapter.title);
  const [status, setStatus] = useState<ChapterStatus>(chapter.status);
  const [wordCount, setWordCount] = useState(chapter.wordCount || 0);
  const [charCount, setCharCount] = useState(0);
  const [charCountNoSpaces, setCharCountNoSpaces] = useState(0);
  const [paragraphCount, setParagraphCount] = useState(0);
  const [sentenceCount, setSentenceCount] = useState(0);
  const [isSaved, setIsSaved] = useState(true);

  // Editor Display Settings
  const [fontStyle, setFontStyle] = useState<'sans' | 'serif' | 'mono'>('serif');
  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg'>('base');
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [activeFormats, setActiveFormats] = useState<{ [key: string]: boolean }>({});

  // Modals & Sheets
  const [isCornerMenuOpen, setIsCornerMenuOpen] = useState(false);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [isInsertImageOpen, setIsInsertImageOpen] = useState(false);
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);
  const [isAISettingsOpen, setIsAISettingsOpen] = useState(false);
  const [selectedTextForAI, setSelectedTextForAI] = useState('');
  const [viewingEntity, setViewingEntity] = useState<WorldEntity | null>(null);

  const saveTimeoutRef = useRef<any>(null);

  // Sync editor content from database when chapter changes
  useEffect(() => {
    setCurrentChapter(chapter);
    setTitle(chapter.title);
    setStatus(chapter.status);
    if (editorRef.current) {
      editorRef.current.innerHTML = chapter.contentHtml || '';
      updateCounts();
    }
  }, [chapter.id]);

  // Handle Tab Switch (Save manuscript immediately before switching)
  const handleTabChange = (tab: ChapterActiveTab) => {
    if (activeTab === 'manuscript' && tab !== 'manuscript') {
      saveToIndexedDB();
    }
    setActiveTab(tab);
  };

  // Back Navigation Handler
  const handleHeaderBack = () => {
    if (activeTab === 'manuscript') {
      // In manuscript mode, return to Chapter Info tab
      handleTabChange('info');
    } else {
      // In other tabs, exit chapter workspace to story planner
      handleBack();
    }
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

  // Calculate live statistics
  const updateCounts = () => {
    if (!editorRef.current) return;
    const text = editorRef.current.innerText || '';
    const cleanText = text.trim();
    const words = cleanText ? cleanText.split(/\s+/).filter(Boolean).length : 0;
    const paragraphs = cleanText ? cleanText.split(/\n+/).filter(Boolean).length : 0;
    const sentences = cleanText ? cleanText.split(/[.!?]+/).filter(Boolean).length : 0;
    const noSpaces = cleanText.replace(/\s+/g, '').length;

    setWordCount(words);
    setCharCount(cleanText.length);
    setCharCountNoSpaces(noSpaces);
    setParagraphCount(paragraphs);
    setSentenceCount(sentences);
  };

  // Check active formatting for toolbar buttons
  const checkActiveFormats = () => {
    setActiveFormats({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strikeThrough: document.queryCommandState('strikeThrough'),
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

  // Update specific chapter fields from tabs
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

  // 🖼️ Insert Story Image with Worldbuilding Tags
  // 🖼️ Insert Story Image with Worldbuilding Tags and Narrative Sentences
  const handleInsertImage = (
    imageUrl: string,
    caption: string,
    taggedEntities: Array<{ id: string; name: string; category: WorldCategory }>,
    narrativeSentenceBefore?: string,
    narrativeSentenceAfter?: string
  ) => {
    if (!editorRef.current) return;
    editorRef.current.focus();

    const tagBadgesHtml = taggedEntities
      .map(
        (e) => `
      <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 cursor-pointer hover:bg-amber-500/30 transition select-none entity-tag-pill" data-entity-id="${e.id}" title="Klik untuk info ${e.category}: ${e.name}">
        🏷️ ${e.name} (${e.category.toUpperCase()})
      </span>`
      )
      .join(' ');

    const beforeHtml = narrativeSentenceBefore?.trim()
      ? `<p class="story-narrative-lead my-2 italic text-slate-700 dark:text-slate-300 leading-relaxed font-serif">${narrativeSentenceBefore.trim()}</p>`
      : '';
    const afterHtml = narrativeSentenceAfter?.trim()
      ? `<p class="story-narrative-follow my-2 italic text-slate-700 dark:text-slate-300 leading-relaxed font-serif">${narrativeSentenceAfter.trim()}</p>`
      : '';

    const imageBlockHtml = `
${beforeHtml}
<figure class="story-image-block my-5 p-3 rounded-2xl bg-slate-100/90 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center select-none" contenteditable="false">
  <img src="${imageUrl}" alt="${caption}" class="w-full max-h-[460px] object-cover rounded-xl shadow-md mx-auto block" />
  ${caption ? `<figcaption class="mt-2 text-xs font-semibold text-slate-700 dark:text-slate-300 italic">${caption}</figcaption>` : ''}
  ${taggedEntities.length > 0 ? `<div class="mt-2 flex flex-wrap items-center justify-center gap-1.5">${tagBadgesHtml}</div>` : ''}
</figure>
${afterHtml}
<p><br></p>`;

    document.execCommand('insertHTML', false, imageBlockHtml);
    handleContentChange();
  };

  // Click on interactive tag pills inside story content to open Worldbuilding hologram
  const handleEditorClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const pill = target.closest('[data-entity-id]') as HTMLElement;
    if (pill) {
      e.preventDefault();
      e.stopPropagation();
      const entityId = pill.getAttribute('data-entity-id');
      const found = entities.find((ent) => ent.id === entityId);
      if (found) {
        setViewingEntity(found);
      }
    }
  };

  // Save and safely exit to chapter list
  const handleBack = async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    await saveToIndexedDB();
    onBack();
  };

  const getEffectivePlainText = (): string => {
    // 1. Try textContent (textContent is NOT affected by display: none / hidden)
    if (editorRef.current) {
      const text = (editorRef.current.textContent || '').trim();
      if (text) return text;
    }
    // 2. Try parsing from currentChapter.contentHtml
    const html = currentChapter.contentHtml || '';
    if (html.trim()) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      const stripped = (tempDiv.textContent || tempDiv.innerText || '').trim();
      if (stripped) return stripped;
    }
    // 3. Fallback to premise or notes so AI can still work even without full manuscript
    return (currentChapter.premise || currentChapter.notes || '').trim();
  };

  const contentText = getEffectivePlainText();

  return (
    <div
      className={`fixed inset-0 z-50 bg-slate-50 dark:bg-slate-950 flex flex-col text-slate-900 dark:text-slate-100 h-[100dvh] overflow-hidden ${
        isFocusMode ? 'focus-mode' : ''
      }`}
    >
      {/* 1. TOP STATUS BAR - Clean, Minimalist & Focused */}
      <header className="flex items-center justify-between px-3 sm:px-4 py-2.5 bg-white/95 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/80 z-20 safe-top flex-shrink-0 transition-colors">
        {/* Left: Back Navigation Button */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <button
            type="button"
            onClick={handleHeaderBack}
            className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition active:scale-95 flex-shrink-0"
            title={activeTab === 'manuscript' ? 'Kembali ke Info Bab' : 'Kembali ke Daftar Bab'}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          {/* Book Title & Chapter Title Clearly Displayed */}
          <div className="min-w-0 flex-1">
            <p className="text-[10px] sm:text-xs text-amber-600 dark:text-amber-400 font-bold truncate leading-none mb-0.5">
              📖 {bookTitle}
            </p>
            <h2 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
              Bab {currentChapter.order}: {title || 'Bab Tanpa Judul'}
            </h2>
          </div>
        </div>

        {/* Right: Auto-Save Status Dot + Single Corner Menu Button */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Subtle auto-save indicator */}
          <span
            className={`w-2 h-2 rounded-full transition-all ${
              isSaved ? 'bg-emerald-500' : 'bg-amber-500 animate-ping'
            }`}
            title={isSaved ? 'Tersimpan' : 'Menyimpan...'}
          />

          {/* Corner Menu Button */}
          <button
            type="button"
            onClick={() => setIsCornerMenuOpen(true)}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition active:scale-95 shadow-xs border border-slate-200/80 dark:border-slate-700/80"
            title="Menu & Pengaturan Bab"
            aria-label="Menu Bab"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 2. MAIN WORKSPACE BODY */}
      <main className="flex-1 overflow-y-auto px-2.5 sm:px-4 py-3 sm:py-4">
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

        {/* TAB 2: Tulisan Kasar (Raw Drafts) */}
        {activeTab === 'raw' && (
          <ChapterRawDraftsTab
            chapter={currentChapter}
            bookTitle={bookTitle}
            onUpdateChapter={handleUpdateChapterFields}
            onAppendToManuscript={handleAppendToManuscript}
            onNavigateToManuscript={() => handleTabChange('manuscript')}
          />
        )}

        {/* TAB 3: Naskah Utama (Editor Canvas - ALWAYS MOUNTED to never lose typed content) */}
        <div
          className={`${
            activeTab === 'manuscript' ? 'flex flex-col flex-1' : 'hidden'
          } max-w-3xl mx-auto w-full pb-28`}
        >
          {/* Chapter Title Field */}
          <div className="mb-4 pt-1 border-b border-slate-100 dark:border-slate-800/80 pb-2">
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
            onClick={handleEditorClick}
            className={`flex-1 min-h-[65vh] text-slate-800 dark:text-slate-200 leading-relaxed focus:outline-none ${
              fontSize === 'sm'
                ? 'text-sm sm:text-base'
                : fontSize === 'lg'
                ? 'text-lg sm:text-xl'
                : 'text-base sm:text-lg'
            } ${
              fontStyle === 'serif'
                ? 'font-serif'
                : fontStyle === 'mono'
                ? 'font-mono'
                : 'font-sans'
            } prose dark:prose-invert prose-amber max-w-none`}
            data-placeholder="Mulai tulis naskah adegan ceritamu di sini..."
          />
        </div>

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

      {/* 3. BOTTOM BAR TOGGLE:
          - If Manuscript Mode: Show Advanced Writing Toolbar (Tab bar disappears)
          - If Tabs Mode: Show 5-Tab Navigation Bar with Central Pen
      */}
      {activeTab === 'manuscript' ? (
        <AdvancedEditorToolbar
          onFormat={format}
          activeFormats={activeFormats}
          wordCount={wordCount}
          readingTimeMin={Math.max(1, Math.round(wordCount / 200))}
          onOpenStatsModal={() => setIsStatsModalOpen(true)}
          onOpenInsertImageModal={() => setIsInsertImageOpen(true)}
          onOpenAIAssistant={handleOpenAIAssistant}
          onExitToTabs={() => handleTabChange('info')}
        />
      ) : (
        <ChapterBottomNav
          activeTab={activeTab}
          onChangeTab={handleTabChange}
          rawDraftCount={currentChapter.rawDrafts?.length || 0}
          glossaryCount={entities.length}
          hasAiPlot={!!currentChapter.aiPlot}
        />
      )}

      {/* 4. MODALS & SHEETS */}
      {/* Corner Menu Drawer */}
      <EditorCornerMenu
        isOpen={isCornerMenuOpen}
        onClose={() => setIsCornerMenuOpen(false)}
        status={status}
        onChangeStatus={handleStatusChange}
        isSaved={isSaved}
        onSaveManual={saveToIndexedDB}
        isFocusMode={isFocusMode}
        onToggleFocusMode={() => setIsFocusMode(!isFocusMode)}
        fontStyle={fontStyle}
        onChangeFontStyle={setFontStyle}
        fontSize={fontSize}
        onChangeFontSize={setFontSize}
        onOpenAIAssistant={handleOpenAIAssistant}
        onOpenAISettings={handleOpenAISettings}
        onNavigateToTab={(tab) => {
          setIsCornerMenuOpen(false);
          handleTabChange(tab);
        }}
      />

      {/* Word Count & Read Time Statistics Modal */}
      <WordCountStatsModal
        isOpen={isStatsModalOpen}
        onClose={() => setIsStatsModalOpen(false)}
        wordCount={wordCount}
        charCount={charCount}
        charCountNoSpaces={charCountNoSpaces}
        paragraphCount={paragraphCount}
        sentenceCount={sentenceCount}
        targetWordCount={currentChapter.targetWordCount || 1500}
      />

      {/* Insert Story Image Modal with Worldbuilding Tagging & AI Vision */}
      <InsertStoryImageModal
        isOpen={isInsertImageOpen}
        onClose={() => setIsInsertImageOpen(false)}
        bookId={chapter.bookId}
        bookTitle={bookTitle}
        chapterTitle={currentChapter.title}
        chapterId={currentChapter.id}
        entities={entities}
        onInsertImage={handleInsertImage}
      />

      {/* AI Assistant Writing Co-Pilot Sheet */}
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

      {/* Multi-AI Settings Modal */}
      <AISettingsModal
        isOpen={isAISettingsOpen}
        onClose={handleCloseAISettings}
      />

      {/* World Entity Hologram Profile (triggered when clicking tags in story images) */}
      <WorldEntityHologramModal
        entity={viewingEntity}
        isOpen={Boolean(viewingEntity)}
        onClose={() => setViewingEntity(null)}
      />
    </div>
  );
};
