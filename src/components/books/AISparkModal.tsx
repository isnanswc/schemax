import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Zap,
  Lightbulb,
  Copy,
  Check,
  RotateCcw,
  Flame,
  Compass,
  ArrowRight,
  Plus
} from 'lucide-react';
import { generateWithSmartFallback } from '../../services/aiService';
import { Book } from '../../types';

interface AISparkModalProps {
  isOpen: boolean;
  onClose: () => void;
  books: Book[];
  onApplySparkAsChapter?: (bookId: string, premise: string) => void;
}

type SparkType = 'plot_twist' | 'character_hook' | 'world_anomaly' | 'opening_hook' | 'free';

export const AISparkModal: React.FC<AISparkModalProps> = ({
  isOpen,
  onClose,
  books,
  onApplySparkAsChapter,
}) => {
  const [sparkType, setSparkType] = useState<SparkType>('plot_twist');
  const [selectedBookId, setSelectedBookId] = useState<string>(books[0]?.id || '');
  const [topicInput, setTopicInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sparks, setSparks] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  const sparkPresets: { id: SparkType; label: string; icon: any; color: string; desc: string }[] = [
    {
      id: 'plot_twist',
      label: 'Plot Twist Tak Terduga',
      icon: Flame,
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
      desc: '3 kejutan alur yang membalikkan ekspektasi pembaca',
    },
    {
      id: 'character_hook',
      label: 'Karakter & Motif Unik',
      icon: Sparkles,
      color: 'text-pink-400 bg-pink-500/10 border-pink-500/30',
      desc: 'Protagonis/Antagonis dengan rahasia & kelemahan fatal',
    },
    {
      id: 'world_anomaly',
      label: 'Anomali Dunia / Misteri',
      icon: Compass,
      color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
      desc: 'Hukum alam aneh, relik terlarang, atau lokasi magis',
    },
    {
      id: 'opening_hook',
      label: 'Kalimat Pembuka Menusuk',
      icon: Zap,
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
      desc: '3 variasi kalimat pertama bab yang langsung memikat',
    },
    {
      id: 'free',
      label: 'Brainstorm Bebas',
      icon: Lightbulb,
      color: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
      desc: 'Tanya apa pun untuk memecahkan kebuntuan ide (writer\'s block)',
    },
  ];

  const selectedBook = books.find((b) => b.id === selectedBookId) || books[0];

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    setSparks([]);

    const systemPrompt = `Kamu adalah Konsultan Plot dan Ide Kreatif Fiksi (Story Architect).
Tugasmu: Berikan 3 ide yang orisinal, segar, tidak klise, dan memicu rasa ingin tahu tinggi dalam Bahasa Indonesia.
Konteks Cerita:
- Judul: "${selectedBook?.title || 'Fiksi Bebas'}"
- Genre: "${selectedBook?.genre || 'Umum'}"
- Sinopsis: "${selectedBook?.synopsis || ''}"

Format Respon:
Berikan tepat 3 ide bernomor (1, 2, 3), masing-masing 2-3 kalimat tajam tanpa kata pembuka atau basa-basi.`;

    let userPrompt = '';
    if (sparkType === 'plot_twist') {
      userPrompt = `Berikan 3 alternatif Plot Twist tak terduga yang berhubungan dengan: ${topicInput || 'klimaks cerita'}`;
    } else if (sparkType === 'character_hook') {
      userPrompt = `Rancang 3 konsep karakter unik dengan kontradiksi internal tajam tentang: ${topicInput || 'sosok sekutu yang mencurigakan'}`;
    } else if (sparkType === 'world_anomaly') {
      userPrompt = `Ciptakan 3 fenomena misterius atau relik purba terlarang tentang: ${topicInput || 'sistem waktu dan gravitasi'}`;
    } else if (sparkType === 'opening_hook') {
      userPrompt = `Tuliskan 3 alternatif hook kalimat pembuka adegan yang dramatis tentang: ${topicInput || 'suasana mencekam sesaat sebelum kekacauan'}`;
    } else {
      userPrompt = topicInput || 'Berikan 3 ide konflik segar untuk cerita ini.';
    }

    try {
      const result = await generateWithSmartFallback(userPrompt, systemPrompt);
      // Split into 3 ideas
      const rawText = result.text;
      const parts = rawText
        .split(/(?:^|\n)(?:[1-3]\.|\bIde [1-3]:|\bOpsi [1-3]:)\s*/i)
        .map((p) => p.trim())
        .filter((p) => p.length > 10);

      if (parts.length >= 2) {
        setSparks(parts.slice(0, 3));
      } else {
        setSparks([rawText]);
      }
    } catch (err: any) {
      setError(err?.message || 'Gagal menghasilkan ide.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 dark:bg-black/75 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative w-full sm:max-w-xl bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl z-10 max-h-[92vh] flex flex-col animate-in slide-in-from-bottom duration-250 safe-bottom">
        {/* Swipe Handle */}
        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700/80 rounded-full mx-auto mt-3 mb-1 sm:hidden flex-shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950/60 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 font-black shadow-md shadow-amber-500/20">
              <Lightbulb className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                Inkubator Ide & Plot Spark
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Pancingan ide kreatif instan bertenaga AI Multi-Fallback
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-slate-150 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 no-scrollbar">
          {/* Target Book Selector if multiple books exist */}
          {books.length > 1 && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                Konteks Buku:
              </label>
              <select
                value={selectedBookId}
                onChange={(e) => setSelectedBookId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-400 font-semibold"
              >
                {books.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title} ({b.genre || 'Fiksi'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Spark Type Grid */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5">
              Pilih Jenis Pancingan Ide:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {sparkPresets.map((preset) => {
                const Icon = preset.icon;
                const isSelected = sparkType === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setSparkType(preset.id)}
                    className={`flex items-center gap-2 p-2 rounded-xl border text-xs font-semibold transition active:scale-95 text-left ${
                      isSelected
                        ? `${preset.color} font-bold shadow-sm`
                        : 'bg-slate-50 dark:bg-slate-950/70 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{preset.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Specific Topic Input */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
              Fokus Topik / Kata Kunci (Opsional):
            </label>
            <input
              type="text"
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              placeholder="Misal: artefak jam kuno, pertarungan di jembatan kabut..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-amber-400"
            />
          </div>

          {/* Generate Button */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 active:scale-95 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Zap className="w-4 h-4 animate-spin" />
                <span>Menghasilkan 3 Pilihan Ide...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Pantik Ide Sekarang</span>
              </>
            )}
          </button>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-600 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Generated Ideas Cards */}
          {sparks.length > 0 && (
            <div className="space-y-2.5 pt-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 block">
                3 Alternatif Ide yang Dihasilkan:
              </span>
              {sparks.map((spark, idx) => (
                <div
                  key={idx}
                  className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/90 rounded-2xl p-3.5 space-y-2.5 transition hover:border-amber-500/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-800 dark:text-amber-300">
                      Opsi {idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(spark, idx)}
                      className="p-1 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition"
                      title="Salin Ide"
                    >
                      {copiedIndex === idx ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-serif italic">
                    "{spark}"
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
