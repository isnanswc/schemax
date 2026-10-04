/**
 * AI Inspiration & Brainstorming Service
 * Coordinates conversation context, book awareness, external API injections,
 * long-context rolling memory, formulation into AI Story Architect,
 * and next chapter story plot structuring.
 */

import { Book, StoryChapter, WorldEntity, InspirationChatMessage, InspirationChatSession } from '../types';
import { generateWithSmartFallback } from './aiService';

export interface InspirationContextOptions {
  allBooks: Book[];
  pinnedBook?: Book | null;
  pinnedBookChapters?: StoryChapter[];
  pinnedBookEntities?: WorldEntity[];
  externalSnippet?: {
    type: 'open5e' | 'tarot' | 'history' | 'fact';
    title: string;
    content: string;
  };
}

// Helper to strip HTML tags to pure text while converting paragraphs to clean newlines
export function stripHtmlToCleanText(html: string): string {
  if (!html) return '';
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  const sessionTags = tempDiv.querySelectorAll('.schemax-ai-session-tag, .schemax-ai-session-divider');
  sessionTags.forEach((tag) => {
    const text = tag.textContent?.trim() || 'Batas Sesi AI';
    tag.replaceWith(document.createTextNode(`\n\n--- [${text}] ---\n\n`));
  });
  return (tempDiv.textContent || tempDiv.innerText || '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Helper to determine the condition and traits of an entity based strictly on previous chapter history
export function getLatestEntityState(
  entity: WorldEntity,
  targetChapterOrder: number,
  earlierChaptersDesc: StoryChapter[]
): { condition: string; conditionDetails?: string; source: string; traits?: string; description?: string } {
  // 1. Search earlier chapters in descending order (Bab n-1, Bab n-2, ... Bab 1)
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

  // 2. Search entity chapterChronology records for chapters strictly before this target chapter
  if (entity.chapterChronology) {
    const records = Object.values(entity.chapterChronology)
      .filter((r) => r.chapterOrder < targetChapterOrder)
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

  // 3. Fallback to Initial Entity State (never forward/future condition!)
  return {
    condition: (entity as any).initialCondition || entity.condition || 'aktif',
    conditionDetails: (entity as any).initialConditionDetails || entity.conditionDetails,
    source: 'Kondisi Awal Novel',
    traits: entity.initialTraits || entity.currentTraits,
    description: entity.initialDescription || entity.shortDescription || entity.currentDescription,
  };
}

export interface NextChapterInspirationPlan {
  chapterOrder: number;
  bookRecap?: string;
  chapterTitle: string;
  premise: string;
  storyPlot: string;
  characterRoster?: string;
  worldLoreAndSetting?: string;
  rawText: string;
}

/**
 * Parses structured [NEXT_CHAPTER_PLAN_READY] output from AI
 */
export function parseNextChapterPlan(text: string, defaultOrder: number = 1): NextChapterInspirationPlan | null {
  if (!text || !text.includes('[NEXT_CHAPTER_PLAN_READY]')) {
    return null;
  }

  const cleanText = text.replace(/\[NEXT_CHAPTER_PLAN_READY\]/g, '').trim();

  // Extract Chapter Number / Order if present
  let chapterOrder = defaultOrder;
  const orderMatch = cleanText.match(/(?:Bab|Chapter)\s*(\d+)/i);
  if (orderMatch && orderMatch[1]) {
    const parsed = parseInt(orderMatch[1], 10);
    if (!isNaN(parsed) && parsed > 0) {
      chapterOrder = parsed;
    }
  }

  // Extract Judul Bab
  let chapterTitle = `Bab ${chapterOrder}`;
  const titleMatch = cleanText.match(/(?:\*{1,2}|#{1,4})?\s*(?:Judul|Usulan Judul Bab|Judul Bab)\s*(?:\*{1,2}|:)?\s*[:\-]?\s*([^\n\r]+)/i);
  if (titleMatch && titleMatch[1]) {
    const rawT = titleMatch[1].replace(/^\*\*|\*\*$/g, '').replace(/^[":'\s]+|[":'\s]+$/g, '').trim();
    if (rawT.length > 0 && !rawT.toLowerCase().startsWith('bab')) {
      chapterTitle = rawT;
    } else if (rawT.length > 0) {
      chapterTitle = rawT;
    }
  }

  // Extract Premis
  let premise = '';
  const premiseMatch = cleanText.match(/(?:^|\n)(?:\*{1,2}|#{1,4})?\s*(?:Premis|Premis Inti Bab|Premis Bab|Fokus Bab)\s*(?:\*{1,2}|:)?\s*[:\-]?\s*([\s\S]*?)(?=(?:\n(?:\*{1,2}|#{1,4})?\s*(?:Rencana Alur|Story Plot|Ketukan Adegan|Alur Bab|Karakter|Daftar Karakter|Setting|Tempat|Lokasi))|\n\n\n|$)/i);
  if (premiseMatch && premiseMatch[1]) {
    premise = premiseMatch[1].replace(/^\*\*|\*\*$/g, '').trim();
  }

  // Extract Story Plot / Ketukan Adegan
  let storyPlot = '';
  const plotMatch = cleanText.match(/(?:^|\n)(?:\*{1,2}|#{1,4})?\s*(?:Rencana Alur|Story Plot|Ketukan Adegan|Alur Babak|Plot Bab)\s*(?:\*{1,2}|:)?\s*[:\-]?\s*([\s\S]*?)(?=(?:\n(?:\*{1,2}|#{1,4})?\s*(?:Karakter|Detail Karakter|Setting|Tempat|Lokasi|Lore))|\n\n\n\n|$)/i);
  if (plotMatch && plotMatch[1]) {
    storyPlot = plotMatch[1].trim();
  }

  // Extract Karakter Terlibat
  let characterRoster = '';
  const charMatch = cleanText.match(/(?:^|\n)(?:\*{1,2}|#{1,4})?\s*(?:Karakter|Detail Karakter Terlibat|Kondisi Karakter|Roster Karakter)\s*(?:\*{1,2}|:)?\s*[:\-]?\s*([\s\S]*?)(?=(?:\n(?:\*{1,2}|#{1,4})?\s*(?:Setting|Tempat|Lokasi|Alat|Item|Lore|Aturan Dunia))|\n\n\n\n|$)/i);
  if (charMatch && charMatch[1]) {
    characterRoster = charMatch[1].trim();
  }

  // Extract Setting & Lore
  let worldLoreAndSetting = '';
  const loreMatch = cleanText.match(/(?:^|\n)(?:\*{1,2}|#{1,4})?\s*(?:Setting|Tempat|Lokasi|Alat|Item|Relik|Lore|Aturan Dunia)\s*(?:\*{1,2}|:)?\s*[:\-]?\s*([\s\S]*?)$/i);
  if (loreMatch && loreMatch[1]) {
    worldLoreAndSetting = loreMatch[1].trim();
  }

  // Fallback if premise is empty
  if (!premise) {
    const firstParagraphs = cleanText.split('\n\n').filter((p) => !p.startsWith('#') && p.trim().length > 20);
    if (firstParagraphs.length > 0) {
      premise = firstParagraphs[0].trim();
    }
  }

  // Fallback if storyPlot is empty
  if (!storyPlot) {
    storyPlot = cleanText;
  }

  return {
    chapterOrder,
    chapterTitle,
    premise,
    storyPlot,
    characterRoster,
    worldLoreAndSetting,
    rawText: cleanText,
  };
}

/**
 * Builds a comprehensive system prompt equipping AI with knowledge of the author's
 * books, worldbuilding lore, and literary brainstorming role.
 */
export function buildInspirationSystemPrompt(
  session: InspirationChatSession,
  context: InspirationContextOptions
): string {
  const { allBooks, pinnedBook, pinnedBookChapters, pinnedBookEntities } = context;

  // 1. All Books Library Brief
  const booksCatalogBrief = allBooks.length > 0
    ? allBooks.map((b) => `- **${b.title}** (${b.genre || 'Fiksi'}) [Status: ${b.status}]: ${b.synopsis || 'Belum ada sinopsis'}`).join('\n')
    : '(Belum ada buku terdaftar di aplikasi)';

  // 2. Focused/Pinned Book Deep Context
  let pinnedBookSection = '';
  if (pinnedBook) {
    const sortedChapters = (pinnedBookChapters || []).sort((a, b) => a.order - b.order);
    const lastChapter = sortedChapters.length > 0 ? sortedChapters[sortedChapters.length - 1] : null;
    const nextChapterOrder = lastChapter ? lastChapter.order + 1 : 1;

    const chList = sortedChapters
      .map((c) => {
        const sum = c.premise || c.aiSummary || c.notes || 'Belum ada ringkasan';
        return `  * Bab ${c.order}: "${c.title || 'Tanpa Judul'}" (${c.wordCount || 0} kata) - Ringkasan: ${sum.replace(/\n+/g, ' ')}`;
      })
      .join('\n');

    // Last chapter closing snippet (anchor for continuation)
    let lastChapterClosingSnippet = '';
    if (lastChapter && lastChapter.contentHtml) {
      const cleanPrev = stripHtmlToCleanText(lastChapter.contentHtml);
      if (cleanPrev) {
        const sentences = cleanPrev.split(/(?<=[.!?])\s+/).filter(Boolean);
        const lastFew = sentences.slice(-5).join(' ');
        lastChapterClosingSnippet = `\n[Potongan Kalimat/Adegan Terakhir di Penutup Bab ${lastChapter.order}]:\n"${lastFew}"\n`;
      }
    }

    // Entities with accurate latest state from previous chapters
    const earlierDesc = [...sortedChapters].reverse();
    const entList = (pinnedBookEntities || [])
      .map((e) => {
        const state = getLatestEntityState(e, nextChapterOrder, earlierDesc);
        const role = e.role ? `[${e.role.toUpperCase()}]` : `[${e.category.toUpperCase()}]`;
        let text = `  * ${role} ${e.name}: Kondisi di bab terakhir: "${state.condition}${state.conditionDetails ? ` (${state.conditionDetails})` : ''}"`;
        const traits = state.traits || e.currentTraits || e.initialTraits;
        if (traits) text += ` | Sifat: ${traits}`;
        const desc = state.description || e.shortDescription;
        if (desc) text += ` | Deskripsi: ${desc.replace(/\n+/g, ' ')}`;
        return text;
      })
      .join('\n');

    pinnedBookSection = `
=== BUKU YANG SEDANG DITAUTKAN / RUJUKAN UTAMA ===
Judul Buku: ${pinnedBook.title}
Genre: ${pinnedBook.genre || 'Fiksi'}
Sinopsis Utama: "${pinnedBook.synopsis || '-'}"
Status Bab Saat Ini: Buku memiliki ${sortedChapters.length} bab. Bab terakhir adalah Bab ${lastChapter ? lastChapter.order : 0} ("${lastChapter ? lastChapter.title : 'Belum ada bab'}").
Target Bab Selanjutnya Jika Dibuat: Bab ${nextChapterOrder}.

Kronologi Bab-Bab Sejauh Ini:
${chList || '  (Belum ada bab yang ditulis)'}
${lastChapterClosingSnippet}
Status & Kondisi Karakter / Entitas Dunia Terkini (Berdasarkan Bab Terakhir):
${entList || '  (Belum ada entitas)'}
===================================================`;
  }

  // 3. Rolling Memory Summary for >50 or >100 turns
  const memorySection = session.summary
    ? `\n=== MEMORI KEPUTUSAN CERITA SEBELUMNYA (DISCUSSED SO FAR) ===\n${session.summary}\n============================================================\n`
    : '';

  return `Anda adalah "AI INSPIRATION & STORY ARCHITECT PARTNER" di Schemax Story Studio.
Peran Anda adalah konsultan sastra elit, kreator worldbuilding kreatif, dan rekan diskusi ide cerita untuk penulis.

TUGAS UTAMA ANDA:
1. **Brainstorming Interaktif:** Bantu penulis menggali premis, alur plot, motif karakter, *plot twist*, misteri, dan sistem sihir/teknologi fiksi yang orisinal dan tidak klise.
2. **Koneksi Naskah & Kontinuitas Bab:** Jika buku ditautkan, Anda memiliki akses penuh ke kronologi bab, naskah bab terakhir, dan kondisi mutakhir seluruh tokoh/lore dunia. Pastikan setiap usulan alur menjaga kesinambungan (*continuity*) dari titik penutup bab sebelumnya.
3. **Pemanfaatan Referensi Luar:** Bila penulis memanggil inspirasi dari D&D/Open5e, kartu Tarot, atau sejarah, rangkai referensi tersebut menjadi elemen narasi yang hidup dan relevan bagi cerita mereka.
4. **Berdayakan Pilihan Penulis:** Bila diminta opsi ide baru, berikan 2–3 alternatif konsep yang bervariasi dengan penamaan jelas (misal: "### Opsi 1: [Judul Ide]" atau "### Opsi A: [Judul Ide]"). Setiap opsi harus memiliki premis ringkas, karakter kunci, dan konflik utama. Jangan menyertakan penanda tag bila masih berupa daftar opsi, agar penulis dapat memilihnya terlebih dahulu.
5. **Gaya Komunikasi:** Bersahabat, antusias, cerdas, suportif, berwawasan sastra luas, dan terstruktur rapi dengan Markdown.

6. **PERUMUSAN BLUEPRINT BUKU BARU (Untuk Pembuatan Buku Baru):**
   - Jika buku belum ditautkan (Ide Bebas) dan penulis meminta "rancang jadi buku", "buatkan rancangan cerita", ATAU memilih opsi ide tertentu:
     Fokuskan pada SATU rancangan komprehensif Bab Pertama: Judul Konsep & Genre, Logline/Premis, Karakter Kunci (nama, latar, ciri fisik, sifat, luka batin, want/need), Tempat/Lokasi, Alat/Relik, Lore Dunia, serta Rancangan Plot Bab 1 (beat-by-beat).
     Di bagian paling akhir, WAJIB sertakan penanda: "[STORY_BLUEPRINT_READY]" agar muncul tombol "Rancang Jadi Buku".

7. **PERUMUSAN STORY PLOT BAB SELANJUTNYA (Untuk Buku yang Sedang Ditautkan):**
   - Jika buku sedang ditautkan (${pinnedBook ? `"${pinnedBook.title}"` : 'suatu buku'}) dan penulis meminta:
     "buat bab selanjutnya", "lanjutkan bab", "buat bab baru", "buat ide kasar untuk bab berikutnya", atau mendiskusikan kelanjutan cerita:
     Anda HARUS menyusun **Rancangan Story Plot Bab Baru** yang presisi sesuai standar Story Plot Schemax dengan format berikut:
     
     ### Rancangan Bab [n+1]: [Usulan Judul Bab Baru]
     - **Rangkuman Latar & Titik Sambung**: Ringkasan singkat kondisi dunia dan konsekuensi langsung dari penutup bab sebelumnya (termasuk potongan adegan terakhir).
     - **Premis Bab Baru**: 2-3 kalimat fokus dramatis bab ini (tujuan, hambatan utama, dan taruhan emosional).
     - **Rencana Alur Adegan (Story Plot)**:
       * *Adegan Pembuka (Hook)*: Respon langsung terhadap penutup bab lalu.
       * *Perkembangan Adegan & Hambatan*: Eksplorasi konflik atau pertemuan baru.
       * *Puncak / Titik Konflik*: Momen genting penentuan bab ini.
       * *Penutup / Cliffhanger*: Resolusi sementara atau pertanyaan besar pemicu bab berikutnya.
     - **Detail Karakter Terlibat & Kondisi Terkini**: Daftar tokoh yang muncul beserta kondisi fisik/mental mereka (berdasarkan status di bab sebelumnya), serta tujuan/agenda mereka di bab ini.
     - **Setting, Lokasi & Lore Terlibat**: Lokasi spesifik kejadian, atmosfer visual panca indra, perlengkapan/artefak yang dibawa, dan aturan dunia yang berperan.
     
     Di bagian paling akhir respon tersebut, WAJIB sertakan penanda: "[NEXT_CHAPTER_PLAN_READY]" agar sistem otomatis memunculkan tombol **"⚡ Buat Bab [n+1] & Terapkan ke Story Plot"** bagi penulis!

KATALOG BUKU PENULIS SAAT INI:
${booksCatalogBrief}
${pinnedBookSection}
${memorySection}

Ingat: Jangan menulis naskah bab lengkap kecuali diminta; fokuslah pada pengembangan konsep, logika dunia cerita, dinamika karakter, dan pancingan ide kreatif.`;
}

/**
 * Builds user prompt by taking recent messages window (preserving up to 40 latest messages)
 * and appending any active external knowledge snippet.
 */
export function buildInspirationPrompt(
  session: InspirationChatSession,
  newUserMessage: string,
  externalSnippet?: { type: string; title: string; content: string }
): string {
  // Recent messages window (up to 40 items)
  const recentHistory = session.messages.slice(-35);

  const historyFormatted = recentHistory
    .map((m) => {
      const sender = m.role === 'user' ? 'PENULIS' : 'AI INSPIRASI';
      return `${sender}: ${m.content}`;
    })
    .join('\n\n');

  let snippetText = '';
  if (externalSnippet) {
    snippetText = `
[KARTU/INSPIRASI EKSTERNAL YANG DIPILIH PENULIS:
Kategori: ${externalSnippet.type.toUpperCase()} - ${externalSnippet.title}
Data:
${externalSnippet.content}
]
`;
  }

  return `RIWAYAT DISKUSI TERAKHIR:
${historyFormatted || '(Awal percakapan)'}

${snippetText}
PENULIS: ${newUserMessage}

Responlah sebagai AI Inspirasi & Arsitek Cerita yang suportif, analitis, dan kreatif:`;
}

/**
 * Formulates the brainstorming conversation into a comprehensive, structured prompt
 * ready to be directly executed by AI Story Architect (generating books, chapters, world).
 */
export async function formulateIdeaForArchitect(
  session: InspirationChatSession,
  pinnedBook?: Book | null
): Promise<string> {
  const historyText = session.messages
    .slice(-40)
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n');

  const prompt = `Berdasarkan seluruh hasil diskusi brainstorming berikut, buatlah SATU RUMUSAN BLUEPRINT CERITA LENGKAP yang padat, terstruktur, dan kaya detail untuk diinput ke AI Story Architect. Fokuskan secara mendalam pada BAB PERTAMA (jangan membuat 5 bab sekaligus).

RIWAYAT DISKUSI:
${historyText}

BUKU RUJUKAN (JIKA ADA): ${pinnedBook?.title || 'Ide Cerita Baru'}

Formatkan output Anda secara langsung dengan struktur berikut (tanpa salam pembuka/penutup):

1. **Judul Konsep & Genre:** (Judul yang memikat beserta genre dan sub-genre)
2. **Logline / Premis Inti:** (Ringkasan 1-2 kalimat dramatis: siapa tokohnya, tujuannya, konflik terbesar, dan taruhan jika gagal)
3. **Karakter Kunci (Nama, Latar Belakang & Sifat):**
   - Protagonis (nama lengkap, latar belakang/asal-usul, ciri-ciri fisik spesifik, sifat & luka batin, want & need)
   - Antagonis / Rival (nama lengkap, motif, ciri fisik, kekuasaan/ancaman)
   - Tokoh Pendukung Krusial (nama lengkap, peran, hubungan dengan protagonis)
4. **Tempat / Lokasi:** (Nama tempat penting di bab pertama, atmosfer visual, dan fungsi latarnya)
5. **Alat / Item / Relik:** (Senjata, pusaka, alat, atau artefak kunci beserta efek/kegunaannya)
6. **Lore & Aturan Dunia:** (Mitos/sejarah masa lalu, rahasia penting dunia, atau aturan sistem supranatural/sains)
7. **Rancangan Plot Bab Pertama (Bab 1):** (Alur ketukan adegan spesifik dari pembuka, inciting incident, ketegangan, hingga penutup/cliffhanger bab 1)`;

  const system = 'Anda adalah perumus naskah dan arsitek cerita profesional. Tugas Anda adalah memadatkan hasil diskusi brainstorming menjadi draf instruksi rancangan cerita lengkap yang siap dieksekusi.';

  const result = await generateWithSmartFallback(prompt, system);
  return result.text;
}
