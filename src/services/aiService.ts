import {
  AIProviderType,
  AIModelOption,
  AIKeySlot,
  AISettingsConfig,
  AIGenerateResult,
  AIGenerationEvent,
} from '../types/ai';
import {
  ChapterSceneItem,
  SceneGlosariumItem,
  ImagePromptSettings,
  WorldEntity,
  DetectedEntityCandidate,
  EntityRelationship,
  EntityCondition,
  RelationshipType,
} from '../types';

// Modern baseline defaults (Gemini 3.8 / 3.1 / 3.0 series & Groq current lineup)
export const DEFAULT_GEMINI_MODELS: AIModelOption[] = [
  { id: 'gemini-3.8-flash-preview', name: 'Gemini 3.8 Flash Preview (Terbaru & Rekomendasi Utama)', description: 'Generasi 3.8: Generasi Paling Cerdas, Responsif, Audio & Teks Generasi Terbaru' },
  { id: 'gemini-3.8-pro-preview', name: 'Gemini 3.8 Pro Preview', description: 'Generasi 3.8: Penalaran Mutakhir, Analisis Sastra Mendalam & Audio Ultra-Ekspresif' },
  { id: 'gemini-3.1-flash', name: 'Gemini 3.1 Flash', description: 'Generasi 3.1: Super Cepat, Cerdas, Konteks Masif untuk Naskah Panjang' },
  { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro', description: 'Generasi 3.1: Penalaran Mendalam & Analisis Sastra Luas' },
  { id: 'gemini-3.0-flash', name: 'Gemini 3.0 Flash', description: 'Generasi 3.0: Kecepatan Tinggi & Efisiensi Kuota' },
  { id: 'gemini-3.0-pro', name: 'Gemini 3.0 Pro', description: 'Generasi 3.0: Analisis Struktur Plot Kompleks' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Generasi 2.5: Cepat & Handal' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Generasi 2.5: Analisis Luas' },
];

export const DEFAULT_GROQ_MODELS: AIModelOption[] = [
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile', description: 'Rekomendasi Utama: Sangat mahir sastra & dialog' },
  { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', description: 'Respons instan secepat kilat' },
  { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B (32k)', description: 'Arsitektur MoE untuk deskripsi panjang' },
  { id: 'gemma2-9b-it', name: 'Gemma 2 9B IT', description: 'Model open weights Google presisi tinggi' },
];

const STORAGE_KEY = 'schemax_ai_config_v3';

export function getDefaultAISettings(): AISettingsConfig {
  return {
    smartAdjustEnabled: true,
    providerPriority: ['gemini', 'groq'],
    geminiConfig: {
      fallbackModels: ['', '', ''],
      cachedModels: DEFAULT_GEMINI_MODELS,
    },
    groqConfig: {
      fallbackModels: ['', '', ''],
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
    let raw = localStorage.getItem(STORAGE_KEY);
    // Auto-migrate from older version while preserving all user API keys
    if (!raw) {
      const v2 = localStorage.getItem('schemax_ai_config_v2') || localStorage.getItem('schemax_ai_config');
      if (v2) {
        try {
          const oldConfig = JSON.parse(v2);
          const migrated = getDefaultAISettings();
          if (Array.isArray(oldConfig.slots)) {
            // Restore saved keys
            migrated.slots = oldConfig.slots.map((s: any) => ({
              ...s,
              models: undefined,
            }));
          }
          saveAISettings(migrated);
          return migrated;
        } catch (_) {}
      }
      return getDefaultAISettings();
    }

    const parsed = JSON.parse(raw);
    if (!parsed.slots || !Array.isArray(parsed.slots)) return getDefaultAISettings();

    // Ensure geminiConfig & groqConfig exist
    if (!parsed.geminiConfig) {
      parsed.geminiConfig = {
        fallbackModels: ['', '', ''],
        cachedModels: DEFAULT_GEMINI_MODELS,
      };
    } else {
      if (!Array.isArray(parsed.geminiConfig.fallbackModels)) {
        parsed.geminiConfig.fallbackModels = ['', '', ''];
      }
      if (!parsed.geminiConfig.cachedModels || parsed.geminiConfig.cachedModels.length === 0) {
        parsed.geminiConfig.cachedModels = DEFAULT_GEMINI_MODELS;
      }
    }

    if (!parsed.groqConfig) {
      parsed.groqConfig = {
        fallbackModels: ['', '', ''],
        cachedModels: DEFAULT_GROQ_MODELS,
      };
    } else {
      if (!Array.isArray(parsed.groqConfig.fallbackModels)) {
        parsed.groqConfig.fallbackModels = ['', '', ''];
      }
      if (!parsed.groqConfig.cachedModels || parsed.groqConfig.cachedModels.length === 0) {
        parsed.groqConfig.cachedModels = DEFAULT_GROQ_MODELS;
      }
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

// Fetch Live Models Directly from Google Gemini API (Semua model yang tersedia di API tanpa batasan)
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

  // Ambil semua model tanpa memfilter atau membatasi versi
  const models: AIModelOption[] = rawList
    .map((m: any) => {
      const cleanId = m.name ? m.name.replace(/^models\//, '') : '';
      return {
        id: cleanId,
        name: m.displayName || cleanId,
        description: m.description ? m.description.slice(0, 100) : 'Model Google Gemini AI',
      };
    })
    .filter((m) => Boolean(m.id));

  if (models.length === 0) {
    throw new Error('Tidak ada model Gemini yang ditemukan dari API.');
  }

  return models;
}

// Fetch Live Models Directly from Groq API (Semua model yang tersedia di API tanpa batasan)
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

  // Ambil seluruh model Groq tanpa batasan
  const models: AIModelOption[] = rawList
    .map((m: any) => ({
      id: m.id,
      name: m.id,
      description: `Groq Model (${m.owned_by || 'Aktif'})`,
    }))
    .filter((m) => Boolean(m.id));

  if (models.length === 0) {
    throw new Error('Tidak ada model Groq yang ditemukan dari API.');
  }

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

// Permanent Non-Block Content Filter Settings for Google Gemini
// Allows full creative freedom in novel writing, mature romance, action/battles, and dark worldbuilding
export const GEMINI_NON_BLOCK_SAFETY_SETTINGS = [
  {
    category: 'HARM_CATEGORY_HARASSMENT',
    threshold: 'BLOCK_NONE',
  },
  {
    category: 'HARM_CATEGORY_HATE_SPEECH',
    threshold: 'BLOCK_NONE',
  },
  {
    category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
    threshold: 'BLOCK_NONE',
  },
  {
    category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
    threshold: 'BLOCK_NONE',
  },
];

// Call Google Gemini API with permanent Non-Block safety settings and literary fiction framing
async function executeGeminiRequest(
  apiKey: string,
  model: string,
  prompt: string,
  systemPrompt?: string
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;

  const sendRequest = async (userPromptText: string, sysPromptText?: string) => {
    const payload: any = {
      contents: [
        {
          role: 'user',
          parts: [{ text: userPromptText }],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192,
      },
      safetySettings: GEMINI_NON_BLOCK_SAFETY_SETTINGS,
    };

    if (sysPromptText) {
      payload.system_instruction = {
        parts: [
          {
            text: `${sysPromptText}\n\n[Domain]: Karya fiksi sastra novel imajinatif untuk keperluan penulisan kreatif Schemax. Analisis dan hasilkan narasi fiksi secara bebas dan mendalam.`,
          },
        ],
      };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = errorData.error?.message || `HTTP ${response.status} ${response.statusText}`;
      throw new Error(message);
    }

    return await response.json();
  };

  // 1. Initial attempt with structured system_instruction
  let data = await sendRequest(prompt, systemPrompt);
  let candidate = data.candidates?.[0];
  let text = candidate?.content?.parts?.[0]?.text;

  // 2. If blocked by PROHIBITED_CONTENT pre-screener, retry with explicit literary framing prefix
  if (!text && data.promptFeedback?.blockReason === 'PROHIBITED_CONTENT') {
    const literaryFramedPrompt = `[Karya Fiksi Sastra / Creative Writing Novel]:\nBerikut adalah naskah fiksi sastra imajinatif untuk keperluan penulisan kreatif:\n\n${prompt}`;
    try {
      data = await sendRequest(literaryFramedPrompt, systemPrompt);
      candidate = data.candidates?.[0];
      text = candidate?.content?.parts?.[0]?.text;
    } catch (_) {}
  }

  if (!text) {
    if (candidate?.finishReason === 'SAFETY') {
      throw new Error('Respon dibatasi oleh proteksi keselamatan tingkat dasar sistem.');
    }
    const blockReason = data.promptFeedback?.blockReason;
    if (blockReason) {
      throw new Error(`Permintaan ditolak oleh filter (${blockReason}).`);
    }
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

  // Budget prompt safely for Groq's token/minute limits
  const budgetedPrompt =
    prompt.length > 32000
      ? prompt.slice(0, 32000) + '\n\n[...konteks dipotong sesuai batas token Groq...]'
      : prompt;

  const messages: any[] = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: budgetedPrompt });

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
      max_tokens: 4096,
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
    // Determine fallback models: slot override, providerGlobal fallbackModels, cachedModels, or sensible default
    const providerGlobal = slot.provider === 'gemini' ? config.geminiConfig : config.groqConfig;
    let fallbackModels = (slot.models && slot.models.length > 0
      ? slot.models
      : providerGlobal.fallbackModels || []).filter(Boolean);

    // If no models were explicitly set or all were empty strings, fallback to cached models or known reliable defaults
    if (fallbackModels.length === 0) {
      if (providerGlobal.cachedModels && providerGlobal.cachedModels.length > 0) {
        fallbackModels = providerGlobal.cachedModels.map((m) => m.id);
      } else {
        fallbackModels = slot.provider === 'gemini'
          ? ['gemini-3.8-flash-preview', 'gemini-2.5-flash', 'gemini-1.5-flash']
          : ['llama-3.3-70b-versatile', 'llama3-8b-8192'];
      }
    }

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

        // Jika error adalah KUOTA HABIS (429 / RESOURCE_EXHAUSTED / quota exceeded),
        // seluruh model pada API Key slot ini pasti akan gagal juga.
        // Langsung BREAK loop model untuk slot ini dan lompat ke API Key slot berikutnya!
        const isQuotaExceeded =
          errorMessage.includes('429') ||
          errorMessage.toLowerCase().includes('resource_exhausted') ||
          errorMessage.toLowerCase().includes('quota') ||
          errorMessage.toLowerCase().includes('rate limit');

        if (isQuotaExceeded) {
          console.warn(`[Schemax AI Fallback] Kuota API habis pada ${slot.label}. Melompati sisa model dan beralih ke slot API berikutnya...`);
          break;
        }

        // Jika terkena PROHIBITED_CONTENT pada Gemini, seluruh model Gemini akan menolaknya karena prompt dicegat di Google Gateway.
        // Langsung lewati slot Gemini ini agar lekas beralih ke slot provider Groq yang bebas filter.
        if (slot.provider === 'gemini' && errorMessage.includes('PROHIBITED_CONTENT')) {
          console.warn('[Schemax AI Fallback] Gemini ditolak oleh filter PROHIBITED_CONTENT Google. Melewati slot Gemini untuk beralih ke provider Groq...');
          break;
        }
      }
    }
  }

  // If we reach here, ALL slots and ALL models failed
  const hasProhibited = attempts.some((att) => att.error?.includes('PROHIBITED_CONTENT'));
  if (hasProhibited) {
    const hasGroqConfigured = config.slots.some(
      (s) => s.provider === 'groq' && s.isActive && s.apiKey && s.apiKey.trim().length > 0
    );

    if (!hasGroqConfigured) {
      throw new Error(
        `Permintaan ditolak oleh filter Google Cloud (PROHIBITED_CONTENT).\n\n` +
        `Google menerapkan filter kata kunci internal pada server Gemini yang secara ketat memblokir frasa tertentu di tingkat server mereka.\n\n` +
        `💡 Solusi untuk Konten Eksplisit / Dewasa:\n` +
        `Gunakan provider Groq (Llama 3.3 70B). Buka Pengaturan AI (ikon ✨ di header) lalu masukkan API Key Groq gratis. Model Llama 3.3 di Groq tidak memiliki filter kata kunci Google dan sepenuhnya bebas untuk penulisan cerita dewasa.`
      );
    }
  }

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

// Resilient JSON Parsers for LLM Output (Handles Long 4000+ words outputs, trailing commas, fences, and truncation)
export function resilientParseJsonArray<T = any>(rawText: string): T[] {
  if (!rawText) return [];
  let clean = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

  // 1. Direct parse
  try {
    const parsed = JSON.parse(clean);
    if (Array.isArray(parsed)) return parsed;
    if (typeof parsed === 'object' && parsed !== null) {
      const arrayKey = Object.keys(parsed).find((k) => Array.isArray(parsed[k]));
      if (arrayKey && Array.isArray(parsed[arrayKey])) {
        return parsed[arrayKey];
      }
    }
  } catch (_) {}

  // 2. Extract array bounds
  const firstBracket = clean.indexOf('[');
  const lastBracket = clean.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    const candidate = clean.slice(firstBracket, lastBracket + 1);
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed)) return parsed;
    } catch (_) {
      const fixed = candidate.replace(/,\s*([\]}])/g, '$1');
      try {
        const parsed = JSON.parse(fixed);
        if (Array.isArray(parsed)) return parsed;
      } catch (_) {}
    }
  }

  // 3. Resilient regex extraction of individual objects
  const results: T[] = [];
  const objectRegex = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g;
  let match: RegExpExecArray | null;
  while ((match = objectRegex.exec(clean)) !== null) {
    try {
      const fixedObj = match[0].replace(/,\s*}/g, '}');
      const parsedObj = JSON.parse(fixedObj);
      if (typeof parsedObj === 'object' && parsedObj !== null) {
        results.push(parsedObj);
      }
    } catch (_) {}
  }

  return results;
}

export function resilientParseJsonObject<T = any>(rawText: string): Record<string, any> {
  if (!rawText) return {};
  let clean = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

  try {
    const parsed = JSON.parse(clean);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch (_) {}

  const firstBrace = clean.indexOf('{');
  const lastBrace = clean.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = clean.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(candidate);
    } catch (_) {
      const fixed = candidate.replace(/,\s*([\]}])/g, '$1');
      try {
        return JSON.parse(fixed);
      } catch (_) {}
    }
  }

  return {};
}

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
${contentText.slice(0, 60000)}

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
${contentText ? contentText.slice(0, 60000) : (premise || 'Gunakan premis bab')}

Berikan output HANYA berupa JSON valid persis dengan struktur ini tanpa teks pembuka atau penutup lain:
{
  "hook": "deskripsi hook...",
  "risingAction": "deskripsi eskalasi...",
  "climax": "deskripsi puncak ketegangan...",
  "resolution": "deskripsi penutup atau cliffhanger..."
}`;

  const systemPrompt = 'Anda adalah konsultan plot dan story analyst profesional. Hasilkan hanya JSON yang valid.';
  const res = await generateWithSmartFallback(prompt, systemPrompt);

  const parsed = resilientParseJsonObject(res.text);
  if (parsed.hook || parsed.risingAction || parsed.climax || parsed.resolution) {
    return {
      hook: parsed.hook || '',
      risingAction: parsed.risingAction || '',
      climax: parsed.climax || '',
      resolution: parsed.resolution || '',
    };
  }

  // Regex fallback parser
  return {
    hook: extractSection(res.text, 'Hook') || res.text.slice(0, 150),
    risingAction: extractSection(res.text, 'Rising Action') || extractSection(res.text, 'Eskalasi') || '',
    climax: extractSection(res.text, 'Climax') || extractSection(res.text, 'Puncak') || '',
    resolution: extractSection(res.text, 'Resolution') || extractSection(res.text, 'Penutup') || '',
  };
}

// Helper to extract section in fallback
function extractSection(text: string, title: string): string {
  const match = text.match(new RegExp(`${title}[:\\s*-]+([\\s\\S]*?)(?=(?:Hook|Rising|Climax|Resolution|Eskalasi|Puncak|Penutup|$))`, 'i'));
  return match ? match[1].trim() : '';
}

// 3. Chapter Auto-Scene Decomposition Engine with Smart Timeline
// 3. Chapter Auto-Scene Decomposition Engine with Smart Timeline, Glosarium Mapping, & Image Prompts
export async function generateChapterAutoScenes(
  chapterTitle: string,
  bookTitle: string,
  contentText: string,
  existingEntities?: Array<{ id: string; name: string; category: string }>,
  promptSettings?: ImagePromptSettings
): Promise<ChapterSceneItem[]> {
  const entityContext =
    existingEntities && existingEntities.length > 0
      ? `\nDaftar Entitas Glosarium yang Sudah Ada di Buku:\n` +
        existingEntities.map((e) => `- [${e.category.toUpperCase()}] ${e.name} (id: ${e.id})`).join('\n')
      : '';

  const aspectRatio = promptSettings?.aspectRatio || '9:16 (Layar HP)';
  const style =
    promptSettings?.style ||
    'Hyper realistic, natural scene, 8k resolution, cinematic lighting, photorealistic textures';
  const charNaming =
    promptSettings?.characterNaming ||
    'person1, person2 (sesuai foto/referensi karakter yang dilampirkan)';
  const extraKeywords =
    promptSettings?.additionalKeywords ||
    'candid scene photography, authentic emotions, high detail, volumetric lighting';
  const promptLang =
    promptSettings?.language === 'id' ? 'Bahasa Indonesia' : 'English (standard image prompt)';

  const prompt = `Bedah dan uraikan naskah bab berikut menjadi daftar adegan-adegan (scenes breakdown) berurutan beserta analisis kronologis alur (timeline), deteksi entitas glosarium di dalam tiap adegan, dan prompt pembuatan gambar AI untuk adegan tersebut.

Judul Buku: "${bookTitle}"
Judul Bab: "${chapterTitle}"${entityContext}

Isi Naskah Bab:
${contentText.slice(0, 60000)}

Instruksi Analisis Tiap Adegan:
1. Timeline: Tentukan tipe kronologi ("linear", "parallel" / "branched" jika simultan, atau "flashback"), timeMarker (penanda waktu), dan branchGroup.
2. Informasi Glosarium dalam Adegan (entitiesPresent):
   Sebutkan semua entitas (tokoh/karakter, latar tempat, benda/senjata pusaka, lore/faksi) yang hadir atau berperan penting di dalam adegan ini.
   Jika cocok dengan entitas di daftar glosarium yang sudah ada, cantumkan entityId-nya.
3. Prompt Gambar Adegan (imagePrompt):
   Buatkan prompt visual text-to-image (Midjourney/Flux/SD) untuk memvisualisasikan adegan ini dengan ATURAN KETAT:
   - Format: Rasio layar HP vertical (9:16), 4K hyper realistic, photorealistic cinematic lighting.
   - PENTING: User akan melampirkan gambar referensi karakter langsung berdampingan dengan prompt!
   - JANGAN deskripsikan wajah, tubuh, atau warna kulit karakter! Cukup gunakan reference dari referensi gambar.
   - JANGAN sebut nama karakter di dalam prompt. Gunakan label dalam kurung siku seperti "[pria1]" atau "[wanita1]". Jika ada lebih dari 1 entitas sejenis, beri nomor (contoh: "[pria1]", "[wanita1]", "[pria2]").
   - JANGAN ubah bentuk atau model pakaian asli karakter. HANYA boleh perubahan minor realistis sesuai konteks adegan (misal: "baju agak terbuka", "kusut", "robek sedikit di bahu", "terlepas dari satu bahu", "basah oleh keringat atau air hujan").
   - Jelaskan secara detail: POSE, EKSPRESI WAJAH/EMOSI, LATAR TEMPAT, PENCAHAYAAN, dan SUASANA dramatis adegan.
   - Berikan juga "characterReferences": Daftar nama karakter yang WAJIB dilampirkan gambarnya (contoh: ["Budi", "Ani"]).
   - Berikan juga "imagePromptExplanation": Penjelasan ringkas apa yang digambarkan oleh prompt ini dalam Bahasa Indonesia. Pada penjelasan ini, sebutkan nama karakter yang dimaksud beserta labelnya, misal: Udin [pria1], Tasya [wanita1].

Berikan output HANYA berupa JSON array valid persis dengan struktur ini:
[
  {
    "sceneNumber": 1,
    "title": "Judul Singkat Adegan",
    "setting": "Latar tempat & waktu adegan",
    "characters": ["Nama Karakter 1", "Nama Karakter 2"],
    "summary": "Rangkuman kejadian dalam adegan ini secara detail",
    "goalConflict": "Tujuan tokoh atau konflik yang terjadi di adegan",
    "timelineType": "linear",
    "timeMarker": "Pagi hari di Dermaga",
    "branchGroup": "Garis Waktu Utama",
    "entitiesPresent": [
      { "name": "Nama Karakter 1", "category": "character", "entityId": "" }
    ],
    "characterReferences": ["Nama Karakter 1"],
    "imagePrompt": "Vertical mobile phone screen 9:16, 4k hyper realistic, photorealistic cinematic, dramatic soft mist lighting. [pria1] standing at the edge of the foggy wooden pier at dawn, gaze filled with intense sorrow and determination, clenched fists at his sides. Original clothing slightly soaked and clinging from sea spray, wrinkled at the hem. Volumetric morning haze, cold blue hour ambience, cinematic depth of field --ar 9:16",
    "imagePromptExplanation": "Foto vertikal layar HP (9:16) menampilkan Udin [pria1] di ujung dermaga berkabut saat fajar. Ekspresinya penuh tekad bercampur duka dengan tangan mengepal. Pakaian aslinya agak basah oleh percikan air laut dan kusut di bagian bawah. Suasana dingin berkabut dengan pencahayaan sinematik 4K."
  }
]`;

  const systemPrompt =
    'Anda adalah script reader, visual concept artist, dan continuity editor novel. Berikan HANYA format JSON array valid.';
  const res = await generateWithSmartFallback(prompt, systemPrompt);

  const parsedScenes = resilientParseJsonArray(res.text);
  if (parsedScenes.length > 0) {
    return parsedScenes.map((item: any, idx: number) => ({
      id: 'scene_' + Math.random().toString(36).substring(2, 9),
      sceneNumber: item.sceneNumber || idx + 1,
      title: item.title || `Adegan ${idx + 1}`,
      setting: item.setting || '',
      characters: Array.isArray(item.characters) ? item.characters : [],
      summary: item.summary || '',
      goalConflict: item.goalConflict || '',
      timelineType: ['linear', 'parallel', 'flashback', 'branched'].includes(item.timelineType)
        ? item.timelineType
        : 'linear',
      timeMarker: item.timeMarker || '',
      branchGroup: item.branchGroup || 'Garis Waktu Utama',
      entitiesPresent: Array.isArray(item.entitiesPresent)
        ? item.entitiesPresent.map((e: any) => ({
            name: e.name || '',
            category: ['character', 'location', 'item', 'lore'].includes(e.category)
              ? e.category
              : 'character',
            entityId: e.entityId || undefined,
          }))
        : [],
      characterReferences: Array.isArray(item.characterReferences)
        ? item.characterReferences
        : Array.isArray(item.characters)
        ? item.characters
        : [],
      imagePrompt: item.imagePrompt || '',
      imagePromptExplanation: item.imagePromptExplanation || '',
    }));
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
      timelineType: 'linear',
      timeMarker: 'Awal Bab',
      branchGroup: 'Garis Waktu Utama',
      entitiesPresent: [],
      characterReferences: [],
      imagePrompt: '',
      imagePromptExplanation: '',
    },
  ];
}

// 3b. Dedicated Single Scene Image Prompt Generator / Regenerator
export async function generateSingleSceneImagePrompt(
  scene: {
    title: string;
    setting: string;
    characters: string[];
    summary: string;
    entitiesPresent?: SceneGlosariumItem[];
  },
  bookTitle: string,
  chapterTitle: string,
  _promptSettings?: ImagePromptSettings
): Promise<{ prompt: string; explanation: string; characterReferences: string[] }> {
  const charactersList = scene.characters.length > 0 ? scene.characters.join(', ') : 'Karakter utama';

  const prompt = `Anda adalah AI Prompt Engineer spesialis prompt gambar sinematik Text-to-Image (Midjourney, Flux, SD).

Buatkan prompt gambar untuk adegan berikut:
Judul Buku: "${bookTitle}"
Judul Bab: "${chapterTitle}"
Adegan: "${scene.title}"
Latar Tempat: ${scene.setting || 'Sesuai adegan'}
Tokoh Hadir: ${charactersList}
Ringkasan Kejadian: ${scene.summary}

ATURAN WAJIB & SANGAT KETAT:
1. User selalu melampirkan gambar referensi karakter di sebelah prompt.
2. JANGAN sebut atau deskripsikan bentuk wajah, warna kulit, atau postur tubuh karakter! Gunakan referensi visual yang dilampirkan.
3. JANGAN sebut nama karakter di dalam prompt. Ganti dengan label dalam kurung siku seperti "[pria1]" atau "[wanita1]". Jika ada lebih dari satu, beri nomor (contoh: "[pria1]", "[wanita1]", "[pria2]").
4. JANGAN ubah bentuk atau model pakaian asli karakter. HANYA boleh perubahan minor realistis sesuai konteks kejadian (misal: "baju agak terbuka", "kusut", "robek sedikit di bahu", "terlepas dari satu bahu", "basah oleh keringat / air").
5. Jelaskan secara sangat mendalam: POSE KARAKTER, EKSPRESI EMOSI, LATAR LINGKUNGAN, PENCAHAYAAN (lighting), dan ATMOSFER dramatis adegan.
6. Format teknis: "Vertical mobile phone screen (9:16), 4k hyper realistic, photorealistic cinematic, [deskripsi pose, ekspresi, interaksi, pakaian minor change, latar, lighting] --ar 9:16".
7. Berikan daftar "characterReferences": Nama-nama karakter asli yang gambarnya harus dilampirkan oleh user.
8. Berikan "explanation": Penjelasan isi prompt dalam Bahasa Indonesia yang santai, jelas, dan sebutkan nama karakter yang dimaksud beserta label bracketnya, misal: Udin [pria1], Tasya [wanita1].

Keluarkan HANYA JSON object valid:
{
  "characterReferences": ["${scene.characters[0] || 'Nama Karakter'}"],
  "prompt": "Vertical mobile phone screen 9:16, 4k hyper realistic, photorealistic cinematic, [pria1]...",
  "explanation": "Foto vertikal layar HP menampilkan Udin [pria1]..."
}`;

  const systemPrompt =
    'Anda adalah visual director dan concept artist profesional. Keluarkan HANYA JSON object valid.';
  const res = await generateWithSmartFallback(prompt, systemPrompt);
  const parsed = resilientParseJsonObject(res.text);

  return {
    prompt: parsed.prompt || res.text.replace(/^```json|```$/g, '').trim(),
    explanation: parsed.explanation || '',
    characterReferences: Array.isArray(parsed.characterReferences)
      ? parsed.characterReferences
      : scene.characters,
  };
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

// 5. Worldbuilding Entity & Alias Detection Engine
export async function detectEntitiesAndAliases(
  chapterText: string,
  bookTitle: string,
  existingEntities: Array<{
    id: string;
    name: string;
    category: string;
    aliases?: string[];
    initialTraits?: string;
    currentTraits?: string;
    physicalTraits?: string;
    condition?: string;
    evolutionSummary?: string;
  }>
): Promise<DetectedEntityCandidate[]> {
  const existingListStr =
    existingEntities.length > 0
      ? existingEntities
          .map(
            (e) =>
              `- [${e.category.toUpperCase()}] ${e.name} (ID: ${e.id})${
                e.aliases && e.aliases.length > 0 ? ` [Alias: ${e.aliases.join(', ')}]` : ''
              }${e.currentTraits || e.initialTraits ? ` | Sifat: ${e.currentTraits || e.initialTraits}` : ''}${
                e.physicalTraits ? ` | Fisik: ${e.physicalTraits}` : ''
              }${e.condition ? ` | Status: ${e.condition}` : ''}`
          )
          .join('\n')
      : '(Belum ada entitas di Glosarium buku ini)';

  const prompt = `Anda adalah asisten kontinuitas cerita (story continuity expert) dan pengelola lore worldbuilding tingkat tinggi.

Analisis naskah bab berikut terhadap daftar Glosarium yang sudah ada di buku ini:

Judul Buku: "${bookTitle}"

Daftar Entitas Glosarium yang Sudah Ada di Buku:
${existingListStr}

Isi Naskah Bab:
${chapterText.slice(0, 30000)}

Tugas Analisis Mendalam:
1. DETEKSI ENTITAS BARU (suggestedAction: "register_new"):
   - Cari karakter, lokasi, item/senjata/relik, atau istilah lore/faksi penting yang muncul di naskah bab ini TAPI BELUM ADA di daftar entitas buku di atas.
   
   A. SPESIFIKASI UNTUK KARAKTER (category: "character"):
      * initialDescription: Latar belakang asal-usul atau peran awalnya (misal: "Putri bangsawan di Kerajaan Asura").
      * initialTraits: Sifat & watak kepribadian dasar/awalnya (misal: "Penyayang, baik hati, santun, penurut").
      * currentDescription: Gambaran kondisi fisik/sosial/situasi saat ini di bab ini.
      * currentTraits: Sifat & watak kepribadian saat ini di bab ini (misal: "Kasar, manipulatif, penuh dendam").
      * physicalTraits: CIRI-CIRI FISIK LENGKAP & SPESIFIK (perawakan, wajah, rambut, kulit, busana/kostum, aksesoris, luka). Default Nusantara/lokal jika naskah lokal.
      * visualPrompt: Text-to-Image prompt Bahasa Inggris: "Full body portrait standing upright, centered, Indonesian/Southeast Asian ethnicity (sesuaikan naskah), [deskripsi fisik detail, pakaian, dan rambut], hyper realistic, 8k resolution, cinematic lighting, photorealistic textures, 9:16 aspect ratio".
      * evolutionSummary: Ringkasan titik balik atau penyebab perubahannya jika ada.
      * condition: Status kondisi saat ini ("aktif", "luka", "gugur", "hilang", "berkhianat", "terkutuk", "ditawan", "pelarian", "koma", atau "spesial").
      * conditionDetails: Detail singkat kondisi.
      * faction: Nama faksi/kelompok/klan jika berafiliasi.

   B. SPESIFIKASI UNTUK ITEM / PUSAKA / SENJATA (category: "item"):
      * shortDescription: Fungsi, kegunaan, atau efek mistis/teknologis benda ini.
      * initialTraits / initialDescription: Asal usul pembuatan benda, pemilik pertama, atau kondisi awal saat pertama kali ditemukan/ditempa (misal: "Pedang pusaka keramat yang memancarkan aura suci pelindung").
      * currentTraits / currentDescription: Kondisi daya magis, tingkat keausan, atau anomali benda saat ini di bab ini (misal: "Bilah pedang retak dan menghitam karena terkorosi racun kegelapan").
      * physicalTraits: Material bahan (logam, kayu bertuah, batu permata), ukiran rune, warna, ukuran, dan aura visual yang kasat mata.
      * visualPrompt: Text-to-Image prompt Bahasa Inggris: "Close-up macro product shot of [nama item], [deskripsi material, ukiran, ornamen, dan efek cahaya/aura], cinematic studio lighting, hyper realistic, photorealistic metallic/crystal textures, 8k resolution, centered, vertical 9:16 aspect ratio".
      * condition: Status benda ("aktif" utuh, "luka" retak/rusak, "hilang", "terkutuk", "spesial").

   C. SPESIFIKASI UNTUK LOKASI / TEMPAT (category: "location"):
      * shortDescription: Fungsi wilayah/bangunan dan posisinya di dunia cerita.
      * initialTraits / initialDescription: Kondisi historis tempat ini di masa lalu (misal: "Kuil megah pusat ibadah yang damai dan asri").
      * currentTraits / currentDescription: Atmosfer, kondisi lingkungan, dan situasi keamanan saat ini di bab ini (misal: "Runtuh terbakar, diselimuti kabut racun dan dijaga monster rawa").
      * physicalTraits: Arsitektur bangunan, bentang alam geologis, pencahayaan cuaca, warna dominan lingkungan, vegetasi.
      * visualPrompt: Text-to-Image prompt Bahasa Inggris: "Atmospheric wide establishing landscape shot of [nama lokasi], [deskripsi arsitektur, lingkungan, cuaca, dan pencahayaan dramatis], cinematic composition, unreal engine 5 render, hyper realistic, photorealistic, 8k resolution, vertical 9:16 aspect ratio".
      * condition: Status wilayah ("aktif" berpenghuni, "luka" hancur/rusak, "terkutuk", "hilang" terisolasi, "spesial").

   D. SPESIFIKASI UNTUK LORE / FAKSI / HUKUM DUNIA / KUTUKAN & PENYAKIT (category: "lore"):
      * Termasuk: Faksi/klan, aturan dunia, mitos, ordo, serta KUTUKAN, WABAH, RACUN GAIB, atau PENYAKIT MISTIS.
      * shortDescription: Penjelasan aturan dunia, mitos, ordo faksi, atau jenis kutukan/penyakit mistis.
      * initialTraits / initialDescription: Doktrin awal/sejarah pendirian faksi, atau asal-usul kutukan/wabah (pencipta, riwayat kemunculan, pantangan kuno).
      * currentTraits / currentDescription: Status faksi saat ini, atau bahaya/stadium penularan kutukan/penyakit di bab ini (gejala mematikan, durasi hidup, efek samping, penawar jika ada).
      * physicalTraits: 
        - Untuk Faksi/Lore: Lambang/panji faksi, seragam ciri khas, segel magis, simbol heraldry.
        - Untuk Kutukan/Penyakit: Manifestasi fisik (urat menghitam menyala, mata merah berkabut, kulit bersisik racun, aura asap miasma gelap).
      * visualPrompt: Text-to-Image prompt Bahasa Inggris:
        - Untuk Faksi/Lore: "Emblematic banner and heraldry of [nama lore/faksi], [deskripsi simbol, motif mitologi, lambang faksi], elegant dramatic lighting, high fantasy aesthetic, hyper realistic, 8k resolution, vertical 9:16 aspect ratio".
        - Untuk Kutukan/Penyakit: "Dark fantasy conceptual art depicting [nama kutukan/wabah], showing ominous glowing cursed veins, swirling purple and black miasma mist, eerie ethereal particles, hyperdetailed sinister atmosphere, cinematic lighting, 8k resolution, vertical 9:16 aspect ratio".
      * condition: "aktif" jika sedang aktif/mewabah, "terkutuk" jika merupakan sihir laknat/terlarang, "spesial".
      * faction: Nama faksi jika entitas ini adalah faksi/organisasi.

2. PEMBARUAN ENTITAS YANG SUDAH ADA (suggestedAction: "update_existing"):
   - Jika entitas SUDAH ADA di daftar Glosarium di atas, lalu di naskah bab ini mengalami perubahan sifat/kondisi (misal: karakter dirasuki/berubah sifat, pedang patah/diberkati, istana terbakar, faksi menyatakan perang).
   - Sertakan dengan:
     * suggestedAction: "update_existing"
     * isExisting: true
     * existingEntityId: ID entitas dari daftar di atas
     * name: Nama entitas asli
     * initialTraits: Pertahankan sifat/kondisi awal yang sudah tercatat
     * currentTraits: Sifat & kondisi terkini di bab ini
     * physicalTraits: Ciri fisik terkini (termasuk perubahan visual baru)
     * visualPrompt: Prompt gambar terbaru yang merefleksikan wujud terkini
     * currentDescription: Deskripsi kondisi terkini di bab ini
     * evolutionSummary: Penjelasan kronologis mengapa sifat/kondisi berubah di bab ini
     * condition: Status kondisi terkini ("aktif", "luka", "gugur", "hilang", "berkhianat", "terkutuk", "ditawan", "pelarian", "koma", "spesial")
     * conditionDetails: Rincian kondisi terkini

3. DETEKSI ALIAS / SEBUTAN LAIN (suggestedAction: "add_alias"):
   - Cari julukan, sebutan lain, gelar, atau istilah pengganti dari entitas yang SUDAH ADA. Contoh: Julukan "Sang Pusaka Pembelah Langit" merujuk ke Pedang Surya, deteksi sebagai ALIAS Pedang Surya!

Berikan output HANYA berupa JSON array valid persis dengan struktur ini:
[
  {
    "name": "Nama entitas atau sebutan alias yang ditemukan",
    "category": "character",
    "shortDescription": "Penjelasan ringkas siapa/apa ini di bab ini",
    "initialDescription": "Deskripsi atau latar belakang awal",
    "initialTraits": "Sifat & kepribadian awal (misal: penyayang, baik hati, penurut)",
    "currentDescription": "Deskripsi kondisi saat ini",
    "currentTraits": "Sifat & kepribadian saat ini (misal: kasar, manipulatif, pendendam)",
    "physicalTraits": "Ciri fisik detail atau material/arsitektur benda/tempat",
    "visualPrompt": "Prompt text-to-image AI Bahasa Inggris detail 9:16 aspect ratio...",
    "evolutionSummary": "Titik balik peristiwa penyebab perubahan",
    "condition": "aktif",
    "conditionDetails": "Keterangan detail status",
    "faction": "Nama faksi jika relevan",
    "isExisting": false,
    "existingEntityId": "",
    "detectedAliasOf": "",
    "suggestedAction": "register_new"
  }
]

Aturan:
- category HANYA boleh salah satu dari: "character", "location", "item", "lore"
- suggestedAction HANYA boleh: "register_new", "update_existing", atau "add_alias"
- condition HANYA boleh: "aktif", "luka", "gugur", "hilang", "berkhianat", "terkutuk", "ditawan", "pelarian", "koma", "spesial"
- Jika update_existing atau add_alias, sertakan existingEntityId dari daftar di atas.`;

  const systemPrompt =
    'Anda adalah editor kontinuitas sastra profesional dan konsistensi worldbuilding. Hasilkan HANYA JSON array valid.';
  const res = await generateWithSmartFallback(prompt, systemPrompt);

  try {
    const parsed = resilientParseJsonArray<any>(res.text);
    if (parsed.length > 0) {
      return parsed.map((item) => {
        const action: 'register_new' | 'update_existing' | 'add_alias' =
          item.suggestedAction === 'add_alias'
            ? 'add_alias'
            : item.suggestedAction === 'update_existing'
            ? 'update_existing'
            : 'register_new';

        const rawCat = String(item.category || '').toLowerCase().trim();
        let normalizedCat: 'character' | 'location' | 'item' | 'lore' = 'character';
        if (['location', 'tempat', 'lokasi', 'daerah', 'wilayah'].includes(rawCat)) {
          normalizedCat = 'location';
        } else if (['item', 'senjata', 'benda', 'barang', 'pusaka'].includes(rawCat)) {
          normalizedCat = 'item';
        } else if (['lore', 'faksi', 'istilah', 'mitos', 'sejarah', 'organisasi'].includes(rawCat)) {
          normalizedCat = 'lore';
        } else if (['character', 'karakter', 'tokoh', 'orang', 'sosok'].includes(rawCat)) {
          normalizedCat = 'character';
        }

        return {
          id: 'det_' + Math.random().toString(36).substring(2, 9),
          name: item.name || '',
          category: normalizedCat,
          shortDescription: item.shortDescription || '',
          initialDescription: item.initialDescription || undefined,
          initialTraits: item.initialTraits || undefined,
          currentDescription: item.currentDescription || undefined,
          currentTraits: item.currentTraits || undefined,
          physicalTraits: item.physicalTraits || undefined,
          visualPrompt: item.visualPrompt || undefined,
          evolutionSummary: item.evolutionSummary || undefined,
          condition: item.condition || undefined,
          conditionDetails: item.conditionDetails || undefined,
          faction: item.faction || undefined,
          isExisting: Boolean(item.isExisting) || action === 'update_existing' || action === 'add_alias',
          existingEntityId: item.existingEntityId || undefined,
          detectedAliasOf: item.detectedAliasOf || undefined,
          suggestedAction: action,
        };
      });
    }
  } catch (err) {
    console.warn('Gagal parse JSON deteksi entitas:', err);
  }

  return [];
}

export const detectWorldEntitiesInChapter = detectEntitiesAndAliases;

// 6. Next Chapter Branching Recommendations Engine
export interface ChapterBranchOption {
  id: string;
  title: string;
  premise: string;
  hook: string;
  intensity: 'Tinggi (Aksi/Konflik)' | 'Misteri (Plot Twist)' | 'Emosional (Drama)' | 'Eksplorasi (Lore)' | string;
  rationale: string;
  storyPlan?: string;
  involvedCharacters?: string[];
  characterConditions?: string;
  climax?: string;
  potentialTwist?: string;
  continuityNote?: string;
  isConsistentWithPrevious?: boolean;
}

export async function generateNextChapterBranches(
  chapterTitle: string,
  bookTitle: string,
  contentText: string,
  premise?: string,
  roughDraft?: string
): Promise<ChapterBranchOption[]> {
  const hasDraft = Boolean(roughDraft && roughDraft.trim());

  const prompt = `Anda adalah story architect dan continuity supervisor novel profesional.
Analisis peristiwa bab ini secara mendalam untuk merancang RENCANA BAB SELANJUTNYA (3 rekomendasi alur cerita berkelanjutan yang SANGAT MASUK AKAL, KOHEREN DENGAN PERISTIWA BAB SEBELUMNYA, dan penuh ketegangan dramatis):

Judul Buku: "${bookTitle}"
Bab Saat Ini (Bab Sebelumnya bagi Bab Baru): "${chapterTitle}"
Premis Bab Sebelumnya: ${premise || 'Belum ada premis tertulis'}

Naskah Bab Sebelumnya:
${contentText ? contentText.slice(0, 60000) : (premise || 'Bab ini sedang ditulis')}

${
  hasDraft
    ? `DRAFT KASAR / RENCANA DARI PENULIS UNTUK BAB SELANJUTNYA:
"""
${roughDraft}
"""

TUGAS KHUSUS DRAFT PENULIS:
1. Evaluasi apakah ide/draft kasar dari penulis di atas MELENCENG atau KOHEREN dari kejadian akhir bab sebelumnya!
2. Jika ada bagian yang melenceng atau melompat logika secara aneh, beri peringatan solutif agar tetap tersambung mulus.
3. Kembangkan 3 variasi eksekusi alur bab selanjutnya berdasarkan draft penulis tersebut yang diselaraskan secara akurat dengan bab sebelumnya.`
    : `TUGAS KHUSUS:
Rancang 3 arah kelanjutan cerita bab selanjutnya dengan logika sebab-akibat yang kuat berdasar akhir bab sebelumnya:
1. Opsi A (Intensitas & Aksi): Konfrontasi langsung, eskalasi darurat, atau konsekuensi aksi sebelumnya.
2. Opsi B (Plot Twist & Misteri): Terungkapnya motif rahasia, petunjuk mengejutkan, atau aliansi tak terduga.
3. Opsi C (Dilema Batin & Karakter): Pengorbanan emosional, pergeseran dinamika relasi, atau ujian moral.`
}

Setiap opsi rencana WAJIB memuat:
- title: Judul bab berikutnya yang kuat dan dramatis.
- premise: Rangkuman premis bab baru 2-3 kalimat yang memikat.
- hook: Kalimat atau adegan pembuka pertama bab baru yang langsung menyambung dari bab sebelumnya.
- storyPlan: Rencana alur cerita runut babak per babak (langkah kejadian dari awal, eskalasi, hingga akhir bab yang masuk akal berdasar bab sebelumnya).
- involvedCharacters: Daftar nama tokoh penting yang terlibat.
- characterConditions: Kondisi fisik, emosional, dan posisi para tokoh saat bab ini dimulai.
- climax: Titik puncak klimaks yang meledak di bab tersebut.
- potentialTwist: Konsekuensi atau kejutan tersembunyi.
- intensity: Kategori intensitas ("Tinggi (Aksi/Konflik)" / "Misteri (Plot Twist)" / "Emosional (Drama)").
- rationale: Alasan mengapa opsi ini logis dan memuaskan kelanjutan cerita setelah bab sebelumnya.
- continuityNote: Catatan kesinambungan (jika ada draft kasar penulis: sebutkan apakah draft sesuai atau ada catatan koreksi agar tidak melenceng dari bab sebelumnya).
- isConsistentWithPrevious: boolean (true jika konsisten dan menyambung erat dengan bab sebelumnya).

Berikan output HANYA berupa JSON array valid persis dengan struktur ini:
[
  {
    "title": "Judul Bab Berikutnya",
    "premise": "Rangkuman premis bab baru...",
    "hook": "Adegan atau kalimat pembuka pertama bab baru...",
    "storyPlan": "Langkah 1: ..., Langkah 2: ..., Langkah 3: ...",
    "involvedCharacters": ["Nama Tokoh 1", "Nama Tokoh 2"],
    "characterConditions": "Kondisi fisik dan emosi tokoh yang terlibat...",
    "climax": "Momen klimaks di mana puncak konflik meledak...",
    "potentialTwist": "Kejutan tak terduga yang terjadi...",
    "intensity": "Tinggi (Aksi/Konflik)",
    "rationale": "Mengapa opsi ini sangat masuk akal...",
    "continuityNote": "Catatan konsistensi dengan bab sebelumnya...",
    "isConsistentWithPrevious": true
  }
]`;

  const systemPrompt = 'Anda adalah konsultan plot dan story architect novel profesional. Hasilkan hanya JSON array valid.';
  const res = await generateWithSmartFallback(prompt, systemPrompt);

  try {
    const parsed = resilientParseJsonArray<any>(res.text);
    if (parsed.length > 0) {
      return parsed.map((item, idx) => ({
        id: 'branch_' + (idx + 1) + '_' + Date.now().toString(36),
        title: item.title || `Bab Selanjutnya: Opsi ${idx + 1}`,
        premise: item.premise || '',
        hook: item.hook || '',
        intensity: item.intensity || 'Tinggi (Aksi/Konflik)',
        rationale: item.rationale || '',
        storyPlan: item.storyPlan || '',
        involvedCharacters: Array.isArray(item.involvedCharacters)
          ? item.involvedCharacters
          : typeof item.involvedCharacters === 'string'
          ? item.involvedCharacters.split(',').map((s: string) => s.trim())
          : [],
        characterConditions: item.characterConditions || '',
        climax: item.climax || '',
        potentialTwist: item.potentialTwist || '',
        continuityNote: item.continuityNote || '',
        isConsistentWithPrevious: typeof item.isConsistentWithPrevious === 'boolean' ? item.isConsistentWithPrevious : true,
      }));
    }
  } catch (err) {
    console.warn('Gagal parse JSON cabang bab:', err);
  }

  // Graceful fallback if JSON parse fails
  return [
    {
      id: 'branch_fallback_1',
      title: 'Konsekuensi yang Tak Terelakkan',
      premise: 'Dampak dari keputusan di bab sebelumnya mulai terasa nyata ketika ancaman baru tiba tanpa peringatan.',
      hook: 'Langkah kaki tergesa di lorong memecah keheningan dini hari sebelum kabar buruk itu tiba.',
      intensity: 'Tinggi (Aksi/Konflik)',
      rationale: 'Menjaga tempo ketegangan agar pembaca tidak kehilangan antusiasme berdasar aksi di bab sebelumnya.',
      storyPlan: '1. Tokoh menyadari jejak musuh mendekat. 2. Upaya evakuasi barang penting di tengah kepanikan. 3. Konfrontasi tak terelakkan di gerbang perbatasan.',
      involvedCharacters: ['Tokoh Utama', 'Rekan Seperjalanan'],
      characterConditions: 'Tokoh utama kelelahan fisik namun adrenalin memuncak; rekan mengalami cedera ringan.',
      climax: 'Pertarungan sengit di jembatan sebelum jembatan diledakkan untuk memutus pengejaran.',
      potentialTwist: 'Salah satu pengejar ternyata mengenali tanda pusaka di tangan tokoh utama.',
    },
    {
      id: 'branch_fallback_2',
      title: 'Rahasia di Balik Tabir',
      premise: 'Petunjuk tersembunyi yang tertinggal membongkar kebohongan salah satu pihak terdekat.',
      hook: 'Sebuah dokumen usang dengan cap segel merah tergeletak di tempat yang tak semestinya.',
      intensity: 'Misteri (Plot Twist)',
      rationale: 'Memicu rasa ingin tahu pembaca dengan teka-teki baru yang logis dari peristiwa kemarin.',
      storyPlan: '1. Penyelidikan diam-diam terhadap barang peninggalan. 2. Menemukan kode terenkripsi yang merujuk pada pembelotan. 3. Konfrontasi verbal yang menegangkan tanpa senjata.',
      involvedCharacters: ['Tokoh Utama', 'Sosok Mentor / Sekutu'],
      characterConditions: 'Keduanya tampak tenang di luar, namun ketegangan psikologis membuncah.',
      climax: 'Terkuaknya surat perjanjian rahasia yang melibatkan nama keluarga besar tokoh utama.',
      potentialTwist: 'Mentor tidak berniat jahat, melainkan melindungi tokoh utama dari konspirasi yang lebih besar.',
    },
    {
      id: 'branch_fallback_3',
      title: 'Di Persimpangan Jalan',
      premise: 'Dilema moral memaksa tokoh utama merenungi kembali tujuan awalnya sebelum terlambat.',
      hook: 'Bayangan masa lalu kembali menghantui saat tatapan mata itu menuntut kepastian.',
      intensity: 'Emosional (Drama)',
      rationale: 'Memberi ruang bernapas untuk memperdalam kedalaman emosional karakter.',
      storyPlan: '1. Percakapan intim di dekat api unggun mengenang masa lalu. 2. Perdebatan mengenai harga yang harus dibayar demi kemenangan. 3. Keputusan tegas yang merubah arah perjalanan.',
      involvedCharacters: ['Tokoh Utama', 'Tokoh Pendamping'],
      characterConditions: 'Kelelahan batin, keraguan terhadap takdir, namun ikatan emosional semakin erat.',
      climax: 'Pengakuan rahasia yang selama ini disembunyikan demi melindungi perasaan satu sama lain.',
      potentialTwist: 'Keputusan yang diambil tanpa sengaja memicu ramalan kuno yang telah tertidur berabad-abad.',
    },
  ];
}

// 7. Premise Generator & Refiner Engine
export async function generateRefinedPremise(
  chapterTitle: string,
  bookTitle: string,
  contentText: string,
  currentPremise?: string
): Promise<string> {
  const prompt = `Buat atau perbaiki premis singkat (2-3 kalimat kuat dan memikat) untuk bab cerita berikut:
Judul Buku: "${bookTitle}"
Judul Bab: "${chapterTitle}"
Premis Saat Ini: ${currentPremise || 'Belum ada'}

Isi Naskah Bab:
${contentText ? contentText.slice(0, 5000) : (currentPremise || 'Gunakan judul bab')}

Instruksi:
- Tulis langsung teks premisnya dalam Bahasa Indonesia yang dramatis dan menarik.
- Hindari kata pengantar seperti "Berikut adalah premisnya:".`;

  const systemPrompt = 'Anda adalah editor sinopsis profesional. Tulis langsung premis yang ringkas dan memikat.';
  const res = await generateWithSmartFallback(prompt, systemPrompt);
  return res.text.trim();
}

// 8. AI Vision Multimodal Analysis Engine
async function executeGeminiVisionRequest(
  apiKey: string,
  model: string,
  base64Data: string,
  mimeType: string,
  prompt: string,
  systemPrompt?: string
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;

  const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '');

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
          parts: [
            {
              inlineData: {
                mimeType: mimeType || 'image/jpeg',
                data: cleanBase64,
              },
            },
            {
              text: combinedPrompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 2048,
      },
      safetySettings: GEMINI_NON_BLOCK_SAFETY_SETTINGS,
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
    throw new Error('Respon Gemini Vision kosong.');
  }

  return text.trim();
}

export interface ImageVisionAnalysis {
  shortDescription: string;
  detectedTags: string[];
  narrativeSentenceBefore: string;
  narrativeSentenceAfter: string;
  recommendedCategory: 'character' | 'location' | 'item' | 'lore' | 'scene' | 'general';
}

export async function analyzeImageWithVision(
  base64Image: string,
  mimeType: string,
  context: {
    bookTitle: string;
    chapterTitle?: string;
    existingEntities?: Array<{ id: string; name: string; category: string }>;
  }
): Promise<ImageVisionAnalysis> {
  const config = getAISettings();
  const geminiSlot = config.slots.find((s) => s.provider === 'gemini' && s.apiKey && s.apiKey.trim().length > 0);

  if (!geminiSlot) {
    throw new Error('AI Vision memerlukan API Key Gemini. Buka Pengaturan AI dan tambahkan slot API Key Gemini.');
  }

  const visionModels = [
    ...(geminiSlot.models && geminiSlot.models.length > 0 ? geminiSlot.models : config.geminiConfig.fallbackModels),
    'gemini-3.1-flash',
    'gemini-3.0-flash',
    'gemini-2.5-flash',
  ].filter((v, i, a) => a.indexOf(v) === i);

  const existingEntitiesList = context.existingEntities && context.existingEntities.length > 0
    ? context.existingEntities.map((e) => `- [${e.category.toUpperCase()}] ${e.name}`).join('\n')
    : '(Belum ada entitas di glosarium)';

  const prompt = `Analisis gambar ini secara mendalam untuk novel/buku berjudul "${context.bookTitle}" (Bab: "${context.chapterTitle || 'Bab Terkait'}").

Daftar Entitas Glosarium Buku yang ada:
${existingEntitiesList}

Tugas Anda:
1. "shortDescription": Deskripsi singkat visual gambar (1-2 kalimat deskriptif untuk alt/caption gambar).
2. "detectedTags": Deteksi apakah gambar ini menampilkan entitas yang cocok dengan Glosarium di atas ATAU usulkan tag nama tokoh, nama senjata, lokasi, atau item baru yang terlihat di gambar.
3. "narrativeSentenceBefore": Buat 1-2 kalimat sastra fiksi yang indah dan mengalir untuk diletakkan di naskah TEPAT SEBELUM gambar (membangun atmosfer dan mengarahkan perhatian pembaca ke visual).
4. "narrativeSentenceAfter": Buat 1-2 kalimat sastra fiksi yang indah dan berdaya pikat untuk diletakkan di naskah TEPAT SESUDAH gambar (menyambung aksi tokoh atau emosi adegan).
5. "recommendedCategory": Pilih salah satu: "character", "location", "item", "lore", "scene", atau "general".

Berikan output HANYA berupa JSON valid persis format ini:
{
  "shortDescription": "...",
  "detectedTags": ["..."],
  "narrativeSentenceBefore": "...",
  "narrativeSentenceAfter": "...",
  "recommendedCategory": "character"
}`;

  const systemPrompt = 'Anda adalah novelis masterclass dan AI Vision literary expert. Hasilkan HANYA JSON object murni tanpa markdown wrapper berlebih.';

  let lastError: any = null;
  for (const model of visionModels) {
    try {
      const rawText = await executeGeminiVisionRequest(
        geminiSlot.apiKey,
        model,
        base64Image,
        mimeType,
        prompt,
        systemPrompt
      );

      const parsed = resilientParseJsonObject<ImageVisionAnalysis>(rawText);
      if (parsed) {
        return {
          shortDescription: parsed.shortDescription || 'Ilustrasi adegan cerita.',
          detectedTags: Array.isArray(parsed.detectedTags) ? parsed.detectedTags : [],
          narrativeSentenceBefore: parsed.narrativeSentenceBefore || '',
          narrativeSentenceAfter: parsed.narrativeSentenceAfter || '',
          recommendedCategory: ['character', 'location', 'item', 'lore', 'scene', 'general'].includes(parsed.recommendedCategory)
            ? parsed.recommendedCategory
            : 'scene',
        };
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`Vision attempt with model ${model} failed:`, err);
    }
  }

  throw new Error(lastError?.message || 'Gagal menganalisis gambar dengan AI Vision.');
}

// 12. World Building Auto-Mapping Engine (Factions, Network Relationships & Current Conditions)
export interface AutoMapResult {
  factions: Array<{
    name: string;
    description: string;
    color: string;
  }>;
  mappedEntities: Array<{
    id: string;
    name: string;
    faction: string;
    factionColor?: string;
    condition: EntityCondition;
    conditionDetails: string;
    relationships: EntityRelationship[];
  }>;
}

export async function autoMapWorldEntities(
  bookTitle: string,
  entities: WorldEntity[],
  storyContext?: string
): Promise<AutoMapResult> {
  if (!entities || entities.length === 0) {
    return { factions: [], mappedEntities: [] };
  }

  const entitySummaries = entities.map((e) => {
    return {
      id: e.id,
      name: e.name,
      category: e.category,
      shortDesc: e.shortDescription,
      notes: e.detailedNotes ? e.detailedNotes.slice(0, 300) : '',
      tags: e.tags,
      currentFaction: e.faction || '',
      currentCondition: e.condition || 'aktif',
    };
  });

  const prompt = `Anda adalah Master Worldbuilding Architect & Strategic Narrative Analyst.
Analisis seluruh entitas (karakter, faksi, item, dan lokasi) dalam karya fiksi berjudul "${bookTitle}".

Daftar Entitas yang terdaftar:
${JSON.stringify(entitySummaries, null, 2)}

${storyContext ? `Konteks Tambahan / Sinopsis Naskah:\n${storyContext.slice(0, 4000)}\n` : ''}

Tugas Utama Anda:
1. "factions": Kelompokkan entitas ke dalam FAKSI / KELOMPOK / HIMPUNAN yang bermakna (misal: "Kekaisaran Timur", "Pemberontak Lembah", "Kultus Bayangan", "Pengelana Bebas / Netral", "Ordo Penyihir", dll.).
   - name: Nama faksi
   - description: 1 kalimat peran faksi dalam cerita
   - color: Kode warna HEX estetis yang cocok (misal: "#06b6d4" cyan, "#ec4899" pink, "#eab308" gold, "#a855f7" purple, "#ef4444" red, "#10b981" emerald)

2. "mappedEntities": Untuk SETIAP entitas dalam daftar di atas:
   - id: ID entitas persis seperti daftar
   - name: Nama entitas
   - faction: Nama faksi dari daftar factions di atas
   - factionColor: Kode warna hex faksi
   - condition: Tentukan kondisi terkini dari entitas. Pilih salah satu persis: "aktif" | "luka" | "gugur" | "hilang" | "berkhianat" | "terkutuk" | "ditawan" | "pelarian" | "koma" | "spesial"
   - conditionDetails: Keterangan kondisi 1 kalimat singkat (misal: "Kondisi prima memimpin garis depan", "Kehilangan mata kiri di pertempuran", "Menyusup di pihak musuh sebagai agen ganda", "Tewas secara misterius", dll.)
   - relationships: Jaringan relasi dengan entitas lain dalam daftar:
     * targetEntityId: ID entitas tujuan (HARUS ADA di daftar entitas)
     * relationshipType: salah satu dari "sekutu" | "musuh" | "keluarga" | "bawahan" | "atasan" | "kekasih" | "guru_murid" | "rival" | "khianat" | "netral" | "lainnya"
     * label: Label ringkas (misal: "Kakak Kandung", "Musuh Bebuyutan", "Pengawal Setia", "Mantan Murid", "Target Dendam")
     * description: 1 kalimat penjelasan dinamika hubungan mereka

Berikan output HANYA berupa JSON valid persis dengan struktur ini:
{
  "factions": [
    { "name": "...", "description": "...", "color": "#..." }
  ],
  "mappedEntities": [
    {
      "id": "...",
      "name": "...",
      "faction": "...",
      "factionColor": "#...",
      "condition": "aktif",
      "conditionDetails": "...",
      "relationships": [
        {
          "targetEntityId": "...",
          "relationshipType": "sekutu",
          "label": "...",
          "description": "..."
        }
      ]
    }
  ]
}`;

  const systemPrompt = 'Anda adalah Narrative Engine & Lore Architect. Hasilkan analisis relasi dan faksi yang presisi dalam format JSON murni.';
  const res = await generateWithSmartFallback(prompt, systemPrompt);
  const parsed = resilientParseJsonObject<AutoMapResult>(res.text);

  const factions = Array.isArray(parsed.factions) ? parsed.factions : [];
  const rawMappedEntities = Array.isArray(parsed.mappedEntities) ? parsed.mappedEntities : [];

  const entityMap = new Map(entities.map((e) => [e.id, e]));
  const entityByName = new Map(entities.map((e) => [e.name.toLowerCase().trim(), e]));
  entities.forEach((e) => {
    if (e.aliases) {
      e.aliases.forEach((a) => entityByName.set(a.toLowerCase().trim(), e));
    }
  });

  const sanitizedMappedEntities = rawMappedEntities.map((item) => {
    const matchedSelf = entityMap.get(item.id) || entityByName.get(item.name.toLowerCase().trim());
    const realId = matchedSelf ? matchedSelf.id : item.id;
    const realName = matchedSelf ? matchedSelf.name : item.name;

    const sanitizedRelationships = (item.relationships || []).map((rel) => {
      const targetMatch =
        entityMap.get(rel.targetEntityId) ||
        entityByName.get((rel.targetEntityId || '').toLowerCase().trim()) ||
        entityByName.get((rel.targetEntityName || '').toLowerCase().trim());

      return {
        ...rel,
        targetEntityId: targetMatch ? targetMatch.id : rel.targetEntityId,
        targetEntityName: targetMatch ? targetMatch.name : (rel.targetEntityName || rel.targetEntityId),
      };
    });

    return {
      ...item,
      id: realId,
      name: realName,
      relationships: sanitizedRelationships,
    };
  });

  return {
    factions,
    mappedEntities: sanitizedMappedEntities,
  };
}

// 8. Smart Character Visual Prompt Generator (Text-to-Image English 9:16)
export async function generateSmartCharacterVisualPrompt(character: {
  name: string;
  role?: string;
  age?: string;
  physicalTraits?: string;
  traits?: string;
  shortDescription?: string;
  genderOrTag?: string;
}): Promise<string> {
  const prompt = `You are a world-class concept artist and AI text-to-image prompt engineer (Midjourney v6, Flux, Stable Diffusion).
Create a highly objective, photorealistic character concept art prompt in ENGLISH for the following novel character:

Character Name: "${character.name}"
Role / Identity: "${character.role || character.shortDescription || 'Main Character'}"
Estimated Age: "${character.age || 'Adult'}"
Physical Traits: "${character.physicalTraits || 'Indonesian / Southeast Asian appearance, natural skin tone, authentic build'}"
Personality & Demeanor: "${character.traits || 'Natural, expressive'}"

STRICT OBJECTIVE PROMPT REQUIREMENTS:
1. Format: Vertical mobile phone aspect ratio (9:16), full body standing upright, centered composition.
2. Subject Description: State exact ethnicity (default to Indonesian / Southeast Asian unless story states otherwise), age, skin tone (tan, light brown, olive), facial features, hairstyle, and body posture standing straight.
3. Authentic Clothing & Attire: Describe the specific everyday or cultural clothing faithfully according to the character's role and story setting.
4. Emotional Expression: The facial expression and posture MUST objectively reflect the character's internal personality traits (e.g. cautious, warm, exhausted, resolute).
5. Photography & Quality keywords: 8k resolution, photorealistic skin textures, neutral cinematic lighting, shallow depth of field, hyper realistic, vertical mobile phone aspect ratio 9:16, --ar 9:16.
6. OUTPUT RULE: Output ONLY the English prompt string. Do NOT add preamble, quotes, or markdown codeblocks.`;

  const systemPrompt =
    'You are an expert AI prompt engineer. Output strictly the single final English text-to-image prompt without markdown or quotes.';
  const res = await generateWithSmartFallback(prompt, systemPrompt);
  return res.text.replace(/^["'`]|["'`]$/g, '').trim();
}
