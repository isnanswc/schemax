import Dexie, { Table } from 'dexie';
import { Book, StoryChapter, WorldEntity, MediaItem } from '../types';

export class StoryStudioDB extends Dexie {
  books!: Table<Book>;
  chapters!: Table<StoryChapter>;
  worldEntities!: Table<WorldEntity>;
  media!: Table<MediaItem>;

  constructor() {
    super('SchemaxStoryStudioDB');
    this.version(1).stores({
      books: 'id, status, genre, updatedAt, createdAt',
      chapters: 'id, bookId, order, status, updatedAt',
      worldEntities: 'id, bookId, category, updatedAt',
      media: 'id, bookId, entityId, createdAt'
    });
  }
}

export const db = new StoryStudioDB();

// Media helper functions
export async function saveMediaItem(
  bookId: string,
  blob: Blob,
  name: string,
  entityId?: string
): Promise<string> {
  const id = 'med_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
  const mediaItem: MediaItem = {
    id,
    bookId,
    entityId,
    name,
    mimeType: blob.type || 'image/jpeg',
    blob,
    size: blob.size,
    createdAt: Date.now()
  };
  await db.media.add(mediaItem);
  return id;
}

export async function getMediaItem(id: string): Promise<MediaItem | undefined> {
  return await db.media.get(id);
}

export async function deleteMediaItem(id: string): Promise<void> {
  await db.media.delete(id);
}

// Generate an SVG blob for mock/preset covers & avatars
export function createSvgBlob(text: string, bgColor: string, icon = '📖'): Blob {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500" width="400" height="500">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${bgColor}" />
        <stop offset="100%" stop-color="#090d16" />
      </linearGradient>
      <pattern id="pattern" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 40 0 L 0 40 M 0 0 L 40 40" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#grad)" />
    <rect width="100%" height="100%" fill="url(#pattern)" />
    <g transform="translate(200, 200)">
      <circle r="70" fill="rgba(255,255,255,0.08)" />
      <text font-size="70" text-anchor="middle" dominant-baseline="central">${icon}</text>
    </g>
    <text x="200" y="340" font-family="'Plus Jakarta Sans', sans-serif" font-size="24" font-weight="bold" fill="#ffffff" text-anchor="middle">${text.slice(0, 22)}</text>
    <text x="200" y="375" font-family="'Plus Jakarta Sans', sans-serif" font-size="14" fill="rgba(255,255,255,0.6)" text-anchor="middle">SCHEMAX ORIGINAL</text>
  </svg>`;
  return new Blob([svg], { type: 'image/svg+xml' });
}

// Seed initial data if database is empty
export async function seedInitialDataIfNeeded() {
  const bookCount = await db.books.count();
  if (bookCount > 0) return;

  const now = Date.now();
  const sampleBookId = 'book_nusantara_demo';

  // Seed sample covers & avatars into IndexedDB
  const coverBlob = createSvgBlob('Sang Penenun Waktu', '#6366f1', '⏳');
  const coverMediaId = await saveMediaItem(sampleBookId, coverBlob, 'cover-nusantara.svg');

  const charBlob = createSvgBlob('Kaelen', '#ec4899', '🧙‍♂️');
  const charMediaId = await saveMediaItem(sampleBookId, charBlob, 'kaelen-avatar.svg');

  const locBlob = createSvgBlob('Menara Astralis', '#06b6d4', '🏰');
  const locMediaId = await saveMediaItem(sampleBookId, locBlob, 'menara-astralis.svg');

  const itemBlob = createSvgBlob('Kristal Chronos', '#eab308', '💎');
  const itemMediaId = await saveMediaItem(sampleBookId, itemBlob, 'kristal-chronos.svg');

  // 1. Book in Draft
  await db.books.add({
    id: sampleBookId,
    title: 'Sang Penenun Waktu',
    synopsis: 'Di dunia di mana benang takdir dapat dipintal kembali, seorang pemuda dari distrik kumuh menemukan artefak terlarang bernama Chronos.',
    genre: 'Fantasi Sains / Sci-Fi',
    status: 'draft',
    coverMediaId,
    wordCountTarget: 50000,
    currentWordCount: 1420,
    createdAt: now - 86400000 * 3,
    updatedAt: now
  });

  // 2. Book in Released
  const releasedCoverBlob = createSvgBlob('Chronicles of Eldoria', '#10b981', '⚔️');
  const releasedCoverId = await saveMediaItem('book_eldoria_demo', releasedCoverBlob, 'cover-eldoria.svg');

  await db.books.add({
    id: 'book_eldoria_demo',
    title: 'Chronicles of Eldoria: Babak Terakhir',
    synopsis: 'Kisah penjelajahan lima kesatria penjaga segel kuno untuk menahan kebangkitan naga api di belahan benua utara.',
    genre: 'High Fantasy / Epik',
    status: 'released',
    coverMediaId: releasedCoverId,
    wordCountTarget: 80000,
    currentWordCount: 82500,
    createdAt: now - 86400000 * 30,
    updatedAt: now - 86400000 * 2
  });

  // Seed Chapters for Book 1
  await db.chapters.bulkAdd([
    {
      id: 'chap_1',
      bookId: sampleBookId,
      title: 'Bab 1: Menara yang Berguncang',
      order: 1,
      status: 'completed',
      premise: 'Kaelen menyaksikan runtuhnya menara jam kota tua dan menemukan pecahan kristal misterius.',
      notes: 'Tekankan atmosfer dingin dan kabut beracun di kota bawah tanah.',
      contentHtml: '<h2>Bab 1: Menara yang Berguncang</h2><p>Hawa dingin merayap perlahan melalui celah-celah dinding bata basah di Distrik Bawah. Kaelen merapatkan jubah lusuhnya, matanya menatap lekat ke puncak Menara Astralis yang menjulang di tengah kabut kelabu.</p><p>Tiba-tiba, denting jam raksasa terdengar berdentang tak lazim. Bukan dua belas kali, melainkan tiga belas kali. Guncangan dahsyat membelah tanah, dan seberkas cahaya emas kebiruan jatuh tepat di hadapannya.</p><blockquote>"Waktu tidak lagi mengalir maju. Ia telah retak."</blockquote><p>Sebuah kristal segi delapan tergeletak di antara puing-puing, berdenyut seirama dengan detak jantungnya.</p>',
      wordCount: 820,
      targetWordCount: 1000,
      createdAt: now - 86400000 * 2,
      updatedAt: now - 86400000 * 2
    },
    {
      id: 'chap_2',
      bookId: sampleBookId,
      title: 'Bab 2: Bisikan dari Masa Lalu',
      order: 2,
      status: 'in_progress',
      premise: 'Kaelen mencoba meneliti kristal di bengkel rahasianya, lalu dikejar oleh algojo Waktu.',
      notes: 'Perkenalkan karakter Elena sang mekanik.',
      contentHtml: '<h2>Bab 2: Bisikan dari Masa Lalu</h2><p>Di balik pintu besi berkarat bengkel tuanya, lampu pijar berkedip redup. Kaelen meletakkan kristal itu di bawah mikroskop lensa prisma. Jarum pengukur berputar liar seketika.</p><p>Terdengar ketukan keras tiga kali di pintu luar...</p>',
      wordCount: 600,
      targetWordCount: 1500,
      createdAt: now - 86400000,
      updatedAt: now
    },
    {
      id: 'chap_3',
      bookId: sampleBookId,
      title: 'Bab 3: Konspirasi Dewan Takdir',
      order: 3,
      status: 'planned',
      premise: 'Pertemuan rahasia dengan kelompok pemberontak Chrono-Rebels.',
      notes: 'Plot twist: kristal tersebut bukan artefak penyelamat, melainkan bom temporal.',
      contentHtml: '',
      wordCount: 0,
      targetWordCount: 2000,
      createdAt: now,
      updatedAt: now
    }
  ]);

  // Seed Worldbuilding Entities
  await db.worldEntities.bulkAdd([
    {
      id: 'ent_kaelen',
      bookId: sampleBookId,
      category: 'character',
      name: 'Kaelen Vane',
      shortDescription: 'Pemuda yatim piatu berdarah penenun takdir kuno yang bekerja sebagai pemulung komponen mesin.',
      detailedNotes: 'Memiliki bekas luka bakar di tangan kiri yang bereaksi ketika dekat dengan sihir temporal. Sifatnya hati-hati, analitis, namun setia kawan.',
      tags: ['Protagonis', 'Penenun', 'Mekanik'],
      avatarMediaId: charMediaId,
      galleryMediaIds: [],
      attributes: [
        { id: 'attr_1', label: 'Usia', value: '20 Tahun' },
        { id: 'attr_2', label: 'Peran', value: 'Protagonis Utama' },
        { id: 'attr_3', label: 'Faksi', value: 'Rakyat Distrik Bawah' },
        { id: 'attr_4', label: 'Kekuatan', value: 'Manipulasi Retakan Detik' }
      ],
      createdAt: now - 86400000 * 2,
      updatedAt: now
    },
    {
      id: 'ent_astralis',
      bookId: sampleBookId,
      category: 'location',
      name: 'Menara Astralis',
      shortDescription: 'Monumen raksasa dari era kuno yang menopang jam pengatur waktu seluruh kota.',
      detailedNotes: 'Dikelilingi oleh kabut abadi dan dijaga ketat oleh ordo Ksatria Detik.',
      tags: ['Ikonik', 'Pusat Kota', 'Misterius'],
      avatarMediaId: locMediaId,
      galleryMediaIds: [],
      attributes: [
        { id: 'loc_1', label: 'Ketinggian', value: '750 Meter' },
        { id: 'loc_2', label: 'Wilayah', value: 'Sektor Pusat Metropolis' },
        { id: 'loc_3', label: 'Bahaya', value: 'Anomali Gravitasi Sedang' }
      ],
      createdAt: now - 86400000,
      updatedAt: now
    },
    {
      id: 'ent_chronos',
      bookId: sampleBookId,
      category: 'item',
      name: 'Kristal Chronos',
      shortDescription: 'Pecahan inti dari jam purba yang dapat menghentikan waktu selama 7 detik.',
      detailedNotes: 'Setiap kali digunakan, ingatan masa kecil penggunanya akan terkikis sedikit demi sedikit.',
      tags: ['Relik Kuno', 'Legendaris', 'Berbahaya'],
      avatarMediaId: itemMediaId,
      galleryMediaIds: [],
      attributes: [
        { id: 'it_1', label: 'Tipe', value: 'Artefak Temporal Kuno' },
        { id: 'it_2', label: 'Efek Samping', value: 'Amnesia Parsial' },
        { id: 'it_3', label: 'Kelangkaan', value: 'Tier S / Unik' }
      ],
      createdAt: now,
      updatedAt: now
    }
  ]);
}
