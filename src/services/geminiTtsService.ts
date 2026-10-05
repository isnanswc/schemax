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

export type TTSEngineMode = 'auto' | 'edge' | 'gemini' | 'groq' | 'wasm';

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
    description: 'Prioritas: Edge Neural (Suara Alami) ➔ Model AI Pilihan ➔ WASM ➔ Browser Offline',
  },
];

// 2. Microsoft Edge Neural TTS Models (100% Gratis, Suara Manusia Asli)
export const EDGE_TTS_MODELS: AITTSModelOption[] = [
  {
    id: 'edge-neural-free',
    name: 'Edge Neural AI (Suara Manusia Asli)',
    provider: 'edge',
    description: '100% Gratis, teknologi Microsoft Neural AI • Suara manusia asli Bahasa Indonesia tanpa kuota',
  },
];

export const EDGE_VOICES: AIVoiceOption[] = [
  {
    id: 'id-ID-ArdiNeural',
    name: 'Ardi (Pria • Alami & Hangat)',
    gender: 'male',
    description: 'Pria • Narator novel hangat, tenang & artikulasi manusia asli',
    avatar: '🎙️',
    provider: 'edge',
  },
  {
    id: 'id-ID-GadisNeural',
    name: 'Gadis (Wanita • Lembut & Jernih)',
    gender: 'female',
    description: 'Wanita • Suara lembut, intonasi ekspresif & alami bahasa Indonesia',
    avatar: '🌸',
    provider: 'edge',
  },
  {
    id: 'en-US-JennyNeural',
    name: 'Jenny (Wanita • English)',
    gender: 'female',
    description: 'Wanita • Natural & clear English storyteller',
    avatar: '✨',
    provider: 'edge',
  },
  {
    id: 'en-US-GuyNeural',
    name: 'Guy (Pria • English)',
    gender: 'male',
    description: 'Pria • Deep, warm & engaging English narrator',
    avatar: '🎧',
    provider: 'edge',
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

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function hmacSha256(keyBytes: Uint8Array, dataStr: string): Promise<Uint8Array> {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const cryptoKey = await window.crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'HMAC', hash: { name: 'SHA-256' } },
      false,
      ['sign']
    );
    const signature = await window.crypto.subtle.sign(
      'HMAC',
      cryptoKey,
      new TextEncoder().encode(dataStr)
    );
    return new Uint8Array(signature);
  }

  throw new Error('WebCrypto HMAC-SHA256 tidak didukung di lingkungan browser ini.');
}

interface EdgeTokenCache {
  endpoint: string;
  token: string;
  expiredAt: number; // Unix timestamp in seconds
}

let edgeTokenCache: EdgeTokenCache | null = null;

/**
 * Fetch and cache Microsoft Cognitive Services Token for Neural Voices
 */
async function getEdgeEndpointToken(): Promise<{ endpoint: string; token: string }> {
  const now = Math.floor(Date.now() / 1000);
  if (edgeTokenCache && now < edgeTokenCache.expiredAt - 180) {
    return {
      endpoint: edgeTokenCache.endpoint,
      token: edgeTokenCache.token,
    };
  }

  const endpointUrl = 'https://dev.microsofttranslator.com/apps/endpoint?api-version=1.0';
  const clientId = (
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2) + Date.now().toString(36)
  ).replace(/-/g, '');

  const urlPath = endpointUrl.split('://')[1];
  const encodedUrl = encodeURIComponent(urlPath);
  const formattedDate = (new Date()).toUTCString().replace(/GMT/, '').trim() + ' GMT';
  const formattedDateLower = formattedDate.toLowerCase();
  const bytesToSign = `MSTranslatorAndroidApp${encodedUrl}${formattedDateLower}${clientId}`.toLowerCase();
  const secretBytes = base64ToBytes('oik6PdDdMnOXemTbwvMn9de/h9lFnfBaCWbGMMZqqoSaQaqUOqjVGm5NqsmjcBI1x+sS9ugjB55HEJWRiFXYFw==');

  const signData = await hmacSha256(secretBytes, bytesToSign);
  const signBase64 = bytesToBase64(signData);
  const signatureHeader = `MSTranslatorAndroidApp::${signBase64}::${formattedDateLower}::${clientId}`;

  const response = await fetch(endpointUrl, {
    method: 'POST',
    headers: {
      'Accept-Language': 'id-ID',
      'X-ClientVersion': '4.0.530a 5fe1dc6c',
      'X-UserId': '0f04d16a175c411e',
      'X-HomeGeographicRegion': 'id-ID',
      'X-ClientTraceId': clientId,
      'X-MT-Signature': signatureHeader,
      'User-Agent': 'okhttp/4.5.0',
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': '0',
    },
  });

  if (!response.ok) {
    throw new Error(`Gagal mengautentikasi Edge Neural TTS: HTTP ${response.status}`);
  }

  const data = await response.json();
  const region = data.r || 'southeastasia';
  const token = data.t;

  // Extract expiration from JWT token if available
  let expiredAt = now + 600; // default 10 minutes
  try {
    const jwtPart = token.split('.')[1];
    if (jwtPart) {
      const decoded = JSON.parse(window.atob(jwtPart));
      if (decoded.exp) expiredAt = decoded.exp;
    }
  } catch (e) {}

  const endpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
  edgeTokenCache = {
    endpoint,
    token,
    expiredAt,
  };

  return { endpoint, token };
}

/**
 * Generate speech audio using Microsoft Edge Neural TTS (100% Free, Human-Like Voice Quality)
 */
export async function generateEdgeSpeechAudio(
  text: string,
  voiceName: string = 'id-ID-ArdiNeural',
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

  // 1. Cek cache IndexedDB terlebih dahulu
  if (cacheOptions?.chapterId !== undefined && cacheOptions?.paragraphIndex !== undefined && !cacheOptions.forceRegenerate) {
    const cached = await getCachedTTSAudio(
      cacheOptions.chapterId,
      cacheOptions.paragraphIndex,
      cleanText,
      'edge',
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

  const cacheKey = `edge_${voiceName}_${hashString(cleanText)}`;
  if (audioUrlCache.has(cacheKey) && !cacheOptions?.forceRegenerate) {
    return {
      audioUrl: audioUrlCache.get(cacheKey)!,
      mimeType: 'audio/mpeg',
      fromCache: true,
    };
  }

  // Modulasi rate dan pitch berdasarkan emosi AI sutradara jika ada
  let ratePercent = 0;
  let pitchPercent = 0;
  if (emotionTag?.emotion) {
    const emo = emotionTag.emotion.toLowerCase();
    const intensity = emotionTag.intensity || 1.0;
    if (emo.includes('anger') || emo.includes('marah') || emo.includes('tegang')) {
      ratePercent = Math.round(10 * intensity);
      pitchPercent = Math.round(5 * intensity);
    } else if (emo.includes('sad') || emo.includes('sedih') || emo.includes('bisik')) {
      ratePercent = Math.round(-8 * intensity);
      pitchPercent = Math.round(-6 * intensity);
    } else if (emo.includes('joy') || emo.includes('senang') || emo.includes('gembira')) {
      ratePercent = Math.round(6 * intensity);
      pitchPercent = Math.round(4 * intensity);
    }
  }

  const rateStr = `${ratePercent >= 0 ? '+' : ''}${ratePercent}%`;
  const pitchStr = `${pitchPercent >= 0 ? '+' : ''}${pitchPercent}%`;
  const lang = voiceName.startsWith('en-') ? 'en-US' : voiceName.startsWith('ja-') ? 'ja-JP' : 'id-ID';

  const auth = await getEdgeEndpointToken();

  // Jika teks melebihi 1000 karakter, potong menjadi kalimat-kalimat
  const splitChunks = (str: string, maxLength: number = 800): string[] => {
    if (str.length <= maxLength) return [str];
    const sentences = str.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [str];
    const chunks: string[] = [];
    let current = '';
    for (const s of sentences) {
      if ((current + ' ' + s).length <= maxLength) {
        current = current ? current + ' ' + s : s;
      } else {
        if (current.trim()) chunks.push(current.trim());
        current = s;
      }
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks.length > 0 ? chunks : [str];
  };

  const textChunks = splitChunks(cleanText);
  const audioBlobs: Blob[] = [];

  for (const chunk of textChunks) {
    const ssml = `<speak xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" version="1.0" xml:lang="${lang}"><voice name="${voiceName}"><prosody rate="${rateStr}" pitch="${pitchStr}">${escapeXml(chunk)}</prosody></voice></speak>`;

    const response = await fetch(auth.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': auth.token,
        'Content-Type': 'application/ssml+xml',
        'User-Agent': 'okhttp/4.5.0',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      },
      body: ssml,
    });

    if (!response.ok) {
      // Invalidate token cache jika unauthorized
      if (response.status === 401 || response.status === 403) {
        edgeTokenCache = null;
      }
      const errText = await response.text().catch(() => '');
      throw new Error(`Edge Neural TTS error: HTTP ${response.status} ${errText}`);
    }

    const chunkBlob = await response.blob();
    audioBlobs.push(chunkBlob);
  }

  const finalBlob = audioBlobs.length === 1 ? audioBlobs[0] : new Blob(audioBlobs, { type: 'audio/mpeg' });

  let audioUrl: string;
  if (cacheOptions?.chapterId !== undefined && cacheOptions?.paragraphIndex !== undefined) {
    audioUrl = await saveTTSAudioBlob(
      cacheOptions.chapterId,
      cacheOptions.paragraphIndex,
      cleanText,
      'edge',
      'edge-neural-free',
      voiceName,
      finalBlob,
      'audio/mpeg'
    );
  } else {
    audioUrl = URL.createObjectURL(finalBlob);
  }

  audioUrlCache.set(cacheKey, audioUrl);
  return { audioUrl, mimeType: 'audio/mpeg', fromCache: false };
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
    const lookupEngine = engine === 'auto' ? 'edge' : engine;
    const lookupVoice = voiceName || (lookupEngine === 'edge' ? 'id-ID-ArdiNeural' : 'default');
    const cached = await getCachedTTSAudio(
      cacheOptions.chapterId,
      cacheOptions.paragraphIndex,
      cleanText,
      lookupEngine,
      lookupVoice
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

  // 1. Direct Edge Neural Engine
  if (engine === 'edge') {
    const res = await generateEdgeSpeechAudio(cleanText, voiceName || 'id-ID-ArdiNeural', emotionTag, cacheOptions);
    return { ...res, usedEngine: 'edge' };
  }

  // 2. Direct Gemini Engine
  if (engine === 'gemini') {
    const res = await generateGeminiSpeechAudio(cleanText, modelName, voiceName, emotionTag, cacheOptions);
    return { ...res, usedEngine: 'gemini' };
  }

  // 3. Direct Groq Engine
  if (engine === 'groq') {
    const res = await generateGroqSpeechAudio(cleanText, modelName, voiceName, emotionTag, cacheOptions);
    return { ...res, usedEngine: 'groq' };
  }

  // 4. Direct WASM Engine
  if (engine === 'wasm') {
    const res = await generateWasmSpeechAudio(cleanText);
    return { ...res, usedEngine: 'wasm' };
  }

  // --- AUTO-FALLBACK PIPELINE (Edge Neural ➔ Gemini / Groq ➔ WASM Mobile Free) ---
  const extraConfig = loadTTSExtraConfig();
  const aiConfig = loadAISettings();

  // Prioritas A: Jika pengguna secara spesifik memilih suara Gemini dan memiliki API Key
  const isGeminiVoice = GEMINI_VOICES.some((v) => v.id === voiceName);
  const hasGeminiKey = Boolean(
    (extraConfig.dedicatedGeminiApiKey && extraConfig.dedicatedGeminiApiKey.trim()) ||
    aiConfig.slots.some((s) => s.provider === 'gemini' && s.isActive && s.apiKey && s.apiKey.trim())
  );

  if (isGeminiVoice && hasGeminiKey) {
    try {
      const activeGeminiModel = modelName || extraConfig.selectedGeminiModel || 'gemini-3.8-flash-preview';
      const res = await generateGeminiSpeechAudio(
        cleanText,
        activeGeminiModel,
        voiceName || 'Aoede',
        emotionTag,
        cacheOptions
      );
      return { ...res, usedEngine: 'gemini' };
    } catch (e: any) {
      console.warn('[Auto-Fallback] Gemini gagal, mencoba beralih ke Edge Neural:', e.message);
    }
  }

  // Prioritas B: Microsoft Edge Neural TTS (100% Gratis, Suara Alami Bahasa Indonesia Ardi & Gadis)
  try {
    const activeEdgeVoice = (voiceName && EDGE_VOICES.some((v) => v.id === voiceName)) ? voiceName : 'id-ID-ArdiNeural';
    const res = await generateEdgeSpeechAudio(cleanText, activeEdgeVoice, emotionTag, cacheOptions);
    return { ...res, usedEngine: 'edge' };
  } catch (e: any) {
    console.warn('[Auto-Fallback] Edge Neural gagal, mencoba beralih ke Groq/WASM:', e.message);
  }

  // Prioritas C: Coba Groq jika pengguna mengonfigurasi Groq
  const hasGroqKey = Boolean(
    aiConfig.slots.some((s) => s.provider === 'groq' && s.isActive && s.apiKey && s.apiKey.trim())
  );
  if (hasGroqKey) {
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

  // Prioritas D: Fallback WASM Mobile Free Natural Stream (100% Free, 0 Limits)
  const res = await generateWasmSpeechAudio(cleanText);
  return { ...res, usedEngine: 'wasm' };
}

export function getModelsForEngine(engine: TTSEngineMode): AITTSModelOption[] {
  const aiConfig = loadAISettings();
  switch (engine) {
    case 'auto':
      return AUTO_TTS_MODELS;
    case 'edge':
      return EDGE_TTS_MODELS;
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
      return [...EDGE_VOICES, ...GEMINI_VOICES, ...WASM_VOICES];
    case 'edge':
      return EDGE_VOICES;
    case 'wasm':
      return WASM_VOICES;
    case 'gemini':
      return GEMINI_VOICES;
    case 'groq':
      return GROQ_VOICES;
    default:
      return EDGE_VOICES;
  }
}
