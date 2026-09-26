import { loadAISettings } from './aiService';
import { hashString } from '../utils/tensionUtils';

export type TTSEngineMode = 'auto' | 'azure' | 'google-cloud' | 'gemini' | 'groq' | 'wasm';

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
  azureApiKey: string;
  azureRegion: string;
  googleCloudApiKey: string;
  dedicatedGeminiApiKey: string;
}

export function loadTTSExtraConfig(): TTSExtraConfig {
  try {
    const raw = localStorage.getItem('schemax_tts_extra_config');
    if (raw) {
      return {
        azureApiKey: '',
        azureRegion: 'southeastasia',
        googleCloudApiKey: '',
        dedicatedGeminiApiKey: '',
        ...JSON.parse(raw),
      };
    }
  } catch (e) {}
  return {
    azureApiKey: '',
    azureRegion: 'southeastasia',
    googleCloudApiKey: '',
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
    description: 'Prioritas: Azure (Gadis/Ardi) ➔ Google Cloud ➔ Gemini ➔ WASM Mobile Free',
  },
];

// 2. Available TTS Models for Microsoft Azure Speech
export const AZURE_TTS_MODELS: AITTSModelOption[] = [
  {
    id: 'azure-neural-standard',
    name: 'Microsoft Azure Neural AI (Rekomendasi)',
    provider: 'azure',
    description: 'Suara AI manusia paling alami di dunia untuk Bahasa Indonesia (500k chars/bulan gratis)',
  },
];

export const AZURE_VOICES: AIVoiceOption[] = [
  {
    id: 'id-ID-GadisNeural',
    name: 'Gadis (Neural)',
    gender: 'female',
    description: 'Wanita • Paling alami, hangat, dan ekspresif untuk novel',
    avatar: '👩',
    provider: 'azure',
  },
  {
    id: 'id-ID-ArdiNeural',
    name: 'Ardi (Neural)',
    gender: 'male',
    description: 'Pria • Tenang, berwibawa, dan jernih',
    avatar: '👨',
    provider: 'azure',
  },
];

// 3. Available TTS Models for Google Cloud TTS
export const GOOGLE_CLOUD_TTS_MODELS: AITTSModelOption[] = [
  {
    id: 'google-neural2',
    name: 'Google Cloud Neural2 (1 Juta chars/bln gratis)',
    provider: 'google-cloud',
    description: 'Model Deep Learning Neural2 Google Cloud',
  },
  {
    id: 'google-wavenet',
    name: 'Google Cloud WaveNet',
    provider: 'google-cloud',
    description: 'Model WaveNet kualitas tinggi Google Cloud',
  },
];

export const GOOGLE_CLOUD_VOICES: AIVoiceOption[] = [
  {
    id: 'id-ID-Neural2-A',
    name: 'Neural2-A (Wanita)',
    gender: 'female',
    description: 'Wanita • Halus dan artikulasi natural',
    avatar: '👩',
    provider: 'google-cloud',
  },
  {
    id: 'id-ID-Neural2-B',
    name: 'Neural2-B (Pria)',
    gender: 'male',
    description: 'Pria • Dalam dan mantap',
    avatar: '👨',
    provider: 'google-cloud',
  },
  {
    id: 'id-ID-Wavenet-A',
    name: 'WaveNet-A (Wanita)',
    gender: 'female',
    description: 'Wanita • Jernih dan formal',
    avatar: '👩‍💼',
    provider: 'google-cloud',
  },
  {
    id: 'id-ID-Wavenet-B',
    name: 'WaveNet-B (Pria)',
    gender: 'male',
    description: 'Pria • Bersahabat',
    avatar: '👨‍💼',
    provider: 'google-cloud',
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
    id: 'gemini-3.8-flash-tts',
    name: 'Gemini 3.8 Flash TTS (AI Studio)',
    provider: 'gemini',
    description: 'Model Text-To-Speech resmi Google AI Studio berkualitas studio',
  },
  {
    id: 'gemini-3.8-flash-lite-tts',
    name: 'Gemini 3.8 Flash-Lite TTS',
    provider: 'gemini',
    description: 'Model TTS cepat, hemat latensi dan efisiensi kuota',
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
  modelName: string = 'gemini-3.8-flash-tts',
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
    'gemini-3.8-flash-tts',
    'gemini-3.8-flash-lite-tts',
  ].filter((v, idx, arr) => arr.indexOf(v) === idx && Boolean(v));

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
 * Generate speech audio using Microsoft Azure Speech API (Free F0 / Paid)
 */
export async function generateAzureSpeechAudio(
  text: string,
  voiceName: string = 'id-ID-GadisNeural',
  customApiKey?: string,
  customRegion?: string
): Promise<{ audioUrl: string; mimeType: string }> {
  const cleanText = text.trim();
  if (!cleanText) throw new Error('Teks naskah kosong.');

  const extraConfig = loadTTSExtraConfig();
  const apiKey = (customApiKey || extraConfig.azureApiKey || '').trim();
  const region = (customRegion || extraConfig.azureRegion || 'southeastasia').trim();

  if (!apiKey) {
    throw new Error('API Key Microsoft Azure Speech belum dikonfigurasi.');
  }

  const cacheKey = `azure_${voiceName}_${hashString(cleanText)}`;
  if (audioUrlCache.has(cacheKey)) {
    return { audioUrl: audioUrlCache.get(cacheKey)!, mimeType: 'audio/mp3' };
  }

  const escapedText = cleanText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="id-ID"><voice name="${voiceName}">${escapedText}</voice></speak>`;
  const url = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': apiKey,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      'User-Agent': 'SchemaxStoryStudio',
    },
    body: ssml,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Azure Speech HTTP ${response.status}: ${errText || response.statusText}`);
  }

  const blob = await response.blob();
  const audioUrl = URL.createObjectURL(blob);
  audioUrlCache.set(cacheKey, audioUrl);
  return { audioUrl, mimeType: 'audio/mp3' };
}

/**
 * Generate speech audio using Google Cloud Text-to-Speech API (Neural2 / WaveNet)
 */
export async function generateGoogleCloudSpeechAudio(
  text: string,
  voiceName: string = 'id-ID-Neural2-A',
  customApiKey?: string
): Promise<{ audioUrl: string; mimeType: string }> {
  const cleanText = text.trim();
  if (!cleanText) throw new Error('Teks naskah kosong.');

  const extraConfig = loadTTSExtraConfig();
  const apiKey = (customApiKey || extraConfig.googleCloudApiKey || '').trim();

  if (!apiKey) {
    throw new Error('API Key Google Cloud Text-to-Speech belum dikonfigurasi.');
  }

  const cacheKey = `gcloud_${voiceName}_${hashString(cleanText)}`;
  if (audioUrlCache.has(cacheKey)) {
    return { audioUrl: audioUrlCache.get(cacheKey)!, mimeType: 'audio/mp3' };
  }

  const gender = voiceName.endsWith('-B') || voiceName.endsWith('-D') ? 'MALE' : 'FEMALE';
  const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: { text: cleanText },
      voice: {
        languageCode: 'id-ID',
        name: voiceName,
        ssmlGender: gender,
      },
      audioConfig: {
        audioEncoding: 'MP3',
      },
    }),
  });

  if (!response.ok) {
    const errJson = await response.json().catch(() => ({}));
    throw new Error(errJson.error?.message || `Google Cloud TTS HTTP ${response.status}`);
  }

  const data = await response.json();
  if (!data.audioContent) {
    throw new Error('Google Cloud TTS tidak memuat audioContent.');
  }

  const audioUrl = `data:audio/mp3;base64,${data.audioContent}`;
  audioUrlCache.set(cacheKey, audioUrl);
  return { audioUrl, mimeType: 'audio/mp3' };
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
  // If a specific engine is chosen by the user:
  if (engine === 'azure') {
    const res = await generateAzureSpeechAudio(text, voiceName || 'id-ID-GadisNeural');
    return { ...res, usedEngine: 'azure' };
  }

  if (engine === 'google-cloud') {
    const res = await generateGoogleCloudSpeechAudio(text, voiceName || 'id-ID-Neural2-A');
    return { ...res, usedEngine: 'google-cloud' };
  }

  if (engine === 'gemini') {
    const res = await generateGeminiSpeechAudio(text, modelName, voiceName, emotionTag);
    return { ...res, usedEngine: 'gemini' };
  }

  if (engine === 'groq') {
    const res = await generateGroqSpeechAudio(text, modelName, voiceName, emotionTag);
    return { ...res, usedEngine: 'groq' };
  }

  if (engine === 'wasm') {
    const res = await generateWasmSpeechAudio(text);
    return { ...res, usedEngine: 'wasm' };
  }

  // --- AUTO-FALLBACK PIPELINE (Azure ➔ Google Cloud ➔ Dedicated Gemini ➔ WASM Mobile Free) ---
  const extraConfig = loadTTSExtraConfig();

  // 1. Try Azure Speech if configured
  if (extraConfig.azureApiKey && extraConfig.azureApiKey.trim().length > 0) {
    try {
      const res = await generateAzureSpeechAudio(
        text,
        voiceName?.startsWith('id-ID-') ? voiceName : 'id-ID-GadisNeural'
      );
      return { ...res, usedEngine: 'azure' };
    } catch (e: any) {
      console.warn('[Auto-Fallback] Azure Speech gagal, beralih ke Google Cloud:', e.message);
    }
  }

  // 2. Try Google Cloud TTS if configured
  if (extraConfig.googleCloudApiKey && extraConfig.googleCloudApiKey.trim().length > 0) {
    try {
      const res = await generateGoogleCloudSpeechAudio(
        text,
        voiceName?.startsWith('id-ID-') ? voiceName : 'id-ID-Neural2-A'
      );
      return { ...res, usedEngine: 'google-cloud' };
    } catch (e: any) {
      console.warn('[Auto-Fallback] Google Cloud TTS gagal, beralih ke Gemini:', e.message);
    }
  }

  // 3. Try Gemini Studio (ONLY if a dedicated Gemini TTS key is configured, protecting main writing slots)
  if (extraConfig.dedicatedGeminiApiKey && extraConfig.dedicatedGeminiApiKey.trim().length > 0) {
    try {
      const res = await generateGeminiSpeechAudio(
        text,
        'gemini-3.8-flash-tts',
        voiceName || 'Aoede',
        emotionTag
      );
      return { ...res, usedEngine: 'gemini' };
    } catch (e: any) {
      console.warn('[Auto-Fallback] Dedicated Gemini gagal atau limit, beralih ke WASM Mobile Free:', e.message);
    }
  }

  // 4. Guaranteed Ultimate Fallback: WASM / Mobile Free Natural Stream (100% Free, 0 Limits)
  const res = await generateWasmSpeechAudio(text);
  return { ...res, usedEngine: 'wasm' };
}

export function getModelsForEngine(engine: TTSEngineMode): AITTSModelOption[] {
  switch (engine) {
    case 'auto':
      return AUTO_TTS_MODELS;
    case 'azure':
      return AZURE_TTS_MODELS;
    case 'google-cloud':
      return GOOGLE_CLOUD_TTS_MODELS;
    case 'wasm':
      return WASM_TTS_MODELS;
    case 'gemini':
      return GEMINI_TTS_MODELS;
    case 'groq':
      return GROQ_TTS_MODELS;
    default:
      return AUTO_TTS_MODELS;
  }
}

export function getVoicesForEngine(engine: TTSEngineMode): AIVoiceOption[] {
  switch (engine) {
    case 'auto':
      return [...AZURE_VOICES, ...GOOGLE_CLOUD_VOICES, ...WASM_VOICES];
    case 'azure':
      return AZURE_VOICES;
    case 'google-cloud':
      return GOOGLE_CLOUD_VOICES;
    case 'wasm':
      return WASM_VOICES;
    case 'gemini':
      return GEMINI_VOICES;
    case 'groq':
      return GROQ_VOICES;
    default:
      return AZURE_VOICES;
  }
}
