import React, { useState, useEffect } from 'react';
import { WorldEntity, StoryChapter, ChapterSceneItem, EntityCondition } from '../../types';
import { db } from '../../db';
import { getConditionMeta, ENTITY_CONDITIONS } from './entityConditionMeta';
import {
  BookOpen,
  Film,
  ChevronDown,
  ChevronUp,
  Edit2,
  Check,
  X,
  Sparkles,
  MapPin,
  Clock,
  ShieldAlert,
  Loader2
} from 'lucide-react';

interface ChapterSceneChronologyAccordionProps {
  entity: WorldEntity;
  bookId: string;
  onUpdate?: () => void;
}

export const ChapterSceneChronologyAccordion: React.FC<ChapterSceneChronologyAccordionProps> = ({
  entity,
  bookId,
  onUpdate,
}) => {
  const [chapters, setChapters] = useState<StoryChapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedChapterIds, setExpandedChapterIds] = useState<Record<string, boolean>>({});
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [editCondition, setEditCondition] = useState<string>('aktif');
  const [editDetails, setEditDetails] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  // Load all chapters of this book
  useEffect(() => {
    let active = true;
    setLoading(true);
    db.chapters
      .where('bookId')
      .equals(bookId)
      .sortBy('order')
      .then((items) => {
        if (!active) return;
        setChapters(items);
        // Default expand the first chapter where entity appears or first chapter
        if (items.length > 0) {
          const firstPresent = items.find((ch) => {
            const raw = (ch.contentHtml || '').toLowerCase();
            return raw.includes(entity.name.toLowerCase());
          });
          setExpandedChapterIds({
            [firstPresent ? firstPresent.id : items[0].id]: true,
          });
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load chapters for chronology:', err);
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [bookId, entity.name]);

  const toggleChapter = (chapterId: string) => {
    setExpandedChapterIds((prev) => ({
      ...prev,
      [chapterId]: !prev[chapterId],
    }));
  };

  const handleStartEdit = (ch: StoryChapter) => {
    const currentState = ch.chapterEntityStates?.[entity.id];
    setEditingChapterId(ch.id);
    setEditCondition(currentState?.condition || entity.condition || 'aktif');
    setEditDetails(currentState?.conditionDetails || entity.conditionDetails || '');
  };

  const handleSaveChapterCondition = async (chapterId: string) => {
    setIsSaving(true);
    try {
      const ch = chapters.find((c) => c.id === chapterId);
      if (!ch) return;

      const nextStates = { ...(ch.chapterEntityStates || {}) };
      nextStates[entity.id] = {
        ...nextStates[entity.id],
        entityId: entity.id,
        entityName: entity.name,
        condition: editCondition,
        conditionDetails: editDetails.trim(),
      };

      await db.chapters.update(chapterId, {
        chapterEntityStates: nextStates,
        updatedAt: Date.now(),
      });

      setChapters((prev) =>
        prev.map((c) => (c.id === chapterId ? { ...c, chapterEntityStates: nextStates } : c))
      );

      setEditingChapterId(null);
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('Gagal menyimpan kondisi bab:', err);
      alert('Gagal menyimpan perubahan kondisi bab.');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-6 flex items-center justify-center gap-2 text-xs text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin text-pink-500" />
        <span>Memuat kronologi bab &amp; scene...</span>
      </div>
    );
  }

  if (chapters.length === 0) {
    return (
      <div className="py-6 px-4 text-center rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-400">
        <BookOpen className="w-6 h-6 mx-auto mb-1 text-slate-500" />
        <p>Belum ada bab yang dibuat di buku ini.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-pink-500">
            Perkembangan Alur Cerita
          </span>
          <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Film className="w-4 h-4 text-amber-500" />
            <span>Kondisi Tokoh di Setiap Bab &amp; Scene</span>
          </h4>
        </div>
        <span className="text-[11px] font-medium text-slate-400">
          {chapters.length} Bab Terdaftar
        </span>
      </div>

      {/* Chapters Accordion List */}
      <div className="space-y-2.5">
        {chapters.map((ch) => {
          const isExpanded = !!expandedChapterIds[ch.id];
          const chapterState = ch.chapterEntityStates?.[entity.id];
          const rawText = (ch.contentHtml || '').toLowerCase();
          const isMentionedInChapter =
            rawText.includes(entity.name.toLowerCase()) ||
            (entity.aliases && entity.aliases.some((a) => rawText.includes(a.toLowerCase())));

          const effCondition = chapterState?.condition || (isMentionedInChapter ? (entity.condition || 'aktif') : 'aktif');
          const effDetails = chapterState?.conditionDetails || (isMentionedInChapter ? entity.conditionDetails : '');
          const condMeta = getConditionMeta(effCondition);

          // Find scenes where character is present
          const scenesWithCharacter = (ch.aiScenes || []).filter((sc) => {
            const charList = sc.characters || [];
            const inCharList = charList.some((c) => c.toLowerCase().includes(entity.name.toLowerCase()));
            const inSummary = sc.summary?.toLowerCase().includes(entity.name.toLowerCase());
            return inCharList || inSummary;
          });

          const isEditing = editingChapterId === ch.id;

          return (
            <div
              key={ch.id}
              className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                isExpanded
                  ? 'bg-slate-50 dark:bg-slate-950/90 border-pink-500/40 shadow-sm'
                  : 'bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              {/* Accordion Chapter Header */}
              <div
                onClick={() => toggleChapter(ch.id)}
                className="p-3 sm:p-3.5 flex items-center justify-between gap-3 cursor-pointer select-none"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-pink-500/10 text-pink-500 font-bold text-xs flex items-center justify-center flex-shrink-0 border border-pink-500/20">
                    {ch.order}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h5 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                        {ch.title}
                      </h5>
                      {isMentionedInChapter && (
                        <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded-full border border-emerald-500/20">
                          Hadir di Bab Ini
                        </span>
                      )}
                    </div>
                    {/* Scene Presence Count */}
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {scenesWithCharacter.length > 0
                        ? `Muncul di ${scenesWithCharacter.length} Scene`
                        : isMentionedInChapter
                        ? 'Disebutkan dalam Naskah Cerita'
                        : 'Belum muncul di bab ini'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Condition Badge in Chapter */}
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${condMeta.badgeClass}`}>
                    <span>{condMeta.emoji}</span>
                    <span>{condMeta.label}</span>
                  </span>

                  <button
                    type="button"
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Accordion Expanded Body */}
              {isExpanded && (
                <div className="px-3 sm:px-4 pb-3.5 pt-1 border-t border-slate-200 dark:border-slate-800/80 space-y-3 text-xs animate-in fade-in">
                  {/* Chapter-Level Condition & Edit Form */}
                  {isEditing ? (
                    <div className="p-3 bg-white dark:bg-slate-900 border border-pink-500/40 rounded-xl space-y-2.5 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900 dark:text-white">
                          Ubah Status Karakter di Bab {ch.order}
                        </span>
                        <button
                          type="button"
                          onClick={() => setEditingChapterId(null)}
                          className="p-1 text-slate-400 hover:text-white"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                            Status / Kondisi
                          </label>
                          <select
                            value={editCondition}
                            onChange={(e) => setEditCondition(e.target.value)}
                            className="w-full p-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white"
                          >
                            {Object.values(ENTITY_CONDITIONS).map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.emoji} {c.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                            Keterangan Kejadian Khusus di Bab Ini
                          </label>
                          <input
                            type="text"
                            value={editDetails}
                            onChange={(e) => setEditDetails(e.target.value)}
                            placeholder="Cth: Mengalami luka di bahu kanan saat kabur"
                            className="w-full p-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setEditingChapterId(null)}
                          className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-semibold"
                        >
                          Batal
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveChapterCondition(ch.id)}
                          disabled={isSaving}
                          className="px-3 py-1 bg-gradient-to-r from-pink-500 to-rose-600 text-white rounded-lg text-xs font-bold shadow-sm"
                        >
                          {isSaving ? 'Menyimpan...' : 'Simpan Status Bab Ini'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-3 p-2.5 rounded-xl bg-slate-100/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                      <div>
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                            Kondisi Utama di Bab Ini:
                          </span>
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold border ${condMeta.badgeClass}`}>
                            <span>{condMeta.emoji}</span>
                            <span>{condMeta.label}</span>
                          </span>
                        </div>
                        {effDetails ? (
                          <p className="text-[11px] text-amber-600 dark:text-amber-300 italic">
                            "{effDetails}"
                          </p>
                        ) : (
                          <p className="text-[10px] text-slate-400 italic">
                            Belum ada catatan luka, kutukan, atau perubahan status spesifik di bab ini.
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleStartEdit(ch)}
                        className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[10px] font-bold border border-slate-200 dark:border-slate-700 hover:text-pink-500 transition flex items-center gap-1 flex-shrink-0"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Ubah</span>
                      </button>
                    </div>
                  )}

                  {/* Scenes List (Bab > Scene Breakdown) */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Rincian Kondisi Per Scene (Bab {ch.order}):
                    </span>

                    {scenesWithCharacter.length > 0 ? (
                      <div className="space-y-2">
                        {scenesWithCharacter.map((sc) => (
                          <div
                            key={sc.id}
                            className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-white">
                                <span className="w-5 h-5 rounded-md bg-amber-500/15 text-amber-500 text-[10px] flex items-center justify-center font-bold">
                                  {sc.sceneNumber}
                                </span>
                                <span>{sc.title}</span>
                              </div>

                              {sc.setting && (
                                <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                                  <MapPin className="w-2.5 h-2.5 text-cyan-500" />
                                  <span>{sc.setting}</span>
                                </span>
                              )}
                            </div>

                            {/* Scene Action Summary */}
                            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
                              {sc.summary}
                            </p>

                            {/* Character Dynamic Condition in this Scene */}
                            <div className="pt-1 flex items-center gap-2 text-[10px]">
                              <span className="font-semibold text-slate-400">Keadaan Tokoh:</span>
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded border font-semibold ${condMeta.badgeClass}`}>
                                <span>{condMeta.emoji}</span>
                                <span>{condMeta.label}</span>
                              </span>
                              {effDetails && (
                                <span className="text-amber-500 dark:text-amber-400 truncate">
                                  ({effDetails})
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-[11px] text-slate-400 text-center">
                        {ch.aiScenes && ch.aiScenes.length > 0 ? (
                          <p>
                            Karakter tidak tercatat dalam {ch.aiScenes.length} scene terstruktur di bab ini.
                          </p>
                        ) : (
                          <p>
                            Bab ini belum memiliki Auto Scene. Jalankan "Pindai Auto Scene" di Glosarium Bab untuk memetakan scene per bab.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
