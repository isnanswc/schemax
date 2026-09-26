import { loadAISettings } from './aiService';
import { hashString } from '../utils/tensionUtils';

export interface GeminiVoiceOption {
  id: string;
  name: string;
  gender: 'female' | 'male';
  description: string;
  avatar: string;
}

export const GEMINI_VOICES: GeminiVoiceOption[] = [
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

// Audio URL memory cache to avoid repeated requests and conserve API quota
const audioUrlCache = new Map<string, string>();

/**
 * Generate speech audio from text using Google AI Studio (Gemini Multimodal Audio)
 */
export async function generateGeminiSpeechAudio(
  text: string,
  voiceName: string = 'Aoede',
  actingInstruction?: string
): Promise<{ audioUrl: string; mimeType: string }> {
  const cleanText = text.trim();
  if (!cleanText) {
    throw new Error('Teks naskah kosong.');
  }

  const cacheKey = `${voiceName}_${actingInstruction || ''}_${hashString(cleanText)}`;
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
    'gemini-3.8-flash-tts',
    'gemini-3.8-flash-lite-tts',
  ];

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
      // Continue to next model fallback if available
    }
  }

  throw lastError || new Error('Gagal menghasilkan audio suara AI dari Google AI Studio.');
}
