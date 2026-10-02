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

export interface ParagraphTTSStatus {
  isCached: boolean;
  isStale: boolean;
  updatedAt?: number;
}

/**
 * Scan all paragraphs of a chapter and return cache status for each.
 */
export async function getChapterParagraphAudioStatuses(
  chapterId: string | undefined,
  paragraphs: string[],
  engine: string = 'unified',
  voice: string = 'default'
): Promise<Map<number, ParagraphTTSStatus>> {
  const statusMap = new Map<number, ParagraphTTSStatus>();

  try {
    const cleanChapter = chapterId ? chapterId.trim() : 'general';
    const cleanEngine = engine.toLowerCase().trim();
    const cleanVoice = voice.toLowerCase().trim();

    // Fetch all caches matching this chapter
    const items = await db.ttsAudioCaches
      .where('chapterId')
      .equals(cleanChapter)
      .toArray();

    const itemByParaIndex = new Map<number, TTSAudioCacheItem>();
    items.forEach((item) => {
      if (item.engine.toLowerCase() === cleanEngine && item.voice.toLowerCase() === cleanVoice) {
        itemByParaIndex.set(item.paragraphIndex, item);
      }
    });

    paragraphs.forEach((text, idx) => {
      const item = itemByParaIndex.get(idx);
      if (!item) {
        statusMap.set(idx, { isCached: false, isStale: false });
      } else {
        const currentHash = hashString(text.trim());
        const isStale = item.textHash !== currentHash;
        statusMap.set(idx, { isCached: true, isStale, updatedAt: item.updatedAt });
      }
    });
  } catch (err) {
    console.warn('[TTS Cache] Error scanning statuses:', err);
  }

  return statusMap;
}

/**
 * Delete cached audio for a specific paragraph (used when user chooses "Generate Ulang").
 */
export async function deleteParagraphTTSCache(
  chapterId: string | undefined,
  paragraphIndex: number,
  engine: string = 'unified',
  voice: string = 'default'
): Promise<void> {
  const id = generateTTSCacheId(chapterId, paragraphIndex, engine, voice);
  await db.ttsAudioCaches.delete(id);
}

/**
 * Clear all TTS audio caches for an entire chapter.
 */
export async function clearChapterTTSCache(chapterId: string): Promise<void> {
  await db.ttsAudioCaches.where('chapterId').equals(chapterId).delete();
}
