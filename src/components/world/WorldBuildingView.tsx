import React, { useState } from 'react';
import { WorldEntity, WorldCategory, StoryChapter } from '../../types';
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
  LayoutGrid,
  Maximize2,
  Search,
  Filter,
  X,
  BookOpen,
  Bookmark,
  Library
} from 'lucide-react';
import { db } from '../../db';
import { navStack } from '../../services/backNavigationService';
import { usePrivacy } from '../../contexts/PrivacyContext';
import { ImageViewerModal } from '../common/ImageViewerModal';

interface WorldBuildingViewProps {
  bookId: string;
  bookTitle?: string;
  entities: WorldEntity[];
  onRefresh: () => void;
  chapters?: StoryChapter[];
  onChatWithCharacter?: (characterId: string) => void;
}

const EntityCard: React.FC<{
  entity: WorldEntity;
  index?: number;
  onDelete: (id: string, name: string) => void;
  onOpenHologram: (entity: WorldEntity) => void;
  onOpenImagePicker: (entity: WorldEntity) => void;
}> = ({ entity, index = 0, onDelete, onOpenHologram, onOpenImagePicker }) => {
  const { url } = useMediaUrl(entity.avatarMediaId);
  const { getBlurImageClass, getBlurGlossaryClass, getBlurTextClass } = usePrivacy();
  const [isPressing, setIsPressing] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  const longPressEvents = useLongPress(
    () => {
      setIsPressing(false);
      onOpenHologram(entity);
    },
    () => {
      // Single tap opens hologram / detail modal directly
      onOpenHologram(entity);
    },
    {
      threshold: 400,
      onStart: () => setIsPressing(true),
      onCancel: () => setIsPressing(false),
      onFinish: () => setIsPressing(false),
    }
  );

  const categoryMeta: Record<WorldCategory, { label: string; icon: any; color: string; badge: string }> = {
    character: { label: 'Karakter', icon: User, color: 'text-pink-600 dark:text-pink-400', badge: 'bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-500/30' },
    location: { label: 'Lokasi/Latar', icon: MapPin, color: 'text-cyan-600 dark:text-cyan-400', badge: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30' },
    item: { label: 'Item/Relik', icon: Shield, color: 'text-amber-600 dark:text-amber-400', badge: 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30' },
    lore: { label: 'Lore/Kronik', icon: Scroll, color: 'text-purple-600 dark:text-purple-400', badge: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30' },
  };

  const meta = categoryMeta[entity.category] || categoryMeta.character;
  const Icon = meta.icon;
  const condMeta = getConditionMeta(entity.condition);
  const folioCode = `FOLIO #${String(index + 1).padStart(3, '0')}`;

  return (
    <div
      {...longPressEvents}
      onContextMenu={(e) => {
        e.preventDefault();
        onOpenHologram(entity);
      }}
      className={`relative group bg-[#fdfbf7] dark:bg-slate-900/95 border border-amber-900/15 dark:border-amber-500/20 rounded-3xl p-4 transition-all duration-200 select-none shadow-sm hover:shadow-md hover:border-amber-600/40 dark:hover:border-amber-500/40 cursor-pointer flex flex-col justify-between gap-3 ${
        isPressing
          ? 'scale-[0.98] border-amber-500 bg-amber-50/50 dark:bg-slate-800 ring-2 ring-amber-500/30'
          : ''
      }`}
    >
      {/* 📜 Codex Entry Header: Folio # & Actions */}
      <div className="flex items-center justify-between gap-1.5 pb-2 border-b border-amber-900/10 dark:border-amber-500/15 text-[10px]">
        <div className="flex items-center gap-1.5 min-w-0">
          <Bookmark className="w-3 h-3 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <span className="font-mono font-bold tracking-wider text-amber-800 dark:text-amber-300">
            {folioCode}
          </span>
          <span className="text-amber-900/20 dark:text-amber-500/30">•</span>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${meta.badge}`}>
            <Icon className="w-2.5 h-2.5" />
            <span>{meta.label}</span>
          </span>
        </div>

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

      {/* Main Body: Larger Portrait Plate & Essential Info */}
      <div className="flex items-center sm:items-start gap-3.5">
        {/* Avatar / Visual preview with Quick Camera Button - Made noticeably larger! */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            if (url) {
              setIsViewerOpen(true);
            } else {
              onOpenImagePicker(entity);
            }
          }}
          className={`relative group w-20 h-20 sm:w-24 sm:h-24 min-w-[5rem] sm:min-w-[6rem] max-w-[5rem] sm:max-w-[6rem] aspect-square rounded-2xl overflow-hidden bg-amber-50 dark:bg-slate-950 border-2 border-amber-500/30 dark:border-amber-500/30 flex-shrink-0 flex items-center justify-center cursor-pointer shadow-md ${
            url ? 'cursor-zoom-in' : ''
          }`}
          title={url ? "Klik untuk melihat gambar fullscreen (tekan tombol kamera untuk ubah)" : "Klik untuk pasang gambar utama"}
        >
          {url ? (
            <img src={url} alt={entity.name} className={`w-full h-full object-cover aspect-square block pointer-events-none transition-transform group-hover:scale-105 ${getBlurImageClass()}`} />
          ) : (
            <Icon className={`w-9 h-9 ${meta.color}`} />
          )}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition gap-1.5">
            {url && (
              <div className="p-1.5 rounded-lg bg-white/20 text-white" title="Layar Penuh">
                <Maximize2 className="w-3.5 h-3.5" />
              </div>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenImagePicker(entity);
              }}
              className="p-1.5 rounded-lg bg-white/20 hover:bg-white/40 text-white"
              title="Ganti Foto"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Essential Info */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Faction Badge if present */}
            {entity.faction && (
              <span
                className="px-2 py-0.5 rounded-md text-[10px] font-bold border tracking-wide"
                style={{
                  borderColor: `${entity.factionColor || '#f59e0b'}50`,
                  color: entity.factionColor || '#d97706',
                  backgroundColor: `${entity.factionColor || '#f59e0b'}15`,
                }}
              >
                ⚖ {entity.faction}
              </span>
            )}

            {/* Condition Badge */}
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${condMeta.badgeClass}`}>
              <span>{condMeta.emoji}</span>
              <span>{condMeta.shortLabel}</span>
            </span>
          </div>

          <h4 className={`font-serif font-bold text-base sm:text-lg text-slate-900 dark:text-amber-50 truncate tracking-tight group-hover:text-amber-700 dark:group-hover:text-amber-300 transition ${getBlurGlossaryClass()}`}>
            {entity.name}
          </h4>

          {entity.shortDescription ? (
            <p className={`text-xs text-slate-600 dark:text-slate-300 font-serif line-clamp-2 leading-relaxed italic ${getBlurTextClass()}`}>
              {entity.shortDescription}
            </p>
          ) : (
            <p className="text-xs text-slate-400 font-serif italic">
              Belum ada deskripsi singkat.
            </p>
          )}

          {/* Condition Details hint if present */}
          {entity.conditionDetails && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400 font-serif italic line-clamp-1">
              Catatan: {entity.conditionDetails}
            </p>
          )}
        </div>
      </div>

      {/* Prominent, easily reachable "Buka Detail Entitas" Button */}
      <div className="pt-1 border-t border-amber-900/10 dark:border-amber-500/15">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenHologram(entity);
          }}
          className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500/15 via-amber-500/25 to-amber-600/15 hover:from-amber-500/30 hover:to-amber-600/30 active:scale-[0.98] text-amber-900 dark:text-amber-200 border border-amber-500/30 text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs group-hover:border-amber-500/50"
          title="Buka Lembar Detail & Berkas Entitas Lengkap"
        >
          <Eye className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span>Buka Detail Entitas</span>
        </button>
      </div>

      {/* Universal Image Viewer Modal for Entity Avatar */}
      {url && (
        <ImageViewerModal
          isOpen={isViewerOpen}
          imageUrl={url}
          title={entity.name}
          subtitle={`Foto Entitas • ${meta.label}`}
          onClose={() => setIsViewerOpen(false)}
        />
      )}
    </div>
  );
};

export const WorldBuildingView: React.FC<WorldBuildingViewProps> = ({
  bookId,
  bookTitle = 'Karya Buku',
  entities,
  onRefresh,
  chapters = [],
  onChatWithCharacter,
}) => {
  // Primary View Mode: 'list' (Daftar Kartu) or 'automap' (Peta Relasi & Visual Faksi)
  const [worldMode, setWorldMode] = useState<'list' | 'automap'>('list');
  const [selectedCategory, setSelectedCategory] = useState<'all' | WorldCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFaction, setSelectedFaction] = useState('all');
  const [selectedCondition, setSelectedCondition] = useState('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [hologramEntity, setHologramEntity] = useState<WorldEntity | null>(null);
  const [imagePickerEntity, setImagePickerEntity] = useState<WorldEntity | null>(null);

  const availableFactions = Array.from(
    new Set(entities.map((e) => e.faction?.trim()).filter((f): f is string => Boolean(f)))
  );

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
    if (selectedCategory !== 'all' && ent.category !== selectedCategory) return false;
    if (selectedFaction !== 'all' && ent.faction !== selectedFaction) return false;
    if (selectedCondition !== 'all' && ent.condition !== selectedCondition) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = ent.name.toLowerCase().includes(q);
      const matchDesc = (ent.shortDescription || '').toLowerCase().includes(q);
      const matchFaction = (ent.faction || '').toLowerCase().includes(q);
      const matchTraits = (ent.initialTraits || ent.currentTraits || '').toLowerCase().includes(q);
      if (!matchName && !matchDesc && !matchFaction && !matchTraits) return false;
    }
    return true;
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
      <div className="flex items-center justify-between gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 rounded-2xl shadow-sm">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setWorldMode('list')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition active:scale-95 whitespace-nowrap flex-1 sm:flex-initial justify-center ${
              worldMode === 'list'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <BookOpen className="w-4 h-4 flex-shrink-0" />
            <span>Ensiklopedia ({entities.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setWorldMode('automap')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition active:scale-95 whitespace-nowrap flex-1 sm:flex-initial justify-center ${
              worldMode === 'automap'
                ? 'bg-gradient-to-r from-pink-500 to-rose-600 text-white shadow-md shadow-pink-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <GitFork className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline">Peta Relasi &amp; Faksi (Auto-Map)</span>
            <span className="sm:hidden">Peta Relasi</span>
          </button>
        </div>
      </div>

      {/* Mode 1: Auto-Map Visualizer (Network & Faction Clusters) */}
      {worldMode === 'automap' ? (
        <WorldAutoMapView
          bookId={bookId}
          bookTitle={bookTitle}
          entities={entities}
          onRefresh={onRefresh}
          chapters={chapters}
          onClose={() => setWorldMode('list')}
        />
      ) : (
        /* Mode 2: Standard Entity Cards Grid - Deluxe Professional Codex Book Design */
        <div className="space-y-3.5">
          {/* 📖 Archival Encyclopedia Header Banner */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#fbf8f1] via-[#f7f2e7] to-[#ede3d1] dark:from-slate-900 dark:via-slate-900/90 dark:to-slate-950 border border-amber-900/15 dark:border-amber-500/25 p-4 sm:p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30 flex items-center justify-center flex-shrink-0 shadow-inner">
                  <Library className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-serif font-black text-sm sm:text-base text-slate-900 dark:text-amber-100 tracking-wide uppercase">
                      Kompendium &amp; Ensiklopedia Semesta
                    </h2>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-serif italic line-clamp-1 mt-0.5">
                    Katalog kanonik karakter, geografi wilayah, relik pusaka, dan kronik faksi cerita
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-amber-900 dark:text-amber-300 self-start sm:self-auto bg-white/80 dark:bg-slate-800/80 px-3 py-1.5 rounded-xl border border-amber-500/25 shadow-sm">
                <Bookmark className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>{entities.length} Folio Terarsip</span>
              </div>
            </div>
          </div>

          {/* Horizontal Category Filter (Codex Thumb Tabs) */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isSelected = selectedCategory === cat.id;
              const count = cat.id === 'all'
                ? entities.length
                : entities.filter((e) => e.category === cat.id).length;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition active:scale-95 ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                      : 'bg-white dark:bg-slate-900/90 border border-amber-900/10 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white shadow-sm'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>
                    {cat.label} ({count})
                  </span>
                </button>
              );
            })}
          </div>

          {/* 🔍 Quick Search, Faction Filter & Tambah Entitas (SEJAJAR) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-[#fdfbf7] dark:bg-slate-900/90 border border-amber-900/15 dark:border-amber-500/20 p-2.5 rounded-2xl shadow-sm">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari entitas, faksi, sifat, atau deskripsi..."
                className="w-full pl-9 pr-7 py-2 bg-white dark:bg-slate-950 border border-amber-900/15 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 transition shadow-inner font-serif"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Right Controls: Faction Filter & Tambah Entitas (Sejajar) */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Faction Filter Dropdown */}
              {availableFactions.length > 0 && (
                <div className="relative flex-shrink-0">
                  <select
                    value={selectedFaction}
                    onChange={(e) => setSelectedFaction(e.target.value)}
                    className="px-3 py-2 bg-white dark:bg-slate-950 border border-amber-900/15 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-amber-500 shadow-sm"
                  >
                    <option value="all">Semua Faksi ({availableFactions.length})</option>
                    {availableFactions.map((f) => (
                      <option key={f} value={f}>
                        Faksi: {f}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* 🌟 Tombol Tambah Entitas Sejajar dengan Filter Faksi */}
              <button
                type="button"
                onClick={handleOpenAddModal}
                className="inline-flex items-center gap-1.5 py-2 px-3.5 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-400 hover:to-amber-600 active:scale-95 text-slate-950 font-bold rounded-xl text-xs shadow-md shadow-amber-500/20 border border-amber-400/40 transition flex-shrink-0 whitespace-nowrap"
                title="Tambah entitas baru ke dalam ensiklopedia"
              >
                <Plus className="w-4 h-4 text-slate-950 stroke-[3]" />
                <span>Tambah Entitas</span>
              </button>
            </div>
          </div>

          {/* Micro-Hint / Catalog Counter */}
          {filteredEntities.length > 0 && (
            <div className="flex items-center justify-between gap-1.5 px-1 text-[11px] text-slate-500">
              <div className="flex items-center gap-1.5 truncate">
                <Info className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <span className="truncate font-serif italic">
                  Tip: Tekan tahan kartu untuk memunculkan intip hologram 3D.
                </span>
              </div>
              <span className="font-mono text-amber-700 dark:text-amber-400 flex-shrink-0 font-bold">
                {filteredEntities.length} entitas ditampilkan
              </span>
            </div>
          )}

          {/* Entities Grid */}
          {filteredEntities.length === 0 ? (
            <div className="text-center py-12 px-4 border border-dashed border-amber-900/20 dark:border-amber-500/20 rounded-3xl bg-[#fdfbf7]/60 dark:bg-slate-900/30">
              <BookOpen className="w-10 h-10 mx-auto text-amber-500/60 dark:text-amber-400/40 mb-2" />
              <h3 className="text-sm font-serif font-bold text-slate-900 dark:text-amber-100 mb-1">
                Lembar Ensiklopedia Masih Kosong
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-4 font-serif italic">
                Mulai bangun ensiklopedia semestamu: karakter utama, kastil tua, pusaka legendaris, atau sistem sihir.
              </p>
              <button
                onClick={handleOpenAddModal}
                className="inline-flex items-center gap-2 py-2 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-95 text-slate-950 font-bold rounded-xl text-xs shadow-md shadow-amber-500/20 transition"
              >
                <Plus className="w-4 h-4 text-slate-950 stroke-[3]" />
                <span>Tambah Entitas Baru</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredEntities.map((entity, idx) => (
                <EntityCard
                  key={entity.id}
                  entity={entity}
                  index={idx}
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
        onChatWithCharacter={onChatWithCharacter}
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
