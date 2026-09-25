import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  BookOpen,
  FileText,
  Sparkles,
  Edit3,
  CheckCircle2,
  Clock,
  Plus,
  Trash2,
  Copy,
  Wand2,
  Layers,
  Film,
  Compass,
  Check,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  Loader2,
  Save,
  Zap,
  GitBranch,
  History,
  Shield,
  MapPin,
  User,
  Tag,
  Link2,
  CheckCheck,
  PlusCircle,
  Settings,
  Image as ImageIcon,
  RotateCcw,
  Sliders,
  X,
  Share2,
} from 'lucide-react';
import {
  Book,
  StoryChapter,
  ChapterStatus,
  ChapterRawDraft,
  ChapterPlotBreakdown,
  ChapterSceneItem,
  SceneGlosariumItem,
  ImagePromptSettings,
  DetectedEntityCandidate,
  WorldEntity,
  WorldCategory,
} from '../../types';
import { db } from '../../db';
import {
  generateChapterSummary,
  generateChapterAutoPlot,
  generateChapterAutoScenes,
  generateSingleSceneImagePrompt,
  enhanceRawToProse,
  detectEntitiesAndAliases,
} from '../../services/aiService';

interface ChapterStudioViewProps {
  chapter: StoryChapter;
  book: Book;
  onBack: () => void;
  onOpenEditor: (chapter: StoryChapter) => void;
  onChapterUpdated?: (updatedChapter: StoryChapter) => void;
}

type StudioTab = 'premise' | 'raw' | 'main' | 'ai';
type AISubSheet = 'summary' | 'plot' | 'scenes' | 'glosarium';

const DEFAULT_IMAGE_SETTINGS: ImagePromptSettings = {
  aspectRatio: '9:16 (Layar HP)',
  style: 'Hyper realistic, natural scene, 8k resolution, cinematic lighting, photorealistic textures',
  characterNaming: 'person1, person2 (sesuai foto/referensi karakter yang dilampirkan)',
  additionalKeywords: 'candid scene photography, authentic emotions, high detail, volumetric lighting',
  language: 'en',
};

export const ChapterStudioView: React.FC<ChapterStudioViewProps> = ({
  chapter: initialChapter,
  book,
  onBack,
  onOpenEditor,
  onChapterUpdated,
}) => {
  const [chapter, setChapter] = useState<StoryChapter>(initialChapter);
  const [activeTab, setActiveTab] = useState<StudioTab>('premise');
  const [aiSubSheet, setAiSubSheet] = useState<AISubSheet>('summary');

  // 1. Premis State
  const [premiseText, setPremiseText] = useState(initialChapter.premise || '');
  const [chapterNotes, setChapterNotes] = useState(initialChapter.notes || '');
  const [targetWords, setTargetWords] = useState(String(initialChapter.targetWordCount || 1500));
  const [isSavedPremise, setIsSavedPremise] = useState(false);

  // 2. Multi-Raw Drafts State
  const defaultRawList: ChapterRawDraft[] =
    initialChapter.rawDrafts && initialChapter.rawDrafts.length > 0
      ? initialChapter.rawDrafts
      : [
          {
            id: 'raw_1',
            title: 'Coretan Kasar 1',
            content: '',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ];

  const [rawDrafts, setRawDrafts] = useState<ChapterRawDraft[]>(defaultRawList);
  const [activeRawId, setActiveRawId] = useState<string>(
    initialChapter.activeRawDraftId || defaultRawList[0].id
  );
  const [isPolishingAi, setIsPolishingAi] = useState(false);
  const [polishedAiResult, setPolishedAiResult] = useState<string | null>(null);

  // 3. AI Studio States (Atomic progress & states to avoid overwriting)
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [generateAllStep, setGenerateAllStep] = useState<string>('');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isGeneratingPlot, setIsGeneratingPlot] = useState(false);
  const [isGeneratingScenes, setIsGeneratingScenes] = useState(false);
  const [isDetectingEntities, setIsDetectingEntities] = useState(false);
  const [aiStudioError, setAiStudioError] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // 3b. Global Image Prompt Settings State
  const [imagePromptSettings, setImagePromptSettings] = useState<ImagePromptSettings>(() => {
    try {
      const saved = localStorage.getItem('schemax_image_prompt_settings');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return DEFAULT_IMAGE_SETTINGS;
  });
  const [tempImageSettings, setTempImageSettings] = useState<ImagePromptSettings>(imagePromptSettings);
  const [showImageSettingsModal, setShowImageSettingsModal] = useState(false);

  // 3c. Single Scene Image Prompt Operations
  const [regeneratingPromptSceneId, setRegeneratingPromptSceneId] = useState<string | null>(null);
  const [editingPromptSceneId, setEditingPromptSceneId] = useState<string | null>(null);
  const [editingPromptText, setEditingPromptText] = useState<string>('');

  // 4. Glosarium Candidate States
  const [detectedEntities, setDetectedEntities] = useState<DetectedEntityCandidate[]>(
    initialChapter.aiDetectedEntities || []
  );
  const [registeredEntityIds, setRegisteredEntityIds] = useState<Record<string, boolean>>({});
  const [registeredAliasIds, setRegisteredAliasIds] = useState<Record<string, boolean>>({});

  // Sync internal state when prop changes
  useEffect(() => {
    setChapter(initialChapter);
    setPremiseText(initialChapter.premise || '');
    setChapterNotes(initialChapter.notes || '');
    setTargetWords(String(initialChapter.targetWordCount || 1500));

    if (initialChapter.rawDrafts && initialChapter.rawDrafts.length > 0) {
      setRawDrafts(initialChapter.rawDrafts);
      if (initialChapter.activeRawDraftId) {
        setActiveRawId(initialChapter.activeRawDraftId);
      }
    }

    if (initialChapter.aiDetectedEntities) {
      setDetectedEntities(initialChapter.aiDetectedEntities);
    }
  }, [initialChapter]);

  const activeRawDraft =
    rawDrafts.find((r) => r.id === activeRawId) || rawDrafts[0];

  // Helper to strip HTML tags for plain text reading
  const stripHtml = (html: string) => {
    const tmp = document.createElement('DIV');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  const plainContent = stripHtml(chapter.contentHtml || '').trim();
  const wordCount = chapter.wordCount || (plainContent ? plainContent.split(/\s+/).filter(Boolean).length : 0);
  const readingTime = Math.ceil(wordCount / 200);

  // Status configuration
  const statusMeta: Record<ChapterStatus, { label: string; bg: string; dot: string }> = {
    planned: {
      label: 'Direncanakan',
      bg: 'bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/30',
      dot: 'bg-purple-500 dark:bg-purple-400',
    },
    in_progress: {
      label: 'Sedang Ditulis',
      bg: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30',
      dot: 'bg-amber-500 dark:bg-amber-400',
    },
    completed: {
      label: 'Selesai',
      bg: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30',
      dot: 'bg-emerald-500 dark:bg-emerald-400',
    },
  };

  // Atomic field updater preventing React closure overwrite bugs
  const updateChapterField = async <K extends keyof StoryChapter>(
    field: K,
    value: StoryChapter[K]
  ) => {
    await db.chapters.update(chapter.id, {
      [field]: value,
      updatedAt: Date.now(),
    });
    const fresh = await db.chapters.get(chapter.id);
    if (fresh) {
      setChapter(fresh);
      onChapterUpdated?.(fresh);
    }
  };

  // Quick Status Toggle
  const handleToggleStatus = async () => {
    const nextStatusMap: Record<ChapterStatus, ChapterStatus> = {
      planned: 'in_progress',
      in_progress: 'completed',
      completed: 'planned',
    };
    const newStatus = nextStatusMap[chapter.status];
    await updateChapterField('status', newStatus);
  };

  // Save Premise & Brief
  const handleSavePremise = async () => {
    await db.chapters.update(chapter.id, {
      premise: premiseText.trim(),
      notes: chapterNotes.trim(),
      targetWordCount: parseInt(targetWords) || 1500,
      updatedAt: Date.now(),
    });
    const fresh = await db.chapters.get(chapter.id);
    if (fresh) {
      setChapter(fresh);
      onChapterUpdated?.(fresh);
    }
    setIsSavedPremise(true);
    setTimeout(() => setIsSavedPremise(false), 2000);
  };

  // Raw Draft Handlers
  const handleUpdateRawContent = (content: string) => {
    const updatedDrafts = rawDrafts.map((r) =>
      r.id === activeRawDraft.id
        ? { ...r, content, updatedAt: Date.now() }
        : r
    );
    setRawDrafts(updatedDrafts);
    debouncedSaveRawDrafts(updatedDrafts, activeRawDraft.id);
  };

  const handleUpdateRawTitle = (title: string) => {
    const updatedDrafts = rawDrafts.map((r) =>
      r.id === activeRawDraft.id
        ? { ...r, title, updatedAt: Date.now() }
        : r
    );
    setRawDrafts(updatedDrafts);
    saveRawDraftsToDb(updatedDrafts, activeRawDraft.id);
  };

  const handleAddRawDraft = () => {
    const newId = 'raw_' + Math.random().toString(36).substring(2, 9);
    const newDraft: ChapterRawDraft = {
      id: newId,
      title: `Coretan Kasar ${rawDrafts.length + 1}`,
      content: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const updated = [...rawDrafts, newDraft];
    setRawDrafts(updated);
    setActiveRawId(newId);
    saveRawDraftsToDb(updated, newId);
  };

  const handleDeleteRawDraft = (draftId: string) => {
    if (rawDrafts.length <= 1) {
      alert('Minimal harus ada satu lembar draf kasar.');
      return;
    }
    if (confirm('Hapus lembar tulisan kasar ini?')) {
      const filtered = rawDrafts.filter((r) => r.id !== draftId);
      setRawDrafts(filtered);
      setActiveRawId(filtered[0].id);
      saveRawDraftsToDb(filtered, filtered[0].id);
    }
  };

  const saveRawDraftsToDb = async (drafts: ChapterRawDraft[], activeId: string) => {
    await db.chapters.update(chapter.id, {
      rawDrafts: drafts,
      activeRawDraftId: activeId,
      updatedAt: Date.now(),
    });
    const fresh = await db.chapters.get(chapter.id);
    if (fresh) {
      setChapter(fresh);
      onChapterUpdated?.(fresh);
    }
  };

  // Debounced save for raw draft typing
  const debouncedSaveRawDrafts = (() => {
    let timer: any = null;
    return (drafts: ChapterRawDraft[], activeId: string) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        saveRawDraftsToDb(drafts, activeId);
      }, 700);
    };
  })();

  // Copy raw draft text directly to main chapter draft
  const handleTransferRawToMain = async () => {
    if (!activeRawDraft.content.trim()) {
      alert('Tulisan kasar masih kosong.');
      return;
    }
    if (
      confirm(
        'Gabungkan tulisan kasar ini ke naskah utama? (Akan ditambahkan di bagian bawah naskah cerita)'
      )
    ) {
      const rawParagraphs = activeRawDraft.content
        .split('\n\n')
        .map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
        .join('');

      const newContentHtml = chapter.contentHtml
        ? `${chapter.contentHtml}<br/><br/>${rawParagraphs}`
        : rawParagraphs;

      const words = stripHtml(newContentHtml).split(/\s+/).filter(Boolean).length;
      await db.chapters.update(chapter.id, {
        contentHtml: newContentHtml,
        wordCount: words,
        status: chapter.status === 'planned' ? 'in_progress' : chapter.status,
        updatedAt: Date.now(),
      });
      const fresh = await db.chapters.get(chapter.id);
      if (fresh) {
        setChapter(fresh);
        onChapterUpdated?.(fresh);
      }
      alert('Tulisan kasar berhasil digabungkan ke Naskah Utama!');
      setActiveTab('main');
    }
  };

  // AI Polish Raw Draft to Prose
  const handlePolishRawWithAi = async () => {
    if (!activeRawDraft.content.trim()) {
      alert('Tulis draf kasar terlebih dahulu sebelum dipoles AI.');
      return;
    }
    setIsPolishingAi(true);
    setAiStudioError(null);
    try {
      const result = await enhanceRawToProse(
        activeRawDraft.content,
        book.title,
        chapter.title,
        book.genre
      );
      setPolishedAiResult(result);
    } catch (err: any) {
      setAiStudioError(err.message || 'Gagal memoles dengan AI.');
    } finally {
      setIsPolishingAi(false);
    }
  };

  // Apply AI Polished Result to Main Chapter
  const handleApplyPolishedToMain = async () => {
    if (!polishedAiResult) return;
    const formattedHtml = polishedAiResult
      .split('\n\n')
      .map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
      .join('');

    const newContentHtml = chapter.contentHtml
      ? `${chapter.contentHtml}<br/><br/>${formattedHtml}`
      : formattedHtml;

    const words = stripHtml(newContentHtml).split(/\s+/).filter(Boolean).length;
    await db.chapters.update(chapter.id, {
      contentHtml: newContentHtml,
      wordCount: words,
      status: chapter.status === 'planned' ? 'in_progress' : chapter.status,
      updatedAt: Date.now(),
    });
    const fresh = await db.chapters.get(chapter.id);
    if (fresh) {
      setChapter(fresh);
      onChapterUpdated?.(fresh);
    }
    setPolishedAiResult(null);
    alert('Naskah hasil polesan AI berhasil disatukan ke Naskah Utama!');
    setActiveTab('main');
  };

  // ==========================================
  // AI STUDIO HANDLERS (Atomic & Non-destructive)
  // ==========================================
  const getEffectiveSourceText = () => {
    if (plainContent.length > 50) return plainContent;
    if (activeRawDraft.content.trim().length > 30) return activeRawDraft.content;
    if (premiseText.trim().length > 20) return premiseText;
    return '';
  };

  // 1. Generate Summary (Atomic)
  const handleGenerateSummary = async () => {
    const text = getEffectiveSourceText();
    if (!text) {
      setAiStudioError('Belum ada isi naskah atau draf kasar untuk dirangkum.');
      return;
    }
    setIsGeneratingSummary(true);
    setAiStudioError(null);
    try {
      const summary = await generateChapterSummary(chapter.title, book.title, text);
      await updateChapterField('aiSummary', summary);
    } catch (err: any) {
      setAiStudioError(err.message || 'Gagal generate ringkasan AI.');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  // 2. Generate Plot (Atomic)
  const handleGeneratePlot = async () => {
    const text = getEffectiveSourceText();
    if (!text && !premiseText) {
      setAiStudioError('Isi premis atau naskah bab terlebih dahulu untuk memetakan plot.');
      return;
    }
    setIsGeneratingPlot(true);
    setAiStudioError(null);
    try {
      const plot = await generateChapterAutoPlot(chapter.title, book.title, text, premiseText);
      await updateChapterField('aiPlot', plot);
    } catch (err: any) {
      setAiStudioError(err.message || 'Gagal memetakan plot AI.');
    } finally {
      setIsGeneratingPlot(false);
    }
  };

  // 3. Generate Scenes (Atomic)
  const handleGenerateScenes = async () => {
    const text = getEffectiveSourceText();
    if (!text) {
      setAiStudioError('Isi naskah cerita atau draf kasar bab terlebih dahulu untuk membedah adegan.');
      return;
    }
    setIsGeneratingScenes(true);
    setAiStudioError(null);
    try {
      const existingEntities = await db.worldEntities.where('bookId').equals(book.id).toArray();
      const scenes = await generateChapterAutoScenes(
        chapter.title,
        book.title,
        text,
        existingEntities,
        imagePromptSettings
      );
      await updateChapterField('aiScenes', scenes);
    } catch (err: any) {
      setAiStudioError(err.message || 'Gagal membedah adegan AI.');
    } finally {
      setIsGeneratingScenes(false);
    }
  };

  // 4. Detect Entities & Aliases (Atomic)
  const handleDetectEntities = async () => {
    const text = getEffectiveSourceText();
    if (!text) {
      setAiStudioError('Isi naskah cerita atau draf kasar terlebih dahulu untuk mendeteksi entitas.');
      return;
    }
    setIsDetectingEntities(true);
    setAiStudioError(null);
    try {
      const existingEntities = await db.worldEntities.where('bookId').equals(book.id).toArray();
      const detected = await detectEntitiesAndAliases(text, book.title, existingEntities);
      await updateChapterField('aiDetectedEntities', detected);
      setDetectedEntities(detected);
    } catch (err: any) {
      setAiStudioError(err.message || 'Gagal memindai entitas glosarium.');
    } finally {
      setIsDetectingEntities(false);
    }
  };

  // ⚡ 5. GENERATE ALL ANALYTICS AT ONCE (Pipelined & Preserving All Results)
  const handleGenerateAll = async () => {
    const text = getEffectiveSourceText();
    if (!text && !premiseText) {
      setAiStudioError('Isi premis atau naskah bab terlebih dahulu untuk memulai analisis AI.');
      return;
    }
    setIsGeneratingAll(true);
    setAiStudioError(null);
    try {
      // Step 1: Summary
      setGenerateAllStep('1/4 Meringkas naskah cerita bab...');
      const summary = await generateChapterSummary(chapter.title, book.title, text || premiseText);
      await db.chapters.update(chapter.id, { aiSummary: summary, updatedAt: Date.now() });

      // Step 2: Plot
      setGenerateAllStep('2/4 Memetakan 4 dinamika struktur plot...');
      const plot = await generateChapterAutoPlot(chapter.title, book.title, text, premiseText);
      await db.chapters.update(chapter.id, { aiPlot: plot, updatedAt: Date.now() });

      // Step 3: Scenes
      setGenerateAllStep('3/4 Mengurai timeline adegan & prompt visual...');
      const existingEntities = await db.worldEntities.where('bookId').equals(book.id).toArray();
      const scenes = await generateChapterAutoScenes(
        chapter.title,
        book.title,
        text || premiseText,
        existingEntities,
        imagePromptSettings
      );
      await db.chapters.update(chapter.id, { aiScenes: scenes, updatedAt: Date.now() });

      // Step 4: Entities & Aliases
      setGenerateAllStep('4/4 Memindai entitas baru & alias...');
      const detected = await detectEntitiesAndAliases(text || premiseText, book.title, existingEntities);
      await db.chapters.update(chapter.id, { aiDetectedEntities: detected, updatedAt: Date.now() });

      // Fetch fresh record from DB so state is 100% synchronized
      const fresh = await db.chapters.get(chapter.id);
      if (fresh) {
        setChapter(fresh);
        setDetectedEntities(detected);
        onChapterUpdated?.(fresh);
      }
    } catch (err: any) {
      console.error('Gagal Generate All:', err);
      setAiStudioError(err.message || 'Gagal menjalankan Generate All.');
    } finally {
      setIsGeneratingAll(false);
      setGenerateAllStep('');
    }
  };

  // Regenerate prompt for a single scene
  const handleRegenerateScenePrompt = async (scene: ChapterSceneItem) => {
    setRegeneratingPromptSceneId(scene.id);
    setAiStudioError(null);
    try {
      const newPrompt = await generateSingleSceneImagePrompt(
        scene,
        book.title,
        chapter.title,
        imagePromptSettings
      );
      const updatedScenes = (chapter.aiScenes || []).map((s) =>
        s.id === scene.id ? { ...s, imagePrompt: newPrompt } : s
      );
      await updateChapterField('aiScenes', updatedScenes);
    } catch (err: any) {
      setAiStudioError(err.message || 'Gagal generate prompt gambar adegan.');
    } finally {
      setRegeneratingPromptSceneId(null);
    }
  };

  // Start editing prompt
  const handleStartEditPrompt = (scene: ChapterSceneItem) => {
    setEditingPromptSceneId(scene.id);
    setEditingPromptText(scene.imagePrompt || '');
  };

  // Save edited prompt
  const handleSaveEditedPrompt = async (sceneId: string) => {
    const updatedScenes = (chapter.aiScenes || []).map((s) =>
      s.id === sceneId ? { ...s, imagePrompt: editingPromptText } : s
    );
    await updateChapterField('aiScenes', updatedScenes);
    setEditingPromptSceneId(null);
  };

  // Save global image prompt settings
  const handleSaveImageSettings = (newSettings: ImagePromptSettings) => {
    setImagePromptSettings(newSettings);
    localStorage.setItem('schemax_image_prompt_settings', JSON.stringify(newSettings));
    setShowImageSettingsModal(false);
  };

  // Reset image prompt settings to default
  const handleResetImageSettings = () => {
    setTempImageSettings(DEFAULT_IMAGE_SETTINGS);
  };

  // Register New Entity to Glosarium
  const handleRegisterNewEntity = async (candidate: DetectedEntityCandidate) => {
    try {
      const newEntity: WorldEntity = {
        id: 'ent_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
        bookId: book.id,
        category: candidate.category,
        name: candidate.name,
        aliases: [],
        shortDescription: candidate.shortDescription,
        detailedNotes: `Dideteksi otomatis dari Bab ${chapter.order}: ${chapter.title}.`,
        tags: [candidate.category],
        galleryMediaIds: [],
        attributes: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await db.worldEntities.add(newEntity);
      setRegisteredEntityIds((prev) => ({ ...prev, [candidate.id]: true }));
    } catch (err) {
      console.error('Gagal menambahkan ke glosarium:', err);
      alert('Gagal mendaftarkan entitas ke Glosarium.');
    }
  };

  // Add Alias to Existing Entity
  const handleAddAliasToExisting = async (candidate: DetectedEntityCandidate) => {
    try {
      const existingEntities = await db.worldEntities.where('bookId').equals(book.id).toArray();
      const target = existingEntities.find(
        (e) =>
          e.id === candidate.existingEntityId ||
          e.name.toLowerCase() === candidate.detectedAliasOf?.toLowerCase()
      );
      if (target) {
        const currentAliases = target.aliases || [];
        const updatedAliases = Array.from(new Set([...currentAliases, candidate.name]));
        await db.worldEntities.update(target.id, {
          aliases: updatedAliases,
          updatedAt: Date.now(),
        });
        setRegisteredAliasIds((prev) => ({ ...prev, [candidate.id]: true }));
      } else {
        alert(`Entitas target "${candidate.detectedAliasOf}" tidak ditemukan di database.`);
      }
    } catch (err) {
      console.error('Gagal menambahkan alias:', err);
      alert('Gagal menyimpan alias entitas.');
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopyFeedback(label);
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans">
      {/* 🌟 1. Top Chapter Studio Header */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-3 sm:px-6 py-2.5 sm:py-3 safe-top shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          {/* Left: Back & Title info */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="p-2 -ml-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white active:scale-95 transition"
              aria-label="Kembali ke Daftar Bab"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  Bab {chapter.order}
                </span>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <button
                  type="button"
                  onClick={handleToggleStatus}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusMeta[chapter.status].bg} active:scale-95 transition`}
                  title="Ketuk untuk ubah status bab"
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${statusMeta[chapter.status].dot}`} />
                  <span>{statusMeta[chapter.status].label}</span>
                </button>
              </div>

              <h1 className="text-sm sm:text-base font-extrabold truncate text-slate-900 dark:text-white leading-tight">
                {chapter.title}
              </h1>
            </div>
          </div>

          {/* Right: Primary Action to Open Fullscreen RichText Editor */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => onOpenEditor(chapter)}
              className="py-2 px-3 sm:px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-95 text-slate-950 font-bold text-xs sm:text-sm shadow-md shadow-amber-500/20 transition flex items-center gap-1.5"
            >
              <Edit3 className="w-4 h-4" />
              <span>Poles Naskah Utama</span>
            </button>
          </div>
        </div>

        {/* 📑 2. Studio Workstation Navigation Tabs */}
        <div className="max-w-5xl mx-auto flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-2.5">
          <button
            type="button"
            onClick={() => setActiveTab('premise')}
            className={`py-1.5 px-3 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
              activeTab === 'premise'
                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Compass className="w-3.5 h-3.5 text-amber-500" />
            <span>1. Cerita Singkat &amp; Premis</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('raw')}
            className={`py-1.5 px-3 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
              activeTab === 'raw'
                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-amber-500" />
            <span>2. Tulisan Kasar (Raw)</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
              {rawDrafts.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('main')}
            className={`py-1.5 px-3 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
              activeTab === 'main'
                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-amber-500" />
            <span>3. Naskah Cerita Utama</span>
            <span className="text-[10px] text-slate-400">({wordCount} kata)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ai')}
            className={`py-1.5 px-3 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
              activeTab === 'ai'
                ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            <span>4. AI Studio (Plot &amp; Scene &amp; Lore)</span>
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
          </button>
        </div>
      </header>

      {/* 📦 Main Workstation Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-3 sm:p-6 space-y-4">
        {/* Error notification banner if any */}
        {aiStudioError && (
          <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 flex items-start gap-2.5 text-xs text-red-700 dark:text-red-300 animate-in fade-in">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-500" />
            <div className="flex-1 leading-relaxed">{aiStudioError}</div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 1: CERITA SINGKAT & PREMIS BAB                                        */}
        {/* ========================================================================= */}
        {activeTab === 'premise' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <Compass className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      Cerita Singkat &amp; Premis Bab
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Rancang garis besar alur sebelum mulai menuangkan naskah lengkap
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSavePremise}
                  className="py-2 px-3.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-bold text-xs flex items-center gap-1.5 active:scale-95 transition shadow-sm"
                >
                  {isSavedPremise ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Tersimpan!</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Simpan Konsep</span>
                    </>
                  )}
                </button>
              </div>

              {/* Premise Editor */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Rangkuman Singkat Isi Bab *
                </label>
                <textarea
                  rows={4}
                  value={premiseText}
                  onChange={(e) => setPremiseText(e.target.value)}
                  placeholder="Ceritakan apa yang akan terjadi di bab ini secara singkat: Siapa yang bertemu, apa masalah yang muncul, dan kejutan apa yang terjadi..."
                  className="w-full p-3.5 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:border-amber-500 transition shadow-inner leading-relaxed resize-none"
                />
              </div>

              {/* Target & Research Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Target Kata Bab Ini
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={targetWords}
                      onChange={(e) => setTargetWords(e.target.value)}
                      placeholder="1500"
                      className="w-full py-2.5 px-3.5 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-amber-500 shadow-inner"
                    />
                    <span className="absolute right-3.5 top-2.5 text-xs text-slate-400 pointer-events-none">
                      kata
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Catatan Khusus / Riset Bab
                  </label>
                  <input
                    type="text"
                    value={chapterNotes}
                    onChange={(e) => setChapterNotes(e.target.value)}
                    placeholder="Contoh: Suasana hujan lebat, senjata panah perak..."
                    className="w-full py-2.5 px-3.5 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-amber-500 shadow-inner"
                  />
                </div>
              </div>

              {/* Next Step Banner */}
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-500/10 border border-amber-200/80 dark:border-amber-500/20 text-xs">
                <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
                  <Sparkles className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  <span>
                    Setelah premis siap, mulai tulis ide kasar di <strong>Tab Tulisan Kasar (Raw)</strong> sebelum dipoles.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('raw')}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold flex items-center justify-center gap-1 active:scale-95 transition"
                >
                  <span>Buka Tulisan Kasar</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: TULISAN KASAR (MULTI-RAW DRAFTS WORKSPACE)                          */}
        {/* ========================================================================= */}
        {activeTab === 'raw' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-6 shadow-sm space-y-4">
              {/* Header & Multi-Raw Tab Selector */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-amber-500" />
                    <span>Ruang Coretan Kasar (Raw Drafts)</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Tulis ide spontan, coretan dialog, atau alur mentah tanpa takut merusak naskah utama
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAddRawDraft}
                    className="py-1.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 transition active:scale-95 border border-slate-200 dark:border-slate-700"
                  >
                    <Plus className="w-3.5 h-3.5 text-amber-500" />
                    <span>+ Lembar Raw Baru</span>
                  </button>
                </div>
              </div>

              {/* Draft Switcher Tabs */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                {rawDrafts.map((draft, idx) => (
                  <div
                    key={draft.id}
                    className={`flex items-center gap-1 py-1.5 px-3 rounded-xl text-xs font-bold transition flex-shrink-0 cursor-pointer ${
                      draft.id === activeRawId
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                    onClick={() => setActiveRawId(draft.id)}
                  >
                    <span>{draft.title || `Raw ${idx + 1}`}</span>
                    {rawDrafts.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteRawDraft(draft.id);
                        }}
                        className="p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/20 transition ml-1"
                        title="Hapus lembar raw ini"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Title input for active raw */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-semibold">Nama Lembar:</span>
                <input
                  type="text"
                  value={activeRawDraft.title}
                  onChange={(e) => handleUpdateRawTitle(e.target.value)}
                  className="px-2.5 py-1 bg-transparent border-b border-dashed border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-amber-500 max-w-xs"
                />
              </div>

              {/* Raw Textarea */}
              <div className="relative">
                <textarea
                  rows={10}
                  value={activeRawDraft.content}
                  onChange={(e) => handleUpdateRawContent(e.target.value)}
                  placeholder="Ketik coretan bebas di sini... Contoh:&#10;- Budi berlari ke pasar&#10;- Ketemu pedagang misterius berkerudung hijau&#10;- Dialog: 'Bawa ini sebelum matahari tenggelam!'&#10;- Tiba-tiba ada suara ledakan di arah benteng..."
                  className="w-full p-4 bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-slate-100 placeholder-slate-400 text-sm focus:outline-none focus:border-amber-500 font-mono transition shadow-inner leading-relaxed"
                />
                <span className="absolute right-3 bottom-3 text-[11px] text-slate-400 font-sans pointer-events-none">
                  {activeRawDraft.content.length} karakter • Otomatis tersimpan
                </span>
              </div>

              {/* Actions on Raw Draft */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePolishRawWithAi}
                    disabled={isPolishingAi || !activeRawDraft.content.trim()}
                    className="py-2 px-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200 dark:border-indigo-500/30 hover:bg-indigo-100 dark:hover:bg-indigo-500/25 text-indigo-700 dark:text-indigo-300 text-xs font-bold flex items-center gap-1.5 active:scale-95 transition disabled:opacity-50"
                  >
                    {isPolishingAi ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Menyulap Jadi Prosa...</span>
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-3.5 h-3.5 text-amber-500" />
                        <span>Poles dengan AI ✨</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTransferRawToMain}
                    disabled={!activeRawDraft.content.trim()}
                    className="py-2 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-xs font-bold flex items-center gap-1.5 active:scale-95 transition shadow-sm disabled:opacity-50"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin ke Naskah Utama 📋</span>
                  </button>
                </div>
              </div>

              {/* AI Polished Preview Area if Available */}
              {polishedAiResult && (
                <div className="p-4 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-500/30 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-800 dark:text-indigo-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>Hasil Polesan AI (Prosa Siap Pakai)</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setPolishedAiResult(null)}
                      className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      Tutup
                    </button>
                  </div>

                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl text-xs text-slate-800 dark:text-slate-200 leading-relaxed max-h-60 overflow-y-auto whitespace-pre-line border border-slate-200 dark:border-slate-800">
                    {polishedAiResult}
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(polishedAiResult, 'prose')}
                      className="py-1.5 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                    >
                      {copyFeedback === 'prose' ? 'Tersalin!' : 'Salin Teks'}
                    </button>
                    <button
                      type="button"
                      onClick={handleApplyPolishedToMain}
                      className="py-1.5 px-3.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-bold shadow-md shadow-indigo-500/20 active:scale-95 transition"
                    >
                      Satukan ke Naskah Utama ➔
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: NASKAH CERITA UTAMA (POLISHED READER & DIRECT LAUNCH)               */}
        {/* ========================================================================= */}
        {activeTab === 'main' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-7 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-500" />
                    <span>Naskah Cerita Utama</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Naskah resmi bab yang telah dipoles dan siap dinikmati pembaca
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenEditor(chapter)}
                    className="py-2 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-95 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition flex items-center gap-1.5"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Buka Editor Poles Naskah ✍️</span>
                  </button>
                </div>
              </div>

              {chapter.contentHtml && plainContent.length > 0 ? (
                <div className="space-y-4">
                  <div
                    className="prose dark:prose-invert max-w-none text-slate-800 dark:text-slate-200 text-sm leading-relaxed p-4 sm:p-6 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 rounded-2xl max-h-[60vh] overflow-y-auto"
                    dangerouslySetInnerHTML={{ __html: chapter.contentHtml }}
                  />

                  {/* Word Count & Stats Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800/60 text-xs text-slate-600 dark:text-slate-300">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1 font-bold text-slate-900 dark:text-white">
                        <FileText className="w-3.5 h-3.5 text-amber-500" />
                        {wordCount.toLocaleString()} Kata
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        ±{readingTime} Menit Baca
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400">
                      Terakhir diperbarui: {new Date(chapter.updatedAt).toLocaleDateString('id-ID')}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 px-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-slate-50/50 dark:bg-slate-950/30 space-y-3">
                  <FileText className="w-10 h-10 mx-auto text-slate-400 dark:text-slate-600" />
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Naskah Utama Masih Kosong
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                    Anda dapat menulis ide kasar terlebih dahulu di tab <strong>Tulisan Kasar (Raw)</strong>, atau langsung mulai memoles cerita lengkap di Fullscreen Editor.
                  </p>
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('raw')}
                      className="py-2 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-semibold text-xs transition"
                    >
                      Buka Tulisan Kasar
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenEditor(chapter)}
                      className="py-2 px-4 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 active:scale-95 transition flex items-center gap-1.5"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Mulai Menulis Naskah</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: AI INTELLIGENCE STUDIO (4 Sub-Sheets, Compact Generate All, Prompt) */}
        {/* ========================================================================= */}
        {activeTab === 'ai' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* 🚀 COMPACT TOOLBAR: 4 SUB-SHEETS SWITCHER + SPACE-EFFICIENT GENERATE ALL */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              {/* 4 Sheets Segmented Navigation */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                <button
                  type="button"
                  onClick={() => setAiSubSheet('summary')}
                  className={`py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                    aiSubSheet === 'summary'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>1. Ringkasan</span>
                  {chapter.aiSummary && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                </button>

                <button
                  type="button"
                  onClick={() => setAiSubSheet('plot')}
                  className={`py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                    aiSubSheet === 'plot'
                      ? 'bg-amber-500 text-slate-950 shadow-sm font-extrabold'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>2. Auto Plot</span>
                  {chapter.aiPlot && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                </button>

                <button
                  type="button"
                  onClick={() => setAiSubSheet('scenes')}
                  className={`py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                    aiSubSheet === 'scenes'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <Film className="w-3.5 h-3.5" />
                  <span>3. Auto Scene &amp; Visual</span>
                  {chapter.aiScenes && chapter.aiScenes.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-purple-200 dark:bg-purple-900/60 text-purple-900 dark:text-purple-200 font-extrabold">
                      {chapter.aiScenes.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setAiSubSheet('glosarium')}
                  className={`py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                    aiSubSheet === 'glosarium'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>4. Glosarium &amp; Alias</span>
                  {detectedEntities && detectedEntities.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-200 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200 font-extrabold">
                      {detectedEntities.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Compact Generate All Button (Space-efficient) */}
              <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={handleGenerateAll}
                  disabled={isGeneratingAll}
                  title="Jalankan otomatis 4 modul: Ringkasan, Plot, Auto Scene &amp; Prompt Gambar, Glosarium &amp; Alias"
                  className="py-1.5 px-3.5 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-amber-500 hover:opacity-95 active:scale-95 text-white font-black text-xs shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isGeneratingAll ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-200" />
                      <span className="text-[11px] truncate max-w-[170px]">
                        {generateAllStep || 'Menganalisis...'}
                      </span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>Generate All ✨</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Error Message if any */}
            {aiStudioError && (
              <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between gap-2 animate-in fade-in">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{aiStudioError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setAiStudioError(null)}
                  className="text-xs font-bold hover:underline"
                >
                  Tutup
                </button>
              </div>
            )}

            {/* ============================================================ */}
            {/* SHEET 1: RINGKASAN CERITA BAB (AI Summary)                   */}
            {/* ============================================================ */}
            {aiSubSheet === 'summary' && (
              <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-6 shadow-sm space-y-4 animate-in fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                        Ringkasan AI Bab Cerita
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Rangkuman esensial dari isi bab untuk menjaga kontinuitas &amp; memori alur
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleGenerateSummary}
                    disabled={isGeneratingSummary || isGeneratingAll}
                    className="py-2 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-xs shadow-md shadow-indigo-500/20 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {isGeneratingSummary ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Meringkas...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        <span>{chapter.aiSummary ? 'Perbarui Ringkasan ✨' : 'Generate Ringkasan AI ✨'}</span>
                      </>
                    )}
                  </button>
                </div>

                {chapter.aiSummary ? (
                  <div className="p-4 sm:p-5 rounded-2xl bg-indigo-50/60 dark:bg-slate-950/60 border border-indigo-200/80 dark:border-indigo-500/20 text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed space-y-3">
                    <p className="whitespace-pre-line">{chapter.aiSummary}</p>
                    <div className="flex justify-end pt-2 border-t border-indigo-100 dark:border-indigo-950">
                      <button
                        type="button"
                        onClick={() => copyToClipboard(chapter.aiSummary || '', 'summary')}
                        className="py-1 px-3 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-semibold hover:bg-indigo-200 dark:hover:bg-indigo-800 transition flex items-center gap-1.5"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>{copyFeedback === 'summary' ? '✓ Tersalin!' : 'Salin Ringkasan'}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-10 px-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-950/20 text-xs text-slate-500 dark:text-slate-400 space-y-2">
                    <FileText className="w-8 h-8 mx-auto text-slate-400 dark:text-slate-600" />
                    <p>Belum ada ringkasan AI untuk bab ini.</p>
                    <p className="text-[11px] text-slate-400">
                      Ketuk tombol <strong>Generate Ringkasan AI</strong> di kanan atas atau gunakan <strong>Generate All</strong>.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ============================================================ */}
            {/* SHEET 2: AUTO PLOT BY AI (Hook, Rising, Climax, Resolution)  */}
            {/* ============================================================ */}
            {aiSubSheet === 'plot' && (
              <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-6 shadow-sm space-y-4 animate-in fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                        Auto Plot by AI
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Pemetaan 4 dinamika struktur cerita: Hook, Eskalasi, Puncak Konflik, &amp; Penutup
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleGeneratePlot}
                    disabled={isGeneratingPlot || isGeneratingAll}
                    className="py-2 px-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-95 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {isGeneratingPlot ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Memetakan Plot...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{chapter.aiPlot ? 'Petakan Ulang Plot ✨' : 'Petakan Struktur Plot ✨'}</span>
                      </>
                    )}
                  </button>
                </div>

                {chapter.aiPlot ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                    {/* Hook */}
                    <div className="p-4 rounded-2xl bg-cyan-50/70 dark:bg-cyan-950/20 border border-cyan-200/80 dark:border-cyan-500/30 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-black uppercase text-cyan-800 dark:text-cyan-400">
                        <span className="w-2 h-2 rounded-full bg-cyan-500" />
                        <span>1. Hook (Pemicu &amp; Daya Tarik)</span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                        {chapter.aiPlot.hook || 'Belum terdeteksi'}
                      </p>
                    </div>

                    {/* Rising Action */}
                    <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-200/80 dark:border-indigo-500/30 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-black uppercase text-indigo-800 dark:text-indigo-400">
                        <span className="w-2 h-2 rounded-full bg-indigo-500" />
                        <span>2. Rising Action (Eskalasi Ketegangan)</span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                        {chapter.aiPlot.risingAction || 'Belum terdeteksi'}
                      </p>
                    </div>

                    {/* Climax */}
                    <div className="p-4 rounded-2xl bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-500/30 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-black uppercase text-rose-800 dark:text-rose-400">
                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                        <span>3. Climax (Puncak Konflik)</span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                        {chapter.aiPlot.climax || 'Belum terdeteksi'}
                      </p>
                    </div>

                    {/* Resolution */}
                    <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-500/30 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-black uppercase text-emerald-800 dark:text-emerald-400">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span>4. Resolution (Penutup / Cliffhanger)</span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                        {chapter.aiPlot.resolution || 'Belum terdeteksi'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-10 px-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-950/20 text-xs text-slate-500 dark:text-slate-400 space-y-2">
                    <TrendingUp className="w-8 h-8 mx-auto text-slate-400 dark:text-slate-600" />
                    <p>Belum ada analisis plot untuk bab ini.</p>
                    <p className="text-[11px] text-slate-400">
                      Ketuk tombol <strong>Petakan Struktur Plot</strong> untuk menganalisis 4 titik ketegangan cerita.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ============================================================ */}
            {/* SHEET 3: AUTO SCENE & VISUAL PROMPT (Glosarium & Image Prompt)*/}
            {/* ============================================================ */}
            {aiSubSheet === 'scenes' && (
              <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-6 shadow-sm space-y-4 animate-in fade-in">
                {/* Header Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                      <Film className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                        Auto Scene by AI (Timeline, Glosarium &amp; Visual Prompt)
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Pembedahan adegan berurutan, informasi glosarium terkait, dan prompt gambar AI untuk tiap adegan
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    {/* Settings Trigger Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setTempImageSettings(imagePromptSettings);
                        setShowImageSettingsModal(true);
                      }}
                      className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition flex items-center gap-1.5"
                    >
                      <Settings className="w-3.5 h-3.5 text-purple-500" />
                      <span>Setting Prompt Gambar</span>
                    </button>

                    {/* Generate Scenes Button */}
                    <button
                      type="button"
                      onClick={handleGenerateScenes}
                      disabled={isGeneratingScenes || isGeneratingAll}
                      className="py-2 px-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-bold text-xs shadow-md shadow-purple-500/20 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {isGeneratingScenes ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Membedah Adegan...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                          <span>
                            {chapter.aiScenes && chapter.aiScenes.length > 0
                              ? 'Bedah Ulang Adegan ✨'
                              : 'Bedah Pembagian Adegan ✨'}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Global Image Prompt Preset Indicator Bar */}
                <div className="flex items-center justify-between gap-2 p-2.5 rounded-2xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-500/20 text-xs text-purple-900 dark:text-purple-200">
                  <div className="flex items-center gap-2 overflow-hidden flex-wrap">
                    <span className="font-bold flex items-center gap-1.5 text-purple-800 dark:text-purple-300">
                      <ImageIcon className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                      <span>Preset Gambar Global:</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-purple-200/70 dark:bg-purple-900/50 font-mono text-[11px] font-bold">
                      {imagePromptSettings.aspectRatio}
                    </span>
                    <span className="text-slate-600 dark:text-slate-300 text-[11px] truncate max-w-sm">
                      {imagePromptSettings.style}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 font-mono">
                      [person1/person2]
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTempImageSettings(imagePromptSettings);
                      setShowImageSettingsModal(true);
                    }}
                    className="text-xs font-bold text-purple-700 dark:text-purple-300 hover:underline flex items-center gap-1 flex-shrink-0"
                  >
                    <Sliders className="w-3 h-3" />
                    <span>Ubah</span>
                  </button>
                </div>

                {/* Scene Blocks List */}
                {chapter.aiScenes && chapter.aiScenes.length > 0 ? (
                  <div className="space-y-4 pt-1 relative">
                    {/* Desktop timeline guide line */}
                    <div className="hidden sm:block absolute left-5 top-6 bottom-6 w-0.5 bg-gradient-to-b from-purple-500/30 via-indigo-500/30 to-amber-500/30 pointer-events-none" />

                    {chapter.aiScenes.map((scene, idx) => {
                      const isParallel = scene.timelineType === 'parallel' || scene.timelineType === 'branched';
                      const isFlashback = scene.timelineType === 'flashback';
                      const isRegeneratingThis = regeneratingPromptSceneId === scene.id;
                      const isEditingThis = editingPromptSceneId === scene.id;

                      return (
                        <div
                          key={scene.id || idx}
                          className={`relative sm:ml-9 p-4 sm:p-5 rounded-2xl border transition space-y-3.5 shadow-sm ${
                            isParallel
                              ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-300/80 dark:border-amber-500/30 hover:border-amber-400'
                              : isFlashback
                              ? 'bg-cyan-50/50 dark:bg-cyan-950/20 border-cyan-300/80 dark:border-cyan-500/30 hover:border-cyan-400'
                              : 'bg-slate-50 dark:bg-slate-950/70 border-slate-200 dark:border-slate-800/80 hover:border-purple-300 dark:hover:border-purple-500/40'
                          }`}
                        >
                          {/* Desktop node marker */}
                          <div
                            className={`hidden sm:flex absolute -left-[27px] top-4 w-5 h-5 rounded-full items-center justify-center text-[10px] font-bold text-white shadow-sm ${
                              isParallel
                                ? 'bg-amber-500 ring-4 ring-amber-500/20'
                                : isFlashback
                                ? 'bg-cyan-500 ring-4 ring-cyan-500/20'
                                : 'bg-purple-600 ring-4 ring-purple-500/20'
                            }`}
                          >
                            {scene.sceneNumber || idx + 1}
                          </div>

                          {/* 1. Header: Number, Title & Timeline Pill */}
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="sm:hidden px-2 py-0.5 rounded-lg bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 text-[10px] font-black uppercase">
                                Adegan {scene.sceneNumber || idx + 1}
                              </span>
                              <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
                                {scene.title}
                              </h4>

                              {/* Timeline Type Badge */}
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                  isParallel
                                    ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-500/30'
                                    : isFlashback
                                    ? 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-800 dark:text-cyan-300 border-cyan-300 dark:border-cyan-500/30'
                                    : 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30'
                                }`}
                              >
                                {isParallel ? (
                                  <>
                                    <GitBranch className="w-3 h-3 text-amber-500" />
                                    <span>Simultan / Bersamaan</span>
                                  </>
                                ) : isFlashback ? (
                                  <>
                                    <History className="w-3 h-3 text-cyan-500" />
                                    <span>Kilas Balik (Flashback)</span>
                                  </>
                                ) : (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-500" />
                                    <span>Linier (Kronologis)</span>
                                  </>
                                )}
                              </span>
                            </div>

                            {/* Time Marker & Setting Badge */}
                            {(scene.timeMarker || scene.setting) && (
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-800">
                                {scene.timeMarker && (
                                  <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                                    <Clock className="w-3 h-3 text-amber-500" />
                                    <span>{scene.timeMarker}</span>
                                  </span>
                                )}
                                {scene.timeMarker && scene.setting && <span>•</span>}
                                {scene.setting && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3 text-rose-500" />
                                    <span>{scene.setting}</span>
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* 2. Scene Story Summary */}
                          <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800/80">
                            <p className="text-xs sm:text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed">
                              {scene.summary}
                            </p>
                            {scene.goalConflict && (
                              <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
                                <span className="font-bold text-amber-600 dark:text-amber-400">Tujuan &amp; Konflik: </span>
                                <span>{scene.goalConflict}</span>
                              </div>
                            )}
                          </div>

                          {/* 3. 🛡️ INFORMASI GLOSARIUM DI ADEGAN INI (Tokoh, Latar, Item, Lore) */}
                          <div className="p-3 rounded-xl bg-slate-100/70 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800 space-y-2">
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                              <Shield className="w-3.5 h-3.5 text-emerald-500" />
                              <span>Informasi Glosarium di Adegan Ini:</span>
                            </div>

                            {scene.entitiesPresent && scene.entitiesPresent.length > 0 ? (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {scene.entitiesPresent.map((ent, eIdx) => {
                                  const iconMap: Record<WorldCategory, any> = {
                                    character: User,
                                    location: MapPin,
                                    item: Shield,
                                    lore: Tag,
                                  };
                                  const colorMap: Record<WorldCategory, string> = {
                                    character: 'text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-950/40 border-pink-200 dark:border-pink-800',
                                    location: 'text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/40 border-cyan-200 dark:border-cyan-800',
                                    item: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800',
                                    lore: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800',
                                  };
                                  const EntIcon = iconMap[ent.category] || User;
                                  const badgeClass = colorMap[ent.category] || colorMap.character;

                                  return (
                                    <span
                                      key={eIdx}
                                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border shadow-xs ${badgeClass}`}
                                    >
                                      <EntIcon className="w-3 h-3" />
                                      <span>{ent.name}</span>
                                    </span>
                                  );
                                })}
                              </div>
                            ) : scene.characters && scene.characters.length > 0 ? (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {scene.characters.map((char, cIdx) => (
                                  <span
                                    key={cIdx}
                                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800"
                                  >
                                    <User className="w-3 h-3" />
                                    <span>{char}</span>
                                  </span>
                                ))}
                                {scene.setting && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800">
                                    <MapPin className="w-3 h-3" />
                                    <span>{scene.setting}</span>
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">
                                Belum ada rincian entitas spesifik di adegan ini.
                              </span>
                            )}
                          </div>

                          {/* 4. 🎨 PROMPT PEMBUATAN GAMBAR ADEGAN (AI Image Generator) */}
                          <div className="p-3.5 rounded-xl bg-slate-900 text-slate-100 dark:bg-slate-950 border border-slate-800 space-y-2.5">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2">
                                <span className="p-1 rounded-md bg-purple-500/20 text-purple-400">
                                  <ImageIcon className="w-3.5 h-3.5" />
                                </span>
                                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                                  <span>Prompt Gambar Adegan (AI Image Generator)</span>
                                </span>
                                <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-purple-500/30 text-purple-300 border border-purple-500/40">
                                  {imagePromptSettings.aspectRatio}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5">
                                {scene.imagePrompt && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => copyToClipboard(scene.imagePrompt || '', `prompt_${scene.id}`)}
                                      className="py-1 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1"
                                      title="Salin Prompt untuk Midjourney, Flux, Stable Diffusion"
                                    >
                                      {copyFeedback === `prompt_${scene.id}` ? (
                                        <>
                                          <Check className="w-3 h-3 text-emerald-400" />
                                          <span className="text-emerald-400">Tersalin!</span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="w-3 h-3" />
                                          <span>Salin Prompt</span>
                                        </>
                                      )}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleStartEditPrompt(scene)}
                                      className="py-1 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
                                      title="Edit manual prompt"
                                    >
                                      <Edit3 className="w-3 h-3" />
                                    </button>
                                  </>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleRegenerateScenePrompt(scene)}
                                  disabled={isRegeneratingThis}
                                  className="py-1 px-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 active:scale-95 text-white text-xs font-bold transition flex items-center gap-1 disabled:opacity-50"
                                  title="Buat ulang prompt khusus adegan ini sesuai pengaturan gambar global"
                                >
                                  {isRegeneratingThis ? (
                                    <>
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                      <span>Membuat...</span>
                                    </>
                                  ) : (
                                    <>
                                      <RotateCcw className="w-3 h-3" />
                                      <span>{scene.imagePrompt ? 'Generate Ulang' : 'Buat Prompt Gambar'}</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>

                            {/* Prompt text display or editing mode */}
                            {isEditingThis ? (
                              <div className="space-y-2 pt-1">
                                <textarea
                                  value={editingPromptText}
                                  onChange={(e) => setEditingPromptText(e.target.value)}
                                  rows={3}
                                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-mono text-slate-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
                                />
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setEditingPromptSceneId(null)}
                                    className="px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200"
                                  >
                                    Batal
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEditedPrompt(scene.id)}
                                    className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-lg"
                                  >
                                    Simpan Perubahan
                                  </button>
                                </div>
                              </div>
                            ) : scene.imagePrompt ? (
                              <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] font-mono text-slate-300 leading-relaxed whitespace-pre-wrap select-all">
                                {scene.imagePrompt}
                              </div>
                            ) : (
                              <div className="text-[11px] text-slate-400 italic">
                                Belum ada prompt gambar untuk adegan ini. Ketuk tombol &quot;Buat Prompt Gambar&quot; di atas.
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-10 px-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-950/20 text-xs text-slate-500 dark:text-slate-400 space-y-2">
                    <Film className="w-8 h-8 mx-auto text-slate-400 dark:text-slate-600" />
                    <p>Belum ada pembagian adegan.</p>
                    <p className="text-[11px] text-slate-400">
                      Ketuk tombol <strong>Bedah Pembagian Adegan</strong> atau gunakan <strong>Generate All</strong>.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ============================================================ */}
            {/* SHEET 4: DETEKSI GLOSARIUM & ALIAS (Entity & Alias Detection)*/}
            {/* ============================================================ */}
            {aiSubSheet === 'glosarium' && (
              <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-6 shadow-sm space-y-4 animate-in fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                        Deteksi Glosarium &amp; Alias (Tokoh, Latar, Item)
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Pindai entitas baru untuk didaftarkan ke Worldbuilding serta julukan/alias dari objek yang sudah ada
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleDetectEntities}
                    disabled={isDetectingEntities || isGeneratingAll}
                    className="py-2 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs shadow-md shadow-emerald-500/20 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {isDetectingEntities ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Memindai Naskah...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        <span>
                          {detectedEntities.length > 0 ? 'Pindai Ulang Glosarium ✨' : 'Pindai Entitas & Alias ✨'}
                        </span>
                      </>
                    )}
                  </button>
                </div>

                {detectedEntities.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {detectedEntities.map((item) => {
                      const isNew = item.suggestedAction === 'register_new';
                      const isRegistered = registeredEntityIds[item.id];
                      const isAliasSaved = registeredAliasIds[item.id];

                      const categoryBadgeMap: Record<WorldCategory, { label: string; color: string; icon: any }> = {
                        character: { label: 'Karakter', color: 'text-pink-600 dark:text-pink-400 bg-pink-500/10 border-pink-500/30', icon: User },
                        location: { label: 'Lokasi', color: 'text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 border-cyan-500/30', icon: MapPin },
                        item: { label: 'Item / Senjata', color: 'text-yellow-600 dark:text-yellow-400 bg-yellow-500/10 border-yellow-500/30', icon: Shield },
                        lore: { label: 'Lore / Istilah', color: 'text-purple-600 dark:text-purple-400 bg-purple-500/10 border-purple-500/30', icon: Tag },
                      };

                      const catMeta = categoryBadgeMap[item.category] || categoryBadgeMap.character;
                      const CatIcon = catMeta.icon;

                      return (
                        <div
                          key={item.id}
                          className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 flex flex-col justify-between gap-3 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition"
                        >
                          <div className="space-y-1.5">
                            {/* Category Badge & Action Type */}
                            <div className="flex items-center justify-between gap-1 flex-wrap">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${catMeta.color}`}
                              >
                                <CatIcon className="w-3 h-3" />
                                <span>{catMeta.label}</span>
                              </span>

                              {isNew ? (
                                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                                  🆕 Entitas Baru
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full">
                                  🔗 Alias Terdeteksi
                                </span>
                              )}
                            </div>

                            {/* Name & Detected Relation */}
                            <div>
                              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                                {item.name}
                              </h4>
                              {!isNew && item.detectedAliasOf && (
                                <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1 mt-0.5">
                                  <Link2 className="w-3 h-3" />
                                  <span>Sebutan lain dari: <strong>{item.detectedAliasOf}</strong></span>
                                </p>
                              )}
                            </div>

                            {/* Short Description */}
                            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                              {item.shortDescription}
                            </p>
                          </div>

                          {/* Action CTA Button */}
                          <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-end">
                            {isNew ? (
                              isRegistered ? (
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                  <CheckCheck className="w-4 h-4" />
                                  <span>Terdaftar di Glosarium</span>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleRegisterNewEntity(item)}
                                  className="py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 active:scale-95 transition shadow-sm"
                                >
                                  <PlusCircle className="w-3.5 h-3.5" />
                                  <span>Daftarkan ke Glosarium (+)</span>
                                </button>
                              )
                            ) : isAliasSaved ? (
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                <CheckCheck className="w-4 h-4" />
                                <span>Alias Tersimpan</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleAddAliasToExisting(item)}
                                className="py-1.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 active:scale-95 transition shadow-sm"
                              >
                                <Link2 className="w-3.5 h-3.5" />
                                <span>Simpan Sebagai Alias Resmi</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-10 px-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-950/20 text-xs text-slate-500 dark:text-slate-400 space-y-2">
                    <Shield className="w-8 h-8 mx-auto text-slate-400 dark:text-slate-600" />
                    <p>Belum ada entitas baru atau alias yang dipindai.</p>
                    <p className="text-[11px] text-slate-400">
                      Ketuk tombol <strong>Pindai Entitas &amp; Alias</strong> di atas atau gunakan <strong>Generate All</strong>.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* MODAL: PENGATURAN DASAR PROMPT GAMBAR GLOBAL                              */}
      {/* ========================================================================= */}
      {showImageSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl p-5 sm:p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Pengaturan Prompt Gambar Adegan
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Konfigurasi global untuk prompt generator (Midjourney, Flux, Stable Diffusion)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowImageSettingsModal(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <div className="space-y-4">
              {/* 1. Rasio Aspek Layar */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                  <span>Rasio Aspek Layar (Aspect Ratio)</span>
                  <span className="text-[11px] text-purple-600 dark:text-purple-400 font-normal">Default: 9:16 (Layar HP)</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: '9:16 (Layar HP)', val: '9:16 (Layar HP)' },
                    { label: '16:9 (Sinematik)', val: '16:9 (Desktop)' },
                    { label: '1:1 (Persegi)', val: '1:1 (Square)' },
                    { label: '3:4 (Portrait)', val: '3:4 (Portrait)' },
                  ].map((preset) => (
                    <button
                      key={preset.val}
                      type="button"
                      onClick={() => setTempImageSettings({ ...tempImageSettings, aspectRatio: preset.val })}
                      className={`p-2 rounded-xl text-xs font-bold border transition ${
                        tempImageSettings.aspectRatio === preset.val
                          ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-purple-300'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={tempImageSettings.aspectRatio}
                  onChange={(e) => setTempImageSettings({ ...tempImageSettings, aspectRatio: e.target.value })}
                  placeholder="Kustom: misal 9:16 --ar 9:16"
                  className="w-full mt-1.5 p-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500 font-mono"
                />
              </div>

              {/* 2. Gaya Visual (Style) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                  <span>Gaya Visual (Style &amp; Rendering)</span>
                  <span className="text-[11px] text-purple-600 dark:text-purple-400 font-normal">Hyper Realistic</span>
                </label>
                <textarea
                  value={tempImageSettings.style}
                  onChange={(e) => setTempImageSettings({ ...tempImageSettings, style: e.target.value })}
                  rows={2}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500 leading-relaxed"
                />
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    'Hyper realistic, natural scene, 8k, cinematic lighting',
                    'Cinematic movie still, 35mm film photography, raw candid',
                    'Anime / Manga fine art, Makoto Shinkai aesthetic',
                    'Dark fantasy concept art, volumetric atmosphere',
                  ].map((preset, pIdx) => (
                    <button
                      key={pIdx}
                      type="button"
                      onClick={() => setTempImageSettings({ ...tempImageSettings, style: preset })}
                      className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition"
                    >
                      + {preset.split(',')[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Penggambaran Karakter (person1/person2) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Penggambaran Karakter (Format Token Tokoh)
                </label>
                <input
                  type="text"
                  value={tempImageSettings.characterNaming}
                  onChange={(e) => setTempImageSettings({ ...tempImageSettings, characterNaming: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500 font-mono"
                />
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/20 text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                  💡 <strong>Tips Karakter:</strong> AI akan menulis tokoh sebagai <code>[person1]</code>, <code>[person2]</code> dst. Hal ini memudahkan Anda mencocokkan wajah tokoh dengan gambar referensi foto karakter yang dilampirkan di generator gambar (seperti fitur <em>Character Reference</em> / IP-Adapter).
                </div>
              </div>

              {/* 4. Kata Kunci Tambahan */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Kata Kunci Tambahan (Kualitas &amp; Suasana Kamera)
                </label>
                <input
                  type="text"
                  value={tempImageSettings.additionalKeywords}
                  onChange={(e) => setTempImageSettings({ ...tempImageSettings, additionalKeywords: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              {/* 5. Bahasa Prompt */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Bahasa Teks Prompt Gambar
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="radio"
                      name="promptLanguage"
                      checked={tempImageSettings.language === 'en'}
                      onChange={() => setTempImageSettings({ ...tempImageSettings, language: 'en' })}
                      className="text-purple-600 focus:ring-purple-500"
                    />
                    <span>English (Direkomendasikan untuk Midjourney, Flux, SD)</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="radio"
                      name="promptLanguage"
                      checked={tempImageSettings.language === 'id'}
                      onChange={() => setTempImageSettings({ ...tempImageSettings, language: 'id' })}
                      className="text-purple-600 focus:ring-purple-500"
                    />
                    <span>Bahasa Indonesia</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={handleResetImageSettings}
                className="text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition"
              >
                Reset ke Default
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowImageSettingsModal(false)}
                  className="py-2 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 transition"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveImageSettings(tempImageSettings)}
                  className="py-2 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-bold text-xs shadow-md shadow-purple-500/20 transition"
                >
                  Simpan Pengaturan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
