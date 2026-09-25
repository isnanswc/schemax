import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Zap,
  BookOpen,
  User,
  MapPin,
  Shield,
  Layers,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Flame,
  RotateCcw,
  Compass,
  FileText
} from 'lucide-react';
import { StoryBlueprint } from '../../types/blueprint';
import { Book } from '../../types';
import { generateStoryBlueprint, seedBlueprintToDatabase } from '../../services/blueprintService';

interface AIStoryArchitectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated: (book: Book) => void;
  onOpenAISettings: () => void;
}

export const AIStoryArchitectModal: React.FC<AIStoryArchitectModalProps> = ({
  isOpen,
  onClose,
  onProjectCreated,
  onOpenAISettings,
}) => {
  const [step, setStep] = useState<'input' | 'review'>('input');
  const [rawIdea, setRawIdea] = useState('');
  const [genre, setGenre] = useState('Fantasi Epik');
  const [tone, setTone] = useState('Penuh Misteri & Menegangkan');
  const [isLoading, setIsLoading] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blueprint, setBlueprint] = useState<StoryBlueprint | null>(null);
  const [activeReviewTab, setActiveReviewTab] = useState<'synopsis' | 'characters' | 'world' | 'chapters'>('synopsis');

  if (!isOpen) return null;

  const genres = [
    'Fantasi Epik',
    'Sci-Fi / Fiksi Ilmiah',
    'Misteri & Detektif',
    'Dark Fantasy',
    'Cyberpunk',
    'Romansa & Drama',
    'Horor Supranatural',
    'Petualangan Sejarah',
  ];

  const tones = [
    'Penuh Misteri & Menegangkan',
    'Dark, Gritty, & Realistis',
    'Emosional & Mengharukan',
    'Epik & Megah',
    'Ringan, Cerdas, & Penuh Humor',
  ];

  const examplePrompts = [
    'Pemburu bayaran cyberpunk menemukan target terakhirnya adalah dirinya dari masa depan.',
    'Ksatria amnesia terbangun di menara jam terapung purba yang waktunya membeku.',
    'Seorang gadis penenun menemukan kain kafan yang bisa membalikkan takdir orang mati.',
  ];

  const handleGenerate = async () => {
    if (!rawIdea.trim()) {
      alert('Silakan masukkan ide atau premis cerita Anda.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const generated = await generateStoryBlueprint(rawIdea, genre, tone);
      setBlueprint(generated);
      setStep('review');
    } catch (err: any) {
      setError(err?.message || 'Gagal merancang blueprint.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBuildProject = async () => {
    if (!blueprint) return;
    setIsSeeding(true);

    try {
      const createdBook = await seedBlueprintToDatabase(blueprint);
      setIsSeeding(false);
      onProjectCreated(createdBook);
      onClose();
    } catch (err: any) {
      alert('Gagal menyimpan proyek ke database: ' + err?.message);
      setIsSeeding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Main Container */}
      <div className="relative w-full sm:max-w-2xl bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl z-10 max-h-[94vh] flex flex-col animate-in slide-in-from-bottom duration-250 safe-bottom">
        {/* Swipe Handle for Mobile */}
        <div className="w-12 h-1.5 bg-slate-700/80 rounded-full mx-auto mt-3 mb-1 sm:hidden flex-shrink-0" />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800/80 bg-slate-950/60 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center text-slate-950 font-black shadow-md shadow-amber-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm sm:text-base text-white">
                  AI Story Architect
                </h3>
                <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase">
                  Planning
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400">
                Ubah 1 ide kasar jadi Blueprint Novel & Worldbuilding lengkap
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white transition active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* STEP 1: FORMULIR INPUT */}
        {step === 'input' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 no-scrollbar">
            {/* Raw Idea Input */}
            <div>
              <label className="text-[11px] font-extrabold uppercase tracking-wider text-amber-400 block mb-1.5">
                Ide / Premis Mentah Ceritamu:
              </label>
              <textarea
                rows={4}
                value={rawIdea}
                onChange={(e) => setRawIdea(e.target.value)}
                placeholder="Tulis ide atau premis kasarmu di sini (cukup 1-2 kalimat)..."
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-2xl text-xs sm:text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-400 leading-relaxed resize-none shadow-inner"
              />

              {/* Quick Preset Examples */}
              <div className="mt-2 space-y-1">
                <span className="text-[10px] text-slate-500 font-bold block">
                  💡 Atau coba contoh ide ini:
                </span>
                <div className="flex flex-col gap-1">
                  {examplePrompts.map((ex, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setRawIdea(ex)}
                      className="text-left text-[11px] text-slate-400 hover:text-amber-300 bg-slate-950/60 p-2 rounded-xl border border-slate-800/80 transition truncate"
                    >
                      "{ex}"
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Genre Selection Chips */}
            <div>
              <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1.5">
                Pilih Genre Utama:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {genres.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGenre(g)}
                    className={`py-1.5 px-3 rounded-xl text-xs font-semibold transition active:scale-95 ${
                      genre === g
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                        : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* Tone Selection */}
            <div>
              <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1.5">
                Nada & Suasana Cerita (Tone):
              </label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400 font-semibold"
              >
                {tones.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-2xl text-xs text-red-300 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-red-400">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Gagal Memproses Ide</span>
                </div>
                <p className="text-[11px]">{error}</p>
                <button
                  type="button"
                  onClick={onOpenAISettings}
                  className="text-amber-400 underline font-semibold text-[11px] block mt-1"
                >
                  Periksa API Key di Pengaturan AI ➔
                </button>
              </div>
            )}

            {/* Generate Action Button */}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isLoading || !rawIdea.trim()}
              className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-600 to-indigo-600 hover:opacity-95 text-slate-950 font-black text-xs sm:text-sm shadow-xl shadow-amber-500/20 active:scale-95 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Zap className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Merancang Sinopsis, Karakter, & Bab...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-slate-950" />
                  <span>Mulai Rancang Arsitektur Cerita ✨</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* STEP 2: REVIEW & SEED BLUEPRINT */}
        {step === 'review' && blueprint && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 no-scrollbar">
            {/* Title & Logline Hero Banner */}
            <div className="bg-gradient-to-r from-amber-500/15 via-slate-950 to-indigo-500/15 border border-amber-500/30 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  {blueprint.genre}
                </span>
                <button
                  type="button"
                  onClick={() => setStep('input')}
                  className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Ubah Ide</span>
                </button>
              </div>

              <h2 className="text-lg sm:text-xl font-black text-white leading-tight">
                {blueprint.title}
              </h2>

              <p className="text-xs text-amber-200/90 italic leading-relaxed">
                "{blueprint.logline}"
              </p>
            </div>

            {/* Review Segmented Tabs */}
            <div className="grid grid-cols-4 gap-1 bg-slate-950 p-1 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => setActiveReviewTab('synopsis')}
                className={`py-1.5 px-2 rounded-xl text-[11px] font-bold transition truncate ${
                  activeReviewTab === 'synopsis'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Sinopsis
              </button>
              <button
                type="button"
                onClick={() => setActiveReviewTab('characters')}
                className={`py-1.5 px-2 rounded-xl text-[11px] font-bold transition truncate ${
                  activeReviewTab === 'characters'
                    ? 'bg-pink-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Tokoh ({blueprint.characters.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveReviewTab('world')}
                className={`py-1.5 px-2 rounded-xl text-[11px] font-bold transition truncate ${
                  activeReviewTab === 'world'
                    ? 'bg-cyan-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Latar & Relik
              </button>
              <button
                type="button"
                onClick={() => setActiveReviewTab('chapters')}
                className={`py-1.5 px-2 rounded-xl text-[11px] font-bold transition truncate ${
                  activeReviewTab === 'chapters'
                    ? 'bg-indigo-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Bab ({blueprint.chapters.length})
              </button>
            </div>

            {/* TAB CONTENT: SYNOPSIS */}
            {activeReviewTab === 'synopsis' && (
              <div className="space-y-3 bg-slate-950/70 p-4 rounded-2xl border border-slate-800/80 text-xs text-slate-200 animate-in fade-in">
                <div>
                  <span className="text-[10px] font-bold uppercase text-amber-400 block mb-1">
                    Tema Filosofis Sentral:
                  </span>
                  <p className="text-slate-300 font-medium italic">
                    "{blueprint.thematicCore}"
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-800/80">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1.5">
                    Alur Cerita Menyeluruh:
                  </span>
                  <p className="text-slate-300 leading-relaxed whitespace-pre-line text-justify">
                    {blueprint.synopsis}
                  </p>
                </div>
              </div>
            )}

            {/* TAB CONTENT: CHARACTERS */}
            {activeReviewTab === 'characters' && (
              <div className="space-y-2.5 animate-in fade-in">
                {blueprint.characters.map((char, i) => (
                  <div
                    key={i}
                    className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center font-bold text-xs">
                          {i + 1}
                        </span>
                        <div>
                          <h4 className="font-bold text-white text-xs sm:text-sm">{char.name}</h4>
                          <span className="text-[10px] text-pink-400 font-semibold">{char.role}</span>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-slate-300 leading-snug">{char.shortDescription}</p>

                    {/* Psychological Want vs Need */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-[11px]">
                      {char.want && (
                        <div className="bg-slate-900 p-2 rounded-xl border border-slate-800">
                          <span className="text-[10px] font-bold text-amber-400 block">Ingin (Want):</span>
                          <span className="text-slate-300">{char.want}</span>
                        </div>
                      )}
                      {char.need && (
                        <div className="bg-slate-900 p-2 rounded-xl border border-slate-800">
                          <span className="text-[10px] font-bold text-emerald-400 block">Butuh (Need):</span>
                          <span className="text-slate-300">{char.need}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB CONTENT: WORLD & RELICS */}
            {activeReviewTab === 'world' && (
              <div className="space-y-2.5 animate-in fade-in">
                {/* Locations */}
                {blueprint.locations.map((loc, i) => (
                  <div key={i} className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                      <h4 className="font-bold text-xs sm:text-sm text-white">{loc.name}</h4>
                    </div>
                    <p className="text-xs text-slate-300 leading-snug">{loc.shortDescription}</p>
                    {loc.detailedNotes && (
                      <p className="text-[11px] text-slate-400 italic pt-1">{loc.detailedNotes}</p>
                    )}
                  </div>
                ))}

                {/* Items */}
                {blueprint.items.map((itm, i) => (
                  <div key={i} className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-amber-400" />
                      <h4 className="font-bold text-xs sm:text-sm text-white">{itm.name}</h4>
                    </div>
                    <p className="text-xs text-slate-300 leading-snug">{itm.shortDescription}</p>
                  </div>
                ))}
              </div>
            )}

            {/* TAB CONTENT: CHAPTERS */}
            {activeReviewTab === 'chapters' && (
              <div className="space-y-2 animate-in fade-in">
                {blueprint.chapters.map((chap, i) => (
                  <div key={i} className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                        Bab {chap.order || i + 1}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Target ~{chap.targetWordCount || 1800} kata
                      </span>
                    </div>

                    <h4 className="font-bold text-xs sm:text-sm text-white">{chap.title}</h4>
                    <p className="text-xs text-slate-300 leading-relaxed">{chap.premise}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Final Build Project Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleBuildProject}
                disabled={isSeeding}
                className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-600 to-indigo-600 hover:opacity-95 text-slate-950 font-black text-xs sm:text-sm shadow-xl shadow-amber-500/20 active:scale-95 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSeeding ? (
                  <>
                    <Zap className="w-4 h-4 animate-spin text-slate-950" />
                    <span>Membangun Buku, Karakter, & Bab ke Database...</span>
                  </>
                ) : (
                  <>
                    <Rocket className="w-4 h-4 text-slate-950" />
                    <span>🚀 Bangun Proyek Cerita Sekarang!</span>
                  </>
                )}
              </button>
              <p className="text-[10px] text-slate-500 text-center mt-1.5">
                Semua karakter, lokasi, dan bab otomatis tersimpan di IndexedDB lokal Anda.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Helper Rocket Icon
function Rocket(props: any) {
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  );
}
