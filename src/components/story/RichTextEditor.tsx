import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  SlidersHorizontal,
  Sparkles,
  CheckCircle2,
  Save,
  Feather,
  Search,
  X,
  FileEdit,
  Copy,
  ArrowRight,
  Layers
} from 'lucide-react';
import {
  StoryChapter,
  WorldEntity,
  WorldCategory,
  ChapterStatus,
  TensionDisplayMode,
  ParagraphTensionItem,
  ChapterTensionData
} from '../../types';
import { db } from '../../db';
import { AIAssistantSheet } from './AIAssistantSheet';
import { AISettingsModal } from '../settings/AISettingsModal';
import { navStack } from '../../services/backNavigationService';
import { ChapterBottomNav, ChapterActiveTab } from './chapter-tabs/ChapterBottomNav';
import { ChapterInfoTab } from './chapter-tabs/ChapterInfoTab';
import { ChapterStoryPlotTab } from './chapter-tabs/ChapterStoryPlotTab';
import { ChapterGlossaryTab } from './chapter-tabs/ChapterGlossaryTab';
import { ChapterPlotTab } from './chapter-tabs/ChapterPlotTab';
import { WordCountStatsModal } from './editor/WordCountStatsModal';
import { InsertStoryImageModal } from './editor/InsertStoryImageModal';
import { EditorCornerMenu } from './editor/EditorCornerMenu';
import { AdvancedEditorToolbar } from './editor/AdvancedEditorToolbar';
import { WorldEntityHologramModal } from '../world/WorldEntityHologramModal';
import { TensionControlModal } from './editor/TensionControlModal';
import {
  extractParagraphsFromEditor,
  analyzeChapterTensionWithAI,
  getTensionColor,
  hashString
} from '../../utils/tensionUtils';

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

  // Find & Replace States
  const [isFindReplaceOpen, setIsFindReplaceOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [matchCount, setMatchCount] = useState(0);

  // Peek Story Plot / Coretan States
  const [isPeekRawOpen, setIsPeekRawOpen] = useState(false);
  const [peekDraftId, setPeekDraftId] = useState<string>('');

  const activePeekDraft =
    (currentChapter.rawDrafts || []).find(
      (d) => d.id === (peekDraftId || currentChapter.activeRawDraftId)
    ) ||
    (currentChapter.rawDrafts || [])[0] ||
    null;

  const activePeekContent =
    currentChapter.premise?.trim() ||
    activePeekDraft?.content?.trim() ||
    '';

  const saveTimeoutRef = useRef<any>(null);

  const handleInsertPeekToManuscript = (text: string) => {
    if (!editorRef.current || !text) return;
    editorRef.current.focus();
    document.execCommand('insertText', false, text);
    handleContentChange();
  };

  // Story Tension Arc States
  const [isTensionModalOpen, setIsTensionModalOpen] = useState(false);
  const [isAnalyzingTension, setIsAnalyzingTension] = useState(false);
  const [tensionData, setTensionData] = useState<ChapterTensionData>(
    currentChapter.tensionData || {
      items: [],
      lastAnalyzedAt: 0,
      displayMode: 'both',
    }
  );

  // Apply visual styling to paragraphs based on tensionData
  const applyTensionStyling = (data = tensionData) => {
    if (!editorRef.current) return;
    const children = Array.from(editorRef.current.children) as HTMLElement[];
    if (children.length === 0) return;

    const { items, displayMode } = data;
    const isNone = displayMode === 'none';
    const isGutter = displayMode === 'gutter' || displayMode === 'both';
    const isUnderline = displayMode === 'underline' || displayMode === 'both';

    for (const child of children) {
      if (child.tagName === 'FIGURE' || child.classList.contains('story-image-block')) {
        continue;
      }
      const txt = child.innerText?.trim() || '';
      if (!txt || isNone) {
        child.style.borderLeft = '';
        child.style.paddingLeft = '';
        child.style.borderBottom = '';
        child.style.paddingBottom = '';
        child.removeAttribute('title');
        continue;
      }

      const h = hashString(txt);
      const match = items.find((it) => it.textHash === h);

      if (match) {
        const color = getTensionColor(match.tensionScore);
        if (isGutter) {
          child.style.borderLeft = `4px solid ${color.hex}`;
          child.style.paddingLeft = '12px';
        } else {
          child.style.borderLeft = '';
          child.style.paddingLeft = '';
        }

        if (isUnderline) {
          child.style.borderBottom = `2px solid ${color.hex}b3`;
          child.style.paddingBottom = '4px';
        } else {
          child.style.borderBottom = '';
          child.style.paddingBottom = '';
        }

        child.style.transition = 'border 0.2s ease, padding 0.2s ease';
        child.title = `⚡ Intensitas: ${match.tensionScore}% (${match.label || color.label})${match.note ? ` - ${match.note}` : ''}`;
      } else {
        // Any un-evaluated or modified text has strictly NO color
        child.style.borderLeft = '';
        child.style.paddingLeft = '';
        child.style.borderBottom = '';
        child.style.paddingBottom = '';
        child.removeAttribute('title');
      }
    }
  };

  const handleRunTensionAnalysis = async () => {
    if (!editorRef.current) return;
    const extracted = extractParagraphsFromEditor(editorRef.current);
    if (extracted.length === 0) return;

    setIsAnalyzingTension(true);
    try {
      const results = await analyzeChapterTensionWithAI(
        extracted.map((e) => e.text),
        title || currentChapter.title || `Bab ${currentChapter.order}`
      );

      const newItems: ParagraphTensionItem[] = results.map((r, i) => ({
        paragraphIndex: r.index,
        textHash: extracted[r.index]?.hash || extracted[i]?.hash || '',
        tensionScore: r.score,
        label: r.label,
        note: r.note,
      }));

      const newTensionData: ChapterTensionData = {
        items: newItems,
        lastAnalyzedAt: Date.now(),
        displayMode: tensionData.displayMode || 'both',
      };

      setTensionData(newTensionData);
      handleUpdateChapterFields({ tensionData: newTensionData });
      applyTensionStyling(newTensionData);
    } catch (err) {
      console.error('Gagal analisis tensi narasi:', err);
    } finally {
      setIsAnalyzingTension(false);
    }
  };

  const handleChangeTensionMode = (newMode: TensionDisplayMode) => {
    const updated: ChapterTensionData = {
      ...tensionData,
      displayMode: newMode,
    };
    setTensionData(updated);
    handleUpdateChapterFields({ tensionData: updated });
    applyTensionStyling(updated);
  };

  // Listen to keyboard shortcut Ctrl+F / Cmd+F to open Find & Replace
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        if (activeTab === 'manuscript') {
          e.preventDefault();
          setIsFindReplaceOpen((prev) => !prev);
        }
      }
      if (e.key === 'Escape' && isFindReplaceOpen) {
        setIsFindReplaceOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, isFindReplaceOpen]);

  // Recalculate matches whenever search query changes
  useEffect(() => {
    if (!searchQuery || !editorRef.current) {
      setMatchCount(0);
      return;
    }
    const text = editorRef.current.innerText || '';
    const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matches = text.match(new RegExp(escaped, 'gi'));
    setMatchCount(matches ? matches.length : 0);
  }, [searchQuery]);

  const handleReplaceAll = () => {
    if (!editorRef.current || !searchQuery) return;
    const currentHtml = editorRef.current.innerHTML;
    const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'gi');
    const newHtml = currentHtml.replace(regex, replaceQuery);
    editorRef.current.innerHTML = newHtml;
    handleContentChange();
    setMatchCount(0);
  };

  // Clean paste handler (sanitizes rich text from MS Word / Google Docs)
  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;

    const cleanLines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const paragraphs = cleanLines.split(/\n{2,}/);

    if (paragraphs.length > 1) {
      const html = paragraphs
        .map((p) => `<p>${p.trim().replace(/\n/g, '<br>')}</p>`)
        .join('');
      document.execCommand('insertHTML', false, html);
    } else {
      document.execCommand('insertText', false, text);
    }
    handleContentChange();
  };

  // Sync editor content from database when chapter changes
  useEffect(() => {
    setCurrentChapter(chapter);
    setTitle(chapter.title);
    setStatus(chapter.status);
    const initialTension: ChapterTensionData = chapter.tensionData || {
      items: [],
      lastAnalyzedAt: 0,
      displayMode: 'both',
    };
    setTensionData(initialTension);
    if (editorRef.current) {
      editorRef.current.innerHTML = chapter.contentHtml || '';
      updateCounts();
      setTimeout(() => {
        applyTensionStyling(initialTension);
      }, 50);
    }
  }, [chapter.id]);

  useEffect(() => {
    if (activeTab === 'manuscript') {
      applyTensionStyling(tensionData);
    }
  }, [activeTab]);

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
    applyTensionStyling();

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
      tensionData: tensionData,
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

        {/* TAB 2: Story Plot (Pusat Konteks AI & Coretan Bab) */}
        {activeTab === 'raw' && (
          <ChapterStoryPlotTab
            chapter={currentChapter}
            bookTitle={bookTitle}
            entities={entities}
            onUpdateChapter={handleUpdateChapterFields}
            onNavigateToManuscript={() => handleTabChange('manuscript')}
          />
        )}

        {/* TAB 3: Naskah Utama (Editor Canvas - ALWAYS MOUNTED to never lose typed content) */}
        <div
          className={`${
            activeTab === 'manuscript' ? 'flex flex-col flex-1' : 'hidden'
          } max-w-3xl mx-auto w-full pb-28`}
        >
          {/* Find & Replace Bar */}
          {isFindReplaceOpen && (
            <div className="mb-4 p-3 bg-white dark:bg-slate-900 border border-amber-500/40 rounded-2xl shadow-lg animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5" />
                  <span>Cari &amp; Ganti Kata</span>
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    {matchCount} kecocokan
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsFindReplaceOpen(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    title="Tutup (Esc)"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari kata..."
                  className="w-full py-1.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 border border-slate-200 dark:border-slate-700"
                />
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={replaceQuery}
                    onChange={(e) => setReplaceQuery(e.target.value)}
                    placeholder="Ganti dengan..."
                    className="flex-1 py-1.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 border border-slate-200 dark:border-slate-700"
                  />
                  <button
                    type="button"
                    onClick={handleReplaceAll}
                    disabled={!searchQuery || matchCount === 0}
                    className="py-1.5 px-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs transition whitespace-nowrap active:scale-95"
                  >
                    Ganti Semua
                  </button>
                </div>
              </div>
            </div>
          )}

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
            onPaste={handlePaste}
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
          onOpenFindReplace={() => setIsFindReplaceOpen(true)}
          isPeekRawOpen={isPeekRawOpen}
          onTogglePeekRaw={() => setIsPeekRawOpen((prev) => !prev)}
          rawDraftCount={(currentChapter.rawDrafts || []).length}
          onOpenTensionModal={() => setIsTensionModalOpen(true)}
          tensionDisplayMode={tensionData.displayMode}
          hasTensionData={tensionData.items.length > 0}
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

      {/* Peek Story Plot Sheet / Panel */}
      {activeTab === 'manuscript' && isPeekRawOpen && (
        <div className="fixed inset-x-2 sm:inset-x-auto sm:right-4 bottom-20 z-40 sm:w-96 max-w-full pointer-events-auto animate-in slide-in-from-bottom-4 duration-200">
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-amber-500/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[48vh]">
            {/* Header */}
            <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 bg-slate-50/80 dark:bg-slate-800/50">
              <div className="flex items-center gap-2 min-w-0">
                <span className="p-1 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400">
                  <Layers className="w-3.5 h-3.5" />
                </span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                  Contek Story Plot (Bab Ini)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsPeekRawOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                title="Tutup (Esc)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Multiple Drafts Switcher if > 1 */}
            {(currentChapter.rawDrafts || []).length > 1 && (
              <div className="px-3 py-1.5 flex items-center gap-1 overflow-x-auto no-scrollbar border-b border-slate-100 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-950/40">
                {(currentChapter.rawDrafts || []).map((d) => {
                  const isSel = (peekDraftId || currentChapter.activeRawDraftId || currentChapter.rawDrafts?.[0]?.id) === d.id;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setPeekDraftId(d.id)}
                      className={`py-1 px-2.5 rounded-lg text-[10px] font-bold whitespace-nowrap transition active:scale-95 ${
                        isSel
                          ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {d.title || 'Draf'}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Content Display */}
            <div className="p-3.5 overflow-y-auto text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap font-sans leading-relaxed select-text flex-1">
              {activePeekContent ? (
                activePeekContent
              ) : (
                <span className="text-slate-400 italic">Story Plot atau draf bab ini masih kosong. Isi di tab Story Plot.</span>
              )}
            </div>

            {/* Footer Quick Actions */}
            <div className="px-3 py-2 bg-slate-50 dark:bg-slate-950/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                {activePeekContent ? activePeekContent.split(/\s+/).filter(Boolean).length : 0} kata
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    if (activePeekContent) {
                      navigator.clipboard.writeText(activePeekContent);
                    }
                  }}
                  disabled={!activePeekContent}
                  className="py-1 px-2.5 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 disabled:opacity-50 text-slate-700 dark:text-slate-300 font-bold text-[11px] flex items-center gap-1 active:scale-95 transition"
                  title="Salin isi plot ke clipboard"
                >
                  <Copy className="w-3 h-3" />
                  <span>Salin</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (activePeekContent) {
                      handleInsertPeekToManuscript(activePeekContent);
                    }
                  }}
                  disabled={!activePeekContent}
                  className="py-1 px-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-black text-[11px] flex items-center gap-1 active:scale-95 transition shadow-xs"
                  title="Sisipkan ke kursor naskah utama"
                >
                  <ArrowRight className="w-3 h-3" />
                  <span>Sisipkan</span>
                </button>
              </div>
            </div>
          </div>
        </div>
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
        onOpenFindReplace={() => setIsFindReplaceOpen(true)}
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

      {/* Story Tension Arc & Pacing Controller Modal */}
      <TensionControlModal
        isOpen={isTensionModalOpen}
        onClose={() => setIsTensionModalOpen(false)}
        displayMode={tensionData.displayMode}
        onChangeDisplayMode={handleChangeTensionMode}
        tensionItems={tensionData.items}
        totalParagraphs={editorRef.current ? extractParagraphsFromEditor(editorRef.current).length : 0}
        evaluatedCount={
          editorRef.current
            ? extractParagraphsFromEditor(editorRef.current).filter((p) =>
                tensionData.items.some((it) => it.textHash === p.hash)
              ).length
            : 0
        }
        unEvaluatedCount={
          editorRef.current
            ? Math.max(
                0,
                extractParagraphsFromEditor(editorRef.current).length -
                  extractParagraphsFromEditor(editorRef.current).filter((p) =>
                    tensionData.items.some((it) => it.textHash === p.hash)
                  ).length
              )
            : 0
        }
        isAnalyzing={isAnalyzingTension}
        onRunAnalysis={handleRunTensionAnalysis}
        lastAnalyzedAt={tensionData.lastAnalyzedAt}
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
