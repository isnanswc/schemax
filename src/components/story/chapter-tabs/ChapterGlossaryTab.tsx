import React, { useState, useEffect, useRef } from 'react';
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
  SlidersHorizontal,
  Camera,
  GitFork,
  RefreshCw,
  Maximize2
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
import { EntityImagePickerModal } from '../../world/EntityImagePickerModal';
import { getConditionMeta } from '../../world/entityConditionMeta';
import { WorldAutoMapView } from '../../world/WorldAutoMapView';
import { VerticalSceneTimeline } from './VerticalSceneTimeline';
import { usePrivacy } from '../../../contexts/PrivacyContext';
import { ImageViewerModal } from '../../common/ImageViewerModal';

interface ChapterGlossaryTabProps {
  chapter: StoryChapter;
  bookTitle: string;
  entities: WorldEntity[];
  contentText: string;
  onUpdateChapter: (fields: Partial<StoryChapter>) => void;
  onInsertTextToManuscript: (text: string) => void;
}

// Helper to render prompt with color-coded bracketed character labels
// RED for wanita / female, BLUE for pria / male
function renderBracketedPrompt(text: string) {
  if (!text) return null;
  // Matches [pria1], [wanita1], pria1, wanita1, [pria], [wanita] etc.
  const regex = /(\[(?:pria\d*|wanita\d*|man\d*|woman\d*|person\d*)\]|\b(?:pria\d+|wanita\d+|man\d+|woman\d+)\b)/gi;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    const lower = part.toLowerCase();
    const isPria = lower.includes('pria') || lower.includes('man');
    const isWanita = lower.includes('wanita') || lower.includes('woman');

    if (isPria) {
      const display = part.startsWith('[') && part.endsWith(']') ? part : `[${part}]`;
      return (
        <span
          key={index}
          className="inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded font-black font-mono text-blue-600 dark:text-blue-400 bg-blue-500/15 border border-blue-500/30 text-xs shadow-xs"
        >
          {display}
        </span>
      );
    }
    if (isWanita) {
      const display = part.startsWith('[') && part.endsWith(']') ? part : `[${part}]`;
      return (
        <span
          key={index}
          className="inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded font-black font-mono text-rose-600 dark:text-rose-400 bg-rose-500/15 border border-rose-500/30 text-xs shadow-xs"
        >
          {display}
        </span>
      );
    }
    return part;
  });
}

export const ChapterGlossaryTab: React.FC<ChapterGlossaryTabProps> = ({
  chapter,
  bookTitle,
  entities = [],
  contentText,
  onUpdateChapter,
  onInsertTextToManuscript,
}) => {
  // Navigation Subtabs: Unified tabs (candidates merged into entities)
  const [activeSubTab, setActiveSubTab] = useState<'entities' | 'map' | 'images' | 'scenes' | 'visuals'>('entities');
  
  // 📚 Unified Entities State (Filter, Sort, Search)
  const [searchQuery, setSearchQuery] = useState('');
  const [entityCategoryFilter, setEntityCategoryFilter] = useState<'all' | WorldCategory | 'relevant'>('all');
  const [entitySortBy, setEntitySortBy] = useState<'chapter_first' | 'name_asc' | 'name_desc' | 'newest' | 'category'>('chapter_first');
  const [isAddEntityModalOpen, setIsAddEntityModalOpen] = useState(false);
  const [hologramEntity, setHologramEntity] = useState<WorldEntity | null>(null);
  const [imagePickerEntity, setImagePickerEntity] = useState<WorldEntity | null>(null);
  const [entityAvatarUrls, setEntityAvatarUrls] = useState<Record<string, string>>({});
  const [activeViewerImage, setActiveViewerImage] = useState<{ url: string; title: string; subtitle?: string } | null>(null);
  const { getBlurImageClass, getBlurGlossaryClass, getBlurTextClass } = usePrivacy();
  const createdUrlsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    const ids = entities.map((e) => e.avatarMediaId).filter((id): id is string => !!id && !entityAvatarUrls[id]);
    if (ids.length > 0) {
      db.media.where('id').anyOf(ids).toArray().then((items) => {
        if (!active) return;
        const newMap: Record<string, string> = {};
        items.forEach((item) => {
          const u = URL.createObjectURL(item.blob);
          createdUrlsRef.current.add(u);
          newMap[item.id] = u;
        });
        setEntityAvatarUrls((prev) => ({ ...prev, ...newMap }));
      });
    }
    return () => {
      active = false;
    };
  }, [entities]);

  // Clean up all blob URLs when Glossary tab unmounts
  useEffect(() => {
    return () => {
      createdUrlsRef.current.forEach((url) => {
        URL.revokeObjectURL(url);
      });
      createdUrlsRef.current.clear();
    };
  }, []);

  // AI & Processing States
  const [isAnalyzingScenes, setIsAnalyzingScenes] = useState(false);
  const [isDetectingEntities, setIsDetectingEntities] = useState(false);
  const [isBatchRegistering, setIsBatchRegistering] = useState(false);
  const [isBatchUpdating, setIsBatchUpdating] = useState(false);
  const [registeringCandidateId, setRegisteringCandidateId] = useState<string | null>(null);
  const [updatingCandidateId, setUpdatingCandidateId] = useState<string | null>(null);
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);
  const [insertedName, setInsertedName] = useState<string | null>(null);

  // Track candidate registrations & updates locally
  const [registeredEntityIds, setRegisteredEntityIds] = useState<Record<string, boolean>>({});
  const [registeredAliasIds, setRegisteredAliasIds] = useState<Record<string, boolean>>({});
  const [updatedEntityIds, setUpdatedEntityIds] = useState<Record<string, boolean>>({});

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
  const pendingUpdateCount = detectedEntities.filter(
    (c) => c.suggestedAction === 'update_existing' && !updatedEntityIds[c.id]
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
        entities.map((e) => ({
          id: e.id,
          name: e.name,
          category: e.category,
          aliases: e.aliases,
          initialTraits: e.initialTraits,
          currentTraits: e.currentTraits,
          condition: typeof e.condition === 'string' ? e.condition : undefined,
          evolutionSummary: e.evolutionSummary,
        }))
      );

      if (detected && detected.length > 0) {
        onUpdateChapter({ aiDetectedEntities: detected });
        setActiveSubTab('entities');
        const newCount = detected.filter((d) => d.suggestedAction === 'register_new').length;
        const updateCount = detected.filter((d) => d.suggestedAction === 'update_existing').length;
        const aliasCount = detected.filter((d) => d.suggestedAction === 'add_alias').length;
        showToast(`Deteksi selesai: ${newCount} baru, ${updateCount} pembaruan sifat/kondisi, ${aliasCount} alias.`);
      } else {
        alert('Tidak ditemukan entitas baru atau perubahan di naskah bab ini.');
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
        initialDescription: candidate.initialDescription || candidate.shortDescription,
        initialTraits: candidate.initialTraits || '',
        currentDescription: candidate.currentDescription || candidate.shortDescription,
        currentTraits: candidate.currentTraits || candidate.initialTraits || '',
        physicalTraits: candidate.physicalTraits || undefined,
        visualPrompt: candidate.visualPrompt || undefined,
        faction: candidate.faction || undefined,
        evolutionSummary: candidate.evolutionSummary || '',
        condition: candidate.condition || 'aktif',
        conditionDetails: candidate.conditionDetails || '',
        detailedNotes: '',
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

  // Update existing entity with latest scan traits & conditions
  const handleUpdateExistingEntity = async (candidate: DetectedEntityCandidate) => {
    if (updatingCandidateId === candidate.id) return;
    setUpdatingCandidateId(candidate.id);

    try {
      const existingEntities = await db.worldEntities.where('bookId').equals(chapter.bookId).toArray();
      const target = existingEntities.find(
        (e) =>
          (candidate.existingEntityId && e.id === candidate.existingEntityId) ||
          e.name.toLowerCase() === candidate.name.trim().toLowerCase() ||
          (e.aliases && e.aliases.some((a) => a.toLowerCase() === candidate.name.trim().toLowerCase()))
      );

      if (target) {
        const updatedFields: Partial<WorldEntity> = {
          updatedAt: Date.now(),
        };

        // If target doesn't have initial traits/desc yet, fill them in from candidate
        if (candidate.initialTraits && !target.initialTraits) {
          updatedFields.initialTraits = candidate.initialTraits;
        }
        if (candidate.initialDescription && !target.initialDescription) {
          updatedFields.initialDescription = candidate.initialDescription;
        }

        // Always update current traits, description, condition, and evolution summary
        if (candidate.currentTraits) {
          updatedFields.currentTraits = candidate.currentTraits;
        }
        if (candidate.currentDescription) {
          updatedFields.currentDescription = candidate.currentDescription;
        }
        if (candidate.evolutionSummary) {
          updatedFields.evolutionSummary = candidate.evolutionSummary;
        }
        if (candidate.condition) {
          updatedFields.condition = candidate.condition;
        }
        if (candidate.conditionDetails) {
          updatedFields.conditionDetails = candidate.conditionDetails;
        }

        await db.worldEntities.update(target.id, updatedFields);
        setUpdatedEntityIds((prev) => ({ ...prev, [candidate.id]: true }));

        // Record in chapterEntityStates for this chapter
        const nextStates = { ...(chapter.chapterEntityStates || {}) };
        nextStates[target.id] = {
          entityId: target.id,
          entityName: target.name,
          condition: candidate.condition || target.condition || 'aktif',
          conditionDetails: candidate.conditionDetails || candidate.evolutionSummary || target.conditionDetails || '',
        };
        onUpdateChapter({
          chapterEntityStates: nextStates,
        });

        // Prune updated candidate from detected list
        const remaining = detectedEntities.filter((c) => c.id !== candidate.id);
        onUpdateChapter({ aiDetectedEntities: remaining });
        showToast(`Kondisi & sifat "${target.name}" berhasil diperbarui!`);
      } else {
        alert(`Entitas target "${candidate.name}" tidak ditemukan di database.`);
      }
    } catch (err: any) {
      console.error('Gagal memperbarui entitas:', err);
      alert('Gagal memperbarui entitas: ' + (err.message || 'Error'));
    } finally {
      setUpdatingCandidateId(null);
    }
  };

  // Batch update all detected entity updates
  const handleUpdateAllExisting = async () => {
    const updateCandidates = detectedEntities.filter(
      (c) => c.suggestedAction === 'update_existing' && !updatedEntityIds[c.id]
    );

    if (updateCandidates.length === 0) {
      showToast('Tidak ada pembaruan entitas yang tertunda.');
      return;
    }

    setIsBatchUpdating(true);
    try {
      const existingEntities = await db.worldEntities.where('bookId').equals(chapter.bookId).toArray();
      const nextStates = { ...(chapter.chapterEntityStates || {}) };
      let updatedCount = 0;

      for (const candidate of updateCandidates) {
        const target = existingEntities.find(
          (e) =>
            (candidate.existingEntityId && e.id === candidate.existingEntityId) ||
            e.name.toLowerCase() === candidate.name.trim().toLowerCase()
        );
        if (target) {
          const updatedFields: Partial<WorldEntity> = {
            updatedAt: Date.now(),
          };
          if (candidate.initialTraits && !target.initialTraits) {
            updatedFields.initialTraits = candidate.initialTraits;
          }
          if (candidate.initialDescription && !target.initialDescription) {
            updatedFields.initialDescription = candidate.initialDescription;
          }
          if (candidate.currentTraits) {
            updatedFields.currentTraits = candidate.currentTraits;
          }
          if (candidate.currentDescription) {
            updatedFields.currentDescription = candidate.currentDescription;
          }
          if (candidate.evolutionSummary) {
            updatedFields.evolutionSummary = candidate.evolutionSummary;
          }
          if (candidate.condition) {
            updatedFields.condition = candidate.condition;
          }
          if (candidate.conditionDetails) {
            updatedFields.conditionDetails = candidate.conditionDetails;
          }
          await db.worldEntities.update(target.id, updatedFields);

          nextStates[target.id] = {
            entityId: target.id,
            entityName: target.name,
            condition: candidate.condition || target.condition || 'aktif',
            conditionDetails: candidate.conditionDetails || candidate.evolutionSummary || target.conditionDetails || '',
          };
          updatedCount++;
        }
      }

      onUpdateChapter({
        chapterEntityStates: nextStates,
        aiDetectedEntities: detectedEntities.filter((c) => c.suggestedAction !== 'update_existing'),
      });
      showToast(`Berhasil memperbarui ${updatedCount} entitas di Glosarium!`);
    } catch (err: any) {
      console.error('Gagal batch update entitas:', err);
      alert('Gagal memperbarui semua entitas: ' + err.message);
    } finally {
      setIsBatchUpdating(false);
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
        initialDescription: c.initialDescription || c.shortDescription,
        initialTraits: c.initialTraits || '',
        currentDescription: c.currentDescription || c.shortDescription,
        currentTraits: c.currentTraits || c.initialTraits || '',
        physicalTraits: c.physicalTraits || undefined,
        visualPrompt: c.visualPrompt || undefined,
        faction: c.faction || undefined,
        evolutionSummary: c.evolutionSummary || '',
        condition: c.condition || 'aktif',
        conditionDetails: c.conditionDetails || '',
        detailedNotes: '',
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="p-2 rounded-2xl bg-amber-500/15 text-amber-500 font-bold flex-shrink-0">
              <Compass className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                Glosarium &amp; Galeri Bab Ini
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                Pusat referensi entitas, visual cerita, dan pembagian adegan
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={handleDetectEntities}
              disabled={isDetectingEntities || !getEffectiveText()}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 py-2 px-3.5 rounded-xl bg-gradient-to-r from-amber-500/20 via-emerald-500/20 to-indigo-500/20 hover:from-amber-500/30 hover:to-indigo-500/30 text-amber-800 dark:text-amber-300 border border-amber-500/30 text-xs font-bold transition active:scale-95 disabled:opacity-50 shadow-sm"
              title="Pindai naskah untuk mendeteksi tokoh, latar, relik, atau sebutan alias baru"
            >
              {isDetectingEntities ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                  <span>Memindai Naskah...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Pindai Entitas</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 📑 Clean 4-Tab Navigation Bar: Candidates merged inside Entitas */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
          {/* TAB 1: GABUNGAN ENTITAS (Karakter, Item, Lokasi, Lore + Kandidat) */}
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
            {detectedEntities.length > 0 && (
              <span className="px-1.5 py-0.2 text-[9px] rounded-full font-black bg-emerald-500 text-white shadow-xs">
                +{detectedEntities.length} baru
              </span>
            )}
          </button>

          {/* TAB 2: PETA RELASI BAB (AUTO-MAP) */}
          <button
            type="button"
            onClick={() => setActiveSubTab('map')}
            className={`py-1.5 px-3 rounded-xl text-xs font-bold whitespace-nowrap transition active:scale-95 flex items-center gap-1.5 ${
              activeSubTab === 'map'
                ? 'bg-gradient-to-r from-pink-500 to-rose-600 text-white shadow-md shadow-pink-500/20'
                : 'bg-pink-500/10 text-pink-700 dark:text-pink-300 hover:bg-pink-500/20 border border-pink-500/30'
            }`}
          >
            <GitFork className="w-3.5 h-3.5" />
            <span>Peta Relasi Bab (Auto-Map)</span>
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
      {/* 1. 📚 UNIFIED ENTITAS WORKSPACE (Search, Filter, Sort & AI Candidates)     */}
      {/* ========================================================================= */}
      {activeSubTab === 'entities' && (
        <div className="space-y-3.5 animate-in fade-in">
          {/* Unified Controls Card: Search, Pindai Entitas, Filter, Sort & Add */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm space-y-3">
            {/* Top row: Search Bar, Pindai Entitas & Add Button */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <div className="relative flex-1 min-w-[200px]">
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

              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={handleDetectEntities}
                  disabled={isDetectingEntities || !getEffectiveText()}
                  className="py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500/15 via-emerald-500/15 to-indigo-500/15 hover:from-amber-500/25 hover:to-indigo-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-bold transition active:scale-95 disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                  title="Pindai naskah untuk menemukan entitas baru atau sebutan alias"
                >
                  {isDetectingEntities ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                      <span>Memindai...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>Pindai Entitas</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setIsAddEntityModalOpen(true)}
                  className="py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Entitas</span>
                </button>
              </div>
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

          {/* AI CANDIDATES SECTION (Embedded directly inside Entitas) */}
          {detectedEntities.length > 0 && (
            <div className="bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-indigo-500/10 border border-emerald-500/30 rounded-3xl p-4 sm:p-5 shadow-sm space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-emerald-500/20">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                      <span>Hasil Pindaian Entitas &amp; Kondisi</span>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500 text-white shadow-sm">
                        {detectedEntities.length} item
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Entitas baru &amp; pembaruan kondisi karakter hasil pemindaian bab ini.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  {pendingUpdateCount > 0 && (
                    <button
                      type="button"
                      onClick={handleUpdateAllExisting}
                      disabled={isBatchUpdating}
                      className="py-1.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95 flex-shrink-0"
                    >
                      {isBatchUpdating ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Memperbarui...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Perbarui Semua ({pendingUpdateCount})</span>
                        </>
                      )}
                    </button>
                  )}

                  {pendingNewCount > 0 && (
                    <button
                      type="button"
                      onClick={handleRegisterAllNew}
                      disabled={isBatchRegistering}
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
                          <span>Daftarkan Semua ({pendingNewCount})</span>
                        </>
                      )}
                    </button>
                  )}

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
              </div>

              {/* Grid of Candidate Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {detectedEntities.map((item) => {
                  const isNew = item.suggestedAction === 'register_new';
                  const isUpdate = item.suggestedAction === 'update_existing';
                  const isRegistered = registeredEntityIds[item.id];
                  const isUpdated = updatedEntityIds[item.id];
                  const isAliasSaved = registeredAliasIds[item.id];
                  const meta = getCategoryMeta(item.category);
                  const CatIcon = meta.icon;
                  const condMeta = item.condition ? getConditionMeta(item.condition) : null;

                  return (
                    <div
                      key={item.id}
                      className={`bg-white dark:bg-slate-900 border rounded-2xl p-3.5 shadow-sm transition flex flex-col justify-between gap-2.5 ${
                        isUpdate
                          ? 'border-indigo-500/40 ring-1 ring-indigo-500/20'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-1 flex-wrap">
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${meta.badge} flex items-center gap-1`}>
                              <CatIcon className="w-2.5 h-2.5" />
                              <span>{meta.label}</span>
                            </span>

                            {condMeta && (
                              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border ${condMeta.badgeClass}`}>
                                {condMeta.emoji} {condMeta.shortLabel}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            {isNew ? (
                              <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.2 rounded-full">
                                🆕 Entitas Baru
                              </span>
                            ) : isUpdate ? (
                              <span className="text-[9px] font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-500/10 border border-indigo-500/30 px-1.5 py-0.2 rounded-full flex items-center gap-0.5">
                                <RefreshCw className="w-2.5 h-2.5" />
                                <span>Pembaruan Kondisi</span>
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.2 rounded-full flex items-center gap-1">
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
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                            {item.name}
                          </h4>
                          {!isNew && item.detectedAliasOf && (
                            <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1 mt-0.5">
                              <Link2 className="w-3 h-3" />
                              <span>Sebutan lain dari: <strong>{item.detectedAliasOf}</strong></span>
                            </p>
                          )}
                        </div>

                        {/* Sifat & Deskripsi Awal vs Saat Ini Comparison Box */}
                        {(item.initialTraits || item.currentTraits || item.evolutionSummary) && (
                          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-[11px] space-y-1">
                            {item.initialTraits && (
                              <div className="flex items-start gap-1 text-slate-600 dark:text-slate-400">
                                <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 flex-shrink-0">
                                  {item.category === 'item' ? '🏺 Wujud/Asal:' : item.category === 'location' ? '🗺️ Kondisi Awal:' : item.category === 'lore' ? '📜 Asal/Prinsip:' : '🌱 Sifat Awal:'}
                                </span>
                                <span>{item.initialTraits}</span>
                              </div>
                            )}
                            {item.currentTraits && (
                              <div className="flex items-start gap-1 text-slate-800 dark:text-slate-200">
                                <span className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-0.5 flex-shrink-0">
                                  {item.category === 'item' ? '✨ Efek/Kondisi:' : item.category === 'location' ? '⚡ Suasana Saat Ini:' : item.category === 'lore' ? '🚩 Pengaruh Terkini:' : '⚡ Sifat Terkini:'}
                                </span>
                                <span className="font-medium">{item.currentTraits}</span>
                              </div>
                            )}
                            {item.evolutionSummary && (
                              <div className="pt-1 border-t border-slate-200 dark:border-slate-800 text-[10px] text-amber-700 dark:text-amber-300 italic">
                                <span className="font-bold">Titik Balik / Perubahan:</span> {item.evolutionSummary}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Physical / Architectural / Material Traits & Faction */}
                        {(item.physicalTraits || item.faction) && (
                          <div className="p-2 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 text-[11px] space-y-1">
                            {item.physicalTraits && (
                              <div className="text-slate-700 dark:text-slate-300">
                                <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                  {item.category === 'character' ? '👤 Ciri Fisik: ' : item.category === 'item' ? '⚔️ Material & Bentuk: ' : item.category === 'location' ? '🏛️ Arsitektur & Alam: ' : '🛡️ Lambang & Atribut: '}
                                </span>
                                <span>{item.physicalTraits}</span>
                              </div>
                            )}
                            {item.faction && (
                              <div className="text-[10px] text-indigo-700 dark:text-indigo-300 font-medium">
                                <span className="font-bold">Faksi/Afiliasi:</span> {item.faction}
                              </div>
                            )}
                          </div>
                        )}

                        <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2">
                          {item.shortDescription || item.currentDescription || 'Tidak ada deskripsi singkat.'}
                        </p>

                        {/* Visual Image Generation Prompt Preview */}
                        {item.visualPrompt && (
                          <div className="p-2 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/30 text-[10px] space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1">
                                🎨 Visual Prompt AI:
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(item.visualPrompt || '');
                                  showToast('Visual prompt disalin!');
                                }}
                                className="px-1.5 py-0.5 rounded bg-purple-200/60 dark:bg-purple-900/60 hover:bg-purple-300 text-purple-900 dark:text-purple-200 font-semibold text-[9px] transition"
                                title="Salin prompt gambar ke clipboard"
                              >
                                Salin Prompt
                              </button>
                            </div>
                            <p className="text-slate-600 dark:text-slate-400 italic font-mono text-[9.5px] line-clamp-2 select-all">
                              {item.visualPrompt}
                            </p>
                          </div>
                        )}
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
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-xl border border-emerald-500/20">
                                <CheckCheck className="w-3.5 h-3.5" />
                                <span>Terdaftar</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleRegisterEntity(item)}
                                disabled={registeringCandidateId === item.id}
                                className="py-1 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-[11px] flex items-center gap-1 active:scale-95 transition shadow-sm"
                              >
                                {registeringCandidateId === item.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <PlusCircle className="w-3 h-3" />
                                )}
                                <span>+ Daftarkan</span>
                              </button>
                            )
                          ) : isUpdate ? (
                            isUpdated ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-xl border border-indigo-500/20">
                                <CheckCheck className="w-3.5 h-3.5" />
                                <span>Diperbarui</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleUpdateExistingEntity(item)}
                                disabled={updatingCandidateId === item.id}
                                className="py-1 px-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-[11px] flex items-center gap-1 active:scale-95 transition shadow-sm"
                              >
                                {updatingCandidateId === item.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <RefreshCw className="w-3 h-3" />
                                )}
                                <span>🔄 Perbarui Entitas</span>
                              </button>
                            )
                          ) : isAliasSaved ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-xl border border-emerald-500/20">
                              <CheckCheck className="w-3.5 h-3.5" />
                              <span>Alias Tersimpan</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSaveAlias(item)}
                              className="py-1 px-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[11px] flex items-center gap-1 active:scale-95 transition shadow-sm"
                            >
                              <Link2 className="w-3 h-3" />
                              <span>+ Simpan Alias</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
                  : 'Belum ada entitas dalam kategori ini. Buat entitas baru atau gunakan tombol Pindai Entitas.'}
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
                      <div className="flex items-start gap-2.5 mb-2">
                        {/* Avatar / Main picture with quick camera changer & fullscreen */}
                        <div
                          onClick={() => {
                            const imgUrl = ent.avatarMediaId ? entityAvatarUrls[ent.avatarMediaId] : null;
                            if (imgUrl) {
                              setActiveViewerImage({
                                url: imgUrl,
                                title: ent.name,
                                subtitle: `Foto Entitas • ${meta.label}`,
                              });
                            } else {
                              setImagePickerEntity(ent);
                            }
                          }}
                          className={`relative group w-12 h-12 min-w-[3rem] min-h-[3rem] max-w-[3rem] max-h-[3rem] aspect-square rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex-shrink-0 flex items-center justify-center cursor-pointer shadow-inner ${
                            ent.avatarMediaId && entityAvatarUrls[ent.avatarMediaId] ? 'cursor-zoom-in' : ''
                          }`}
                          title="Klik untuk lihat foto fullscreen (atau tombol kamera untuk ubah)"
                        >
                          {ent.avatarMediaId && entityAvatarUrls[ent.avatarMediaId] ? (
                            <img
                              src={entityAvatarUrls[ent.avatarMediaId]}
                              alt={ent.name}
                              className={`w-full h-full object-cover aspect-square block pointer-events-none transition-transform group-hover:scale-105 ${getBlurImageClass()}`}
                            />
                          ) : (
                            <Icon className={`w-5 h-5 ${meta.color}`} />
                          )}
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition gap-1">
                            {ent.avatarMediaId && entityAvatarUrls[ent.avatarMediaId] && (
                              <div className="p-1 rounded-md bg-white/20 text-white" title="Layar Penuh">
                                <Maximize2 className="w-3 h-3" />
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setImagePickerEntity(ent);
                              }}
                              className="p-1 rounded-md bg-white/20 hover:bg-white/40 text-white"
                              title="Ganti Foto"
                            >
                              <Camera className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1.5 mb-1">
                            <div className="flex items-center gap-1 flex-wrap">
                              <span
                                className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${meta.badge} flex items-center gap-1`}
                              >
                                <Icon className="w-2.5 h-2.5" />
                                <span>{meta.label}</span>
                              </span>

                              {ent.faction && (
                                <span
                                  className="text-[9px] font-bold px-1.5 py-0.2 rounded-full border"
                                  style={{
                                    borderColor: `${ent.factionColor || '#ec4899'}40`,
                                    color: ent.factionColor || '#ec4899',
                                    backgroundColor: `${ent.factionColor || '#ec4899'}15`,
                                  }}
                                >
                                  {ent.faction}
                                </span>
                              )}

                              {ent.condition && (
                                <span
                                  className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border ${
                                    getConditionMeta(ent.condition).badgeClass
                                  }`}
                                >
                                  {getConditionMeta(ent.condition).emoji} {getConditionMeta(ent.condition).shortLabel}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1">
                              {isPresent && (
                                <span className="text-[9px] font-bold text-amber-700 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded-full border border-amber-500/20">
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

                          <h4 className={`text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate ${getBlurGlossaryClass()}`}>
                            {ent.name}
                          </h4>
                        </div>
                      </div>

                      {ent.aliases && ent.aliases.length > 0 && (
                        <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5 font-medium flex items-center gap-1 truncate">
                          <Link2 className="w-2.5 h-2.5 flex-shrink-0" />
                          <span className="truncate">Alias: {ent.aliases.join(', ')}</span>
                        </p>
                      )}

                      {/* Sifat Awal vs Sifat Terkini Snippet */}
                      {(ent.initialTraits || ent.currentTraits) && (
                        <div className="mt-1.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 text-[11px] space-y-1">
                          {ent.initialTraits && (
                            <div className="flex items-start gap-1 text-slate-600 dark:text-slate-400">
                              <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 flex-shrink-0">🌱 Awal:</span>
                              <span className="line-clamp-1">{ent.initialTraits}</span>
                            </div>
                          )}
                          {ent.currentTraits && (
                            <div className="flex items-start gap-1 text-slate-800 dark:text-slate-200">
                              <span className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-0.5 flex-shrink-0">⚡ Saat Ini:</span>
                              <span className="line-clamp-1 font-medium">{ent.currentTraits}</span>
                            </div>
                          )}
                          {ent.evolutionSummary && (
                            <div className="pt-1 border-t border-slate-200 dark:border-slate-700/60 text-[10px] text-amber-600 dark:text-amber-400/90 italic line-clamp-1">
                              <span className="font-semibold">Titik Balik:</span> {ent.evolutionSummary}
                            </div>
                          )}
                        </div>
                      )}

                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-1 leading-snug">
                        {ent.shortDescription || ent.currentDescription || 'Belum ada deskripsi singkat.'}
                      </p>
                    </div>

                    {/* Detail Entitas Button */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => setHologramEntity(ent)}
                        className="w-full py-1.5 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/25 text-xs font-bold transition active:scale-95 flex items-center justify-center gap-1.5 shadow-xs"
                        title="Buka Detail & Profil Entitas"
                      >
                        <Eye className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        <span>Detail Entitas</span>
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
      {/* 2. 🗺️ CHAPTER AUTO-MAP & RELATIONSHIP WORKSPACE                            */}
      {/* ========================================================================= */}
      {activeSubTab === 'map' && (
        <div className="animate-in fade-in">
          <WorldAutoMapView
            bookId={chapter.bookId}
            bookTitle={bookTitle}
            entities={entities}
            chapter={chapter}
            onUpdateChapter={onUpdateChapter}
            onRefresh={() => {
              if (onUpdateChapter) onUpdateChapter({});
            }}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. 🖼️ IMAGE GALLERY SUBTAB WORKSPACE                                      */}
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
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1.5 border-b border-slate-100 dark:border-slate-800/80">
                      <div className="flex items-start sm:items-center gap-2 min-w-0 flex-1">
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex-shrink-0 mt-0.5 sm:mt-0">
                          Adegan #{sc.sceneNumber || idx + 1}
                        </span>
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white break-words leading-snug">
                          {sc.title}
                        </h4>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCopyPrompt(sc.imagePrompt || '', sc.id)}
                        className="w-full sm:w-auto flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700 text-xs font-bold active:scale-95 transition flex-shrink-0 shadow-xs"
                      >
                        {copiedPromptId === sc.id ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Tersalin!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Salin Prompt</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Character Photo Attachment Reference Warning */}
                    {sc.characterReferences && sc.characterReferences.length > 0 && (
                      <div className="p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                        <Camera className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          <span className="font-extrabold text-[11px] block">
                            📸 Lampirkan Foto / Gambar Referensi Tokoh Saat Men-Generate:
                          </span>
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {sc.characterReferences.map((ref, rIdx) => (
                              <span
                                key={rIdx}
                                className="px-2 py-0.5 rounded-md bg-amber-200/60 dark:bg-amber-900/50 font-semibold text-[10px]"
                              >
                                {ref}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Image Prompt Explanation with Character Mapping */}
                    {(sc.imagePromptExplanation || (sc.characterReferences && sc.characterReferences.length > 0)) && (
                      <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed space-y-2">
                        {/* Mapping Karakter: Misal Udin [pria1], Tasya [wanita1] */}
                        {sc.characterReferences && sc.characterReferences.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-slate-200/50 dark:border-slate-800/80">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mr-1">
                              Pemetaan Karakter:
                            </span>
                            {sc.characterReferences.map((refName, rIdx) => {
                              const ent = entities.find(
                                (e) => e.name.toLowerCase() === refName.toLowerCase()
                              );
                              const isFemale =
                                ent?.tags?.some((t) =>
                                  ['wanita', 'perempuan', 'female', 'istri', 'ibu', 'gadis'].includes(t.toLowerCase())
                                ) ||
                                /^(santi|ani|wati|dewi|putri|ratna|maya|siti|ayu|sarah|tari|rani)/i.test(refName);

                              const tagLabel = isFemale ? `[wanita${rIdx + 1}]` : `[pria${rIdx + 1}]`;

                              return (
                                <span
                                  key={rIdx}
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-bold border shadow-xs ${
                                    isFemale
                                      ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30'
                                      : 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30'
                                  }`}
                                >
                                  <span>{refName}</span>
                                  <span
                                    className={`font-mono text-[10px] px-1 py-0.2 rounded font-black ${
                                      isFemale ? 'bg-rose-500 text-white' : 'bg-blue-600 text-white'
                                    }`}
                                  >
                                    {tagLabel}
                                  </span>
                                </span>
                              );
                            })}
                          </div>
                        )}

                        {sc.imagePromptExplanation && (
                          <div>
                            <span className="font-bold text-purple-600 dark:text-purple-400 mr-1.5">
                              Gambaran Adegan:
                            </span>
                            <span>{renderBracketedPrompt(sc.imagePromptExplanation)}</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 font-mono leading-relaxed break-words overflow-x-auto select-all">
                      {renderBracketedPrompt(sc.imagePrompt)}
                    </div>
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

      {/* Main Image Picker Modal */}
      <EntityImagePickerModal
        isOpen={!!imagePickerEntity}
        bookId={chapter.bookId}
        entity={imagePickerEntity}
        onClose={() => setImagePickerEntity(null)}
        onSuccess={(updated) => {
          setImagePickerEntity(null);
          showToast(`Gambar utama untuk "${updated.name}" berhasil dipasang!`);
        }}
      />

      {/* Universal Image Viewer Modal for Entity Avatar */}
      {activeViewerImage && (
        <ImageViewerModal
          isOpen={!!activeViewerImage}
          imageUrl={activeViewerImage.url}
          title={activeViewerImage.title}
          subtitle={activeViewerImage.subtitle}
          onClose={() => setActiveViewerImage(null)}
        />
      )}
    </div>
  );
};
