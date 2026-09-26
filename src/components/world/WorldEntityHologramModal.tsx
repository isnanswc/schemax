import React, { useState } from 'react';
import { WorldEntity, WorldCategory } from '../../types';
import { useMediaUrl } from '../../hooks/useMediaUrl';
import { getConditionMeta } from './entityConditionMeta';
import { EntityImagePickerModal } from './EntityImagePickerModal';
import { ChapterSceneChronologyAccordion } from './ChapterSceneChronologyAccordion';
import {
  X,
  User,
  MapPin,
  Shield,
  Scroll,
  Tag,
  Sparkles,
  Info,
  Camera
} from 'lucide-react';

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
  const [isImagePickerOpen, setIsImagePickerOpen] = useState(false);
  const [currentEntity, setCurrentEntity] = useState<WorldEntity | null>(entity);

  // Sync internal entity when prop changes
  React.useEffect(() => {
    setCurrentEntity(entity);
  }, [entity]);

  const activeEntity = currentEntity || entity;
  const { url } = useMediaUrl(activeEntity?.avatarMediaId);

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
      <div className={`relative w-full max-w-2xl max-h-[92vh] flex flex-col bg-white dark:bg-slate-900/95 border border-slate-200 dark:${meta.border} rounded-3xl p-5 shadow-2xl ${meta.glow} z-10 animate-in zoom-in-95 duration-200 overflow-hidden`}>
        {/* Glow ambient background pill */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header */}
        <div className="flex items-start justify-between gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {/* Avatar Preview with Camera Quick Picker */}
            <div
              onClick={() => setIsImagePickerOpen(true)}
              className="relative group w-16 h-16 min-w-[4rem] min-h-[4rem] max-w-[4rem] max-h-[4rem] aspect-square rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex-shrink-0 flex items-center justify-center shadow-sm cursor-pointer"
              title="Klik untuk pasang / ubah gambar utama"
            >
              {url ? (
                <img src={url} alt={activeEntity.name} className="w-full h-full object-cover aspect-square block pointer-events-none" />
              ) : (
                <Icon className={`w-8 h-8 ${meta.color}`} />
              )}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                <Camera className="w-5 h-5 text-white" />
              </div>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${meta.border} ${meta.color}`}>
                  <Icon className="w-3 h-3" />
                  <span>{meta.label}</span>
                </span>
                {activeEntity.faction && (
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-bold border"
                    style={{
                      borderColor: `${activeEntity.factionColor || '#ec4899'}40`,
                      color: activeEntity.factionColor || '#ec4899',
                      backgroundColor: `${activeEntity.factionColor || '#ec4899'}15`,
                    }}
                  >
                    {activeEntity.faction}
                  </span>
                )}
                {/* Condition Badge */}
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${condMeta.badgeClass}`}>
                  <span>{condMeta.emoji}</span>
                  <span>{condMeta.label}</span>
                </span>
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white truncate">
                {activeEntity.name}
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body Content */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4">

        {/* Condition Note if specified */}
        {activeEntity.conditionDetails && (
          <div className="mb-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-300">
            <strong>Kondisi Saat Ini:</strong> {activeEntity.conditionDetails}
          </div>
        )}

        {/* Short Description */}
        {activeEntity.shortDescription && (
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-950/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-800/80 mb-3.5">
            {activeEntity.shortDescription}
          </p>
        )}

        {/* Dynamic Attributes Grid */}
        {entity.attributes && entity.attributes.length > 0 && (
          <div className="mb-3.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5">
              Atribut Kunci
            </span>
            <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto no-scrollbar">
              {entity.attributes.map((attr) => (
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
        {entity.detailedNotes && (
          <div className="mb-3.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400/90 block mb-1">
              Catatan & Rahasia Karakter
            </span>
            <div className="max-h-32 overflow-y-auto no-scrollbar text-xs text-slate-700 dark:text-slate-300 bg-amber-50/50 dark:bg-slate-950/40 p-2.5 rounded-xl border border-amber-200/60 dark:border-slate-800/60 leading-relaxed italic">
              {entity.detailedNotes}
            </div>
          </div>
        )}

        {/* Tags */}
        {activeEntity.tags && activeEntity.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
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

        {/* Kronologi Kondisi Bab & Scene Accordion */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
          <ChapterSceneChronologyAccordion
            entity={activeEntity}
            bookId={activeEntity.bookId}
            onUpdate={() => onEntityUpdated?.(activeEntity)}
          />
        </div>
      </div>

      {/* Action Buttons Footer */}
      <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 flex-shrink-0">
        <button
          type="button"
          onClick={() => setIsImagePickerOpen(true)}
          className="flex-1 py-2.5 px-3 rounded-xl bg-pink-500/10 hover:bg-pink-500/20 text-pink-500 dark:text-pink-400 font-bold text-xs transition active:scale-95 flex items-center justify-center gap-1.5 border border-pink-500/30"
        >
          <Camera className="w-4 h-4" />
          <span>Pasang Gambar Utama</span>
        </button>
        <button
          onClick={onClose}
          className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition active:scale-95 text-center border border-slate-200 dark:border-slate-700 shadow-sm"
        >
          Tutup Pratinjau
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
    </div>
  );
};

