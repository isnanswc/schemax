import React, { useState } from 'react';
import { WorldEntity, WorldCategory } from '../../types';
import { AddWorldEntityModal } from './AddWorldEntityModal';
import { useMediaUrl } from '../../hooks/useMediaUrl';
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
  Sparkles
} from 'lucide-react';
import { db } from '../../db';

interface WorldBuildingViewProps {
  bookId: string;
  entities: WorldEntity[];
  onRefresh: () => void;
}

const EntityCard: React.FC<{
  entity: WorldEntity;
  onDelete: (id: string, name: string) => void;
}> = ({ entity, onDelete }) => {
  const { url } = useMediaUrl(entity.avatarMediaId);
  const [isExpanded, setIsExpanded] = useState(false);

  const categoryMeta: Record<WorldCategory, { label: string; icon: any; color: string; badge: string }> = {
    character: { label: 'Karakter', icon: User, color: 'text-pink-400', badge: 'bg-pink-500/10 text-pink-400 border-pink-500/30' },
    location: { label: 'Lokasi', icon: MapPin, color: 'text-cyan-400', badge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' },
    item: { label: 'Item/Relik', icon: Shield, color: 'text-yellow-400', badge: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' },
    lore: { label: 'Lore/Faksi', icon: Scroll, color: 'text-purple-400', badge: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
  };

  const meta = categoryMeta[entity.category];
  const Icon = meta.icon;

  return (
    <div className="bg-slate-900/80 hover:bg-slate-900 border border-slate-800 rounded-2xl p-4 transition shadow-sm space-y-3">
      {/* Top Header */}
      <div className="flex items-start gap-3">
        {/* Avatar / Visual preview */}
        <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex-shrink-0 flex items-center justify-center">
          {url ? (
            <img src={url} alt={entity.name} className="w-full h-full object-cover" />
          ) : (
            <Icon className={`w-6 h-6 ${meta.color}`} />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${meta.badge}`}>
              <Icon className="w-3 h-3" />
              <span>{meta.label}</span>
            </span>

            <button
              onClick={() => onDelete(entity.id, entity.name)}
              className="p-1 rounded-lg text-slate-500 hover:text-red-400 transition"
              title="Hapus Entitas"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <h4 className="font-bold text-base text-white truncate">{entity.name}</h4>
          {entity.shortDescription && (
            <p className="text-xs text-slate-400 line-clamp-2 mt-0.5 leading-snug">
              {entity.shortDescription}
            </p>
          )}
        </div>
      </div>

      {/* Attributes Badges / Key Values */}
      {entity.attributes && entity.attributes.length > 0 && (
        <div className="grid grid-cols-2 gap-1.5 pt-1">
          {entity.attributes.slice(0, isExpanded ? undefined : 2).map((attr) => (
            <div
              key={attr.id}
              className="bg-slate-950/70 border border-slate-800/80 rounded-lg px-2.5 py-1 text-[11px] flex items-center justify-between"
            >
              <span className="text-slate-400">{attr.label}</span>
              <span className="font-medium text-white truncate max-w-[100px]">{attr.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Expanded Detailed Notes & Tags */}
      {isExpanded && (
        <div className="pt-2 border-t border-slate-800/80 space-y-2 text-xs animate-in fade-in">
          {entity.detailedNotes && (
            <div>
              <span className="font-semibold text-slate-300 block mb-1">Catatan Lore & Latar:</span>
              <p className="text-slate-400 leading-relaxed whitespace-pre-wrap bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/60">
                {entity.detailedNotes}
              </p>
            </div>
          )}

          {entity.tags && entity.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {entity.tags.map((t, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px] font-medium"
                >
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Expand/Collapse Button */}
      {(entity.detailedNotes || (entity.attributes && entity.attributes.length > 2)) && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full pt-1 flex items-center justify-center gap-1 text-[11px] font-medium text-amber-400/90 hover:text-amber-300 transition"
        >
          <span>{isExpanded ? 'Tutup Rincian' : 'Lihat Rincian Lore & Atribut'}</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      )}
    </div>
  );
};

export const WorldBuildingView: React.FC<WorldBuildingViewProps> = ({
  bookId,
  entities,
  onRefresh,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'all' | WorldCategory>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

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
    <div className="space-y-4 pb-20">
      {/* Category Pills & Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Horizontal Category Filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                  isSelected
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
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

        {/* Add Entity Button */}
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-400 hover:to-rose-500 active:scale-95 text-white font-bold rounded-xl text-xs shadow-md shadow-pink-500/20 transition flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Worldbuilding</span>
        </button>
      </div>

      {/* Entities Grid */}
      {filteredEntities.length === 0 ? (
        <div className="text-center py-12 px-4 border border-dashed border-slate-800 rounded-2xl bg-slate-900/40">
          <Compass className="w-10 h-10 mx-auto text-slate-600 mb-3" />
          <h3 className="text-sm font-bold text-white mb-1">Belum Ada Entitas di Kategori Ini</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
            Mulai bangun ensiklopedia duniamu: karakter utama, kastil tua, senjata legendaris, atau sistem sihir.
          </p>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-2 py-2 px-4 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl text-xs border border-slate-700 transition"
          >
            <Plus className="w-4 h-4 text-pink-400" />
            <span>Tambah Entitas Baru</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredEntities.map((entity) => (
            <EntityCard key={entity.id} entity={entity} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* Modal */}
      <AddWorldEntityModal
        isOpen={isAddModalOpen}
        bookId={bookId}
        initialCategory={selectedCategory === 'all' ? 'character' : selectedCategory}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => onRefresh()}
      />
    </div>
  );
};
