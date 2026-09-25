import { StoryBlueprint } from '../types/blueprint';
import { Book, WorldEntity, StoryChapter } from '../types';
import { generateWithSmartFallback } from './aiService';
import { db, saveMediaItem, createSvgBlob } from '../db';

export async function generateStoryBlueprint(
  rawIdea: string,
  genre: string,
  tone: string
): Promise<StoryBlueprint> {
  const systemPrompt = `Kamu adalah Arsitek Cerita Fiksi Kelas Dunia (Master Story Architect & Worldbuilder).
Tugasmu: Mengembangkan 1 ide mentah dari penulis menjadi BLUEPRINT PROYEK CERITA LENGKAP berstandar novel/film profesional.
Bahasa: Bahasa Indonesia sastra bermutu tinggi, memikat, dan tidak klise.

WAJIB MERESPON HANYA DENGAN FORMAT JSON VALID (tanpa teks pembuka atau penutup markdown selain kurung kurawal json):
{
  "title": "Judul Cerita yang Memikat",
  "genre": "${genre}",
  "logline": "1-2 kalimat dramatis yang merangkum siapa protagonis, apa tujuannya, rintangan terbesar, dan apa taruhannya jika gagal.",
  "synopsis": "Sinopsis lengkap 4 babak (Pengenalan & Inciting Incident, Eskalasi & Titik Balik, Krisis Tergelap, dan Puncak Klimaks). Minimal 2 paragraf padat.",
  "thematicCore": "Pesan filosofis / tema sentral (misal: 'Penebusan dosa masa lalu memerlukan pengorbanan ego terbesar').",
  "characters": [
    {
      "name": "Nama Protagonis",
      "role": "Protagonis Utama",
      "shortDescription": "Deskripsi singkat peran dan kepribadian",
      "want": "Tujuan sadar yang ia kejar mati-matian",
      "need": "Kebutuhan batiniah yang harus ia sadari untuk berubah",
      "flawOrWound": "Luka masa lalu atau trauma psikologis",
      "attributes": [
        { "label": "Usia", "value": "24 Tahun" },
        { "label": "Keahlian", "value": "Manipulasi Gravitasi" },
        { "label": "Faksi", "value": "Pemberontak Bawah Tanah" }
      ],
      "tags": ["Protagonis", "Kompleks"]
    },
    {
      "name": "Nama Antagonis / Rival",
      "role": "Antagonis Utama",
      "shortDescription": "Deskripsi motif antagonis yang masuk akal dan berbahaya",
      "want": "Tujuan lawan",
      "need": "Kelemahan fatalnya",
      "flawOrWound": "Ideologi ekstremnya",
      "attributes": [
        { "label": "Peran", "value": "Panglima Kekaisaran" },
        { "label": "Kekuatan", "value": "Absorpsi Energi" }
      ],
      "tags": ["Antagonis", "Karisma"]
    },
    {
      "name": "Nama Sekutu / Mentor",
      "role": "Mentor / Deuteragonis",
      "shortDescription": "Sahabat setia atau mentor misterius yang menyimpan rahasia",
      "want": "Membimbing protagonis",
      "need": "Memaafkan masa lalunya sendiri",
      "flawOrWound": "Rahasia kelam era perang",
      "attributes": [
        { "label": "Peran", "value": "Penjaga Arsip Terlarang" }
      ],
      "tags": ["Sekutu", "Misterius"]
    }
  ],
  "locations": [
    {
      "name": "Nama Lokasi Utama 1",
      "shortDescription": "Deskripsi visual kota / benteng / alam dengan atmosfer tajam",
      "detailedNotes": "Bahaya, misteri, atau aturan kehidupan di lokasi ini",
      "attributes": [
        { "label": "Tipe", "value": "Metropolis Terapung" },
        { "label": "Atmosfer", "value": "Kelabu, Lembab, & Penuh Kabut" }
      ],
      "tags": ["Ikonik", "Pusat Cerita"]
    },
    {
      "name": "Nama Lokasi Utama 2",
      "shortDescription": "Lokasi rahasia atau perbatasan berbahaya",
      "detailedNotes": "Tempat artefak atau pertempuran penting berlangsung",
      "attributes": [
        { "label": "Bahaya", "value": "Tinggi / Anomali Temporal" }
      ],
      "tags": ["Berbahaya"]
    }
  ],
  "items": [
    {
      "name": "Nama Relik / Artefak / Aturan Dunia",
      "shortDescription": "Fungsi dan dampak artefak ini terhadap jalannya cerita",
      "detailedNotes": "Asal-usul purba dan harga mahal atau efek samping setiap kali digunakan",
      "attributes": [
        { "label": "Kelangkaan", "value": "Artefak Purba Unik" },
        { "label": "Efek", "value": "Menghentikan Waktu Sejenak" }
      ],
      "tags": ["Relik", "Kunci Plot"]
    }
  ],
  "chapters": [
    {
      "title": "Bab 1: [Judul Pembuka]",
      "order": 1,
      "premise": "Adegan pembuka yang menunjukkan dunia normal protagonis sebelum sebuah insiden mengejutkan membalikkan hidupnya.",
      "notes": "Tekankan luka batin protagonis dan hadirkan misteri utama.",
      "targetWordCount": 1500
    },
    {
      "title": "Bab 2: [Pemicu Alur]",
      "order": 2,
      "premise": "Peristiwa pemicu (inciting incident) yang memaksa protagonis mengambil keputusan berbahaya tanpa jalan mundur.",
      "notes": "Perkenalkan antagonis atau ancaman nyata pertama kali.",
      "targetWordCount": 1800
    },
    {
      "title": "Bab 3: [Melangkah ke Dunia Baru]",
      "order": 3,
      "premise": "Protagonis memasuki lingkungan asing atau memecahkan misteri awal bersama sekutunya, menyadari bahwa taruhannya jauh lebih besar.",
      "notes": "Munculkan petunjuk pertama tentang relik sentral.",
      "targetWordCount": 2000
    }
  ]
}`;

  const userPrompt = `Rancang Blueprint Proyek Cerita lengkap berdasarkan parameter ini:
- Ide / Premis Kasar: "${rawIdea}"
- Genre: "${genre}"
- Nada & Gaya Cerita (Tone): "${tone}"

Pastikan seluruh nama karakter, lokasi, dan bab selaras dengan genre dan nada cerita. Respon HANYA teks JSON valid.`;

  const response = await generateWithSmartFallback(userPrompt, systemPrompt);

  let cleanText = response.text.trim();
  // Strip markdown code fences if present
  if (cleanText.startsWith('```json')) {
    cleanText = cleanText.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  } else if (cleanText.startsWith('```')) {
    cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }

  // Find first { and last }
  const firstBrace = cleanText.indexOf('{');
  const lastBrace = cleanText.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1) {
    cleanText = cleanText.substring(firstBrace, lastBrace + 1);
  }

  try {
    const blueprint: StoryBlueprint = JSON.parse(cleanText);
    return blueprint;
  } catch (err: any) {
    console.error('Gagal parsing JSON Blueprint:', cleanText);
    throw new Error('Gagal mengurai respons AI menjadi struktur proyek. Silakan coba kembali.');
  }
}

// 🚀 Seed Blueprint directly into Dexie IndexedDB
export async function seedBlueprintToDatabase(blueprint: StoryBlueprint): Promise<Book> {
  const now = Date.now();
  const bookId = 'book_' + now.toString(36) + Math.random().toString(36).substring(2, 6);

  // 1. Create cover SVG & save media
  const coverBlob = createSvgBlob(blueprint.title, '#f59e0b', '📖');
  const coverMediaId = await saveMediaItem(bookId, coverBlob, 'cover-auto.svg');

  // 2. Create Book entry
  const newBook: Book = {
    id: bookId,
    title: blueprint.title,
    synopsis: `${blueprint.logline ? blueprint.logline + '\n\n' : ''}${blueprint.synopsis}`,
    genre: blueprint.genre || 'Fiksi',
    status: 'draft',
    coverMediaId,
    wordCountTarget: (blueprint.chapters.length || 3) * 1800,
    currentWordCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  await db.books.add(newBook);

  // 3. Seed Characters into World Entities
  if (blueprint.characters && blueprint.characters.length > 0) {
    const characterIcons = ['🧙‍♂️', '⚔️', '🎭', '👑', '🏹'];
    for (let i = 0; i < blueprint.characters.length; i++) {
      const char = blueprint.characters[i];
      const charId = 'ent_char_' + now.toString(36) + i;
      const avatarBlob = createSvgBlob(char.name, '#ec4899', characterIcons[i % characterIcons.length]);
      const avatarMediaId = await saveMediaItem(bookId, avatarBlob, `avatar-${char.name}.svg`, charId);

      const detailedNotes = [
        char.want ? `• Ingin (Want): ${char.want}` : '',
        char.need ? `• Butuh (Need): ${char.need}` : '',
        char.flawOrWound ? `• Luka Masa Lalu (Ghost): ${char.flawOrWound}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      const entity: WorldEntity = {
        id: charId,
        bookId,
        category: 'character',
        name: char.name,
        shortDescription: `${char.role ? `[${char.role}] ` : ''}${char.shortDescription || ''}`,
        detailedNotes,
        tags: char.tags || ['Karakter'],
        avatarMediaId,
        galleryMediaIds: [],
        attributes: (char.attributes || []).map((attr, idx) => ({
          id: `attr_${idx}`,
          label: attr.label,
          value: attr.value,
        })),
        createdAt: now,
        updatedAt: now,
      };
      await db.worldEntities.add(entity);
    }
  }

  // 4. Seed Locations into World Entities
  if (blueprint.locations && blueprint.locations.length > 0) {
    for (let i = 0; i < blueprint.locations.length; i++) {
      const loc = blueprint.locations[i];
      const locId = 'ent_loc_' + now.toString(36) + i;
      const locBlob = createSvgBlob(loc.name, '#06b6d4', '🏰');
      const locMediaId = await saveMediaItem(bookId, locBlob, `loc-${loc.name}.svg`, locId);

      const entity: WorldEntity = {
        id: locId,
        bookId,
        category: 'location',
        name: loc.name,
        shortDescription: loc.shortDescription || '',
        detailedNotes: loc.detailedNotes || '',
        tags: loc.tags || ['Lokasi'],
        avatarMediaId: locMediaId,
        galleryMediaIds: [],
        attributes: (loc.attributes || []).map((attr, idx) => ({
          id: `attr_${idx}`,
          label: attr.label,
          value: attr.value,
        })),
        createdAt: now,
        updatedAt: now,
      };
      await db.worldEntities.add(entity);
    }
  }

  // 5. Seed Items/Lore into World Entities
  if (blueprint.items && blueprint.items.length > 0) {
    for (let i = 0; i < blueprint.items.length; i++) {
      const itm = blueprint.items[i];
      const itmId = 'ent_itm_' + now.toString(36) + i;
      const itmBlob = createSvgBlob(itm.name, '#eab308', '💎');
      const itmMediaId = await saveMediaItem(bookId, itmBlob, `itm-${itm.name}.svg`, itmId);

      const entity: WorldEntity = {
        id: itmId,
        bookId,
        category: 'item',
        name: itm.name,
        shortDescription: itm.shortDescription || '',
        detailedNotes: itm.detailedNotes || '',
        tags: itm.tags || ['Relik'],
        avatarMediaId: itmMediaId,
        galleryMediaIds: [],
        attributes: (itm.attributes || []).map((attr, idx) => ({
          id: `attr_${idx}`,
          label: attr.label,
          value: attr.value,
        })),
        createdAt: now,
        updatedAt: now,
      };
      await db.worldEntities.add(entity);
    }
  }

  // 6. Seed Chapters into Story Chapters
  if (blueprint.chapters && blueprint.chapters.length > 0) {
    for (let i = 0; i < blueprint.chapters.length; i++) {
      const chap = blueprint.chapters[i];
      const chapId = 'chap_' + now.toString(36) + i;

      const initialHtml = `<h2>${chap.title}</h2><p><em>${chap.premise}</em></p><hr/><p></p>`;

      const chapterRecord: StoryChapter = {
        id: chapId,
        bookId,
        title: chap.title,
        order: chap.order || i + 1,
        status: 'planned',
        premise: chap.premise,
        notes: chap.notes || '',
        contentHtml: initialHtml,
        wordCount: 0,
        targetWordCount: chap.targetWordCount || 1800,
        createdAt: now,
        updatedAt: now,
      };
      await db.chapters.add(chapterRecord);
    }
  }

  return newBook;
}
