import { ParagraphEmotionTag, EmotionType } from '../types';
import { generateWithSmartFallback } from './aiService';
import { hashString } from '../utils/tensionUtils';

export function getEmotionAcoustics(emotion: EmotionType, intensity: number = 3): { pitchMod: number; rateMod: number; icon: string; label: string; color: string } {
  const normIntensity = Math.max(1, Math.min(5, intensity));
  const intensityFactor = (normIntensity - 3) * 0.05; // -0.1 to +0.1

  switch (emotion) {
    case 'whisper':
      return {
        pitchMod: Math.max(0.75, 0.85 - intensityFactor),
        rateMod: Math.max(0.80, 0.90 - intensityFactor),
        icon: '🤫',
        label: 'Berbisik (Rahasia / Takut)',
        color: 'text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
      };
    case 'suspense':
      return {
        pitchMod: Math.max(0.80, 0.90 - intensityFactor),
        rateMod: Math.max(0.85, 0.95),
        icon: '🔍',
        label: 'Menegangkan (Waspada)',
        color: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30',
      };
    case 'anger':
      return {
        pitchMod: Math.min(1.35, 1.15 + intensityFactor),
        rateMod: Math.min(1.35, 1.15 + intensityFactor),
        icon: '😠',
        label: 'Marah / Geram (Membentak)',
        color: 'text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/30',
      };
    case 'fear':
      return {
        pitchMod: Math.min(1.40, 1.20 + intensityFactor),
        rateMod: Math.min(1.40, 1.25 + intensityFactor),
        icon: '😨',
        label: 'Panik / Cemas (Gemetar)',
        color: 'text-purple-600 dark:text-purple-400 bg-purple-500/10 border-purple-500/30',
      };
    case 'sadness':
      return {
        pitchMod: Math.max(0.75, 0.88 - intensityFactor),
        rateMod: Math.max(0.75, 0.85 - intensityFactor),
        icon: '😢',
        label: 'Sedih / Pilu (Lirih)',
        color: 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/30',
      };
    case 'joy':
      return {
        pitchMod: Math.min(1.25, 1.10 + intensityFactor),
        rateMod: Math.min(1.25, 1.05 + intensityFactor),
        icon: '😄',
        label: 'Gembira / Hangat (Riang)',
        color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
      };
    case 'climax':
      return {
        pitchMod: Math.min(1.45, 1.28 + intensityFactor),
        rateMod: Math.min(1.45, 1.30 + intensityFactor),
        icon: '🔥',
        label: 'Klimaks Hidup-Mati (Histeris)',
        color: 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/30',
      };
    case 'solemn':
      return {
        pitchMod: 0.92,
        rateMod: 0.90,
        icon: '📜',
        label: 'Megah / Puitis (Khidmat)',
        color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/30',
      };
    case 'neutral':
    default:
      return {
        pitchMod: 1.0,
        rateMod: 1.0,
        icon: '📖',
        label: 'Narasi Alami (Santai)',
        color: 'text-slate-500 dark:text-slate-400 bg-slate-500/10 border-slate-500/20',
      };
  }
}

export async function analyzeChapterDramaScriptWithAI(
  paragraphs: string[],
  chapterTitle: string
): Promise<ParagraphEmotionTag[]> {
  if (paragraphs.length === 0) return [];

  // Limit to 45 paragraphs per chunk to avoid token overflow
  const sampledList = paragraphs
    .map((p, idx) => `[P${idx}]: ${p.length > 250 ? p.slice(0, 250) + '...' : p}`)
    .join('\n\n');

  const prompt = `Anda adalah Sutradara Teater Audio & Drama Sandiwara Radio Ahli.
Tugas Anda adalah membedah naskah Bab "${chapterTitle}" dan memberikan petunjuk akting vokal (Vocal Direction & Emotion Tags) untuk setiap paragraf/dialog agar aktor pengisi suara membacakannya dengan intonasi emosi yang tepat.

Panduan Emosi Vokal (Pilih salah satu untuk setiap paragraf):
- "neutral": Narasi deskripsi biasa, santai, pencerita netral.
- "whisper": Berbisik, rahasia, takut ketahuan, suara desah pelan.
- "suspense": Menegangkan, waspada, mencurigakan, tempo lambat berbobot.
- "anger": Marah, geram, membentak, konfrontasi keras.
- "fear": Panik, ketakutan, cemas, napas terengah/gemetar.
- "sadness": Sedih, pilu, muram, lirih, terisak.
- "joy": Gembira, tawa, hangat, riang bersahabat.
- "climax": Teriakan hidup-mati, puncak adegan meledak, histeris.
- "solemn": Khidmat, megah, puitis, berwibawa.

Daftar Paragraf Naskah:
${sampledList}

INSTRUKSI PENTING:
Keluarkan HANYA array JSON murni tanpa markdown, tanpa pengantar, tanpa penutup. Format persis:
[
  {
    "index": 0,
    "speaker": "Narator",
    "isDialogue": false,
    "emotion": "suspense",
    "intensity": 3,
    "actingNotes": "Suara berat waspada, jeda koma agak ditahan"
  },
  {
    "index": 1,
    "speaker": "Roy",
    "isDialogue": true,
    "emotion": "anger",
    "intensity": 4,
    "actingNotes": "Membentak keras dengan nada tinggi penuh dendam"
  }
]`;

  const sysInstruction =
    'Anda adalah Sutradara Suara Sandiwara Radio profesional yang membedah emosi naskah dan selalu membalas dalam JSON array valid.';

  const response = await generateWithSmartFallback(prompt, sysInstruction);
  const rawText = response.text?.trim() || '';

  try {
    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) {
        return parsed.map((item, fallbackIdx) => {
          const idx = typeof item.index === 'number' ? item.index : fallbackIdx;
          const paraText = paragraphs[idx] || '';
          const emo: EmotionType = [
            'neutral',
            'whisper',
            'suspense',
            'anger',
            'fear',
            'sadness',
            'joy',
            'climax',
            'solemn',
          ].includes(item.emotion)
            ? item.emotion
            : 'neutral';

          const intensity = typeof item.intensity === 'number' ? Math.max(1, Math.min(5, item.intensity)) : 3;
          const acoustics = getEmotionAcoustics(emo, intensity);

          return {
            paragraphIndex: idx,
            textHash: hashString(paraText),
            speaker: item.speaker || (paraText.startsWith('"') || paraText.startsWith('“') ? 'Karakter' : 'Narator'),
            isDialogue: typeof item.isDialogue === 'boolean' ? item.isDialogue : (paraText.includes('"') || paraText.includes('“')),
            emotion: emo,
            emotionLabel: acoustics.label,
            intensity,
            pitchMod: acoustics.pitchMod,
            rateMod: acoustics.rateMod,
            actingNotes: item.actingNotes || acoustics.label,
          };
        });
      }
    }
  } catch (err) {
    console.warn('Gagal parse naskah emosi sutradara AI:', err, rawText);
  }

  // Fallback heuristic if AI parsing fails
  return paragraphs.map((para, idx) => {
    let emo: EmotionType = 'neutral';
    let speaker = 'Narator';
    const isDiag = para.includes('"') || para.includes('“');
    if (isDiag) speaker = 'Karakter';

    const lower = para.toLowerCase();
    if (/[!?]{2,}|darah|teriak|mati|hancur|lari|panik/.test(lower)) {
      emo = isDiag ? 'anger' : 'climax';
    } else if (/bisik|rahasia|sembunyi|jangan suara/.test(lower)) {
      emo = 'whisper';
    } else if (/air mata|menangis|isak|pilu|duka/.test(lower)) {
      emo = 'sadness';
    } else if (/gelap|curiga|langkah|waspada|misteri/.test(lower)) {
      emo = 'suspense';
    }

    const acoustics = getEmotionAcoustics(emo, 3);
    return {
      paragraphIndex: idx,
      textHash: hashString(para),
      speaker,
      isDialogue: isDiag,
      emotion: emo,
      emotionLabel: acoustics.label,
      intensity: 3,
      pitchMod: acoustics.pitchMod,
      rateMod: acoustics.rateMod,
      actingNotes: acoustics.label,
    };
  });
}
