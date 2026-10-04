import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Zap,
  Copy,
  Check,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Flame,
  Volume2,
  Eye,
  Sliders,
  Compass,
  MessageSquare,
  Wand2,
  HeartHandshake,
  Layers,
  FileEdit,
  ArrowDownRight,
  HelpCircle,
  Clock,
  BookOpen
} from 'lucide-react';
import { generateWithSmartFallback } from '../../services/aiService';
import { AIGenerationEvent, AIGenerateResult } from '../../types/ai';
import { WorldEntity } from '../../types';

interface AIAssistantSheetProps {
  isOpen: boolean;
  onClose: () => void;
  selectedText: string;
  surroundingBefore?: string;
  surroundingAfter?: string;
  chapterPremise?: string;
  bookTitle?: string;
  chapterTitle?: string;
  chapterOrder?: number;
  entities?: WorldEntity[];
  onApplyResult: (text: string, mode: 'insert' | 'replace') => void;
  onOpenAISettings: () => void;
}

export type AICopilotMode = 'rewrite' | 'continue';
export type AIRewriteAction = 'emotional' | 'show_dont_tell' | 'dialogue' | 'sensory' | 'paraphrase' | 'custom';
export type AIContinueLength = 'short' | 'medium' | 'long';

export const AIAssistantSheet: React.FC<AIAssistantSheetProps> = ({
  isOpen,
  onClose,
  selectedText,
  surroundingBefore = '',
  surroundingAfter = '',
  chapterPremise,
  bookTitle,
  chapterTitle,
  chapterOrder,
  entities = [],
  onApplyResult,
  onOpenAISettings,
}) => {
  // Mode selection: default to 'rewrite' if text is highlighted, otherwise 'continue'
  const [activeMode, setActiveMode] = useState<AICopilotMode>(
    selectedText && selectedText.trim().length > 0 ? 'rewrite' : 'continue'
  );

  // Rewrite Mode state
  const [rewriteAction, setRewriteAction] = useState<AIRewriteAction>('emotional');
  const [customPrompt, setCustomPrompt] = useState('');
  const [inputContext, setInputContext] = useState(selectedText || '');

  // Continue Mode state
  const [continueInstruction, setContinueInstruction] = useState('');
  const [continueLength, setContinueLength] = useState<AIContinueLength>('medium');

  // AI execution & result state
  const [isLoading, setIsLoading] = useState(false);
  const [currentAttempts, setCurrentAttempts] = useState<AIGenerationEvent[]>([]);
  const [result, setResult] = useState<AIGenerateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Synchronize when selectedText changes
  useEffect(() => {
    if (selectedText && selectedText.trim().length > 0) {
      setInputContext(selectedText);
      setActiveMode('rewrite');
      setRewriteAction('emotional');
    } else {
      setActiveMode('continue');
      setInputContext('');
    }
    setResult(null);
    setError(null);
    setCurrentAttempts([]);
  }, [selectedText, isOpen]);

  if (!isOpen) return null;

  // Presets for rewriting specific parts
  const rewritePresets: {
    id: AIRewriteAction;
    label: string;
    icon: any;
    color: string;
    badgeColor: string;
    desc: string;
    promptTemplate: string;
  }[] = [
    {
      id: 'emotional',
      label: 'Lebih Emosional',
      icon: Flame,
      color: 'text-rose-500 dark:text-rose-400 bg-rose-500/10 border-rose-500/30',
      badgeColor: 'bg-rose-500/20 text-rose-700 dark:text-rose-300',
      desc: 'Tingkatkan intensitas emosi, detak jantung, napas, getaran suara, dan gejolak batin',
      promptTemplate: 'Ubah teks berikut menjadi jauh lebih emosional dan menyentuh. Tonjolkan getaran fisik, reaksi mikro tubuh, detak jantung, dan pergolakan batin karakter secara nyata:',
    },
    {
      id: 'show_dont_tell',
      label: "Show, Don't Tell",
      icon: Eye,
      color: 'text-amber-500 dark:text-amber-400 bg-amber-500/10 border-amber-500/30',
      badgeColor: 'bg-amber-500/20 text-amber-700 dark:text-amber-300',
      desc: 'Ubah kalimat pasif/ringkas menjadi aksi fisik nyata dan reaksi inderawi konkret',
      promptTemplate: 'Terapkan teknik "Show, Don\'t Tell" secara mendalam pada teks berikut. Ganti kalimat deskriptif pasif dengan aksi konkret, gerak-gerik fisik, dan interaksi lingkungan:',
    },
    {
      id: 'dialogue',
      label: 'Pertajam Dialog',
      icon: MessageSquare,
      color: 'text-indigo-500 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/30',
      badgeColor: 'bg-indigo-500/20 text-indigo-700 dark:text-indigo-300',
      desc: 'Buat percakapan lebih bertenaga, natural, berkarakter, dan penuh subteks',
      promptTemplate: 'Sempurnakan dialog dalam teks berikut agar terasa hidup, bertenaga, memiliki subteks emosional, dan mencerminkan watak khas karakter tanpa terkesan kaku:',
    },
    {
      id: 'sensory',
      label: 'Panca Indra & Atmosfer',
      icon: Volume2,
      color: 'text-cyan-500 dark:text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
      badgeColor: 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300',
      desc: 'Perkaya pencahayaan, aroma, suara latar, tekstur sentuhan, dan suhu adegan',
      promptTemplate: 'Perkaya adegan berikut dengan panca indra: jelaskan visual pencahayaan, aroma di udara, suara latar yang terdengar, suhu lingkungan, dan tekstur sentuhan fisik:',
    },
    {
      id: 'paraphrase',
      label: 'Variasi Diksi Sastra',
      icon: Wand2,
      color: 'text-emerald-500 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
      badgeColor: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
      desc: 'Tulis ulang dengan gaya sastra Indonesia yang segar, berirama, dan kaya kosa kata',
      promptTemplate: 'Tulis ulang teks berikut dengan pilihan diksi bahasa Indonesia sastra yang elegan, mengalir indah, berirama, dan tidak klise tanpa mengubah inti ceritanya:',
    },
    {
      id: 'custom',
      label: 'Instruksi Khusus',
      icon: Sparkles,
      color: 'text-purple-500 dark:text-purple-400 bg-purple-500/10 border-purple-500/30',
      badgeColor: 'bg-purple-500/20 text-purple-700 dark:text-purple-300',
      desc: 'Ketik permintaan apa pun secara bebas untuk memoles atau merombak bagian ini',
      promptTemplate: '',
    },
  ];

  // Build relevant lorebook knowledge
  const getRelevantLorebook = (): string => {
    if (!entities || entities.length === 0) return '';
    const textToCheck = `${surroundingBefore} ${inputContext} ${surroundingAfter} ${chapterPremise || ''}`.toLowerCase();

    // Prioritize entities mentioned in the context, fallback to top characters
    const relevant = entities.filter((e) => {
      const name = e.name.toLowerCase();
      if (textToCheck.includes(name)) return true;
      if (e.aliases && e.aliases.some((a) => textToCheck.includes(a.toLowerCase()))) return true;
      return false;
    });

    const listToUse = relevant.length > 0 ? relevant.slice(0, 10) : entities.slice(0, 6);

    return listToUse
      .map((e) => {
        const traits = e.currentTraits || e.initialTraits || '';
        const role = e.role ? `[${e.role.toUpperCase()}]` : '';
        const faction = e.faction ? `• Faksi: ${e.faction}` : '';
        return `• ${e.name} (${e.category}) ${role} ${faction}: ${traits ? `Sifat: ${traits}. ` : ''}${e.shortDescription || ''}`;
      })
      .join('\n');
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    setCurrentAttempts([]);
    setResult(null);

    const loreSummary = getRelevantLorebook();

    const systemPrompt = `Kamu adalah Asisten Penulis Cerita Fiksi & Novel Profesional (Creative Writing Co-Pilot) untuk buku "${bookTitle || 'Novel'}" ${
      chapterTitle ? `(Bab ${chapterOrder || ''}: ${chapterTitle})` : ''
    }.

PANDUAN PENULISAN:
- Gunakan Bahasa Indonesia sastra bermutu tinggi yang mengalir, kaya metafora segar, tajam, dan tidak klise.
- Pertahankan konsistensi sudut pandang (POV) dan nada cerita yang sedang berjalan.
- Selalu patuhi prinsip "Show, Don't Tell": hadirkan perasaan karakter melalui gestur fisik, reaksi inderawi, dan detak jantung.
${chapterPremise ? `\nPREMIS / FOKUS BAB INI:\n${chapterPremise}\n` : ''}
${loreSummary ? `\nPENGETAHUAN GLOSARIUM & TOKOH (LOREBOOK):\n${loreSummary}\n` : ''}
ATURAN FORMAT OUTPUT:
- Berikan LANGSUNG teks narasi/dialog cerita yang siap ditempel ke naskah.
- DILARANG menambahkan kalimat pembuka basa-basi seperti "Tentu, ini hasilnya:", "Berikut adalah revisinya:", atau ucapan penutup apa pun.`;

    let userPrompt = '';

    if (activeMode === 'rewrite') {
      const activePreset = rewritePresets.find((p) => p.id === rewriteAction);
      const instruction =
        rewriteAction === 'custom'
          ? customPrompt.trim() || 'Ubah dan sempurnakan bagian naskah ini agar lebih memikat.'
          : activePreset?.promptTemplate || 'Sempurnakan teks berikut:';

      userPrompt = `${instruction}

TEKS ASLI YANG INGIN DIUBAH:
"""
${inputContext.trim()}
"""
${surroundingBefore.trim() ? `\nKONTEKS SEBELUM TEKS INI (Untuk kesinambungan adegan):\n"...${surroundingBefore.slice(-300).trim()}..."` : ''}
${surroundingAfter.trim() ? `\nKONTEKS SETELAH TEKS INI:\n"...${surroundingAfter.slice(0, 300).trim()}..."` : ''}

Tuliskan versi revisi/polesannya secara langsung:`;
    } else {
      // Continue Mode
      const lengthGuide =
        continueLength === 'short'
          ? 'sebanyak 1 paragraf padat (~80-120 kata)'
          : continueLength === 'long'
          ? 'sebanyak 3-5 paragraf mendalam (~350-500 kata)'
          : 'sebanyak 2-3 paragraf mengalir (~180-250 kata)';

      userPrompt = `Lanjutkan adegan cerita berikut ini ${lengthGuide}.
${continueInstruction.trim() ? `ARAHAN ADEGAN SELANJUTNYA DARI PENULIS:\n"${continueInstruction.trim()}"\n` : ''}
POTONGAN TERAKHIR NASKAH CERITA SEBELUMNYA:
"""
${surroundingBefore.trim() ? surroundingBefore.slice(-600).trim() : 'Mulai babak pembuka cerita ini secara memikat...'}
"""

Lanjutkan cerita secara mulus menyambung dari kata terakhir di atas:`;
    }

    try {
      const genResult = await generateWithSmartFallback(userPrompt, systemPrompt, (event) => {
        setCurrentAttempts((prev) => [...prev, event]);
      });
      setResult(genResult);
    } catch (err: any) {
      setError(err?.message || 'Terjadi kesalahan saat memproses bantuan AI.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/50 dark:bg-black/80 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Main Sheet Modal Container */}
      <div className="relative w-full sm:max-w-2xl bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl z-10 max-h-[92vh] flex flex-col animate-in slide-in-from-bottom duration-250 safe-bottom overflow-hidden">
        
        {/* Mobile Swipe Handle */}
        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700/80 rounded-full mx-auto mt-2.5 mb-1 sm:hidden flex-shrink-0" />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 font-black shadow-md shadow-amber-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white leading-tight">
                  AI Writing Co-Pilot
                </h3>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                  Presisi Naskah
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Ubah kalimat atau lanjutkan cerita dengan pengetahuan glosarium
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onOpenAISettings}
              className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-amber-600 dark:text-slate-400 dark:hover:text-amber-400 transition"
              title="Pengaturan API AI"
            >
              <Sliders className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mode Switcher Tabs (Ubah Teks Tertentu vs Lanjutkan Cerita) */}
        <div className="flex items-center p-1.5 bg-slate-100/80 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800/80 gap-1.5 flex-shrink-0 px-4 sm:px-5">
          <button
            type="button"
            onClick={() => setActiveMode('rewrite')}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95 ${
              activeMode === 'rewrite'
                ? 'bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-300 shadow-sm border border-slate-200 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <FileEdit className="w-3.5 h-3.5 text-amber-500" />
            <span>Ubah Bagian Tertentu {inputContext ? `(${inputContext.trim().split(/\s+/).filter(Boolean).length} kata)` : ''}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMode('continue')}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95 ${
              activeMode === 'continue'
                ? 'bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-300 shadow-sm border border-slate-200 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ArrowRight className="w-3.5 h-3.5 text-emerald-500" />
            <span>Lanjutkan Cerita</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 no-scrollbar">

          {/* MODE 1: UBAH BAGIAN TERTENTU (REWRITE / POLISH) */}
          {activeMode === 'rewrite' && (
            <div className="space-y-3.5">
              {/* Presets Grid */}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5">
                  Pilih Arah Pemolesan Kalimat:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {rewritePresets.map((preset) => {
                    const Icon = preset.icon;
                    const isSelected = rewriteAction === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setRewriteAction(preset.id)}
                        className={`flex flex-col p-2.5 rounded-xl border text-left transition active:scale-95 ${
                          isSelected
                            ? `${preset.color} shadow-sm ring-1 ring-amber-400/40 font-bold`
                            : 'bg-slate-50 dark:bg-slate-950/70 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="text-xs truncate font-bold">{preset.label}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight line-clamp-2">
                          {preset.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Prompt Input if 'custom' is active */}
              {rewriteAction === 'custom' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    <span>Instruksi Khusus Anda:</span>
                  </label>
                  <input
                    type="text"
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="Contoh: Ubah bagian ini jadi lebih emosional dan penuh tangisan / Buat bernada sarkas..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-400 shadow-sm"
                  />
                </div>
              )}

              {/* Selected Text Input Box */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    Teks Asli yang Akan Dipoles:
                  </label>
                  <span className="text-[10px] font-mono text-slate-400">
                    {inputContext.trim() ? inputContext.trim().split(/\s+/).filter(Boolean).length : 0} kata
                  </span>
                </div>
                <textarea
                  rows={3}
                  value={inputContext}
                  onChange={(e) => setInputContext(e.target.value)}
                  placeholder="Blok kalimat di naskah atau ketik/tempel teks yang ingin diubah di sini..."
                  className="w-full p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-amber-400 leading-relaxed resize-y shadow-inner"
                />
              </div>
            </div>
          )}

          {/* MODE 2: LANJUTKAN CERITA (CONTINUE STORY) */}
          {activeMode === 'continue' && (
            <div className="space-y-3.5">
              {/* Preceding Story Context Preview */}
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Konteks Cerita Sebelumnya (Ujung Naskah):</span>
                  </span>
                  <span>Otomatis Terhubung</span>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 italic font-serif leading-relaxed line-clamp-4 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800">
                  {surroundingBefore.trim()
                    ? `"...${surroundingBefore.slice(-350).trim()}"`
                    : 'Belum ada naskah sebelumnya. AI akan merancang awal adegan baru berdasarkan premis bab.'}
                </p>
              </div>

              {/* Optional continuation prompt */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Arah / Kejadian Adegan Selanjutnya (Opsional):
                </label>
                <input
                  type="text"
                  value={continueInstruction}
                  onChange={(e) => setContinueInstruction(e.target.value)}
                  placeholder="Contoh: Tiba-tiba pintu didobrak prajurit bertopeng / Suasana menjadi sunyi mencekam..."
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-400 shadow-sm"
                />
              </div>

              {/* Length Selector */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  Target Panjang Teks:
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'short', label: 'Singkat', desc: '1 Paragraf (~100 kata)' },
                    { id: 'medium', label: 'Sedang', desc: '2-3 Paragraf (~250 kata)' },
                    { id: 'long', label: 'Panjang', desc: '3-5 Paragraf (~400 kata)' },
                  ].map((len) => (
                    <button
                      key={len.id}
                      type="button"
                      onClick={() => setContinueLength(len.id as AIContinueLength)}
                      className={`p-2 rounded-xl border text-center transition active:scale-95 ${
                        continueLength === len.id
                          ? 'bg-amber-500/15 border-amber-500/40 text-amber-800 dark:text-amber-300 font-bold shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-950/70 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <div className="text-xs font-bold">{len.label}</div>
                      <div className="text-[9px] text-slate-400 mt-0.5">{len.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Action Trigger Button */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isLoading || (activeMode === 'rewrite' && !inputContext.trim())}
            className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 active:scale-95 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Zap className="w-4 h-4 animate-spin" />
                <span>Memproses AI dengan Pengetahuan Glosarium...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>{activeMode === 'rewrite' ? 'Poles Bagian Ini Sekarang' : 'Lanjutkan Cerita Sekarang'}</span>
              </>
            )}
          </button>

          {/* Cascading Fallback & Execution Log */}
          {currentAttempts.length > 0 && (
            <div className="space-y-1 bg-slate-100 dark:bg-slate-950/80 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800/80 text-[11px]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                Jejak Eksekusi AI:
              </span>
              {currentAttempts.map((att, i) => (
                <div key={i} className="flex items-center gap-2">
                  {att.status === 'attempt' && <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />}
                  {att.status === 'fallback' && <span className="w-2 h-2 rounded-full bg-red-400" />}
                  {att.status === 'success' && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
                  <span className="text-slate-700 dark:text-slate-300 font-mono text-[10px]">
                    [{att.provider.toUpperCase()}] {att.model} ({att.slotLabel})
                  </span>
                  <span className="text-slate-500 text-[10px]">
                    {att.status === 'attempt' && 'Menghubungi...'}
                    {att.status === 'fallback' && `Gagal: ${att.error?.slice(0, 30)}... Beralih`}
                    {att.status === 'success' && `Berhasil (${att.latencyMs}ms)`}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-2xl text-xs text-red-600 dark:text-red-300 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-red-600 dark:text-red-400">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>Gagal Memproses AI</span>
              </div>
              <p className="whitespace-pre-line text-[11px] leading-relaxed">{error}</p>
            </div>
          )}

          {/* BEFORE VS AFTER COMPARISON CARD (Tampilan Komparasi Hasil) */}
          {result && (
            <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-white">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Komparasi Before &amp; After</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-800 dark:text-amber-300 font-mono font-medium">
                    {result.provider === 'gemini' ? 'Gemini' : result.provider === 'groq' ? 'Groq' : 'OpenRouter'} model {result.model}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={isLoading}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 dark:text-slate-400 dark:hover:text-amber-400 transition"
                    title="Generate Variasi Lain"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition"
                    title="Salin Hasil"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Side-by-Side or Stacked Before vs After */}
              <div className="space-y-2.5">
                {/* 1. BEFORE (Teks Asli Lama) - Hanya tampil jika ada teks asli yang diubah */}
                {activeMode === 'rewrite' && inputContext.trim() && (
                  <div className="p-3 rounded-2xl bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1">
                        <span>❌ SEBELUM (TEKS ASLI LAMA)</span>
                      </span>
                      <span className="text-[9px] font-mono text-rose-500">
                        {inputContext.trim().split(/\s+/).filter(Boolean).length} kata
                      </span>
                    </div>
                    <div className="text-xs text-rose-900/90 dark:text-rose-200/90 leading-relaxed font-serif line-through decoration-rose-400/60 max-h-32 overflow-y-auto no-scrollbar">
                      {inputContext.trim()}
                    </div>
                  </div>
                )}

                {/* 2. AFTER (Hasil Poles AI) */}
                <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-500/40 space-y-1.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                      <span>✨ SESUDAH ({activeMode === 'rewrite' ? 'HASIL POLESAN AI' : 'KELANJUTAN CERITA'})</span>
                    </span>
                    <span className="text-[9px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                      {result.text.trim().split(/\s+/).filter(Boolean).length} kata
                    </span>
                  </div>
                  <div className="text-xs sm:text-sm text-slate-900 dark:text-slate-100 leading-relaxed font-serif p-1 max-h-60 overflow-y-auto no-scrollbar whitespace-pre-line">
                    {result.text}
                  </div>
                </div>
              </div>

              {/* Action Buttons: Replace or Insert */}
              <div className="flex items-center gap-2 pt-1">
                {activeMode === 'rewrite' && inputContext.trim() && (
                  <button
                    type="button"
                    onClick={() => {
                      onApplyResult(result.text, 'replace');
                      onClose();
                    }}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-black text-xs transition active:scale-95 text-center shadow-md flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Ganti Teks Asli Sekarang</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    onApplyResult(result.text, 'insert');
                    onClose();
                  }}
                  className={`py-2.5 px-3 rounded-xl font-bold text-xs transition active:scale-95 text-center ${
                    activeMode === 'rewrite' && inputContext.trim()
                      ? 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700'
                      : 'w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black shadow-md flex items-center justify-center gap-1.5'
                  }`}
                >
                  <ArrowDownRight className="w-4 h-4" />
                  <span>{activeMode === 'rewrite' ? 'Sisipkan Setelahnya' : 'Sisipkan ke Naskah Cerita'}</span>
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
