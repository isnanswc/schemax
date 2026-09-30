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
  Compass,
  History,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Plus
} from 'lucide-react';
import { StoryChapter, WorldEntity, Book } from '../../../types';
import { db } from '../../../db';
import { generateWithSmartFallback } from '../../../services/aiService';

interface ChapterStoryPlotTabProps {
  chapter: StoryChapter;
  bookTitle: string;
  entities?: WorldEntity[];
  onUpdateChapter: (fields: Partial<StoryChapter>) => void | Promise<void>;
  onNavigateToManuscript: () => void;
  onNavigateToGlossary?: () => void;
}

// Helper to determine the condition and traits of an entity based strictly on previous chapter history (up to chapter.order - 1)
function getLatestEntityState(
  entity: WorldEntity,
  currentChapter: StoryChapter,
  earlierChaptersDesc: StoryChapter[]
): { condition: string; conditionDetails?: string; source: string; traits?: string; description?: string } {
  // 1. Check if current chapter already has an explicitly defined state
  if (currentChapter.chapterEntityStates?.[entity.id]?.condition) {
    const s = currentChapter.chapterEntityStates[entity.id];
    return {
      condition: s.condition || 'aktif',
      conditionDetails: s.conditionDetails,
      source: `Bab ${currentChapter.order} (Bab Ini)`,
      traits: entity.currentTraits || entity.initialTraits,
      description: entity.currentDescription || entity.shortDescription,
    };
  }

  // 2. Search earlier chapters in descending order (Bab n-1, Bab n-2, ... Bab 1)
  // This ensures Bab 3 reads Bab 2's condition, not future Bab 6 or global future updates!
  for (const prev of earlierChaptersDesc) {
    if (prev.chapterEntityStates?.[entity.id]?.condition) {
      const s = prev.chapterEntityStates[entity.id];
      return {
        condition: s.condition || 'aktif',
        conditionDetails: s.conditionDetails,
        source: `Bab ${prev.order}`,
        traits: entity.currentTraits || entity.initialTraits,
        description: entity.currentDescription || entity.shortDescription,
      };
    }
  }

  // 3. Search entity chapterChronology records for chapters strictly before this chapter
  if (entity.chapterChronology) {
    const records = Object.values(entity.chapterChronology)
      .filter((r) => r.chapterOrder < currentChapter.order)
      .sort((a, b) => b.chapterOrder - a.chapterOrder);
    if (records.length > 0 && records[0].condition) {
      return {
        condition: records[0].condition,
        conditionDetails: records[0].conditionDetails,
        source: `Bab ${records[0].chapterOrder}`,
        traits: entity.currentTraits || entity.initialTraits,
        description: entity.currentDescription || entity.shortDescription,
      };
    }
  }

  // 4. Fallback to Initial Entity State (never forward/future condition!)
  // If chapter is Bab 1 or no earlier record exists, use initial profile
  return {
    condition: (entity as any).initialCondition || entity.condition || 'aktif',
    conditionDetails: (entity as any).initialConditionDetails || entity.conditionDetails,
    source: 'Kondisi Awal Novel',
    traits: entity.initialTraits || entity.currentTraits,
    description: entity.initialDescription || entity.shortDescription || entity.currentDescription,
  };
}

// Helper to strip HTML tags to pure text while converting paragraphs to clean newlines
function stripHtmlToCleanText(html: string): string {
  if (!html) return '';
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  // Replace AI session tags with readable text markers
  const sessionTags = tempDiv.querySelectorAll('.schemax-ai-session-tag, .schemax-ai-session-divider');
  sessionTags.forEach((tag) => {
    const text = tag.textContent?.trim() || 'Batas Sesi AI';
    tag.replaceWith(document.createTextNode(`\n\n--- [${text}] ---\n\n`));
  });

  return (tempDiv.textContent || tempDiv.innerText || '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export const ChapterStoryPlotTab: React.FC<ChapterStoryPlotTabProps> = ({
  chapter,
  bookTitle,
  entities = [],
  onUpdateChapter,
  onNavigateToManuscript,
  onNavigateToGlossary,
}) => {
  // 📑 Three Sheets Toggle: 'internal' (AI Internal Studio) vs 'toolsaday' (AI Toolsaday Bridge) vs 'external' (AI External Context Pack)
  const [activeSheet, setActiveSheet] = useState<'internal' | 'toolsaday' | 'external'>('internal');

  const [book, setBook] = useState<Book | null>(null);
  const [earlierChaptersList, setEarlierChaptersList] = useState<StoryChapter[]>([]);
  const [copiedItem, setCopiedItem] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [isSummarizingRecap, setIsSummarizingRecap] = useState(false);
  const [isReloadingContext, setIsReloadingContext] = useState(false);
  const [saveToast, setSaveToast] = useState(false);

  // 5 Structured Context Points
  const [storyPlotText, setStoryPlotText] = useState('');
  const [prevChapterText, setPrevChapterText] = useState('');
  // Chapter Plot & Coretan Bab is INDEPENDENT from Premis / Ringkasan Isi Bab!
  const [chapterPlotText, setChapterPlotText] = useState(
    chapter.rawDrafts?.find((d) => d.id === 'plot_' + chapter.id || d.title === 'Story Plot')?.content ||
      chapter.rawDrafts?.[0]?.content ||
      ''
  );
  const [charactersText, setCharactersText] = useState('');
  const [settingItemLoreText, setSettingItemLoreText] = useState('');
  const [proseStyleSample, setProseStyleSample] = useState('');

  const [characterScope, setCharacterScope] = useState<'relevant' | 'all'>('relevant');
  const [settingScope, setSettingScope] = useState<'compact' | 'all'>('compact');

  // ==========================================
  // 🚀 AI INTERNAL GENERATION STATES
  // ==========================================
  const [targetWords, setTargetWords] = useState<number>(chapter.targetWordCount || 1500);
  const [additionalPrompt, setAdditionalPrompt] = useState<string>('');

  // Default to append if there is existing content in manuscript, otherwise overwrite
  const hasExistingText = Boolean(
    chapter.contentHtml && stripHtmlToCleanText(chapter.contentHtml).length > 25
  );

  const [writeMode, setWriteMode] = useState<'overwrite' | 'append'>(
    hasExistingText ? 'append' : 'overwrite'
  );

  const [isGeneratingInternal, setIsGeneratingInternal] = useState(false);
  const [internalGenSuccess, setInternalGenSuccess] = useState<{ wordCount: number; sessionNum: number } | null>(null);
  const [internalGenError, setInternalGenError] = useState<string | null>(null);

  // Toolsaday Bridge States
  const [toolsadayPastedText, setToolsadayPastedText] = useState('');
  const [toolsadayImportSuccess, setToolsadayImportSuccess] = useState<{ wordCount: number; sessionNum: number } | null>(null);
  const [copiedToolsadayPrompt, setCopiedToolsadayPrompt] = useState(false);

  // Synchronize state when switching chapter
  useEffect(() => {
    const newPlot =
      chapter.rawDrafts?.find((d) => d.id === 'plot_' + chapter.id || d.title === 'Story Plot')?.content ||
      chapter.rawDrafts?.[0]?.content ||
      '';
    setChapterPlotText(newPlot);
    setTargetWords(chapter.targetWordCount || 1500);
    setAdditionalPrompt('');
    setIsGeneratingInternal(false);
    setInternalGenSuccess(null);
    setInternalGenError(null);
    setToolsadayPastedText('');
    setToolsadayImportSuccess(null);
    setCopiedToolsadayPrompt(false);
    setSaveToast(false);
  }, [chapter.id]);

  const plotTextareaRef = useRef<HTMLTextAreaElement>(null);

  // ==========================================
  // 📚 LOAD ENTIRE NOVEL CONTEXT (ALL CHAPTERS & FULL GLOSSARY)
  // ==========================================
  const loadAllContext = async (
    charScope: 'relevant' | 'all' = characterScope,
    setScope: 'compact' | 'all' = settingScope
  ) => {
    // 1. Fetch Book data
    const b = await db.books.get(chapter.bookId);
    if (b) setBook(b);

    // 2. Fetch ALL earlier chapters in ascending order (Ch 1, 2, ..., N-1)
    const earlierAsc = await db.chapters
      .where('bookId')
      .equals(chapter.bookId)
      .filter((c) => c.order < chapter.order)
      .sortBy('order');

    setEarlierChaptersList(earlierAsc);
    const earlierDesc = [...earlierAsc].reverse();

    // --- POINT 1: Comprehensive Chronological Context of ALL Past Chapters ---
    let synopsisRaw = b?.synopsis?.trim() || '';
    if (earlierAsc.length > 0) {
      const fullTimeline = earlierAsc
        .map((c) => {
          const sum = c.aiSummary || c.premise || c.notes || 'Selesai';
          return `• Bab ${c.order} ("${c.title}"):\n  ${sum.replace(/\n+/g, ' ')}`;
        })
        .join('\n\n');

      synopsisRaw += `\n\n[KRONOLOGI PERISTIWA SELURUH BAB SEBELUMNYA (BAB 1 S/D ${earlierAsc[earlierAsc.length - 1].order})]:\n${fullTimeline}`;
    } else {
      synopsisRaw += '\n\n(Ini adalah Bab Pertama dari novel. Memulai perkenalan dunia, tokoh utama, dan pemicu konflik dari awal).';
    }
    setStoryPlotText(synopsisRaw);

    // --- POINT 2: Ringkasan Bab Sebelumnya & Potongan Kalimat Terakhir (Titik Sambung) ---
    if (earlierDesc.length > 0) {
      const immediatePrev = earlierDesc[0];
      let prevSummary = `Bab ${immediatePrev.order}: "${immediatePrev.title}"\n`;
      prevSummary += `Rangkuman Kejadian: ${immediatePrev.aiSummary || immediatePrev.premise || immediatePrev.notes || 'Tidak ada catatan ringkasan.'}\n`;

      if (immediatePrev.contentHtml) {
        const cleanPrev = stripHtmlToCleanText(immediatePrev.contentHtml);
        if (cleanPrev) {
          const sentences = cleanPrev.split(/(?<=[.!?])\s+/).filter(Boolean);
          const lastFew = sentences.slice(-5).join(' ');
          prevSummary += `\n[Potongan Adegan Terakhir Bab ${immediatePrev.order}]:\n"${lastFew}"`;

          // Sample prose style from immediate previous chapter for style consistency
          const styleExtract = sentences.slice(0, 8).join(' ');
          setProseStyleSample(styleExtract);
        }
      }
      setPrevChapterText(prevSummary);
    } else {
      setPrevChapterText('Tidak ada bab sebelumnya (Bab Pembuka Novel).');
      if (b?.synopsis) {
        setProseStyleSample(b.synopsis.slice(0, 300));
      }
    }

    // --- POINT 4: GLOSARIUM LENGKAP SEMUA KARAKTER & KONDISI STATUS TERKINI ---
    const allCharacters = entities.filter((e) => e.category === 'character');
    let targetCharacters = allCharacters;

    if (charScope === 'relevant' && allCharacters.length > 6) {
      const searchTarget = `${chapter.title} ${chapter.premise || ''} ${chapter.notes || ''} ${chapterPlotText}`.toLowerCase();
      targetCharacters = allCharacters.filter((c) => {
        const isMainRole = c.role === 'protagonist' || c.role === 'antagonist' || c.role === 'deuteragonist';
        const nameMatch = searchTarget.includes(c.name.toLowerCase());
        const aliasMatch = c.aliases && c.aliases.some((a) => searchTarget.includes(a.toLowerCase()));
        return nameMatch || aliasMatch || isMainRole;
      });
      if (targetCharacters.length === 0) {
        targetCharacters = allCharacters.slice(0, 6);
      }
    }

    if (targetCharacters.length > 0) {
      const charsStr = targetCharacters
        .map((c) => {
          const state = getLatestEntityState(c, chapter, earlierDesc);
          const roleLabel = c.role ? c.role.toUpperCase() : 'KARAKTER';
          let line = `• [${c.name}] (${roleLabel})\n`;
          line += `  - Kondisi: ${state.condition}${state.conditionDetails ? ` (${state.conditionDetails})` : ''}\n`;
          if (c.aliases && c.aliases.length > 0) {
            line += `  - Alias: ${c.aliases.join(', ')}\n`;
          }
          const desc = state.description || c.shortDescription || c.detailedNotes;
          if (desc) {
            const cleanDesc = desc.replace(/\n+/g, ' ').trim();
            line += `  - Deskripsi: ${cleanDesc}\n`;
          }
          const traits = state.traits || c.currentTraits || c.initialTraits;
          if (traits) {
            line += `  - Sifat/Peran: ${traits}\n`;
          }
          return line.trimEnd();
        })
        .join('\n\n');

      setCharactersText(charsStr);
    } else {
      setCharactersText('- Karakter utama dan pendukung yang relevan dengan adegan bab ini.');
    }

    // --- POINT 5: GLOSARIUM LENGKAP LOKASI, ITEM, FAKSI & ATURAN DUNIA ---
    const locEntities = entities.filter((e) => e.category === 'location');
    const itemEntities = entities.filter((e) => e.category === 'item');
    const factionEntities = entities.filter((e) => e.category === 'faction');
    const loreEntities = entities.filter((e) => e.category === 'lore');

    let combinedSettingLore = '=== GLOSARIUM LOKASI & LATAR ===\n';
    if (locEntities.length > 0) {
      combinedSettingLore += locEntities
        .map((l) => {
          const state = getLatestEntityState(l, chapter, earlierDesc);
          return `- [Lokasi] ${l.name}${l.aliases && l.aliases.length > 0 ? ` (Alias: ${l.aliases.join(', ')})` : ''}: ${l.shortDescription || 'Latar'} (Kondisi: ${state.condition}${state.conditionDetails ? ` - ${state.conditionDetails}` : ''})`;
        })
        .join('\n');
    } else {
      combinedSettingLore += '- Lokasi menyesuaikan alur adegan bab.\n';
    }

    combinedSettingLore += '\n\n=== GLOSARIUM ITEM, SENJATA & PUSAKA ===\n';
    if (itemEntities.length > 0) {
      combinedSettingLore += itemEntities
        .map((it) => {
          const state = getLatestEntityState(it, chapter, earlierDesc);
          return `- [Item/Pusaka] ${it.name}${it.aliases && it.aliases.length > 0 ? ` (Alias: ${it.aliases.join(', ')})` : ''}: ${it.shortDescription || 'Benda'} (Status: ${state.condition}${state.conditionDetails ? ` - ${state.conditionDetails}` : ''})`;
        })
        .join('\n');
    } else {
      combinedSettingLore += '- Mengikuti perlengkapan/benda yang dibawa karakter.\n';
    }

    if (factionEntities.length > 0) {
      combinedSettingLore += '\n\n=== GLOSARIUM FAKSI & KLAN ===\n';
      combinedSettingLore += factionEntities
        .map((f) => `- [Faksi] ${f.name}: ${f.shortDescription || (f.detailedNotes ? f.detailedNotes.slice(0, 120) : 'Kelompok/Faksi')}`)
        .join('\n');
    }

    if (loreEntities.length > 0) {
      combinedSettingLore += '\n\n=== HUKUM DUNIA, SISTEM KEKUATAN & LORE ===\n';
      combinedSettingLore += loreEntities
        .map((lr) => `- [Lore/Hukum] ${lr.name}: ${lr.shortDescription || (lr.detailedNotes ? lr.detailedNotes.slice(0, 150) : 'Aturan dunia fiksi')}`)
        .join('\n');
    }

    combinedSettingLore += '\n\n=== PEDOMAN GAYA & KONSISTENSI SASTRA ===\n';
    combinedSettingLore +=
      'Gaya Penulisan: Narasi mendalam, panca indera hidup (Show Don\'t Tell), dialog berbobot dengan subteks tajam, ritme cerita dinamis dan selaras dengan bab-bab sebelumnya.';

    setSettingItemLoreText(combinedSettingLore);
  };

  useEffect(() => {
    let active = true;
    loadAllContext();
    return () => {
      active = false;
    };
  }, [chapter.id, chapter.order, chapter.bookId, chapterPlotText]);

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

  // Handle live edit of Chapter Plot & auto-save to dedicated rawDrafts in IndexedDB (INDEPENDENT from Premis)
  const handleChapterPlotChange = (val: string) => {
    setChapterPlotText(val);
    const existingDrafts = chapter.rawDrafts || [];
    const otherDrafts = existingDrafts.filter((d) => d.id !== 'plot_' + chapter.id && d.title !== 'Story Plot');
    const updatedDrafts = [
      {
        id: 'plot_' + chapter.id,
        title: 'Story Plot',
        content: val,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      ...otherDrafts,
    ];

    onUpdateChapter({
      rawDrafts: updatedDrafts,
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
  // (Full Glossary + Full Past Context + Existing Text Continuity + Style Consistency + Session Divider)
  // ==========================================
  const handleGenerateInternalManuscript = async () => {
    if (!chapterPlotText.trim()) {
      alert('Silakan tuliskan poin alur pada field "Chapter Plot" terlebih dahulu.');
      plotTextareaRef.current?.focus();
      return;
    }

    const currentCleanText = stripHtmlToCleanText(chapter.contentHtml || '');
    const hasExistingManuscript = currentCleanText.length > 25;

    if (hasExistingManuscript && writeMode === 'overwrite') {
      const ok = confirm(
        'Naskah utama saat ini sudah memuat cerita. Apakah Anda yakin ingin MENGGANTIKAN seluruh naskah dengan hasil generasi AI baru ini?'
      );
      if (!ok) return;
    }

    setIsGeneratingInternal(true);
    setInternalGenError(null);
    setInternalGenSuccess(null);

    try {
      const wordCountInstruction =
        targetWords >= 4000
          ? 'Tuliskan naskah cerita novel selengkap dan semendalam mungkin hingga batas maksimal kapasitas output model AI (minimal 2.500 - 4.000 kata).'
          : `Tuliskan naskah cerita secara proporsional dan mendalam dengan target sekitar ${targetWords} kata (minimal 500 kata).`;

      // Calculate Session Number for Divider Tagging
      const existingSessionsMatch = (chapter.contentHtml || '').match(/schemax-ai-session/gi);
      const nextSessionNumber = (existingSessionsMatch ? existingSessionsMatch.length : 0) + 1;

      // Existing story text prompt section if appending
      let existingManuscriptSection = '';
      if (writeMode === 'append' && hasExistingManuscript) {
        existingManuscriptSection = `
==================================================
NASKAH YANG SAAT INI SUDAH TERTULIS DI BAB INI (BAB ${chapter.order}):
==================================================
"""
${currentCleanText}
"""

[PETUNJUK KELANJUTAN CERITA SANGAT PENTING]:
- Naskah di atas adalah teks yang SUDAH ADA di bab ini.
- Tugas Anda adalah MENERUSKAN CERITA SECARA MULUS LANGSUNG DARI TITIK TERAKHIR NASKAH DI ATAS.
- DILARANG KERAS mengulang kembali adegan, dialog, atau kalimat yang sudah tertulis di atas.
- Mulailah langsung menuliskan kelanjutan cerita berikutnya berdasarkan Chapter Plot yang diberikan.
`;
      }

      // Prose style sample section
      let styleSection = '';
      if (proseStyleSample.trim()) {
        styleSection = `
==================================================
SAMPEL GAYA BAHASA & DIKSI BAB-BAB SEBELUMNYA (STYLE REFERENCE):
==================================================
"""
${proseStyleSample}
"""

[PEDOMAN KONSISTENSI GAYA PENULISAN]:
- Analisis ritme kalimat, pilihan diksi, gaya dialog, dan cara bertutur dari sampel bab-bab sebelumnya di atas.
- Tuliskan bab ini dengan MENGIKUTI DAN MENYELARASKAN gaya penulisan tersebut secara konsisten.
- Pertahankan Sudut Pandang (Point of View / POV) yang konsisten (jangan berganti-ganti secara sembarangan).
- Pertahankan kedalaman deskripsi panca indera dan atmosfer cerita agar pembaca merasakan pengalaman yang homogen layaknya ditulis oleh satu pena pengarang yang sama.
`;
      }

      const prompt = `Anda adalah seorang novelis masterclass dan pengarang fiksi sastra tingkat tinggi.
Tugas Anda adalah mengembangkan CHAPTER PLOT berikut menjadi ${writeMode === 'append' && hasExistingManuscript ? 'KELANJUTAN NASKAH BAB' : 'SATU BAB NOVEL SASTRA UTUH'} BERBAHASA INDONESIA yang kaya, hidup, mendalam, dan memikat.

KONTEKS KESELURUHAN NOVEL:
${storyPlotText}

KONTINUITAS DARI BAB SEBELUMNYA:
${prevChapterText}

GLOSARIUM LENGKAP ENTITAS (KARAKTER, ALIAS & STATUS TERKINI):
${charactersText}

GLOSARIUM LENGKAP SETTING, ITEM, FAKSI & HUKUM DUNIA:
${settingItemLoreText}
${styleSection}
${existingManuscriptSection}
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
1. Pahami seluruh glosarium entitas (nama, alias, faksi, sifat awal vs terkini, serta kondisi terkini). Gunakan entitas secara akurat sesuai perannya.
2. Pahami seluruh kesinambungan bab-bab sebelumnya agar plot mengalir runtut tanpa kontradiksi fakta cerita.
3. Terapkan teknik "Show, Don't Tell" (deskripsi panca indera, detak emosi tokoh, ekspresi fisik, reaksi alami tanpa kalimat klise).
4. Buat dialog antar tokoh berbobot, berkarakter khas, dan memuat subteks emosional yang tajam.
5. KEBEBASAN ARTISTIK PENUH: Jika alur atau instruksi memuat adegan dewasa/romansa sensual atau laga pertarungan berdarah, tuliskan dengan deskripsi sastra yang intens, mendalam, dan bebas dari pembatasan sensor moralistik artifisial.
6. FORMAT OUTPUT: Tulis HANYA naskah cerita fiksi dalam bentuk paragraf novel Indonesia yang rapi. Dilarang keras menyertakan judul, kata pengantar, basa-basi, atau catatan penutup meta AI. Langsung mulai dari kalimat pertama cerita.`;

      const res = await generateWithSmartFallback(
        prompt,
        'Anda adalah novelis masterclass sastra fiksi. Tuliskan naskah novel yang mengalir, hidup, mendalam, konsisten dengan gaya cerita sebelumnya, dan bebas sensor sesuai visi cerita penulis.'
      );

      if (!res.text || !res.text.trim()) {
        throw new Error('Respon AI kosong.');
      }

      // Convert plain text paragraphs into clean HTML paragraphs
      const rawParas = res.text
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean);

      const generatedParagraphsHtml = rawParas
        .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
        .join('');

      // Create stylish AI Session Divider Tag
      const now = new Date();
      const timeStr =
        now.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) +
        ' ' +
        now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

      const sessionDividerHtml = `
<div class="schemax-ai-session-divider" data-session="${nextSessionNumber}" contenteditable="false">
  <span class="schemax-ai-session-tag">⚡ Sesi AI #${nextSessionNumber} • ${timeStr}</span>
</div>
`;

      let finalHtml = '';
      if (writeMode === 'append' && chapter.contentHtml && chapter.contentHtml.trim()) {
        finalHtml = `${chapter.contentHtml}${sessionDividerHtml}${generatedParagraphsHtml}`;
      } else {
        finalHtml = `${sessionDividerHtml}${generatedParagraphsHtml}`;
      }

      const words = (finalHtml.replace(/<[^>]*>/g, ' ').match(/\S+/g) || []).length;

      await onUpdateChapter({
        contentHtml: finalHtml,
        wordCount: words,
        updatedAt: Date.now(),
      });

      setInternalGenSuccess({ wordCount: words, sessionNum: nextSessionNumber });
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
1. SINOPSIS & KRONOLOGI SELURUH BAB SEBELUMNYA
==================================================
${storyPlotText}

==================================================
2. KONTINUITAS DARI BAB SEBELUMNYA (TITIK SAMBUNG)
==================================================
${prevChapterText}

==================================================
3. PLOT & CORETAN KASAR BAB INI (BAB ${chapter.order}: ${chapter.title})
==================================================
"""
${chapterPlotText.trim() || '(Penulis belum memasukkan plot bab, kembangkan adegan sesuai alur)'}
"""

==================================================
4. GLOSARIUM KARAKTER, ALIAS & STATUS KONDISI TERKINI
==================================================
${charactersText}

==================================================
5. GLOSARIUM SETTING, ITEM TERKINI & ATURAN DUNIA
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

  // Compile prompt specifically optimized for Toolsaday Story Generator
  const getToolsadayFormattedPrompt = (): string => {
    return `Write a rich, captivating novel chapter in Indonesian based on the following story specifications:

[GENRE & PREMISE]:
Novel: ${bookTitle} (Bab ${chapter.order}: ${chapter.title})
${chapter.premise || chapter.aiSummary || book?.synopsis?.slice(0, 350) || 'Cerita novel fiksi mendalam.'}

[CHARACTERS & CURRENT CONDITION]:
${charactersText ? charactersText.slice(0, 800) : 'Tokoh utama dan tokoh pendukung berinteraksi intens.'}

[SETTING & WORLD DETAILS]:
${settingItemLoreText ? settingItemLoreText.slice(0, 500) : 'Latar tempat atmosferik, mendukung suasana ketegangan.'}

[CHAPTER PLOT / SCENE BEATS TO WRITE]:
${chapterPlotText.trim() || 'Kembangkan bab ini dengan pembuka yang memikat, konflik yang memuncak, dan penutup bab yang berkesan.'}

[WRITING STYLE & GUIDELINES]:
- Language: Indonesian (Bahasa Indonesia sastra yang mengalir alami dan ekspresif).
- Narrative depth: Show, don't tell. Rich sensory descriptions and natural character dialogue.
- Continuity: Build directly from previous events, keeping emotional stakes high.
- Output: Write ONLY the story prose in clean novel paragraphs without meta introduction or title headers.`;
  };

  const handleCopyToolsadayPrompt = () => {
    const text = getToolsadayFormattedPrompt();
    navigator.clipboard.writeText(text);
    setCopiedToolsadayPrompt(true);
    setTimeout(() => setCopiedToolsadayPrompt(false), 2200);
  };

  // Import story generated from Toolsaday into current chapter manuscript
  const handleImportFromToolsaday = async (targetText: string, mode: 'append' | 'overwrite') => {
    const textToImport = targetText.trim();
    if (!textToImport) {
      alert('Teks naskah masih kosong. Silakan tempelkan hasil dari Toolsaday terlebih dahulu.');
      return;
    }

    // Convert plain text paragraphs to clean HTML paragraphs
    const rawParas = textToImport
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);

    const generatedParagraphsHtml = rawParas
      .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
      .join('');

    const existingSessionsMatch = (chapter.contentHtml || '').match(/schemax-ai-session/gi);
    const nextSessionNumber = (existingSessionsMatch ? existingSessionsMatch.length : 0) + 1;

    const now = new Date();
    const timeStr =
      now.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) +
      ' ' +
      now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    const sessionDividerHtml = `
<div class="schemax-ai-session-divider" data-session="${nextSessionNumber}" contenteditable="false">
  <span class="schemax-ai-session-tag">🌐 Impor Toolsaday #${nextSessionNumber} • ${timeStr}</span>
</div>
`;

    let finalHtml = '';
    if (mode === 'append' && chapter.contentHtml && chapter.contentHtml.trim()) {
      finalHtml = `${chapter.contentHtml}${sessionDividerHtml}${generatedParagraphsHtml}`;
    } else {
      finalHtml = `${sessionDividerHtml}${generatedParagraphsHtml}`;
    }

    const words = (finalHtml.replace(/<[^>]*>/g, ' ').match(/\S+/g) || []).length;

    await onUpdateChapter({
      contentHtml: finalHtml,
      wordCount: words,
      updatedAt: Date.now(),
    });

    setToolsadayImportSuccess({ wordCount: words, sessionNum: nextSessionNumber });
    setToolsadayPastedText('');
  };

  const handlePasteFromClipboardToToolsaday = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      if (clipboardText && clipboardText.trim()) {
        setToolsadayPastedText(clipboardText.trim());
      } else {
        alert('Clipboard kosong atau browser tidak mengizinkan baca clipboard otomatis. Silakan tempel (Ctrl+V) langsung ke kotak teks.');
      }
    } catch {
      alert('Silakan tekan Ctrl+V (atau ketuk lama lalu Tempel) langsung di dalam kotak teks.');
    }
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
      title: '1. Sinopsis & Kronologi Seluruh Bab Sebelumnya',
      icon: BookOpen,
      color: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
      text: storyPlotText,
      setText: setStoryPlotText,
      desc: 'Sinopsis novel dan kronologi perkembangan peristiwa dari Bab 1 s/d bab lalu.',
      canAiSummarize: chapter.order > 2,
    },
    {
      id: 'prev_chapter',
      title: '2. Ringkasan Bab Sebelumnya (Titik Sambung Langsung)',
      icon: RotateCcw,
      color: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/30',
      text: prevChapterText,
      setText: setPrevChapterText,
      desc: 'Kejadian terakhir dan potongan kalimat penutup bab sebelumnya.',
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
      title: '4. Glosarium Karakter, Alias & Status Terkini',
      icon: Users,
      color: 'text-rose-500 bg-rose-500/10 border-rose-500/30',
      text: charactersText,
      setText: setCharactersText,
      desc: 'Profil tokoh, alias, faksi, serta kondisi status adaptif per bab.',
      canAiSummarize: false,
      canGeneratePlot: false,
    },
    {
      id: 'setting_item_lore',
      title: '5. Glosarium Setting, Item Terkini & Aturan Dunia',
      icon: Scroll,
      color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30',
      text: settingItemLoreText,
      setText: setSettingItemLoreText,
      desc: 'Lokasi, item/pusaka aktif, faksi, hukum dunia fiksi, dan gaya penulisan.',
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

        {/* 📑 THREE TABS SWITCHER: [ 🚀 AI Internal ] [ ⚡ AI Toolsaday ] [ 🌐 AI External ] */}
        <div className="grid grid-cols-3 p-1 bg-slate-100 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs sm:text-sm">
          <button
            type="button"
            onClick={() => setActiveSheet('internal')}
            className={`py-2 px-2 sm:px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all text-center ${
              activeSheet === 'internal'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">AI Internal</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSheet('toolsaday')}
            className={`py-2 px-2 sm:px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all text-center ${
              activeSheet === 'toolsaday'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md font-black'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Flame className="w-3.5 h-3.5 flex-shrink-0 text-amber-300" />
            <span className="truncate">AI Toolsaday</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSheet('external')}
            className={`py-2 px-2 sm:px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all text-center ${
              activeSheet === 'external'
                ? 'bg-indigo-600 text-white shadow-md font-black'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">AI External (5 Poin)</span>
          </button>
        </div>
      </div>

      {/* ========================================================
          SHEET 1: AI INTERNAL (STUDIO GENERATOR NASKAH)
          ======================================================== */}
      {activeSheet === 'internal' && (
        <div className="space-y-4 animate-in fade-in">
          {/* Awareness Banner: AI Context Intelligence Summary */}
          <div className="p-3.5 bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-purple-500/10 border border-amber-500/30 rounded-2xl text-xs text-slate-700 dark:text-slate-300 space-y-1">
            <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
              <ShieldCheck className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <span>Sistem Cerdas AI Internal Aktif:</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px] text-slate-600 dark:text-slate-400">
              <div>
                • <strong>Glosarium Lengkap:</strong> {entities.length} Entitas &amp; Alias, Faksi, dan Kondisi Terkini Bab Ini otomatis terbaca.
              </div>
              <div>
                • <strong>Konteks Seluruh Bab:</strong> Kronologi {earlierChaptersList.length} bab lampau &amp; titik sambung terakhir terhubung.
              </div>
              <div>
                • <strong>Gaya &amp; Diksi Konsisten:</strong> Mengikuti gaya penulisan dan tempo bab-bab sebelumnya.
              </div>
            </div>
          </div>

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

              <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500 dark:text-slate-400 self-end sm:self-auto bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                <span>{chapterPlotText.length.toLocaleString()} karakter</span>
                <span>•</span>
                <span>{chapterPlotText.trim() ? chapterPlotText.trim().split(/\s+/).length : 0} kata</span>
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
              <div className="flex justify-end text-[10px] font-mono text-slate-400 dark:text-slate-500">
                <span>{additionalPrompt.length.toLocaleString()} karakter</span>
              </div>
            </div>

            {/* 3. Pilihan Penempatan Naskah (Overwrite vs Append dengan Penanda Batas AI) */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
              <div>
                <span className="font-bold text-slate-700 dark:text-slate-300 block">
                  Penempatan Naskah &amp; Penanda Sesi:
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  {writeMode === 'append'
                    ? 'AI membaca naskah yang sudah ada, melanjutkan dari titik terakhir, & memberi garis pembatas Sesi AI.'
                    : 'Naskah bab ini akan ditulis ulang dari awal dengan penanda Sesi AI #1.'}
                </span>
              </div>

              <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex-shrink-0 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setWriteMode('append')}
                  className={`py-1.5 px-3 rounded-lg text-xs font-bold transition ${
                    writeMode === 'append'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Lanjutkan Naskah (+ Sesi Baru)
                </button>
                <button
                  type="button"
                  onClick={() => setWriteMode('overwrite')}
                  className={`py-1.5 px-3 rounded-lg text-xs font-bold transition ${
                    writeMode === 'overwrite'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Tulis Ulang Seluruh Naskah
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
                  <span>AI Sedang Menuliskan Naskah Bab (Membaca Seluruh Konteks &amp; Glosarium)...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>
                    {writeMode === 'append' && hasExistingText
                      ? 'Lanjutkan Naskah Bab ke Editor Utama ✨'
                      : 'Generate Naskah Bab ke Editor Utama ✨'}
                  </span>
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
                    Sesi #{internalGenSuccess.sessionNum} • {internalGenSuccess.wordCount} Total Kata
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  Naskah bab ini telah otomatis disimpan dengan penanda batas sesi di editor. Anda bisa langsung membaca atau menyuntingnya.
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
          SHEET 2: AI TOOLSADAY (JEMBATAN CEPAT & IMPOR NASKAH)
          ======================================================== */}
      {activeSheet === 'toolsaday' && (
        <div className="space-y-4 animate-in fade-in">
          {/* Header Card: Panduan & Tombol Aksi Langsung */}
          <div className="bg-gradient-to-br from-blue-600/10 via-indigo-600/10 to-purple-600/10 border border-blue-500/30 rounded-3xl p-4 sm:p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 flex-shrink-0">
                  <Flame className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Toolsaday Story Generator Bridge</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-300 border border-blue-500/30">
                      Gratis Tanpa Login
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Otomatis merangkum Plot Bab {chapter.order}, Karakter &amp; Setting ke format pas untuk Toolsaday.
                  </p>
                </div>
              </div>

              {/* Action Buttons: Salin Format & Buka Toolsaday */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleCopyToolsadayPrompt}
                  className="flex-1 sm:flex-none py-2 px-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs transition active:scale-95 shadow-md shadow-blue-600/25 flex items-center justify-center gap-1.5"
                >
                  {copiedToolsadayPrompt ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-300" />
                      <span>Format Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Salin Prompt Toolsaday</span>
                    </>
                  )}
                </button>

                <a
                  href="https://toolsaday.com/writing/story-generator"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2 px-3.5 rounded-2xl bg-white dark:bg-slate-800 hover:bg-slate-100 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/60 font-extrabold text-xs transition active:scale-95 shadow-xs flex items-center justify-center gap-1.5 flex-shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Buka Web Toolsaday ↗</span>
                </a>
              </div>
            </div>

            {/* Step-by-Step Mini Guide */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-blue-200/50 dark:border-blue-900/40 text-[11px]">
              <div className="p-2.5 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-blue-100 dark:border-slate-800">
                <span className="font-extrabold text-blue-600 dark:text-blue-400 block mb-0.5">1. Salin Format:</span>
                <span className="text-slate-600 dark:text-slate-400">
                  Klik tombol <strong>"Salin Prompt Toolsaday"</strong> di atas. Plot &amp; data bab Anda sudah dirangkum otomatis.
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-blue-100 dark:border-slate-800">
                <span className="font-extrabold text-blue-600 dark:text-blue-400 block mb-0.5">2. Tempel di Toolsaday:</span>
                <span className="text-slate-600 dark:text-slate-400">
                  Buka tab Toolsaday, tempel (Ctrl+V) ke kolom cerita lalu klik <strong>Generate</strong>.
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-blue-100 dark:border-slate-800">
                <span className="font-extrabold text-blue-600 dark:text-blue-400 block mb-0.5">3. Impor Hasil ke Sini:</span>
                <span className="text-slate-600 dark:text-slate-400">
                  Salin teks cerita dari Toolsaday, lalu tempel di kotak bawah ini dan klik <strong>Impor Naskah</strong>.
                </span>
              </div>
            </div>
          </div>

          {/* Prompt Preview Box */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Scroll className="w-3.5 h-3.5 text-blue-500" />
                <span>Isi Ringkasan Prompt yang Siap Dikirim ke Toolsaday:</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {getToolsadayFormattedPrompt().length.toLocaleString()} karakter
              </span>
            </div>

            <textarea
              readOnly
              rows={6}
              value={getToolsadayFormattedPrompt()}
              className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs font-mono leading-relaxed focus:outline-none shadow-inner resize-y"
            />
          </div>

          {/* Import Received Manuscript Box */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <ClipboardPaste className="w-4 h-4 text-emerald-500" />
                  <span>Tempelkan Hasil Naskah dari Toolsaday di Sini:</span>
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Naskah akan otomatis dibersihkan menjadi paragraf sastra dan dimasukkan ke Editor Naskah Bab {chapter.order}.
                </p>
              </div>

              <button
                type="button"
                onClick={handlePasteFromClipboardToToolsaday}
                className="py-1.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-xs transition active:scale-95 flex items-center gap-1 self-start sm:self-auto border border-slate-200 dark:border-slate-700 shadow-xs"
              >
                <ClipboardPaste className="w-3.5 h-3.5 text-blue-500" />
                <span>Tempel dari Clipboard</span>
              </button>
            </div>

            <textarea
              rows={8}
              value={toolsadayPastedText}
              onChange={(e) => setToolsadayPastedText(e.target.value)}
              placeholder="Tempelkan (Ctrl+V) naskah cerita hasil generate dari Toolsaday di sini..."
              className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-900 dark:text-slate-100 leading-relaxed focus:outline-none focus:border-blue-500 shadow-inner resize-y min-h-[160px]"
            />

            {/* Word counter & Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
              <span className="text-[11px] font-mono text-slate-500">
                {toolsadayPastedText.trim()
                  ? `${toolsadayPastedText.trim().split(/\s+/).length.toLocaleString()} kata terdeteksi`
                  : 'Belum ada teks naskah'}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleImportFromToolsaday(toolsadayPastedText, 'append')}
                  disabled={!toolsadayPastedText.trim()}
                  className="flex-1 sm:flex-none py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs transition active:scale-95 shadow-md shadow-emerald-600/20 disabled:opacity-40 flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Sambung ke Naskah (+ Sesi Baru)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Gantikan seluruh naskah bab ini dengan hasil dari Toolsaday?')) {
                      handleImportFromToolsaday(toolsadayPastedText, 'overwrite');
                    }
                  }}
                  disabled={!toolsadayPastedText.trim()}
                  className="py-2.5 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-xs transition active:scale-95 disabled:opacity-40 border border-slate-200 dark:border-slate-700"
                >
                  <span>Ganti Seluruh Bab</span>
                </button>
              </div>
            </div>

            {/* Success notification banner */}
            {toolsadayImportSuccess && (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>Naskah dari Toolsaday berhasil diimpor ke Bab {chapter.order}!</span>
                  </div>
                  <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                    {toolsadayImportSuccess.wordCount} Total Kata
                  </span>
                </div>
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
          SHEET 3: AI EXTERNAL (PAKET KONTEKS TERSTRUKTUR 5 POIN)
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
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 dark:text-slate-500 px-1">
                    <span>{pt.text.length.toLocaleString()} karakter</span>
                    <span>{pt.text.trim() ? pt.text.trim().split(/\s+/).length : 0} kata</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
