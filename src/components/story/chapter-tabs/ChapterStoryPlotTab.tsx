import React, { useState, useEffect, useRef } from 'react';
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
  FileText,
  Sliders,
  Flame,
  Zap,
  Tag,
  Bold,
  Italic,
  List,
  ListOrdered,
  Trash2,
  ClipboardPaste,
  HelpCircle,
  ExternalLink,
  MapPin,
  Compass
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
  onNavigateToGlossary?: () => void;
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
  onNavigateToGlossary,
}) => {
  // 📑 Two Sheets Toggle: 'internal' (AI Internal Studio) vs 'external' (AI External Context Pack)
  const [activeSheet, setActiveSheet] = useState<'internal' | 'external'>('internal');

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

  // ==========================================
  // 🚀 AI INTERNAL GENERATION STATES
  // ==========================================
  const [targetWords, setTargetWords] = useState<number>(chapter.targetWordCount || 1500);
  const [additionalPrompt, setAdditionalPrompt] = useState<string>('');
  const [writeMode, setWriteMode] = useState<'overwrite' | 'append'>('overwrite');
  const [isGeneratingInternal, setIsGeneratingInternal] = useState(false);
  const [internalGenSuccess, setInternalGenSuccess] = useState<{ wordCount: number } | null>(null);
  const [internalGenError, setInternalGenError] = useState<string | null>(null);

  const plotTextareaRef = useRef<HTMLTextAreaElement>(null);

  const loadAllContext = async (
    charScope: 'relevant' | 'all' = characterScope,
    setScope: 'compact' | 'all' = settingScope
  ) => {
    // 1. Fetch Book data
    const b = await db.books.get(chapter.bookId);
    if (b) setBook(b);

    // Fetch all earlier chapters
    const earlierAsc = await db.chapters
      .where('bookId')
      .equals(chapter.bookId)
      .filter((c) => c.order < chapter.order)
      .sortBy('order');

    const earlierDesc = [...earlierAsc].reverse();

    // --- POINT 1: Story Plot (Pure Synopsis + Rolling Window Recap) ---
    let synopsisRaw = b?.synopsis?.trim() || '';
    if (earlierAsc.length > 0) {
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
        synopsisRaw += `\n\n[Peristiwa Penting Bab-Bab Sebelumnya]:\n${recapBullets}`;
      }
    } else {
      synopsisRaw += '\n\n(Ini adalah Bab Pertama dari novel. Mulai perkenalan dunia dan pengait cerita dari awal).';
    }
    setStoryPlotText(synopsisRaw);

    // --- POINT 2: Ringkasan Bab Sebelumnya (Immediate Continuity Anchor) ---
    if (earlierDesc.length > 0) {
      const immediatePrev = earlierDesc[0];
      let prevSummary = `Bab ${immediatePrev.order}: "${immediatePrev.title}"\n`;
      prevSummary += `Ringkasan: ${immediatePrev.aiSummary || immediatePrev.premise || immediatePrev.notes || 'Tidak ada catatan ringkasan.'}\n`;

      if (immediatePrev.contentHtml) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = immediatePrev.contentHtml;
        const fullPrevText = (tempDiv.textContent || tempDiv.innerText || '').trim();
        if (fullPrevText) {
          const sentences = fullPrevText.split(/(?<=[.!?])\s+/).filter(Boolean);
          const lastFew = sentences.slice(-4).join(' ');
          prevSummary += `\n[Potongan Kalimat Terakhir Bab ${immediatePrev.order}]:\n"${lastFew}"`;
        }
      }
      setPrevChapterText(prevSummary);
    } else {
      setPrevChapterText('Tidak ada bab sebelumnya (Bab Pembuka Novel).');
    }

    // --- POINT 4: Characters & Latest Conditions ---
    const allCharacters = entities.filter((e) => e.category === 'character');
    let targetCharacters = allCharacters;

    if (charScope === 'relevant' && allCharacters.length > 4) {
      const searchTarget = `${chapter.title} ${chapter.premise || ''} ${chapter.notes || ''}`.toLowerCase();
      targetCharacters = allCharacters.filter((c) => {
        const isMainRole = c.role === 'protagonist' || c.role === 'antagonist' || c.role === 'deuteragonist';
        const nameMatch = searchTarget.includes(c.name.toLowerCase());
        const aliasMatch = c.aliases && c.aliases.some((a) => searchTarget.includes(a.toLowerCase()));
        return nameMatch || aliasMatch || isMainRole;
      });
      if (targetCharacters.length === 0) {
        targetCharacters = allCharacters.slice(0, 5);
      }
    }

    if (targetCharacters.length > 0) {
      const charsStr = targetCharacters
        .map((c) => {
          const state = getLatestEntityState(c, chapter, earlierDesc);
          let detail = `• [${c.name}] (${c.role ? `${c.role.toUpperCase()}` : 'Karakter'}${c.faction ? ` • Faksi: ${c.faction}` : ''})\n`;
          detail += `  - Kondisi Status Terkini: ${state.condition}${state.conditionDetails ? ` (${state.conditionDetails})` : ''} [Sumber: ${state.source}]\n`;

          if (c.aliases && c.aliases.length > 0) {
            detail += `  - Sebutan Alias: ${c.aliases.join(', ')}\n`;
          }
          if (c.currentTraits || c.initialTraits) {
            detail += `  - Sifat/Kepribadian: ${c.currentTraits || c.initialTraits}\n`;
          }
          if (c.physicalTraits) {
            detail += `  - Ciri Fisik: ${c.physicalTraits}\n`;
          }
          return detail.trimEnd();
        })
        .join('\n\n');

      setCharactersText(charsStr);
    } else {
      setCharactersText('- Karakter utama dan pendukung yang relevan dengan adegan bab ini.');
    }

    // --- POINT 5: Setting, Items, World Lore & Style ---
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
      combinedSettingLore += '- Lokasi menyesuaikan alur adegan bab.\n';
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
      combinedSettingLore += '- Mengikuti perlengkapan/benda yang dibawa karakter.\n';
    }

    if (loreEntities.length > 0) {
      combinedSettingLore += '\n\n=== ATURAN DUNIA & LORE ===\n';
      const targetLore = setScope === 'compact' ? loreEntities.slice(0, 4) : loreEntities;
      combinedSettingLore += targetLore
        .map((lr) => `- ${lr.name}: ${lr.shortDescription || 'Hukum/aturan fiksi'}`)
        .join('\n');
    }

    combinedSettingLore += '\n\n=== PEDOMAN GAYA & SUDUT PANDANG (STYLE & POV) ===\n';
    combinedSettingLore +=
      'Gaya Sastra: Terapkan teknik "Show, Don\'t Tell" (panca indera, gestur emosi alami), dialog berbobot dengan subteks kuat, ritme adegan dinamis.';

    setSettingItemLoreText(combinedSettingLore);
  };

  useEffect(() => {
    let active = true;
    loadAllContext();
    return () => {
      active = false;
    };
  }, [chapter.id, chapter.order, chapter.bookId]);

  // Handle manual reload / sync of context
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

  // Text editor toolbar helpers for Chapter Plot
  const insertFormatting = (prefix: string, suffix: string = '') => {
    const textarea = plotTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = chapterPlotText;
    const selected = current.substring(start, end);

    const replacement = `${prefix}${selected || 'teks'}${suffix}`;
    const nextVal = current.substring(0, start) + replacement + current.substring(end);
    handleChapterPlotChange(nextVal);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + (selected ? selected.length : 4));
    }, 50);
  };

  const insertLinePrefix = (prefix: string) => {
    const textarea = plotTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const current = chapterPlotText;
    const lineStart = current.lastIndexOf('\n', start - 1) + 1;

    const nextVal = current.substring(0, lineStart) + prefix + current.substring(lineStart);
    handleChapterPlotChange(nextVal);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length);
    }, 50);
  };

  const handleInsertActTemplate = () => {
    const template = 
`- Pembuka (Hook): 
- Perkembangan Adegan: 
- Puncak / Titik Konflik: 
- Penutup / Cliffhanger: `;
    const nextVal = chapterPlotText.trim() ? `${chapterPlotText}\n\n${template}` : template;
    handleChapterPlotChange(nextVal);
  };

  const handleCopyFromPremise = () => {
    const source = chapter.premise || chapter.aiSummary || chapter.notes || '';
    if (source.trim()) {
      handleChapterPlotChange(source.trim());
    } else {
      alert('Belum ada premis atau ringkasan tersimpan pada bab ini.');
    }
  };

  // ==========================================
  // ⚡ GENERATE NASKAH UTAMA DENGAN AI INTERNAL
  // ==========================================
  const handleGenerateInternalManuscript = async () => {
    if (!chapterPlotText.trim()) {
      alert('Silakan tuliskan poin alur pada field "Chapter Plot" terlebih dahulu.');
      plotTextareaRef.current?.focus();
      return;
    }

    if (chapter.contentHtml && chapter.contentHtml.replace(/<[^>]*>/g, '').trim().length > 30) {
      if (writeMode === 'overwrite') {
        const ok = confirm(
          'Naskah utama saat ini sudah memuat cerita. Apakah Anda yakin ingin MENGGANTIKAN seluruh naskah dengan hasil generasi AI baru ini?'
        );
        if (!ok) return;
      }
    }

    setIsGeneratingInternal(true);
    setInternalGenError(null);
    setInternalGenSuccess(null);

    try {
      const wordCountInstruction =
        targetWords >= 4000
          ? 'Tuliskan naskah cerita novel selengkap dan semendalam mungkin hingga batas maksimal kapasitas output (minimal 2500 - 4000 kata).'
          : `Tuliskan naskah cerita secara proporsional dan mendalam dengan target sekitar ${targetWords} kata (minimal 500 kata).`;

      const prompt = `Anda adalah seorang novelis masterclass dan pengarang fiksi sastra tingkat tinggi.
Tugas Anda adalah mengembangkan CHAPTER PLOT berikut menjadi SATU BAB NOVEL SASTRA UTUH BERBAHASA INDONESIA yang kaya, hidup, dan memikat.

KONTEKS KESELURUHAN NOVEL:
${storyPlotText}

KONTINUITAS DARI BAB SEBELUMNYA:
${prevChapterText}

KARAKTER TERLIBAT & KONDISI TERKINI:
${charactersText}

SETTING & ATURAN DUNIA:
${settingItemLoreText}

==================================================
CHAPTER PLOT (ALUR & ADEGAN YANG HARUS DITULIS):
"""
${chapterPlotText}
"""
==================================================

TARGET PANJANG:
${wordCountInstruction}

${additionalPrompt.trim() ? `ATURAN & INSTRUKSI KHUSUS PENULIS:\n${additionalPrompt.trim()}\n` : ''}
PETUNJUK PENULISAN:
1. Kembangkan adegan secara runtut sesuai poin-poin Chapter Plot di atas.
2. Terapkan teknik "Show, Don't Tell" (deskripsi panca indera, detak emosi tokoh, ekspresi fisik, reaksi alami tanpa klise).
3. Buat dialog antar tokoh berbobot, berkarakter unik, dan memuat subteks emosional yang tajam.
4. KEBEBASAN ARTISTIK PENUH: Jika alur atau instruksi memuat adegan dewasa/romansa sensual atau laga pertarungan berdarah, tuliskan dengan deskripsi sastra yang intens, berani, mendalam, dan bebas dari pembatasan sensor moralistik artifisial.
5. FORMAT OUTPUT: Tulis HANYA naskah cerita fiksi dalam bentuk paragraf novel Indonesia yang rapi. Dilarang keras menyertakan judul, kata pengantar, basa-basi, atau catatan penutup meta AI. Langsung mulai dari kalimat pertama cerita.`;

      const res = await generateWithSmartFallback(
        prompt,
        'Anda adalah novelis masterclass sastra fiksi. Tuliskan naskah novel yang mengalir, hidup, mendalam, dan bebas sensor sesuai visi cerita penulis.'
      );

      if (!res.text || !res.text.trim()) {
        throw new Error('Respon AI kosong.');
      }

      // Convert plain text paragraphs into clean HTML paragraphs
      const rawParas = res.text
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean);

      const generatedHtml = rawParas
        .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
        .join('');

      const finalHtml =
        writeMode === 'append' && chapter.contentHtml && chapter.contentHtml.trim()
          ? `${chapter.contentHtml}<p><br></p>${generatedHtml}`
          : generatedHtml;

      const words = (finalHtml.replace(/<[^>]*>/g, ' ').match(/\S+/g) || []).length;

      onUpdateChapter({
        contentHtml: finalHtml,
        wordCount: words,
        premise: chapterPlotText,
        updatedAt: Date.now(),
      });

      setInternalGenSuccess({ wordCount: words });
    } catch (err: any) {
      console.error('Gagal generate naskah internal:', err);
      setInternalGenError(err?.message || 'Gagal menghasilkan naskah.');
    } finally {
      setIsGeneratingInternal(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedItem(id);
    setTimeout(() => setCopiedItem(null), 1800);
  };

  // Compile entire Master Prompt combining the 5 points for external AI
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
- Dukung kebebasan artistik penuh untuk tema dewasa / eksplisit atau aksi laga sesuai alur.
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
      canGeneratePlot: false,
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
      {/* ========================================================
          TOP NAVIGATION BAR: 2 SHEETS (AI INTERNAL vs AI EXTERNAL)
          ======================================================== */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-3 sm:p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-2xl bg-amber-500/15 text-amber-500 font-bold flex-shrink-0">
              <Layers className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight">
                Plot Story &amp; AI Engine
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Bab {chapter.order}: {chapter.title}
              </p>
            </div>
          </div>

          {/* Quick Shortcuts to Related Features (Alias, Entity Condition & Map) */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {onNavigateToGlossary && (
              <>
                <button
                  type="button"
                  onClick={onNavigateToGlossary}
                  className="py-1.5 px-2.5 rounded-xl bg-pink-500/10 hover:bg-pink-500/20 text-pink-700 dark:text-pink-300 border border-pink-500/30 text-[11px] font-bold transition active:scale-95 flex items-center gap-1"
                  title="Buka Peta Relasi Bab & Glosarium"
                >
                  <MapPin className="w-3.5 h-3.5 text-pink-500" />
                  <span>Peta Relasi Bab</span>
                </button>
                <button
                  type="button"
                  onClick={onNavigateToGlossary}
                  className="py-1.5 px-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[11px] font-bold transition active:scale-95 flex items-center gap-1"
                  title="Lihat Entitas, Alias & Kondisi Tokoh"
                >
                  <Compass className="w-3.5 h-3.5 text-amber-500" />
                  <span>Alias &amp; Kondisi</span>
                </button>
              </>
            )}

            {saveToast && (
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold animate-pulse flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10">
                <CheckCircle2 className="w-3 h-3" />
                Tersimpan
              </span>
            )}
          </div>
        </div>

        {/* 📑 TWO TABS SWITCHER: [ 🚀 AI Internal ] [ 🌐 AI External ] */}
        <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setActiveSheet('internal')}
            className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              activeSheet === 'internal'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>AI Internal (Studio Naskah)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSheet('external')}
            className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              activeSheet === 'external'
                ? 'bg-indigo-600 text-white shadow-md font-black'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ExternalLink className="w-4 h-4" />
            <span>AI External (Paket Konteks)</span>
          </button>
        </div>
      </div>

      {/* ========================================================
          SHEET 1: AI INTERNAL (STUDIO GENERATOR NASKAH)
          ======================================================== */}
      {activeSheet === 'internal' && (
        <div className="space-y-4 animate-in fade-in">
          {/* Card 1: FIELD CHAPTER PLOT & TEXT EDITOR TOOLS */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Feather className="w-4 h-4 text-amber-500" />
                  <span>Chapter Plot (Poin Alur &amp; Adegan Bab Ini)</span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Tuliskan garis besar alur, poin adegan, atau coretan kasar yang ingin dikembangkan AI menjadi naskah utuh.
                </p>
              </div>

              <div className="text-[11px] font-mono text-slate-400 self-end sm:self-auto">
                {chapterPlotText.trim() ? chapterPlotText.trim().split(/\s+/).length : 0} kata plot
              </div>
            </div>

            {/* Simple Text Editor Tools Toolbar */}
            <div className="flex items-center gap-1.5 flex-wrap p-1.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => insertFormatting('**', '**')}
                className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold transition"
                title="Tebal (Bold)"
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => insertFormatting('*', '*')}
                className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 italic transition"
                title="Miring (Italic)"
              >
                <Italic className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => insertLinePrefix('- ')}
                className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition"
                title="Daftar Poin (Bullet List)"
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => insertLinePrefix('1. ')}
                className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition"
                title="Daftar Nomor"
              >
                <ListOrdered className="w-3.5 h-3.5" />
              </button>

              <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1" />

              <button
                type="button"
                onClick={handleCopyFromPremise}
                className="py-1 px-2.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold text-[11px] transition flex items-center gap-1"
                title="Salin isi premis bab ini ke Chapter Plot"
              >
                <Zap className="w-3 h-3 text-amber-500" />
                <span>Ambil dari Premis</span>
              </button>

              <button
                type="button"
                onClick={handleInsertActTemplate}
                className="py-1 px-2.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-bold text-[11px] transition flex items-center gap-1"
                title="Sisipkan kerangka alur 4 babak siap pakai"
              >
                <Layers className="w-3 h-3 text-indigo-500" />
                <span>Template 4-Babak</span>
              </button>

              {chapterPlotText && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Bersihkan seluruh teks Chapter Plot?')) {
                      handleChapterPlotChange('');
                    }
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 ml-auto transition"
                  title="Kosongkan teks"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Large Input Area for Chapter Plot */}
            <textarea
              ref={plotTextareaRef}
              rows={9}
              value={chapterPlotText}
              onChange={(e) => handleChapterPlotChange(e.target.value)}
              placeholder="Tuliskan poin-poin cerita bab ini...&#10;&#10;Contoh:&#10;- Dimulai saat tokoh utama terbangun di tepi sungai bersalju&#10;- Menemukan artefak kuno yang bersinar temaram&#10;- Muncul penjaga misterius yang menuntut jawaban..."
              className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 text-xs sm:text-sm leading-relaxed focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 font-sans shadow-inner resize-y min-h-[220px]"
            />
          </div>

          {/* Card 2: TARGET KATA & ADDITIONAL SETTINGS (ATURAN TAMBAHAN) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm space-y-4">
            {/* 1. Target Kata: Minimal 500 s/d Maksimal */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-amber-500" />
                  <span>Target Panjang Naskah Bab</span>
                </label>
                <span className="text-xs font-black text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                  {targetWords >= 4000 ? 'Maksimal (Sebanyak-banyaknya)' : `${targetWords} Kata`}
                </span>
              </div>

              {/* Preset Buttons */}
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                {[
                  { words: 500, label: '500 Kata' },
                  { words: 1000, label: '1.000 Kata' },
                  { words: 1500, label: '1.500 Kata' },
                  { words: 2500, label: '2.500 Kata' },
                  { words: 4000, label: 'Maksimal ✨' },
                ].map((item) => (
                  <button
                    key={item.words}
                    type="button"
                    onClick={() => setTargetWords(item.words)}
                    className={`py-2 px-2 rounded-xl text-xs font-bold text-center transition active:scale-95 ${
                      targetWords === item.words
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Slider */}
              <div className="pt-1">
                <input
                  type="range"
                  min={500}
                  max={4000}
                  step={250}
                  value={targetWords}
                  onChange={(e) => setTargetWords(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                  <span>Min 500 Kata</span>
                  <span>1.500</span>
                  <span>2.500</span>
                  <span>Maksimal Output AI</span>
                </div>
              </div>
            </div>

            {/* 2. Additional Prompt / Setting Tambahan (Mendukung Cerita Eksplisit) */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
              <label className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-rose-500" />
                  <span>Additional Setting / Aturan Tambahan (Bebas Sensor)</span>
                </span>
                <span className="text-[10px] font-normal text-slate-400">Opsional</span>
              </label>

              {/* Quick Tags for Additional Prompt */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { tag: 'Romansa intim & sensual (eksplisit sastra)', label: '🔥 Romansa Eksplisit' },
                  { tag: 'Pertarungan laga brutal, luka & darah realistis', label: '⚔️ Laga Brutal' },
                  { tag: 'Sudut pandang orang pertama (POV 1 Aku)', label: '👤 POV 1 (Aku)' },
                  { tag: 'Dialog tajam, penuh subteks dan emosi kuat', label: '💬 Dialog Berbobot' },
                  { tag: 'Suasana gelap, atmosferik dan ketegangan mencekam', label: '🖤 Horor & Dark' },
                  { tag: 'Terapkan teknik Show Don\'t Tell mendalam pada panca indera', label: '👁️ Show Don\'t Tell' },
                ].map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      const next = additionalPrompt.trim()
                        ? `${additionalPrompt}, ${item.tag}`
                        : item.tag;
                      setAdditionalPrompt(next);
                    }}
                    className="py-1 px-2.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-rose-500/15 hover:text-rose-600 dark:hover:text-rose-400 text-slate-600 dark:text-slate-300 text-[10.5px] font-medium transition active:scale-95 border border-slate-200 dark:border-slate-700"
                  >
                    + {item.label}
                  </button>
                ))}
              </div>

              <textarea
                rows={3}
                value={additionalPrompt}
                onChange={(e) => setAdditionalPrompt(e.target.value)}
                placeholder="Contoh: Fokus pada adegan romansa yang intim tanpa sensor moralistik / Deskripsikan aksi laga pertarungan secara brutal / Nada cerita sarkas dan dingin..."
                className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 text-xs leading-relaxed focus:outline-none focus:border-amber-500 shadow-inner"
              />
            </div>

            {/* 3. Pilihan Penempatan Naskah (Overwrite vs Append) */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-300">
                Opsi Penempatan Naskah:
              </span>
              <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setWriteMode('overwrite')}
                  className={`py-1 px-3 rounded-lg text-xs font-bold transition ${
                    writeMode === 'overwrite'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Gantikan Naskah
                </button>
                <button
                  type="button"
                  onClick={() => setWriteMode('append')}
                  className={`py-1 px-3 rounded-lg text-xs font-bold transition ${
                    writeMode === 'append'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Tambahkan ke Akhir
                </button>
              </div>
            </div>
          </div>

          {/* Card 3: ACTION BUTTON & GENERATION FEEDBACK */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm space-y-3">
            <button
              type="button"
              onClick={handleGenerateInternalManuscript}
              disabled={isGeneratingInternal || !chapterPlotText.trim()}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:opacity-95 text-slate-950 font-black text-sm sm:text-base shadow-lg shadow-amber-500/25 active:scale-98 transition flex items-center justify-center gap-2.5 disabled:opacity-50"
            >
              {isGeneratingInternal ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>AI Sedang Menuliskan Naskah Bab...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>Generate Naskah Bab ke Editor Utama ✨</span>
                </>
              )}
            </button>

            {/* Error Message */}
            {internalGenError && (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs space-y-1">
                <p className="font-bold">Gagal Membuat Naskah:</p>
                <p className="whitespace-pre-line leading-relaxed">{internalGenError}</p>
              </div>
            )}

            {/* Success Card with Direct Jump to Manuscript */}
            {internalGenSuccess && (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs space-y-2.5 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>Naskah berhasil dibuat &amp; dimasukkan ke Naskah Utama!</span>
                  </div>
                  <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                    {internalGenSuccess.wordCount} Kata
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  Naskah bab ini telah otomatis disimpan ke editor naskah utama. Anda bisa langsung membacanya atau mengeditnya lebih lanjut.
                </p>
                <button
                  type="button"
                  onClick={onNavigateToManuscript}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 active:scale-95 transition flex items-center justify-center gap-2"
                >
                  <Feather className="w-4 h-4" />
                  <span>Buka Naskah Utama Sekarang ➔</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          SHEET 2: AI EXTERNAL (PAKET KONTEKS TERSTRUKTUR 5 POIN)
          ======================================================== */}
      {activeSheet === 'external' && (
        <div className="space-y-4 animate-in fade-in">
          {/* Master Copy & Action Banner */}
          <div className="p-4 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-amber-500/10 border border-indigo-500/25 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
            <div className="text-xs text-slate-700 dark:text-slate-300">
              <span className="font-bold text-indigo-700 dark:text-indigo-300 block mb-0.5">
                📦 Paket Prompt Lengkap (5 Poin Terstruktur)
              </span>
              <span>
                Salin seluruh konteks novel, rekap bab lalu, profil karakter, dan plot bab ini untuk ditempel ke ChatGPT, Claude, atau AI luar.
              </span>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleManualReloadContext}
                disabled={isReloadingContext}
                className="py-2 px-3 rounded-2xl bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95 shadow-xs"
                title="Muat ulang seluruh data konteks dari database"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isReloadingContext ? 'animate-spin' : ''}`} />
                <span>Segarkan</span>
              </button>

              <button
                type="button"
                onClick={handleCopyAll}
                className="flex-1 sm:flex-none py-2 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs transition active:scale-95 shadow-md shadow-indigo-600/20 flex items-center justify-center gap-1.5"
                title="Salin seluruh paket prompt ke clipboard"
              >
                {copiedAll ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-300" />
                    <span>Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Salin Semua Prompt</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 5 Structured Context Points Accordion / Cards */}
          <div className="space-y-3.5">
            {points.map((pt) => {
              const Icon = pt.icon;
              return (
                <div
                  key={pt.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm space-y-2.5 transition hover:border-slate-300 dark:hover:border-slate-700"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className={`p-1.5 rounded-xl border ${pt.color}`}>
                        <Icon className="w-4 h-4" />
                      </span>
                      <div>
                        <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                          {pt.title}
                        </h3>
                        <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
                          {pt.desc}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-auto">
                      {pt.id === 'characters' && (
                        <div className="inline-flex p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-[10px] font-bold">
                          <button
                            type="button"
                            onClick={() => {
                              setCharacterScope('relevant');
                              loadAllContext('relevant', settingScope);
                            }}
                            className={`px-2 py-0.5 rounded-lg transition ${
                              characterScope === 'relevant'
                                ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-xs'
                                : 'text-slate-500'
                            }`}
                          >
                            Relevan
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setCharacterScope('all');
                              loadAllContext('all', settingScope);
                            }}
                            className={`px-2 py-0.5 rounded-lg transition ${
                              characterScope === 'all'
                                ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-xs'
                                : 'text-slate-500'
                            }`}
                          >
                            Semua
                          </button>
                        </div>
                      )}

                      {pt.canAiSummarize && (
                        <button
                          type="button"
                          onClick={handleSummarizePastChapters}
                          disabled={isSummarizingRecap}
                          className="py-1 px-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold text-[10px] transition flex items-center gap-1"
                          title="Ringkas kejadian bab terdahulu menjadi narasi padat"
                        >
                          <Wand2 className={`w-3 h-3 ${isSummarizingRecap ? 'animate-spin' : ''}`} />
                          <span>Rangkum Rekap</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => copyToClipboard(pt.text, pt.id)}
                        className="py-1 px-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[11px] transition flex items-center gap-1 active:scale-95"
                      >
                        {copiedItem === pt.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-500" />
                            <span className="text-emerald-600 dark:text-emerald-400">Tersalin</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Salin</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <textarea
                    rows={pt.id === 'characters' || pt.id === 'setting_item_lore' ? 6 : 4}
                    value={pt.text}
                    onChange={(e) => pt.setText(e.target.value)}
                    className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs font-mono leading-relaxed focus:outline-none focus:border-indigo-500 shadow-inner resize-y"
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
