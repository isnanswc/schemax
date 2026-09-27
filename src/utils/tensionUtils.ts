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

export interface TensionAnalysisResult {
  items: Array<{
    index: number;
    score: number;
    label: string;
    note: string;
    hasPlothole?: boolean;
    plotholeSeverity?: 'warning' | 'critical';
    plotholeNote?: string;
    plotholeSuggestion?: string;
  }>;
  continuitySummary?: string;
  plotholeCount: number;
}

// AI prompt to analyze tension score (0-100) per paragraph AND check narrative continuity/plotholes against previous chapters
export async function analyzeChapterTensionWithAI(
  paragraphs: string[],
  chapterTitle: string,
  previousChaptersContext?: string
): Promise<TensionAnalysisResult> {
  if (paragraphs.length === 0) {
    return { items: [], plotholeCount: 0 };
  }

  // Cap max tokens by taking up to 50 paragraphs or truncating very long paragraphs
  const numberedList = paragraphs
    .map((p, idx) => `[P${idx}]: ${p.length > 350 ? p.slice(0, 350) + '...' : p}`)
    .join('\n\n');

  const hasPrev = Boolean(previousChaptersContext && previousChaptersContext.trim());

  const prompt = `Anda adalah editor sastra, kurator dramatisasi, dan continuity supervisor novel profesional.
Tugas Anda adalah melakukan 2 ANALISIS SEKALIGUS DALAM 1 LANGKAH (HEMAT TOKEN):
1. Menilai intensitas narasi / tensi emosional (Tension Score 0-100) untuk setiap paragraf.
2. Memeriksa apakah adegan dalam bab ini memiliki GAP LOGIKA atau PLOTHOLE terhadap peristiwa/fakta di bab-bab sebelumnya.

Bab yang Sedang Dianalisis: "${chapterTitle}"

${
  hasPrev
    ? `KONTEKS & FAKTA BAB-BAB SEBELUMNYA (KONSISTENSI & KONTINUITAS):
"""
${previousChaptersContext}
"""`
    : `(Ini adalah Bab Pembuka/Awal atau belum ada riwayat bab sebelumnya).`
}

Daftar Paragraf Naskah Bab Ini:
${numberedList}

PANDUAN SKALA TENSI (0 - 100):
- 0 - 30: Tenang / Eksposisi (Suasana santai, deskripsi latar, jeda).
- 31 - 60: Sedang / Investigasi (Dialog serius, kecurigaan, rasa cemas, misteri).
- 61 - 80: Tinggi / Konflik (Perdebatan sengit, aksi bahaya, tempo memburu).
- 81 - 100: Puncak / Klimaks (Pertarungan hidup-mati, pengungkapan twist besar, klimaks emosional).

PANDUAN DETEKSI GAP / PLOTHOLE:
- Teliti apakah ada:
  * Karakter yang tiba-tiba hadir padahal di bab sebelumnya terluka parah/ditawan/berada di tempat lain.
  * Barang/senjata yang mendadak muncul tanpa pernah diambil.
  * Pengetahuan/rahasia yang tiba-tiba diketahui karakter padahal belum pernah diungkap sebelumnya.
  * Kontradiksi motivasi, nama, latar waktu, atau hukum dunia yang melanggar kejadian bab lalu.
- Jika ADA plothole pada paragraf tertentu, set:
  * hasPlothole: true
  * plotholeSeverity: "warning" (anomali ringan/gap penjelasan) ATAU "critical" (kontradiksi berat/melanggar plot lalu)
  * plotholeNote: "Jelaskan dengan ringkas apa kontradiksi/gap-nya"
  * plotholeSuggestion: "Beri saran konkrit perbaikan kalimat/alur untuk penulis"

INSTRUKSI OUTPUT:
Balas HANYA dengan objek JSON valid persis dengan struktur ini:
{
  "continuitySummary": "Ringkasan 1-2 kalimat mengenai kesinambungan cerita bab ini dengan bab lalu...",
  "items": [
    {
      "index": 0,
      "score": 25,
      "label": "Tenang",
      "note": "Deskripsi suasana pagi",
      "hasPlothole": false
    },
    {
      "index": 1,
      "score": 75,
      "label": "Konflik",
      "note": "Perdebatan sengit",
      "hasPlothole": true,
      "plotholeSeverity": "warning",
      "plotholeNote": "Karakter Arya tiba-tiba memegang belati perak, padahal di Bab 2 belati tersebut tertinggal di kedai.",
      "plotholeSuggestion": "Tambahkan kalimat singkat bahwa Arya sempat mengambil kembali belatinya sebelum berangkat."
    }
  ]
}`;

  const sysInstruction =
    'Anda adalah AI penganalisis dramatisasi naskah dan supervisor kontinuitas novel profesional yang selalu membalas dalam format JSON valid.';

  const response = await generateWithSmartFallback(prompt, sysInstruction);
  const rawText = response.text?.trim() || '';

  try {
    let cleanJson = rawText;
    if (cleanJson.startsWith('```json')) {
      cleanJson = cleanJson.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
    } else if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const firstBrace = cleanJson.indexOf('{');
    const lastBrace = cleanJson.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      cleanJson = cleanJson.substring(firstBrace, lastBrace + 1);
      const parsed = JSON.parse(cleanJson);
      if (parsed && Array.isArray(parsed.items)) {
        const items = parsed.items.map((item: any, idx: number) => ({
          index: typeof item.index === 'number' ? item.index : idx,
          score: typeof item.score === 'number' ? Math.max(0, Math.min(100, item.score)) : 50,
          label: item.label || 'Sedang',
          note: item.note || '',
          hasPlothole: Boolean(item.hasPlothole),
          plotholeSeverity: item.plotholeSeverity === 'critical' ? ('critical' as const) : ('warning' as const),
          plotholeNote: item.plotholeNote || undefined,
          plotholeSuggestion: item.plotholeSuggestion || undefined,
        }));

        const plotholeCount = items.filter((it: any) => it.hasPlothole).length;
        return {
          items,
          continuitySummary: parsed.continuitySummary || undefined,
          plotholeCount,
        };
      }
    }

    // Try array fallback
    const firstBracket = cleanJson.indexOf('[');
    const lastBracket = cleanJson.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1) {
      const parsedArray = JSON.parse(cleanJson.substring(firstBracket, lastBracket + 1));
      if (Array.isArray(parsedArray)) {
        const items = parsedArray.map((item: any, idx: number) => ({
          index: typeof item.index === 'number' ? item.index : idx,
          score: typeof item.score === 'number' ? Math.max(0, Math.min(100, item.score)) : 50,
          label: item.label || 'Sedang',
          note: item.note || '',
          hasPlothole: Boolean(item.hasPlothole),
          plotholeSeverity: item.plotholeSeverity === 'critical' ? ('critical' as const) : ('warning' as const),
          plotholeNote: item.plotholeNote || undefined,
          plotholeSuggestion: item.plotholeSuggestion || undefined,
        }));
        return {
          items,
          plotholeCount: items.filter((it) => it.hasPlothole).length,
        };
      }
    }
  } catch (err) {
    console.warn('Gagal parse JSON tensi & plothole narasi:', err, rawText);
  }

  // Fallback heuristic if AI output couldn't be parsed
  const items = paragraphs.map((p, idx) => {
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
      hasPlothole: false,
    };
  });

  return {
    items,
    plotholeCount: 0,
  };
}
