import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  WorldEntity,
  EntityRelationship,
  EntityCondition,
  RelationshipType,
  WorldCategory
} from '../../types';
import { db } from '../../db';
import { autoMapWorldEntities, AutoMapResult } from '../../services/aiService';
import { getConditionMeta, ENTITY_CONDITIONS } from './entityConditionMeta';
import { getRelationshipMeta, RELATIONSHIP_META } from './relationshipMeta';
import { EntityImagePickerModal } from './EntityImagePickerModal';
import { WorldEntityHologramModal } from './WorldEntityHologramModal';
import {
  Sparkles,
  GitFork,
  Boxes,
  Plus,
  Search,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Filter,
  Eye,
  Camera,
  Edit2,
  Trash2,
  X,
  Check,
  Loader2,
  Shield,
  Layers,
  ChevronRight,
  Info,
  SlidersHorizontal,
  Flame,
  User,
  MapPin,
  Scroll
} from 'lucide-react';

interface WorldAutoMapViewProps {
  bookId: string;
  bookTitle: string;
  entities: WorldEntity[];
  onRefresh: () => void;
}

interface NodePosition {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
}

export const WorldAutoMapView: React.FC<WorldAutoMapViewProps> = ({
  bookId,
  bookTitle,
  entities,
  onRefresh,
}) => {
  // Modes: 'network' (Hubungan Garis) or 'clusters' (Himpunan Faksi)
  const [viewMode, setViewMode] = useState<'network' | 'clusters'>('network');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFactionFilter, setSelectedFactionFilter] = useState<string>('all');
  const [selectedConditionFilter, setSelectedConditionFilter] = useState<string>('all');
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

  // Modals
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiPreviewData, setAiPreviewData] = useState<AutoMapResult | null>(null);
  const [isAddRelationOpen, setIsAddRelationOpen] = useState(false);
  const [imagePickerEntity, setImagePickerEntity] = useState<WorldEntity | null>(null);
  const [hologramEntity, setHologramEntity] = useState<WorldEntity | null>(null);
  const [conditionEditorEntity, setConditionEditorEntity] = useState<WorldEntity | null>(null);

  // Interactive Canvas State
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);

  // Node Positions Map { [entityId]: { x, y } }
  const [nodePositions, setNodePositions] = useState<Record<string, NodePosition>>({});

  // Media blobs URLs cache
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});

  // Load avatar blobs for all entities
  useEffect(() => {
    let active = true;
    const mediaIdsToFetch = entities
      .map((e) => e.avatarMediaId)
      .filter((id): id is string => !!id && !mediaUrls[id]);

    if (mediaIdsToFetch.length > 0) {
      db.media
        .where('id')
        .anyOf(mediaIdsToFetch)
        .toArray()
        .then((items) => {
          if (!active) return;
          const newMap: Record<string, string> = {};
          items.forEach((item) => {
            newMap[item.id] = URL.createObjectURL(item.blob);
          });
          setMediaUrls((prev) => ({ ...prev, ...newMap }));
        });
    }

    return () => {
      active = false;
    };
  }, [entities]);

  // Derive all unique factions from entities
  const availableFactions = useMemo(() => {
    const set = new Set<string>();
    entities.forEach((e) => {
      if (e.faction?.trim()) {
        set.add(e.faction.trim());
      }
    });
    return Array.from(set);
  }, [entities]);

  // Calculate layout / positions on entity changes
  useEffect(() => {
    if (entities.length === 0) return;

    setNodePositions((prev) => {
      const next = { ...prev };
      const centerX = 450;
      const centerY = 350;
      const radius = Math.min(320, 120 + entities.length * 25);

      // Group entities by faction for organic initial clustering
      const factionGroups: Record<string, WorldEntity[]> = {};
      entities.forEach((e) => {
        const fac = e.faction?.trim() || 'Independen / Netral';
        if (!factionGroups[fac]) factionGroups[fac] = [];
        factionGroups[fac].push(e);
      });

      const factions = Object.keys(factionGroups);
      let angleIndex = 0;
      const totalEntities = entities.length;

      factions.forEach((fac, facIdx) => {
        const group = factionGroups[fac];
        const groupAngleCenter = (2 * Math.PI * facIdx) / Math.max(1, factions.length);
        const groupRadius = factions.length > 1 ? radius * 0.75 : 0;
        const groupCenterX = centerX + Math.cos(groupAngleCenter) * groupRadius;
        const groupCenterY = centerY + Math.sin(groupAngleCenter) * groupRadius;

        group.forEach((ent, entIdx) => {
          if (!next[ent.id]) {
            if (group.length === 1 && factions.length > 1) {
              next[ent.id] = { x: groupCenterX, y: groupCenterY };
            } else {
              const subAngle = (2 * Math.PI * entIdx) / Math.max(1, group.length);
              const subRadius = Math.min(100, 35 + group.length * 12);
              next[ent.id] = {
                x: groupCenterX + Math.cos(subAngle) * subRadius,
                y: groupCenterY + Math.sin(subAngle) * subRadius,
              };
            }
          }
          angleIndex++;
        });
      });

      return next;
    });
  }, [entities]);

  // Filtered entities based on search, faction, and condition
  const filteredEntities = useMemo(() => {
    return entities.filter((ent) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = ent.name.toLowerCase().includes(q);
        const matchFaction = ent.faction?.toLowerCase().includes(q);
        const matchDesc = ent.shortDescription?.toLowerCase().includes(q);
        if (!matchName && !matchFaction && !matchDesc) return false;
      }

      if (selectedFactionFilter !== 'all') {
        const fac = ent.faction?.trim() || 'Independen / Netral';
        if (fac !== selectedFactionFilter) return false;
      }

      if (selectedConditionFilter !== 'all') {
        const cond = ent.condition || 'aktif';
        if (cond !== selectedConditionFilter) return false;
      }

      return true;
    });
  }, [entities, searchQuery, selectedFactionFilter, selectedConditionFilter]);

  const selectedEntity = useMemo(() => {
    return entities.find((e) => e.id === selectedEntityId) || null;
  }, [entities, selectedEntityId]);

  // Extract all links/relationships between existing entities
  const allRelationshipLinks = useMemo(() => {
    const links: Array<{
      sourceId: string;
      targetId: string;
      sourceName: string;
      targetName: string;
      relationship: EntityRelationship;
    }> = [];

    const entityMap = new Map(entities.map((e) => [e.id, e]));

    entities.forEach((source) => {
      if (source.relationships && source.relationships.length > 0) {
        source.relationships.forEach((rel) => {
          const target = entityMap.get(rel.targetEntityId);
          if (target) {
            // Avoid duplicate bidirectional render if identical
            links.push({
              sourceId: source.id,
              targetId: target.id,
              sourceName: source.name,
              targetName: target.name,
              relationship: rel,
            });
          }
        });
      }
    });

    return links;
  }, [entities]);

  // Faction clusters grouping for Cluster / Himpunan Mode
  const factionClusters = useMemo(() => {
    const map: Record<string, { name: string; color: string; description: string; members: WorldEntity[] }> = {};

    entities.forEach((ent) => {
      const facName = ent.faction?.trim() || 'Independen / Netral';
      if (!map[facName]) {
        map[facName] = {
          name: facName,
          color: ent.factionColor || '#ec4899',
          description: '',
          members: [],
        };
      }
      map[facName].members.push(ent);
    });

    return Object.values(map);
  }, [entities]);

  // AI Auto-Map execution
  const handleTriggerAutoMap = async () => {
    if (entities.length === 0) {
      alert('Tambahkan setidaknya 1 atau 2 entitas sebelum menjalankan Auto-Map.');
      return;
    }

    setIsAiLoading(true);
    try {
      const result = await autoMapWorldEntities(bookTitle, entities);
      setAiPreviewData(result);
    } catch (err: any) {
      console.error('Auto map failed:', err);
      alert(`Gagal menjalankan Auto-Map AI: ${err?.message || 'Periksa API Key Gemini Anda.'}`);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Apply AI Auto-Map results to Dexie
  const handleApplyAiResults = async () => {
    if (!aiPreviewData) return;
    setIsAiLoading(true);

    try {
      const factionColorMap: Record<string, string> = {};
      aiPreviewData.factions.forEach((f) => {
        factionColorMap[f.name] = f.color;
      });

      for (const item of aiPreviewData.mappedEntities) {
        const ent = entities.find((e) => e.id === item.id);
        if (ent) {
          await db.worldEntities.update(ent.id, {
            faction: item.faction || ent.faction,
            factionColor: item.factionColor || factionColorMap[item.faction] || ent.factionColor || '#ec4899',
            condition: item.condition || ent.condition || 'aktif',
            conditionDetails: item.conditionDetails || ent.conditionDetails || '',
            relationships: item.relationships && item.relationships.length > 0 ? item.relationships : ent.relationships,
            updatedAt: Date.now(),
          });
        }
      }

      setAiPreviewData(null);
      onRefresh();
    } catch (err) {
      console.error('Gagal menerapkan hasil auto-map:', err);
      alert('Gagal menerapkan data ke database.');
    } finally {
      setIsAiLoading(false);
    }
  };

  // Handle Dragging Canvas (Panning)
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.interactive-node')) return;
    setIsDraggingCanvas(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (draggedNodeId) {
      // Dragging a specific node
      const rect = e.currentTarget.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left - pan.x) / zoom;
      const mouseY = (e.clientY - rect.top - pan.y) / zoom;

      setNodePositions((prev) => ({
        ...prev,
        [draggedNodeId]: { x: mouseX, y: mouseY },
      }));
    } else if (isDraggingCanvas) {
      // Panning canvas
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleCanvasMouseUp = () => {
    setIsDraggingCanvas(false);
    setDraggedNodeId(null);
  };

  // Reset View
  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSelectedEntityId(null);
  };

  return (
    <div className="space-y-3 pb-24">
      {/* Top Main Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Mode Switcher Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode('network')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition active:scale-95 ${
                viewMode === 'network'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <GitFork className="w-3.5 h-3.5" />
              <span>Garis Relasi (Network)</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('clusters')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition active:scale-95 ${
                viewMode === 'clusters'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Boxes className="w-3.5 h-3.5" />
              <span>Himpunan Faksi (Cluster)</span>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Auto Map AI Button */}
            <button
              type="button"
              onClick={handleTriggerAutoMap}
              disabled={isAiLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-pink-500 via-rose-500 to-amber-500 hover:from-pink-400 hover:to-amber-400 text-white font-bold rounded-xl text-xs shadow-md shadow-pink-500/20 active:scale-95 transition disabled:opacity-50"
            >
              {isAiLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-yellow-200" />
              )}
              <span>Auto-Map AI</span>
            </button>

            {/* Manual Add Relation */}
            <button
              type="button"
              onClick={() => setIsAddRelationOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold rounded-xl text-xs border border-slate-200 dark:border-slate-700 active:scale-95 transition"
            >
              <Plus className="w-3.5 h-3.5 text-pink-500" />
              <span>+ Hubungan</span>
            </button>

            {/* Reset View */}
            <button
              type="button"
              onClick={handleResetView}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 text-xs transition"
              title="Reset Zoom & Posisi"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Search & Filters Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs">
          {/* Live Search */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari karakter, faksi, relasi..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-pink-500"
            />
          </div>

          {/* Faction Filter Pill */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap">Faksi:</span>
            <select
              value={selectedFactionFilter}
              onChange={(e) => setSelectedFactionFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1 text-xs text-slate-700 dark:text-slate-300 font-medium focus:outline-none"
            >
              <option value="all">Semua Faksi ({availableFactions.length})</option>
              {availableFactions.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>

            <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap ml-2">Kondisi:</span>
            <select
              value={selectedConditionFilter}
              onChange={(e) => setSelectedConditionFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1 text-xs text-slate-700 dark:text-slate-300 font-medium focus:outline-none"
            >
              <option value="all">Semua Kondisi</option>
              {Object.values(ENTITY_CONDITIONS).map((cond) => (
                <option key={cond.id} value={cond.id}>
                  {cond.emoji} {cond.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Interactive Map Canvas */}
      {viewMode === 'network' ? (
        <div className="relative w-full h-[620px] sm:h-[680px] bg-slate-950 rounded-3xl border border-slate-800 overflow-hidden shadow-2xl select-none">
          {/* Subtle Cyber Grid Background */}
          <div
            className="absolute inset-0 pointer-events-none opacity-25"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.15) 1px, transparent 0)`,
              backgroundSize: '24px 24px',
            }}
          />

          {/* Canvas Floating Overlay Controls */}
          <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md p-1.5 rounded-xl border border-slate-800 text-xs text-slate-300">
            <button
              onClick={() => setZoom((z) => Math.min(2.5, z + 0.15))}
              className="p-1 hover:text-white rounded-lg hover:bg-slate-800"
              title="Perbesar"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <span className="text-[10px] font-mono px-1">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom((z) => Math.max(0.4, z - 0.15))}
              className="p-1 hover:text-white rounded-lg hover:bg-slate-800"
              title="Perkecil"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Legend Drawer in Canvas */}
          <div className="absolute top-3 right-3 z-10 hidden sm:flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 text-[10px] text-slate-300">
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-0.5 bg-cyan-400 inline-block" />
              <span>Sekutu</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-0.5 bg-red-500 border-b border-dashed inline-block" />
              <span>Musuh</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-0.5 bg-amber-400 inline-block" />
              <span>Keluarga</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-0.5 bg-fuchsia-400 border-b border-dotted inline-block" />
              <span>Khianat</span>
            </div>
          </div>

          {/* Interactive SVG Canvas */}
          <svg
            className="w-full h-full cursor-grab active:cursor-grabbing"
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
          >
            <defs>
              {/* Arrow markers for directional relations */}
              <marker
                id="arrowhead-cyan"
                markerWidth="8"
                markerHeight="6"
                refX="7"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 8 3, 0 6" fill="#06b6d4" />
              </marker>
              <marker
                id="arrowhead-red"
                markerWidth="8"
                markerHeight="6"
                refX="7"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 8 3, 0 6" fill="#ef4444" />
              </marker>
              <marker
                id="arrowhead-amber"
                markerWidth="8"
                markerHeight="6"
                refX="7"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 8 3, 0 6" fill="#eab308" />
              </marker>
              <marker
                id="arrowhead-fuchsia"
                markerWidth="8"
                markerHeight="6"
                refX="7"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 8 3, 0 6" fill="#d946ef" />
              </marker>

              {/* Clip path circle for entity avatars */}
              <clipPath id="avatar-clip">
                <circle cx="28" cy="28" r="24" />
              </clipPath>
            </defs>

            {/* Transform Group for Pan & Zoom */}
            <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
              {/* Relationship Lines & Bézier Curves */}
              {allRelationshipLinks.map((link, idx) => {
                const sourcePos = nodePositions[link.sourceId];
                const targetPos = nodePositions[link.targetId];
                if (!sourcePos || !targetPos) return null;

                const isConnectedToSelected =
                  !selectedEntityId ||
                  link.sourceId === selectedEntityId ||
                  link.targetId === selectedEntityId;

                const relMeta = getRelationshipMeta(link.relationship.relationshipType);

                // Calculate curved Bézier midpoint
                const dx = targetPos.x - sourcePos.x;
                const dy = targetPos.y - sourcePos.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const curvature = Math.min(45, dist * 0.15) * (idx % 2 === 0 ? 1 : -1);

                const midX = (sourcePos.x + targetPos.x) / 2 - (dy / (dist || 1)) * curvature;
                const midY = (sourcePos.y + targetPos.y) / 2 + (dx / (dist || 1)) * curvature;

                const pathData = `M ${sourcePos.x} ${sourcePos.y} Q ${midX} ${midY} ${targetPos.x} ${targetPos.y}`;

                return (
                  <g key={`${link.sourceId}_${link.targetId}_${idx}`} className="transition-opacity duration-200">
                    {/* Shadow / Glow Line */}
                    <path
                      d={pathData}
                      fill="none"
                      stroke={relMeta.colorHex}
                      strokeWidth={isConnectedToSelected ? '4' : '1.5'}
                      strokeOpacity={isConnectedToSelected ? '0.3' : '0.08'}
                    />
                    {/* Main Core Line */}
                    <path
                      d={pathData}
                      fill="none"
                      stroke={relMeta.colorHex}
                      strokeWidth={isConnectedToSelected ? '2.5' : '1'}
                      strokeDasharray={relMeta.strokeDasharray}
                      strokeOpacity={isConnectedToSelected ? '0.9' : '0.25'}
                    />

                    {/* Relationship floating badge pill at curve center */}
                    {isConnectedToSelected && link.relationship.label && (
                      <g transform={`translate(${midX}, ${midY})`}>
                        <rect
                          x="-38"
                          y="-9"
                          width="76"
                          height="18"
                          rx="9"
                          fill="#0f172a"
                          stroke={relMeta.colorHex}
                          strokeWidth="1"
                          strokeOpacity="0.8"
                        />
                        <text
                          x="0"
                          y="3"
                          fill="#ffffff"
                          fontSize="9"
                          fontWeight="bold"
                          textAnchor="middle"
                          className="pointer-events-none select-none font-sans"
                        >
                          {link.relationship.label.slice(0, 14)}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}

              {/* Entity Nodes */}
              {filteredEntities.map((entity) => {
                const pos = nodePositions[entity.id] || { x: 450, y: 350 };
                const isSelected = selectedEntityId === entity.id;
                const isDimmed =
                  selectedEntityId &&
                  selectedEntityId !== entity.id &&
                  !allRelationshipLinks.some(
                    (l) =>
                      (l.sourceId === selectedEntityId && l.targetId === entity.id) ||
                      (l.targetId === selectedEntityId && l.sourceId === entity.id)
                  );

                const condMeta = getConditionMeta(entity.condition);
                const avatarUrl = (entity.avatarMediaId && mediaUrls[entity.avatarMediaId]) || entity.avatarUrl;
                const factionColor = entity.factionColor || '#ec4899';

                return (
                  <g
                    key={entity.id}
                    transform={`translate(${pos.x - 28}, ${pos.y - 28})`}
                    className={`interactive-node cursor-pointer transition-transform duration-150 ${
                      isDimmed ? 'opacity-30' : 'opacity-100'
                    }`}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setDraggedNodeId(entity.id);
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedEntityId(isSelected ? null : entity.id);
                    }}
                  >
                    {/* Glowing outer ring when selected or active */}
                    <circle
                      cx="28"
                      cy="28"
                      r={isSelected ? '35' : '30'}
                      fill="none"
                      stroke={isSelected ? '#38bdf8' : factionColor}
                      strokeWidth={isSelected ? '3.5' : '2'}
                      strokeOpacity={isSelected ? '1' : '0.6'}
                      className={isSelected ? 'animate-pulse' : ''}
                    />

                    {/* Node Background Base */}
                    <circle cx="28" cy="28" r="25" fill="#0f172a" />

                    {/* Character Avatar or Category Fallback Icon */}
                    {avatarUrl ? (
                      <g clipPath="url(#avatar-clip)">
                        <image
                          href={avatarUrl}
                          x="4"
                          y="4"
                          width="48"
                          height="48"
                          preserveAspectRatio="xMidYMid slice"
                        />
                      </g>
                    ) : (
                      <g transform="translate(18, 18)">
                        {entity.category === 'character' && <User className="w-5 h-5 text-pink-400" />}
                        {entity.category === 'location' && <MapPin className="w-5 h-5 text-cyan-400" />}
                        {entity.category === 'item' && <Shield className="w-5 h-5 text-amber-400" />}
                        {entity.category === 'lore' && <Scroll className="w-5 h-5 text-purple-400" />}
                      </g>
                    )}

                    {/* Condition Status Badge (Top-Right) */}
                    <g transform="translate(40, 2)">
                      <circle cx="8" cy="8" r="9" fill="#0f172a" stroke={condMeta.colorHex} strokeWidth="1.5" />
                      <text x="8" y="11" fontSize="10" textAnchor="middle">
                        {condMeta.emoji}
                      </text>
                    </g>

                    {/* Entity Name Pill Label (Bottom) */}
                    <g transform="translate(28, 64)">
                      <rect
                        x={-Math.max(30, entity.name.length * 3.5)}
                        y="-10"
                        width={Math.max(60, entity.name.length * 7)}
                        height="20"
                        rx="10"
                        fill="#020617"
                        stroke={factionColor}
                        strokeWidth="1"
                        strokeOpacity="0.8"
                      />
                      <text
                        x="0"
                        y="4"
                        fill="#ffffff"
                        fontSize="10"
                        fontWeight="bold"
                        textAnchor="middle"
                        className="pointer-events-none select-none font-sans"
                      >
                        {entity.name}
                      </text>
                    </g>

                    {/* Faction or Condition Tag Label below Name */}
                    {entity.faction && (
                      <g transform="translate(28, 79)">
                        <text
                          x="0"
                          y="4"
                          fill={factionColor}
                          fontSize="8"
                          fontWeight="semibold"
                          textAnchor="middle"
                          className="pointer-events-none select-none font-sans opacity-90"
                        >
                          {entity.faction.slice(0, 16)}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>

          {/* Bottom Floating Inspector Panel when Entity Selected */}
          {selectedEntity && (
            <div className="absolute bottom-3 inset-x-3 sm:inset-x-auto sm:left-4 sm:w-96 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl p-4 shadow-2xl z-20 animate-in slide-in-from-bottom-3 duration-200">
              <div className="flex items-start justify-between gap-3 mb-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* Avatar / Camera Quick Changer */}
                  <div
                    onClick={() => setImagePickerEntity(selectedEntity)}
                    className="relative group w-12 h-12 rounded-xl overflow-hidden bg-slate-950 border border-slate-700 flex-shrink-0 cursor-pointer"
                    title="Ganti Gambar Utama"
                  >
                    {selectedEntity.avatarMediaId && mediaUrls[selectedEntity.avatarMediaId] ? (
                      <img
                        src={mediaUrls[selectedEntity.avatarMediaId]}
                        alt={selectedEntity.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-pink-400 font-bold text-base">
                        {selectedEntity.name.slice(0, 1)}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                      <Camera className="w-4 h-4 text-white" />
                    </div>
                  </div>

                  <div className="min-w-0">
                    <h4 className="font-bold text-sm text-white truncate">{selectedEntity.name}</h4>
                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                      {selectedEntity.faction && (
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-semibold border"
                          style={{
                            borderColor: `${selectedEntity.factionColor || '#ec4899'}40`,
                            color: selectedEntity.factionColor || '#ec4899',
                            backgroundColor: `${selectedEntity.factionColor || '#ec4899'}15`,
                          }}
                        >
                          {selectedEntity.faction}
                        </span>
                      )}
                      {/* Condition Badge with Quick Edit */}
                      <button
                        type="button"
                        onClick={() => setConditionEditorEntity(selectedEntity)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition hover:scale-105 ${
                          getConditionMeta(selectedEntity.condition).badgeClass
                        }`}
                        title="Klik untuk ubah kondisi"
                      >
                        <span>{getConditionMeta(selectedEntity.condition).emoji}</span>
                        <span>{getConditionMeta(selectedEntity.condition).label}</span>
                        <Edit2 className="w-2.5 h-2.5 opacity-60 ml-0.5" />
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedEntityId(null)}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Condition Note if exists */}
              {selectedEntity.conditionDetails && (
                <p className="text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 p-2 rounded-xl mb-2.5 leading-snug">
                  <strong>Kondisi:</strong> {selectedEntity.conditionDetails}
                </p>
              )}

              {/* Connected Relationships in Inspector */}
              <div className="space-y-1 mb-3 max-h-24 overflow-y-auto no-scrollbar">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Jaringan Relasi ({selectedEntity.relationships?.length || 0})
                </span>
                {(!selectedEntity.relationships || selectedEntity.relationships.length === 0) ? (
                  <p className="text-[11px] text-slate-500 italic">Belum ada relasi tercatat.</p>
                ) : (
                  selectedEntity.relationships.map((rel, rIdx) => {
                    const targetEnt = entities.find((e) => e.id === rel.targetEntityId);
                    const relMeta = getRelationshipMeta(rel.relationshipType);
                    return (
                      <div
                        key={rIdx}
                        className="flex items-center justify-between text-[11px] bg-slate-950/60 border border-slate-800 rounded-lg px-2 py-1"
                      >
                        <span className="font-semibold text-slate-200 truncate">
                          {rel.label}: {targetEnt?.name || 'Entitas Lain'}
                        </span>
                        <span
                          className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase"
                          style={{ color: relMeta.colorHex }}
                        >
                          {relMeta.label.split('/')[0]}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Inspector Quick Action Buttons */}
              <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setHologramEntity(selectedEntity)}
                  className="flex-1 py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
                >
                  <Eye className="w-3.5 h-3.5 text-amber-400" />
                  <span>Hologram Profil</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddRelationOpen(true)}
                  className="py-1.5 px-3 bg-pink-500/20 hover:bg-pink-500/30 text-pink-400 border border-pink-500/30 font-bold rounded-xl text-xs flex items-center gap-1 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Relasi</span>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Visual Mode 2: Himpunan Faksi (Cluster Sets) */
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {factionClusters.map((cluster) => {
              const clusterColor = cluster.color || '#ec4899';
              return (
                <div
                  key={cluster.name}
                  className="relative bg-white dark:bg-slate-900 border rounded-3xl p-5 shadow-md space-y-4 overflow-hidden transition"
                  style={{
                    borderColor: `${clusterColor}40`,
                  }}
                >
                  {/* Glowing corner gradient ambient */}
                  <div
                    className="absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl pointer-events-none"
                    style={{ backgroundColor: `${clusterColor}20` }}
                  />

                  {/* Cluster Header */}
                  <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: clusterColor }}
                      />
                      <div>
                        <h3 className="text-base font-black text-slate-900 dark:text-white">
                          {cluster.name}
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          Himpunan Anggota ({cluster.members.length})
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Members inside the Himpunan */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {cluster.members.map((member) => {
                      const avatarUrl = (member.avatarMediaId && mediaUrls[member.avatarMediaId]) || member.avatarUrl;
                      const condMeta = getConditionMeta(member.condition);

                      return (
                        <div
                          key={member.id}
                          onClick={() => setHologramEntity(member)}
                          className="group relative bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80 hover:border-pink-500/50 rounded-2xl p-2.5 flex items-start gap-2.5 cursor-pointer transition hover:shadow-sm"
                        >
                          {/* Member Avatar */}
                          <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-900 flex-shrink-0 flex items-center justify-center border border-slate-200 dark:border-slate-700">
                            {avatarUrl ? (
                              <img src={avatarUrl} alt={member.name} className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-5 h-5 text-slate-400" />
                            )}
                            {/* Condition mini badge */}
                            <span className="absolute bottom-0 right-0 text-[10px] leading-none">
                              {condMeta.emoji}
                            </span>
                          </div>

                          {/* Member details */}
                          <div className="flex-1 min-w-0">
                            <h5 className="font-bold text-xs text-slate-900 dark:text-white truncate group-hover:text-pink-500 transition">
                              {member.name}
                            </h5>
                            <span className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-semibold border ${condMeta.badgeClass} mt-0.5`}>
                              {condMeta.label}
                            </span>
                            {member.conditionDetails && (
                              <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5 italic">
                                {member.conditionDetails}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* AI Auto-Map Preview & Apply Modal */}
      {aiPreviewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm" />
          <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-2xl z-10 animate-in zoom-in-95 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-yellow-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Hasil Pemetaan Otomatis AI
                </h3>
              </div>
              <button
                onClick={() => setAiPreviewData(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
              {/* Factions Discovered */}
              <div>
                <span className="font-bold text-slate-500 uppercase tracking-wider block mb-1.5 text-[10px]">
                  Faksi yang Terdeteksi ({aiPreviewData.factions.length})
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {aiPreviewData.factions.map((f, i) => (
                    <div
                      key={i}
                      className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: f.color }} />
                        <span className="font-bold text-slate-900 dark:text-white">{f.name}</span>
                      </div>
                      <p className="text-[11px] text-slate-500">{f.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Entities Mapped */}
              <div>
                <span className="font-bold text-slate-500 uppercase tracking-wider block mb-1.5 text-[10px]">
                  Pemetaan Entitas & Kondisi ({aiPreviewData.mappedEntities.length})
                </span>
                <div className="space-y-2">
                  {aiPreviewData.mappedEntities.map((ent, i) => {
                    const cond = getConditionMeta(ent.condition);
                    return (
                      <div
                        key={i}
                        className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 dark:text-white">{ent.name}</span>
                          <span className="text-[10px] font-semibold text-pink-500 bg-pink-500/10 px-2 py-0.5 rounded-full">
                            {ent.faction}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300">
                          <span>{cond.emoji} <strong>{cond.label}:</strong></span>
                          <span>{ent.conditionDetails}</span>
                        </div>
                        {ent.relationships && ent.relationships.length > 0 && (
                          <div className="text-[10px] text-slate-400">
                            <strong>Relasi:</strong> {ent.relationships.map((r) => r.label).join(', ')}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800 mt-3">
              <button
                type="button"
                onClick={() => setAiPreviewData(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleApplyAiResults}
                disabled={isAiLoading}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-rose-600 text-white font-bold text-xs shadow-md shadow-pink-500/20 active:scale-95 transition"
              >
                Terapkan ke Worldbuilding
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Add Relationship Modal */}
      {isAddRelationOpen && (
        <AddRelationshipModal
          isOpen={isAddRelationOpen}
          entities={entities}
          initialSourceId={selectedEntityId || undefined}
          onClose={() => setIsAddRelationOpen(false)}
          onSuccess={() => {
            setIsAddRelationOpen(false);
            onRefresh();
          }}
        />
      )}

      {/* Edit Condition Quick Modal */}
      {conditionEditorEntity && (
        <EditConditionModal
          isOpen={!!conditionEditorEntity}
          entity={conditionEditorEntity}
          onClose={() => setConditionEditorEntity(null)}
          onSuccess={() => {
            setConditionEditorEntity(null);
            onRefresh();
          }}
        />
      )}

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

      {/* Full Hologram Modal */}
      <WorldEntityHologramModal
        isOpen={!!hologramEntity}
        entity={hologramEntity}
        onClose={() => setHologramEntity(null)}
      />
    </div>
  );
};

// -------------------------------------------------------------
// Helper Submodal: Tambah Relasi Antar Karakter
// -------------------------------------------------------------
const AddRelationshipModal: React.FC<{
  isOpen: boolean;
  entities: WorldEntity[];
  initialSourceId?: string;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ isOpen, entities, initialSourceId, onClose, onSuccess }) => {
  const [sourceId, setSourceId] = useState(initialSourceId || entities[0]?.id || '');
  const [targetId, setTargetId] = useState(
    entities.find((e) => e.id !== (initialSourceId || entities[0]?.id))?.id || ''
  );
  const [relType, setRelType] = useState<RelationshipType>('sekutu');
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceId || !targetId || sourceId === targetId) {
      alert('Pilih dua entitas yang berbeda untuk dihubungkan.');
      return;
    }

    setIsSubmitting(true);
    try {
      const source = entities.find((e) => e.id === sourceId);
      const target = entities.find((e) => e.id === targetId);
      if (!source || !target) return;

      const newRel: EntityRelationship = {
        id: 'rel_' + Math.random().toString(36).substring(2, 9),
        targetEntityId: target.id,
        targetEntityName: target.name,
        relationshipType: relType,
        label: label.trim() || RELATIONSHIP_META[relType].label.split('/')[0],
        description: description.trim(),
      };

      const existingRels = source.relationships || [];
      // Replace if existing with same target or append
      const updatedRels = [
        ...existingRels.filter((r) => r.targetEntityId !== target.id),
        newRel,
      ];

      await db.worldEntities.update(source.id, {
        relationships: updatedRels,
        updatedAt: Date.now(),
      });

      onSuccess();
    } catch (err) {
      console.error('Gagal menyimpan relasi:', err);
      alert('Gagal menyimpan relasi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-2xl z-10 animate-in zoom-in-95">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <GitFork className="w-4 h-4 text-pink-500" />
            <span>Tambah Hubungan Karakter</span>
          </h3>
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block text-slate-500 font-semibold mb-1">Entitas Sumber</label>
            <select
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white"
            >
              {entities.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.faction || 'Independen'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-500 font-semibold mb-1">Dihubungkan Dengan (Target)</label>
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white"
            >
              {entities
                .filter((e) => e.id !== sourceId)
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} ({e.faction || 'Independen'})
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-500 font-semibold mb-1">Tipe Hubungan</label>
            <select
              value={relType}
              onChange={(e) => setRelType(e.target.value as RelationshipType)}
              className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white"
            >
              {Object.entries(RELATIONSHIP_META).map(([typeKey, meta]) => (
                <option key={typeKey} value={typeKey}>
                  {meta.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-500 font-semibold mb-1">
              Label Hubungan (Misal: "Musuh Bebuyutan", "Pengawal Rahasia")
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Contoh: Kakak Kandung / Rival Utama"
              className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-slate-500 font-semibold mb-1">Keterangan Tambahan (Opsional)</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Penjelasan dinamika hubungan..."
              className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-rose-600 text-white font-bold"
            >
              Simpan Hubungan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// Helper Submodal: Ubah Kondisi Entitas
// -------------------------------------------------------------
const EditConditionModal: React.FC<{
  isOpen: boolean;
  entity: WorldEntity;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ isOpen, entity, onClose, onSuccess }) => {
  const [condition, setCondition] = useState<string>(entity.condition || 'aktif');
  const [conditionDetails, setConditionDetails] = useState(entity.conditionDetails || '');
  const [faction, setFaction] = useState(entity.faction || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await db.worldEntities.update(entity.id, {
        condition,
        conditionDetails: conditionDetails.trim(),
        faction: faction.trim(),
        updatedAt: Date.now(),
      });
      onSuccess();
    } catch (err) {
      console.error('Gagal mengubah kondisi:', err);
      alert('Gagal menyimpan kondisi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-2xl z-10 animate-in zoom-in-95">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-3">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Ubah Kondisi: {entity.name}
          </h3>
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-3 text-xs">
          <div>
            <label className="block text-slate-500 font-semibold mb-1">Status / Kondisi Terkini</label>
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white"
            >
              {Object.values(ENTITY_CONDITIONS).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-500 font-semibold mb-1">
              Keterangan Kondisi (Misal: "Terluka di pertempuran benteng")
            </label>
            <textarea
              rows={2}
              value={conditionDetails}
              onChange={(e) => setConditionDetails(e.target.value)}
              placeholder="Deskripsi kondisi saat ini..."
              className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-slate-500 font-semibold mb-1">Faksi / Kelompok</label>
            <input
              type="text"
              value={faction}
              onChange={(e) => setFaction(e.target.value)}
              placeholder="Contoh: Kerajaan Surya / Pemberontak"
              className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-rose-600 text-white font-bold"
            >
              Simpan Kondisi
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
