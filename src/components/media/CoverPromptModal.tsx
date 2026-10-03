import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Copy,
  Check,
  RotateCw,
  UserCheck,
  Info,
  BookOpen,
  FileText,
  Upload,
  HardDrive,
} from 'lucide-react';
import {
  CoverPromptResult,
  generateBookCoverPrompt,
  generateChapterCoverPrompt,
  AIGenerationEvent,
} from '../../services/aiService';
import { WorldEntity } from '../../types';

interface CoverPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'book' | 'chapter';
  bookTitle: string;
  genre?: string;
  synopsis?: string;
  chapterTitle?: string;
  chapterOrder?: number;
  premise?: string;
  contentText?: string;
  entities?: WorldEntity[];
  onOpenLocalUpload?: () => void;
  onOpenGDrive?: () => void;
}

export const CoverPromptModal: React.FC<CoverPromptModalProps> = ({
  isOpen,
  onClose,
  type,
  bookTitle,
  genre,
  synopsis,
  chapterTitle,
  chapterOrder,
  premise,
  contentText,
  entities = [],
  onOpenLocalUpload,
  onOpenGDrive,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<CoverPromptResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [activeAiAttempt, setActiveAiAttempt] = useState<AIGenerationEvent | null>(null);
  const [aiStatusMessage, setAiStatusMessage] = useState('');

  const runGenerate = async () => {
    setIsLoading(true);
    setError(null);
    setActiveAiAttempt(null);
    setAiStatusMessage(
      type === 'book'
        ? 'Merancang konsep visual sampul buku (9:16)...'
        : 'Merancang konsep visual sampul bab (9:16)...'
    );

    const onEvent = (event: AIGenerationEvent) => {
      setActiveAiAttempt(event);
      if (event.status === 'attempt') {
        setAiStatusMessage(`Memproses via [${event.provider.toUpperCase()}] ${event.slotLabel}...`);
      } else if (event.status === 'fallback') {
        setAiStatusMessage(`⚠️ Mencoba fallback ke ${event.slotLabel}...`);
      } else if (event.status === 'success') {
        setAiStatusMessage(`Berhasil dibuat oleh ${event.slotLabel} (${event.latencyMs}ms)`);
      }
    };

    try {
      if (type === 'book') {
        const res = await generateBookCoverPrompt(
          {
            bookTitle,
            genre,
            synopsis,
            entities: entities.map((e) => ({
              name: e.name,
              category: e.category,
              shortDescription: e.shortDescription,
              initialTraits: e.initialTraits,
            })),
          },
          onEvent
        );
        setResult(res);
      } else {
        const res = await generateChapterCoverPrompt(
          {
            bookTitle,
            chapterTitle: chapterTitle || 'Bab Ini',
            chapterOrder,
            premise,
            contentText,
            entities: entities.map((e) => ({
              name: e.name,
              category: e.category,
              shortDescription: e.shortDescription,
              initialTraits: e.initialTraits,
            })),
          },
          onEvent
        );
        setResult(res);
      }
    } catch (err: any) {
      console.error('Gagal generate prompt cover:', err);
      setError(err?.message || 'Gagal menghasilkan prompt cover dari AI.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && !result && !isLoading) {
      runGenerate();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopyPrompt = () => {
    if (!result?.prompt) return;
    navigator.clipboard.writeText(result.prompt);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Helper to render prompt with highlighted [pria1], [wanita1], etc.
  const renderHighlightedPrompt = (text: string) => {
    const parts = text.split(/(\[(?:pria|wanita)\d*\])/gi);
    return parts.map((part, i) => {
      const lower = part.toLowerCase();
      if (lower.startsWith('[pria')) {
        return (
          <span
            key={i}
            className="px-1.5 py-0.5 mx-0.5 rounded-md bg-sky-500/20 text-sky-400 font-mono font-bold text-[11px] border border-sky-500/30"
          >
            {part}
          </span>
        );
      }
      if (lower.startsWith('[wanita')) {
        return (
          <span
            key={i}
            className="px-1.5 py-0.5 mx-0.5 rounded-md bg-rose-500/20 text-rose-400 font-mono font-bold text-[11px] border border-rose-500/30"
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-2xl bg-gradient-to-tr from-amber-500 to-pink-500 text-slate-950 flex-shrink-0 shadow-md">
              <Sparkles className="w-4 h-4 text-slate-950" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="text-sm font-black text-slate-900 dark:text-white truncate">
                  Prompt Cover AI
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800">
                  {type === 'book' ? 'Sampul Buku' : 'Sampul Bab'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {type === 'book'
                  ? bookTitle
                  : chapterTitle
                  ? `Bab ${chapterOrder || ''}: ${chapterTitle}`
                  : bookTitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* AI Status / Progress Bar */}
          {isLoading && (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-center space-y-2">
              <div className="flex items-center justify-center gap-2 text-amber-600 dark:text-amber-400">
                <RotateCw className="w-4 h-4 animate-spin" />
                <span className="text-xs font-bold">{aiStatusMessage}</span>
              </div>
              {activeAiAttempt && (
                <p className="text-[10px] text-slate-400">
                  Model: {activeAiAttempt.model} ({activeAiAttempt.provider})
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs">
              <p className="font-bold">Gagal menghasilkan prompt:</p>
              <p className="mt-1">{error}</p>
              <button
                type="button"
                onClick={runGenerate}
                className="mt-2.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs inline-flex items-center gap-1.5"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Coba Lagi</span>
              </button>
            </div>
          )}

          {result && !isLoading && (
            <>
              {/* 1. Character References List (WAJIB DILAMPIRKAN) */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                    <UserCheck className="w-4 h-4 text-emerald-500" />
                    <span>Karakter yang Perlu Dilampirkan</span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {result.characterReferences.length} Tokoh Terpilih
                  </span>
                </div>

                <div className="flex items-center flex-wrap gap-1.5 pt-1">
                  {result.characterReferences.length === 0 ? (
                    <span className="text-xs text-slate-400 italic">
                      Tidak ada tokoh spesifik yang wajib dilampirkan (bisa langsung generate).
                    </span>
                  ) : (
                    result.characterReferences.map((charName, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300/50 dark:border-emerald-800/50 text-xs font-bold shadow-xs"
                      >
                        <span>👤 {charName}</span>
                      </span>
                    ))
                  )}
                </div>

                <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed pt-1">
                  💡 <strong>Catatan Karakter:</strong> Model AI tidak mengubah wajah atau model pakaian asli karakter. Lampirkan foto referensi karakter saat generate di generator gambar (Midjourney / Stable Diffusion / DALL-E / Bing Image Creator).
                </p>
              </div>

              {/* 2. Visual Prompt Card */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <span>Prompt Visual (Aspect Ratio 9:16)</span>
                  </span>

                  <button
                    type="button"
                    onClick={handleCopyPrompt}
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-bold transition active:scale-95 shadow-xs ${
                      isCopied
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                    }`}
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Tersalin!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Salin Prompt</span>
                      </>
                    )}
                  </button>
                </div>

                <div
                  onClick={handleCopyPrompt}
                  className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-sans cursor-pointer hover:border-amber-400/60 transition group relative"
                  title="Klik untuk menyalin"
                >
                  <p>{renderHighlightedPrompt(result.prompt)}</p>
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/80 text-white text-[10px] px-2 py-0.5 rounded-md pointer-events-none">
                    Klik untuk salin
                  </div>
                </div>
              </div>

              {/* 3. Indonesian Explanation */}
              {result.explanation && (
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                    <Info className="w-3.5 h-3.5 text-cyan-500" />
                    <span>Penjelasan Konsep &amp; Mapping Karakter:</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {result.explanation}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 bg-slate-50/50 dark:bg-slate-950/50 flex-wrap">
          <button
            type="button"
            onClick={runGenerate}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition active:scale-95 disabled:opacity-50"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Buat Ulang</span>
          </button>

          <div className="flex items-center gap-2 ml-auto">
            {onOpenLocalUpload && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenLocalUpload();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-bold border border-amber-300/40 dark:border-amber-700/40 transition active:scale-95"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Hasil</span>
              </button>
            )}

            {onOpenGDrive && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenGDrive();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-400 text-xs font-bold border border-blue-300/40 dark:border-blue-700/40 transition active:scale-95"
              >
                <HardDrive className="w-3.5 h-3.5" />
                <span>Dari GDrive</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition active:scale-95"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
