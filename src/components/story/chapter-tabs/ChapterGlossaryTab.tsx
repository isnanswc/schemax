import React, { useState, useEffect } from 'react';
import {
  Compass,
  User,
  MapPin,
  Shield,
  Scroll,
  Film,
  Image as ImageIcon,
  Sparkles,
  Plus,
  PlusCircle,
  Copy,
  CheckCircle2,
  CheckCheck,
  Eye,
  Loader2,
  Tag,
  ArrowRight,
  Clock,
  Link2,
  Trash2,
  X,
  Check,
  Upload,
  BookOpen,
  Layers,
  Search,
  BookMarked,
  SlidersHorizontal
} from 'lucide-react';
import {
  StoryChapter,
  WorldEntity,
  WorldCategory,
  ChapterSceneItem,
  DetectedEntityCandidate,
  MediaItem,
  MediaCategory
} from '../../../types';
import { db, saveMediaItem } from '../../../db';
import {
  generateChapterAutoScenes,
  detectWorldEntitiesInChapter,
  analyzeImageWithVision,
  ImageVisionAnalysis
} from '../../../services/aiService';
import { WorldEntityHologramModal } from '../../world/WorldEntityHologramModal';
import { AddWorldEntityModal } from '../../world/AddWorldEntityModal';
import { VerticalSceneTimeline } from './VerticalSceneTimeline';

interface ChapterGlossaryTabProps {
  chapter: StoryChapter;
  bookTitle: string;
  entities: WorldEntity[];
  contentText: string;
  onUpdateChapter: (fields: Partial<StoryChapter>) => void;
  onInsertTextToManuscript: (text: string) => void;
}

export const ChapterGlossaryTab: React.FC<ChapterGlossaryTabProps> = ({
  chapter,
  bookTitle,
  entities = [],
  contentText,
  onUpdateChapter,
  onInsertTextToManuscript,
}) => {
  // Navigation Subtabs: 5 unified primary tabs
  const [activeSubTab, setActiveSubTab] = useState<'entities' | 'detected' | 'images' | 'scenes' | 'visuals'>('entities');
  
  // 📚 Unified Entities State (Filter, Sort, Search)
  const [searchQuery, setSearchQuery] = useState('');
  const [entityCategoryFilter, setEntityCategoryFilter] = useState<'all' | WorldCategory | 'relevant'>('all');
  const [entitySortBy, setEntitySortBy] = useState<'chapter_first' | 'name_asc' | 'name_desc' | 'newest' | 'category'>('chapter_first');
  const [isAddEntityModalOpen, setIsAddEntityModalOpen] = useState(false);
  const [hologramEntity, setHologramEntity] = useState<WorldEntity | null>(null);

  // AI & Processing States
  const [isAnalyzingScenes, setIsAnalyzingScenes] = useState(false);
  const [isDetectingEntities, setIsDetectingEntities] = useState(false);
  const [isBatchRegistering, setIsBatchRegistering] = useState(false);
  const [registeringCandidateId, setRegisteringCandidateId] = useState<string | null>(null);
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);
  const [insertedName, setInsertedName] = useState<string | null>(null);

  // Track candidate registrations locally
  const [registeredEntityIds, setRegisteredEntityIds] = useState<Record<string, boolean>>({});
  const [registeredAliasIds, setRegisteredAliasIds] = useState<Record<string, boolean>>({});

  // 🖼️ Media Images State
  const [bookMediaList, setBookMediaList] = useState<Array<MediaItem & { url: string }>>([]);
  const [imageScope, setImageScope] = useState<'chapter' | 'category' | 'global'>('chapter');
  const [imageCategoryFilter, setImageCategoryFilter] = useState<'all' | MediaCategory>('all');
  const [imageSearchQuery, setImageSearchQuery] = useState('');
  const [isUploadImageModalOpen, setIsUploadImageModalOpen] = useState(false);
  const [mediaActionToast, setMediaActionToast] = useState<string | null>(null);
  const [previewImageModal, setPreviewImageModal] = useState<{ url: string; name: string; caption?: string } | null>(null);

  // Upload Form State
  const [uploadFileBlob, setUploadFileBlob] = useState<Blob | null>(null);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string>('');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCategory, setUploadCategory] = useState<MediaCategory>('scene');
  const [uploadScopeChapter, setUploadScopeChapter] = useState(true);
  const [uploadSelectedTags, setUploadSelectedTags] = useState<string[]>([]);
  const [isAnalyzingVisionUpload, setIsAnalyzingVisionUpload] = useState(false);
  const [uploadVisionResult, setUploadVisionResult] = useState<ImageVisionAnalysis | null>(null);

  // Load Book Media Items from Dexie
  const loadMedia = () => {
    db.media
      .where('bookId')
      .equals(chapter.bookId)
      .toArray()
      .then((items) => {
        const imageItems = items
          .filter((m) => m.mimeType.startsWith('image/'))
          .map((m) => ({
            ...m,
            url: URL.createObjectURL(m.blob),
          }));
        setBookMediaList(imageItems);
      })
      .catch((err) => console.warn('Gagal memuat media buku:', err));
  };

  useEffect(() => {
    loadMedia();
  }, [chapter.bookId]);

  const showToast = (msg: string) => {
    setMediaActionToast(msg);
    setTimeout(() => setMediaActionToast(null), 2500);
  };

  const detectedEntities: DetectedEntityCandidate[] = chapter.aiDetectedEntities || [];
  const pendingNewCount = detectedEntities.filter(
    (c) => c.suggestedAction === 'register_new' && !registeredEntityIds[c.id]
  ).length;

  // Check which entities are mentioned in this chapter's text
  const lowerContent = contentText.toLowerCase();
  const relevantEntities = entities.filter((ent) => {
    if (lowerContent.includes(ent.name.toLowerCase())) return true;
    if (ent.aliases && ent.aliases.some((a) => lowerContent.includes(a.toLowerCase()))) return true;
    return false;
  });

  // Filtered & Sorted Entities List for Unified "Entitas" Tab
  const displayEntities = entities
    .filter((ent) => {
      // 1. Category / Relevant filter
      if (entityCategoryFilter === 'relevant') {
        const isPresent =
          lowerContent.includes(ent.name.toLowerCase()) ||
          (ent.aliases && ent.aliases.some((a) => lowerContent.includes(a.toLowerCase())));
        if (!isPresent) return false;
      } else if (entityCategoryFilter !== 'all') {
        if (ent.category !== entityCategoryFilter) return false;
      }

      // 2. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = ent.name.toLowerCase().includes(q);
        const matchDesc = (ent.shortDescription || '').toLowerCase().includes(q);
        const matchAliases = ent.aliases && ent.aliases.some((a) => a.toLowerCase().includes(q));
        if (!matchName && !matchDesc && !matchAliases) return false;
      }

      return true;
    })
    .sort((a, b) => {
      if (entitySortBy === 'name_asc') {
        return a.name.localeCompare(b.name);
      }
      if (entitySortBy === 'name_desc') {
        return b.name.localeCompare(a.name);
      }
      if (entitySortBy === 'chapter_first') {
        const aPresent = lowerContent.includes(a.name.toLowerCase());
        const bPresent = lowerContent.includes(b.name.toLowerCase());
        if (aPresent && !bPresent) return -1;
        if (!aPresent && bPresent) return 1;
        return a.name.localeCompare(b.name);
      }
      if (entitySortBy === 'newest') {
        return (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0);
      }
      if (entitySortBy === 'category') {
        return a.category.localeCompare(b.category);
      }
      return 0;
    });

  const scenes = chapter.aiScenes || [];

  const handleInsert = (name: string) => {
    onInsertTextToManuscript(` ${name} `);
    setInsertedName(name);
    setTimeout(() => setInsertedName(null), 1500);
  };

  const handleCopyPrompt = (promptText: string, id: string) => {
    navigator.clipboard.writeText(promptText);
    setCopiedPromptId(id);
    setTimeout(() => setCopiedPromptId(null), 2000);
  };

  const getEffectiveText = (): string => {
    if (contentText && contentText.trim()) return contentText.trim();
    if (chapter.contentHtml && chapter.contentHtml.trim()) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = chapter.contentHtml;
      const stripped = (tempDiv.textContent || tempDiv.innerText || '').trim();
      if (stripped) return stripped;
    }
    return (chapter.premise || chapter.notes || '').trim();
  };

  const handleAnalyzeScenes = async () => {
    const textToAnalyze = getEffectiveText();
    if (!textToAnalyze) {
      alert('Tuliskan naskah bab atau premis terlebih dahulu agar AI dapat memetakan adegan.');
      return;
    }

    setIsAnalyzingScenes(true);
    try {
      const generatedScenes = await generateChapterAutoScenes(
        chapter.title,
        bookTitle,
        textToAnalyze,
        entities.map((e) => ({ id: e.id, name: e.name, category: e.category }))
      );

      if (generatedScenes && generatedScenes.length > 0) {
        onUpdateChapter({ aiScenes: generatedScenes });
      }
    } catch (err: any) {
      alert('Gagal memecah adegan: ' + (err.message || 'Periksa API Key di AI Config'));
    } finally {
      setIsAnalyzingScenes(false);
    }
  };

  const handleDetectEntities = async () => {
    const textToAnalyze = getEffectiveText();
    if (!textToAnalyze) {
      alert('Tuliskan naskah bab atau premis terlebih dahulu.');
      return;
    }

    setIsDetectingEntities(true);
    try {
      const detected = await detectWorldEntitiesInChapter(
        textToAnalyze,
        bookTitle,
        entities.map((e) => ({ id: e.id, name: e.name, category: e.category }))
      );

      if (detected && detected.length > 0) {
        onUpdateChapter({ aiDetectedEntities: detected });
        setActiveSubTab('detected'); // Automatically switch to the detected candidates tab!
      } else {
        alert('Tidak ditemukan entitas baru di naskah bab ini.');
      }
    } catch (err: any) {
      alert('Gagal mendeteksi entitas: ' + (err.message || 'Periksa API Key'));
    } finally {
      setIsDetectingEntities(false);
    }
  };

  // Register single new entity to Dexie db.worldEntities with DUPLICATE PREVENTION & CANDIDATE PRUNING
  const handleRegisterEntity = async (candidate: DetectedEntityCandidate) => {
    if (registeringCandidateId === candidate.id) return;
    setRegisteringCandidateId(candidate.id);

    try {
      const normName = candidate.name.trim().toLowerCase();
      // 1. Strict Duplicate Check against existing entities
      const alreadyExists = entities.some((e) => e.name.trim().toLowerCase() === normName);
      if (alreadyExists) {
        const remaining = detectedEntities.filter((c) => c.id !== candidate.id);
        onUpdateChapter({ aiDetectedEntities: remaining });
        showToast(`Entitas "${candidate.name}" sudah ada di Glosarium.`);
        return;
      }

      const newEntity: WorldEntity = {
        id: 'ent_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
        bookId: chapter.bookId,
        category: candidate.category,
        name: candidate.name.trim(),
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

      // Automatically prune added candidate so it disappears from the candidate list
      const remaining = detectedEntities.filter((c) => c.id !== candidate.id);
      onUpdateChapter({ aiDetectedEntities: remaining });
      showToast(`Entitas "${candidate.name}" berhasil didaftarkan ke Glosarium!`);
    } catch (err: any) {
      console.error('Gagal menambahkan ke glosarium:', err);
      alert('Gagal mendaftarkan entitas: ' + (err.message || 'Error'));
    } finally {
      setRegisteringCandidateId(null);
    }
  };

  // Add alias to existing entity in Dexie db.worldEntities and PRUNE from candidate list
  const handleSaveAlias = async (candidate: DetectedEntityCandidate) => {
    try {
      const existingEntities = await db.worldEntities.where('bookId').equals(chapter.bookId).toArray();
      const target = existingEntities.find(
        (e) =>
          e.id === candidate.existingEntityId ||
          e.name.toLowerCase() === candidate.detectedAliasOf?.toLowerCase()
      );
      if (target) {
        const currentAliases = target.aliases || [];
        const updatedAliases = Array.from(new Set([...currentAliases, candidate.name.trim()]));
        await db.worldEntities.update(target.id, {
          aliases: updatedAliases,
          updatedAt: Date.now(),
        });
        setRegisteredAliasIds((prev) => ({ ...prev, [candidate.id]: true }));

        // Automatically prune added candidate so it disappears from the list
        const remaining = detectedEntities.filter((c) => c.id !== candidate.id);
        onUpdateChapter({ aiDetectedEntities: remaining });
        showToast(`Alias "${candidate.name}" berhasil disimpan untuk ${target.name}!`);
      } else {
        alert(`Entitas target "${candidate.detectedAliasOf || 'asli'}" tidak ditemukan di database.`);
      }
    } catch (err: any) {
      console.error('Gagal menambahkan alias:', err);
      alert('Gagal menyimpan alias entitas.');
    }
  };

  // Dismiss single candidate
  const handleDismissCandidate = (candidateId: string) => {
    const updated = detectedEntities.filter((c) => c.id !== candidateId);
    onUpdateChapter({ aiDetectedEntities: updated });
  };

  // Batch register all new candidates to Glosarium with DUPLICATE FILTERING & PRUNING
  const handleRegisterAllNew = async () => {
    const existingNames = new Set(entities.map((e) => e.name.trim().toLowerCase()));
    const newCandidates = detectedEntities.filter(
      (c) =>
        c.suggestedAction === 'register_new' &&
        !registeredEntityIds[c.id] &&
        !existingNames.has(c.name.trim().toLowerCase())
    );

    if (newCandidates.length === 0) {
      // If candidates exist but were already in glossary, prune them
      const remaining = detectedEntities.filter((c) => c.suggestedAction !== 'register_new');
      onUpdateChapter({ aiDetectedEntities: remaining });
      showToast('Semua entitas baru sudah terdaftar sebelumnya.');
      return;
    }

    setIsBatchRegistering(true);
    try {
      const now = Date.now();
      const newEntities: WorldEntity[] = newCandidates.map((c, i) => ({
        id: 'ent_' + Math.random().toString(36).substring(2, 9) + (now + i).toString(36),
        bookId: chapter.bookId,
        category: c.category,
        name: c.name.trim(),
        aliases: [],
        shortDescription: c.shortDescription,
        detailedNotes: `Dideteksi otomatis dari Bab ${chapter.order}: ${chapter.title}.`,
        tags: [c.category],
        galleryMediaIds: [],
        attributes: [],
        createdAt: now + i,
        updatedAt: now + i,
      }));

      await db.worldEntities.bulkAdd(newEntities);

      // Prune all registered candidates so they don't remain in candidate list
      const remaining = detectedEntities.filter((c) => c.suggestedAction !== 'register_new');
      onUpdateChapter({ aiDetectedEntities: remaining });
      showToast(`Berhasil mendaftarkan ${newEntities.length} entitas baru ke Glosarium!`);
    } catch (err: any) {
      console.error('Gagal batch register:', err);
      alert('Gagal mendaftarkan entitas sekaligus: ' + err.message);
    } finally {
      setIsBatchRegistering(false);
    }
  };

  // Clear all candidates
  const handleClearAllCandidates = () => {
    if (window.confirm('Hapus daftar hasil pemindaian entitas ini?')) {
      onUpdateChapter({ aiDetectedEntities: [] });
    }
  };

  // Delete entity from Glosarium
  const handleDeleteEntity = async (entId: string, entName: string) => {
    if (!window.confirm(`Hapus "${entName}" dari Glosarium Dunia?`)) return;
    try {
      await db.worldEntities.delete(entId);
      showToast(`Entitas "${entName}" berhasil dihapus.`);
    } catch (err) {
      alert('Gagal menghapus entitas.');
    }
  };

  // =========================================================================
  // 🖼️ Image Gallery Handlers
  // =========================================================================

  const handleUploadFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Format file harus gambar (PNG, JPG, WebP).');
      return;
    }

    setUploadFileBlob(file);
    const objectUrl = URL.createObjectURL(file);
    setUploadPreviewUrl(objectUrl);
    if (!uploadTitle) {
      setUploadTitle(file.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleScanUploadVision = async () => {
    if (!uploadPreviewUrl || !uploadFileBlob) {
      alert('Pilih file gambar terlebih dahulu.');
      return;
    }

    setIsAnalyzingVisionUpload(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(uploadFileBlob);
      });

      const res = await analyzeImageWithVision(base64, uploadFileBlob.type || 'image/jpeg', {
        bookTitle,
        chapterTitle: chapter.title,
        existingEntities: entities.map((e) => ({ id: e.id, name: e.name, category: e.category })),
      });

      setUploadVisionResult(res);
      if (res.shortDescription && !uploadTitle) {
        setUploadTitle(res.shortDescription);
      }
      if (res.detectedTags && res.detectedTags.length > 0) {
        setUploadSelectedTags((prev) => Array.from(new Set([...prev, ...res.detectedTags])));
      }
      if (res.recommendedCategory) {
        setUploadCategory(res.recommendedCategory);
      }
      showToast('AI Vision berhasil menganalisis gambar!');
    } catch (err: any) {
      alert('Gagal analisis AI Vision: ' + (err.message || 'Periksa API Key Gemini'));
    } finally {
      setIsAnalyzingVisionUpload(false);
    }
  };

  const handleSaveUploadImage = async () => {
    if (!uploadFileBlob) {
      alert('Pilih file gambar terlebih dahulu.');
      return;
    }

    try {
      await saveMediaItem(
        chapter.bookId,
        uploadFileBlob,
        uploadTitle.trim() || 'Gambar Cerita',
        undefined,
        {
          chapterId: uploadScopeChapter ? chapter.id : undefined,
          category: uploadCategory,
          tags: uploadSelectedTags,
          caption: uploadTitle.trim(),
          aiDescription: uploadVisionResult?.shortDescription,
          aiNarrativeIntro: uploadVisionResult?.narrativeSentenceBefore,
        }
      );

      // Reset form & close
      setUploadFileBlob(null);
      setUploadPreviewUrl('');
      setUploadTitle('');
      setUploadSelectedTags([]);
      setUploadVisionResult(null);
      setIsUploadImageModalOpen(false);
      loadMedia();
      showToast('Gambar berhasil disimpan ke Galeri Buku!');
    } catch (err: any) {
      console.error('Gagal upload gambar:', err);
      alert('Gagal menyimpan gambar: ' + err.message);
    }
  };

  const handleInsertImageToEditor = (img: MediaItem & { url: string }) => {
    const captionText = img.caption || img.name || '';
    const tagsHtml =
      img.tags && img.tags.length > 0
        ? `<div class="mt-2 flex flex-wrap items-center justify-center gap-1.5">${img.tags
            .map(
              (t) =>
                `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">🏷️ ${t}</span>`
            )
            .join(' ')}</div>`
        : '';

    const imageHtml = `
<figure class="story-image-block my-5 p-3 rounded-2xl bg-slate-100/90 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center select-none" contenteditable="false">
  <img src="${img.url}" alt="${captionText}" class="w-full max-h-[460px] object-cover rounded-xl shadow-md mx-auto block" />
  ${captionText ? `<figcaption class="mt-2 text-xs font-semibold text-slate-700 dark:text-slate-300 italic">${captionText}</figcaption>` : ''}
  ${tagsHtml}
</figure>
<p><br></p>`;

    onInsertTextToManuscript(imageHtml);
    showToast('Gambar disisipkan ke naskah bab!');
  };

  const handleSetAsChapterCover = async (img: MediaItem & { url: string }) => {
    try {
      await db.chapters.update(chapter.id, {
        coverMediaId: img.id,
        coverImageUrl: img.url,
        updatedAt: Date.now(),
      });
      onUpdateChapter({
        coverMediaId: img.id,
        coverImageUrl: img.url,
      });
      showToast('Berhasil dijadikan Sampul Bab ini!');
    } catch (err) {
      alert('Gagal mengubah sampul bab.');
    }
  };

  const handleSetAsBookCover = async (img: MediaItem) => {
    try {
      await db.books.update(chapter.bookId, {
        coverMediaId: img.id,
        updatedAt: Date.now(),
      });
      showToast('Berhasil dijadikan Sampul Utama Buku!');
    } catch (err) {
      alert('Gagal mengubah sampul buku.');
    }
  };

  const handleDeleteMedia = async (mediaId: string) => {
    if (!window.confirm('Hapus gambar ini dari galeri buku?')) return;
    try {
      await db.media.delete(mediaId);
      loadMedia();
      showToast('Gambar berhasil dihapus.');
    } catch (err) {
      alert('Gagal menghapus gambar.');
    }
  };

  // Filtered Image list
  const filteredImages = bookMediaList.filter((img) => {
    // 1. Scope filter
    if (imageScope === 'chapter') {
      const matchChapterId = img.chapterId === chapter.id;
      const matchTaggedEntity =
        img.tags && img.tags.some((t) => relevantEntities.some((r) => r.name.toLowerCase() === t.toLowerCase()));
      if (!matchChapterId && !matchTaggedEntity) return false;
    } else if (imageScope === 'category') {
      if (imageCategoryFilter !== 'all' && img.category !== imageCategoryFilter) {
        return false;
      }
    }

    // 2. Search query filter
    if (imageSearchQuery.trim()) {
      const q = imageSearchQuery.toLowerCase();
      const matchName = img.name.toLowerCase().includes(q);
      const matchCaption = img.caption?.toLowerCase().includes(q);
      const matchTags = img.tags?.some((t) => t.toLowerCase().includes(q));
      if (!matchName && !matchCaption && !matchTags) return false;
    }

    return true;
  });

  const getCategoryMeta = (cat: WorldCategory) => {
    switch (cat) {
      case 'character':
        return { label: 'Karakter', icon: User, color: 'text-pink-500', badge: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/30' };
      case 'location':
        return { label: 'Lokasi/Latar', icon: MapPin, color: 'text-cyan-500', badge: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30' };
      case 'item':
        return { label: 'Item/Relik', icon: Shield, color: 'text-yellow-500', badge: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30' };
      case 'lore':
        return { label: 'Lore/Faksi', icon: Scroll, color: 'text-purple-500', badge: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30' };
    }
  };

  // Counts for Category Pills in Entitas Tab
  const charCount = entities.filter((e) => e.category === 'character').length;
  const locCount = entities.filter((e) => e.category === 'location').length;
  const itemCount = entities.filter((e) => e.category === 'item').length;
  const loreCount = entities.filter((e) => e.category === 'lore').length;

  return (
    <div className="space-y-4 pb-28 max-w-3xl mx-auto animate-fade-in-up px-1 sm:px-2">
      {/* Toast Feedback */}
      {mediaActionToast && (
        <div className="fixed top-16 right-4 z-50 bg-slate-900/95 text-white border border-amber-500/30 px-3.5 py-2 rounded-2xl shadow-xl text-xs font-bold flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{mediaActionToast}</span>
        </div>
      )}

      {/* 1. Top Header Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="p-1.5 rounded-xl bg-amber-500/15 text-amber-500 font-bold">
              <Compass className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Glosarium &amp; Galeri Bab Ini
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Pusat referensi entitas, visual cerita, dan pembagian adegan
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDetectEntities}
              disabled={isDetectingEntities || !getEffectiveText()}
              className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-gradient-to-r from-amber-500/15 to-indigo-500/15 hover:from-amber-500/25 hover:to-indigo-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-bold transition active:scale-95 disabled:opacity-50 flex-shrink-0"
              title="Scan naskah untuk mendeteksi tokoh atau istilah baru"
            >
              {isDetectingEntities ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                  <span>Memindai...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Pindai Naskah</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 📑 Clean 5-Tab Navigation Bar: Merged Menu */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
          {/* TAB 1: GABUNGAN ENTITAS (Karakter, Item, Lokasi, Lore) */}
          <button
            type="button"
            onClick={() => setActiveSubTab('entities')}
            className={`py-1.5 px-3.5 rounded-xl text-xs font-bold whitespace-nowrap transition active:scale-95 flex items-center gap-1.5 ${
              activeSubTab === 'entities'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Entitas ({entities.length})</span>
          </button>

          {/* TAB 2: KANDIDAT AI */}
          <button
            type="button"
            onClick={() => setActiveSubTab('detected')}
            className={`py-1.5 px-3 rounded-xl text-xs font-bold whitespace-nowrap transition active:scale-95 flex items-center gap-1.5 relative ${
              activeSubTab === 'detected'
                ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-500/30'
                : detectedEntities.length > 0
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 border border-emerald-500/30'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sparkles className={`w-3.5 h-3.5 ${activeSubTab === 'detected' ? 'text-white' : 'text-emerald-500'}`} />
            <span>Kandidat AI</span>
            {detectedEntities.length > 0 && (
              <span className={`px-1.5 py-0.2 text-[10px] rounded-full font-black ${
                activeSubTab === 'detected' ? 'bg-white text-emerald-700' : 'bg-emerald-500 text-white'
              }`}>
                {detectedEntities.length}
              </span>
            )}
          </button>

          {/* TAB 3: IMAGE GALLERY */}
          <button
            type="button"
            onClick={() => setActiveSubTab('images')}
            className={`py-1.5 px-3 rounded-xl text-xs font-bold whitespace-nowrap transition active:scale-95 flex items-center gap-1.5 ${
              activeSubTab === 'images'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-purple-500/10 text-purple-700 dark:text-purple-300 hover:bg-purple-500/20 border border-purple-500/30'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Galeri Gambar ({bookMediaList.length})</span>
          </button>

          {/* TAB 4: AUTO SCENE */}
          <button
            type="button"
            onClick={() => setActiveSubTab('scenes')}
            className={`py-1.5 px-3 rounded-xl text-xs font-bold whitespace-nowrap transition active:scale-95 flex items-center gap-1 ${
              activeSubTab === 'scenes'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>Auto Scene ({scenes.length})</span>
          </button>

          {/* TAB 5: VISUAL PROMPTS */}
          <button
            type="button"
            onClick={() => setActiveSubTab('visuals')}
            className={`py-1.5 px-3 rounded-xl text-xs font-bold whitespace-nowrap transition active:scale-95 flex items-center gap-1 ${
              activeSubTab === 'visuals'
                ? 'bg-pink-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Visual &amp; Prompt</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. 📚 UNIFIED ENTITAS WORKSPACE (Search, Filter, Sort)                    */}
      {/* ========================================================================= */}
      {activeSubTab === 'entities' && (
        <div className="space-y-3 animate-in fade-in">
          {/* Detected Candidates Notification Banner */}
          {detectedEntities.length > 0 && (
            <div className="bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-emerald-500/15 border border-emerald-500/30 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                    {detectedEntities.length} Entitas / Alias Terdeteksi dari Naskah
                  </h4>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300/80">
                    Ada karakter atau sebutan baru yang siap Anda tambahkan ke glosarium.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveSubTab('detected')}
                className="py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1 flex-shrink-0 shadow-sm active:scale-95"
              >
                <span>Tinjau ({detectedEntities.length})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Unified Controls Card: Search, Filter, Sort & Add */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm space-y-3">
            {/* Top row: Search Bar & Add Button */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari karakter, lokasi, item, atau lore..."
                  className="w-full pl-8 pr-8 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsAddEntityModalOpen(true)}
                className="py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 text-xs font-bold transition flex items-center gap-1.5 shadow-sm flex-shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Entitas</span>
              </button>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
              {[
                { id: 'all', label: `Semua (${entities.length})` },
                { id: 'relevant', label: `Di Bab Ini (${relevantEntities.length})`, icon: Sparkles },
                { id: 'character', label: `Karakter (${charCount})`, icon: User },
                { id: 'location', label: `Lokasi (${locCount})`, icon: MapPin },
                { id: 'item', label: `Item (${itemCount})`, icon: Shield },
                { id: 'lore', label: `Lore (${loreCount})`, icon: Scroll },
              ].map((f) => {
                const isActive = entityCategoryFilter === f.id;
                const Icon = f.icon;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setEntityCategoryFilter(f.id as any)}
                    className={`py-1 px-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1 ${
                      isActive
                        ? f.id === 'relevant'
                          ? 'bg-amber-500 text-slate-950 shadow-sm'
                          : 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {Icon && <Icon className="w-3 h-3" />}
                    <span>{f.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Sort & Quick Summary Bar */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
              <span className="text-[11px] font-medium">
                Menampilkan <strong>{displayEntities.length}</strong> entitas
              </span>

              <div className="flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={entitySortBy}
                  onChange={(e) => setEntitySortBy(e.target.value as any)}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="chapter_first">Hadir di Bab Ini Dulu</option>
                  <option value="name_asc">Nama (A - Z)</option>
                  <option value="name_desc">Nama (Z - A)</option>
                  <option value="newest">Terbaru Ditambahkan</option>
                  <option value="category">Berdasarkan Kategori</option>
                </select>
              </div>
            </div>
          </div>

          {/* Entities Grid */}
          {displayEntities.length === 0 ? (
            <div className="text-center py-10 px-4 bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl space-y-2">
              <Compass className="w-8 h-8 text-slate-400 mx-auto mb-1" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Tidak Ada Entitas yang Ditemukan
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                {searchQuery
                  ? `Tidak ada entitas dengan kata kunci "${searchQuery}". Coba bersihkan pencarian.`
                  : 'Belum ada entitas dalam kategori ini. Buat entitas baru atau gunakan tombol Pindai Naskah.'}
              </p>
              <button
                type="button"
                onClick={() => setIsAddEntityModalOpen(true)}
                className="py-2 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs inline-flex items-center gap-1 mt-2"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Buat Entitas Baru</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {displayEntities.map((ent) => {
                const meta = getCategoryMeta(ent.category);
                const Icon = meta.icon;
                const isPresent =
                  lowerContent.includes(ent.name.toLowerCase()) ||
                  (ent.aliases && ent.aliases.some((a) => lowerContent.includes(a.toLowerCase())));

                return (
                  <div
                    key={ent.id}
                    className={`bg-white dark:bg-slate-900 border rounded-2xl p-3.5 shadow-sm transition hover:border-amber-400 flex flex-col justify-between gap-2.5 ${
                      isPresent
                        ? 'border-amber-500/40 ring-1 ring-amber-500/20'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1.5 mb-1.5">
                        <span
                          className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${meta.badge} flex items-center gap-1`}
                        >
                          <Icon className="w-2.5 h-2.5" />
                          <span>{meta.label}</span>
                        </span>

                        <div className="flex items-center gap-1">
                          {isPresent && (
                            <span className="text-[9px] font-bold text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                              Di Bab Ini
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDeleteEntity(ent.id, ent.name)}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition"
                            title="Hapus entitas"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                        {ent.name}
                      </h4>

                      {ent.aliases && ent.aliases.length > 0 && (
                        <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5 font-medium flex items-center gap-1 truncate">
                          <Link2 className="w-2.5 h-2.5 flex-shrink-0" />
                          <span className="truncate">Alias: {ent.aliases.join(', ')}</span>
                        </p>
                      )}

                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-1 leading-snug">
                        {ent.shortDescription || 'Belum ada deskripsi singkat.'}
                      </p>
                    </div>

                    {/* Quick Insert & Hologram Buttons */}
                    <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => handleInsert(ent.name)}
                        className="flex-1 py-1 px-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-700 dark:text-slate-300 text-[10px] font-bold transition active:scale-95 text-center truncate"
                        title="Sisipkan nama tokoh/latar ke kursor naskah"
                      >
                        {insertedName === ent.name ? 'Tersisip!' : '+ Sisip ke Naskah'}
                      </button>

                      <button
                        type="button"
                        onClick={() => setHologramEntity(ent)}
                        className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-white hover:bg-slate-700 transition active:scale-95"
                        title="Lihat Hologram Lengkap"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. 🖼️ IMAGE GALLERY SUBTAB WORKSPACE                                      */}
      {/* ========================================================================= */}
      {activeSubTab === 'images' && (
        <div className="space-y-3 animate-in fade-in">
          {/* Gallery Controls Header */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Arsip Visual &amp; Galeri Cerita</span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                      {filteredImages.length} dari {bookMediaList.length} gambar
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Koleksi gambar bab, karakter, lokasi, dan sampul cerita
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsUploadImageModalOpen(true)}
                className="py-2 px-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-bold text-xs shadow-md shadow-purple-500/20 transition flex items-center justify-center gap-1.5 flex-shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>+ Upload Gambar Baru</span>
              </button>
            </div>

            {/* Scope Tabs: Per Chapter vs Per Kategori vs Global */}
            <div className="flex items-center gap-1.5 border-t border-slate-100 dark:border-slate-800 pt-3 flex-wrap">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mr-1">Tampilan:</span>
              <button
                type="button"
                onClick={() => setImageScope('chapter')}
                className={`py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  imageScope === 'chapter'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <BookMarked className="w-3.5 h-3.5" />
                <span>Bab Ini (Bab {chapter.order})</span>
              </button>

              <button
                type="button"
                onClick={() => setImageScope('category')}
                className={`py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  imageScope === 'category'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Per Kategori Tertentu</span>
              </button>

              <button
                type="button"
                onClick={() => setImageScope('global')}
                className={`py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  imageScope === 'global'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Global (Semua Bab &amp; Sampul)</span>
              </button>
            </div>

            {/* Sub-Filter when in 'category' mode */}
            {imageScope === 'category' && (
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-1">
                {[
                  { id: 'all', label: 'Semua Kategori' },
                  { id: 'character', label: 'Karakter' },
                  { id: 'location', label: 'Lokasi' },
                  { id: 'item', label: 'Item/Relik' },
                  { id: 'scene', label: 'Adegan Bab' },
                  { id: 'cover_chapter', label: 'Sampul Bab' },
                  { id: 'cover_book', label: 'Sampul Buku' },
                ].map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setImageCategoryFilter(c.id as any)}
                    className={`py-1 px-2.5 rounded-lg text-[10px] font-bold transition whitespace-nowrap ${
                      imageCategoryFilter === c.id
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            )}

            {/* Search filter for images */}
            <div className="relative pt-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={imageSearchQuery}
                onChange={(e) => setImageSearchQuery(e.target.value)}
                placeholder="Cari gambar berdasarkan judul, caption, atau tag tokoh..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* Image Grid Display */}
          {filteredImages.length === 0 ? (
            <div className="text-center py-12 px-4 bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl space-y-2">
              <ImageIcon className="w-10 h-10 text-slate-400 mx-auto mb-1" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Belum Ada Gambar yang Cocok
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-3">
                {imageScope === 'chapter'
                  ? `Belum ada gambar yang diunggah khusus untuk Bab ${chapter.order}. Anda dapat mengunggah gambar baru atau beralih ke tampilan Global.`
                  : 'Belum ada gambar dalam kategori ini. Unggah ilustrasi baru dan berikan tag tokoh atau latarnya.'}
              </p>
              <button
                type="button"
                onClick={() => setIsUploadImageModalOpen(true)}
                className="py-2 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-sm active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Upload Gambar ke Bab Ini</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {filteredImages.map((img) => {
                const isChapterCover = chapter.coverMediaId === img.id;
                return (
                  <div
                    key={img.id}
                    className={`bg-white dark:bg-slate-900 border rounded-2xl overflow-hidden shadow-sm hover:border-purple-400 transition flex flex-col justify-between ${
                      isChapterCover
                        ? 'border-amber-500/50 ring-2 ring-amber-500/20'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div>
                      {/* Image Thumbnail with Overlay Badges */}
                      <div
                        className="relative h-44 bg-slate-950 flex items-center justify-center overflow-hidden cursor-pointer group"
                        onClick={() => setPreviewImageModal({ url: img.url, name: img.name, caption: img.caption })}
                      >
                        <img
                          src={img.url}
                          alt={img.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />

                        {/* Top Badges */}
                        <div className="absolute top-2 left-2 right-2 flex items-center justify-between gap-1">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-black/60 text-white backdrop-blur-sm border border-white/20">
                            {img.category || 'scene'}
                          </span>

                          {isChapterCover && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950 shadow-sm flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              <span>Sampul Bab</span>
                            </span>
                          )}
                        </div>

                        {/* Bottom Scope Badge */}
                        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-white text-[11px]">
                          <span className="font-bold truncate drop-shadow">{img.caption || img.name}</span>
                          <span className="text-[10px] opacity-80 flex-shrink-0">
                            {img.chapterId === chapter.id ? `Bab ${chapter.order}` : 'Global'}
                          </span>
                        </div>
                      </div>

                      {/* Tags & Caption Info */}
                      <div className="p-3 space-y-2">
                        {img.tags && img.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {img.tags.map((t, tIdx) => (
                              <span
                                key={tIdx}
                                className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20"
                              >
                                🏷️ {t}
                              </span>
                            ))}
                          </div>
                        )}

                        {img.aiDescription && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed italic">
                            "{img.aiDescription}"
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Image Action Buttons */}
                    <div className="p-3 pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleInsertImageToEditor(img)}
                        className="py-1 px-2.5 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-600 hover:text-white border border-purple-200 dark:border-purple-700 text-xs font-bold transition active:scale-95 flex items-center gap-1"
                        title="Sisipkan gambar ini ke kursor naskah bab"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Sisip ke Naskah</span>
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleSetAsChapterCover(img)}
                          className="py-1 px-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-600 dark:text-slate-300 text-[11px] font-semibold transition active:scale-95"
                          title="Jadikan sebagai gambar sampul bab ini"
                        >
                          Sampul Bab
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSetAsBookCover(img)}
                          className="py-1 px-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-600 dark:text-slate-300 text-[11px] font-semibold transition active:scale-95"
                          title="Jadikan sebagai gambar sampul utama buku"
                        >
                          Sampul Buku
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteMedia(img.id)}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-500 transition"
                          title="Hapus gambar dari galeri"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. CANDIDATES / DETECTED ENTITIES VIEW                                    */}
      {/* ========================================================================= */}
      {activeSubTab === 'detected' && (
        <div className="space-y-3">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Entitas &amp; Alias Hasil Pindai Naskah</span>
                    {detectedEntities.length > 0 && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        {detectedEntities.length} item
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Tinjau karakter, tempat, item, atau sebutan alias yang ditemukan dari naskah bab ini.
                  </p>
                </div>
              </div>

              {detectedEntities.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  <button
                    type="button"
                    onClick={handleRegisterAllNew}
                    disabled={isBatchRegistering || pendingNewCount === 0}
                    className="py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95 flex-shrink-0"
                  >
                    {isBatchRegistering ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Mendaftarkan...</span>
                      </>
                    ) : (
                      <>
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>Daftarkan Semua Baru ({pendingNewCount})</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleClearAllCandidates}
                    className="py-1.5 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 text-xs font-semibold transition active:scale-95 flex items-center gap-1 flex-shrink-0"
                    title="Hapus daftar hasil pemindaian"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Bersihkan</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {detectedEntities.length === 0 ? (
            <div className="text-center py-10 px-4 bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl space-y-2">
              <Sparkles className="w-8 h-8 text-slate-400 mx-auto mb-1" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Belum Ada Kandidat Entitas
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-3">
                Klik tombol "Pindai Naskah" di pojok kanan atas untuk membiarkan AI menganalisis nama tokoh, latar, dan relik yang baru muncul.
              </p>
              <button
                type="button"
                onClick={handleDetectEntities}
                disabled={isDetectingEntities || !getEffectiveText()}
                className="py-2 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 shadow-sm active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Pindai Naskah Bab Sekarang ✨</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {detectedEntities.map((item) => {
                const isNew = item.suggestedAction === 'register_new';
                const isRegistered = registeredEntityIds[item.id];
                const isAliasSaved = registeredAliasIds[item.id];
                const meta = getCategoryMeta(item.category);
                const CatIcon = meta.icon;

                return (
                  <div
                    key={item.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-1 flex-wrap">
                        <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${meta.badge} flex items-center gap-1`}>
                          <CatIcon className="w-2.5 h-2.5" />
                          <span>{meta.label}</span>
                        </span>

                        <div className="flex items-center gap-1">
                          {isNew ? (
                            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                              🆕 Entitas Baru
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Link2 className="w-2.5 h-2.5" />
                              <span>Alias</span>
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDismissCandidate(item.id)}
                            className="p-1 text-slate-400 hover:text-rose-500 rounded-lg transition"
                            title="Abaikan entitas ini"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          {item.name}
                        </h4>
                        {!isNew && item.detectedAliasOf && (
                          <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1 mt-0.5">
                            <Link2 className="w-3 h-3" />
                            <span>Sebutan lain dari: <strong>{item.detectedAliasOf}</strong></span>
                          </p>
                        )}
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        {item.shortDescription || 'Tidak ada deskripsi singkat.'}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => handleInsert(item.name)}
                        className="py-1 px-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-semibold transition active:scale-95"
                        title="Sisipkan nama ke naskah"
                      >
                        {insertedName === item.name ? 'Tersisip!' : '+ Sisip'}
                      </button>

                      <div>
                        {isNew ? (
                          isRegistered ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-xl border border-emerald-500/20">
                              <CheckCheck className="w-3.5 h-3.5" />
                              <span>Terdaftar di Glosarium</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleRegisterEntity(item)}
                              disabled={registeringCandidateId === item.id}
                              className="py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 active:scale-95 transition shadow-sm"
                            >
                              {registeringCandidateId === item.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <PlusCircle className="w-3.5 h-3.5" />
                              )}
                              <span>Daftarkan ke Glosarium (+)</span>
                            </button>
                          )
                        ) : isAliasSaved ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-xl border border-emerald-500/20">
                            <CheckCheck className="w-3.5 h-3.5" />
                            <span>Alias Tersimpan</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSaveAlias(item)}
                            className="py-1.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 active:scale-95 transition shadow-sm"
                          >
                            <Link2 className="w-3.5 h-3.5" />
                            <span>Simpan Sebagai Alias Resmi</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. AUTO SCENE VIEW                                                        */}
      {/* ========================================================================= */}
      {activeSubTab === 'scenes' && (
        <div className="space-y-3">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Film className="w-4 h-4 text-indigo-500" />
                <span>Auto Scene Breakdown</span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Pecahan kronologis babak adegan di bab ini lengkap dengan latar dan konflik
              </p>
            </div>

            <button
              type="button"
              onClick={handleAnalyzeScenes}
              disabled={isAnalyzingScenes || !getEffectiveText()}
              className="flex items-center justify-center gap-1.5 py-2 px-3.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 text-white text-xs font-bold shadow-md shadow-indigo-500/20 active:scale-95 transition flex-shrink-0 disabled:opacity-50"
            >
              {isAnalyzingScenes ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Menganalisis...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Pecah Adegan dari Naskah ✨</span>
                </>
              )}
            </button>
          </div>

          {scenes.length === 0 ? (
            <div className="text-center py-10 px-4 bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">
              <Film className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                Belum Ada Pembagian Adegan
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-3">
                Klik tombol "Pecah Adegan dari Naskah" agar AI otomatis membedah alur bab ini menjadi timeline visual berurutan.
              </p>
            </div>
          ) : (
            <VerticalSceneTimeline
              scenes={scenes}
              entities={entities}
              onOpenEntityHologram={(ent) => setHologramEntity(ent)}
            />
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. VISUAL & IMAGE PROMPTS VIEW                                            */}
      {/* ========================================================================= */}
      {activeSubTab === 'visuals' && (
        <div className="space-y-3">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-purple-500" />
                <span>Visual &amp; Image Prompts</span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Prompt gambar siap pakai untuk di-copy ke AI generator gambar (Midjourney, DALL-E, SD)
              </p>
            </div>

            <button
              type="button"
              onClick={handleAnalyzeScenes}
              disabled={isAnalyzingScenes || !getEffectiveText()}
              className="flex items-center justify-center gap-1.5 py-2 px-3.5 rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-xs font-bold shadow-md active:scale-95 transition flex-shrink-0 disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Generate Prompt Baru</span>
            </button>
          </div>

          {scenes.filter((s) => s.imagePrompt).length === 0 ? (
            <div className="text-center py-10 px-4 bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">
              <ImageIcon className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                Belum Ada Visual Prompt
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-3">
                Lakukan "Pecah Adegan dari Naskah" di tab Auto Scene untuk menghasilkan prompt ilustrasi otomatis untuk tiap adegan.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {scenes
                .filter((s) => s.imagePrompt)
                .map((sc, idx) => (
                  <div
                    key={sc.id || idx}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                          Adegan #{sc.sceneNumber || idx + 1}
                        </span>
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                          {sc.title}
                        </h4>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCopyPrompt(sc.imagePrompt || '', sc.id)}
                        className="flex items-center gap-1 py-1 px-2.5 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700 text-xs font-bold active:scale-95 transition flex-shrink-0"
                      >
                        {copiedPromptId === sc.id ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            <span>Tersalin!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Salin Prompt</span>
                          </>
                        )}
                      </button>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 font-mono leading-relaxed">
                      {sc.imagePrompt}
                    </p>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🖼️ MODAL UPLOAD GAMBAR BARU KE GALERI GLOSARIUM                           */}
      {/* ========================================================================= */}
      {isUploadImageModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in"
          onClick={() => setIsUploadImageModalOpen(false)}
        >
          <div
            className="w-full max-w-lg max-h-[90vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4 overflow-y-auto animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 font-bold">
                  <Upload className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    Upload Gambar ke Galeri Buku
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Unggah visual dan beri tag Worldbuilding berdasarkan tokoh atau lokasi
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsUploadImageModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* File Picker */}
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-4 text-center hover:border-purple-500 transition cursor-pointer relative bg-slate-50 dark:bg-slate-800/40">
              <input
                type="file"
                accept="image/*"
                onChange={handleUploadFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <Upload className="w-7 h-7 mx-auto text-slate-400 mb-1" />
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {uploadFileBlob ? uploadFileBlob.name : 'Pilih file gambar (PNG, JPG, WebP)'}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Klik untuk memilih gambar</p>
            </div>

            {/* Preview & AI Vision trigger */}
            {uploadPreviewUrl && (
              <div className="space-y-2">
                <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 max-h-40 bg-slate-950 flex items-center justify-center">
                  <img src={uploadPreviewUrl} alt="Pratinjau" className="max-h-40 object-contain mx-auto" />
                </div>

                <div className="flex items-center justify-between bg-purple-500/10 p-2.5 rounded-xl border border-purple-500/20">
                  <span className="text-[11px] font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Analisis AI Vision untuk auto-tagging</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleScanUploadVision}
                    disabled={isAnalyzingVisionUpload}
                    className="py-1 px-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition disabled:opacity-50 flex items-center gap-1"
                  >
                    {isAnalyzingVisionUpload ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Menganalisis...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        <span>Pindai AI Vision</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Title / Caption */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                Nama / Keterangan Gambar
              </label>
              <input
                type="text"
                placeholder="Contoh: Sosok Ahmad mengenakan jubah hitam..."
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                className="w-full py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40"
              />
            </div>

            {/* Category Selector */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                Kategori Gambar
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {[
                  { id: 'scene', label: 'Adegan Bab' },
                  { id: 'character', label: 'Karakter' },
                  { id: 'location', label: 'Lokasi' },
                  { id: 'item', label: 'Item/Relik' },
                  { id: 'cover_chapter', label: 'Sampul Bab' },
                  { id: 'cover_book', label: 'Sampul Buku' },
                  { id: 'lore', label: 'Lore/Faksi' },
                  { id: 'general', label: 'Umum' },
                ].map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setUploadCategory(c.id as any)}
                    className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition ${
                      uploadCategory === c.id
                        ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Scope Toggle: Associate with Chapter */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={uploadScopeChapter}
                  onChange={(e) => setUploadScopeChapter(e.target.checked)}
                  className="rounded text-purple-600 focus:ring-purple-500"
                />
                <span>Kaitkan gambar ini dengan Bab {chapter.order} ({chapter.title})</span>
              </label>
            </div>

            {/* Worldbuilding Tags */}
            <div className="space-y-2 pt-1">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-amber-500" />
                  <span>Tag Entitas Worldbuilding</span>
                </span>
                <span className="text-[10px] text-slate-400">{uploadSelectedTags.length} dipilih</span>
              </label>

              {entities.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Belum ada entitas di glosarium.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1">
                  {entities.map((ent) => {
                    const isSelected = uploadSelectedTags.includes(ent.name);
                    return (
                      <button
                        key={ent.id}
                        type="button"
                        onClick={() => {
                          setUploadSelectedTags((prev) =>
                            prev.includes(ent.name) ? prev.filter((t) => t !== ent.name) : [...prev, ent.name]
                          );
                        }}
                        className={`py-1 px-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 ${
                          isSelected
                            ? 'bg-purple-600 text-white shadow-sm ring-1 ring-purple-400'
                            : 'bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-400'
                        }`}
                      >
                        <span>{ent.name}</span>
                        {isSelected && <Check className="w-3 h-3" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsUploadImageModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveUploadImage}
                disabled={!uploadFileBlob}
                className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition active:scale-95 disabled:opacity-50 shadow-md shadow-purple-500/20"
              >
                Simpan ke Galeri
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🔍 FULLSIZE IMAGE PREVIEW MODAL                                           */}
      {/* ========================================================================= */}
      {previewImageModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 animate-fade-in"
          onClick={() => setPreviewImageModal(null)}
        >
          <div
            className="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl space-y-3 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between text-white pb-2 border-b border-slate-800">
              <h4 className="text-sm font-bold truncate">{previewImageModal.caption || previewImageModal.name}</h4>
              <button
                type="button"
                onClick={() => setPreviewImageModal(null)}
                className="p-1 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-[70vh] flex items-center justify-center overflow-hidden rounded-2xl bg-black">
              <img
                src={previewImageModal.url}
                alt={previewImageModal.name}
                className="max-h-[70vh] w-auto object-contain mx-auto"
              />
            </div>
          </div>
        </div>
      )}

      {/* Add World Entity Modal */}
      <AddWorldEntityModal
        isOpen={isAddEntityModalOpen}
        bookId={chapter.bookId}
        onClose={() => setIsAddEntityModalOpen(false)}
        onSuccess={(newEnt) => {
          setIsAddEntityModalOpen(false);
          showToast(`Entitas "${newEnt.name}" berhasil dibuat!`);
        }}
      />

      {/* Hologram Modal preview */}
      <WorldEntityHologramModal
        entity={hologramEntity}
        isOpen={!!hologramEntity}
        onClose={() => setHologramEntity(null)}
      />
    </div>
  );
};
