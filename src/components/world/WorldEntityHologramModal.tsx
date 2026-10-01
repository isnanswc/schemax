import React, { useState, useMemo } from 'react';
import { WorldEntity, WorldCategory } from '../../types';
import { useMediaUrl } from '../../hooks/useMediaUrl';
import { getConditionMeta } from './entityConditionMeta';
import { EntityImagePickerModal } from './EntityImagePickerModal';
import { ChapterSceneChronologyAccordion } from './ChapterSceneChronologyAccordion';
import { db } from '../../db';
import { generateSmartCharacterVisualPrompt } from '../../services/aiService';
import {
  X,
  User,
  MapPin,
  Shield,
  Scroll,
  Tag,
  Sparkles,
  Info,
  Camera,
  Loader2,
  Check,
  Copy,
  Maximize2,
  Bookmark,
  BookOpen
} from 'lucide-react';
import { usePrivacy } from '../../contexts/PrivacyContext';
import { ImageViewerModal } from '../common/ImageViewerModal';

interface WorldEntityHologramModalProps {
  entity: WorldEntity | null;
  isOpen: boolean;
  onClose: () => void;
  onEntityUpdated?: (updated: WorldEntity) => void;
}

export const WorldEntityHologramModal: React.FC<WorldEntityHologramModalProps> = ({
  entity,
  isOpen,
  onClose,
  onEntityUpdated,
}) => {
  const { getBlurImageClass, getBlurGlossaryClass } = usePrivacy();
  const [isImagePickerOpen, setIsImagePickerOpen] = useState(false);
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  const [currentEntity, setCurrentEntity] = useState<WorldEntity | null>(entity);
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);

  // Sync internal entity when prop changes
  React.useEffect(() => {
    setCurrentEntity(entity);
  }, [entity]);

  const activeEntity = currentEntity || entity;
  const { url } = useMediaUrl(activeEntity?.avatarMediaId);
  const [activeTab, setActiveTab] = useState<'info' | 'traits' | 'physical' | 'relations' | 'chronology'>('info');
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopyFeedback(label);
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  // Filter out any automated placeholder text like "Dideteksi otomatis dari Bab X: ..."
  const cleanDetailedNotes = useMemo(() => {
    if (!activeEntity?.detailedNotes) return '';
    const filtered = activeEntity.detailedNotes
      .split('\n')
      .filter((line) => !line.toLowerCase().includes('dideteksi otomatis dari bab'))
      .map((l) => l.trim())
      .filter(Boolean)
      .join('\n');
    return filtered;
  }, [activeEntity?.detailedNotes]);

  const getEffectiveVisualPrompt = () => {
    if (!activeEntity) return '';
    if (activeEntity.visualPrompt) return activeEntity.visualPrompt;
    const isFemale = activeEntity.tags?.some((t) =>
      ['wanita', 'perempuan', 'female', 'gadis', 'istri', 'ibu'].includes(t.toLowerCase())
    );
    const genderTerm = isFemale ? 'Indonesian woman' : 'Indonesian man';
    const physicalDesc = activeEntity.physicalTraits || activeEntity.shortDescription || 'authentic natural appearance';
    const demeanor =
      activeEntity.currentTraits || activeEntity.initialTraits
        ? `, facial expression reflecting ${activeEntity.currentTraits || activeEntity.initialTraits}`
        : '';
    return `Full body portrait standing upright, centered, ${genderTerm}, ${physicalDesc}${demeanor}, neutral cinematic studio lighting, photorealistic skin textures, 8k resolution, hyper realistic, vertical mobile phone screen aspect ratio 9:16 --ar 9:16`;
  };

  const handleGenerateAIPrompt = async () => {
    if (!activeEntity) return;
    setIsGeneratingPrompt(true);
    try {
      const generated = await generateSmartCharacterVisualPrompt({
        name: activeEntity.name,
        role: activeEntity.shortDescription,
        physicalTraits: activeEntity.physicalTraits,
        traits: activeEntity.currentTraits || activeEntity.initialTraits,
        shortDescription: activeEntity.currentDescription || activeEntity.shortDescription,
      });

      const updated = {
        ...activeEntity,
        visualPrompt: generated,
        updatedAt: Date.now(),
      };
      await db.worldEntities.update(activeEntity.id, {
        visualPrompt: generated,
        updatedAt: Date.now(),
      });
      setCurrentEntity(updated);
      onEntityUpdated?.(updated);
    } catch (err: any) {
      console.error('Gagal generate prompt visual karakter:', err);
      alert('Gagal menghasilkan prompt: ' + (err.message || 'Error'));
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  if (!isOpen || !activeEntity) return null;

  const categoryMeta: Record<WorldCategory, { label: string; icon: any; color: string; border: string; glow: string }> = {
    character: {
      label: 'Karakter',
      icon: User,
      color: 'text-pink-400',
      border: 'border-pink-500/30',
      glow: 'shadow-pink-500/20',
    },
    location: {
      label: 'Lokasi',
      icon: MapPin,
      color: 'text-cyan-400',
      border: 'border-cyan-500/30',
      glow: 'shadow-cyan-500/20',
    },
    item: {
      label: 'Item / Relik',
      icon: Shield,
      color: 'text-amber-400',
      border: 'border-amber-500/30',
      glow: 'shadow-amber-500/20',
    },
    lore: {
      label: 'Lore / Faksi',
      icon: Scroll,
      color: 'text-purple-400',
      border: 'border-purple-500/30',
      glow: 'shadow-purple-500/20',
    },
  };

  const meta = categoryMeta[activeEntity.category] || categoryMeta.character;
  const Icon = meta.icon;
  const condMeta = getConditionMeta(activeEntity.condition);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      {/* Blurred Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 dark:bg-black/75 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Hologram Floating Card */}
      <div className={`relative w-full max-w-3xl max-h-[92vh] flex flex-col bg-[#fdfbf7] dark:bg-slate-900 border border-amber-900/20 dark:${meta.border} rounded-3xl p-4 sm:p-6 shadow-2xl ${meta.glow} z-10 animate-in zoom-in-95 duration-200 overflow-hidden`}>
        {/* Glow ambient background pill */}
        <div className="absolute -top-16 -right-16 w-44 h-44 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* 🌟 Top Hero Header with Substantially Larger Photo & Scholarly Layout */}
        <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5 mb-4 pb-4 border-b border-amber-900/10 dark:border-amber-500/15 flex-shrink-0">
          {/* Close button in top-right */}
          <button
            onClick={onClose}
            className="absolute top-0 right-0 p-2 rounded-full bg-slate-200/70 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition active:scale-95 z-20"
            title="Tutup Berkas"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Large Archival Portrait Plate */}
          <div
            onClick={() => {
              if (url) {
                setIsImageViewerOpen(true);
              } else {
                setIsImagePickerOpen(true);
              }
            }}
            className={`relative group w-28 h-28 sm:w-36 sm:h-36 min-w-[7rem] sm:min-w-[9rem] max-w-[7rem] sm:max-w-[9rem] aspect-square rounded-3xl overflow-hidden bg-amber-50 dark:bg-slate-950 border-2 border-amber-500/40 dark:border-amber-500/30 ring-4 ring-amber-500/10 flex-shrink-0 flex items-center justify-center shadow-lg cursor-pointer ${
              url ? 'cursor-zoom-in' : ''
            }`}
            title={url ? "Klik untuk melihat fullscreen (atau klik tombol kamera)" : "Klik untuk pasang / ubah gambar utama"}
          >
            {url ? (
              <img src={url} alt={activeEntity.name} className={`w-full h-full object-cover aspect-square block pointer-events-none transition-transform duration-300 group-hover:scale-105 ${getBlurImageClass()}`} />
            ) : (
              <Icon className={`w-12 h-12 ${meta.color}`} />
            )}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition gap-2">
              {url && (
                <div className="p-2 rounded-xl bg-white/20 hover:bg-white/30 text-white shadow-sm" title="Layar Penuh">
                  <Maximize2 className="w-4 h-4" />
                </div>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsImagePickerOpen(true);
                }}
                className="p-2 rounded-xl bg-white/20 hover:bg-white/40 text-white shadow-sm"
                title="Ganti Foto"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Hero Details */}
          <div className="flex-1 min-w-0 pr-8 text-center sm:text-left space-y-1.5">
            <div className="flex items-center justify-center sm:justify-start gap-1.5 flex-wrap">
              <span className="font-mono text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1">
                <Bookmark className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                <span>FOLIO CODEX</span>
              </span>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold border ${meta.border} ${meta.color}`}>
                <Icon className="w-3 h-3" />
                <span>{meta.label}</span>
              </span>
              {activeEntity.faction && (
                <span
                  className="px-2 py-0.5 rounded-md text-[10px] font-bold border"
                  style={{
                    borderColor: `${activeEntity.factionColor || '#f59e0b'}50`,
                    color: activeEntity.factionColor || '#d97706',
                    backgroundColor: `${activeEntity.factionColor || '#f59e0b'}15`,
                  }}
                >
                  ⚖ {activeEntity.faction}
                </span>
              )}
              {/* Condition Badge */}
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${condMeta.badgeClass}`}>
                <span>{condMeta.emoji}</span>
                <span>{condMeta.label}</span>
              </span>
            </div>

            <h3 className={`text-xl sm:text-2xl font-serif font-black text-slate-900 dark:text-amber-50 tracking-tight leading-tight ${getBlurGlossaryClass()}`}>
              {activeEntity.name}
            </h3>

            {activeEntity.shortDescription ? (
              <p className="text-xs text-slate-600 dark:text-slate-300 font-serif italic line-clamp-2 leading-relaxed">
                "{activeEntity.shortDescription}"
              </p>
            ) : (
              <p className="text-xs text-slate-400 font-serif italic">
                Entitas terdaftar dalam ensiklopedia dunia cerita.
              </p>
            )}

            {/* Quick Hero Buttons */}
            <div className="flex items-center justify-center sm:justify-start gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsImagePickerOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/25 text-[11px] font-bold transition active:scale-95 shadow-xs"
              >
                <Camera className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Ganti Foto</span>
              </button>
              {url && (
                <button
                  type="button"
                  onClick={() => setIsImageViewerOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-medium transition active:scale-95 border border-slate-200 dark:border-slate-700"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Lihat Layar Penuh</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 📑 5 Integrated Tabs Navigation */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-2.5 mb-3 border-b border-amber-900/10 dark:border-amber-500/15 flex-shrink-0 text-xs">
          {[
            { id: 'info', label: 'Info & Atribut', icon: Info },
            { id: 'traits', label: 'Sifat & Watak', icon: Sparkles },
            { id: 'physical', label: 'Ciri Fisik & Visual AI', icon: Tag },
            { id: 'relations', label: 'Relasi Tokoh', icon: User },
            { id: 'chronology', label: 'Riwayat Bab', icon: Scroll },
          ].map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition active:scale-95 text-xs flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'bg-white/80 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-slate-800 border border-amber-900/10 dark:border-slate-700/60 shadow-xs'
                }`}
              >
                <TabIcon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Scrollable Tab Body Content */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          {/* TAB 1: INFORMASI DASAR */}
          {activeTab === 'info' && (
            <div className="space-y-3.5 animate-in fade-in">
              {/* Short Description */}
              {activeEntity.shortDescription && (
                <div className="bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800/80">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Ringkasan Entitas
                  </span>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    {activeEntity.shortDescription}
                  </p>
                </div>
              )}

              {/* Aliases */}
              {activeEntity.aliases && activeEntity.aliases.length > 0 && (
                <div className="bg-slate-50 dark:bg-slate-950/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-800/80">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 block mb-1">
                    Alias / Sebutan Lain
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {activeEntity.aliases.map((al, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20"
                      >
                        {al}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Dynamic Attributes Grid */}
              {activeEntity.attributes && activeEntity.attributes.length > 0 && (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5">
                    Atribut Kunci
                  </span>
                  <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto no-scrollbar">
                    {activeEntity.attributes.map((attr) => (
                      <div
                        key={attr.id}
                        className="bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 rounded-xl px-2.5 py-1.5 text-xs flex flex-col"
                      >
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">{attr.label}</span>
                        <span className="font-semibold text-slate-900 dark:text-white truncate">{attr.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Detailed Notes */}
              {cleanDetailedNotes && (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400/90 block mb-1">
                    Catatan Lore &amp; Rahasia
                  </span>
                  <div className="max-h-36 overflow-y-auto no-scrollbar text-xs text-slate-700 dark:text-slate-300 bg-amber-50/50 dark:bg-slate-950/40 p-2.5 rounded-xl border border-amber-200/60 dark:border-slate-800/60 leading-relaxed italic">
                    {cleanDetailedNotes}
                  </div>
                </div>
              )}

              {/* Tags */}
              {activeEntity.tags && activeEntity.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {activeEntity.tags.map((tag, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SIFAT & WATAK */}
          {activeTab === 'traits' && (
            <div className="space-y-3.5 animate-in fade-in">
              <div className="p-3.5 rounded-2xl bg-gradient-to-br from-slate-50 via-slate-100/50 to-amber-500/5 dark:from-slate-950/80 dark:via-slate-900/60 dark:to-amber-500/10 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Dinamika Sifat &amp; Kepribadian Karakter</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Kolom Sifat Awal */}
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900/90 border border-emerald-500/20 shadow-xs space-y-1.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      🌱 Sifat &amp; Latar Awal
                    </span>
                    {activeEntity.initialTraits && (
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-snug">
                        {activeEntity.initialTraits}
                      </p>
                    )}
                    {activeEntity.initialDescription && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed italic">
                        {activeEntity.initialDescription}
                      </p>
                    )}
                    {!activeEntity.initialTraits && !activeEntity.initialDescription && (
                      <p className="text-[11px] text-slate-400 italic">Belum ada catatan sifat awal.</p>
                    )}
                  </div>

                  {/* Kolom Sifat Terkini */}
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900/90 border border-amber-500/20 shadow-xs space-y-1.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      ⚡ Sifat &amp; Kondisi Terkini
                    </span>
                    {activeEntity.currentTraits && (
                      <p className="text-xs font-bold text-slate-900 dark:text-white leading-snug">
                        {activeEntity.currentTraits}
                      </p>
                    )}
                    {activeEntity.currentDescription && (
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                        {activeEntity.currentDescription}
                      </p>
                    )}
                    {!activeEntity.currentTraits && !activeEntity.currentDescription && (
                      <p className="text-[11px] text-slate-400 italic">Belum ada catatan sifat terkini.</p>
                    )}
                  </div>
                </div>

                {/* Titik Balik Perubahan */}
                {activeEntity.evolutionSummary && (
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-800 dark:text-amber-200">
                    <span className="font-bold flex items-center gap-1 mb-0.5">
                      🔄 Titik Balik / Peristiwa Perubahan:
                    </span>
                    <p className="text-[11px] leading-relaxed italic">{activeEntity.evolutionSummary}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: CIRI FISIK & PROMPT AI */}
          {activeTab === 'physical' && (
            <div className="space-y-3.5 animate-in fade-in">
              {/* Deskripsi Ciri Fisik */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-500 flex items-center gap-1">
                  👤 Ciri-Ciri Fisik Karakter
                </span>
                <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
                  {activeEntity.physicalTraits ||
                    'Ciri fisik belum tercatat secara rinci. Saat Anda menjalankan Pindai Entitas (AI Scan) di bab, ciri fisik akan otomatis terisi dan terbarui.'}
                </p>
              </div>

              {/* Text-to-Image Visual Prompt Generator Box */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-br from-purple-500/10 via-pink-500/5 to-transparent border border-purple-500/30 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-purple-500" />
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      Prompt Karakter Text-to-Image (English 9:16)
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={handleGenerateAIPrompt}
                      disabled={isGeneratingPrompt}
                      className="flex-1 sm:flex-initial px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 active:scale-95 transition shadow-sm disabled:opacity-50"
                      title="Generate prompt karakter objektif dalam Bahasa Inggris menggunakan AI"
                    >
                      {isGeneratingPrompt ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Generating...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                          <span>Auto-Generate Prompt AI</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => copyToClipboard(getEffectiveVisualPrompt(), 'Prompt Visual')}
                      className="px-2.5 py-1.5 rounded-xl bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/40 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 font-bold text-[11px] flex items-center justify-center gap-1 active:scale-95 transition border border-purple-500/20"
                    >
                      {copyFeedback === 'Prompt Visual' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Tersalin!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Salin</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-slate-950/80 border border-purple-500/20 font-mono text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed max-h-36 overflow-y-auto select-all">
                  {getEffectiveVisualPrompt()}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-purple-700 dark:text-purple-300 font-medium">
                  <span className="px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20">📱 Rasio: 9:16 (Layar HP)</span>
                  <span className="px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20">🧍 Berdiri Tegap Sentral</span>
                  <span className="px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20">🇮🇩 Etnis: Nusantara / Indonesia</span>
                  <span className="px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20">👔 Busana Cerita</span>
                  <span className="px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20">✨ Hyper Realistic 8k</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: RELASI ENTITAS */}
          {activeTab === 'relations' && (
            <div className="space-y-3 animate-in fade-in">
              {activeEntity.relationships && activeEntity.relationships.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {activeEntity.relationships.map((rel, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-1"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-extrabold text-xs text-slate-900 dark:text-white">
                          {rel.targetEntityName || 'Entitas Lain'}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20">
                          {rel.label || rel.relationshipType}
                        </span>
                      </div>
                      {rel.description && (
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed italic">
                          {rel.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 px-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-400">
                  <p>Belum ada relasi yang terhubung ke entitas ini.</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Gunakan fitur <strong>Peta Relasi Otomatis (World Auto-Map)</strong> di tab Ensiklopedia untuk memetakan jejaring aliansi dan rivalitas.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: RIWAYAT BAB & KRONOLOGI */}
          {activeTab === 'chronology' && (
            <div className="space-y-3 animate-in fade-in">
              <ChapterSceneChronologyAccordion
                entity={activeEntity}
                bookId={activeEntity.bookId}
                onUpdate={() => onEntityUpdated?.(activeEntity)}
              />
            </div>
          )}
        </div>

        {/* Action Buttons Footer */}
        <div className="flex items-center justify-between gap-3 pt-3.5 border-t border-amber-900/10 dark:border-amber-500/15 flex-shrink-0">
          <button
            type="button"
            onClick={() => setIsImagePickerOpen(true)}
            className="py-2.5 px-4 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 font-bold text-xs transition active:scale-95 flex items-center gap-1.5 border border-amber-500/30 shadow-xs"
          >
            <Camera className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>Ubah Foto Entitas</span>
          </button>
          <button
            onClick={onClose}
            className="py-2.5 px-6 rounded-xl bg-slate-900 dark:bg-amber-500 hover:bg-slate-800 dark:hover:bg-amber-400 text-white dark:text-slate-950 font-bold text-xs transition active:scale-95 text-center shadow-md shadow-slate-900/10"
          >
            Tutup Berkas
          </button>
        </div>
      </div>

      {/* Main Image Picker Modal */}
      <EntityImagePickerModal
        isOpen={isImagePickerOpen}
        bookId={activeEntity.bookId}
        entity={activeEntity}
        onClose={() => setIsImagePickerOpen(false)}
        onSuccess={(updated) => {
          setCurrentEntity(updated);
          if (onEntityUpdated) onEntityUpdated(updated);
        }}
      />

      {/* Universal Image Viewer Modal for Entity Avatar */}
      {url && (
        <ImageViewerModal
          isOpen={isImageViewerOpen}
          imageUrl={url}
          title={activeEntity.name}
          subtitle={`Foto Entitas • ${meta.label}`}
          onClose={() => setIsImageViewerOpen(false)}
        />
      )}
    </div>
  );
};

