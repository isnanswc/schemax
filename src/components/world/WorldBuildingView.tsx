import React, { useState } from 'react';
import { WorldEntity, WorldCategory } from '../../types';
import { AddWorldEntityModal } from './AddWorldEntityModal';
import { WorldEntityHologramModal } from './WorldEntityHologramModal';
import { EntityImagePickerModal } from './EntityImagePickerModal';
import { WorldAutoMapView } from './WorldAutoMapView';
import { getConditionMeta } from './entityConditionMeta';
import { useMediaUrl } from '../../hooks/useMediaUrl';
import { useLongPress } from '../../hooks/useLongPress';
import {
  Compass,
  User,
  MapPin,
  Shield,
  Scroll,
  Plus,
  Trash2,
  Tag,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Info,
  Eye,
  Camera,
  GitFork,
  Boxes,
  LayoutGrid
} from 'lucide-react';
import { db } from '../../db';
import { navStack } from '../../services/backNavigationService';

interface WorldBuildingViewProps {
  bookId: string;
  bookTitle?: string;
  entities: WorldEntity[];
  onRefresh: () => void;
}

const EntityCard: React.FC<{
  entity: WorldEntity;
  onDelete: (id: string, name: string) => void;
  onOpenHologram: (entity: WorldEntity) => void;
  onOpenImagePicker: (entity: WorldEntity) => void;
}> = ({ entity, onDelete, onOpenHologram, onOpenImagePicker }) => {
  const { url } = useMediaUrl(entity.avatarMediaId);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPressing, setIsPressing] = useState(false);

  const longPressEvents = useLongPress(
    () => {
      setIsPressing(false);
      onOpenHologram(entity);
    },
    () => {
      // Single tap toggles expand/collapse
      setIsExpanded((prev) => !prev);
    },
    {
      threshold: 400,
      onStart: () => setIsPressing(true),
      onCancel: () => setIsPressing(false),
      onFinish: () => setIsPressing(false),
    }
  );

  const categoryMeta: Record<WorldCategory, { label: string; icon: any; color: string; badge: string }> = {
    character: { label: 'Karakter', icon: User, color: 'text-pink-400', badge: 'bg-pink-500/10 text-pink-400 border-pink-500/30' },
    location: { label: 'Lokasi', icon: MapPin, color: 'text-cyan-400', badge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' },
    item: { label: 'Item/Relik', icon: Shield, color: 'text-yellow-400', badge: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' },
    lore: { label: 'Lore/Faksi', icon: Scroll, color: 'text-purple-400', badge: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
  };

  const meta = categoryMeta[entity.category] || categoryMeta.character;
  const Icon = meta.icon;
  const condMeta = getConditionMeta(entity.condition);

  return (
    <div
      {...longPressEvents}
      onContextMenu={(e) => {
        e.preventDefault();
        onOpenHologram(entity);
      }}
      className={`relative bg-white dark:bg-slate-900/90 border rounded-2xl p-3.5 transition-all duration-200 select-none shadow-sm space-y-2.5 cursor-pointer touch-pan-y ${
        isPressing
          ? 'scale-[0.98] border-pink-500/80 bg-slate-50 dark:bg-slate-900 ring-2 ring-pink-500/30'
          : 'border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700/80'
      }`}
    >
      {/* Top Header */}
      <div className="flex items-start gap-3">
        {/* Avatar / Visual preview with Quick Camera Button for Main Image */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            onOpenImagePicker(entity);
          }}
          className="relative group w-13 h-13 sm:w-14 sm:h-14 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex-shrink-0 flex items-center justify-center cursor-pointer shadow-inner"
          title="Klik untuk pasang / ubah gambar utama"
        >
          {url ? (
            <img src={url} alt={entity.name} className="w-full h-full object-cover" />
          ) : (
            <Icon className={`w-6 h-6 ${meta.color}`} />
          )}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
            <Camera className="w-4 h-4 text-white" />
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1 mb-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${meta.badge}`}>
                <Icon className="w-3 h-3" />
                <span>{meta.label}</span>
              </span>

              {/* Faction Badge if present */}
              {entity.faction && (
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold border"
                  style={{
                    borderColor: `${entity.factionColor || '#ec4899'}40`,
                    color: entity.factionColor || '#ec4899',
                    backgroundColor: `${entity.factionColor || '#ec4899'}15`,
                  }}
                >
                  {entity.faction}
                </span>
              )}

              {/* Condition Badge */}
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${condMeta.badgeClass}`}>
                <span>{condMeta.emoji}</span>
                <span>{condMeta.shortLabel}</span>
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenHologram(entity);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-amber-600 dark:hover:text-amber-300 transition"
                title="Intip Hologram"
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(entity.id, entity.name);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-red-500 transition"
                title="Hapus Entitas"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <h4 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white truncate">{entity.name}</h4>
          {entity.shortDescription && (
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5 leading-snug">
              {entity.shortDescription}
            </p>
          )}

          {/* Condition Details hint if present */}
          {entity.conditionDetails && (
            <p className="text-[10px] text-amber-500 dark:text-amber-400/90 italic line-clamp-1 mt-0.5">
              Status: {entity.conditionDetails}
            </p>
          )}
        </div>
      </div>

      {/* Attributes Badges / Key Values */}
      {entity.attributes && entity.attributes.length > 0 && (
        <div className="grid grid-cols-2 gap-1.5 pt-0.5">
          {entity.attributes.slice(0, isExpanded ? undefined : 2).map((attr) => (
            <div
              key={attr.id}
              className="bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 rounded-lg px-2 py-1 text-[11px] flex items-center justify-between"
            >
              <span className="text-slate-500 dark:text-slate-400 truncate mr-1">{attr.label}</span>
              <span className="font-medium text-slate-900 dark:text-white truncate max-w-[85px]">{attr.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Expanded Detailed Notes, Relationships & Tags */}
      {isExpanded && (
        <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 space-y-2 text-xs animate-in fade-in">
          {/* Relationships if available */}
          {entity.relationships && entity.relationships.length > 0 && (
            <div>
              <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-1 text-[11px]">
                Relasi Tokoh:
              </span>
              <div className="flex flex-wrap gap-1">
                {entity.relationships.map((rel, rIdx) => (
                  <span
                    key={rIdx}
                    className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-medium border border-slate-200 dark:border-slate-700"
                  >
                    <strong>{rel.label}:</strong> {rel.targetEntityName || 'Karakter Terkait'}
                  </span>
                ))}
              </div>
            </div>
          )}

          {entity.detailedNotes && (
            <div>
              <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-1 text-[11px]">Catatan Lore & Latar:</span>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800/60 text-xs">
                {entity.detailedNotes}
              </p>
            </div>
          )}

          {entity.tags && entity.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {entity.tags.map((t, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-medium"
                >
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Expand/Collapse Button */}
      {(entity.detailedNotes || (entity.attributes && entity.attributes.length > 2) || (entity.relationships && entity.relationships.length > 0)) && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="w-full pt-1 flex items-center justify-center gap-1 text-[11px] font-medium text-pink-600 dark:text-pink-400/90 hover:text-pink-700 dark:hover:text-pink-300 transition"
        >
          <span>{isExpanded ? 'Tutup Rincian' : 'Lihat Rincian Lore, Relasi & Atribut'}</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      )}
    </div>
  );
};

export const WorldBuildingView: React.FC<WorldBuildingViewProps> = ({
  bookId,
  bookTitle = 'Karya Buku',
  entities,
  onRefresh,
}) => {
  // Primary View Mode: 'list' (Daftar Kartu) or 'automap' (Peta Relasi & Visual Faksi)
  const [worldMode, setWorldMode] = useState<'list' | 'automap'>('list');
  const [selectedCategory, setSelectedCategory] = useState<'all' | WorldCategory>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [hologramEntity, setHologramEntity] = useState<WorldEntity | null>(null);
  const [imagePickerEntity, setImagePickerEntity] = useState<WorldEntity | null>(null);

  const handleOpenAddModal = () => {
    navStack.push('modal-add-entity', () => setIsAddModalOpen(false));
    setIsAddModalOpen(true);
  };

  const handleCloseAddModal = () => {
    navStack.pop('modal-add-entity');
    setIsAddModalOpen(false);
  };

  const handleOpenHologram = (ent: WorldEntity) => {
    navStack.push('modal-hologram', () => setHologramEntity(null));
    setHologramEntity(ent);
  };

  const handleCloseHologram = () => {
    navStack.pop('modal-hologram');
    setHologramEntity(null);
  };

  const filteredEntities = entities.filter((ent) => {
    if (selectedCategory === 'all') return true;
    return ent.category === selectedCategory;
  });

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Hapus entitas "${name}" dari worldbuilding?`)) {
      await db.worldEntities.delete(id);
      onRefresh();
    }
  };

  const categories: Array<{ id: 'all' | WorldCategory; label: string; icon: any }> = [
    { id: 'all', label: 'Semua', icon: Compass },
    { id: 'character', label: 'Karakter', icon: User },
    { id: 'location', label: 'Lokasi/Latar', icon: MapPin },
    { id: 'item', label: 'Item/Relik', icon: Shield },
    { id: 'lore', label: 'Lore/Faksi', icon: Scroll },
  ];

  return (
    <div className="space-y-4 pb-24">
      {/* Top World Mode Switcher: Ensiklopedia Kartu vs Auto-Map Relasi */}
      <div className="flex items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 rounded-2xl shadow-sm">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setWorldMode('list')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition active:scale-95 ${
              worldMode === 'list'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span>Ensiklopedia ({entities.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setWorldMode('automap')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition active:scale-95 ${
              worldMode === 'automap'
                ? 'bg-gradient-to-r from-pink-500 to-rose-600 text-white shadow-md shadow-pink-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <GitFork className="w-4 h-4" />
            <span>Peta Relasi & Faksi (Auto-Map)</span>
          </button>
        </div>

        {worldMode === 'list' && (
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-1.5 py-2 px-3.5 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-400 hover:to-rose-500 active:scale-95 text-white font-bold rounded-xl text-xs shadow-md shadow-pink-500/20 transition flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Tambah Entitas</span>
          </button>
        )}
      </div>

      {/* Mode 1: Auto-Map Visualizer (Network & Faction Clusters) */}
      {worldMode === 'automap' ? (
        <WorldAutoMapView
          bookId={bookId}
          bookTitle={bookTitle}
          entities={entities}
          onRefresh={onRefresh}
        />
      ) : (
        /* Mode 2: Standard Entity Cards Grid */
        <div className="space-y-3">
          {/* Horizontal Category Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition active:scale-95 ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                      : 'bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white shadow-sm'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>
                    {cat.label} (
                    {cat.id === 'all'
                      ? entities.length
                      : entities.filter((e) => e.category === cat.id).length}
                    )
                  </span>
                </button>
              );
            })}
          </div>

          {/* Micro-Hint */}
          {filteredEntities.length > 0 && (
            <div className="flex items-center gap-1.5 px-1 text-[11px] text-slate-500">
              <Info className="w-3.5 h-3.5 text-pink-500 dark:text-pink-400/80 flex-shrink-0" />
              <span>
                Tip: Klik foto avatar untuk <strong>pasang / ubah gambar utama</strong>. Tekan & tahan kartu untuk intip hologram.
              </span>
            </div>
          )}

          {/* Entities Grid */}
          {filteredEntities.length === 0 ? (
            <div className="text-center py-12 px-4 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/30">
              <Compass className="w-9 h-9 mx-auto text-slate-400 dark:text-slate-600 mb-2" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Belum Ada Entitas di Kategori Ini</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-4">
                Mulai bangun ensiklopedia duniamu: karakter utama, kastil tua, senjata legendaris, atau sistem sihir.
              </p>
              <button
                onClick={handleOpenAddModal}
                className="inline-flex items-center gap-2 py-2 px-4 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-semibold rounded-xl text-xs border border-slate-300 dark:border-slate-700 transition shadow-sm"
              >
                <Plus className="w-4 h-4 text-pink-500 dark:text-pink-400" />
                <span>Tambah Entitas Baru</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {filteredEntities.map((entity) => (
                <EntityCard
                  key={entity.id}
                  entity={entity}
                  onDelete={handleDelete}
                  onOpenHologram={handleOpenHologram}
                  onOpenImagePicker={(ent) => setImagePickerEntity(ent)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal Tambah Entitas */}
      <AddWorldEntityModal
        isOpen={isAddModalOpen}
        bookId={bookId}
        initialCategory={selectedCategory === 'all' ? 'character' : selectedCategory}
        onClose={handleCloseAddModal}
        onSuccess={() => onRefresh()}
      />

      {/* Hologram Quick Card Modal */}
      <WorldEntityHologramModal
        entity={hologramEntity}
        isOpen={!!hologramEntity}
        onClose={handleCloseHologram}
        onEntityUpdated={() => onRefresh()}
      />

      {/* Image Picker for Main Image */}
      <EntityImagePickerModal
        isOpen={!!imagePickerEntity}
        bookId={bookId}
        entity={imagePickerEntity}
        onClose={() => setImagePickerEntity(null)}
        onSuccess={() => {
          setImagePickerEntity(null);
          onRefresh();
        }}
      />
    </div>
  );
};
