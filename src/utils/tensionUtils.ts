import { ParagraphTensionItem, TensionDisplayMode } from '../types';
import { generateWithSmartFallback } from '../services/aiService';

// Fast DJB2 string hash for verifying paragraph text consistency
export function hashString(str: string): string {
  let hash = 5381;
  const clean = str.trim();
  for (let i = 0; i < clean.length; i++) {
    hash = ((hash << 5) + hash) + clean.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(36);
}

export interface TensionColorInfo {
  score: number;
  hex: string;
  bgHex: string;
  badgeBg: string;
  badgeText: string;
  borderClass: string;
  label: string;
}

export function getTensionColor(score: number): TensionColorInfo {
  const s = Math.max(0, Math.min(100, Math.round(score)));

  if (s <= 30) {
    return {
      score: s,
      hex: '#10b981', // Emerald
      bgHex: 'rgba(16, 185, 129, 0.08)',
      badgeBg: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
      badgeText: 'text-emerald-600 dark:text-emerald-400',
      borderClass: 'border-emerald-500',
      label: 'Tenang / Eksposisi',
    };
  }

  if (s <= 60) {
    return {
      score: s,
      hex: '#f59e0b', // Amber
      bgHex: 'rgba(245, 158, 11, 0.08)',
      badgeBg: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
      badgeText: 'text-amber-600 dark:text-amber-400',
      borderClass: 'border-amber-500',
      label: 'Menegangkan / Penyelidikan',
    };
  }

  if (s <= 80) {
    return {
      score: s,
      hex: '#f97316', // Orange
      bgHex: 'rgba(249, 115, 22, 0.08)',
      badgeBg: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30',
      badgeText: 'text-orange-600 dark:text-orange-400',
      borderClass: 'border-orange-500',
      label: 'Tinggi / Konflik',
    };
  }

  return {
    score: s,
    hex: '#ef4444', // Red/Crimson
    bgHex: 'rgba(239, 68, 68, 0.1)',
    badgeBg: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
    badgeText: 'text-rose-600 dark:text-rose-400',
    borderClass: 'border-rose-500',
    label: 'Puncak / Klimaks',
  };
}

// Extract valid text paragraphs from contentEditable container
export function extractParagraphsFromEditor(container: HTMLElement): Array<{ element: HTMLElement; text: string; hash: string }> {
  const results: Array<{ element: HTMLElement; text: string; hash: string }> = [];
  const children = Array.from(container.children) as HTMLElement[];

  // If editor has block children (<p>, <div>, <blockquote>, etc.)
  if (children.length > 0) {
    for (const child of children) {
      // Skip figures, images, or non-text containers
      if (child.tagName === 'FIGURE' || child.classList.contains('story-image-block')) {
        continue;
      }
      const txt = child.innerText?.trim() || '';
      if (txt.length > 0) {
        results.push({
          element: child,
          text: txt,
          hash: hashString(txt),
        });
      }
    }
  }

  // Fallback if no block tags (e.g. single raw text node)
  if (results.length === 0) {
    const raw = container.innerText?.trim() || '';
    if (raw.length > 0) {
      results.push({
        element: container,
        text: raw,
        hash: hashString(raw),
      });
    }
  }

  return results;
}

// AI prompt to analyze tension score (0-100) per paragraph efficiently
export async function analyzeChapterTensionWithAI(
  paragraphs: string[],
  chapterTitle: string
): Promise<Array<{ index: number; score: number; label: string; note: string }>> {
  if (paragraphs.length === 0) return [];

  // Cap max tokens by taking up to 50 paragraphs or truncating very long paragraphs
  const numberedList = paragraphs
    .map((p, idx) => `[P${idx}]: ${p.length > 300 ? p.slice(0, 300) + '...' : p}`)
    .join('\n\n');

  const prompt = `Anda adalah editor sastra dan kurator dramatisasi novel.
Tugas Anda adalah menilai tingkat intensitas narasi / ketegangan emosi (Tension Score) untuk setiap paragraf naskah Bab "${chapterTitle}".

Panduan Skala Skor (0 - 100):
- 0 - 30: Tenang / Eksposisi (Deskripsi suasana santai, pemandangan, transisi latar, jeda istirahat).
- 31 - 60: Menegangkan / Investigasi (Dialog serius, kecurigaan, teka-teki, rasa cemas, konflik mulai muncul).
- 61 - 80: Tinggi / Konflik (Perdebatan memanas, aksi cepat, bahaya mendekat, tempo kalimat memburu).
- 81 - 100: Puncak / Klimaks (Pertarungan hidup-mati, pengungkapan twist besar, pengkhianatan, klimaks emosional luar biasa).

Daftar Paragraf Naskah:
${numberedList}

INSTRUKSI PENTING:
Balas HANYA dengan array JSON murni tanpa markdown pembuka, tanpa pengantar, dan tanpa penutup. Format persis:
[
  {"index": 0, "score": 25, "label": "Tenang", "note": "Deskripsi suasana pagi"},
  {"index": 1, "score": 75, "label": "Konflik", "note": "Kedatangan musuh secara mendadak"}
]`;

  const sysInstruction =
    'Anda adalah AI penganalisis kurva dramatisasi naskah novel profesional yang selalu membalas dalam JSON array valid.';

  const response = await generateWithSmartFallback(prompt, sysInstruction);
  const rawText = response.text?.trim() || '';

  try {
    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) {
        return parsed.map((item, idx) => ({
          index: typeof item.index === 'number' ? item.index : idx,
          score: typeof item.score === 'number' ? Math.max(0, Math.min(100, item.score)) : 50,
          label: item.label || 'Sedang',
          note: item.note || '',
        }));
      }
    }
  } catch (err) {
    console.warn('Gagal parse JSON tensi narasi:', err, rawText);
  }

  // Fallback heuristic if AI output couldn't be parsed
  return paragraphs.map((p, idx) => {
    let score = 30;
    const lower = p.toLowerCase();
    if (/[!?]{2,}|darah|teriak|mati|pedang|hancur|lari|panik|serang|ledak/.test(lower)) {
      score = 85;
    } else if (/[!?]|curiga|tanya|rahasia|gelap|tatap|tegang|langkah/.test(lower)) {
      score = 55;
    }
    return {
      index: idx,
      score,
      label: score > 70 ? 'Konflik' : score > 45 ? 'Investigasi' : 'Tenang',
      note: 'Analisis heuristik leksikal',
    };
  });
}
