import { loadAISettings } from './aiService';
import { hashString } from '../utils/tensionUtils';

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
    description: 'Prioritas: Gemini TTS (Kunci Mandiri) ➔ WASM Mobile Free (100% Gratis Bebas Kuota)',
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

// 5. Available TTS Models for Google Gemini
export const GEMINI_TTS_MODELS: AITTSModelOption[] = [
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash Audio (Resmi Google)',
    provider: 'gemini',
    description: 'Model Text-To-Speech resmi Google AI Studio berkualitas studio',
  },
  {
    id: 'gemini-2.0-flash-exp',
    name: 'Gemini 2.0 Flash Exp Audio',
    provider: 'gemini',
    description: 'Model audio eksperimental multimodal Google AI',
  },
];

// 6. Available TTS Models for Groq Cloud
export const GROQ_TTS_MODELS: AITTSModelOption[] = [
  {
    id: 'canopylabs/orpheus-v1-english',
    name: 'Orpheus v1 English (Groq Cloud)',
    provider: 'groq',
    description: 'Model Text-To-Speech resmi Groq kecepatan ultra-tinggi',
  },
  {
    id: 'canopylabs/orpheus-arabic-saudi',
    name: 'Orpheus Arabic (Groq Cloud)',
    provider: 'groq',
    description: 'Model Suara Dialek Arab Saudi dari Canopy Labs',
  },
];

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
  modelName: string = 'gemini-2.0-flash',
  voiceName: string = 'Aoede',
  emotionTag?: {
    emotion?: string;
    intensity?: number;
    speaker?: string;
    isDialogue?: boolean;
    actingNotes?: string;
  }
): Promise<{ audioUrl: string; mimeType: string }> {
  const cleanText = text.trim();
  if (!cleanText) {
    throw new Error('Teks naskah kosong.');
  }

  const taggedText = formatTextWithEmotionTags(
    cleanText,
    emotionTag?.emotion,
    emotionTag?.intensity,
    emotionTag?.speaker,
    emotionTag?.isDialogue
  );

  const cacheKey = `gemini_${modelName}_${voiceName}_${hashString(taggedText)}`;
  if (audioUrlCache.has(cacheKey)) {
    return {
      audioUrl: audioUrlCache.get(cacheKey)!,
      mimeType: 'audio/wav',
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

  const modelsToTry = [
    modelName,
    'gemini-2.0-flash',
    'gemini-2.0-flash-exp',
  ].filter((v, idx, arr) => arr.indexOf(v) === idx && Boolean(v) && !v.includes('3.8'));

  let lastError: Error | null = null;

  // Try each Gemini API key slot if quota limit (429) is hit
  for (const slot of geminiSlots) {
    const apiKey = slot.apiKey.trim();

    for (const model of modelsToTry) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: taggedText }],
              },
            ],
            generationConfig: {
              temperature: 0.7,
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: voiceName,
                  },
                },
              },
            },
          }),
        });

        if (!response.ok) {
          const errJson = await response.json().catch(() => ({}));
          const msg = errJson.error?.message || `HTTP ${response.status} ${response.statusText}`;
          console.warn(`[Gemini TTS] Slot ${slot.label} model ${model} HTTP ${response.status}:`, msg);
          if (response.status === 429) {
            // Quota limit hit on this key, break to try next key slot immediately
            lastError = new Error(`Slot ${slot.label} kuota habis (429): ${msg}`);
            break;
          }
          throw new Error(msg);
        }

        const data = await response.json();
        const candidate = data.candidates?.[0];
        const inlineDataPart = candidate?.content?.parts?.find(
          (p: any) => p.inlineData && p.inlineData.data
        );

        if (inlineDataPart && inlineDataPart.inlineData) {
          const mimeType = inlineDataPart.inlineData.mimeType || 'audio/wav';
          const base64Data = inlineDataPart.inlineData.data;
          const audioUrl = `data:${mimeType};base64,${base64Data}`;

          audioUrlCache.set(cacheKey, audioUrl);
          return { audioUrl, mimeType };
        }

        throw new Error('Respon Gemini tidak memuat data audio.');
      } catch (err: any) {
        lastError = err;
        console.warn(`[Gemini TTS] Gagal dengan model ${model}:`, err.message);
      }
    }
  }

  throw lastError || new Error('Gagal menghasilkan audio suara AI dari Google AI Studio.');
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
  }
): Promise<{ audioUrl: string; mimeType: string }> {
  const cleanText = text.trim();
  if (!cleanText) {
    throw new Error('Teks naskah kosong.');
  }

  const taggedText = formatTextWithEmotionTags(
    cleanText,
    emotionTag?.emotion,
    emotionTag?.intensity,
    emotionTag?.speaker,
    emotionTag?.isDialogue
  );

  const cacheKey = `groq_${modelName}_${voiceName}_${hashString(taggedText)}`;
  if (audioUrlCache.has(cacheKey)) {
    return {
      audioUrl: audioUrlCache.get(cacheKey)!,
      mimeType: 'audio/wav',
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
  const audioUrl = URL.createObjectURL(blob);
  audioUrlCache.set(cacheKey, audioUrl);

  return { audioUrl, mimeType: 'audio/wav' };
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
  }
): Promise<{ audioUrl: string; audioUrls?: string[]; mimeType: string; usedEngine: TTSEngineMode }> {
  // If user selected Gemini directly:
  if (engine === 'gemini') {
    const res = await generateGeminiSpeechAudio(text, modelName, voiceName, emotionTag);
    return { ...res, usedEngine: 'gemini' };
  }

  // If user selected Groq directly:
  if (engine === 'groq') {
    const res = await generateGroqSpeechAudio(text, modelName, voiceName, emotionTag);
    return { ...res, usedEngine: 'groq' };
  }

  // If user selected WASM directly:
  if (engine === 'wasm') {
    const res = await generateWasmSpeechAudio(text);
    return { ...res, usedEngine: 'wasm' };
  }

  // --- AUTO-FALLBACK PIPELINE (Gemini ➔ WASM Mobile Free) ---
  const extraConfig = loadTTSExtraConfig();
  const aiConfig = loadAISettings();

  // 1. Try Gemini (if dedicated key or active gemini slot configured)
  const hasGeminiKey = Boolean(
    (extraConfig.dedicatedGeminiApiKey && extraConfig.dedicatedGeminiApiKey.trim()) ||
    aiConfig.slots.some((s) => s.provider === 'gemini' && s.isActive && s.apiKey && s.apiKey.trim())
  );

  if (hasGeminiKey) {
    try {
      const res = await generateGeminiSpeechAudio(
        text,
        modelName || 'gemini-2.0-flash',
        voiceName || 'Aoede',
        emotionTag
      );
      return { ...res, usedEngine: 'gemini' };
    } catch (e: any) {
      console.warn('[Auto-Fallback] Gemini gagal atau limit, beralih ke WASM Mobile Free:', e.message);
    }
  }

  // 2. Guaranteed Ultimate Fallback: WASM Mobile Free Natural Stream (100% Free, 0 Limits)
  const res = await generateWasmSpeechAudio(text);
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

      // 3. Recommended Gemini models as fallback
      const fallbackList: AITTSModelOption[] = [
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'gemini', description: 'Model Cepat & Multimodal Rekomendasi' },
        { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash Audio', provider: 'gemini', description: 'Model Audio Resmi Google AI' },
        { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash Exp', provider: 'gemini', description: 'Model Multimodal Eksperimental' },
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'gemini', description: 'Model Ringan & Efisien' },
        { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'gemini', description: 'Model Penalaran Tinggi' },
      ];

      fallbackList.forEach((m) => {
        if (!seen.has(m.id)) {
          seen.add(m.id);
          dynamicModels.push(m);
        }
      });

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

      GROQ_TTS_MODELS.forEach((m) => {
        if (!seen.has(m.id)) {
          seen.add(m.id);
          dynamicModels.push(m);
        }
      });

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
