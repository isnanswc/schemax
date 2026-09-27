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
  const [isGeneratingPlot, setIsGeneratingPlot] = useState(false);
  const [isReloadingContext, setIsReloadingContext] = useState(false);
  const [saveToast, setSaveToast] = useState(false);

  // 5 Structured Context Points
  const [storyPlotText, setStoryPlotText] = useState('');
  const [prevChapterText, setPrevChapterText] = useState('');
  const [chapterPlotText, setChapterPlotText] = useState(
    chapter.premise || chapter.rawDrafts?.[0]?.content || ''
  );
  const [charactersText, setCharactersText] = useState('');
  const [settingItemLoreText, setSettingItemLoreText] = useState('');

  const [characterScope, setCharacterScope] = useState<'relevant' | 'all'>('relevant');
  const [settingScope, setSettingScope] = useState<'compact' | 'all'>('compact');

  const loadAllContext = async (
    charScope: 'relevant' | 'all' = characterScope,
    setScope: 'compact' | 'all' = settingScope
  ) => {
    // 1. Fetch Book data
    const b = await db.books.get(chapter.bookId);
    if (b) setBook(b);

    // Fetch all earlier chapters (sorted descending for condition lookup, ascending for story progression)
    const earlierAsc = await db.chapters
      .where('bookId')
      .equals(chapter.bookId)
      .filter((c) => c.order < chapter.order)
      .sortBy('order');

    const earlierDesc = [...earlierAsc].reverse();

    // --- POINT 1: Story Plot (Pure Synopsis + Rolling Window Recap for Token Efficiency) ---
    let synopsisRaw = b?.synopsis?.trim() || '';
    if (earlierAsc.length > 0) {
      // Token Optimization: If there are > 3 chapters, compress older chapters into a timeline arc
      // and provide full event bullets for the most recent 2-3 chapters.
      if (earlierAsc.length > 3) {
        const olderChapters = earlierAsc.slice(0, earlierAsc.length - 2);
        const recentChapters = earlierAsc.slice(earlierAsc.length - 2);

        const olderTimeline = olderChapters
          .map((c) => `Bab ${c.order}: ${(c.aiSummary || c.premise || c.title).slice(0, 75).replace(/\n+/g, ' ')}`)
          .join(' ➔ ');

        const recentRecap = recentChapters
          .map((c) => {
            const sum = c.aiSummary || c.premise || c.notes || 'Selesai';
            return `- Bab ${c.order} (${c.title}): ${sum}`;
          })
          .join('\n');

        synopsisRaw += `\n\n[Garis Besar Arka Cerita Terdahulu (Bab ${olderChapters[0].order}–${olderChapters[olderChapters.length - 1].order})]:\n${olderTimeline}\n\n[Peristiwa Penting Bab Terkini]:\n${recentRecap}`;
      } else {
        const recapBullets = earlierAsc
          .map((c) => {
            const sum = c.aiSummary || c.premise || c.notes || 'Selesai';
            return `- Bab ${c.order} (${c.title}): ${sum}`;
          })
          .join('\n');

        synopsisRaw += `\n\n[Perkembangan Cerita dari Bab-Bab Sebelumnya]:\n${recapBullets}`;
      }
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

    // --- POINT 4: Characters (Smart Relevance Scoping & Compact Personality Evolution) ---
    const charEntities = entities.filter((e) => e.category === 'character');
    if (charEntities.length > 0) {
      // Find keywords from current chapter premise/draft and previous chapter
      const searchTarget = `${chapter.title} ${chapter.premise || ''} ${chapter.notes || ''} ${chapter.rawDrafts?.[0]?.content || ''} ${earlierDesc[0]?.title || ''} ${earlierDesc[0]?.aiSummary || ''}`.toLowerCase();

      let targetChars = charEntities;
      if (charScope === 'relevant') {
        const relevantChars = charEntities.filter((c) => {
          const nameMatch = searchTarget.includes(c.name.toLowerCase());
          const aliasMatch = c.aliases && c.aliases.some((a) => searchTarget.includes(a.toLowerCase()));
          const isMainRole =
            c.tags?.some((t) => ['utama', 'protagonis', 'main', 'tokoh utama'].includes(t.toLowerCase())) ||
            c.attributes?.some(
              (a) =>
                a.label.toLowerCase() === 'peran' &&
                ['utama', 'protagonis', 'mc'].some((k) => a.value.toLowerCase().includes(k))
            );
          return nameMatch || aliasMatch || isMainRole;
        });

        // Use relevant characters if matched, otherwise fallback to top 4 characters
        targetChars = relevantChars.length > 0 ? relevantChars : charEntities.slice(0, 4);
      }

      const charsStr = targetChars
        .map((c) => {
          const state = getLatestEntityState(c, chapter, earlierDesc);
          let detail = `• ${c.name} (${c.shortDescription || 'Tokoh'}) [Status: ${state.condition.toUpperCase()}${state.conditionDetails ? ` - ${state.conditionDetails}` : ''}]\n`;
          detail += `  - Sifat Terkini: ${c.currentTraits || c.initialTraits || '-'}${c.evolutionSummary ? ` (Titik Balik: ${c.evolutionSummary})` : ''}\n`;
          if (c.physicalTraits) {
            detail += `  - Ciri Fisik: ${c.physicalTraits}\n`;
          }
          if (c.detailedNotes) {
            const compactNotes = c.detailedNotes.split('\n').filter(Boolean).slice(0, 2).map((l) => l.trim()).join('; ');
            if (compactNotes) {
              detail += `  - Profil Singkat: ${compactNotes}\n`;
            }
          }
          if (c.attributes && c.attributes.length > 0) {
            const extraAttrs = c.attributes
              .filter((a) => a.label !== 'Peran' && a.label !== 'Usia' && a.value.trim())
              .slice(0, 3)
              .map((a) => `${a.label}: ${a.value}`)
              .join(' | ');
            if (extraAttrs) {
              detail += `  - Atribut: ${extraAttrs}\n`;
            }
          }
          return detail.trimEnd();
        })
        .join('\n\n');

      setCharactersText(charsStr);
    } else {
      setCharactersText('- Karakter utama dan pendukung yang relevan dengan adegan bab ini.');
    }

    // --- POINT 5: Setting, Items (Latest States), World Lore & Writing Style (Token Compact) ---
    const locEntities = entities.filter((e) => e.category === 'location');
    const itemEntities = entities.filter((e) => e.category === 'item');
    const loreEntities = entities.filter((e) => e.category === 'lore');

    let combinedSettingLore = '=== LOKASI & SETTING TERKINI ===\n';
    if (locEntities.length > 0) {
      const targetLocs = setScope === 'compact' ? locEntities.slice(0, 5) : locEntities;
      combinedSettingLore += targetLocs
        .map((l) => {
          const state = getLatestEntityState(l, chapter, earlierDesc);
          return `- [Lokasi] ${l.name}: ${l.shortDescription || 'Latar'} (Kondisi: ${state.condition}${state.conditionDetails ? ` - ${state.conditionDetails}` : ''})`;
        })
        .join('\n');
    } else {
      combinedSettingLore += '- Lokasi menyesuaikan adegan pada alur bab.\n';
    }

    combinedSettingLore += '\n\n=== ITEM & ARTEFAK TERKINI ===\n';
    if (itemEntities.length > 0) {
      const targetItems = setScope === 'compact' ? itemEntities.slice(0, 5) : itemEntities;
      combinedSettingLore += targetItems
        .map((it) => {
          const state = getLatestEntityState(it, chapter, earlierDesc);
          return `- [Item] ${it.name}: ${it.shortDescription || 'Benda'} (Status: ${state.condition}${state.conditionDetails ? ` - ${state.conditionDetails}` : ''})`;
        })
        .join('\n');
    } else {
      combinedSettingLore += '- Mengikuti barang/artefak yang dibawa karakter pada adegan.\n';
    }

    combinedSettingLore += '\n\n=== ATURAN DUNIA & LORE (WORLD RULES) ===\n';
    if (loreEntities.length > 0) {
      const targetLore = setScope === 'compact' ? loreEntities.slice(0, 4) : loreEntities;
      combinedSettingLore += targetLore
        .map((lr) => `- ${lr.name}: ${lr.shortDescription || (lr.detailedNotes ? lr.detailedNotes.slice(0, 100) : 'Hukum/aturan fiksi')}`)
        .join('\n');
    } else {
      combinedSettingLore += '- Mengikuti hukum konsistensi dunia fiksi yang dibangun dalam novel.\n';
    }

    combinedSettingLore += '\n\n=== GAYA PENULISAN (WRITING STYLE) ===\n';
    combinedSettingLore +=
      'Sudut Pandang: Orang Ketiga Terbatas (Third Person Limited)\n' +
      'Gaya Sastra: Terapkan teknik "Show, Don\'t Tell" (panca indera, gestur emosi alami), dialog berbobot dengan subteks kuat, ritme adegan dinamis tanpa kalimat klise.';

    setSettingItemLoreText(combinedSettingLore);
  };

  useEffect(() => {
    let active = true;
    loadAllContext();
    return () => {
      active = false;
    };
  }, [chapter.id, chapter.order, chapter.bookId]);

  // Handle manual reload / sync of context if previous chapters or entities changed
  const handleManualReloadContext = async () => {
    setIsReloadingContext(true);
    try {
      await loadAllContext();
      setSaveToast(true);
      setTimeout(() => setSaveToast(false), 1500);
    } catch (err) {
      console.error('Gagal memuat ulang konteks:', err);
    } finally {
      setIsReloadingContext(false);
    }
  };

  // Handle intelligent generation of plot for this chapter
  const handleGeneratePlotFromContext = async () => {
    setIsGeneratingPlot(true);
    try {
      const prompt = `Anda adalah seorang novelis dan arsitek cerita ahli tingkat masterclass.
Tugas Anda: Rancang Alur Plot & Poin Coretan Kasar Adegan secara runtut dan spesifik untuk BAB ${chapter.order}: "${chapter.title}".

KONTEKS NOVEL KESELURUHAN:
${storyPlotText}

KONTINUITAS & TITIK SAMBUNG TERAKHIR DARI BAB SEBELUMNYA:
${prevChapterText}

KARAKTER TERLIBAT (STATUS KONDISI, CIRI FISIK & SIFAT TERKINI):
${charactersText}

SETTING, ITEM & ATURAN DUNIA:
${settingItemLoreText}

PANDUAN PERANCANGAN PLOT BAB INI:
1. Rancang 3 sampai 5 poin adegan berurutan yang mengalir logis dan menyambung erat dengan peristiwa terakhir di bab sebelumnya.
2. Setiap poin adegan harus memuat aksi konkret, interaksi dialog berbobot, reaksi emosional sesuai sifat terkini karakter, dan konflik atau kejutan yang timbul.
3. Pastikan fisik dan kondisi karakter (misal jika terluka, amnesia, atau membawa item tertentu) tercermin dalam adegan.
4. Berikan catatan ketegangan atau cliffhanger di penutup bab.
5. Tuliskan langsung dalam format poin-poin terstruktur yang siap dipakai penulis di workstation.`;

      const res = await generateWithSmartFallback(
        prompt,
        'Anda adalah perancang plot novel profesional yang menyusun alur adegan bab secara runtut, dramatis, dan sangat memperhatikan kesinambungan cerita.'
      );

      if (res.text) {
        handleChapterPlotChange(res.text.trim());
      }
    } catch (err: any) {
      alert('Gagal menghasilkan plot bab: ' + (err?.message || 'Terjadi kesalahan'));
    } finally {
      setIsGeneratingPlot(false);
    }
  };

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
      canGeneratePlot: true,
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
      canGeneratePlot: false,
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
      canGeneratePlot: false,
    },
  ];

  return (
    <div className="space-y-4 pb-28 max-w-4xl mx-auto animate-fade-in-up px-1 sm:px-2">
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

        {/* Master Copy & Action Banner */}
        <div className="p-3.5 bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-purple-500/10 border border-amber-500/25 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-700 dark:text-slate-300">
            <span className="font-extrabold text-amber-700 dark:text-amber-400 block mb-0.5">
              Siap Tempel ke AI Khusus (ChatGPT / Claude / Luar)
            </span>
            <span className="text-[11px]">
              Semua 5 bahan cerita diselaraskan dengan ciri fisik, sifat, &amp; keadaan terkini dari bab sebelumnya.
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full sm:w-auto">
            {/* Manual Sync Context button if story changed in previous chapters */}
            <button
              type="button"
              onClick={handleManualReloadContext}
              disabled={isReloadingContext}
              className="w-full sm:w-auto py-2 sm:py-2.5 px-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-amber-500 text-slate-700 dark:text-slate-200 text-xs font-bold transition active:scale-95 flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50 flex-shrink-0"
              title="Perbarui & sinkronkan ulang seluruh kontinuitas jika ada perubahan di bab sebelumnya"
            >
              <RotateCcw className={`w-3.5 h-3.5 text-cyan-500 ${isReloadingContext ? 'animate-spin' : ''}`} />
              <span>{isReloadingContext ? 'Menyinkronkan...' : 'Sinkronkan Ulang'}</span>
            </button>

            {/* Generate Plot AI Button */}
            <button
              type="button"
              onClick={handleGeneratePlotFromContext}
              disabled={isGeneratingPlot}
              className="w-full sm:w-auto py-2 sm:py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-bold text-xs shadow-md shadow-purple-500/20 transition flex items-center justify-center gap-1.5 disabled:opacity-50 flex-shrink-0"
              title="Generate Plot bab ini secara otomatis dari kontinuitas cerita"
            >
              {isGeneratingPlot ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              )}
              <span>{isGeneratingPlot ? 'Merancang...' : 'Generate Plot AI ✨'}</span>
            </button>

            <button
              type="button"
              onClick={handleCopyAll}
              className={`w-full sm:w-auto py-2 sm:py-2.5 px-3.5 rounded-xl font-black text-xs transition active:scale-95 flex items-center justify-center gap-2 shadow-md flex-shrink-0 ${
                copiedAll
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-amber-500/20'
              }`}
            >
              {copiedAll ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Semua Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Salin Semua</span>
                </>
              )}
            </button>
          </div>
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

                  {pt.canGeneratePlot && (
                    <button
                      type="button"
                      onClick={handleGeneratePlotFromContext}
                      disabled={isGeneratingPlot}
                      className="py-1.5 px-2.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/20 text-[10px] font-bold transition flex items-center gap-1 active:scale-95 disabled:opacity-50"
                      title="Generate alur plot adegan bab ini secara cerdas berdasarkan kontinuitas bab sebelumnya"
                    >
                      {isGeneratingPlot ? (
                        <Loader2 className="w-3 h-3 animate-spin text-purple-500" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                      )}
                      <span><span className="hidden sm:inline">Generate </span>Plot AI ✨</span>
                    </button>
                  )}

                  {pt.id === 'characters' && (
                    <button
                      type="button"
                      onClick={() => {
                        const next = characterScope === 'relevant' ? 'all' : 'relevant';
                        setCharacterScope(next);
                        loadAllContext(next, settingScope);
                      }}
                      className={`py-1.5 px-2.5 rounded-xl border text-[10px] font-bold transition flex items-center gap-1 active:scale-95 ${
                        characterScope === 'relevant'
                          ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                      title="Beralih antara hanya karakter relevan (hemat token) atau seluruh karakter buku"
                    >
                      <span>{characterScope === 'relevant' ? '⚡ Fokus Relevan' : '👥 Semua Tokoh'}</span>
                    </button>
                  )}

                  {pt.id === 'setting_item_lore' && (
                    <button
                      type="button"
                      onClick={() => {
                        const next = settingScope === 'compact' ? 'all' : 'compact';
                        setSettingScope(next);
                        loadAllContext(characterScope, next);
                      }}
                      className={`py-1.5 px-2.5 rounded-xl border text-[10px] font-bold transition flex items-center gap-1 active:scale-95 ${
                        settingScope === 'compact'
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                      title="Beralih antara lore ringkas padat (hemat token) atau seluruh daftar lore"
                    >
                      <span>{settingScope === 'compact' ? '⚡ Lore Ringkas' : '📜 Semua Lore'}</span>
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
                rows={
                  pt.id === 'chapter_plot_draft'
                    ? 12
                    : pt.id === 'characters'
                    ? 10
                    : pt.id === 'setting_item_lore' || pt.id === 'story_plot'
                    ? 8
                    : 5
                }
                value={pt.text}
                onChange={(e) => pt.setText?.(e.target.value)}
                className={`w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 transition leading-relaxed font-sans resize-y shadow-inner ${
                  pt.id === 'chapter_plot_draft'
                    ? 'min-h-[260px] sm:min-h-[320px]'
                    : pt.id === 'characters'
                    ? 'min-h-[220px] sm:min-h-[260px]'
                    : 'min-h-[140px] sm:min-h-[170px]'
                }`}
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
