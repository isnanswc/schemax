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
1. DETEKSI ENTITAS & PROFIL KARAKTER MENDALAM:
   - Pahami relasi karakter secara utuh (misal: Suami/Kepala Keluarga, Istri, Anak, Orang Tua/Mertua, atau Sahabat/Rival).
   - CIRI FISIK WAJIB SANGAT DETAIL (walaupun tanpa foto referensi):
     * Wajah & Mata: bentuk wajah (oval, tirus, rahang tegas), bentuk dan sorot mata, alis, bentuk hidung, bibir, serta ekspresi wajah.
     * Keragaman Kulit & Etnis Nusantara: Jangan stereotipikal hanya 'kulit sawo matang'! Masyarakat Indonesia dan dunia sangat beragam (ada kulit kuning langsat, putih gading, sawo matang bersih, cerah berseri, kecokelatan hangat). Tokoh bisa berlatar Sunda, Jawa, Melayu, Tionghoa/Chindo, Minang, Dayak, dsb.
     * Bentuk & Proporsi Tubuh Nyata: Gambarkan siluet dan proporsi tubuh dengan jelas dan hidup (misal: proporsi tubuh sintal / semok berlekuk jam pasir (hourglass) yang memikat dan proporsional, ramping semampai, atletis berotot, tegap berisi, atau mungil petite).
     * Rambut: tekstur (lurus lembut, bergelombang, ikal), panjang (tergerai sebahu, dicepol santai, dipotong rapi), dan warna rambut.
   - KONTEKSTUALISASI PROFESI, PERAN & KEADAAN (BUSANA, LATAR & POSE):
     * Gaya pakaian, latar belakang (background/setting), dan pose WAJIB disesuaikan dengan profesi, peran, dan kondisi karakter:
       - Pedagang: apron/baju kerja berlatar kios/pasar/toko ramai.
       - Polisi: seragam dinas polisi atau taktis dengan lencana berlatar pos/kantor polisi atau jalan patroli perkotaan.
       - Penyihir: jubah mistis bersulam rune dengan tongkat sihir berlatar perpustakaan sihir kuno atau laboratorium alkimia penuh buku mantera dan kristal berpendar.
       - Ksatria: baju zirah pelindung (plate armor) gagah berlatar benteng batu kuno atau halaman istana.
       - Ilmuwan: jas lab putih bersih dengan kacamata/instrumen sains berlatar laboratorium berteknologi tinggi.
       - Ibu Rumah Tangga: daster katun santai polos bersih atau busana kasual rumah yang nyaman berlatar dapur atau ruang keluarga hangat.
       - Anak Sekolah / Pelajar: seragam sekolah rapi dengan tas ransel berlatar lorong loker sekolah atau ruang kelas cerah.
       - Karakter profesi lain (dokter, seniman, bangsawan, pemburu, petani, atlet, dsb): sesuaikan secara logis dan mendalam.
     * DILARANG KERAS selalu memaksakan pakaian tradisional seperti 'batik', 'kebaya', atau baju adat jika bukan adegan upacara adat/pernikahan resmi!
   - ATURAN MUTLAK VISUAL PROMPT (MENGHADAP KAMERA & WAJAH JELAS):
     * Karakter WAJIB MENGHADAP LANGSUNG KE ARAH KAMERA (standing upright facing camera directly, looking straight into lens).
     * Postur berdiri tegap dan fitur wajah wajib jelas, tajam, terang, dan tidak terhalang (clear sharp facial features, well-lit frontal lighting).
     * Latar belakang profesi harus memiliki efek shallow depth of field / cinematic background blur agar karakter tetap menjadi subjek utama yang paling tajam.
     * Format visualPrompt: 'Full body portrait standing upright facing camera directly, centered composition, looking straight into lens, [ethnicity/appearance], [age] years old, youthful radiant glowing skin, [detailed facial features and sharp expression], [hair style and color], [body shape and silhouette: e.g. curvy voluptuous hourglass silhouette with attractive feminine curves / slender graceful build / athletic toned physique], wearing [role-contextual attire: e.g. police tactical uniform / merchant apron / ornate mage robe / knight plate armor / scientist lab coat / cozy simple homedress for housewife / neat student uniform], in a contextual [role-matched atmospheric setting: e.g. bustling shop / modern police station / mystic library / stone fortress / high-tech laboratory / cozy sunlit kitchen / school hallway] with shallow depth of field background blur, sharp well-lit facial features, cinematic lighting, 8k resolution, photorealistic masterpiece, vertical 9:16 aspect ratio, --ar 9:16'.
     * JANGAN gunakan kata 'mature', 'aged', 'wrinkled' untuk tokoh muda agar generator AI tidak membuat wajahnya tampak tua!
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
      "name": "Agung",
      "role": "Protagonis / Suami",
      "age": "27 Tahun",
      "physicalTraits": "Pria berwajah ramah dengan rahang tegas, tinggi 174 cm, kulit kuning langsat bersih, rambut hitam lurus bertekstur rapi, mata sayu menahan beban emosional, postur tegap berisi sehat. Mengenakan kemeja polo bermotif kotak kasual warna navy-putih dan celana panjang chino gelap.",
      "traits": "Penyayang, pekerja keras, gigih melindungi orang tersayang, mudah cemas saat keluarga dalam bahaya.",
      "visualPrompt": "Full body portrait standing upright facing camera directly, centered, looking straight into lens, attractive youthful Southeast Asian Indonesian man, 27 years old, clear glowing youthful skin, neat straight black hair, anxious yet resolute warm brown eyes, fit healthy posture, wearing a modern casual plaid polo shirt in navy and white patterns with clean tailored dark trousers, standing inside a warm home living room with soft natural window rim lighting, shallow depth of field background blur, clear sharp facial features, 8k resolution, photorealistic masterpiece, vertical 9:16 aspect ratio, --ar 9:16",
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
      "name": "Santi",
      "role": "Istri Protagonis",
      "age": "24 Tahun",
      "physicalTraits": "Wanita muda berwajah manis dengan dagu lancip, tinggi 160 cm, kulit cerah gading halus, rambut hitam bergelombang lembut sebahu yang diikat longgar, tatapan mata waspada dan defensif. Memiliki proporsi tubuh sintal dengan lekuk jam pasir (hourglass) yang feminin dan terawat. Mengenakan daster santai rumahan sederhana berwarna pastel polos yang nyaman dan bersahaja.",
      "traits": "Tegas, protektif terhadap rumah, curigaan terhadap orang asing, sebenarnya rapuh di dalam batin.",
      "visualPrompt": "Full body portrait standing upright facing camera directly, centered, looking straight into lens, gorgeous youthful Indonesian woman, 24 years old, radiant youthful glowing skin, smooth beautiful face with sharp guarded eyes, wavy black hair loosely tied, stunning curvy hourglass body silhouette with attractive feminine proportions, wearing a simple modern comfortable pastel cotton house dress (simple homedress), standing in a cozy sunlit home kitchen with soft ambient cinematic lighting, shallow depth of field background blur, sharp visible facial details, photorealistic skin textures, 8k resolution, vertical 9:16 aspect ratio, --ar 9:16",
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
- CIRI FISIK SANGAT DETAIL: Setiap karakter WAJIB memiliki detail ciri fisik lengkap (bentuk wajah, mata, rambut, warna kulit beragam tanpa stereotip sawo matang saja, serta proporsi tubuh nyata seperti sintal/semok berlekuk hourglass atau ramping).
- LATAR, BUSANA & POSE SESUAI PROFESI/KEADAAN: Sesuaikan gaya pakaian, latar belakang (background), dan pose dengan peran/profesi karakter (misal: pedagang di toko/pasar, polisi berseragam di kantor/jalan kota, penyihir berjubah di menara perpustakaan sihir, ksatria berzirah di benteng, ilmuwan berjas lab di laboratorium, ibu rumah tangga berdaster santai di dapur/ruang keluarga hangat, anak sekolah berseragam di lorong sekolah, dsb).
- ATURAN MUTLAK KAMERA & POSE: Di visual prompt, karakter WAJIB MENGHADAP LANGSUNG KE KAMERA (facing camera directly, looking straight into lens) dengan wajah dan postur tubuh yang jelas dan terang, dengan latar bersiluet cinematic bokeh/shallow depth of field agar fokus utama tetap pada karakter. Pertahankan kemudaan wajah (youthful radiant skin). DILARANG memaksakan batik atau kebaya jika bukan acara adat!
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

  let rawParsed: any;
  try {
    rawParsed = JSON.parse(cleanText);
  } catch (err: any) {
    console.error('Gagal parsing JSON Blueprint:', cleanText);
    throw new Error('Gagal mengurai respons AI menjadi struktur proyek. Format JSON tidak lengkap. Silakan coba kembali.');
  }

  // Normalisasi & Fallback Null-Safety Lengkap untuk mencegah layar blank jika AI mengembalikan field kosong/null
  const normalizedBlueprint: StoryBlueprint = {
    title: rawParsed.title || 'Karya Cerita Baru',
    titleOptions: Array.isArray(rawParsed.titleOptions) && rawParsed.titleOptions.length > 0
      ? rawParsed.titleOptions
      : [rawParsed.title || 'Karya Cerita Baru'],
    firstChapterTitleOptions: Array.isArray(rawParsed.firstChapterTitleOptions)
      ? rawParsed.firstChapterTitleOptions
      : [],
    genre: rawParsed.genre || 'Fiksi Drama / Misteri',
    logline: rawParsed.logline || '',
    synopsis: rawParsed.synopsis || rawParsed.logline || 'Sinopsis cerita belum diuraikan.',
    thematicCore: rawParsed.thematicCore || '',
    storyContinuations: Array.isArray(rawParsed.storyContinuations) ? rawParsed.storyContinuations : [],
    selectedContinuation:
      rawParsed.selectedContinuation ||
      (Array.isArray(rawParsed.storyContinuations) && rawParsed.storyContinuations[0]
        ? `${rawParsed.storyContinuations[0].title}: ${rawParsed.storyContinuations[0].description}`
        : ''),
    writingStyle: rawParsed.writingStyle || 'Emosional, Penuh Ketegangan Batin & Realistis',
    pointOfView: rawParsed.pointOfView || 'Orang Ketiga Terbatas (Menyorot Tokoh Utama)',
    settingTimeAndTone: rawParsed.settingTimeAndTone || '',
    characters: Array.isArray(rawParsed.characters)
      ? rawParsed.characters.map((c: any) => ({
          name: c.name || 'Tokoh Tanpa Nama',
          role: c.role || 'Keluarga / Kerabat',
          age: c.age || '25 Tahun',
          physicalTraits: c.physicalTraits || '',
          traits: c.traits || '',
          visualPrompt: c.visualPrompt || '',
          shortDescription: c.shortDescription || c.role || '',
          want: c.want || '',
          need: c.need || '',
          flawOrWound: c.flawOrWound || '',
          attributes: Array.isArray(c.attributes) ? c.attributes : [],
          tags: Array.isArray(c.tags) ? c.tags : ['Karakter'],
        }))
      : [],
    locations: Array.isArray(rawParsed.locations)
      ? rawParsed.locations.map((l: any) => ({
          name: l.name || 'Lokasi Cerita',
          shortDescription: l.shortDescription || '',
          detailedNotes: l.detailedNotes || l.shortDescription || '',
          attributes: Array.isArray(l.attributes) ? l.attributes : [],
          tags: Array.isArray(l.tags) ? l.tags : ['Lokasi'],
        }))
      : [],
    items: Array.isArray(rawParsed.items)
      ? rawParsed.items.map((it: any) => ({
          name: it.name || 'Artefak / Relik',
          shortDescription: it.shortDescription || '',
          detailedNotes: it.detailedNotes || it.shortDescription || '',
          attributes: Array.isArray(it.attributes) ? it.attributes : [],
          tags: Array.isArray(it.tags) ? it.tags : ['Artefak'],
        }))
      : [],
    chapters: Array.isArray(rawParsed.chapters) && rawParsed.chapters.length > 0
      ? rawParsed.chapters.map((ch: any, idx: number) => ({
          title: ch.title || `Bab ${idx + 1}: Permulaan`,
          order: ch.order || idx + 1,
          premise: ch.premise || '',
          notes: ch.notes || '',
          targetWordCount: ch.targetWordCount || 1800,
        }))
      : [
          {
            title: 'Bab 1: Permulaan yang Retak',
            order: 1,
            premise: 'Peristiwa awal pemicu konflik dimulai di sini.',
            notes: 'Fokus pada atmosfer dan pengenalan ketegangan awal.',
            targetWordCount: 1800,
          },
        ],
  };

  return normalizedBlueprint;
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
