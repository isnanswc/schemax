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
 * Generate speech audio from text using Google AI Studio (Gemini Multimodal Audio)
 */
export async function generateGeminiSpeechAudio(
  text: string,
  modelName: string = 'gemini-3.8-flash-tts',
  voiceName: string = 'Aoede',
  actingInstruction?: string
): Promise<{ audioUrl: string; mimeType: string }> {
  const cleanText = text.trim();
  if (!cleanText) {
    throw new Error('Teks naskah kosong.');
  }

  const cacheKey = `gemini_${modelName}_${voiceName}_${actingInstruction || ''}_${hashString(cleanText)}`;
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

    const promptText = actingInstruction
      ? `[Petunjuk Suara & Akting: ${actingInstruction}]\nBacakan kutipan berikut dalam bahasa Indonesia dengan intonasi manusia asli, artikulasi yang jelas, dan penjiwaan emosi:\n\n${cleanText}`
      : `Bacakan naskah cerita berikut dalam bahasa Indonesia dengan artikulasi yang jernih, jeda nafas yang alami, dan intonasi seorang pencerita (storyteller) profesional:\n\n${cleanText}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: promptText }],
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
  voiceName: string = 'autumn'
): Promise<{ audioUrl: string; mimeType: string }> {
  const cleanText = text.trim();
  if (!cleanText) {
    throw new Error('Teks naskah kosong.');
  }

  const cacheKey = `groq_${modelName}_${voiceName}_${hashString(cleanText)}`;
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
      input: cleanText,
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
