import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  RotateCcw,
  Feather,
  Users,
  Scroll,
  Copy,
  Check,
  Sparkles,
  ArrowRight,
  Layers,
  Wand2,
  Loader2,
  CheckCircle2,
  FileText
} from 'lucide-react';
import { StoryChapter, WorldEntity, Book } from '../../../types';
import { db } from '../../../db';
import { generateWithSmartFallback } from '../../../services/aiService';

interface ChapterStoryPlotTabProps {
  chapter: StoryChapter;
  bookTitle: string;
  entities?: WorldEntity[];
  onUpdateChapter: (fields: Partial<StoryChapter>) => void;
  onNavigateToManuscript: () => void;
}

// Helper to determine the latest condition of an entity based on current chapter or earlier chapters
function getLatestEntityState(
  entity: WorldEntity,
  currentChapter: StoryChapter,
  earlierChapters: StoryChapter[]
): { condition: string; conditionDetails?: string; source: string } {
  // 1. Current chapter state
  if (currentChapter.chapterEntityStates?.[entity.id]?.condition) {
    const s = currentChapter.chapterEntityStates[entity.id];
    return {
      condition: s.condition || 'aktif',
      conditionDetails: s.conditionDetails,
      source: `Bab ${currentChapter.order} (Bab Ini)`,
    };
  }

  // 2. Search earlier chapters in descending order (order - 1, order - 2, ...)
  for (const prev of earlierChapters) {
    if (prev.chapterEntityStates?.[entity.id]?.condition) {
      const s = prev.chapterEntityStates[entity.id];
      return {
        condition: s.condition || 'aktif',
        conditionDetails: s.conditionDetails,
        source: `Bab ${prev.order}`,
      };
    }
  }

  // 3. Search entity chronology
  if (entity.chapterChronology) {
    const records = Object.values(entity.chapterChronology)
      .filter((r) => r.chapterOrder < currentChapter.order)
      .sort((a, b) => b.chapterOrder - a.chapterOrder);
    if (records.length > 0 && records[0].condition) {
      return {
        condition: records[0].condition,
        conditionDetails: records[0].conditionDetails,
        source: `Bab ${records[0].chapterOrder}`,
      };
    }
  }

  // 4. Default to entity base profile condition
  return {
    condition: entity.condition || 'aktif',
    conditionDetails: entity.conditionDetails,
    source: 'Profil Dasar',
  };
}

export const ChapterStoryPlotTab: React.FC<ChapterStoryPlotTabProps> = ({
  chapter,
  bookTitle,
  entities = [],
  onUpdateChapter,
  onNavigateToManuscript,
}) => {
  const [book, setBook] = useState<Book | null>(null);
  const [copiedItem, setCopiedItem] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [isSummarizingRecap, setIsSummarizingRecap] = useState(false);
  const [saveToast, setSaveToast] = useState(false);

  // 5 Structured Context Points
  const [storyPlotText, setStoryPlotText] = useState('');
  const [prevChapterText, setPrevChapterText] = useState('');
  const [chapterPlotText, setChapterPlotText] = useState(
    chapter.premise || chapter.rawDrafts?.[0]?.content || ''
  );
  const [charactersText, setCharactersText] = useState('');
  const [settingItemLoreText, setSettingItemLoreText] = useState('');

  useEffect(() => {
    let active = true;

    const loadAllContext = async () => {
      // 1. Fetch Book data
      const b = await db.books.get(chapter.bookId);
      if (!active) return;
      if (b) setBook(b);

      // Fetch all earlier chapters (sorted descending for condition lookup, ascending for story progression)
      const earlierAsc = await db.chapters
        .where('bookId')
        .equals(chapter.bookId)
        .filter((c) => c.order < chapter.order)
        .sortBy('order');

      const earlierDesc = [...earlierAsc].reverse();

      // --- POINT 1: Story Plot (Pure Synopsis + Compact Recap of Previous Chapters) ---
      let synopsisRaw = b?.synopsis?.trim() || '';
      if (earlierAsc.length > 0) {
        const recapBullets = earlierAsc
          .map((c) => {
            const sum = c.aiSummary || c.premise || c.notes || 'Selesai';
            return `- Bab ${c.order} (${c.title}): ${sum}`;
          })
          .join('\n');

        synopsisRaw += `\n\n[Perkembangan Cerita dari Bab-Bab Sebelumnya]:\n${recapBullets}`;
      }
      setStoryPlotText(synopsisRaw);

      // --- POINT 2: Previous Chapter (Immediately Preceding Chapter Continuity) ---
      if (earlierDesc.length > 0) {
        const prev = earlierDesc[0];
        const prevStr = `Bab ${prev.order}: ${prev.title}\nKejadian Terakhir & Titik Sambung:\n${prev.aiSummary || prev.premise || prev.notes || '(Belum ada catatan ringkasan)'}`;
        setPrevChapterText(prevStr);
      } else {
        setPrevChapterText('Bab 1 (Bab Pembuka: Tidak ada bab sebelumnya).');
      }

      // --- POINT 3: Plot / Coretan Bab Ini ---
      setChapterPlotText(chapter.premise || chapter.rawDrafts?.[0]?.content || '');

      // --- POINT 4: Characters (With Latest Conditions from this or previous chapter) ---
      const charEntities = entities.filter((e) => e.category === 'character');
      if (charEntities.length > 0) {
        const charsStr = charEntities
          .map((c) => {
            const state = getLatestEntityState(c, chapter, earlierDesc);
            let detail = `- ${c.name} (${c.shortDescription || 'Karakter'})\n`;
            detail += `  Kondisi Terkini: ${state.condition.toUpperCase()}${state.conditionDetails ? ` (${state.conditionDetails})` : ''} [Sumber: ${state.source}]\n`;
            detail += `  Sifat / Peran: ${c.detailedNotes ? c.detailedNotes.slice(0, 150) + '...' : '-'}`;
            return detail;
          })
          .join('\n\n');
        setCharactersText(charsStr);
      } else {
        setCharactersText('- Karakter utama dan pendukung yang relevan dengan adegan bab ini.');
      }

      // --- POINT 5: Setting, Items (Latest States), World Lore & Writing Style ---
      const locEntities = entities.filter((e) => e.category === 'location');
      const itemEntities = entities.filter((e) => e.category === 'item');
      const loreEntities = entities.filter((e) => e.category === 'lore');

      let combinedSettingLore = '=== LOKASI & SETTING TERKINI ===\n';
      if (locEntities.length > 0) {
        combinedSettingLore += locEntities
          .map((l) => {
            const state = getLatestEntityState(l, chapter, earlierDesc);
            return `- ${l.name}: ${l.shortDescription || 'Lokasi'} (Kondisi Terkini: ${state.condition}${state.conditionDetails ? ` - ${state.conditionDetails}` : ''})`;
          })
          .join('\n');
      } else {
        combinedSettingLore += '- Lokasi menyesuaikan adegan pada alur bab.\n';
      }

      combinedSettingLore += '\n\n=== ITEM & ARTEFAK TERKINI ===\n';
      if (itemEntities.length > 0) {
        combinedSettingLore += itemEntities
          .map((it) => {
            const state = getLatestEntityState(it, chapter, earlierDesc);
            return `- ${it.name}: ${it.shortDescription || 'Item'} (Status: ${state.condition}${state.conditionDetails ? ` - ${state.conditionDetails}` : ''})`;
          })
          .join('\n');
      } else {
        combinedSettingLore += '- Mengikuti barang/artefak yang dibawa karakter pada adegan.\n';
      }

      combinedSettingLore += '\n\n=== ATURAN DUNIA & LORE (WORLD RULES) ===\n';
      if (loreEntities.length > 0) {
        combinedSettingLore += loreEntities
          .map((lr) => `- ${lr.name}: ${lr.shortDescription || lr.detailedNotes || 'Hukum/mitologi'}`)
          .join('\n');
      } else {
        combinedSettingLore += '- Mengikuti hukum konsistensi dunia fiksi yang dibangun dalam novel.\n';
      }

      combinedSettingLore += '\n\n=== GAYA PENULISAN (WRITING STYLE) ===\n';
      combinedSettingLore +=
        'Sudut Pandang: Orang Ketiga Terbatas (Third Person Limited)\n' +
        'Gaya Sastra: Narasi deskriptif panca indera (aroma, pencahayaan, tekstur, suara latar), dialog berbobot penuh subteks alami, alur mengalir tanpa kalimat klise bertele-tele.';

      setSettingItemLoreText(combinedSettingLore);
    };

    loadAllContext();

    return () => {
      active = false;
    };
  }, [chapter.id, chapter.order, chapter.bookId]);

  // Handle live edit of Chapter Plot & auto-save to chapter premise in IndexedDB
  const handleChapterPlotChange = (val: string) => {
    setChapterPlotText(val);
    onUpdateChapter({
      premise: val,
      rawDrafts: [
        {
          id: 'plot_' + chapter.id,
          title: 'Story Plot',
          content: val,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
    });
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 1200);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedItem(id);
    setTimeout(() => setCopiedItem(null), 1800);
  };

  // Summarize multiple past chapter bullets into 1 coherent paragraph using AI
  const handleSummarizePastChapters = async () => {
    if (!book || chapter.order <= 1) return;

    setIsSummarizingRecap(true);
    try {
      const prompt = `Berikut adalah sinopsis buku dan catatan kejadian dari bab-bab yang telah lewat:\n\n${storyPlotText}\n\nInstruksi: Tulis rangkuman rekap kilas balik yang ringkas, padat (maksimal 2 paragraf pendek) mengenai perjalanan cerita sejauh ini hingga menjelang Bab ${chapter.order}. Tulis langsung narasinya.`;

      const res = await generateWithSmartFallback(
        prompt,
        'Anda adalah editor novel ahli yang merangkum rekap cerita sebelumnya secara padat dan menggugah.'
      );

      if (res.text) {
        const condensed = `${book.synopsis?.trim() || ''}\n\n[Rekap Perjalanan Cerita Hingga Bab Ini]:\n${res.text.trim()}`;
        setStoryPlotText(condensed);
      }
    } catch (err: any) {
      console.warn('Gagal merangkum rekap bab terdahulu:', err);
    } finally {
      setIsSummarizingRecap(false);
    }
  };

  // Compile entire Master Prompt combining the 5 points
  const getFullMasterPrompt = (): string => {
    return `Anda adalah novelis masterclass dan editor sastra tingkat tinggi.
Tugas Anda adalah mengembangkan Plot & Coretan Kasar Bab Ini menjadi bab novel sastra yang utuh, mendalam, dan mengalir dengan memperhatikan kesinambungan cerita, kondisi terkini para karakter, serta aturan dunia berikut:

==================================================
1. SINOPSIS & REKAP KESELURUHAN NOVEL
==================================================
${storyPlotText}

==================================================
2. KONTINUITAS DARI BAB SEBELUMNYA
==================================================
${prevChapterText}

==================================================
3. PLOT & CORETAN KASAR BAB INI (BAB ${chapter.order}: ${chapter.title})
==================================================
"""
${chapterPlotText.trim() || '(Penulis belum memasukkan plot bab, kembangkan adegan sesuai alur)'}
"""

==================================================
4. KARAKTER YANG TERLIBAT & STATUS KONDISI TERKINI
==================================================
${charactersText}

==================================================
5. SETTING, ITEM TERKINI, ATURAN DUNIA & GAYA PENULISAN
==================================================
${settingItemLoreText}

==================================================
INSTRUKSI PENULISAN:
- Kembangkan plot dan coretan di atas menjadi adegan novel sastra Bahasa Indonesia yang utuh.
- Terapkan teknik "Show, Don't Tell" (reaksi fisik, gestur emosi alami, tanpa klise).
- Patuhi kondisi terkini karakter, item yang dibawa, dan kesinambungan bab sebelumnya.
- Tulis langsung naskah bab tanpa kata pengantar atau catatan penutup.
==================================================`;
  };

  const handleCopyAll = () => {
    const full = getFullMasterPrompt();
    navigator.clipboard.writeText(full);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2200);
  };

  const points = [
    {
      id: 'story_plot',
      title: '1. Sinopsis & Rekap Cerita Sebelumnya',
      icon: BookOpen,
      color: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
      text: storyPlotText,
      setText: setStoryPlotText,
      desc: 'Sinopsis murni novel dan perkembangan dari bab-bab sebelumnya.',
      canAiSummarize: chapter.order > 2,
    },
    {
      id: 'prev_chapter',
      title: '2. Ringkasan Bab Sebelumnya (Titik Sambung)',
      icon: RotateCcw,
      color: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/30',
      text: prevChapterText,
      setText: setPrevChapterText,
      desc: 'Kejadian terakhir bab sebelumnya untuk kontinuitas langsung.',
      canAiSummarize: false,
    },
    {
      id: 'chapter_plot_draft',
      title: '3. Plot & Coretan Bab Ini (Bahan Utama)',
      icon: Feather,
      color: 'text-purple-500 bg-purple-500/10 border-purple-500/30',
      text: chapterPlotText,
      setText: handleChapterPlotChange,
      desc: 'Rencana alur, poin adegan, atau draft kasar yang ingin Anda tulis.',
      canAiSummarize: false,
    },
    {
      id: 'characters',
      title: '4. Karakter & Status Terkini (Adaptif per Bab)',
      icon: Users,
      color: 'text-rose-500 bg-rose-500/10 border-rose-500/30',
      text: charactersText,
      setText: setCharactersText,
      desc: 'Profil karakter beserta kondisi status terbaru dari bab lampau.',
      canAiSummarize: false,
    },
    {
      id: 'setting_item_lore',
      title: '5. Setting, Item Terkini, Aturan Dunia & Gaya Penulisan',
      icon: Scroll,
      color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30',
      text: settingItemLoreText,
      setText: setSettingItemLoreText,
      desc: 'Kondisi lokasi, item/relik aktif, hukum dunia fiksi, dan gaya penulisan.',
      canAiSummarize: false,
    },
  ];

  return (
    <div className="space-y-4 pb-28 max-w-3xl mx-auto animate-fade-in-up px-1 sm:px-2">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-2xl bg-amber-500/15 text-amber-500 font-bold">
              <Layers className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight">
                Story Plot &amp; Konteks AI
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Pusat perakitan bahan cerita &amp; prompt AI adaptif untuk Bab {chapter.order}
              </p>
            </div>
          </div>

          {saveToast && (
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold animate-pulse flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Tersimpan
            </span>
          )}
        </div>

        {/* Master Copy Banner */}
        <div className="p-3.5 bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-purple-500/10 border border-amber-500/25 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-700 dark:text-slate-300">
            <span className="font-extrabold text-amber-700 dark:text-amber-400 block mb-0.5">
              Siap Tempel ke AI Khusus (ChatGPT / Claude / Luar)
            </span>
            <span className="text-[11px]">
              Semua 5 bahan cerita telah disesuaikan otomatis dengan keadaan terkini dari bab-bab sebelumnya.
            </span>
          </div>

          <button
            type="button"
            onClick={handleCopyAll}
            className={`w-full sm:w-auto py-2.5 px-4 rounded-xl font-black text-xs transition active:scale-95 flex items-center justify-center gap-2 shadow-md flex-shrink-0 ${
              copiedAll
                ? 'bg-emerald-600 text-white'
                : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-amber-500/20'
            }`}
          >
            {copiedAll ? (
              <>
                <Check className="w-4 h-4" />
                <span>Semua Tersalin ke Clipboard!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Salin Semua Sekaligus</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 5 Context Point Cards */}
      <div className="space-y-3.5">
        <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
          Bahan Cerita Terstruktur (Salin Terpisah)
        </div>

        {points.map((pt) => {
          const Icon = pt.icon;
          const isThisCopied = copiedItem === pt.id;

          return (
            <div
              key={pt.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xs transition hover:border-slate-300 dark:hover:border-slate-700 space-y-3"
            >
              {/* Header */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`p-1.5 rounded-xl border text-xs ${pt.color}`}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                      {pt.title}
                    </h3>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                      {pt.desc}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {pt.canAiSummarize && (
                    <button
                      type="button"
                      onClick={handleSummarizePastChapters}
                      disabled={isSummarizingRecap}
                      className="py-1.5 px-2.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 text-[10px] font-bold transition flex items-center gap-1 active:scale-95 disabled:opacity-50"
                      title="Rangkum poin-poin bab terdahulu menjadi 1 paragraf padat via AI"
                    >
                      {isSummarizingRecap ? (
                        <Loader2 className="w-3 h-3 animate-spin text-indigo-500" />
                      ) : (
                        <Wand2 className="w-3 h-3 text-indigo-500" />
                      )}
                      <span><span className="hidden sm:inline">Rangkum </span>Kilas Balik</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => copyToClipboard(pt.text, pt.id)}
                    className={`py-1.5 px-2.5 sm:px-3 rounded-xl text-xs font-bold transition active:scale-95 flex items-center gap-1.5 ${
                      isThisCopied
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700/80'
                    }`}
                    title={`Salin poin ${pt.title}`}
                  >
                    {isThisCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Tersalin!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-amber-500" />
                        <span>Salin<span className="hidden sm:inline"> Poin Ini</span></span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Textarea */}
              <textarea
                rows={pt.id === 'chapter_plot_draft' ? 6 : 4}
                value={pt.text}
                onChange={(e) => pt.setText?.(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 transition leading-relaxed font-sans"
                placeholder={`Isi untuk ${pt.title}...`}
              />
            </div>
          );
        })}
      </div>

      {/* Bottom CTA to Manuscript */}
      <div className="pt-2">
        <button
          type="button"
          onClick={onNavigateToManuscript}
          className="w-full py-3.5 px-4 rounded-2xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs sm:text-sm shadow-md transition active:scale-95 flex items-center justify-center gap-2"
        >
          <span>Lanjut Menulis di Naskah Utama ✍️</span>
          <ArrowRight className="w-4 h-4 text-amber-400" />
        </button>
      </div>
    </div>
  );
};
