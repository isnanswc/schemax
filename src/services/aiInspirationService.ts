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
4. **Berdayakan Pilihan Penulis:** Berikan 2–3 alternatif sudut pandang yang bervariasi (misal: "Opsi A: Pendekatan Tragedi Emosional", "Opsi B: Plot Twist Politik", "Opsi C: Aksi Spektakuler").
5. **Gaya Komunikasi:** Bersahabat, antusias, cerdas, suportif, berwawasan sastra luas, dan terstruktur rapi dengan Markdown.

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

  const prompt = `Berdasarkan seluruh hasil diskusi brainstorming berikut, buatlah SATU RUMUSAN BLUEPRINT CERITA LENGKAP yang padat, terstruktur, dan kaya detail untuk diinput ke AI Story Architect.

RIWAYAT DISKUSI:
${historyText}

BUKU RUJUKAN (JIKA ADA): ${pinnedBook?.title || 'Ide Cerita Baru'}

Formatkan output Anda secara langsung dengan struktur berikut (tanpa salam pembuka/penutup):

1. **Judul Konsep & Genre:** (Judul yang memikat, genre utama dan sub-genre)
2. **Logline / Premis Inti:** (Ringkasan 1-2 kalimat dramatis: siapa tokohnya, apa tujuannya, konflik terbesar, dan taruhan jika gagal)
3. **Latar Dunia & Aturan Khusus (World Setting):** (Deskripsi dunia, atmosfer, faksi berkuasa, sistem sihir/teknologi, dan aturan unik)
4. **Karakter Kunci:**
   - Protagonis (nama, peran, luka batin/kelemahan, tujuan utama)
   - Antagonis / Rival (nama, motif filosofis, kekuasaan, ancaman)
   - Karakter Pendukung Krusial
5. **Konflik Utama & Plot Twist Utama:** (Pemicu krisis awal, eskalasi konflik, dan rahasia besar di pertengahan/akhir cerita)
6. **Rancangan Arc Bab Utama (Minimal 5 Bab Awal):**
   - Bab 1: Titik mula & peristiwa pengganggu (*inciting incident*)
   - Bab 2: Pilihan tanpa jalan kembali
   - Bab 3: Menghadapi rintangan pertama & petunjuk konspirasi
   - Bab 4: Konfrontasi awal & titik terendah
   - Bab 5: Kebangkitan & persiapan pertarungan menentukan`;

  const system = 'Anda adalah perumus naskah dan arsitek cerita profesional. Tugas Anda adalah memadatkan hasil diskusi brainstorming menjadi draf instruksi rancangan cerita lengkap yang siap dieksekusi.';

  const result = await generateWithSmartFallback(prompt, system);
  return result.text;
}
