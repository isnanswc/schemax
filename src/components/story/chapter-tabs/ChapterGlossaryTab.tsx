import React, { useState } from 'react';
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
  Check
} from 'lucide-react';
import { StoryChapter, WorldEntity, WorldCategory, ChapterSceneItem, DetectedEntityCandidate } from '../../../types';
import { db } from '../../../db';
import { generateChapterAutoScenes, detectWorldEntitiesInChapter } from '../../../services/aiService';
import { WorldEntityHologramModal } from '../../world/WorldEntityHologramModal';
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
  const [activeSubTab, setActiveSubTab] = useState<'all' | 'detected' | WorldCategory | 'scenes' | 'visuals'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [hologramEntity, setHologramEntity] = useState<WorldEntity | null>(null);
  const [isAnalyzingScenes, setIsAnalyzingScenes] = useState(false);
  const [isDetectingEntities, setIsDetectingEntities] = useState(false);
  const [isBatchRegistering, setIsBatchRegistering] = useState(false);
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);
  const [insertedName, setInsertedName] = useState<string | null>(null);

  // Track candidate registrations locally
  const [registeredEntityIds, setRegisteredEntityIds] = useState<Record<string, boolean>>({});
  const [registeredAliasIds, setRegisteredAliasIds] = useState<Record<string, boolean>>({});

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

  const displayEntities = entities.filter((ent) => {
    if (activeSubTab === 'scenes' || activeSubTab === 'visuals' || activeSubTab === 'detected') return false;
    const matchCategory = activeSubTab === 'all' || ent.category === activeSubTab;
    const matchSearch =
      searchQuery.trim() === '' ||
      ent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ent.shortDescription.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
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

  // Register single new entity to Dexie db.worldEntities
  const handleRegisterEntity = async (candidate: DetectedEntityCandidate) => {
    try {
      const newEntity: WorldEntity = {
        id: 'ent_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
        bookId: chapter.bookId,
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
    } catch (err: any) {
      console.error('Gagal menambahkan ke glosarium:', err);
      alert('Gagal mendaftarkan entitas: ' + (err.message || 'Error'));
    }
  };

  // Add alias to existing entity in Dexie db.worldEntities
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
        const updatedAliases = Array.from(new Set([...currentAliases, candidate.name]));
        await db.worldEntities.update(target.id, {
          aliases: updatedAliases,
          updatedAt: Date.now(),
        });
        setRegisteredAliasIds((prev) => ({ ...prev, [candidate.id]: true }));
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

  // Batch register all new candidates to Glosarium
  const handleRegisterAllNew = async () => {
    const newCandidates = detectedEntities.filter(
      (c) => c.suggestedAction === 'register_new' && !registeredEntityIds[c.id]
    );
    if (newCandidates.length === 0) return;

    setIsBatchRegistering(true);
    try {
      const now = Date.now();
      const newEntities: WorldEntity[] = newCandidates.map((c, i) => ({
        id: 'ent_' + Math.random().toString(36).substring(2, 9) + (now + i).toString(36),
        bookId: chapter.bookId,
        category: c.category,
        name: c.name,
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
      const newlyRegisteredMap: Record<string, boolean> = {};
      newCandidates.forEach((c) => {
        newlyRegisteredMap[c.id] = true;
      });
      setRegisteredEntityIds((prev) => ({ ...prev, ...newlyRegisteredMap }));
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

  return (
    <div className="space-y-4 pb-28 max-w-3xl mx-auto animate-fade-in-up px-1 sm:px-2">
      {/* 1. Top Header Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="p-1.5 rounded-xl bg-amber-500/15 text-amber-500 font-bold">
              <Compass className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Glosarium & Referensi Bab Ini
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Karakter, lokasi, relik, serta adegan dan visual yang relevan dengan bab ini
              </p>
            </div>
          </div>

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

        {/* Sub-Tab Navigation Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
          <button
            type="button"
            onClick={() => setActiveSubTab('all')}
            className={`py-1.5 px-3 rounded-xl text-xs font-bold whitespace-nowrap transition active:scale-95 ${
              activeSubTab === 'all'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Semua Entitas ({entities.length})
          </button>

          {/* AI Detected Entities Sub-Tab */}
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

          <button
            type="button"
            onClick={() => setActiveSubTab('character')}
            className={`py-1.5 px-3 rounded-xl text-xs font-bold whitespace-nowrap transition active:scale-95 flex items-center gap-1 ${
              activeSubTab === 'character'
                ? 'bg-pink-500 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Karakter</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('location')}
            className={`py-1.5 px-3 rounded-xl text-xs font-bold whitespace-nowrap transition active:scale-95 flex items-center gap-1 ${
              activeSubTab === 'location'
                ? 'bg-cyan-500 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Lokasi/Latar</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('item')}
            className={`py-1.5 px-3 rounded-xl text-xs font-bold whitespace-nowrap transition active:scale-95 flex items-center gap-1 ${
              activeSubTab === 'item'
                ? 'bg-yellow-500 text-slate-950 shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Item & Lore</span>
          </button>

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

          <button
            type="button"
            onClick={() => setActiveSubTab('visuals')}
            className={`py-1.5 px-3 rounded-xl text-xs font-bold whitespace-nowrap transition active:scale-95 flex items-center gap-1 ${
              activeSubTab === 'visuals'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Visual & Prompt</span>
          </button>
        </div>
      </div>

      {/* 2. CANDIDATES / DETECTED ENTITIES VIEW */}
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
                    <span>Entitas & Alias Hasil Pindai Naskah</span>
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
                              className="py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 active:scale-95 transition shadow-sm"
                            >
                              <PlusCircle className="w-3.5 h-3.5" />
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

      {/* 3. AUTO SCENE VIEW */}
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

      {/* 4. VISUAL & IMAGE PROMPTS VIEW */}
      {activeSubTab === 'visuals' && (
        <div className="space-y-3">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-purple-500" />
                <span>Visual & Image Prompts</span>
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

      {/* 5. ENTITIES LIST VIEW (Registered Worldbuilding Entities) */}
      {activeSubTab !== 'scenes' && activeSubTab !== 'visuals' && activeSubTab !== 'detected' && (
        <div className="space-y-3">
          {/* Detected Candidates Notification Banner */}
          {detectedEntities.length > 0 && activeSubTab === 'all' && (
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

          {/* Quick Notice of relevant entities in this chapter */}
          {relevantEntities.length > 0 && activeSubTab === 'all' && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <p className="text-xs text-amber-800 dark:text-amber-300 font-medium leading-snug">
                <strong>{relevantEntities.length} entitas terdaftar hadir</strong> di bab ini:{' '}
                {relevantEntities.map((e) => e.name).slice(0, 4).join(', ')}
                {relevantEntities.length > 4 ? '...' : ''}
              </p>
            </div>
          )}

          {displayEntities.length === 0 ? (
            <div className="text-center py-10 px-4 bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">
              <Compass className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                Belum Ada Entitas Terdaftar di Kategori Ini
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Buka tab Worldbuilding di buku atau gunakan tombol "Pindai Naskah" di atas untuk mendaftarkan tokoh, latar tempat, dan relik cerita.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {displayEntities.map((ent) => {
                const meta = getCategoryMeta(ent.category);
                const Icon = meta.icon;
                const isPresent = lowerContent.includes(ent.name.toLowerCase());

                return (
                  <div
                    key={ent.id}
                    className={`bg-white dark:bg-slate-900 border rounded-2xl p-3 shadow-sm transition hover:border-amber-400 flex flex-col justify-between gap-2 ${
                      isPresent
                        ? 'border-amber-500/40 ring-1 ring-amber-500/20'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1.5 mb-1">
                        <span
                          className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${meta.badge} flex items-center gap-1`}
                        >
                          <Icon className="w-2.5 h-2.5" />
                          <span>{meta.label}</span>
                        </span>

                        {isPresent && (
                          <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-md border border-amber-500/20">
                            Di Bab Ini
                          </span>
                        )}
                      </div>

                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                        {ent.name}
                      </h4>

                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5 leading-snug">
                        {ent.shortDescription || 'Belum ada deskripsi singkat.'}
                      </p>
                    </div>

                    {/* Quick Insert & Hologram Buttons */}
                    <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
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
                        className="p-1 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition active:scale-95"
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

      {/* Hologram Modal preview if requested */}
      <WorldEntityHologramModal
        entity={hologramEntity}
        isOpen={!!hologramEntity}
        onClose={() => setHologramEntity(null)}
      />
    </div>
  );
};
