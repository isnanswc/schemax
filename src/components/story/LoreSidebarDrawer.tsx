import React, { useState } from 'react';
import { WorldEntity, WorldCategory } from '../../types';
import { useMediaUrl } from '../../hooks/useMediaUrl';
import {
  X,
  Compass,
  User,
  MapPin,
  Shield,
  Scroll,
  Search,
  Sparkles,
  Copy,
  Check,
  ChevronRight
} from 'lucide-react';

interface LoreSidebarDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  entities: WorldEntity[];
  onInsertEntityName?: (name: string) => void;
}

const LoreEntityItem: React.FC<{
  entity: WorldEntity;
  onInsert?: (name: string) => void;
}> = ({ entity, onInsert }) => {
  const { url } = useMediaUrl(entity.avatarMediaId);
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const categoryMeta: Record<WorldCategory, { label: string; icon: any; color: string; badge: string }> = {
    character: { label: 'Karakter', icon: User, color: 'text-pink-400', badge: 'bg-pink-500/10 text-pink-400 border-pink-500/30' },
    location: { label: 'Lokasi', icon: MapPin, color: 'text-cyan-400', badge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' },
    item: { label: 'Item', icon: Shield, color: 'text-yellow-400', badge: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' },
    lore: { label: 'Lore', icon: Scroll, color: 'text-purple-400', badge: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
  };

  const meta = categoryMeta[entity.category] || categoryMeta.character;
  const Icon = meta.icon;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(entity.name);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      onClick={() => setIsExpanded(!isExpanded)}
      className="bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-3 space-y-2 cursor-pointer transition hover:border-slate-300 dark:hover:border-slate-700/80 active:scale-[0.99] shadow-sm"
    >
      <div className="flex items-center gap-2.5">
        <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex-shrink-0 flex items-center justify-center">
          {url ? (
            <img src={url} alt={entity.name} className="w-full h-full object-cover" />
          ) : (
            <Icon className={`w-4 h-4 ${meta.color}`} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md text-[9px] font-bold border ${meta.badge}`}>
              <Icon className="w-2.5 h-2.5" />
              <span>{meta.label}</span>
            </span>
          </div>
          <h5 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">{entity.name}</h5>
        </div>

        <div className="flex items-center gap-1">
          {onInsert && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onInsert(entity.name);
              }}
              className="py-1 px-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-500/30 text-[10px] font-bold transition active:scale-95"
              title="Sisipkan nama ke naskah"
            >
              Sisip
            </button>
          )}

          <button
            type="button"
            onClick={handleCopy}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white transition"
            title="Salin Nama"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {entity.shortDescription && (
        <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug line-clamp-2">
          {entity.shortDescription}
        </p>
      )}

      {/* Expanded Quick Attributes */}
      {isExpanded && (
        <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 space-y-2 animate-in fade-in">
          {entity.attributes && entity.attributes.length > 0 && (
            <div className="grid grid-cols-2 gap-1 text-[10px]">
              {entity.attributes.map((attr) => (
                <div key={attr.id} className="bg-white dark:bg-slate-900 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 flex justify-between">
                  <span className="text-slate-500 truncate mr-1">{attr.label}</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{attr.value}</span>
                </div>
              ))}
            </div>
          )}

          {entity.detailedNotes && (
            <p className="text-[10px] text-slate-700 dark:text-slate-300 italic bg-amber-50/50 dark:bg-slate-900/60 p-2 rounded-lg border border-amber-200/60 dark:border-slate-800/60 leading-relaxed">
              {entity.detailedNotes}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export const LoreSidebarDrawer: React.FC<LoreSidebarDrawerProps> = ({
  isOpen,
  onClose,
  entities,
  onInsertEntityName,
}) => {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | WorldCategory>('all');

  if (!isOpen) return null;

  const filtered = entities.filter((ent) => {
    const matchesCat = activeCategory === 'all' ? true : ent.category === activeCategory;
    const matchesSearch =
      !search ||
      ent.name.toLowerCase().includes(search.toLowerCase()) ||
      (ent.shortDescription && ent.shortDescription.toLowerCase().includes(search.toLowerCase())) ||
      (ent.tags && ent.tags.some((t) => t.toLowerCase().includes(search.toLowerCase())));
    return matchesCat && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Blurred Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Slide Drawer from Right (320px on mobile, 380px on desktop) */}
      <div className="relative w-full max-w-[320px] sm:max-w-[380px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800/90 h-full flex flex-col shadow-2xl z-10 animate-in slide-in-from-right duration-250 safe-top safe-bottom">
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950/60">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Lore & Glosarium</h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">{entities.length} entitas terdaftar</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-3 border-b border-slate-200 dark:border-slate-800/60 space-y-2 bg-white dark:bg-slate-900">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari karakter, lokasi, item..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-400 shadow-sm"
            />
          </div>

          {/* Category Chips */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
            {(['all', 'character', 'location', 'item', 'lore'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition ${
                  activeCategory === cat
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800/80'
                }`}
              >
                {cat === 'all'
                  ? 'Semua'
                  : cat === 'character'
                  ? 'Karakter'
                  : cat === 'location'
                  ? 'Lokasi'
                  : cat === 'item'
                  ? 'Item'
                  : 'Lore'}
              </button>
            ))}
          </div>
        </div>

        {/* List of Entities */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 no-scrollbar">
          {filtered.length === 0 ? (
            <div className="text-center py-10 px-3 text-slate-400 dark:text-slate-500 text-xs">
              <Compass className="w-8 h-8 mx-auto mb-2 text-slate-400 dark:text-slate-600" />
              <p>Tidak ada entitas ditemukan.</p>
            </div>
          ) : (
            filtered.map((ent) => (
              <LoreEntityItem
                key={ent.id}
                entity={ent}
                onInsert={onInsertEntityName}
              />
            ))
          )}
        </div>

        {/* Bottom Drawer Footer */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950/40 text-center">
          <p className="text-[10px] text-slate-500 dark:text-slate-400">
            💡 Ketuk entitas untuk melihat rincian atribut dan catatan rahasia.
          </p>
        </div>
      </div>
    </div>
  );
};
