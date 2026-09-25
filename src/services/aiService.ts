import {
  AIProviderType,
  AIModelOption,
  AIKeySlot,
  AISettingsConfig,
  AIGenerateResult,
  AIGenerationEvent,
} from '../types/ai';

// Modern baseline defaults (Gemini 2.5/2.0 series & Groq current lineup)
export const DEFAULT_GEMINI_MODELS: AIModelOption[] = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Rekomendasi Utama: Cepat, cerdas, efisien' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Kemampuan penalaran mendalam & analisis luas' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Kecepatan tinggi generasi teks kreatif' },
  { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite', description: 'Latensi ultra-rendah & hemat kuota' },
];

export const DEFAULT_GROQ_MODELS: AIModelOption[] = [
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile', description: 'Rekomendasi Utama: Sangat mahir sastra & dialog' },
  { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', description: 'Respons instan secepat kilat' },
  { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B (32k)', description: 'Arsitektur MoE untuk deskripsi panjang' },
  { id: 'gemma2-9b-it', name: 'Gemma 2 9B IT', description: 'Model open weights Google presisi tinggi' },
];

const STORAGE_KEY = 'schemax_ai_config_v2';

export function getDefaultAISettings(): AISettingsConfig {
  return {
    smartAdjustEnabled: true,
    providerPriority: ['gemini', 'groq'],
    geminiConfig: {
      fallbackModels: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
      cachedModels: DEFAULT_GEMINI_MODELS,
    },
    groqConfig: {
      fallbackModels: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
      cachedModels: DEFAULT_GROQ_MODELS,
    },
    slots: [
      {
        id: 'slot_gemini_1',
        provider: 'gemini',
        label: 'Gemini Slot 1',
        apiKey: '',
        isActive: true,
        stats: {
          totalRequests: 0,
          successRequests: 0,
          failedRequests: 0,
          consecutiveFailures: 0,
        },
      },
      {
        id: 'slot_groq_1',
        provider: 'groq',
        label: 'Groq Slot 1',
        apiKey: '',
        isActive: true,
        stats: {
          totalRequests: 0,
          successRequests: 0,
          failedRequests: 0,
          consecutiveFailures: 0,
        },
      },
    ],
  };
}

export function loadAISettings(): AISettingsConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultAISettings();
    const parsed = JSON.parse(raw);
    if (!parsed.slots || !Array.isArray(parsed.slots)) return getDefaultAISettings();

    // Ensure geminiConfig & groqConfig exist
    if (!parsed.geminiConfig) {
      parsed.geminiConfig = {
        fallbackModels: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
        cachedModels: DEFAULT_GEMINI_MODELS,
      };
    }
    if (!parsed.groqConfig) {
      parsed.groqConfig = {
        fallbackModels: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
        cachedModels: DEFAULT_GROQ_MODELS,
      };
    }

    return parsed;
  } catch (e) {
    console.error('Gagal membaca konfigurasi AI:', e);
    return getDefaultAISettings();
  }
}

export function saveAISettings(config: AISettingsConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Gagal menyimpan konfigurasi AI:', e);
  }
}

// Fetch Live Models Directly from Google Gemini API
export async function fetchLiveGeminiModels(apiKey: string): Promise<AIModelOption[]> {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Masukkan API Key Gemini untuk mengambil daftar model.');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey.trim()}`;
  const response = await fetch(url);

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${response.status} Gagal memuat model Gemini.`);
  }

  const data = await response.json();
  const rawList: any[] = data.models || [];

  // Filter models that support generateContent and are chat-capable
  const models: AIModelOption[] = rawList
    .filter((m: any) => {
      const methods: string[] = m.supportedGenerationMethods || [];
      return methods.includes('generateContent') && !m.name.includes('embedding') && !m.name.includes('aqa');
    })
    .map((m: any) => {
      const cleanId = m.name.replace(/^models\//, '');
      return {
        id: cleanId,
        name: m.displayName || cleanId,
        description: m.description ? m.description.slice(0, 80) + '...' : 'Model Gemini Aktif',
      };
    });

  if (models.length === 0) {
    throw new Error('Tidak ada model Gemini yang mendukung generasi teks ditemukan.');
  }

  return models;
}

// Fetch Live Models Directly from Groq API
export async function fetchLiveGroqModels(apiKey: string): Promise<AIModelOption[]> {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Masukkan API Key Groq untuk mengambil daftar model.');
  }

  const url = 'https://api.groq.com/openai/v1/models';
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey.trim()}`,
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${response.status} Gagal memuat model Groq.`);
  }

  const data = await response.json();
  const rawList: any[] = data.data || [];

  // Filter out whisper / audio / non-llm models
  const models: AIModelOption[] = rawList
    .filter((m: any) => !m.id.includes('whisper') && !m.id.includes('embed'))
    .map((m: any) => ({
      id: m.id,
      name: m.id,
      description: `Groq Model (Aktif)`,
    }));

  if (models.length === 0) {
    throw new Error('Tidak ada model teks Groq yang ditemukan.');
  }

  // Sort: Llama 3 first, then Mixtral, then others
  models.sort((a, b) => {
    if (a.id.includes('llama-3.3')) return -1;
    if (b.id.includes('llama-3.3')) return 1;
    return a.id.localeCompare(b.id);
  });

  return models;
}

// Smart Adjust Health Score Calculation
export function calculateSlotHealth(slot: AIKeySlot): {
  score: number;
  percentage: number;
  status: 'healthy' | 'degraded' | 'failing' | 'untested';
} {
  const { totalRequests, successRequests, consecutiveFailures } = slot.stats;

  if (!slot.apiKey || !slot.apiKey.trim()) {
    return { score: -100, percentage: 0, status: 'untested' };
  }

  if (totalRequests === 0) {
    return { score: 85, percentage: 100, status: 'untested' };
  }

  const successRate = (successRequests / totalRequests) * 100;
  const penalty = consecutiveFailures * 30;
  const score = Math.max(0, Math.round(successRate - penalty));

  let status: 'healthy' | 'degraded' | 'failing' | 'untested' = 'healthy';
  if (consecutiveFailures >= 2 || score < 40) {
    status = 'failing';
  } else if (consecutiveFailures === 1 || score < 75) {
    status = 'degraded';
  }

  return {
    score,
    percentage: Math.round(successRate),
    status,
  };
}

// Call Google Gemini API
async function executeGeminiRequest(
  apiKey: string,
  model: string,
  prompt: string,
  systemPrompt?: string
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;

  const combinedPrompt = systemPrompt
    ? `${systemPrompt}\n\n[Instruksi Penulis]:\n${prompt}`
    : prompt;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: combinedPrompt }],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error?.message || `HTTP ${response.status} ${response.statusText}`;
    throw new Error(message);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Respon Gemini kosong.');
  }

  return text.trim();
}

// Call Groq Cloud API
async function executeGroqRequest(
  apiKey: string,
  model: string,
  prompt: string,
  systemPrompt?: string
): Promise<string> {
  const url = 'https://api.groq.com/openai/v1/chat/completions';

  const messages: any[] = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey.trim()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error?.message || `HTTP ${response.status} ${response.statusText}`;
    throw new Error(message);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('Respon Groq kosong.');
  }

  return text.trim();
}

// Smart Execution Dispatcher with Global 3-Model Fallback & Multi-Slot Cascading
export async function generateWithSmartFallback(
  prompt: string,
  systemPrompt?: string,
  onAttempt?: (event: AIGenerationEvent) => void
): Promise<AIGenerateResult> {
  const config = loadAISettings();
  const attempts: AIGenerationEvent[] = [];

  // Filter slots that have API keys
  let activeSlots = config.slots.filter((s) => s.isActive && s.apiKey && s.apiKey.trim().length > 0);

  if (activeSlots.length === 0) {
    throw new Error(
      'Belum ada API Key yang dikonfigurasi. Silakan buka Pengaturan AI (ikon ✨ di header) untuk memasukkan API Key Gemini atau Groq Anda.'
    );
  }

  // Sort slots according to Smart Adjust algorithm or Provider Priority
  if (config.smartAdjustEnabled) {
    activeSlots.sort((a, b) => {
      const healthA = calculateSlotHealth(a).score;
      const healthB = calculateSlotHealth(b).score;
      return healthB - healthA;
    });
  } else {
    activeSlots.sort((a, b) => {
      const priorityA = config.providerPriority.indexOf(a.provider);
      const priorityB = config.providerPriority.indexOf(b.provider);
      return priorityA - priorityB;
    });
  }

  // Iterate over Slots
  for (const slot of activeSlots) {
    // Determine the 3 fallback models: inherit from provider's global config, or use slot custom override
    const providerGlobal = slot.provider === 'gemini' ? config.geminiConfig : config.groqConfig;
    const fallbackModels = slot.models && slot.models.length > 0
      ? slot.models
      : providerGlobal.fallbackModels;

    for (let modelIndex = 0; modelIndex < fallbackModels.length; modelIndex++) {
      const model = fallbackModels[modelIndex];
      if (!model) continue;

      const startTime = Date.now();
      const attemptEvent: AIGenerationEvent = {
        provider: slot.provider,
        slotLabel: slot.label,
        model: model,
        status: 'attempt',
      };
      onAttempt?.(attemptEvent);

      try {
        let resultText = '';
        if (slot.provider === 'gemini') {
          resultText = await executeGeminiRequest(slot.apiKey, model, prompt, systemPrompt);
        } else if (slot.provider === 'groq') {
          resultText = await executeGroqRequest(slot.apiKey, model, prompt, systemPrompt);
        }

        const latency = Date.now() - startTime;

        // Record SUCCESS stats
        slot.stats.totalRequests += 1;
        slot.stats.successRequests += 1;
        slot.stats.consecutiveFailures = 0;
        slot.stats.lastSuccessAt = Date.now();
        slot.stats.lastUsedAt = Date.now();
        slot.stats.avgLatencyMs = slot.stats.avgLatencyMs
          ? Math.round((slot.stats.avgLatencyMs + latency) / 2)
          : latency;
        saveAISettings(config);

        const successEvent: AIGenerationEvent = {
          provider: slot.provider,
          slotLabel: slot.label,
          model: model,
          status: 'success',
          latencyMs: latency,
        };
        attempts.push(successEvent);
        onAttempt?.(successEvent);

        return {
          text: resultText,
          provider: slot.provider,
          slotLabel: slot.label,
          model: model,
          attempts,
        };
      } catch (err: any) {
        const latency = Date.now() - startTime;
        const errorMessage = err?.message || 'Gagal memproses';

        // Record FAILURE stats
        slot.stats.totalRequests += 1;
        slot.stats.failedRequests += 1;
        slot.stats.consecutiveFailures += 1;
        slot.stats.lastError = errorMessage;
        slot.stats.lastUsedAt = Date.now();
        saveAISettings(config);

        const failEvent: AIGenerationEvent = {
          provider: slot.provider,
          slotLabel: slot.label,
          model: model,
          status: 'fallback',
          error: errorMessage,
          latencyMs: latency,
        };
        attempts.push(failEvent);
        onAttempt?.(failEvent);

        console.warn(
          `[Schemax AI Fallback] ${slot.provider.toUpperCase()} (${slot.label}) model "${model}" gagal: ${errorMessage}. Mencoba fallback berikutnya...`
        );
      }
    }
  }

  // If we reach here, ALL slots and ALL models failed
  const errorSummary = attempts
    .map((att) => `• [${att.provider.toUpperCase()} - ${att.model} (${att.slotLabel})]: ${att.error || 'Gagal'}`)
    .join('\n');

  throw new Error(
    `Seluruh model dan API Key mengalami kegagalan:\n${errorSummary}\n\nSilakan periksa kuota atau sinkronkan daftar model terbaru di Pengaturan AI.`
  );
}

// Test Connection for a specific slot and model
export async function testSlotConnection(
  slot: AIKeySlot,
  modelName: string
): Promise<{ success: boolean; message: string; latencyMs: number }> {
  const startTime = Date.now();
  try {
    const testPrompt = 'Tes koneksi sistem Schemax. Jawab hanya dengan kata: OK_TERHUBUNG';

    if (slot.provider === 'gemini') {
      await executeGeminiRequest(slot.apiKey, modelName, testPrompt);
    } else {
      await executeGroqRequest(slot.apiKey, modelName, testPrompt);
    }

    const latencyMs = Date.now() - startTime;
    return {
      success: true,
      message: `Terhubung dengan ${modelName}! (${latencyMs}ms)`,
      latencyMs,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    return {
      success: false,
      message: err?.message || 'Koneksi gagal.',
      latencyMs,
    };
  }
}

// ==========================================
// 📖 CHAPTER STUDIO AI INTELLIGENCE ENGINES
// ==========================================

// 1. Chapter Auto-Summary Engine
export async function generateChapterSummary(
  chapterTitle: string,
  bookTitle: string,
  contentText: string
): Promise<string> {
  const prompt = `Anda adalah asisten editor novel profesional. Rangkum inti naskah bab berikut ini secara jelas, padat, dan menarik dalam 1 sampai 2 paragraf.

Judul Buku: "${bookTitle}"
Judul Bab: "${chapterTitle}"

Naskah Cerita Bab:
${contentText.slice(0, 7000)}

Instruksi:
- Fokus pada kejadian utama, perkembangan karakter, dan perubahan situasi penting dalam bab ini.
- Tulis langsung teks rangkumannya dalam Bahasa Indonesia sastrawi tanpa kata pengantar atau judul tambahan.`;

  const systemPrompt = 'Anda adalah editor sastra profesional yang ahli merangkum isi cerita.';
  const res = await generateWithSmartFallback(prompt, systemPrompt);
  return res.text.trim();
}

// 2. Chapter Auto-Plot Engine (Hook, Rising Action, Climax, Resolution)
export async function generateChapterAutoPlot(
  chapterTitle: string,
  bookTitle: string,
  contentText: string,
  premise?: string
): Promise<{ hook: string; risingAction: string; climax: string; resolution: string }> {
  const prompt = `Analisis atau petakan alur struktur plot untuk bab berikut ini menjadi 4 komponen dramatik:
1. Hook (Pemicu / Awal bab yang memikat)
2. Rising Action (Eskalasi masalah atau ketegangan)
3. Climax (Puncak konflik, keputusan besar, atau insiden genting)
4. Resolution (Penutup, transisi, atau cliffhanger)

Judul Buku: "${bookTitle}"
Judul Bab: "${chapterTitle}"
Premis Bab: ${premise || 'Tidak ada premis awal'}

Isi Naskah Bab:
${contentText ? contentText.slice(0, 7000) : (premise || 'Gunakan premis bab')}

Berikan output HANYA berupa JSON valid persis dengan struktur ini tanpa teks pembuka atau penutup lain:
{
  "hook": "deskripsi hook...",
  "risingAction": "deskripsi eskalasi...",
  "climax": "deskripsi puncak ketegangan...",
  "resolution": "deskripsi penutup atau cliffhanger..."
}`;

  const systemPrompt = 'Anda adalah konsultan plot dan story analyst profesional. Hasilkan hanya JSON yang valid.';
  const res = await generateWithSmartFallback(prompt, systemPrompt);

  try {
    const cleanJson = res.text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);
    return {
      hook: parsed.hook || '',
      risingAction: parsed.risingAction || '',
      climax: parsed.climax || '',
      resolution: parsed.resolution || '',
    };
  } catch (err) {
    // Regex or fallback parser if JSON was surrounded by text
    return {
      hook: extractSection(res.text, 'Hook') || res.text.slice(0, 150),
      risingAction: extractSection(res.text, 'Rising Action') || extractSection(res.text, 'Eskalasi') || '',
      climax: extractSection(res.text, 'Climax') || extractSection(res.text, 'Puncak') || '',
      resolution: extractSection(res.text, 'Resolution') || extractSection(res.text, 'Penutup') || '',
    };
  }
}

// Helper to extract section in fallback
function extractSection(text: string, title: string): string {
  const match = text.match(new RegExp(`${title}[:\\s*-]+([\\s\\S]*?)(?=(?:Hook|Rising|Climax|Resolution|Eskalasi|Puncak|Penutup|$))`, 'i'));
  return match ? match[1].trim() : '';
}

// 3. Chapter Auto-Scene Decomposition Engine
export async function generateChapterAutoScenes(
  chapterTitle: string,
  bookTitle: string,
  contentText: string
): Promise<Array<{ id: string; sceneNumber: number; title: string; setting: string; characters: string[]; summary: string; goalConflict?: string }>> {
  const prompt = `Bedah dan uraikan naskah bab berikut menjadi daftar adegan-adegan (scenes breakdown) berurutan.

Judul Buku: "${bookTitle}"
Judul Bab: "${chapterTitle}"

Isi Naskah Bab:
${contentText.slice(0, 7000)}

Berikan output HANYA berupa JSON array valid persis dengan struktur ini:
[
  {
    "sceneNumber": 1,
    "title": "Judul Singkat Adegan",
    "setting": "Latar tempat & waktu adegan",
    "characters": ["Nama Tokoh 1", "Nama Tokoh 2"],
    "summary": "Rangkuman kejadian dalam adegan ini",
    "goalConflict": "Tujuan tokoh atau konflik yang terjadi di adegan"
  }
]`;

  const systemPrompt = 'Anda adalah script reader dan editor adegan novel. Berikan HANYA format JSON array valid.';
  const res = await generateWithSmartFallback(prompt, systemPrompt);

  try {
    const cleanJson = res.text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);
    if (Array.isArray(parsed)) {
      return parsed.map((item, idx) => ({
        id: 'scene_' + Math.random().toString(36).substring(2, 9),
        sceneNumber: item.sceneNumber || idx + 1,
        title: item.title || `Adegan ${idx + 1}`,
        setting: item.setting || '',
        characters: Array.isArray(item.characters) ? item.characters : [],
        summary: item.summary || '',
        goalConflict: item.goalConflict || '',
      }));
    }
  } catch (err) {
    console.warn('Gagal parse JSON auto scenes, fallback to basic list:', err);
  }

  // Graceful fallback if JSON fails
  return [
    {
      id: 'scene_fallback_1',
      sceneNumber: 1,
      title: 'Adegan Pembuka Bab',
      setting: 'Sesuai naskah',
      characters: [],
      summary: res.text.slice(0, 250),
      goalConflict: '',
    },
  ];
}

// 4. Polish Raw Draft to Prose Engine
export async function enhanceRawToProse(
  rawText: string,
  bookTitle: string,
  chapterTitle: string,
  genre?: string
): Promise<string> {
  const prompt = `Anda adalah novelis dan ghostwriter berpengalaman. Ubah tulisan kasar / coretan ide (raw draft) berikut menjadi naskah cerita fiksi yang mengalir indah, deskriptif, dan memiliki dialog yang hidup.

Informasi Karya:
- Judul Buku: "${bookTitle}"
- Judul Bab: "${chapterTitle}"
- Genre: ${genre || 'Fiksi'}

Tulisan Kasar (Raw Draft):
${rawText}

Instruksi:
- Kembangkan poin-poin mentah menjadi adegan bernyawa (show, don't tell).
- Jaga konsistensi tone dan suasana cerita.
- Berikan HANYA hasil naskah cerita polesan dalam Bahasa Indonesia tanpa catatan pengantar.`;

  const systemPrompt = 'Anda adalah novelis masterclass yang ahli menyulap coretan mentah menjadi prosa sastra yang memukau.';
  const res = await generateWithSmartFallback(prompt, systemPrompt);
  return res.text.trim();
}

