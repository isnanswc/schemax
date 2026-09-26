import React, { useState } from 'react';
import {
  Film,
  MapPin,
  User,
  Clock,
  Sparkles,
  GitBranch,
  RotateCcw,
  Copy,
  Check,
  X,
  Target,
  Image as ImageIcon
} from 'lucide-react';
import { ChapterSceneItem, WorldEntity } from '../../../types';

interface VerticalSceneTimelineProps {
  scenes: ChapterSceneItem[];
  entities?: WorldEntity[];
  onOpenEntityHologram?: (entity: WorldEntity) => void;
}

export const VerticalSceneTimeline: React.FC<VerticalSceneTimelineProps> = ({
  scenes,
  entities = [],
  onOpenEntityHologram,
}) => {
  const [selectedScene, setSelectedScene] = useState<ChapterSceneItem | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  const handleCopyPrompt = (promptText: string) => {
    navigator.clipboard.writeText(promptText);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const getTimelineBadge = (type?: string) => {
    switch (type) {
      case 'flashback':
        return {
          label: 'Kilas Balik (Flashback)',
          color: 'text-purple-600 dark:text-purple-400 bg-purple-500/10 border-purple-500/30',
          dot: 'bg-purple-500',
          icon: RotateCcw,
        };
      case 'branched':
      case 'parallel':
        return {
          label: 'Alur Bercabang / Simultan',
          color: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30',
          dot: 'bg-amber-500',
          icon: GitBranch,
        };
      default:
        return {
          label: 'Alur Linear',
          color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/30',
          dot: 'bg-indigo-500',
          icon: Clock,
        };
    }
  };

  return (
    <div className="relative py-4">
      {/* 1. VERTICAL TIMELINE CONTAINER */}
      <div className="relative pl-6 sm:pl-10 space-y-6">
        {/* Central Vertical Spine / Axis */}
        <div className="absolute left-[13px] sm:left-[21px] top-4 bottom-4 w-1 bg-gradient-to-b from-indigo-500 via-amber-500 to-purple-500 rounded-full opacity-40 dark:opacity-30" />

        {scenes.map((scene, idx) => {
          const isFlashback = scene.timelineType === 'flashback';
          const isBranched = scene.timelineType === 'branched' || scene.timelineType === 'parallel';
          const meta = getTimelineBadge(scene.timelineType);
          const BadgeIcon = meta.icon;

          return (
            <div key={scene.id || idx} className="relative group">
              {/* Timeline Node Point (Circle on Axis) */}
              <div
                className={`absolute -left-[24px] sm:-left-[32px] top-4 w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center font-black text-[11px] shadow-md transition-transform duration-200 group-hover:scale-110 z-10 ${
                  isFlashback
                    ? 'bg-purple-600 text-white ring-4 ring-purple-400/25'
                    : isBranched
                    ? 'bg-amber-500 text-slate-950 ring-4 ring-amber-400/25'
                    : 'bg-indigo-600 text-white ring-4 ring-indigo-400/25'
                }`}
              >
                {scene.sceneNumber || idx + 1}
              </div>

              {/* ↩️ CURVED DASHED LINE FOR FLASHBACK (Melengkung ke Belakang/Atas) */}
              {isFlashback && idx > 0 && (
                <div
                  className="absolute -left-[50px] sm:-left-[64px] -top-12 w-10 sm:w-12 h-16 pointer-events-none z-0"
                  title="Flashback ke adegan sebelumnya"
                >
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 50 70">
                    <defs>
                      <marker
                        id="flashback-arrow"
                        viewBox="0 0 10 10"
                        refX="5"
                        refY="5"
                        markerWidth="6"
                        markerHeight="6"
                        orient="auto-start-reverse"
                      >
                        <path d="M 0 1 L 8 5 L 0 9 z" fill="rgb(168, 85, 247)" />
                      </marker>
                    </defs>
                    {/* Backward arc curve */}
                    <path
                      d="M 40,65 C 5,50 5,20 38,5"
                      fill="none"
                      stroke="rgb(168, 85, 247)"
                      strokeWidth="2.5"
                      strokeDasharray="4 4"
                      markerEnd="url(#flashback-arrow)"
                    />
                  </svg>
                  <span className="absolute -top-3 left-0 text-[8px] font-black px-1 rounded bg-purple-500 text-white whitespace-nowrap shadow-xs">
                    ↩️ Kilas Balik
                  </span>
                </div>
              )}

              {/* 🔀 BRANCHED / PARALLEL INDICATOR CURVE */}
              {isBranched && (
                <div
                  className="absolute -left-[45px] sm:-left-[54px] top-6 w-8 h-8 pointer-events-none z-0"
                  title="Alur Bercabang / Simultan"
                >
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 40 40">
                    <path
                      d="M 30,5 C 10,10 10,30 30,35"
                      fill="none"
                      stroke="rgb(245, 158, 11)"
                      strokeWidth="2"
                      strokeDasharray="4 3"
                    />
                  </svg>
                </div>
              )}

              {/* SCENE BLOCK CARD (Clickable to open Float Info) */}
              <div
                onClick={() => setSelectedScene(scene)}
                className={`bg-white dark:bg-slate-900 border rounded-3xl p-4 sm:p-5 shadow-sm transition-all duration-200 cursor-pointer active:scale-[0.99] hover:shadow-lg ${
                  isFlashback
                    ? 'border-purple-300 dark:border-purple-800/80 hover:border-purple-500 bg-purple-50/20 dark:bg-purple-950/10'
                    : isBranched
                    ? 'border-amber-300 dark:border-amber-800/80 hover:border-amber-500 bg-amber-50/20 dark:bg-amber-950/10'
                    : 'border-slate-200 dark:border-slate-800 hover:border-indigo-500'
                }`}
              >
                {/* Header: Title & Badges */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-2 border-b border-slate-100 dark:border-slate-800/60">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {scene.title || `Adegan ${idx + 1}`}
                    </h4>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Timeline Type Badge */}
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${meta.color}`}
                    >
                      <BadgeIcon className="w-3 h-3" />
                      <span>{meta.label}</span>
                    </span>

                    {/* Setting & Time Marker */}
                    {(scene.timeMarker || scene.setting) && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-cyan-500" />
                        <span className="truncate max-w-[130px]">
                          {scene.timeMarker || scene.setting}
                        </span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Summary Snippet */}
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 line-clamp-2 my-2.5 leading-relaxed">
                  {scene.summary}
                </p>

                {/* Footer: Characters + Action Prompt */}
                <div className="flex items-center justify-between gap-2 pt-1 text-xs">
                  {/* Characters Avatars / Badges */}
                  <div className="flex items-center gap-1 flex-wrap">
                    {scene.characters && scene.characters.length > 0 ? (
                      scene.characters.slice(0, 3).map((ch, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-lg bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20 font-bold text-[10px]"
                        >
                          👤 {ch}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] text-slate-400 italic">
                        Karakter bab ini
                      </span>
                    )}
                    {scene.characters && scene.characters.length > 3 && (
                      <span className="text-[10px] text-slate-400 font-bold">
                        +{scene.characters.length - 3}
                      </span>
                    )}
                  </div>

                  {/* Click to open float info hint */}
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 group-hover:underline flex-shrink-0">
                    <span>Lihat Detail Adegan</span>
                    <Sparkles className="w-3 h-3 text-amber-500" />
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 2. FLOAT INFORMASI SCENE MODAL (Interactive Detail Popover) */}
      {selectedScene && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in"
          onClick={() => setSelectedScene(null)}
        >
          <div
            className="w-full max-w-lg max-h-[88vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4 overflow-y-auto animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-xl bg-indigo-600 text-white font-black text-xs">
                    Adegan {selectedScene.sceneNumber}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      getTimelineBadge(selectedScene.timelineType).color
                    }`}
                  >
                    {getTimelineBadge(selectedScene.timelineType).label}
                  </span>
                  {selectedScene.branchGroup && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                      Grup: {selectedScene.branchGroup}
                    </span>
                  )}
                </div>

                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white pt-1">
                  {selectedScene.title}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setSelectedScene(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Latar & Penanda Waktu */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 flex items-start gap-2">
                <MapPin className="w-4 h-4 text-cyan-500 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">
                    Latar Tempat
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {selectedScene.setting || 'Tidak tercatat spesifik'}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 flex items-start gap-2">
                <Clock className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">
                    Penanda Waktu (Timeline)
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {selectedScene.timeMarker || 'Sesuai urutan kronologi'}
                  </span>
                </div>
              </div>
            </div>

            {/* Ringkasan Kejadian Adegan */}
            <div className="space-y-1.5">
              <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Film className="w-3.5 h-3.5 text-amber-500" />
                <span>Rangkuman Peristiwa Adegan</span>
              </h5>
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                {selectedScene.summary}
              </div>
            </div>

            {/* Konflik & Tujuan Tokoh */}
            {selectedScene.goalConflict && (
              <div className="space-y-1.5">
                <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-rose-500" />
                  <span>Konflik & Tujuan Adegan (Goal / Conflict)</span>
                </h5>
                <div className="p-3 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 text-xs text-rose-900 dark:text-rose-300">
                  {selectedScene.goalConflict}
                </div>
              </div>
            )}

            {/* Tokoh & Glosarium Terlibat */}
            {selectedScene.characters && selectedScene.characters.length > 0 && (
              <div className="space-y-1.5">
                <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-pink-500" />
                  <span>Tokoh yang Terlibat</span>
                </h5>
                <div className="flex flex-wrap gap-1.5">
                  {selectedScene.characters.map((ch, i) => {
                    const matchedEntity = entities.find(
                      (e) => e.name.toLowerCase() === ch.toLowerCase()
                    );
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          if (matchedEntity && onOpenEntityHologram) {
                            onOpenEntityHologram(matchedEntity);
                          }
                        }}
                        className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1 transition ${
                          matchedEntity
                            ? 'bg-pink-500/15 text-pink-700 dark:text-pink-300 border border-pink-500/30 hover:bg-pink-500/25 active:scale-95'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-default'
                        }`}
                        title={matchedEntity ? 'Klik untuk profil entitas' : undefined}
                      >
                        <span>👤 {ch}</span>
                        {matchedEntity && (
                          <Sparkles className="w-2.5 h-2.5 text-amber-500" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Visual Text-to-Image Prompt */}
            {selectedScene.imagePrompt && (
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-purple-500" />
                    <span>Prompt Gambar Visual Adegan (AI Generator)</span>
                  </h5>
                  <button
                    type="button"
                    onClick={() => handleCopyPrompt(selectedScene.imagePrompt!)}
                    className="flex items-center gap-1 py-1 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] transition active:scale-95 shadow-sm"
                  >
                    {copiedPrompt ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-300" />
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

                <div className="p-3 rounded-2xl bg-slate-900 text-slate-200 text-xs font-mono leading-relaxed border border-slate-800 select-all">
                  {selectedScene.imagePrompt}
                </div>
              </div>
            )}

            {/* Close Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setSelectedScene(null)}
                className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs transition active:scale-95 shadow"
              >
                Tutup Informasi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
