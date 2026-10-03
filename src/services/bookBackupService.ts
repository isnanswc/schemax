import { db, TTSAudioCacheItem } from '../db';
import { generateTTSCacheId } from './ttsCacheService';
import {
  Book,
  StoryChapter,
  WorldEntity,
  MediaItem,
  CharacterChatSession,
  MediaCategory,
} from '../types';

export interface BackupMediaItem {
  id: string;
  bookId: string;
  chapterId?: string;
  entityId?: string;
  category?: MediaCategory;
  tags?: string[];
  caption?: string;
  aiDescription?: string;
  aiNarrativeIntro?: string;
  name: string;
  mimeType: string;
  base64Data: string;
  size: number;
  createdAt: number;
}

export interface BackupTTSAudioItem {
  id: string;
  chapterId?: string;
  paragraphIndex: number;
  textHash: string;
  engine: string;
  model: string;
  voice: string;
  base64Data: string;
  mimeType: string;
  createdAt: number;
  updatedAt: number;
}

export interface SchemaxBookBackupBundle {
  schemaVersion: number;
  app: 'Schemax Story Studio';
  exportedAt: string;
  book: Book;
  chapters: StoryChapter[];
  entities: WorldEntity[];
  media: BackupMediaItem[];
  ttsAudioCaches: BackupTTSAudioItem[];
  characterChats?: CharacterChatSession[];
}

export interface BackupPreviewStats {
  bookTitle: string;
  genre: string;
  status: string;
  chapterCount: number;
  totalWords: number;
  entityCount: number;
  mediaCount: number;
  ttsAudioCount: number;
  characterChatCount: number;
  exportedAt: string;
  fileSizeBytes?: number;
  existsLocally: boolean;
}

/**
 * Konversi Blob biner ke string Base64 Data URL
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Konversi string Base64 (Data URL atau plain Base64) kembali menjadi Blob biner
 */
export function base64ToBlob(base64: string, defaultMime = 'application/octet-stream'): Blob {
  try {
    let mimeType = defaultMime;
    let byteCharacters = '';
    if (base64.includes(';base64,')) {
      const parts = base64.split(';base64,');
      mimeType = parts[0].replace('data:', '') || defaultMime;
      byteCharacters = atob(parts[1]);
    } else {
      byteCharacters = atob(base64);
    }

    const byteNumbers = new Uint8Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    return new Blob([byteNumbers], { type: mimeType });
  } catch (err) {
    console.error('Gagal konversi Base64 ke Blob:', err);
    return new Blob([], { type: defaultMime });
  }
}

/**
 * Buat paket cadangan lengkap untuk suatu buku (termasuk media gambar & audio TTS AI)
 */
export async function createBookBackupBundle(
  bookId: string,
  onProgress?: (message: string, percent: number) => void
): Promise<SchemaxBookBackupBundle> {
  onProgress?.('Membaca data buku & naskah...', 10);
  const book = await db.books.get(bookId);
  if (!book) {
    throw new Error(`Buku dengan ID "${bookId}" tidak ditemukan.`);
  }

  onProgress?.('Mengambil seluruh bab cerita...', 25);
  const chapters = await db.chapters.where('bookId').equals(bookId).sortBy('order');

  onProgress?.('Mengambil ensiklopedia & relasi karakter...', 40);
  const entities = await db.worldEntities.where('bookId').equals(bookId).toArray();

  onProgress?.('Mengumpulkan galeri gambar & sampul...', 55);
  const rawMedia = await db.media.where('bookId').equals(bookId).toArray();
  const backupMedia: BackupMediaItem[] = [];

  for (let i = 0; i < rawMedia.length; i++) {
    const item = rawMedia[i];
    onProgress?.(`Mengemas gambar ${i + 1}/${rawMedia.length}...`, 55 + Math.round((i / (rawMedia.length || 1)) * 20));
    let base64Data = '';
    if (item.blob) {
      base64Data = await blobToBase64(item.blob);
    }
    backupMedia.push({
      id: item.id,
      bookId: item.bookId,
      chapterId: item.chapterId,
      entityId: item.entityId,
      category: item.category,
      tags: item.tags,
      caption: item.caption,
      aiDescription: item.aiDescription,
      aiNarrativeIntro: item.aiNarrativeIntro,
      name: item.name,
      mimeType: item.mimeType,
      base64Data,
      size: item.size || 0,
      createdAt: item.createdAt,
    });
  }

  onProgress?.('Mengumpulkan audio AI TTS yang telah digenerate...', 78);
  const chapterIds = chapters.map((c) => c.id);
  const bookTTS = chapterIds.length > 0
    ? await db.ttsAudioCaches.where('chapterId').anyOf(chapterIds).toArray()
    : [];
  const backupTTS: BackupTTSAudioItem[] = [];

  for (let j = 0; j < bookTTS.length; j++) {
    const tts = bookTTS[j];
    onProgress?.(`Mengemas audio TTS ${j + 1}/${bookTTS.length}...`, 78 + Math.round((j / (bookTTS.length || 1)) * 15));
    let base64Audio = '';
    if (tts.audioBlob) {
      base64Audio = await blobToBase64(tts.audioBlob);
    }
    backupTTS.push({
      id: tts.id,
      chapterId: tts.chapterId,
      paragraphIndex: tts.paragraphIndex,
      textHash: tts.textHash,
      engine: tts.engine,
      model: tts.model,
      voice: tts.voice,
      base64Data: base64Audio,
      mimeType: tts.mimeType,
      createdAt: tts.createdAt,
      updatedAt: tts.updatedAt,
    });
  }

  onProgress?.('Mengemas percakapan roleplay karakter...', 95);
  const characterChats = await db.characterChats.where('bookId').equals(bookId).toArray();

  onProgress?.('Paket cadangan selesai dibuat!', 100);
  return {
    schemaVersion: 1,
    app: 'Schemax Story Studio',
    exportedAt: new Date().toISOString(),
    book,
    chapters,
    entities,
    media: backupMedia,
    ttsAudioCaches: backupTTS,
    characterChats,
  };
}

export function getBackupFileName(bookTitle: string): string {
  const safeTitle = bookTitle
    .replace(/[^a-zA-Z0-9_\-\s]/g, '')
    .trim()
    .replace(/\s+/g, '_') || 'buku';
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
  return `${safeTitle}_backup_${dateStr}_${timeStr}.schemax.json`;
}

/**
 * Unduh paket cadangan sebagai file (.schemax.json) ke perangkat lokal pengguna
 */
export function downloadBackupBundleFile(bundle: SchemaxBookBackupBundle): void {
  const fileName = getBackupFileName(bundle.book.title);

  const jsonStr = JSON.stringify(bundle, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Baca dan validasi file cadangan dari input File lokal
 */
export async function readBackupBundleFromFile(file: File): Promise<SchemaxBookBackupBundle> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text) as SchemaxBookBackupBundle;

        if (!parsed || !parsed.book || !parsed.book.title) {
          throw new Error('Format file tidak valid. Berkas cadangan Schemax tidak memiliki data buku.');
        }
        if (!Array.isArray(parsed.chapters)) {
          parsed.chapters = [];
        }
        if (!Array.isArray(parsed.entities)) {
          parsed.entities = [];
        }
        if (!Array.isArray(parsed.media)) {
          parsed.media = [];
        }
        if (!Array.isArray(parsed.ttsAudioCaches)) {
          parsed.ttsAudioCaches = [];
        }

        resolve(parsed);
      } catch (err: any) {
        reject(new Error(`Gagal membaca berkas cadangan: ${err?.message || 'Format JSON rusak.'}`));
      }
    };
    reader.onerror = () => reject(new Error('Gagal membuka file dari komputer Anda.'));
    reader.readAsText(file);
  });
}

/**
 * Dapatkan statistik pratinjau sebelum melakukan restore
 */
export async function inspectBackupBundle(
  bundle: SchemaxBookBackupBundle,
  fileSizeBytes?: number
): Promise<BackupPreviewStats> {
  const existingBook = await db.books.get(bundle.book.id);
  const totalWords = (bundle.chapters || []).reduce((sum, c) => sum + (c.wordCount || 0), 0);

  return {
    bookTitle: bundle.book.title || 'Tanpa Judul',
    genre: bundle.book.genre || 'Fiksi',
    status: bundle.book.status || 'draft',
    chapterCount: bundle.chapters?.length || 0,
    totalWords,
    entityCount: bundle.entities?.length || 0,
    mediaCount: bundle.media?.length || 0,
    ttsAudioCount: bundle.ttsAudioCaches?.length || 0,
    characterChatCount: bundle.characterChats?.length || 0,
    exportedAt: bundle.exportedAt || new Date().toISOString(),
    fileSizeBytes,
    existsLocally: !!existingBook,
  };
}

/**
 * Pulihkan paket cadangan ke database IndexedDB lokal
 * @param bundle Objek SchemaxBookBackupBundle
 * @param mode 'overwrite' (timpa buku lama) atau 'clone_as_new' (buat buku baru)
 * @param onProgress Callback status proses
 */
export async function restoreBookBackupBundle(
  bundle: SchemaxBookBackupBundle,
  mode: 'overwrite' | 'clone_as_new',
  onProgress?: (message: string, percent: number) => void
): Promise<{ restoredBookId: string; message: string }> {
  if (mode === 'overwrite') {
    // ══════════════════════════════════════════════════════════════
    // MODE 1: TIMPA / PERBARUI BUKU LAMA
    // ══════════════════════════════════════════════════════════════
    const targetBookId = bundle.book.id;
    onProgress?.('Memperbarui informasi buku...', 15);

    await db.books.put({
      ...bundle.book,
      updatedAt: Date.now(),
    });

    onProgress?.('Membersihkan & memulihkan bab cerita...', 30);
    // Hapus bab lama untuk mencegah duplikasi atau id usang
    await db.chapters.where('bookId').equals(targetBookId).delete();
    if (bundle.chapters.length > 0) {
      await db.chapters.bulkPut(bundle.chapters);
    }

    onProgress?.('Membersihkan & memulihkan ensiklopedia serta relasi...', 50);
    // Hapus entitas lama
    await db.worldEntities.where('bookId').equals(targetBookId).delete();
    if (bundle.entities.length > 0) {
      await db.worldEntities.bulkPut(bundle.entities);
    }

    onProgress?.('Memulihkan gambar naskah, sampul, dan avatar...', 70);
    // Hapus media lama
    await db.media.where('bookId').equals(targetBookId).delete();
    const mediaToInsert: MediaItem[] = [];
    for (const m of bundle.media || []) {
      const blob = m.base64Data ? base64ToBlob(m.base64Data, m.mimeType) : new Blob([]);
      mediaToInsert.push({
        id: m.id,
        bookId: targetBookId,
        chapterId: m.chapterId,
        entityId: m.entityId,
        category: m.category,
        tags: m.tags,
        caption: m.caption,
        aiDescription: m.aiDescription,
        aiNarrativeIntro: m.aiNarrativeIntro,
        name: m.name,
        mimeType: m.mimeType,
        blob,
        size: m.size || blob.size,
        createdAt: m.createdAt || Date.now(),
      });
    }
    if (mediaToInsert.length > 0) {
      await db.media.bulkPut(mediaToInsert);
    }

    onProgress?.('Memulihkan cache suara TTS AI...', 85);
    const chapterIds = bundle.chapters.map((c) => c.id);
    if (chapterIds.length > 0) {
      await db.ttsAudioCaches.where('chapterId').anyOf(chapterIds).delete();
    }

    const ttsToInsert: TTSAudioCacheItem[] = [];
    for (const t of bundle.ttsAudioCaches || []) {
      const audioBlob = t.base64Data ? base64ToBlob(t.base64Data, t.mimeType) : new Blob([]);
      ttsToInsert.push({
        id: t.id,
        chapterId: t.chapterId,
        paragraphIndex: t.paragraphIndex,
        textHash: t.textHash,
        engine: t.engine,
        model: t.model,
        voice: t.voice,
        audioBlob,
        mimeType: t.mimeType,
        createdAt: t.createdAt || Date.now(),
        updatedAt: t.updatedAt || Date.now(),
      });
    }
    if (ttsToInsert.length > 0) {
      await db.ttsAudioCaches.bulkPut(ttsToInsert);
    }

    if (bundle.characterChats && bundle.characterChats.length > 0) {
      await db.characterChats.where('bookId').equals(targetBookId).delete();
      await db.characterChats.bulkPut(bundle.characterChats);
    }

    onProgress?.('Pemulihan buku berhasil!', 100);
    return {
      restoredBookId: targetBookId,
      message: `Buku "${bundle.book.title}" berhasil diperbarui dari cadangan!`,
    };
  } else {
    // ══════════════════════════════════════════════════════════════
    // MODE 2: DUPLIKAT SEBAGAI BUKU BARU
    // ══════════════════════════════════════════════════════════════
    onProgress?.('Mempersiapkan identitas buku baru...', 10);
    const newBookId = 'book_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);

    // Pemetaan ID lama ke ID baru agar seluruh relasi tetap utuh 100%
    const chapterIdMap = new Map<string, string>();
    const entityIdMap = new Map<string, string>();
    const mediaIdMap = new Map<string, string>();

    // 1. Generate ID Baru untuk Media
    for (const m of bundle.media || []) {
      const newMedId = 'med_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
      mediaIdMap.set(m.id, newMedId);
    }

    // 2. Generate ID Baru untuk Bab
    for (const c of bundle.chapters || []) {
      const newChapId = 'chap_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
      chapterIdMap.set(c.id, newChapId);
    }

    // 3. Generate ID Baru untuk Entitas
    for (const e of bundle.entities || []) {
      const newEntId = 'ent_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
      entityIdMap.set(e.id, newEntId);
    }

    onProgress?.('Menyimpan buku baru...', 20);
    const newCoverId = bundle.book.coverMediaId ? mediaIdMap.get(bundle.book.coverMediaId) : undefined;
    const clonedBook: Book = {
      ...bundle.book,
      id: newBookId,
      title: `${bundle.book.title} (Restore)`,
      coverMediaId: newCoverId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.books.add(clonedBook);

    onProgress?.('Menyusun naskah dan posisi gambar...', 40);
    const newChapters: StoryChapter[] = (bundle.chapters || []).map((ch) => {
      const newChId = chapterIdMap.get(ch.id) || ch.id;

      // Update data-media-id dan data-entity-id di dalam naskah HTML agar gambar dan tag entitas tepat
      let remappedHtml = ch.contentHtml || '';
      mediaIdMap.forEach((newMid, oldMid) => {
        remappedHtml = remappedHtml.split(`data-media-id="${oldMid}"`).join(`data-media-id="${newMid}"`);
      });
      entityIdMap.forEach((newEid, oldEid) => {
        remappedHtml = remappedHtml.split(`data-entity-id="${oldEid}"`).join(`data-entity-id="${newEid}"`);
      });

      // Update scenes references
      const remappedScenes = (ch.scenes || ch.aiScenes || []).map((sc) => ({
        ...sc,
        characters: (sc.characters || []).map((charName) => charName),
        entitiesPresent: (sc.entitiesPresent || []).map((ep) => ({
          ...ep,
          entityId: ep.entityId ? entityIdMap.get(ep.entityId) || ep.entityId : undefined,
        })),
      }));

      return {
        ...ch,
        id: newChId,
        bookId: newBookId,
        contentHtml: remappedHtml,
        scenes: remappedScenes,
        coverMediaId: ch.coverMediaId ? mediaIdMap.get(ch.coverMediaId) : undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    });
    if (newChapters.length > 0) {
      await db.chapters.bulkAdd(newChapters);
    }

    onProgress?.('Menghubungkan kembali relasi ensiklopedia...', 60);
    const newEntities: WorldEntity[] = (bundle.entities || []).map((ent) => {
      const newEntId = entityIdMap.get(ent.id) || ent.id;
      const newAvatarId = ent.avatarMediaId ? mediaIdMap.get(ent.avatarMediaId) : undefined;
      const newGalleryIds = (ent.galleryMediaIds || []).map((mid) => mediaIdMap.get(mid) || mid);

      // Hubungkan kembali seluruh relasi dengan ID entitas baru
      const remappedRelationships = (ent.relationships || []).map((rel) => ({
        ...rel,
        targetEntityId: entityIdMap.get(rel.targetEntityId) || rel.targetEntityId,
      }));

      return {
        ...ent,
        id: newEntId,
        bookId: newBookId,
        avatarMediaId: newAvatarId,
        galleryMediaIds: newGalleryIds,
        relationships: remappedRelationships,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    });
    if (newEntities.length > 0) {
      await db.worldEntities.bulkAdd(newEntities);
    }

    onProgress?.('Memulihkan gambar-gambar biner...', 80);
    const newMediaItems: MediaItem[] = [];
    for (const m of bundle.media || []) {
      const newMid = mediaIdMap.get(m.id) || m.id;
      const newChapId = m.chapterId ? chapterIdMap.get(m.chapterId) : undefined;
      const newEntId = m.entityId ? entityIdMap.get(m.entityId) : undefined;
      const blob = m.base64Data ? base64ToBlob(m.base64Data, m.mimeType) : new Blob([]);

      newMediaItems.push({
        id: newMid,
        bookId: newBookId,
        chapterId: newChapId,
        entityId: newEntId,
        category: m.category,
        tags: m.tags,
        caption: m.caption,
        aiDescription: m.aiDescription,
        aiNarrativeIntro: m.aiNarrativeIntro,
        name: m.name,
        mimeType: m.mimeType,
        blob,
        size: m.size || blob.size,
        createdAt: Date.now(),
      });
    }
    if (newMediaItems.length > 0) {
      await db.media.bulkAdd(newMediaItems);
    }

    onProgress?.('Memulihkan audio AI TTS...', 90);
    const newTTSItems: TTSAudioCacheItem[] = [];
    for (const t of bundle.ttsAudioCaches || []) {
      const mappedChapId = t.chapterId ? chapterIdMap.get(t.chapterId) : undefined;
      const newTtsId = generateTTSCacheId(mappedChapId, t.paragraphIndex, t.engine, t.voice);
      const audioBlob = t.base64Data ? base64ToBlob(t.base64Data, t.mimeType) : new Blob([]);

      newTTSItems.push({
        id: newTtsId,
        chapterId: mappedChapId,
        paragraphIndex: t.paragraphIndex,
        textHash: t.textHash,
        engine: t.engine,
        model: t.model,
        voice: t.voice,
        audioBlob,
        mimeType: t.mimeType,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
    if (newTTSItems.length > 0) {
      await db.ttsAudioCaches.bulkAdd(newTTSItems);
    }

    onProgress?.('Buku baru berhasil dibuat dari cadangan!', 100);
    return {
      restoredBookId: newBookId,
      message: `Buku baru "${clonedBook.title}" berhasil dibuat dengan data lengkap dari cadangan!`,
    };
  }
}
