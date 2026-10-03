import { db, TTSAudioCacheItem } from '../db';
import { hashString } from '../utils/tensionUtils';

/**
 * Service to manage persistent audio caching in IndexedDB for AI Text-To-Speech (Gemini, Groq, WASM).
 * Ensures that once a paragraph's audio is generated, it is stored permanently in local IndexedDB.
 * Subsequent plays use 0 API tokens and require no internet connection!
 */

export function generateTTSCacheId(
  chapterId: string | undefined,
  paragraphIndex: number,
  engine: string = 'unified',
  voice: string = 'default'
): string {
  const cleanChapter = chapterId ? chapterId.trim() : 'general';
  const cleanEngine = engine.toLowerCase().trim();
  const cleanVoice = voice.toLowerCase().trim();
  return `tts_${cleanChapter}_p${paragraphIndex}_${cleanEngine}_${cleanVoice}`;
}

export interface CachedTTSLookupResult {
  audioUrl: string;
  isStale: boolean;
  item: TTSAudioCacheItem;
}

/**
 * Retrieve cached audio for a paragraph if it exists in IndexedDB.
 * Also checks whether the current paragraph text has changed (isStale).
 */
export async function getCachedTTSAudio(
  chapterId: string | undefined,
  paragraphIndex: number,
  currentText: string,
  engine: string = 'unified',
  voice: string = 'default'
): Promise<CachedTTSLookupResult | null> {
  try {
    const id = generateTTSCacheId(chapterId, paragraphIndex, engine, voice);
    const item = await db.ttsAudioCaches.get(id);

    if (!item || !item.audioBlob) return null;

    const currentHash = hashString(currentText.trim());
    const isStale = item.textHash !== currentHash;
    const audioUrl = URL.createObjectURL(item.audioBlob);

    return {
      audioUrl,
      isStale,
      item,
    };
  } catch (err) {
    console.warn('[TTS Cache] Error reading from IndexedDB:', err);
    return null;
  }
}

/**
 * Save newly generated TTS audio Blob to IndexedDB.
 */
export async function saveTTSAudioBlob(
  chapterId: string | undefined,
  paragraphIndex: number,
  text: string,
  engine: string,
  model: string,
  voice: string,
  audioBlob: Blob,
  mimeType: string = 'audio/wav'
): Promise<string> {
  const id = generateTTSCacheId(chapterId, paragraphIndex, engine, voice);
  const now = Date.now();
  const textHash = hashString(text.trim());

  const cacheItem: TTSAudioCacheItem = {
    id,
    chapterId,
    paragraphIndex,
    textHash,
    engine,
    model,
    voice,
    audioBlob,
    mimeType,
    createdAt: now,
    updatedAt: now,
  };

  await db.ttsAudioCaches.put(cacheItem);
  return URL.createObjectURL(audioBlob);
}

export interface TTSCacheStatus {
  hasCache: boolean;
  isStale: boolean;
  engine?: string;
  model?: string;
  voice?: string;
  updatedAt?: number;
}

export type ParagraphTTSStatus = TTSCacheStatus;

/**
 * Scan all paragraphs of a chapter and return cache status for each.
 * Supports flexible engine/voice matching: if engine is not strictly specified or set to 'unified'/'all',
 * it matches any cached audio for that paragraph and reports the latest one.
 */
export async function getChapterParagraphAudioStatuses(
  chapterId: string | undefined,
  paragraphs: string[],
  engine?: string,
  voice?: string
): Promise<Record<number, TTSCacheStatus>> {
  const result: Record<number, TTSCacheStatus> = {};

  // Inisialisasi default
  paragraphs.forEach((_, idx) => {
    result[idx] = { hasCache: false, isStale: false };
  });

  try {
    const cleanChapter = chapterId ? chapterId.trim() : 'general';
    const filterEngine = engine && !['unified', 'all', 'auto'].includes(engine.toLowerCase().trim())
      ? engine.toLowerCase().trim()
      : null;
    const filterVoice = voice && !['default', 'all'].includes(voice.toLowerCase().trim())
      ? voice.toLowerCase().trim()
      : null;

    // Fetch all caches matching this chapter
    const items = await db.ttsAudioCaches
      .where('chapterId')
      .equals(cleanChapter)
      .toArray();

    // Map by paragraph index (keep most recently updated if duplicates)
    const itemByParaIndex = new Map<number, TTSAudioCacheItem>();
    items.forEach((item) => {
      if (filterEngine && item.engine.toLowerCase() !== filterEngine) {
        return;
      }
      if (filterVoice && item.voice.toLowerCase() !== filterVoice) {
        return;
      }

      const existing = itemByParaIndex.get(item.paragraphIndex);
      if (!existing || item.updatedAt > existing.updatedAt) {
        itemByParaIndex.set(item.paragraphIndex, item);
      }
    });

    paragraphs.forEach((text, idx) => {
      const item = itemByParaIndex.get(idx);
      if (item) {
        const currentHash = hashString(text.trim());
        const isStale = item.textHash !== currentHash;
        result[idx] = {
          hasCache: true,
          isStale,
          engine: item.engine,
          model: item.model,
          voice: item.voice,
          updatedAt: item.updatedAt,
        };
      }
    });
  } catch (err) {
    console.warn('[TTS Cache] Error scanning statuses:', err);
  }

  return result;
}

/**
 * Delete cached audio for a specific paragraph (used when user chooses "Generate Ulang").
 * If engine/voice is default or omitted, deletes all audio variants for this paragraph.
 */
export async function deleteParagraphTTSCache(
  chapterId: string | undefined,
  paragraphIndex: number,
  engine: string = 'unified',
  voice: string = 'default'
): Promise<void> {
  const cleanChapter = chapterId ? chapterId.trim() : 'general';
  
  if (engine === 'unified' || engine === 'auto' || engine === 'all') {
    // Hapus semua cache audio paragraf ini dari berbagai engine
    const items = await db.ttsAudioCaches
      .where('chapterId')
      .equals(cleanChapter)
      .filter((item) => item.paragraphIndex === paragraphIndex)
      .toArray();
    
    if (items.length > 0) {
      await db.ttsAudioCaches.bulkDelete(items.map((i) => i.id));
    }
  } else {
    const id = generateTTSCacheId(chapterId, paragraphIndex, engine, voice);
    await db.ttsAudioCaches.delete(id);
  }
}

/**
 * Clear all TTS audio caches for an entire chapter.
 */
export async function clearChapterTTSCache(chapterId: string): Promise<void> {
  await db.ttsAudioCaches.where('chapterId').equals(chapterId).delete();
}

