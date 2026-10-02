/**
 * AI Inspiration & Brainstorming Service
 * Coordinates conversation context, book awareness, external API injections,
 * long-context rolling memory, and formulation into AI Story Architect.
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
    const chList = (pinnedBookChapters || [])
      .sort((a, b) => a.order - b.order)
      .map((c) => `  * Bab ${c.order}: ${c.title || 'Tanpa Judul'} (${c.wordCount || 0} kata) - Premis: ${c.premise || c.aiSummary || 'Belum ada'}`)
      .join('\n');

    const entList = (pinnedBookEntities || [])
      .map((e) => `  * [${e.category.toUpperCase()}] ${e.name}: ${e.shortDescription || e.initialDescription || 'Karakter/entitas dunia'}`)
      .join('\n');

    pinnedBookSection = `
=== BUKU YANG SEDANG DIANALISIS / RUJUKAN UTAMA ===
Judul: ${pinnedBook.title}
Genre: ${pinnedBook.genre || 'Fiksi'}
Sinopsis: "${pinnedBook.synopsis || '-'}"
Daftar Bab Saat Ini:
${chList || '  (Belum ada bab)'}

Daftar Entitas Worldbuilding:
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
2. **Koneksi Naskah:** Jika penulis merujuk bukunya, Anda memiliki akses penuh ke naskah, bab, dan worldbuilding mereka. Berikan saran kelanjutan cerita yang selaras dengan karakter dan peristiwa sebelumnya.
3. **Pemanfaatan Referensi Luar:** Bila penulis memanggil inspirasi dari D&D/Open5e, kartu Tarot, atau sejarah, rangkai referensi tersebut menjadi elemen narasi yang hidup dan relevan bagi cerita mereka.
4. **Berdayakan Pilihan Penulis:** Bila diminta ide atau membuat cerita awal, berikan 2–3 alternatif konsep yang bervariasi dengan penamaan jelas (misal: "### Opsi 1: [Judul Ide]" atau "### Opsi A: [Judul Ide]"). Setiap opsi harus memiliki premis ringkas, karakter kunci, dan konflik utama. Jangan menyertakan penanda [STORY_BLUEPRINT_READY] bila masih berupa daftar banyak opsi, agar penulis dapat memilih opsi favoritnya terlebih dahulu.
5. **Gaya Komunikasi:** Bersahabat, antusias, cerdas, suportif, berwawasan sastra luas, dan terstruktur rapi dengan Markdown.
6. **Perumusan Blueprint Cerita (Integrasi AI Story Architect):**
   - Jika penulis meminta Anda: "rancang jadi buku", "buatkan rancangan cerita", "buat blueprint", ATAU jika penulis telah memilih salah satu opsi ide tertentu ("Pilih & Kembangkan"):
     JANGAN LANGSUNG MEMBUAT 5 BAB SEKALIGUS! Fokuskan secara mendalam pada SATU rancangan komprehensif untuk ide tersebut dengan rincian berikut:
     - **Judul Konsep & Genre:** (Judul utama yang memikat beserta genre & sub-genre)
     - **Logline / Premis Inti:** (Ringkasan 1-2 kalimat dramatis konflik inti cerita)
     - **Karakter Kunci:**
       * Nama lengkap & peran (Protagonis, Antagonis/Rival, Tokoh Pendukung)
       * Latar belakang (backstory/asal-usul) masing-masing karakter
       * Ciri-ciri fisik spesifik (bentuk wajah, sorot mata, rambut, warna kulit, postur/siluet tubuh, busana)
       * Sifat, kepribadian, kebiasaan unik, luka batin (*flaw/wound*), serta motif (*want* & *need*)
     - **Tempat / Setting:** Lokasi-lokasi penting di bab pertama beserta suasana/atmosfer visual panca indra
     - **Alat / Item / Relik:** Senjata, pusaka, perlengkapan, atau artefak kunci beserta fungsi dan dampaknya
     - **Lore & Aturan Dunia:** Mitos/sejarah masa lalu, sistem supranatural/sains, atau rahasia penting dunia cerita
     - **Rancangan Plot Bab Pertama (Bab 1):** Alur ketukan adegan (*beat-by-beat scene plot*) yang kaya dan mendalam dari pembuka (*hook*), insiden pengganggu (*inciting incident*), eskalasi ketegangan, hingga penutup/kejutan bab pertama
   - Dan di bagian paling akhir respon tersebut, WAJIB sertakan penanda: "[STORY_BLUEPRINT_READY]" agar sistem otomatis mengenali dan memunculkan tombol "Rancang Jadi Buku" bagi penulis!

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
