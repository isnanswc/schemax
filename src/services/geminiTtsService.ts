import { loadAISettings, GEMINI_NON_BLOCK_SAFETY_SETTINGS } from './aiService';
import { hashString } from '../utils/tensionUtils';
import { getCachedTTSAudio, saveTTSAudioBlob } from './ttsCacheService';

export function base64ToBlob(base64: string, mimeType: string = 'audio/wav'): Blob {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

export type TTSEngineMode = 'auto' | 'gemini' | 'groq' | 'wasm';

export interface AIVoiceOption {
  id: string;
  name: string;
  gender: 'female' | 'male';
  description: string;
  avatar: string;
  provider?: TTSEngineMode;
}

export interface AITTSModelOption {
  id: string;
  name: string;
  provider: TTSEngineMode;
  description: string;
}

export interface TTSExtraConfig {
  dedicatedGeminiApiKey: string;
  selectedGeminiModel?: string;
  selectedGroqModel?: string;
  selectedVoice?: string;
  selectedEngine?: TTSEngineMode;
}

export function loadTTSExtraConfig(): TTSExtraConfig {
  try {
    const raw = localStorage.getItem('schemax_tts_extra_config');
    if (raw) {
      return {
        dedicatedGeminiApiKey: '',
        ...JSON.parse(raw),
      };
    }
  } catch (e) {}
  return {
    dedicatedGeminiApiKey: '',
  };
}

export function saveTTSExtraConfig(config: TTSExtraConfig): void {
  localStorage.setItem('schemax_tts_extra_config', JSON.stringify(config));
}

// 1. Auto-Fallback Model
export const AUTO_TTS_MODELS: AITTSModelOption[] = [
  {
    id: 'auto-pipeline',
    name: '✨ Auto-Fallback (Pintar)',
    provider: 'auto',
    description: 'Prioritas: Model AI Pilihan ➔ WASM (Bebas Kuota) ➔ Suara Browser Offline',
  },
];

// 4. Available TTS Models for WASM / Mobile Free
export const WASM_TTS_MODELS: AITTSModelOption[] = [
  {
    id: 'wasm-mobile-free',
    name: 'WASM / Mobile Free (Tanpa Batas)',
    provider: 'wasm',
    description: '100% Gratis selamanya, tanpa limit, tanpa API key di HP & PC',
  },
];

export const WASM_VOICES: AIVoiceOption[] = [
  {
    id: 'id-free-natural',
    name: 'Indonesian Natural (Free)',
    gender: 'female',
    description: 'Wanita • Alami & jernih bahasa Indonesia tanpa limit',
    avatar: '🌸',
    provider: 'wasm',
  },
  {
    id: 'id-free-reader',
    name: 'Indonesian Reader (Free)',
    gender: 'male',
    description: 'Pria • Artikulasi jelas bahasa Indonesia tanpa limit',
    avatar: '🎙️',
    provider: 'wasm',
  },
];

// 5. Default TTS Models for Google Gemini (Kosong tanpa pembatasan, diambil dari live API)
export const GEMINI_TTS_MODELS: AITTSModelOption[] = [];

// 6. Default TTS Models for Groq Cloud (Kosong tanpa pembatasan, diambil dari live API)
export const GROQ_TTS_MODELS: AITTSModelOption[] = [];

// Available Voices for Google Gemini
export const GEMINI_VOICES: AIVoiceOption[] = [
  {
    id: 'Aoede',
    name: 'Aoede',
    gender: 'female',
    description: 'Wanita • Hangat, ekspresif, dan berjiwa (Sangat Cocok untuk Novel)',
    avatar: '👩',
    provider: 'gemini',
  },
  {
    id: 'Kore',
    name: 'Kore',
    gender: 'female',
    description: 'Wanita • Jernih, tenang, dan berwibawa',
    avatar: '👩‍💼',
    provider: 'gemini',
  },
  {
    id: 'Puck',
    name: 'Puck',
    gender: 'male',
    description: 'Pria • Dinamis, ramah, dan energetik',
    avatar: '👨',
    provider: 'gemini',
  },
  {
    id: 'Fenrir',
    name: 'Fenrir',
    gender: 'male',
    description: 'Pria • Berat, misterius, dan dramatis (Cocok untuk Aksi & Thriller)',
    avatar: '🧔',
    provider: 'gemini',
  },
  {
    id: 'Charon',
    name: 'Charon',
    gender: 'male',
    description: 'Pria • Bijak, berbobot, dan santai',
    avatar: '👨‍🦳',
    provider: 'gemini',
  },
];

// Available Voices for Groq Cloud (Orpheus)
export const GROQ_VOICES: AIVoiceOption[] = [
  {
    id: 'autumn',
    name: 'Autumn',
    gender: 'female',
    description: 'Wanita • Nada natural dan lembut',
    avatar: '👩',
    provider: 'groq',
  },
  {
    id: 'daphne',
    name: 'Daphne',
    gender: 'female',
    description: 'Wanita • Jernih dan berartikulasi tegas',
    avatar: '👩‍💼',
    provider: 'groq',
  },
  {
    id: 'orion',
    name: 'Orion',
    gender: 'male',
    description: 'Pria • Suara energetik dan dramatis',
    avatar: '👨',
    provider: 'groq',
  },
  {
    id: 'canopy',
    name: 'Canopy',
    gender: 'male',
    description: 'Pria • Suara seimbang dan netral',
    avatar: '👨‍🦱',
    provider: 'groq',
  },
];

// Audio URL memory cache to avoid repeated requests and conserve API quota
const audioUrlCache = new Map<string, string>();

/**
 * Maps emotion tags & tension into rich, compound, varied English vocal emotion tags
 * (e.g. <angry>, <furious>, <whisper>, <sad>, <sobbing>, <cheerful>, <suspenseful>, <ominous>, <dramatic>, etc.)
 */
export function getEnglishEmotionTag(
  emotion?: string,
  intensity: number = 3,
  isDialogue: boolean = false,
  sampleText: string = ''
): string {
  const normIntensity = Math.max(1, Math.min(5, intensity));
  const text = sampleText.toLowerCase();

  switch (emotion) {
    case 'anger':
      if (normIntensity >= 5) return 'furious';
      if (normIntensity >= 4) return 'angry';
      if (normIntensity === 3) return 'indignant';
      return 'annoyed';

    case 'fear':
      if (normIntensity >= 5) return 'panicked';
      if (normIntensity >= 4) return 'terrified';
      if (normIntensity === 3) return 'fearful';
      return 'anxious';

    case 'sadness':
      if (normIntensity >= 5) return 'heartbroken';
      if (normIntensity >= 4) return 'sobbing';
      if (normIntensity === 3) return 'sad';
      return 'melancholy';

    case 'joy':
      if (normIntensity >= 5) return 'ecstatic';
      if (normIntensity >= 4) return 'laughing';
      if (normIntensity === 3) return 'cheerful';
      return 'warm';

    case 'whisper':
      if (normIntensity >= 4) return 'conspiratorial';
      return 'whisper';

    case 'suspense':
      if (normIntensity >= 4) return 'ominous';
      if (normIntensity === 3) return 'suspenseful';
      return 'mysterious';

    case 'climax':
      if (normIntensity >= 4) return 'explosive';
      return 'dramatic';

    case 'solemn':
      if (normIntensity >= 4) return 'majestic';
      return 'solemn';

    case 'neutral':
    default:
      // Contextual heuristic based on textual cues
      if (isDialogue) {
        if (/[!?]{2,}/.test(text) || text.includes('keterlaluan') || text.includes('brengsek') || text.includes('diam')) {
          return 'angry';
        }
        if (text.includes('?') && (text.includes('apa') || text.includes('siapa') || text.includes('kenapa') || text.includes('bagaimana'))) {
          return 'curious';
        }
        if (text.includes('!') || /[A-Z]{3,}/.test(sampleText)) {
          return 'shouting';
        }
        if (text.includes('sayang') || text.includes('cinta') || text.includes('maaf')) {
          return 'tender';
        }
        return 'conversational';
      } else {
        if (/darah|mayat|mati|hancur|meledak|klimaks|tarung/.test(text)) {
          return 'dramatic';
        }
        if (/gelap|curiga|langkah|bayangan|malam|sunyi|waspada/.test(text)) {
          return 'suspenseful';
        }
        if (/menangis|air mata|sedih|duka|isak|kehilangan/.test(text)) {
          return 'sad';
        }
        if (/tertawa|senyum|riang|cahaya|gembira/.test(text)) {
          return 'cheerful';
        }
        return 'storyteller';
      }
  }
}

/**
 * Format story text with English emotion angle-brackets tags (<emotion> ... </emotion>)
 * Distinguishes dialogue quotes from surrounding narration within the same paragraph for lively acting.
 */
export function formatTextWithEmotionTags(
  text: string,
  emotion?: string,
  intensity: number = 3,
  speaker?: string,
  isDialogue?: boolean
): string {
  const clean = text.trim();
  if (!clean) return '';

  const primaryTag = getEnglishEmotionTag(emotion, intensity, Boolean(isDialogue), clean);

  // If text contains dialogue quotes ("..." or “...”), format dialogue segments with primaryTag
  // and surrounding narration with appropriate storytelling or narrative tags
  const quoteRegex = /([“"'][^"”']+["”'])/g;
  if (quoteRegex.test(clean)) {
    const parts = clean.split(quoteRegex);
    const taggedParts = parts
      .map((part) => {
        const trimmed = part.trim();
        if (!trimmed) return '';
        if (
          (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
          (trimmed.startsWith('“') && trimmed.endsWith('”')) ||
          (trimmed.startsWith("'") && trimmed.endsWith("'"))
        ) {
          // Inner dialogue quote
          return `<${primaryTag}>${trimmed}</${primaryTag}>`;
        } else {
          // Surrounding narrative text
          const narrativeTag =
            emotion === 'suspense'
              ? 'suspenseful'
              : emotion === 'climax'
              ? 'dramatic'
              : 'storyteller';
          return `<${narrativeTag}>${trimmed}</${narrativeTag}>`;
        }
      })
      .filter(Boolean);

    if (taggedParts.length > 0) {
      return taggedParts.join(' ');
    }
  }

  // Pure single block paragraph
  return `<${primaryTag}>${clean}</${primaryTag}>`;
}

/**
 * Generate speech audio from text using Google AI Studio (Gemini Multimodal Audio)
 * IMPORTANT: No prompt preambles or meta instructions are mixed into the reading text!
 * Instructions are sent exclusively via system_instruction so the AI model never reads them out loud.
 */
export async function generateGeminiSpeechAudio(
  text: string,
  modelName: string = 'gemini-3.8-flash-preview',
  voiceName: string = 'Aoede',
  emotionTag?: {
    emotion?: string;
    intensity?: number;
    speaker?: string;
    isDialogue?: boolean;
    actingNotes?: string;
  },
  cacheOptions?: {
    chapterId?: string;
    paragraphIndex?: number;
    forceRegenerate?: boolean;
  }
): Promise<{ audioUrl: string; mimeType: string; fromCache?: boolean }> {
  const cleanText = text.trim();
  if (!cleanText) {
    throw new Error('Teks naskah kosong.');
  }

  // 1. Cek cache IndexedDB terlebih dahulu untuk menghemat token 100%!
  if (cacheOptions?.chapterId !== undefined && cacheOptions?.paragraphIndex !== undefined && !cacheOptions.forceRegenerate) {
    const cached = await getCachedTTSAudio(
      cacheOptions.chapterId,
      cacheOptions.paragraphIndex,
      cleanText,
      'gemini',
      voiceName
    );
    if (cached && !cached.isStale) {
      return {
        audioUrl: cached.audioUrl,
        mimeType: cached.item.mimeType,
        fromCache: true,
      };
    }
  }

  const taggedText = formatTextWithEmotionTags(
    cleanText,
    emotionTag?.emotion,
    emotionTag?.intensity,
    emotionTag?.speaker,
    emotionTag?.isDialogue
  );

  const cacheKey = `gemini_${modelName}_${voiceName}_${hashString(taggedText)}`;
  if (audioUrlCache.has(cacheKey) && !cacheOptions?.forceRegenerate) {
    return {
      audioUrl: audioUrlCache.get(cacheKey)!,
      mimeType: 'audio/wav',
      fromCache: true,
    };
  }

  // Load configured Gemini API key slots
  const extraConfig = loadTTSExtraConfig();
  const dedicatedKey = (extraConfig.dedicatedGeminiApiKey || '').trim();

  const aiConfig = loadAISettings();
  const geminiSlots = [
    ...aiConfig.slots.filter(
      (s) => s.provider === 'gemini' && s.isActive && s.apiKey && s.apiKey.trim().length > 0
    ),
  ];

  if (dedicatedKey) {
    geminiSlots.unshift({
      id: 'dedicated-tts',
      provider: 'gemini',
      label: 'Kunci Khusus TTS',
      apiKey: dedicatedKey,
      isActive: true,
      model: modelName,
    });
  }

  if (geminiSlots.length === 0) {
    throw new Error(
      'API Key Google AI Studio (Gemini) belum ditemukan. Buka Pengaturan Kunci TTS (ikon ⚙️/kunci di player) untuk memasukkan API Key Gemini gratis Anda.'
    );
  }

  // Hanya panggil 1 model spesifik yang dipilih pengguna (tidak melakukan loop ke seluruh cached models agar kuota hemat)
  const targetModel = (
    modelName ||
    extraConfig.selectedGeminiModel ||
    geminiSlots[0]?.model ||
    'gemini-3.8-flash-preview'
  ).trim();

  let lastError: Error | null = null;

  // Coba slot API key yang tersedia jika slot sebelumnya habis kuota
  for (const slot of geminiSlots) {
    const apiKey = slot.apiKey.trim();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`;

      try {
        // Model TTS Gemini memerlukan prompt yang jelas untuk membacakan naskah (TTS Preamble)
        // agar model tidak mengembalikan respon teks kosong atau teks biasa.
        const ttsPrompt = `Read the following text aloud with natural voice acting and emotional tone:\n\n${taggedText}`;

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: ttsPrompt }],
              },
            ],
            generationConfig: {
              temperature: 0.7,
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: voiceName || 'Aoede',
                  },
                },
              },
            },
            safetySettings: GEMINI_NON_BLOCK_SAFETY_SETTINGS,
          }),
        });

        if (!response.ok) {
          const errJson = await response.json().catch(() => ({}));
          const msg = errJson.error?.message || `HTTP ${response.status} ${response.statusText}`;
          console.warn(`[Gemini TTS] Slot ${slot.label} model ${targetModel} HTTP ${response.status}:`, msg);
          if (response.status === 429) {
            // Quota limit hit on this key, continue to try next key slot immediately
            lastError = new Error(`Slot ${slot.label} kuota habis (429): ${msg}`);
            continue;
          }
          throw new Error(msg);
        }

        const data = await response.json();

        // Jika respon tidak memiliki kandidat
        if (!data.candidates || data.candidates.length === 0) {
          const promptFeedback = data.promptFeedback ? JSON.stringify(data.promptFeedback) : '';
          throw new Error(
            `Gemini menolak memproses audio (tidak ada kandidat balasan). ${promptFeedback || 'Periksa apakah teks melanggar filter konten atau ganti model.'}`
          );
        }

        const candidate = data.candidates[0];
        const finishReason = candidate.finishReason;
        if (finishReason && finishReason !== 'STOP') {
          throw new Error(`Gemini menghentikan respon dengan status: ${finishReason}`);
        }

        const parts = candidate?.content?.parts || [];

        // 1. Cari part yang berisi inlineData audio
        const inlineDataPart = parts.find(
          (p: any) => (p.inlineData && p.inlineData.data) || (p.inline_data && p.inline_data.data)
        );

        if (inlineDataPart) {
          const inlineObj = inlineDataPart.inlineData || inlineDataPart.inline_data;
          const mimeType = inlineObj.mimeType || inlineObj.mime_type || 'audio/wav';
          const base64Data = inlineObj.data;
          const blob = base64ToBlob(base64Data, mimeType);

          let audioUrl: string;
          if (cacheOptions?.chapterId !== undefined && cacheOptions?.paragraphIndex !== undefined) {
            audioUrl = await saveTTSAudioBlob(
              cacheOptions.chapterId,
              cacheOptions.paragraphIndex,
              cleanText,
              'gemini',
              targetModel,
              voiceName,
              blob,
              mimeType
            );
          } else {
            audioUrl = URL.createObjectURL(blob);
          }

          audioUrlCache.set(cacheKey, audioUrl);
          return { audioUrl, mimeType, fromCache: false };
        }

        // 2. Jika model mengembalikan teks alih-alih audio (misal model chat non-audio atau salah model ID)
        const textPart = parts.find((p: any) => p.text);
        if (textPart?.text) {
          console.warn(`[Gemini TTS] Model ${targetModel} mengembalikan teks alih-alih audio:`, textPart.text);
          throw new Error(
            `Model "${targetModel}" adalah model teks (menjawab: "${textPart.text.slice(0, 60)}..."). Untuk TTS, pilih model yang mendukung audio seperti "gemini-3.1-flash-tts-preview" atau gunakan WASM Free.`
          );
        }

        throw new Error(`Respon model "${targetModel}" tidak memuat data audio. Pilih model khusus TTS (seperti gemini-3.1-flash-tts-preview) atau gunakan WASM Free.`);
      } catch (err: any) {
        lastError = err;
        console.warn(`[Gemini TTS] Gagal dengan model ${targetModel}:`, err.message);
      }
  }

  throw lastError || new Error(`Gagal menghasilkan audio suara AI dari model "${targetModel}".`);
}



/**
 * Break text down into small, natural phrase chunks (max 100-110 chars)
 * to prevent Google Translate TTS from returning HTTP 400 Bad Request on mobile.
 */
export function getWasmSpeechChunks(text: string): string[] {
  const cleanText = text.trim();
  if (!cleanText) return [];

  const chunks: string[] = [];
  const sentences = cleanText.split(/([.!?,;\n]+)/);
  let current = '';

  for (const part of sentences) {
    if (!part) continue;
    if ((current + part).length <= 110) {
      current += part;
    } else {
      if (current.trim()) chunks.push(current.trim());
      if (part.length > 110) {
        const words = part.split(' ');
        let sub = '';
        for (const w of words) {
          if ((sub + ' ' + w).length <= 110) {
            sub = sub ? sub + ' ' + w : w;
          } else {
            if (sub.trim()) chunks.push(sub.trim());
            sub = w;
          }
        }
        current = sub;
      } else {
        current = part;
      }
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length > 0 ? chunks : [cleanText.slice(0, 110)];
}

/**
 * Generate speech audio using WASM / Mobile Free Direct Natural Stream (100% Free, 0 Limits)
 */
export async function generateWasmSpeechAudio(
  text: string
): Promise<{ audioUrl: string; audioUrls: string[]; mimeType: string }> {
  const cleanText = text.trim();
  if (!cleanText) throw new Error('Teks naskah kosong.');

  const chunks = getWasmSpeechChunks(cleanText);
  const audioUrls = chunks.map((chunk) => {
    const encoded = encodeURIComponent(chunk);
    return `https://translate.google.com/translate_tts?ie=UTF-8&tl=id&client=tw-ob&q=${encoded}`;
  });

  return { audioUrl: audioUrls[0] || '', audioUrls, mimeType: 'audio/mpeg' };
}

/**
 * Generate speech audio using Groq Cloud TTS API
 */
export async function generateGroqSpeechAudio(
  text: string,
  modelName: string = 'canopylabs/orpheus-v1-english',
  voiceName: string = 'autumn',
  emotionTag?: {
    emotion?: string;
    intensity?: number;
    speaker?: string;
    isDialogue?: boolean;
  },
  cacheOptions?: {
    chapterId?: string;
    paragraphIndex?: number;
    forceRegenerate?: boolean;
  }
): Promise<{ audioUrl: string; mimeType: string; fromCache?: boolean }> {
  const cleanText = text.trim();
  if (!cleanText) {
    throw new Error('Teks naskah kosong.');
  }

  // 1. Cek cache IndexedDB terlebih dahulu
  if (cacheOptions?.chapterId !== undefined && cacheOptions?.paragraphIndex !== undefined && !cacheOptions.forceRegenerate) {
    const cached = await getCachedTTSAudio(
      cacheOptions.chapterId,
      cacheOptions.paragraphIndex,
      cleanText,
      'groq',
      voiceName
    );
    if (cached && !cached.isStale) {
      return {
        audioUrl: cached.audioUrl,
        mimeType: cached.item.mimeType,
        fromCache: true,
      };
    }
  }

  const taggedText = formatTextWithEmotionTags(
    cleanText,
    emotionTag?.emotion,
    emotionTag?.intensity,
    emotionTag?.speaker,
    emotionTag?.isDialogue
  );

  const cacheKey = `groq_${modelName}_${voiceName}_${hashString(taggedText)}`;
  if (audioUrlCache.has(cacheKey) && !cacheOptions?.forceRegenerate) {
    return {
      audioUrl: audioUrlCache.get(cacheKey)!,
      mimeType: 'audio/wav',
      fromCache: true,
    };
  }

  const aiConfig = loadAISettings();
  const groqSlot = aiConfig.slots.find(
    (s) => s.provider === 'groq' && s.isActive && s.apiKey && s.apiKey.trim().length > 0
  );

  if (!groqSlot || !groqSlot.apiKey) {
    throw new Error(
      'API Key Groq Cloud belum ditemukan. Buka Pengaturan AI (ikon ✨ di header) untuk memasukkan API Key Groq Anda.'
    );
  }

  const url = 'https://api.groq.com/openai/v1/audio/speech';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${groqSlot.apiKey.trim()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelName,
      input: taggedText,
      voice: voiceName,
      response_format: 'wav',
    }),
  });

  if (!response.ok) {
    const errJson = await response.json().catch(() => ({}));
    const msg = errJson.error?.message || `HTTP ${response.status} ${response.statusText}`;
    throw new Error(msg);
  }

  const blob = await response.blob();
  let audioUrl: string;
  if (cacheOptions?.chapterId !== undefined && cacheOptions?.paragraphIndex !== undefined) {
    audioUrl = await saveTTSAudioBlob(
      cacheOptions.chapterId,
      cacheOptions.paragraphIndex,
      cleanText,
      'groq',
      modelName,
      voiceName,
      blob,
      'audio/wav'
    );
  } else {
    audioUrl = URL.createObjectURL(blob);
  }

  audioUrlCache.set(cacheKey, audioUrl);
  return { audioUrl, mimeType: 'audio/wav', fromCache: false };
}

/**
 * Unified Audio Speech Dispatcher with Smart Auto-Fallback:
 * Pipeline: Azure Speech ➔ Google Cloud ➔ Gemini Studio ➔ WASM / Mobile Free
 */
export async function generateUnifiedSpeechAudio(
  text: string,
  engine: TTSEngineMode = 'auto',
  modelName?: string,
  voiceName?: string,
  emotionTag?: {
    emotion?: string;
    intensity?: number;
    speaker?: string;
    isDialogue?: boolean;
    actingNotes?: string;
  },
  cacheOptions?: {
    chapterId?: string;
    paragraphIndex?: number;
    forceRegenerate?: boolean;
  }
): Promise<{ audioUrl: string; audioUrls?: string[]; mimeType: string; usedEngine: TTSEngineMode; fromCache?: boolean }> {
  const cleanText = text.trim();

  // Check persistent IndexedDB cache first
  if (cacheOptions?.chapterId !== undefined && cacheOptions?.paragraphIndex !== undefined && !cacheOptions.forceRegenerate) {
    const cached = await getCachedTTSAudio(
      cacheOptions.chapterId,
      cacheOptions.paragraphIndex,
      cleanText,
      engine === 'auto' ? 'gemini' : engine,
      voiceName || 'default'
    );
    if (cached && !cached.isStale) {
      return {
        audioUrl: cached.audioUrl,
        mimeType: cached.item.mimeType,
        usedEngine: (cached.item.engine as TTSEngineMode) || engine,
        fromCache: true,
      };
    }
  }

  // If user selected Gemini directly:
  if (engine === 'gemini') {
    const res = await generateGeminiSpeechAudio(cleanText, modelName, voiceName, emotionTag, cacheOptions);
    return { ...res, usedEngine: 'gemini' };
  }

  // If user selected Groq directly:
  if (engine === 'groq') {
    const res = await generateGroqSpeechAudio(cleanText, modelName, voiceName, emotionTag, cacheOptions);
    return { ...res, usedEngine: 'groq' };
  }

  // If user selected WASM directly:
  if (engine === 'wasm') {
    const res = await generateWasmSpeechAudio(cleanText);
    return { ...res, usedEngine: 'wasm' };
  }

  // --- AUTO-FALLBACK PIPELINE (Gemini / Groq ➔ WASM Mobile Free) ---
  const extraConfig = loadTTSExtraConfig();
  const aiConfig = loadAISettings();

  // 1. Coba Gemini jika kunci tersedia
  const hasGeminiKey = Boolean(
    (extraConfig.dedicatedGeminiApiKey && extraConfig.dedicatedGeminiApiKey.trim()) ||
    aiConfig.slots.some((s) => s.provider === 'gemini' && s.isActive && s.apiKey && s.apiKey.trim())
  );

  if (hasGeminiKey) {
    try {
      const activeGeminiModel = modelName || extraConfig.selectedGeminiModel || 'gemini-3.8-flash-preview';
      const res = await generateGeminiSpeechAudio(
        cleanText,
        activeGeminiModel,
        voiceName || extraConfig.selectedVoice || 'Aoede',
        emotionTag,
        cacheOptions
      );
      return { ...res, usedEngine: 'gemini' };
    } catch (e: any) {
      console.warn('[Auto-Fallback] Gemini gagal, mencoba beralih ke WASM:', e.message);
    }
  }

  // 2. Coba Groq jika pengguna mengonfigurasi Groq dan tidak ada Gemini
  const hasGroqKey = Boolean(
    aiConfig.slots.some((s) => s.provider === 'groq' && s.isActive && s.apiKey && s.apiKey.trim())
  );
  if (!hasGeminiKey && hasGroqKey) {
    try {
      const activeGroqModel = modelName || extraConfig.selectedGroqModel;
      if (activeGroqModel) {
        const res = await generateGroqSpeechAudio(
          cleanText,
          activeGroqModel,
          voiceName || 'autumn',
          emotionTag,
          cacheOptions
        );
        return { ...res, usedEngine: 'groq' };
      }
    } catch (e: any) {
      console.warn('[Auto-Fallback] Groq gagal, mencoba beralih ke WASM:', e.message);
    }
  }

  // 3. Fallback utama: WASM Mobile Free Natural Stream (100% Free, 0 Limits)
  const res = await generateWasmSpeechAudio(cleanText);
  return { ...res, usedEngine: 'wasm' };
}

export function getModelsForEngine(engine: TTSEngineMode): AITTSModelOption[] {
  const aiConfig = loadAISettings();
  switch (engine) {
    case 'auto':
      return AUTO_TTS_MODELS;
    case 'wasm':
      return WASM_TTS_MODELS;
    case 'gemini': {
      const dynamicModels: AITTSModelOption[] = [];
      const seen = new Set<string>();

      // 1. Models from active Gemini slots
      aiConfig.slots
        .filter((s) => s.provider === 'gemini' && s.model && s.model.trim())
        .forEach((s) => {
          const mId = s.model!.trim();
          if (!seen.has(mId)) {
            seen.add(mId);
            dynamicModels.push({
              id: mId,
              name: `${mId} (Slot Aktif)`,
              provider: 'gemini',
              description: `Model dari konfigurasi ${s.label}`,
            });
          }
        });

      // 2. Models cached from live API fetch
      (aiConfig.geminiConfig?.cachedModels || []).forEach((m) => {
        if (!seen.has(m.id)) {
          seen.add(m.id);
          dynamicModels.push({
            id: m.id,
            name: m.name,
            provider: 'gemini',
            description: m.description,
          });
        }
      });

      // 3. Fallback jika belum pernah klik muat api dan belum ada model di slot
      if (dynamicModels.length === 0) {
        dynamicModels.push({
          id: '',
          name: '(Klik tombol "muat api" untuk mengambil daftar model)',
          provider: 'gemini',
          description: 'Model akan diambil langsung dari API Key Anda tanpa batasan',
        });
      }

      return dynamicModels;
    }
    case 'groq': {
      const dynamicModels: AITTSModelOption[] = [];
      const seen = new Set<string>();

      aiConfig.slots
        .filter((s) => s.provider === 'groq' && s.model && s.model.trim())
        .forEach((s) => {
          const mId = s.model!.trim();
          if (!seen.has(mId)) {
            seen.add(mId);
            dynamicModels.push({
              id: mId,
              name: `${mId} (Slot Aktif)`,
              provider: 'groq',
              description: `Model dari konfigurasi ${s.label}`,
            });
          }
        });

      (aiConfig.groqConfig?.cachedModels || []).forEach((m) => {
        if (!seen.has(m.id)) {
          seen.add(m.id);
          dynamicModels.push({
            id: m.id,
            name: m.name,
            provider: 'groq',
            description: m.description,
          });
        }
      });

      if (dynamicModels.length === 0) {
        dynamicModels.push({
          id: '',
          name: '(Klik tombol "muat api" untuk mengambil daftar model)',
          provider: 'groq',
          description: 'Model akan diambil langsung dari API Key Groq Anda tanpa batasan',
        });
      }

      return dynamicModels;
    }
    default:
      return AUTO_TTS_MODELS;
  }
}

export function getVoicesForEngine(engine: TTSEngineMode): AIVoiceOption[] {
  switch (engine) {
    case 'auto':
      return [...WASM_VOICES, ...GEMINI_VOICES];
    case 'wasm':
      return WASM_VOICES;
    case 'gemini':
      return GEMINI_VOICES;
    case 'groq':
      return GROQ_VOICES;
    default:
      return WASM_VOICES;
  }
}
