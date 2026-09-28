import { StoryBlueprint } from '../types/blueprint';
import { Book, WorldEntity, StoryChapter } from '../types';
import { generateWithSmartFallback } from './aiService';
import { AIGenerationEvent } from '../types/ai';
import { db, saveMediaItem, createSvgBlob } from '../db';

export interface BlueprintProgressInfo {
  stage: 'compressing' | 'architecting' | 'parsing';
  stageTitle: string;
  stageSubtitle: string;
  attempt?: AIGenerationEvent;
}

export type BlueprintProgressCallback = (info: BlueprintProgressInfo) => void;

/**
 * Smart input preprocessing: If the idea text is very large (>5000 chars / ~3000+ words),
 * we first compress it into a structured summary via AI, then pass that summary as the
 * input for blueprint generation. This avoids token limit failures for large pastes.
 */
async function preprocessLargeIdea(
  rawIdea: string,
  onProgress?: BlueprintProgressCallback
): Promise<string> {
  // Under 5000 chars — send as-is
  if (rawIdea.length <= 5000) return rawIdea;

  onProgress?.({
    stage: 'compressing',
    stageTitle: 'Meringkas Naskah / Premis Panjang...',
    stageSubtitle: `Teks besar terdeteksi (${Math.round(rawIdea.length / 1000)}rb karakter). AI sedang mengekstrak inti cerita agar tidak melebihi kuota token.`,
  });

  const summaryPrompt = `Ringkas dan ekstrak ELEMEN PENTING dari teks berikut menjadi sebuah premis cerita yang padat dan terstruktur. Fokus pada:
1. Siapa tokoh utamanya (nama, hubungan antar tokoh, keluarga)
2. Apa kejadian / masalah / konflik utamanya
3. Apa dampak / akibat yang terjadi
4. Setting / latar cerita

Teks Asli (bisa berupa naskah/cerita/outline/catatan):
${rawIdea.slice(0, 12000)}

Keluarkan HANYA paragraf premis/ringkasan padat dalam Bahasa Indonesia tanpa judul atau pengantar, maksimal 500 kata.`;

  const systemMsg = 'Anda adalah editor sastra yang ahli meringkas dan mengekstrak inti cerita dari teks panjang.';
  try {
    const result = await generateWithSmartFallback(summaryPrompt, systemMsg, (event) => {
      onProgress?.({
        stage: 'compressing',
        stageTitle: 'Meringkas Naskah / Premis Panjang...',
        stageSubtitle: `Teks besar terdeteksi (${Math.round(rawIdea.length / 1000)}rb karakter). AI sedang mengekstrak inti cerita.`,
        attempt: event,
      });
    });
    return `[DIKOMPRESI DARI TEKS PANJANG — ${rawIdea.length} KARAKTER]\n\n${result.text.trim()}`;
  } catch {
    // If compression fails, just truncate gracefully
    return rawIdea.slice(0, 5000) + '\n\n[...teks terpotong karena terlalu panjang, lanjutkan dengan yang sudah ada]';
  }
}

export async function generateStoryBlueprint(
  rawIdea: string,
  onProgress?: BlueprintProgressCallback
): Promise<StoryBlueprint> {

  const systemPrompt = `Kamu adalah Arsitek Cerita Fiksi Tingkat Master (Master Story Architect & Worldbuilder).
Tugasmu: Menganalisa satu ide/premis mentah dari penulis dan merancang BLUEPRINT PROYEK CERITA NOVEL LENGKAP berstandar sastra profesional.

KECERDASAN ANALISA KONTEKS:
1. DETEKSI ENTITAS & RELASI KELUARGA:
   - Jika premis menyebut nama seseorang (misal: "Agung") dan "istrinya Santi" atau keluarga yang hilang ingatan, kenali dinamika keluarga ini secara cerdas.
   - Sarankan karakter-karakter yang terlibat secara utuh (misal: Suami/Kepala Keluarga, Istri, Anak/Orang Tua/Mertua, atau Tetangga/Sahabat).
   - Berikan informasi CIRI FISIK konkret (wajah, tinggi/postur, warna kulit, gaya rambut, pakaian khas bernuansa lokal Indonesia jika latar Indonesia), USIA, dan SIFAT/WATAK (kepribadian, kelebihan, kelemahan batin/wound).
2. PILIHAN JUDUL:
   - Berikan 3 pilihan judul buku yang puitis, memikat, dan memiliki nilai jual ("titleOptions"). Pilih satu sebagai "title" utama.
   - Berikan 3 pilihan judul bab pertama ("firstChapterTitleOptions").
3. RINGKASAN & PILIHAN LANJUTAN ALUR (CONTINUATIONS):
   - Buat ringkasan cerita inti (synopsis).
   - Berikan 3 OPSI KELANJUTAN CERITA ("storyContinuations") yang berbeda arah konflik (misal: Opsi A fokus pada misteri benda/cincin, Opsi B fokus pada drama emosional rumah tangga, Opsi C ancaman pihak ketiga/pemilik asli cincin).
4. GAYA PENULISAN & SUDUT PANDANG:
   - Sarankan Sudut Pandang ("pointOfView": misal 'Orang Ketiga Terbatas (Menyorot Protagonis)' atau 'Orang Pertama').
   - Sarankan Gaya Penulisan ("writingStyle": misal 'Realis Emosional Penuh Ketegangan & Deskriptif Panca Indera').
5. LOKASI & ITEM/RELIK:
   - Lokasi relevan (misal: Rumah Keluarga, Tempat Penemuan Barang Misterius, dsb.).
   - Item misterius dengan dampak/aturan supranaturalnya.
6. BAB PEMBUKA (HANYA BAB 1 SAJA):
   - Rancang HANYA BAB 1 (Bab Pembuka) secara mendalam dengan "title", "premise" (alur ketukan adegan berurutan yang spesifik), dan "notes". Jangan buat bab lain, cukup Bab 1 saja!

WAJIB MERESPON HANYA DENGAN FORMAT JSON VALID:
{
  "title": "Judul Buku Pilihan Utama",
  "titleOptions": ["Opsi Judul 1", "Opsi Judul 2", "Opsi Judul 3"],
  "firstChapterTitleOptions": ["Bab 1: Opsi Judul A", "Bab 1: Opsi Judul B", "Bab 1: Opsi Judul C"],
  "genre": "Drama Supranatural & Misteri",
  "logline": "1-2 kalimat dramatis yang merangkum siapa tokoh, konflik inti, dan taruhan terbesarnya.",
  "synopsis": "Sinopsis lengkap alur cerita (minimal 2 paragraf padat).",
  "thematicCore": "Pesan emosional / filosofis utama cerita.",
  "storyContinuations": [
    {
      "id": "opt_1",
      "title": "Fokus Pemulihan Ingatan & Rahasia Keluarga",
      "description": "Protagonis berjuang meyakinkan pasangannya sambil mengungkap memori kelam keluarga yang terkunci di dalam artefak."
    },
    {
      "id": "opt_2",
      "title": "Ancaman Pemilik Asli Benda Misterius",
      "description": "Sosok gaib atau kelompok pemburu artefak datang menagih tumbal atas benda yang dibawa pulang."
    },
    {
      "id": "opt_3",
      "title": "Penyebaran Efek Anomali ke Lingkungan Sekitar",
      "description": "Bukan hanya keluarga, satu per satu tetangga mulai melupakan eksistensi protagonis di kampung halamannya."
    }
  ],
  "pointOfView": "Orang Ketiga Terbatas (Third Person Limited)",
  "writingStyle": "Emosional, Penuh Ketegangan Batin, Deskriptif Panca Indera & Dialog Bernas",
  "settingTimeAndTone": "Indonesia Kontemporer / Realitas Lokal bernuansa Misteri Hangat",
  "characters": [
    {
      "name": "Nama Karakter",
      "role": "Protagonis / Suami",
      "age": "28 Tahun",
      "physicalTraits": "Pria berwajah teduh namun lelah, tinggi 172 cm, kulit sawo matang, rambut ikal pendek agak berantakan, mengenakan jaket katun lusuh.",
      "traits": "Penyayang, pekerja keras, keras kepala, mudah cemas saat keluarga dalam bahaya.",
      "visualPrompt": "Full body portrait standing upright, centered, Indonesian man in his late 20s, tan skin, short wavy black hair, exhausted and anxious gaze reflecting emotional turmoil, wearing a weathered brown cotton jacket over a plain t-shirt and dark jeans, neutral cinematic studio lighting, photorealistic skin textures, 8k resolution, vertical mobile phone aspect ratio 9:16",
      "shortDescription": "Pemuda yang menemukan benda misterius dan menjadi orang asing di rumahnya sendiri.",
      "want": "Mengembalikan ingatan keluarganya agar mengenalinya kembali.",
      "need": "Menerima bahwa kebahagiaan keluarga tidak bisa dibangun di atas kebohongan atau jalan pintas.",
      "flawOrWound": "Merasa bersalah karena kegagalannya menafkahi keluarga dengan layak.",
      "attributes": [
        { "label": "Peran", "value": "Kepala Keluarga" },
        { "label": "Pekerjaan", "value": "Pekerja Lepas" }
      ],
      "tags": ["Protagonis", "Keluarga"]
    },
    {
      "name": "Nama Istri / Pasangan",
      "role": "Istri Protagonis",
      "age": "26 Tahun",
      "physicalTraits": "Wanita berparas manis khas nusantara, rambut sebahu diikat sederhana, tatapan mata waspada dan defensif, daster batik rapi.",
      "traits": "Tegas, protektif terhadap rumah, curigaan terhadap orang asing, sebenarnya rapuh di dalam batin.",
      "visualPrompt": "Full body portrait standing upright, centered, Indonesian woman in her mid 20s, light brown skin, shoulder-length black hair tied in a simple ponytail, guarded defensive facial expression with sharp suspicious eyes, wearing a tidy traditional patterned batik homedress (daster batik), soft cinematic lighting, 8k resolution, photorealistic textures, vertical mobile phone aspect ratio 9:16",
      "shortDescription": "Istri yang kehilangan ingatan tentang suaminya dan mengiranya sebagai penyusup.",
      "want": "Melindungi rumah dan ketenangannya dari pria asing yang mengaku suaminya.",
      "need": "Mengingat kembali ikatan cinta tulus yang pernah ada.",
      "flawOrWound": "Trauma terhadap orang asing di masa kecil.",
      "attributes": [
        { "label": "Status", "value": "Kehilangan Ingatan" }
      ],
      "tags": ["Istri", "Inti Konflik"]
    }
  ],
  "locations": [
    {
      "name": "Rumah Keluarga",
      "shortDescription": "Rumah sederhana berdinding bata ekspos dengan pagar kayu kecil di pinggiran kota.",
      "detailedNotes": "Tempat yang dulunya penuh kehangatan, kini menjadi tempat paling asing dan mencekam bagi protagonis.",
      "attributes": [
        { "label": "Tipe", "value": "Hunian Pribadi" }
      ],
      "tags": ["Lokasi Utama"]
    }
  ],
  "items": [
    {
      "name": "Cincin Berukir Aksara Kuno",
      "shortDescription": "Cincin perak kusam dengan motif melingkar seperti pusaran air yang tidak pernah berujung.",
      "detailedNotes": "Benda pemicu yang menghapus memori orang-orang di sekitar pembawanya tentang keberadaan si pembawa.",
      "attributes": [
        { "label": "Efek", "value": "Amnesia Kolektif Temporal" }
      ],
      "tags": ["Artefak Pemicu"]
    }
  ],
  "chapters": [
    {
      "title": "Bab 1: Mengetuk Pintu Rumah Sendiri",
      "order": 1,
      "premise": "1. Protagonis pulang ke rumah membawa benda misterius yang ia temukan siang tadi.\\n2. Sang istri menyambut di pintu dengan wajah ketakutan dan berteriak memanggil tetangga mengira ia adalah maling.\\n3. Protagonis syok melihat seluruh foto pernikahan dan jejak keberadaannya di rumah tiba-tiba lenyap.",
      "notes": "Hadirkan atmosfer kebingungan yang mencekam dan luka emosional yang mendalam.",
      "targetWordCount": 1800
    }
  ]
}`;

  // Preprocess: if idea is very long (naskah panjang / outline tebal), compress it first
  const processedIdea = await preprocessLargeIdea(rawIdea, onProgress);

  onProgress?.({
    stage: 'architecting',
    stageTitle: 'Merancang Blueprint Proyek Sastra...',
    stageSubtitle: 'Menganalisis dinamika karakter, watak, latar dunia, relik, dan plot Bab 1.',
  });

  const userPrompt = `Rancang Blueprint Proyek Cerita lengkap berdasarkan ide/premis mentah berikut:
"${processedIdea}"

Instruksi Analisa Cerdas:
- Pahami relasi karakter dalam ide tersebut secara mendalam (misal keluarga, pasangan, sahabat, dsb.).
- Buat karakter lengkap dengan usia, ciri fisik konkret, dan watak/sifat.
- Buat 3 opsi kelanjutan alur yang memikat.
- Rancang alur bab pembuka (Bab 1) secara mendalam dan siap dipakai sebagai Story Plot.
- Tentukan gaya penulisan (writingStyle) yang paling cocok: bisa sastra puitis, emosional realistis, modern kasual santai (slang lu-gua / diksi kekinian), atau nuansa kultural dialek daerah jika ide mengarah ke sana.
- Respon HANYA teks JSON valid.`;

  const response = await generateWithSmartFallback(userPrompt, systemPrompt, (event) => {
    onProgress?.({
      stage: 'architecting',
      stageTitle: 'Merancang Blueprint Proyek Sastra...',
      stageSubtitle: 'Menganalisis dinamika karakter, watak, latar dunia, relik, dan plot Bab 1.',
      attempt: event,
    });
  });

  onProgress?.({
    stage: 'parsing',
    stageTitle: 'Memvalidasi & Mengurai Struktur Blueprint...',
    stageSubtitle: 'Menyusun karakter, relasi, dan bab ke format database lokal.',
  });

  let cleanText = response.text.trim();
  if (cleanText.startsWith('```json')) {
    cleanText = cleanText.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  } else if (cleanText.startsWith('```')) {
    cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }

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

  // Incorporate continuation and style notes into book synopsis
  let enrichedSynopsis = '';
  if (blueprint.logline) {
    enrichedSynopsis += `${blueprint.logline}\n\n`;
  }
  enrichedSynopsis += blueprint.synopsis || '';
  if (blueprint.selectedContinuation) {
    enrichedSynopsis += `\n\n[Arah Alur Terpilih]:\n${blueprint.selectedContinuation}`;
  }
  if (blueprint.pointOfView || blueprint.writingStyle) {
    enrichedSynopsis += `\n\n[Pedoman Gaya & Sudut Pandang]:\n• Sudut Pandang: ${blueprint.pointOfView || 'Orang Ketiga Terbatas'}\n• Gaya Penulisan: ${blueprint.writingStyle || 'Deskriptif & Emosional'}`;
  }

  // 2. Create Book entry
  const newBook: Book = {
    id: bookId,
    title: blueprint.title,
    synopsis: enrichedSynopsis,
    genre: blueprint.genre || 'Fiksi',
    status: 'draft',
    coverMediaId,
    wordCountTarget: (blueprint.chapters.length || 3) * 1800,
    currentWordCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  await db.books.add(newBook);

  // 3. Seed Characters into World Entities with Physical Traits & Personality Traits
  if (blueprint.characters && blueprint.characters.length > 0) {
    const characterIcons = ['🧙‍♂️', '⚔️', '🎭', '👑', '🏹', '👤'];
    for (let i = 0; i < blueprint.characters.length; i++) {
      const char = blueprint.characters[i];
      const charId = 'ent_char_' + now.toString(36) + i;
      const avatarBlob = createSvgBlob(char.name, '#ec4899', characterIcons[i % characterIcons.length]);
      const avatarMediaId = await saveMediaItem(bookId, avatarBlob, `avatar-${char.name}.svg`, charId);

      const detailedNotes = [
        char.role ? `• Peran: ${char.role}` : '',
        char.age ? `• Usia: ${char.age}` : '',
        char.want ? `• Keinginan (Want): ${char.want}` : '',
        char.need ? `• Kebutuhan Batin (Need): ${char.need}` : '',
        char.flawOrWound ? `• Luka Masa Lalu: ${char.flawOrWound}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      const attributesList = [
        ...(char.age ? [{ id: 'attr_age', label: 'Usia', value: char.age }] : []),
        ...(char.role ? [{ id: 'attr_role', label: 'Peran', value: char.role }] : []),
        ...(char.attributes || []).map((attr, idx) => ({
          id: `attr_${idx}`,
          label: attr.label,
          value: attr.value,
        })),
      ];

      const entity: WorldEntity = {
        id: charId,
        bookId,
        category: 'character',
        name: char.name,
        shortDescription: `${char.role ? `[${char.role}] ` : ''}${char.shortDescription || ''}`,
        detailedNotes,
        physicalTraits: char.physicalTraits || undefined,
        visualPrompt: char.visualPrompt || undefined,
        initialTraits: char.traits || undefined,
        currentTraits: char.traits || undefined,
        condition: 'aktif',
        conditionDetails: 'Kondisi awal di pembuka cerita',
        tags: char.tags || ['Karakter'],
        avatarMediaId,
        galleryMediaIds: [],
        attributes: attributesList,
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
        condition: 'aktif',
        conditionDetails: 'Lokasi aktif',
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
        condition: 'aktif',
        conditionDetails: 'Item aktif dalam cerita',
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

  // 6. Seed Chapters into Story Chapters with STORY PLOT pre-filled!
  if (blueprint.chapters && blueprint.chapters.length > 0) {
    for (let i = 0; i < blueprint.chapters.length; i++) {
      const chap = blueprint.chapters[i];
      const chapId = 'chap_' + now.toString(36) + i;

      const chapterRecord: StoryChapter = {
        id: chapId,
        bookId,
        title: chap.title,
        order: chap.order || i + 1,
        status: 'planned',
        premise: chap.premise,
        notes: chap.notes || '',
        rawDrafts: [
          {
            id: 'plot_' + chapId,
            title: 'Story Plot',
            content: chap.premise,
            createdAt: now,
            updatedAt: now,
          },
        ],
        contentHtml: '',
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
