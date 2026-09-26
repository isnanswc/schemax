import { loadAISettings } from './aiService';
import { hashString } from '../utils/tensionUtils';

export interface AIVoiceOption {
  id: string;
  name: string;
  gender: 'female' | 'male';
  description: string;
  avatar: string;
}

export interface AITTSModelOption {
  id: string;
  name: string;
  provider: 'gemini' | 'groq';
  description: string;
}

// Available TTS Models for Google Gemini
export const GEMINI_TTS_MODELS: AITTSModelOption[] = [
  {
    id: 'gemini-3.8-flash-tts',
    name: 'Gemini 3.8 Flash TTS (Rekomendasi)',
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

// Available TTS Models for Groq Cloud
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
  },
  {
    id: 'Kore',
    name: 'Kore',
    gender: 'female',
    description: 'Wanita • Jernih, tenang, dan berwibawa',
    avatar: '👩‍💼',
  },
  {
    id: 'Puck',
    name: 'Puck',
    gender: 'male',
    description: 'Pria • Dinamis, ramah, dan energetik',
    avatar: '👨',
  },
  {
    id: 'Fenrir',
    name: 'Fenrir',
    gender: 'male',
    description: 'Pria • Berat, misterius, dan dramatis (Cocok untuk Aksi & Thriller)',
    avatar: '🧔',
  },
  {
    id: 'Charon',
    name: 'Charon',
    gender: 'male',
    description: 'Pria • Bijak, berbobot, dan santai',
    avatar: '👨‍🦳',
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
  },
  {
    id: 'daphne',
    name: 'Daphne',
    gender: 'female',
    description: 'Wanita • Jernih dan berartikulasi tegas',
    avatar: '👩‍💼',
  },
  {
    id: 'orion',
    name: 'Orion',
    gender: 'male',
    description: 'Pria • Suara energetik dan dramatis',
    avatar: '👨',
  },
  {
    id: 'canopy',
    name: 'Canopy',
    gender: 'male',
    description: 'Pria • Suara seimbang dan netral',
    avatar: '👨‍🦱',
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

  // Load configured Gemini API key
  const aiConfig = loadAISettings();
  const geminiSlot = aiConfig.slots.find(
    (s) => s.provider === 'gemini' && s.isActive && s.apiKey && s.apiKey.trim().length > 0
  );

  if (!geminiSlot || !geminiSlot.apiKey) {
    throw new Error(
      'API Key Google AI Studio (Gemini) belum ditemukan. Buka Pengaturan AI (ikon ✨ di header) untuk memasukkan API Key Gemini gratis Anda.'
    );
  }

  const apiKey = geminiSlot.apiKey.trim();
  const modelsToTry = [
    modelName,
    'gemini-3.8-flash-tts',
    'gemini-3.8-flash-lite-tts',
  ].filter((v, idx, arr) => arr.indexOf(v) === idx && Boolean(v));

  let lastError: Error | null = null;

  for (const model of modelsToTry) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: {
            parts: [
              {
                text: 'You are an award-winning theatrical audiobook narrator and voice actor. Read the Indonesian story text naturally, dynamically, and expressively. Strictly interpret and embody inline emotion tags enclosed in angle brackets (such as <angry>, <furious>, <whisper>, <sad>, <sobbing>, <cheerful>, <suspenseful>, <dramatic>, <solemn>, <panicked>, etc.) to modulate vocal intensity, breath, pitch, and pacing. CRITICAL RULE: NEVER speak aloud or spell out the emotion tag names or angle brackets. Only read the story sentences themselves.',
              },
            ],
          },
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
        console.warn(`[Gemini TTS] Model ${model} HTTP ${response.status}:`, msg);
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

  throw lastError || new Error('Gagal menghasilkan audio suara AI dari Google AI Studio.');
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
