import React, { useState, useEffect } from 'react';
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
  RotateCcw,
  Plus,
  Trash2,
  Check,
  Compass,
  FileText,
  Sliders,
  Users,
  Feather,
  BookMarked,
  Image as ImageIcon,
  Loader2
} from 'lucide-react';
import { StoryBlueprint, BlueprintCharacter, BlueprintLocation, BlueprintItem, BlueprintChapter } from '../../types/blueprint';
import { Book } from '../../types';
import { generateStoryBlueprint, seedBlueprintToDatabase, BlueprintProgressInfo } from '../../services/blueprintService';
import { AIGenerationEvent } from '../../types/ai';
import { analyzeCharacterPhotoWithVision } from '../../services/aiService';
import { parseStoryOptions } from '../../utils/storyOptionsParser';

interface AIStoryArchitectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated: (book: Book) => void;
  onOpenAISettings: () => void;
  initialRawIdea?: string;
  autoStart?: boolean;
}

export const AIStoryArchitectModal: React.FC<AIStoryArchitectModalProps> = ({
  isOpen,
  onClose,
  onProjectCreated,
  onOpenAISettings,
  initialRawIdea,
  autoStart,
}) => {
  const [step, setStep] = useState<'input' | 'review'>('input');
  const [rawIdea, setRawIdea] = useState(initialRawIdea || '');

  useEffect(() => {
    if (isOpen && initialRawIdea) {
      setRawIdea(initialRawIdea);
      const detectedOpts = parseStoryOptions(initialRawIdea);
      // AutoStart hanya dijalankan jika ide berupa konsep tunggal, bukan multi-opsi
      if (autoStart && !isLoading && !blueprint && (!detectedOpts || detectedOpts.length < 2)) {
        handleGenerate(initialRawIdea);
      }
    }
  }, [isOpen, initialRawIdea, autoStart]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blueprint, setBlueprint] = useState<StoryBlueprint | null>(null);

  // Review Tabs: 'overview' | 'characters' | 'world' | 'chapters' | 'style'
  const [activeReviewTab, setActiveReviewTab] = useState<'overview' | 'characters' | 'world' | 'chapters' | 'style'>('overview');

  // Real-time AI Tracking State
  const [currentProgress, setCurrentProgress] = useState<BlueprintProgressInfo>({
    stage: 'architecting',
    stageTitle: 'Mempersiapkan Story Architect Engine...',
    stageSubtitle: 'Memulai koneksi ke model AI yang dikonfigurasi.',
  });
  const [attemptHistory, setAttemptHistory] = useState<AIGenerationEvent[]>([]);
  const [scanningCharIndex, setScanningCharIndex] = useState<number | null>(null);
  const [scanSuccessIndex, setScanSuccessIndex] = useState<{ index: number; msg: string } | null>(null);

  // Ensure modal always starts on input if no blueprint is loaded yet
  React.useEffect(() => {
    if (isOpen && !blueprint) {
      setStep('input');
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const examplePrompts = [
    'Menceritakan seorang pemuda bernama Agung yang menemukan cincin misterius. Dia membawa pulang cincin dan malapetaka terjadi: seluruh keluarganya hilang ingatan dan membuat hubungan mereka berantakan. Santi istri Agung sampai mengira Agung adalah maling di rumahnya.',
    'Seorang detektif swasta di Jakarta menerima kasus orang hilang, namun korban yang hilang ternyata adalah dirinya sendiri dari 10 tahun yang lalu.',
    'Di sebuah desa lereng gunung, seorang kakek pembuat wayang menemukan kayu keramat yang membuat karakter wayang buatannya hidup dan menuntut hak sebagai manusia.',
  ];

  const handleGenerate = async (ideaOverride?: string) => {
    const textToProcess = (typeof ideaOverride === 'string' ? ideaOverride : rawIdea).trim();
    if (!textToProcess) {
      alert('Silakan tulis ide atau premis cerita Anda.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setAttemptHistory([]);
    setCurrentProgress({
      stage: 'architecting',
      stageTitle: 'Menghubungkan ke Mesin AI...',
      stageSubtitle: 'Memulai analisis premis dan struktur cerita.',
    });

    try {
      const generated = await generateStoryBlueprint(textToProcess, (info) => {
        setCurrentProgress(info);
        if (info.attempt) {
          setAttemptHistory((prev) => {
            const last = prev[prev.length - 1];
            if (
              last &&
              last.provider === info.attempt!.provider &&
              last.model === info.attempt!.model &&
              last.slotLabel === info.attempt!.slotLabel &&
              last.status === info.attempt!.status
            ) {
              return prev;
            }
            return [...prev, info.attempt!];
          });
        }
      });
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

  // Helper updater for Blueprint state
  const updateBlueprint = (fields: Partial<StoryBlueprint>) => {
    if (!blueprint) return;
    setBlueprint({ ...blueprint, ...fields });
  };

  // Character mutations
  const handleUpdateCharacter = (index: number, field: keyof BlueprintCharacter, value: any) => {
    if (!blueprint) return;
    const updated = [...blueprint.characters];
    updated[index] = { ...updated[index], [field]: value };
    updateBlueprint({ characters: updated });
  };

  const handleAddCharacter = () => {
    if (!blueprint) return;
    const newChar: BlueprintCharacter = {
      name: 'Karakter Baru',
      role: 'Pendukung / Keluarga',
      age: '25 Tahun',
      physicalTraits: 'Wajah ramah segar, kulit cerah alami, proporsi tubuh seimbang, mengenakan busana kasual modern (kemeja polo atau daster katun santai polos).',
      traits: 'Setia kawan, jujur, protektif terhadap orang tersayang.',
      shortDescription: 'Anggota keluarga atau kerabat dekat yang terlibat dalam insiden.',
      visualPrompt: 'Full length portrait standing upright facing camera directly, centered, looking straight into lens, 25-year-old Indonesian person, youthful radiant face, natural realistic body proportions, wearing neat everyday casual modern clothing, standing in a cozy contextual room with shallow depth of field background blur, clear sharp facial features, soft cinematic lighting, ultra-realistic 8k, vertical 9:16 portrait.',
      attributes: [{ label: 'Peran', value: 'Pendukung' }],
      tags: ['Karakter'],
    };
    updateBlueprint({ characters: [...blueprint.characters, newChar] });
  };

  const handleDeleteCharacter = (index: number) => {
    if (!blueprint) return;
    const updated = blueprint.characters.filter((_, idx) => idx !== index);
    updateBlueprint({ characters: updated });
  };

  const handleScanCharacterPhoto = async (index: number, file: File) => {
    if (!blueprint) return;
    setScanningCharIndex(index);
    setScanSuccessIndex(null);
    try {
      const mime = file.type || 'image/jpeg';
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const charName = blueprint.characters[index]?.name;
      const res = await analyzeCharacterPhotoWithVision(base64, mime, charName);

      const detailedPhysical = [
        res.physicalTraits ? `Ciri Fisik: ${res.physicalTraits}` : '',
        res.clothingAttire ? `Pakaian: ${res.clothingAttire}` : '',
      ]
        .filter(Boolean)
        .join('\n\n');

      const updated = [...blueprint.characters];
      const curr = updated[index];
      updated[index] = {
        ...curr,
        age: res.estimatedAge || curr.age,
        physicalTraits: detailedPhysical || curr.physicalTraits,
        visualPrompt: res.englishVisualPrompt || curr.visualPrompt,
        shortDescription: curr.shortDescription?.trim() ? curr.shortDescription : res.shortSummary,
      };

      updateBlueprint({ characters: updated });
      setScanSuccessIndex({ index, msg: `Berhasil dipindai: ${res.gender}, ${res.estimatedAge}` });
      setTimeout(() => setScanSuccessIndex(null), 4500);
    } catch (err: any) {
      console.error('Vision scan error in AIStoryArchitectModal:', err);
      alert('Gagal memindai foto tokoh: ' + (err?.message || 'Periksa API Key Gemini Anda'));
    } finally {
      setScanningCharIndex(null);
    }
  };

  // Location mutations
  const handleUpdateLocation = (index: number, field: keyof BlueprintLocation, value: any) => {
    if (!blueprint) return;
    const updated = [...blueprint.locations];
    updated[index] = { ...updated[index], [field]: value };
    updateBlueprint({ locations: updated });
  };

  const handleAddLocation = () => {
    if (!blueprint) return;
    const newLoc: BlueprintLocation = {
      name: 'Lokasi Baru',
      shortDescription: 'Deskripsi suasana dan detail lokasi.',
      detailedNotes: 'Catatan rahasia atau bahaya yang ada di lokasi ini.',
      attributes: [{ label: 'Tipe', value: 'Tempat Utama' }],
      tags: ['Lokasi'],
    };
    updateBlueprint({ locations: [...blueprint.locations, newLoc] });
  };

  const handleDeleteLocation = (index: number) => {
    if (!blueprint) return;
    const updated = blueprint.locations.filter((_, idx) => idx !== index);
    updateBlueprint({ locations: updated });
  };

  // Item mutations
  const handleUpdateItem = (index: number, field: keyof BlueprintItem, value: any) => {
    if (!blueprint) return;
    const updated = [...blueprint.items];
    updated[index] = { ...updated[index], [field]: value };
    updateBlueprint({ items: updated });
  };

  const handleAddItem = () => {
    if (!blueprint) return;
    const newItem: BlueprintItem = {
      name: 'Item / Artefak Baru',
      shortDescription: 'Fungsi atau efek anomali dari barang ini.',
      detailedNotes: 'Asal usul dan konsekuensi penggunaannya.',
      attributes: [{ label: 'Jenis', value: 'Benda Misterius' }],
      tags: ['Relik'],
    };
    updateBlueprint({ items: [...blueprint.items, newItem] });
  };

  const handleDeleteItem = (index: number) => {
    if (!blueprint) return;
    const updated = blueprint.items.filter((_, idx) => idx !== index);
    updateBlueprint({ items: updated });
  };

  // Chapter mutations
  const handleUpdateChapter = (index: number, field: keyof BlueprintChapter, value: any) => {
    if (!blueprint) return;
    const updated = [...blueprint.chapters];
    updated[index] = { ...updated[index], [field]: value };
    updateBlueprint({ chapters: updated });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 dark:bg-black/80 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Main Container */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full sm:max-w-4xl h-[92vh] sm:h-[86vh] max-h-[95vh] bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl z-10 flex flex-col overflow-hidden safe-bottom"
      >
        {/* Swipe Handle for Mobile */}
        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700/80 rounded-full mx-auto mt-3 mb-1 sm:hidden flex-shrink-0" />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950/60 flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center text-slate-950 font-black shadow-md shadow-amber-500/20 flex-shrink-0">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                  AI Story Architect
                </h3>
                <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30 uppercase">
                  Novel Engine
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 truncate sm:whitespace-normal">
                Tulis 1 ide premis kasar ➔ AI merancang Judul, Karakter, Latar, &amp; Story Plot Bab
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition active:scale-95 flex-shrink-0 ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ========================================================================= */}
        {/* STEP 1: FORMULIR INPUT PREMIS MENTAH                                      */}
        {/* ========================================================================= */}
        {step === 'input' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 no-scrollbar">
            {isLoading ? (
              <div className="py-8 px-4 flex flex-col items-center justify-center text-center space-y-5 animate-in fade-in zoom-in-95 duration-300">
                {/* Visual Orb with Concentric Waves */}
                <div className="relative w-20 h-20 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-amber-500 to-indigo-600 blur-xl opacity-40 animate-pulse" />
                  <div className="absolute -inset-2.5 rounded-full border border-amber-500/30 animate-ping opacity-30" />
                  <div className="absolute inset-0 rounded-full border-2 border-dashed border-amber-500/50 animate-spin" style={{ animationDuration: '8s' }} />
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 via-amber-600 to-indigo-600 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/30 relative z-10">
                    <Feather className="w-7 h-7 text-white animate-bounce" />
                  </div>
                </div>

                {/* Loading Status Text & Actual Stage Indicator */}
                <div className="space-y-1.5 max-w-lg mx-auto">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[10px] font-black uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                    <span>Story Architect Engine Sedang Bekerja</span>
                  </div>

                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white transition-all duration-300">
                    {currentProgress.stageTitle}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-md mx-auto">
                    {currentProgress.stageSubtitle}
                  </p>
                </div>

                {/* 🚀 REAL-TIME AI ACTIVE SLOT & MODEL INFORMATION BOX */}
                <div className="w-full max-w-md bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 text-left space-y-2 shadow-inner">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1">
                      <Zap className="w-3 h-3 text-amber-500" />
                      <span>Unit AI & Model yang Bekerja</span>
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold">
                      Aktif
                    </span>
                  </div>

                  {/* Active Slot & Model Banner */}
                  {currentProgress.attempt ? (
                    <div className="flex flex-col gap-1 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                            currentProgress.attempt.provider === 'gemini'
                              ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                              : 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30'
                          }`}>
                            {currentProgress.attempt.provider.toUpperCase()}
                          </span>
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                            {currentProgress.attempt.slotLabel}
                          </span>
                        </div>
                        <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1 flex-shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                          Memproses
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-600 dark:text-slate-400 truncate pt-0.5">
                        <span className="text-slate-400">Model:</span>
                        <span className="text-amber-700 dark:text-amber-300 font-bold truncate">
                          {currentProgress.attempt.model}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                      <span>Menginisialisasi konfigurasi API Key...</span>
                    </div>
                  )}

                  {/* Fallback Event Log History if any slot failed or bounced */}
                  {attemptHistory.length > 1 && (
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 space-y-1">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">
                        Jejak Pergantian Model (Fallback Log):
                      </span>
                      <div className="max-h-24 overflow-y-auto space-y-1 no-scrollbar">
                        {attemptHistory.map((att, idx) => (
                          <div key={idx} className="flex items-center justify-between text-[10px] py-0.5">
                            <span className="font-mono text-slate-600 dark:text-slate-400 truncate max-w-[240px]">
                              {att.slotLabel} • {att.model}
                            </span>
                            <span className={`text-[9px] font-semibold ${
                              att.status === 'success'
                                ? 'text-emerald-500'
                                : att.status === 'fallback'
                                ? 'text-rose-500'
                                : 'text-amber-500'
                            }`}>
                              {att.status === 'fallback' ? 'Limit/Gagal ➔ Beralih' : att.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Progress Stage Tracker */}
                <div className="w-full max-w-xs space-y-1.5 pt-1">
                  <div className="flex items-center justify-between gap-1.5">
                    {['Meringkas', 'Merancang Blueprint', 'Validasi'].map((stName, idx) => {
                      const isDone =
                        currentProgress.stage === 'parsing'
                          ? true
                          : currentProgress.stage === 'architecting'
                          ? idx <= 1
                          : idx === 0;
                      return (
                        <div
                          key={idx}
                          className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                            isDone
                              ? 'bg-gradient-to-r from-amber-500 to-indigo-500 shadow-sm'
                              : 'bg-slate-200 dark:bg-slate-800'
                          }`}
                        />
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold px-0.5">
                    <span>
                      {currentProgress.stage === 'compressing'
                        ? 'Tahap 1: Ekstraksi Ringkasan'
                        : currentProgress.stage === 'architecting'
                        ? 'Tahap 2: Perancangan Arsitektur Cerita'
                        : 'Tahap 3: Finalisasi Blueprint'}
                    </span>
                    <span className="text-amber-500 font-bold">Proses Berjalan</span>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Opsi Chooser Banner: Muncul jika teks draf memuat 2 atau lebih opsi ide cerita */}
                {(() => {
                  const detectedRawOptions = parseStoryOptions(rawIdea);
                  if (!detectedRawOptions || detectedRawOptions.length < 2) return null;
                  return (
                    <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2.5 animate-in fade-in">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-amber-500 fill-current" />
                          <span className="text-xs font-black text-amber-800 dark:text-amber-300">
                            Terdeteksi {detectedRawOptions.length} Opsi Ide Cerita. Pilih salah satu untuk difokuskan menjadi buku:
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {detectedRawOptions.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setRawIdea(opt.content)}
                            className="p-3 rounded-xl text-left bg-white dark:bg-slate-900 border border-amber-500/30 hover:border-amber-500 hover:shadow-md transition active:scale-95 flex flex-col gap-1.5 group"
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-800 dark:text-amber-300 font-black text-[10px]">
                                {opt.key}
                              </span>
                              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold group-hover:underline">
                                Pilih Opsi Ini &rarr;
                              </span>
                            </div>
                            <span className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                              {opt.title}
                            </span>
                            {opt.preview && (
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                                {opt.preview}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                <div className="space-y-2">
                  <label className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Feather className="w-4 h-4 text-amber-500" />
                    <span>Tuliskan Ide / Premis Ceritamu Bebas:</span>
                  </label>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Ceritakan siapa tokohnya, apa yang dia temukan atau alami, konflik keluarga/dunianya, dan petaka apa yang terjadi. AI akan otomatis menganalisa relasi keluarga, ciri fisik, umur, watak, serta plot ceritanya.
                  </p>

                  <textarea
                    rows={8}
                    value={rawIdea}
                    onChange={(e) => setRawIdea(e.target.value)}
                    placeholder="Contoh: Menceritakan seorang pemuda yang bernama Agung, yang menemukan cincin misterius. Dia membawa pulang cincin dan malapetaka terjadi: seluruh keluarganya hilang ingatan dan membuat hubungan mereka berantakan, Santi istri Agung sampai mengira Agung adalah maling di rumahnya..."
                    className="w-full p-4 sm:p-5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-amber-500 leading-relaxed resize-y shadow-inner min-h-[190px] sm:min-h-[240px]"
                  />
                  {/* Character count & large-text notice */}
                  <div className="flex items-center justify-between px-1 mt-1">
                    <span className={`text-[10px] font-semibold ${rawIdea.length > 5000 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>
                      {rawIdea.length.toLocaleString()} karakter
                    </span>
                    {rawIdea.length > 5000 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
                        <span>⚡</span>
                        <span>Mode Teks Besar — AI akan meringkas dulu</span>
                      </span>
                    )}
                  </div>

                </div>

                {/* Quick Inspiration Templates */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                    <span>💡 Contoh Ide Siap Coba:</span>
                  </span>
                  <div className="flex flex-col gap-1.5">
                    {examplePrompts.map((ex, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setRawIdea(ex)}
                        className="text-left text-[11px] text-slate-600 dark:text-slate-300 hover:text-amber-800 dark:hover:text-amber-300 bg-slate-100/80 dark:bg-slate-950/60 hover:bg-amber-500/10 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 transition line-clamp-2"
                      >
                        "{ex}"
                      </button>
                    ))}
                  </div>
                </div>

                {/* Error Notification */}
                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-2xl text-xs text-red-600 dark:text-red-300 space-y-1 animate-in fade-in">
                    <div className="flex items-center gap-1.5 font-bold text-red-600 dark:text-red-400">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Gagal Menganalisa Premis</span>
                    </div>
                    <p className="text-[11px]">{error}</p>
                    <button
                      type="button"
                      onClick={onOpenAISettings}
                      className="text-amber-700 dark:text-amber-400 underline font-semibold text-[11px] block mt-1"
                    >
                      Periksa API Key di Pengaturan AI ➔
                    </button>
                  </div>
                )}

                {/* Action Button */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={isLoading || !rawIdea.trim()}
                    className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-600 to-indigo-600 hover:opacity-95 text-slate-950 font-black text-xs sm:text-sm shadow-xl shadow-amber-500/20 active:scale-95 transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Sparkles className="w-4 h-4 text-slate-950" />
                    <span>Analisa &amp; Rancang Cerita Lengkap ✨</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 2: REVIEW, EDIT SEMUA FIELD & BUAT PLOT BUKU BARU                    */}
        {/* ========================================================================= */}
        {step === 'review' && blueprint && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 no-scrollbar">
            {/* Top Return & Summary Card */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setStep('input')}
                className="text-xs font-bold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center gap-1.5 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Ubah Ide Mentah</span>
              </button>
              <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30">
                Blueprint Teranalisa ✨
              </span>
            </div>

            {/* 1. SELEKSI JUDUL BUKU & BAB PERTAMA */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-500/10 via-slate-50 to-indigo-500/10 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/30 border border-amber-500/30 space-y-2.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-400 block">
                1. Pilihan Judul Buku (Bisa Anda Pilih / Ketik):
              </span>

              {blueprint.titleOptions && blueprint.titleOptions.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {blueprint.titleOptions.map((opt, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => updateBlueprint({ title: opt })}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 max-w-full text-left ${
                        blueprint.title === opt
                          ? 'bg-amber-500 text-slate-950 shadow-sm'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-amber-400'
                      }`}
                    >
                      {blueprint.title === opt && <Check className="w-3 h-3 flex-shrink-0" />}
                      <span className="break-words">{opt}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Editable Title Input */}
              <input
                type="text"
                value={blueprint.title}
                onChange={(e) => updateBlueprint({ title: e.target.value })}
                placeholder="Judul Buku..."
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 shadow-sm"
              />
            </div>

            {/* Review Navigation Segmented Tabs - Horizontal scrollable to prevent mobile text truncation */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar p-1.5 bg-slate-100 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setActiveReviewTab('overview')}
                className={`py-2 px-3.5 sm:px-4 rounded-xl font-bold transition whitespace-nowrap flex-shrink-0 text-center ${
                  activeReviewTab === 'overview'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-white'
                }`}
              >
                Alur &amp; Opsi
              </button>
              <button
                type="button"
                onClick={() => setActiveReviewTab('characters')}
                className={`py-2 px-3.5 sm:px-4 rounded-xl font-bold transition whitespace-nowrap flex-shrink-0 text-center ${
                  activeReviewTab === 'characters'
                    ? 'bg-pink-500 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-white'
                }`}
              >
                Karakter ({(blueprint.characters || []).length})
              </button>
              <button
                type="button"
                onClick={() => setActiveReviewTab('world')}
                className={`py-2 px-3.5 sm:px-4 rounded-xl font-bold transition whitespace-nowrap flex-shrink-0 text-center ${
                  activeReviewTab === 'world'
                    ? 'bg-cyan-500 text-slate-950 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-white'
                }`}
              >
                Alat &amp; Latar
              </button>
              <button
                type="button"
                onClick={() => setActiveReviewTab('chapters')}
                className={`py-2 px-3.5 sm:px-4 rounded-xl font-bold transition whitespace-nowrap flex-shrink-0 text-center ${
                  activeReviewTab === 'chapters'
                    ? 'bg-indigo-500 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-white'
                }`}
              >
                Bab 1: Plot
              </button>
              <button
                type="button"
                onClick={() => setActiveReviewTab('style')}
                className={`py-2 px-3.5 sm:px-4 rounded-xl font-bold transition whitespace-nowrap flex-shrink-0 text-center ${
                  activeReviewTab === 'style'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-white'
                }`}
              >
                Gaya &amp; POV
              </button>
            </div>

            {/* ========================================================================= */}
            {/* TAB 1: OVERVIEW, SINOPSIS & PILIHAN LANJUTAN ALUR                          */}
            {/* ========================================================================= */}
            {activeReviewTab === 'overview' && (
              <div className="space-y-3.5 animate-in fade-in text-xs">
                {/* Synopsis Editor */}
                <div className="space-y-1.5 bg-slate-50 dark:bg-slate-950/70 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] font-extrabold uppercase text-amber-700 dark:text-amber-400 block">
                    Sinopsis Cerita Inti:
                  </span>
                  <textarea
                    rows={5}
                    value={blueprint.synopsis}
                    onChange={(e) => updateBlueprint({ synopsis: e.target.value })}
                    className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed focus:outline-none focus:border-amber-400 resize-y min-h-[110px]"
                  />
                </div>

                {/* Multiple Story Continuations Options */}
                {blueprint.storyContinuations && blueprint.storyContinuations.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[10px] font-extrabold uppercase text-slate-700 dark:text-slate-300 block">
                      Pilihan Arah Lanjutan Cerita (Klik untuk Memilih):
                    </span>
                    <div className="space-y-2">
                      {blueprint.storyContinuations.map((opt) => {
                        const isSelected = blueprint.selectedContinuation === `${opt.title}: ${opt.description}`;
                        return (
                          <div
                            key={opt.id}
                            onClick={() =>
                              updateBlueprint({
                                selectedContinuation: `${opt.title}: ${opt.description}`,
                              })
                            }
                            className={`p-3 rounded-2xl border transition cursor-pointer ${
                              isSelected
                                ? 'bg-amber-500/10 border-amber-500/80 shadow-xs'
                                : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 hover:border-amber-400'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-extrabold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                                <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${isSelected ? 'bg-amber-500 text-slate-950 font-black' : 'border border-slate-400'}`}>
                                  {isSelected && '✓'}
                                </span>
                                <span>{opt.title}</span>
                              </span>
                              {isSelected && (
                                <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-md">
                                  Terpilih
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed pl-5">
                              {opt.description}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 2: KARAKTER LENGKAP: UMUR, CIRI FISIK, SIFAT & WATAK                    */}
            {/* ========================================================================= */}
            {activeReviewTab === 'characters' && (
              <div className="space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                    Daftar Karakter &amp; Dinamika Keluarga (Dapat Diedit/Ditambah):
                  </span>
                  <button
                    type="button"
                    onClick={handleAddCharacter}
                    className="py-1 px-2.5 rounded-xl bg-pink-500/15 hover:bg-pink-500/25 text-pink-600 dark:text-pink-300 text-xs font-bold transition flex items-center gap-1 active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Karakter</span>
                  </button>
                </div>

                {blueprint.characters.map((char, i) => (
                  <div
                    key={i}
                    className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 space-y-2.5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200/60 dark:border-slate-800/80">
                      <div className="flex items-center gap-2 w-full sm:flex-1 min-w-0">
                        <span className="w-7 h-7 rounded-xl bg-pink-500/20 text-pink-600 dark:text-pink-400 flex items-center justify-center font-black text-xs flex-shrink-0">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <span className="text-[9px] font-extrabold text-pink-600 dark:text-pink-400 uppercase block sm:hidden">
                            Nama Tokoh:
                          </span>
                          <input
                            type="text"
                            value={char.name}
                            onChange={(e) => handleUpdateCharacter(i, 'name', e.target.value)}
                            placeholder="Nama Karakter"
                            className="w-full font-black text-sm sm:text-base text-slate-900 dark:text-white bg-transparent border-b border-dashed border-slate-300 dark:border-slate-700 px-1 py-1 focus:outline-none focus:border-pink-500"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto pt-1 sm:pt-0">
                        <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
                          <span className="text-[10px] text-slate-400 sm:hidden">Peran:</span>
                          <input
                            type="text"
                            value={char.role || ''}
                            onChange={(e) => handleUpdateCharacter(i, 'role', e.target.value)}
                            placeholder="Peran (misal: Suami/Istri)"
                            className="w-full sm:w-auto text-xs font-bold text-pink-600 dark:text-pink-400 bg-pink-500/10 px-2.5 py-1 rounded-lg border border-pink-500/20 focus:outline-none sm:max-w-[150px]"
                          />
                        </div>
                        {blueprint.characters.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleDeleteCharacter(i)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition flex-shrink-0"
                            title="Hapus Karakter"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Quick AI Vision Photo Scanner */}
                    <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Sparkles className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
                        <span className="text-[11px] text-purple-900 dark:text-purple-200 truncate">
                          {scanSuccessIndex?.index === i
                            ? scanSuccessIndex.msg
                            : 'Pindai foto untuk deteksi jenis kelamin, usia pasti, ciri fisik, dan pakaian'}
                        </span>
                      </div>

                      <label className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-[11px] cursor-pointer shadow-xs active:scale-95 transition flex-shrink-0">
                        {scanningCharIndex === i ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin text-white" />
                            <span>Memindai...</span>
                          </>
                        ) : (
                          <>
                            <ImageIcon className="w-3 h-3 text-white" />
                            <span>Pindai Foto Tokoh</span>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={scanningCharIndex !== null}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleScanCharacterPhoto(i, file);
                          }}
                        />
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {/* Usia & Peran */}
                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-500 block mb-0.5">
                          Perkiraan Usia:
                        </label>
                        <input
                          type="text"
                          value={char.age || ''}
                          onChange={(e) => handleUpdateCharacter(i, 'age', e.target.value)}
                          placeholder="Contoh: 28 Tahun"
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-pink-400"
                        />
                      </div>

                      {/* Deskripsi Singkat / Peran */}
                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-500 block mb-0.5">
                          Peran / Hubungan:
                        </label>
                        <textarea
                          rows={2}
                          value={char.shortDescription || ''}
                          onChange={(e) => handleUpdateCharacter(i, 'shortDescription', e.target.value)}
                          placeholder="Contoh: Kepala keluarga yang mengalami musibah cincin..."
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-pink-400 resize-y min-h-[50px] leading-relaxed"
                        />
                      </div>
                    </div>

                    {/* Ciri-Ciri Fisik */}
                    <div>
                      <label className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-400 block mb-0.5">
                        👤 Ciri-Ciri Fisik (Wajah, Postur, Rambut &amp; Busana):
                      </label>
                      <textarea
                        rows={3}
                        value={char.physicalTraits || ''}
                        onChange={(e) => handleUpdateCharacter(i, 'physicalTraits', e.target.value)}
                        placeholder="Contoh: Wanita 26 tahun keturunan Tionghoa-Sunda, kulit kuning langsat mulus, mata ekspresif lembut, tubuh sintal berpostur pas, mengenakan kemeja polo motif kotak kasual dan celana jeans rapi..."
                        className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-amber-400 resize-y leading-relaxed min-h-[64px]"
                      />
                    </div>

                    {/* Sifat & Watak */}
                    <div>
                      <label className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400 block mb-0.5">
                        ⚡ Sifat &amp; Watak Kepribadian:
                      </label>
                      <textarea
                        rows={3}
                        value={char.traits || ''}
                        onChange={(e) => handleUpdateCharacter(i, 'traits', e.target.value)}
                        placeholder="Contoh: Penyayang, pekerja keras, mudah cemas, keras kepala saat mempertahankan kebenaran..."
                        className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-400 resize-y leading-relaxed min-h-[64px]"
                      />
                    </div>

                    {/* Visual Prompt (English Text-to-Image 9:16) */}
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <label className="text-[10px] font-bold uppercase text-indigo-600 dark:text-indigo-400 block">
                          🎨 Visual Prompt (English - Text-to-Image 9:16):
                        </label>
                        <span className="text-[9px] text-slate-400">Photorealistic, English</span>
                      </div>
                      <textarea
                        rows={3}
                        value={char.visualPrompt || ''}
                        onChange={(e) => handleUpdateCharacter(i, 'visualPrompt', e.target.value)}
                        placeholder="Full length portrait standing upright facing camera directly, centered, looking straight into lens, realistic 26-year-old Indonesian woman, smooth fair warm skin, natural feminine hourglass curves, wearing casual plaid polo shirt and denim jeans, standing inside a warm sunlit room with shallow depth of field background blur, clear sharp facial features, cinematic lighting, photorealistic 8k, aspect ratio 9:16..."
                        className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-400 resize-y leading-relaxed min-h-[68px]"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 3: ALAT (ITEM/RELIK) & TEMPAT (LOKASI)                                */}
            {/* ========================================================================= */}
            {activeReviewTab === 'world' && (
              <div className="space-y-4 animate-in fade-in text-xs">
                {/* Items Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                      <Shield className="w-4 h-4" />
                      <span>Alat / Item / Artefak Misterius:</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="py-1 px-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 font-bold text-[11px] transition flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Tambah Item</span>
                    </button>
                  </div>

                  {blueprint.items.map((itm, i) => (
                    <div key={i} className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <input
                          type="text"
                          value={itm.name}
                          onChange={(e) => handleUpdateItem(i, 'name', e.target.value)}
                          placeholder="Nama Item"
                          className="font-bold text-xs text-slate-900 dark:text-white bg-transparent border-b border-dashed border-slate-300 dark:border-slate-700 px-1 py-0.5 focus:outline-none focus:border-amber-500 flex-1"
                        />
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(i)}
                          className="p-1 text-slate-400 hover:text-red-500 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <textarea
                        rows={3}
                        value={itm.shortDescription}
                        onChange={(e) => handleUpdateItem(i, 'shortDescription', e.target.value)}
                        placeholder="Efek, kutukan, atau dampak artefak terhadap cerita..."
                        className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-800 dark:text-slate-200 resize-y min-h-[60px] focus:outline-none focus:border-amber-400 leading-relaxed"
                      />
                    </div>
                  ))}
                </div>

                {/* Locations Section */}
                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-cyan-600 dark:text-cyan-400 flex items-center gap-1.5">
                      <MapPin className="w-4 h-4" />
                      <span>Tempat / Lokasi Cerita:</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleAddLocation}
                      className="py-1 px-2.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-600 dark:text-cyan-300 font-bold text-[11px] transition flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Tambah Tempat</span>
                    </button>
                  </div>

                  {blueprint.locations.map((loc, i) => (
                    <div key={i} className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <input
                          type="text"
                          value={loc.name}
                          onChange={(e) => handleUpdateLocation(i, 'name', e.target.value)}
                          placeholder="Nama Lokasi"
                          className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white bg-transparent border-b border-dashed border-slate-300 dark:border-slate-700 px-1 py-0.5 focus:outline-none focus:border-cyan-500 flex-1"
                        />
                        <button
                          type="button"
                          onClick={() => handleDeleteLocation(i)}
                          className="p-1 text-slate-400 hover:text-red-500 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <textarea
                        rows={3}
                        value={loc.shortDescription}
                        onChange={(e) => handleUpdateLocation(i, 'shortDescription', e.target.value)}
                        placeholder="Deskripsi suasana dan detail lokasi..."
                        className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-800 dark:text-slate-200 resize-y min-h-[60px] focus:outline-none focus:border-cyan-400 leading-relaxed"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 4: RANCANGAN BAB 1 & STORY PLOT AWAL                                  */}
            {/* ========================================================================= */}
            {activeReviewTab === 'chapters' && (
              <div className="space-y-3.5 animate-in fade-in text-xs">
                <div>
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block px-1">
                    Rancangan Bab Pembuka (Bab 1) &amp; Story Plot:
                  </span>
                  <span className="text-[10px] text-slate-500 block px-1">
                    Plot ini akan menjadi acuan naskah dan digunakan oleh AI untuk menyusun bab pertama.
                  </span>
                </div>

                {blueprint.chapters.slice(0, 1).map((chap, i) => (
                  <div key={i} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold uppercase px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30">
                        Bab 1 (Bab Pembuka)
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        Target {chap.targetWordCount || 1800} kata
                      </span>
                    </div>

                    {/* Pilihan Judul Bab 1 */}
                    {blueprint.firstChapterTitleOptions && blueprint.firstChapterTitleOptions.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <label className="text-[10px] font-bold uppercase text-indigo-600 dark:text-indigo-400 block">
                          Pilihan Alternatif Judul Bab 1:
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {blueprint.firstChapterTitleOptions.map((opt, optIdx) => (
                            <button
                              key={optIdx}
                              type="button"
                              onClick={() => handleUpdateChapter(0, 'title', opt)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 text-left ${
                                chap.title === opt
                                  ? 'bg-indigo-600 text-white shadow-sm'
                                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                              }`}
                            >
                              {chap.title === opt && <Check className="w-3 h-3 flex-shrink-0" />}
                              <span className="break-words">{opt}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Judul Bab Input */}
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                        Judul Bab 1:
                      </label>
                      <input
                        type="text"
                        value={chap.title}
                        onChange={(e) => handleUpdateChapter(0, 'title', e.target.value)}
                        placeholder="Judul Bab 1..."
                        className="w-full font-bold text-xs sm:text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 shadow-sm"
                      />
                    </div>

                    {/* Story Plot Luas */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-bold uppercase text-indigo-600 dark:text-indigo-400 block">
                          📝 Alur Story Plot Bab 1 (Poin-Poin Adegan &amp; Bahan AI):
                        </label>
                        <span className="text-[9px] text-slate-400">Dapat diperluas</span>
                      </div>
                      <textarea
                        rows={7}
                        value={chap.premise}
                        onChange={(e) => handleUpdateChapter(0, 'premise', e.target.value)}
                        placeholder="1. Adegan pembuka...\n2. Titik balik dan kemunculan konflik...\n3. Ketegangan akhir bab..."
                        className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed resize-y min-h-[140px] focus:outline-none focus:border-indigo-400 shadow-inner"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 5: GAYA PENULISAN & SUDUT PANDANG (POV)                                */}
            {/* ========================================================================= */}
            {activeReviewTab === 'style' && (
              <div className="space-y-3.5 animate-in fade-in text-xs">
                {/* Point of View */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-2">
                  <label className="text-[11px] font-extrabold uppercase text-purple-700 dark:text-purple-400 block">
                    Sudut Pandang (Point of View):
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      'Orang Ketiga Terbatas (Menyorot Tokoh Utama)',
                      'Orang Pertama (POV Protagonis - "Aku")',
                      'Orang Ketiga Mahatahu (Omniscient)',
                    ].map((pov) => (
                      <button
                        key={pov}
                        type="button"
                        onClick={() => updateBlueprint({ pointOfView: pov })}
                        className={`p-2.5 rounded-xl border text-left text-[11px] font-bold transition ${
                          blueprint.pointOfView === pov
                            ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-purple-400'
                        }`}
                      >
                        {pov}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Writing Style */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-2">
                  <label className="text-[11px] font-extrabold uppercase text-purple-700 dark:text-purple-400 block">
                    Gaya Penulisan &amp; Diksi:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      'Emosional, Penuh Ketegangan Batin & Realistis',
                      'Sastra Puitis, Deskriptif Panca Indera & Dialog Berbobot',
                      'Cepat, Lugas, Menghanyutkan & Mengalir (Page Turner)',
                      'Nuansa Gelap (Dark & Gritty) Penuh Intrik Supranatural',
                      'Modern Kasual & Santai (Gaya Bahasa Gaul "Gua-Lu", Diksi Kekinian)',
                      'Nuansa Lokal & Dialog Bahasa Daerah (Cita Rasa Kultural Autentik)',
                      'Urban Pop & Metropolitan (Cepat, Gaul, Kosmopolitan)',
                    ].map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => updateBlueprint({ writingStyle: st })}
                        className={`p-2.5 rounded-xl border text-left text-[11px] font-bold transition ${
                          blueprint.writingStyle === st
                            ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-purple-400'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Genre & Setting notes */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-2">
                  <label className="text-[11px] font-extrabold uppercase text-slate-700 dark:text-slate-300 block">
                    Latar Budaya &amp; Nuansa Dunia:
                  </label>
                  <input
                    type="text"
                    value={blueprint.settingTimeAndTone || ''}
                    onChange={(e) => updateBlueprint({ settingTimeAndTone: e.target.value })}
                    placeholder="Contoh: Indonesia Kontemporer / Realitas Lokal bernuansa Misteri Hangat"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-purple-400"
                  />
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* CTA BUTTON: BANGUN BUKU & STORY PLOT KE DATABASE                          */}
            {/* ========================================================================= */}
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
                    <span>Membangun Buku, Karakter &amp; Story Plot...</span>
                  </>
                ) : (
                  <>
                    <Rocket className="w-4 h-4 text-slate-950" />
                    <span>Membuat Plot &amp; Bangun Buku Baru 🚀</span>
                  </>
                )}
              </button>
              <p className="text-[10px] text-slate-500 text-center mt-1.5">
                Buku baru akan dibuat bersama entitas ensiklopedia dan Story Plot bab yang sudah terisi.
              </p>
            </div>
          </div>
        )}

        {/* Recovery Fallback if step is review but blueprint is missing */}
        {step === 'review' && !blueprint && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3">
            <AlertTriangle className="w-8 h-8 text-amber-500" />
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
              Blueprint belum tersedia. Silakan masukkan ide cerita terlebih dahulu.
            </p>
            <button
              type="button"
              onClick={() => setStep('input')}
              className="px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-xl text-xs shadow-md active:scale-95 transition"
            >
              Kembali ke Input Ide
            </button>
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
