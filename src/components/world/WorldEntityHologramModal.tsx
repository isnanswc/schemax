import React from 'react';
import { WorldEntity, WorldCategory } from '../../types';
import { useMediaUrl } from '../../hooks/useMediaUrl';
import {
  X,
  User,
  MapPin,
  Shield,
  Scroll,
  Tag,
  Sparkles,
  Info
} from 'lucide-react';

interface WorldEntityHologramModalProps {
  entity: WorldEntity | null;
  isOpen: boolean;
  onClose: () => void;
}

export const WorldEntityHologramModal: React.FC<WorldEntityHologramModalProps> = ({
  entity,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !entity) return null;

  const { url } = useMediaUrl(entity.avatarMediaId);

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

  const meta = categoryMeta[entity.category] || categoryMeta.character;
  const Icon = meta.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      {/* Blurred Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Hologram Floating Card */}
      <div className={`relative w-full max-w-md bg-slate-900/95 border ${meta.border} rounded-3xl p-5 shadow-2xl ${meta.glow} z-10 animate-in zoom-in-95 duration-200 overflow-hidden`}>
        {/* Glow ambient background pill */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            {/* Avatar Preview */}
            <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 flex-shrink-0 flex items-center justify-center shadow-lg">
              {url ? (
                <img src={url} alt={entity.name} className="w-full h-full object-cover" />
              ) : (
                <Icon className={`w-8 h-8 ${meta.color}`} />
              )}
            </div>

            <div className="min-w-0">
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${meta.border} ${meta.color} mb-1`}>
                <Icon className="w-3 h-3" />
                <span>{meta.label}</span>
              </span>
              <h3 className="text-lg font-black text-white truncate">
                {entity.name}
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white transition active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Short Description */}
        {entity.shortDescription && (
          <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80 mb-3.5">
            {entity.shortDescription}
          </p>
        )}

        {/* Dynamic Attributes Grid */}
        {entity.attributes && entity.attributes.length > 0 && (
          <div className="mb-3.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
              Atribut Kunci
            </span>
            <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto no-scrollbar">
              {entity.attributes.map((attr) => (
                <div
                  key={attr.id}
                  className="bg-slate-950/70 border border-slate-800/80 rounded-xl px-2.5 py-1.5 text-xs flex flex-col"
                >
                  <span className="text-[10px] text-slate-400">{attr.label}</span>
                  <span className="font-semibold text-white truncate">{attr.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Detailed Notes */}
        {entity.detailedNotes && (
          <div className="mb-3.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400/90 block mb-1">
              Catatan & Rahasia Karakter
            </span>
            <div className="max-h-32 overflow-y-auto no-scrollbar text-xs text-slate-300 bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/60 leading-relaxed italic">
              {entity.detailedNotes}
            </div>
          </div>
        )}

        {/* Tags */}
        {entity.tags && entity.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {entity.tags.map((tag, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700/60"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition active:scale-95 text-center"
        >
          Tutup Pratinjau
        </button>
      </div>
    </div>
  );
};
