import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Zap,
  Send,
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
  Compass
} from 'lucide-react';
import { generateWithSmartFallback } from '../../services/aiService';
import { AIGenerationEvent, AIGenerateResult } from '../../types/ai';
import { WorldEntity } from '../../types';

interface AIAssistantSheetProps {
  isOpen: boolean;
  onClose: () => void;
  selectedText: string;
  chapterPremise?: string;
  bookTitle?: string;
  entities?: WorldEntity[];
  onApplyResult: (text: string, mode: 'insert' | 'replace') => void;
  onOpenAISettings: () => void;
}

type AIActionType = 'show_dont_tell' | 'dialogue' | 'sensory' | 'continue' | 'custom';

export const AIAssistantSheet: React.FC<AIAssistantSheetProps> = ({
  isOpen,
  onClose,
  selectedText,
  chapterPremise,
  bookTitle,
  entities = [],
  onApplyResult,
  onOpenAISettings,
}) => {
  const [actionType, setActionType] = useState<AIActionType>(selectedText ? 'show_dont_tell' : 'continue');
  const [customPrompt, setCustomPrompt] = useState('');
  const [inputContext, setInputContext] = useState(selectedText || '');
  const [isLoading, setIsLoading] = useState(false);
  const [currentAttempts, setCurrentAttempts] = useState<AIGenerationEvent[]>([]);
  const [result, setResult] = useState<AIGenerateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Sync selectedText whenever it changes
  React.useEffect(() => {
    if (selectedText) {
      setInputContext(selectedText);
      setActionType('show_dont_tell');
    }
  }, [selectedText]);

  if (!isOpen) return null;

  const quickActions: { id: AIActionType; label: string; icon: any; color: string; desc: string }[] = [
    {
      id: 'show_dont_tell',
      label: "Show, Don't Tell",
      icon: Eye,
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
      desc: 'Ubah kalimat pasif/deskriptif jadi emosi & reaksi fisik nyata',
    },
    {
      id: 'dialogue',
      label: 'Sempurnakan Dialog',
      icon: Flame,
      color: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
      desc: 'Pertajam dialog agar natural, berkarakter, dan penuh subteks',
    },
    {
      id: 'sensory',
      label: 'Panca Indra & Suasana',
      icon: Volume2,
      color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
      desc: 'Perkaya pencahayaan, aroma, tekstur, dan suara latar adegan',
    },
    {
      id: 'continue',
      label: 'Lanjutkan Adegan',
      icon: ArrowRight,
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
      desc: 'Lanjutkan narasi sesuai alur beat bab dan karakter aktif',
    },
    {
      id: 'custom',
      label: 'Instruksi Bebas',
      icon: Sparkles,
      color: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
      desc: 'Ketik permintaan apa pun untuk AI asisten penulisanmu',
    },
  ];

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    setCurrentAttempts([]);
    setResult(null);

    // Build context-aware lore injection
    const entitySummaries = entities
      .slice(0, 8)
      .map((e) => `• ${e.name} (${e.category}): ${e.shortDescription || ''}`)
      .join('\n');

    const systemPrompt = `Kamu adalah Asisten Penulis Cerita Fiksi Profesional (Creative Writing Co-Pilot) untuk naskah buku "${bookTitle || 'Cerita'}".
Panduan Menulis:
- Gunakan Bahasa Indonesia sastra yang mengalir, kaya diksi, tidak klise.
- Selalu utamakan prinsip "Show, Don't Tell".
${chapterPremise ? `Premis / Alur Bab Ini: ${chapterPremise}` : ''}
${entitySummaries ? `Ensiklopedia Dunia (Lorebook Singkat):\n${entitySummaries}` : ''}
Berikan respon langsung berupa teks narasi/dialog cerita tanpa basa-basi pembuka atau penutup.`;

    let userPrompt = '';
    if (actionType === 'show_dont_tell') {
      userPrompt = `Ubah paragraf berikut dengan teknik "Show, Don't Tell". Tunjukkan emosi mendalam melalui detak jantung, ekspresi mikro, tarikan napas, dan aksi konkret:\n\n"${inputContext}"`;
    } else if (actionType === 'dialogue') {
      userPrompt = `Sempurnakan dialog berikut agar terasa hidup, tidak kaku, bertenaga, dan mencerminkan ketegangan karakter:\n\n"${inputContext}"`;
    } else if (actionType === 'sensory') {
      userPrompt = `Perkaya adegan berikut dengan detail panca indra (penglihatan, penciuman, pendengaran, sentuhan fisik, dan suhu ruangan):\n\n"${inputContext}"`;
    } else if (actionType === 'continue') {
      userPrompt = `Lanjutkan adegan cerita berikut ini secara mulus sebanyak 2-3 paragraf baru:\n\n"${inputContext}"`;
    } else {
      userPrompt = `${customPrompt}\n\nKonteks naskah:\n"${inputContext}"`;
    }

    try {
      const genResult = await generateWithSmartFallback(userPrompt, systemPrompt, (event) => {
        setCurrentAttempts((prev) => [...prev, event]);
      });
      setResult(genResult);
    } catch (err: any) {
      setError(err?.message || 'Terjadi kesalahan saat memproses AI.');
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
        className="fixed inset-0 bg-slate-900/40 dark:bg-black/75 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Main Sheet Container */}
      <div className="relative w-full sm:max-w-2xl bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl z-10 max-h-[92vh] flex flex-col animate-in slide-in-from-bottom duration-250 safe-bottom">
        {/* Swipe Handle */}
        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700/80 rounded-full mx-auto mt-3 mb-1 sm:hidden flex-shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950/60 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 font-black shadow-md shadow-amber-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-1.5">
                <span>AI Writing Co-Pilot</span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                  Smart Adjust
                </span>
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Gemini & Groq Multi-Fallback Engine</p>
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
              onClick={onClose}
              className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sheet Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 no-scrollbar">
          {/* Quick Action Selector Pills */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5">
              Pilih Bantuan AI:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {quickActions.map((qa) => {
                const Icon = qa.icon;
                const isSelected = actionType === qa.id;
                return (
                  <button
                    key={qa.id}
                    type="button"
                    onClick={() => setActionType(qa.id)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition active:scale-95 text-left ${
                      isSelected
                        ? `${qa.color} shadow-sm font-bold`
                        : 'bg-slate-50 dark:bg-slate-950/70 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{qa.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Instruction Box if selected */}
          {actionType === 'custom' && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 block mb-1">
                Instruksi Khusus untuk AI:
              </label>
              <input
                type="text"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Misal: Buat adegan ini berakhir dengan plot twist tak terduga..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-400 shadow-sm"
              />
            </div>
          )}

          {/* Context Input Preview */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Teks Naskah yang Diproses:
              </label>
              <span className="text-[10px] text-slate-500">
                {inputContext.trim().split(/\s+/).filter(Boolean).length} kata
              </span>
            </div>
            <textarea
              rows={3}
              value={inputContext}
              onChange={(e) => setInputContext(e.target.value)}
              placeholder="Ketik atau tempel paragraf naskah yang ingin dipoles AI..."
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-amber-400 leading-relaxed resize-none shadow-sm"
            />
          </div>

          {/* Generate Button */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isLoading || (!inputContext.trim() && actionType !== 'continue')}
            className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 active:scale-95 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Zap className="w-4 h-4 animate-spin" />
                <span>Memproses dengan AI Multi-Fallback...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Jalankan Bantuan AI</span>
              </>
            )}
          </button>

          {/* Live Fallback Event Log */}
          {currentAttempts.length > 0 && (
            <div className="space-y-1 bg-slate-100 dark:bg-slate-950/80 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800/80 text-[11px]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                Jejak Eksekusi AI (Cascading Fallback Log):
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
                    {att.status === 'fallback' && `Gagal: ${att.error?.slice(0, 35)}... Beralih ➡️`}
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
              <button
                type="button"
                onClick={onOpenAISettings}
                className="mt-1 text-amber-700 dark:text-amber-400 underline font-semibold text-[11px]"
              >
                Buka Pengaturan AI untuk periksa API Key ➔
              </button>
            </div>
          )}

          {/* AI Result Card */}
          {result && (
            <div className="bg-slate-50 dark:bg-slate-950 border border-amber-300 dark:border-amber-500/30 rounded-2xl p-3.5 space-y-3 shadow-md animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 pb-2">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white">Hasil Kreasi AI</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-800 dark:text-amber-300 font-mono">
                    {result.provider.toUpperCase()} • {result.model}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleCopy}
                  className="p-1 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition"
                  title="Salin Hasil"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Generated Text */}
              <div className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed max-h-56 overflow-y-auto no-scrollbar font-serif italic p-1">
                {result.text}
              </div>

              {/* Apply Action Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800/60">
                <button
                  type="button"
                  onClick={() => {
                    onApplyResult(result.text, 'insert');
                    onClose();
                  }}
                  className="flex-1 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition active:scale-95 text-center shadow-sm"
                >
                  Sisipkan ke Naskah
                </button>

                {selectedText && (
                  <button
                    type="button"
                    onClick={() => {
                      onApplyResult(result.text, 'replace');
                      onClose();
                    }}
                    className="flex-1 py-2 px-3 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold text-xs transition active:scale-95 text-center shadow-sm"
                  >
                    Ganti Kalimat Asli
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
