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
import { wrapPromptSandbox } from '../utils/securityUtils';

// Modern baseline defaults (Modern Gemini 3.5+ models & Groq lineup)
export const DEFAULT_GEMINI_MODELS: AIModelOption[] = [
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash (Rekomendasi Utama & Cepat)', description: 'Generasi 3.5: Kecepatan tinggi, penalaran cerdas, kuota optimal untuk penulisan' },
  { id: 'gemini-3.8-flash-preview', name: 'Gemini 3.8 Flash Preview (Paling Cerdas)', description: 'Generasi 3.8: Kemampuan pemahaman narasi dan plot sangat tinggi' },
  { id: 'gemini-3.5-pro', name: 'Gemini 3.5 Pro (Penalaran Mendalam)', description: 'Generasi 3.5: Analisis sastra, karakter, dan alur cerita kompleks' },
  { id: 'gemini-3.8-pro-preview', name: 'Gemini 3.8 Pro Preview', description: 'Generasi 3.8: Penalaran tingkat lanjut untuk worldbuilding luas' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Generasi 2.5: Cepat & Handal' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Generasi 2.5: Kapasitas konteks tinggi' },
];

export const DEFAULT_GROQ_MODELS: AIModelOption[] = [
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile', description: 'Rekomendasi Utama: Sangat mahir sastra & dialog' },
  { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', description: 'Respons instan secepat kilat' },
  { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B (32k)', description: 'Arsitektur MoE untuk deskripsi panjang' },
  { id: 'gemma2-9b-it', name: 'Gemma 2 9B IT', description: 'Model open weights Google presisi tinggi' },
];

export const DEFAULT_OPENROUTER_MODELS: AIModelOption[] = [
  { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B Instruct (Free)', description: 'Gratis & 128k Konteks: Sangat cerdas dan luwes untuk novel naratif' },
  { id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B Instruct (Free)', description: 'Gratis & Cepat: 32k Konteks untuk deskripsi dan dialog' },
  { id: 'cognitivecomputations/dolphin-mixtral-8x7b', name: 'Dolphin Mixtral 8x7B (Uncensored)', description: 'Bebas Sensor / Refusal-Free: Khusus fiksi dewasa, dark romance & gore' },
  { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B Instruct', description: 'Model sangat kuat untuk alur logika dan detail adegan mendalam' },
  { id: 'openrouter/auto', name: 'OpenRouter Auto Router', description: 'Otomatis memilih model terbaik yang tersedia dan aktif' },
];

const STORAGE_KEY = 'schemax_ai_config_v3';

export const DEFAULT_GEMINI_FALLBACKS: [string, string, string] = [
  'gemini-3.5-flash',
  'gemini-3.8-flash-preview',
  'gemini-2.5-flash',
];

export const DEFAULT_GROQ_FALLBACKS: [string, string, string] = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'mixtral-8x7b-32768',
];

export const DEFAULT_OPENROUTER_FALLBACKS: [string, string, string] = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'mistralai/mistral-7b-instruct:free',
  'openrouter/auto',
];

export function getDefaultAISettings(): AISettingsConfig {
  return {
    smartAdjustEnabled: true,
    providerPriority: ['gemini', 'groq', 'openrouter'],
    geminiConfig: {
      fallbackModels: [...DEFAULT_GEMINI_FALLBACKS],
      cachedModels: DEFAULT_GEMINI_MODELS,
    },
    groqConfig: {
      fallbackModels: [...DEFAULT_GROQ_FALLBACKS],
      cachedModels: DEFAULT_GROQ_MODELS,
    },
    openrouterConfig: {
      fallbackModels: [...DEFAULT_OPENROUTER_FALLBACKS],
      cachedModels: DEFAULT_OPENROUTER_MODELS,
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
      {
        id: 'slot_openrouter_1',
        provider: 'openrouter',
        label: 'OpenRouter Slot 1',
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

    // Ensure providerPriority includes openrouter
    if (!Array.isArray(parsed.providerPriority)) {
      parsed.providerPriority = ['gemini', 'groq', 'openrouter'];
    } else if (!parsed.providerPriority.includes('openrouter')) {
      parsed.providerPriority.push('openrouter');
    }

    // Helper to preserve user's chosen models 100% without resetting or altering strings
    const sanitizeProviderConfig = (
      existing: any,
      defaults: [string, string, string],
      defaultCached: AIModelOption[]
    ): { fallbackModels: [string, string, string]; cachedModels: AIModelOption[]; lastFetchedAt?: number } => {
      // 1. Preserve user-fetched live API models, or use defaults if never fetched
      const cached = (existing?.cachedModels && Array.isArray(existing.cachedModels) && existing.cachedModels.length > 0)
        ? existing.cachedModels
        : defaultCached;

      // 2. Preserve user-selected fallback models exactly as chosen
      let fb = Array.isArray(existing?.fallbackModels) ? [...existing.fallbackModels] : [];

      // Guarantee model 0 has a valid value, while model 1 and 2 can be empty string (disabled) or user's choice
      const m0 = (typeof fb[0] === 'string' && fb[0].trim().length > 0) ? fb[0].trim() : defaults[0];
      const m1 = (typeof fb[1] === 'string') ? fb[1].trim() : defaults[1];
      const m2 = (typeof fb[2] === 'string') ? fb[2].trim() : defaults[2];

      return {
        fallbackModels: [m0, m1, m2],
        cachedModels: cached,
        lastFetchedAt: existing?.lastFetchedAt,
      };
    };

    parsed.geminiConfig = sanitizeProviderConfig(parsed.geminiConfig, DEFAULT_GEMINI_FALLBACKS, DEFAULT_GEMINI_MODELS);
    parsed.groqConfig = sanitizeProviderConfig(parsed.groqConfig, DEFAULT_GROQ_FALLBACKS, DEFAULT_GROQ_MODELS);
    parsed.openrouterConfig = sanitizeProviderConfig(parsed.openrouterConfig, DEFAULT_OPENROUTER_FALLBACKS, DEFAULT_OPENROUTER_MODELS);

    if (Array.isArray(parsed.slots)) {
      parsed.slots = parsed.slots.map((s: any) => {
        // Clear deprecated slot-level models so user's configured provider fallback models always take effect
        if (s.models) {
          delete s.models;
        }
        return s;
      });
    }

    return parsed;
  } catch (e) {
    console.error('Gagal membaca konfigurasi AI:', e);
    return getDefaultAISettings();
  }
}

export const getAISettings = loadAISettings;

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

// Fetch Live Models Directly from OpenRouter API (Menyaring model gratis dan uncensored untuk kemudahan pengguna)
export async function fetchLiveOpenRouterModels(apiKey: string): Promise<AIModelOption[]> {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Masukkan API Key OpenRouter untuk mengambil daftar model.');
  }

  const url = 'https://openrouter.ai/api/v1/models';
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey.trim()}`,
      'HTTP-Referer': 'https://schemax.app',
      'X-Title': 'Schemax Story Studio',
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${response.status} Gagal memuat model OpenRouter.`);
  }

  const data = await response.json();
  const rawList: any[] = data.data || [];

  // Urutkan model gratis (:free) atau model sastra/uncensored ke baris atas
  const models: AIModelOption[] = rawList
    .map((m: any) => {
      const isFree = m.id?.includes(':free');
      const ctx = m.context_length ? `[${Math.round(m.context_length / 1024)}k]` : '';
      return {
        id: m.id,
        name: `${m.name || m.id} ${ctx} ${isFree ? '🎁 Free' : ''}`.trim(),
        description: m.description ? m.description.slice(0, 110) : `Model OpenRouter (${ctx})`,
        isFree,
      };
    })
    .sort((a, b) => {
      if (a.isFree && !b.isFree) return -1;
      if (!a.isFree && b.isFree) return 1;
      return a.id.localeCompare(b.id);
    })
    .map(({ id, name, description }) => ({ id, name, description }))
    .filter((m) => Boolean(m.id));

  if (models.length === 0) {
    throw new Error('Tidak ada model OpenRouter yang ditemukan dari API.');
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
  {
    category: 'HARM_CATEGORY_CIVIC_INTEGRITY',
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

  // 2. If blocked by PROHIBITED_CONTENT pre-screener or finishReason SAFETY, retry with creative literary framing without complex system instruction
  if (!text && (data.promptFeedback?.blockReason === 'PROHIBITED_CONTENT' || candidate?.finishReason === 'SAFETY')) {
    const literaryFramedPrompt = `[Karya Fiksi Sastra / Creative Writing Novel]:\nBerikut adalah naskah fiksi sastra imajinatif untuk keperluan penulisan kreatif Schemax:\n\n${prompt}`;
    try {
      // Retry without system_instruction which often triggers Google's heuristic classifier
      data = await sendRequest(literaryFramedPrompt, undefined);
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

  // Instruksi wajib Bahasa Indonesia untuk semua pemrosesan AI Groq
  const INDONESIAN_MANDATORY_INSTRUCTION =
    'PENTING & WAJIB: Seluruh respon, narasi, analisis, dialog, penjelasan, dan nilai field JSON WAJIB ditulis dalam BAHASA INDONESIA yang baku, luwes, dan bermutu sastra (kecuali untuk nama variabel/kunci JSON atau prompt gambar berbahasa Inggris).';

  let effectiveSystemPrompt = systemPrompt
    ? `${systemPrompt}\n\n${INDONESIAN_MANDATORY_INSTRUCTION}`
    : INDONESIAN_MANDATORY_INSTRUCTION;

  const messages: any[] = [];
  messages.push({ role: 'system', content: effectiveSystemPrompt });
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

// Call OpenRouter API (Mendukung ratusan model, tier :free, dan model uncensored/refusal-free)
async function executeOpenRouterRequest(
  apiKey: string,
  model: string,
  prompt: string,
  systemPrompt?: string
): Promise<string> {
  const url = 'https://openrouter.ai/api/v1/chat/completions';

  const messages: any[] = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  const cleanKey = apiKey.trim();
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cleanKey}`,
      'HTTP-Referer': 'https://schemax.app',
      'X-Title': 'Schemax Story Studio',
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
    const message =
      errorData.error?.message ||
      (typeof errorData.error === 'string' ? errorData.error : null) ||
      `HTTP ${response.status} (${response.statusText || 'Gagal terhubung ke OpenRouter'})`;
    throw new Error(`OpenRouter [${model}]: ${message}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    if (data.error) {
      throw new Error(`OpenRouter: ${data.error.message || JSON.stringify(data.error)}`);
    }
    throw new Error(`Respon OpenRouter (${model}) kosong.`);
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
      'Belum ada API Key yang dikonfigurasi. Silakan buka Pengaturan AI (ikon ✨ di header) untuk memasukkan API Key Gemini, Groq, atau OpenRouter Anda.'
    );
  }

  // Sort slots according to Provider Priority & explicit Slot order (Slot 1, Slot 2, etc.)
  // When Smart Adjust is enabled, if a slot has severe consecutive failures it is deprioritized to the back
  activeSlots.sort((a, b) => {
    const priorityA = config.providerPriority.indexOf(a.provider);
    const priorityB = config.providerPriority.indexOf(b.provider);
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    if (config.smartAdjustEnabled) {
      // Deprioritize slots that have consecutive failures or failing status
      const healthA = calculateSlotHealth(a).score;
      const healthB = calculateSlotHealth(b).score;
      if (Math.abs(healthA - healthB) > 30) {
        return healthB - healthA;
      }
    }
    // Maintain natural configuration order (Slot 1, Slot 2...)
    return config.slots.indexOf(a) - config.slots.indexOf(b);
  });

  // Iterate over Slots
  for (const slot of activeSlots) {
    // Determine fallback models: slot override, providerGlobal fallbackModels, cachedModels, or sensible default
    const providerGlobal =
      slot.provider === 'gemini'
        ? config.geminiConfig
        : slot.provider === 'groq'
        ? config.groqConfig
        : config.openrouterConfig;

    let fallbackModels = (slot.models && slot.models.length > 0
      ? slot.models
      : providerGlobal?.fallbackModels || []).filter((m) => Boolean(m && m.trim().length > 0));

    // If no models were explicitly set or all were empty strings, fallback to cached models or known reliable defaults
    if (fallbackModels.length === 0) {
      if (providerGlobal?.cachedModels && providerGlobal.cachedModels.length > 0) {
        // Take up to top 3 cached models
        fallbackModels = providerGlobal.cachedModels.slice(0, 3).map((m) => m.id);
      } else {
        if (slot.provider === 'gemini') {
          fallbackModels = [...DEFAULT_GEMINI_FALLBACKS];
        } else if (slot.provider === 'groq') {
          fallbackModels = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
        } else {
          fallbackModels = ['meta-llama/llama-3.3-70b-instruct:free', 'mistralai/mistral-7b-instruct:free'];
        }
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
        } else if (slot.provider === 'openrouter') {
          resultText = await executeOpenRouterRequest(slot.apiKey, model, prompt, systemPrompt);
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

        // Jika error adalah KUOTA HABIS (429 / RESOURCE_EXHAUSTED / quota exceeded) pada key ini,
        // seluruh model pada API Key slot ini kemungkinan besar terbatasi rate limit.
        // Namun, jika masih ada model berikutnya atau slot berikutnya, kita teruskan pencarian.
        const isQuotaExceeded =
          errorMessage.includes('429') ||
          errorMessage.toLowerCase().includes('resource_exhausted') ||
          errorMessage.toLowerCase().includes('quota exceeded') ||
          errorMessage.toLowerCase().includes('rate limit');

        if (isQuotaExceeded) {
          console.warn(`[Schemax AI Fallback] Kuota/rate limit pada ${slot.label} (${model}). Beralih ke percobaan berikutnya...`);
          // Jika kuota habis pada level key, beralih ke slot berikutnya agar tidak membuang waktu di key yang sama
          break;
        }

        // Catatan: Jika terkena PROHIBITED_CONTENT pada satu model, JANGAN langsung hentikan proses!
        // Beri kesempatan model lain dalam slot yang sama (misal Gemini 1.5 Pro vs 2.5 Flash memiliki toleransi filter berbeda),
        // lalu lanjutkan ke Slot Gemini berikutnya, Slot Groq, dan Slot OpenRouter secara bertingkat.
      }
    }
  }

  // If we reach here, ALL slots and ALL models failed
  const errorSummary = attempts
    .map((att) => `• [${att.provider.toUpperCase()} - ${att.model} (${att.slotLabel})]: ${att.error || 'Gagal'}`)
    .join('\n');

  const hasProhibited = attempts.some((att) => att.error?.includes('PROHIBITED_CONTENT'));
  if (hasProhibited) {
    const hasUncensoredConfigured = config.slots.some(
      (s) => (s.provider === 'groq' || s.provider === 'openrouter') && s.isActive && s.apiKey && s.apiKey.trim().length > 0
    );

    let tip = '';
    if (!hasUncensoredConfigured) {
      tip = `\n\n💡 Solusi Konten Cerita Dewasa / Konflik Sensitif:\n` +
        `Google Gemini memiliki filter kata kunci bawaan server. Untuk cerita bertema dewasa/konflik berat, tambahkan provider Groq (Llama 3.3) atau OpenRouter (Dolphin/Llama Free) di Pengaturan AI (ikon ✨ di header) yang bebas dari filter server Google.`;
    }

    throw new Error(
      `Semua model dan slot API telah dicoba namun gagal:\n${errorSummary}${tip}`
    );
  }

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
    const effectiveModel =
      modelName && modelName.trim().length > 0
        ? modelName.trim()
        : slot.provider === 'gemini'
        ? 'gemini-2.5-flash'
        : slot.provider === 'groq'
        ? 'llama-3.3-70b-versatile'
        : 'meta-llama/llama-3.3-70b-instruct:free';

    if (slot.provider === 'gemini') {
      await executeGeminiRequest(slot.apiKey, effectiveModel, testPrompt);
    } else if (slot.provider === 'groq') {
      await executeGroqRequest(slot.apiKey, effectiveModel, testPrompt);
    } else if (slot.provider === 'openrouter') {
      await executeOpenRouterRequest(slot.apiKey, effectiveModel, testPrompt);
    }

    const latencyMs = Date.now() - startTime;
    return {
      success: true,
      message: `Terhubung dengan ${effectiveModel}! (${latencyMs}ms)`,
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
  contentText: string,
  onAttempt?: (event: AIGenerationEvent) => void
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
  const res = await generateWithSmartFallback(prompt, systemPrompt, onAttempt);
  return res.text.trim();
}

// 2. Chapter Auto-Plot Engine (Hook, Rising Action, Climax, Resolution)
export async function generateChapterAutoPlot(
  chapterTitle: string,
  bookTitle: string,
  contentText: string,
  premise?: string,
  onAttempt?: (event: AIGenerationEvent) => void
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
  const res = await generateWithSmartFallback(prompt, systemPrompt, onAttempt);

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
  promptSettings?: ImagePromptSettings,
  onAttempt?: (event: AIGenerationEvent) => void
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
${wrapPromptSandbox(contentText.slice(0, 60000), 'NASKAH_BAB')}

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
  const res = await generateWithSmartFallback(prompt, systemPrompt, onAttempt);

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

export interface CoverPromptResult {
  prompt: string;
  explanation: string;
  characterReferences: string[];
}

// Robust Cover Prompt Parser: Guarantees prompt, explanation, and characters are never merged
export function parseCoverPromptResult(
  rawText: string,
  knownEntities: string[] = []
): CoverPromptResult {
  if (!rawText || !rawText.trim()) {
    return { prompt: '', explanation: '', characterReferences: [] };
  }

  let prompt = '';
  let explanation = '';
  let characterReferences: string[] = [];

  // 1. Try resilient JSON parse
  try {
    const parsed = resilientParseJsonObject(rawText);
    if (parsed && typeof parsed === 'object') {
      if (typeof parsed.prompt === 'string' && parsed.prompt.trim()) {
        prompt = parsed.prompt.trim();
      }
      if (typeof parsed.explanation === 'string' && parsed.explanation.trim()) {
        explanation = parsed.explanation.trim();
      }
      if (Array.isArray(parsed.characterReferences)) {
        characterReferences = parsed.characterReferences
          .map((c) => String(c).trim())
          .filter(Boolean);
      }
    }
  } catch (_) {}

  // 2. Try Tagged Blocks <<<PROMPT>>> ... <<<END_PROMPT>>>
  if (!prompt) {
    const promptTagMatch = rawText.match(/<<<PROMPT>>>([\s\S]*?)<<<END_PROMPT>>>/i);
    if (promptTagMatch) prompt = promptTagMatch[1].trim();
  }
  if (!explanation) {
    const expTagMatch = rawText.match(/<<<EXPLANATION>>>([\s\S]*?)<<<END_EXPLANATION>>>/i);
    if (expTagMatch) explanation = expTagMatch[1].trim();
  }
  if (characterReferences.length === 0) {
    const charTagMatch = rawText.match(/<<<CHARACTERS>>>([\s\S]*?)<<<END_CHARACTERS>>>/i);
    if (charTagMatch) {
      characterReferences = charTagMatch[1]
        .split(/[,;\n]+/)
        .map((s) => s.replace(/^[-*•\d.\s]+/, '').trim())
        .filter(Boolean);
    }
  }

  // 3. Regex JSON extraction if rawText had broken quotes/newlines
  if (!prompt) {
    const jsonPromptMatch = rawText.match(/"prompt"\s*:\s*"((?:[^"\\]|\\.)*)"/s);
    if (jsonPromptMatch) {
      prompt = jsonPromptMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').trim();
    }
  }
  if (!explanation) {
    const jsonExpMatch = rawText.match(/"explanation"\s*:\s*"((?:[^"\\]|\\.)*)"/s);
    if (jsonExpMatch) {
      explanation = jsonExpMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').trim();
    }
  }

  // 4. Section headers (PROMPT:, PENJELASAN:)
  if (!prompt || !explanation) {
    const promptSection = rawText.match(/(?:^|\n)(?:###?\s*)?(?:PROMPT|VISUAL PROMPT|PROMPT VISUAL)\s*:\s*([\s\S]*?)(?=(?:^|\n)(?:###?\s*)?(?:EXPLANATION|PENJELASAN|DESKRIPSI|CHARACTERS|KARAKTER)|$)/i);
    if (promptSection && promptSection[1]) {
      prompt = promptSection[1].trim();
    }

    const expSection = rawText.match(/(?:^|\n)(?:###?\s*)?(?:EXPLANATION|PENJELASAN|DESKRIPSI)\s*:\s*([\s\S]*?)(?=(?:^|\n)(?:###?\s*)?(?:CHARACTERS|KARAKTER|PROMPT)|$)/i);
    if (expSection && expSection[1]) {
      explanation = expSection[1].trim();
    }
  }

  // 5. Intelligent Separation if prompt still contains explanation in one chunk
  if (!prompt) {
    const cleanRaw = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    prompt = cleanRaw;
  }

  // If prompt has an Indonesian explanation appended at the end (e.g. "Desain sampul: ..." or "Penjelasan: ...")
  const splitKeywords = [
    '\nDesain sampul',
    '\nSampul bab',
    '\nPenjelasan',
    '\nKarakter yang',
    '\nTokoh yang',
    '\nFoto vertikal',
  ];
  for (const kw of splitKeywords) {
    const idx = prompt.indexOf(kw);
    if (idx !== -1 && idx > 30) {
      if (!explanation) {
        explanation = prompt.slice(idx).replace(/^\n+/, '').trim();
      }
      prompt = prompt.slice(0, idx).trim();
      break;
    }
  }

  // Clean prompt quotes or formatting remnants
  prompt = prompt
    .replace(/^["']|["']$/g, '')
    .replace(/^PROMPT:\s*/i, '')
    .trim();

  if (explanation) {
    explanation = explanation
      .replace(/^["']|["']$/g, '')
      .replace(/^(?:PENJELASAN|EXPLANATION|DESKRIPSI):\s*/i, '')
      .trim();
  }

  // Ensure prompt has --ar 9:16
  if (prompt && !prompt.includes('--ar')) {
    prompt += ' --ar 9:16';
  }

  // 6. Character References Detection (Auto-detect if AI didn't return array)
  if (characterReferences.length === 0) {
    const foundNames = new Set<string>();

    // A. Match "Nama [pria1]" or "Nama [wanita1]" anywhere in explanation or prompt
    const fullText = `${explanation} ${prompt}`;
    const tagMatches = fullText.matchAll(/([A-Z][a-zA-Z0-9\s]{1,25})\s*(\[(?:pria|wanita)\d*\])/gi);
    for (const m of tagMatches) {
      const candidateName = m[1].replace(/\b(dan|atau|serta|dengan|pada|saat|ketika|foto|gambar|desain|karakter|tokoh|pria|wanita)\b/gi, '').trim();
      if (candidateName.length >= 2) {
        foundNames.add(`${candidateName} ${m[2]}`);
      }
    }

    // B. Match known entities against text
    knownEntities.forEach((entName) => {
      const clean = entName.trim();
      if (clean.length >= 2 && fullText.toLowerCase().includes(clean.toLowerCase())) {
        const regex = new RegExp(`${clean}\\s*(\\[(?:pria|wanita)\\d*\\])`, 'i');
        const tagMatch = fullText.match(regex);
        if (tagMatch) {
          foundNames.add(`${clean} ${tagMatch[1]}`);
        } else {
          foundNames.add(clean);
        }
      }
    });

    // C. Fallback: extract any isolated brackets like [pria1], [wanita1]
    if (foundNames.size === 0) {
      const rawBrackets = prompt.match(/\[(?:pria|wanita)\d*\]/gi);
      if (rawBrackets) {
        rawBrackets.forEach((b) => foundNames.add(`Tokoh ${b}`));
      }
    }

    characterReferences = Array.from(foundNames);
  }

  return {
    prompt,
    explanation,
    characterReferences,
  };
}

// 3b. AI Book Cover Visual Concept Prompt Engine
export async function generateBookCoverPrompt(
  params: {
    bookTitle: string;
    genre?: string;
    synopsis?: string;
    chapterContext?: string;
    entities?: Array<{ name: string; category?: string; shortDescription?: string; initialTraits?: string }>;
  },
  onEvent?: (event: AIGenerationEvent) => void
): Promise<CoverPromptResult> {
  const charactersList = (params.entities || [])
    .filter((e) => !e.category || e.category === 'character')
    .slice(0, 15)
    .map((e) => `- ${e.name}: ${e.shortDescription || e.initialTraits || 'Tokoh cerita'}`)
    .join('\n');

  const knownNames = (params.entities || [])
    .filter((e) => !e.category || e.category === 'character')
    .map((e) => e.name);

  const prompt = `Anda adalah seorang visual director, concept artist, dan art designer spesialis sampul novel / web novel terkemuka.
Tugas Anda adalah merancang PROMPT VISUAL UNTUK SAMPUL BUKU (BOOK COVER) yang memukau, bernilai seni tinggi, dan berorientasi vertikal (9:16).

Informasi Buku:
- Judul Buku: "${params.bookTitle}"
- Genre: ${params.genre || 'Fiksi Fantasi / Drama / Misteri'}
- Sinopsis / Garis Besar Cerita:
${params.synopsis ? wrapPromptSandbox(params.synopsis.slice(0, 3000), 'SINOPSIS') : 'Cerita fiksi mendalam'}
${params.chapterContext ? `\n- Konteks Bab & Peristiwa Cerita:\n${wrapPromptSandbox(params.chapterContext.slice(0, 2000), 'KONTEKS_BAB')}` : ''}

Daftar Tokoh Cerita yang Tercatat:
${charactersList || '(Belum ada tokoh eksplisit di ensiklopedia. Kenali tokoh utama dari sinopsis atau konteks bab di atas!)'}

ATURAN WAJIB & SANGAT KETAT:
1. User selalu melampirkan gambar referensi karakter di generator gambar AI.
2. JANGAN sebut atau deskripsikan bentuk wajah, warna kulit, atau postur tubuh karakter! Gunakan referensi visual yang dilampirkan.
3. JANGAN sebut nama karakter di dalam prompt visual. Ganti dengan label dalam kurung siku seperti "[pria1]" atau "[wanita1]". Jika ada lebih dari satu, beri nomor (contoh: "[pria1]", "[wanita1]", "[pria2]"). Tentukan siapa tokoh utama yang paling tepat menghiasi sampul buku.
4. JANGAN ubah model pakaian asli karakter secara drastis. HANYA boleh perubahan minor yang dramatis (misal: "jubah berlumur debu petualangan", "gaun anggun tersibak angin kencang", "pakaian zirah perang yang retak").
5. Jelaskan secara sangat mendalam: KOMPOSISI SAMPUL VERTIKAL, POSE UTAMA, EKSPRESI EMOSI, ELEMEN SIMBOLIS / LATAR IKONIK DUNIA CERITA, PENCAHAYAAN (lighting dramatis, volumetric, chiaroscuro, rim light), dan ATMOSFER sinematik.
6. Format teknis prompt: "Vertical book cover format (9:16), typography-ready negative space at top/bottom, 8k masterpiece, photorealistic cinematic concept art, [deskripsi pose, ekspresi, interaksi, pakaian minor change, latar, lighting] --ar 9:16".
7. WAJIB DAFTARKAN "characterReferences": Nama-nama karakter asli yang gambarnya harus dilampirkan oleh user beserta labelnya, misal: ["Agung [pria1]", "Santi [wanita1]"]. JIKA daftar tokoh di ensiklopedia kosong, kenali dan tentukan nama tokoh protagonis utama dari sinopsis/bab!
8. WAJIB BERIKAN "explanation": Penjelasan konsep sampul dalam Bahasa Indonesia yang santai, jelas, dan jelaskan siapa tokoh yang dimaksud (misal: "Sampul buku menampilkan Agung [pria1] yang menatap langit berbintang...").

FORMAT KELUARAN (PENTING: Pisahkan prompt dan penjelasan menggunakan blok tag atau JSON):
<<<PROMPT>>>
Vertical book cover format 9:16, typography-ready negative space at top/bottom, 8k masterpiece, photorealistic cinematic concept art, [pria1] standing atop a crumbling cliff... --ar 9:16
<<<END_PROMPT>>>

<<<EXPLANATION>>>
Desain sampul buku menampilkan tokoh utama [pria1] dengan latar pemandangan epik...
<<<END_EXPLANATION>>>

<<<CHARACTERS>>>
Nama Tokoh [pria1], Tokoh Pendamping [wanita1]
<<<END_CHARACTERS>>>`;

  const systemPrompt =
    'Anda adalah visual director dan art designer profesional spesialis sampul buku. Pisahkan prompt dan penjelasan dengan jelas.';
  const res = await generateWithSmartFallback(prompt, systemPrompt, onEvent);
  return parseCoverPromptResult(res.text, knownNames);
}

// 3c. AI Chapter Cover Visual Concept Prompt Engine
export async function generateChapterCoverPrompt(
  params: {
    bookTitle: string;
    chapterTitle: string;
    chapterOrder?: number;
    premise?: string;
    contentText?: string;
    entities?: Array<{ name: string; category?: string; shortDescription?: string; initialTraits?: string }>;
  },
  onEvent?: (event: AIGenerationEvent) => void
): Promise<CoverPromptResult> {
  const charactersList = (params.entities || [])
    .filter((e) => !e.category || e.category === 'character')
    .slice(0, 15)
    .map((e) => `- ${e.name}: ${e.shortDescription || e.initialTraits || 'Tokoh cerita'}`)
    .join('\n');

  const knownNames = (params.entities || [])
    .filter((e) => !e.category || e.category === 'character')
    .map((e) => e.name);

  const contentSnippet = (params.contentText || '')
    .slice(0, 4000)
    .trim();

  const prompt = `Anda adalah visual director dan concept artist profesional spesialis sampul bab / chapter cover & web novel banner.
Tugas Anda adalah merancang PROMPT VISUAL UNTUK SAMPUL BAB (CHAPTER COVER) yang menangkap momen klimaks, ketegangan, atau suasana paling emosional dari bab ini (rasio vertikal 9:16).

Informasi Bab:
- Judul Buku: "${params.bookTitle}"
- Bab: ${params.chapterOrder ? `Bab ${params.chapterOrder}: ` : ''}"${params.chapterTitle}"
- Premis Bab: ${params.premise || 'Momen penting dalam cerita'}
${contentSnippet ? `- Cuplikan Naskah Bab:\n${wrapPromptSandbox(contentSnippet, 'CUPLIKAN_NASKAH')}` : ''}

Daftar Tokoh Cerita yang Berpotensi Hadir:
${charactersList || '(Belum ada tokoh spesifik di ensiklopedia. Kenali tokoh utama dari naskah/premis bab di atas!)'}

ATURAN WAJIB & SANGAT KETAT:
1. User selalu melampirkan gambar referensi karakter di generator gambar AI.
2. JANGAN sebut atau deskripsikan bentuk wajah, warna kulit, atau postur tubuh karakter! Gunakan referensi visual yang dilampirkan.
3. JANGAN sebut nama karakter di dalam prompt. Ganti dengan label dalam kurung siku seperti "[pria1]" atau "[wanita1]". Jika ada lebih dari satu, beri nomor (contoh: "[pria1]", "[wanita1]", "[pria2]").
4. JANGAN ubah pakaian asli secara drastis. HANYA boleh perubahan minor realistis sesuai momen bab (misal: "baju robek di siku", "basah kuyup kena hujan", "jubah tersampir santai").
5. Jelaskan secara sangat mendalam: FOKUS ADEGAN UTAMA BAB, POSE KARAKTER, EKSPRESI EMOSI, LATAR LINGKUNGAN, PENCAHAYAAN (lighting dramatis), dan ATMOSFER cerita bab ini.
6. Format teknis prompt: "Vertical chapter cover (9:16), 8k hyper realistic, photorealistic cinematic concept art, [deskripsi pose, emosi, interaksi tokoh, latar bab, lighting dramatis] --ar 9:16".
7. WAJIB DAFTARKAN "characterReferences": Nama-nama karakter asli yang gambarnya harus dilampirkan oleh user beserta labelnya, misal: ["Budi [pria1]", "Rina [wanita1]"].
8. WAJIB BERIKAN "explanation": Penjelasan isi sampul bab dalam Bahasa Indonesia yang santai, jelas, dan sebutkan siapa nama karakter yang dimaksud beserta label bracketnya.

FORMAT KELUARAN (PENTING: Pisahkan prompt dan penjelasan menggunakan blok tag atau JSON):
<<<PROMPT>>>
Vertical chapter cover 9:16, 8k hyper realistic, photorealistic cinematic concept art, [pria1]... --ar 9:16
<<<END_PROMPT>>>

<<<EXPLANATION>>>
Sampul bab memperlihatkan momen ketika [pria1]...
<<<END_EXPLANATION>>>

<<<CHARACTERS>>>
Nama Tokoh [pria1], Nama Tokoh [wanita1]
<<<END_CHARACTERS>>>`;

  const systemPrompt =
    'Anda adalah visual director dan concept artist profesional spesialis chapter cover. Pisahkan prompt dan penjelasan dengan jelas.';
  const res = await generateWithSmartFallback(prompt, systemPrompt, onEvent);
  return parseCoverPromptResult(res.text, knownNames);
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
${wrapPromptSandbox(rawText, 'CORETAN_MENTAH')}

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
  }>,
  onAttempt?: (event: AIGenerationEvent) => void
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
${wrapPromptSandbox(chapterText.slice(0, 30000), 'NASKAH_BAB')}

Tugas Analisis Mendalam:
1. DETEKSI ENTITAS BARU (suggestedAction: "register_new"):
   - Cari karakter, lokasi, item/senjata/relik, atau istilah lore/faksi penting yang muncul di naskah bab ini TAPI BELUM ADA di daftar entitas buku di atas.
   
   A. SPESIFIKASI UNTUK KARAKTER (category: "character"):
      * initialDescription: Latar belakang asal-usul atau peran awalnya (misal: "Putri bangsawan di Kerajaan Asura").
      * initialTraits: Sifat & watak kepribadian dasar/awalnya (misal: "Penyayang, baik hati, santun, penurut").
      * currentDescription: Gambaran kondisi fisik/sosial/situasi saat ini di bab ini.
      * currentTraits: Sifat & watak kepribadian saat ini di bab ini (misal: "Kasar, manipulatif, penuh dendam").
      * physicalTraits: CIRI-CIRI FISIK LENGKAP & SPESIFIK: bentuk wajah, mata, rambut, warna kulit beragam (kuning langsat, putih gading, sawo matang, cerah), serta bentuk/proporsi tubuh yang jelas (sintal/semok berlekuk hourglass, ramping, atletis, tegap, dsb). Pakaian dan aksesoris wajib disesuaikan dengan profesi/peran/keadaan karakter (misal: pedagang, polisi, penyihir, ksatria, ilmuwan, ibu rumah tangga, anak sekolah, dsb. Hindari memaksakan batik/kebaya jika bukan acara adat).
      * visualPrompt: Text-to-Image prompt Bahasa Inggris detail 9:16:
        Format wajib: "Full body portrait standing upright facing camera directly, centered composition, looking straight into lens, [youthful Indonesian/appearance], [age] years old, fresh youthful glowing skin, [detailed facial features, hair, and exact body silhouette/curves], wearing [profession-appropriate attire: e.g. police tactical uniform / merchant apron and attire / ornate mage robe / knight plate armor / scientist white lab coat / cozy simple homedress for housewife / neat school uniform with backpack for student], in a contextual [role-matched atmospheric setting: e.g. bustling shop stall / modern police station / arcana magic library / medieval stone castle / high-tech laboratory / cozy sunlit kitchen / school hallway] with shallow depth of field background blur, sharp well-lit facial features, confident or natural posture, cinematic lighting, 8k resolution, photorealistic, vertical 9:16 aspect ratio, --ar 9:16".
        ATURAN MUTLAK: Karakter WAJIB menghadap langsung ke arah kamera dengan wajah dan postur yang jelas dan terang. Latar belakang harus memiliki efek cinematic blur halus agar karakter tetap menjadi subjek utama yang tajam. Dilarang menggunakan kata 'mature/aged' untuk tokoh muda.
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
  const res = await generateWithSmartFallback(prompt, systemPrompt, onAttempt);

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
  const config = loadAISettings();
  const geminiSlot = config.slots.find((s) => s.provider === 'gemini' && s.apiKey && s.apiKey.trim().length > 0)
    || (config.geminiConfig?.apiKey ? { provider: 'gemini' as const, apiKey: config.geminiConfig.apiKey, models: config.geminiConfig.fallbackModels } : null);

  if (!geminiSlot || !geminiSlot.apiKey) {
    throw new Error('AI Vision memerlukan API Key Gemini. Buka Pengaturan AI dan tambahkan slot API Key Gemini.');
  }

  const visionModels = [
    ...(geminiSlot.models && geminiSlot.models.length > 0 ? geminiSlot.models : config.geminiConfig?.fallbackModels || []),
    'gemini-3.5-flash',
    'gemini-3.8-flash-preview',
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

// 8b. AI Character Photo Vision Profiler (Gender, Exact Age without range, Physical Traits & Clothing)
export interface CharacterVisionScanResult {
  gender: string; // "Pria" | "Wanita"
  estimatedAge: string; // Specific exact age, e.g. "24 tahun", NO RANGES!
  physicalTraits: string; // Detailed facial, hair, eyes, skin, physique, special marks
  clothingAttire: string; // Detailed clothing, attire, style, accessories, colors
  shortSummary: string; // Concise evocative character description (1-2 sentences)
  englishVisualPrompt: string; // Text-to-image prompt in English (9:16 aspect ratio)
}

export async function analyzeCharacterPhotoWithVision(
  base64Image: string,
  mimeType: string,
  characterName?: string,
  category: string = 'character'
): Promise<CharacterVisionScanResult> {
  const config = loadAISettings();
  const geminiSlot = config.slots.find((s) => s.provider === 'gemini' && s.apiKey && s.apiKey.trim().length > 0)
    || (config.geminiConfig?.apiKey ? { provider: 'gemini' as const, apiKey: config.geminiConfig.apiKey, models: config.geminiConfig.fallbackModels } : null);

  if (!geminiSlot || !geminiSlot.apiKey) {
    throw new Error('AI Vision memerlukan API Key Gemini. Buka Pengaturan AI dan tambahkan slot API Key Gemini.');
  }

  const visionModels = [
    ...(geminiSlot.models && geminiSlot.models.length > 0 ? geminiSlot.models : config.geminiConfig?.fallbackModels || []),
    'gemini-3.5-flash',
    'gemini-3.8-flash-preview',
    'gemini-2.5-flash',
  ].filter((v, i, a) => a.indexOf(v) === i);

  const isChar = category === 'character';

  const prompt = isChar
    ? `Analisis foto/gambar karakter ini secara detail, akurat, dan mendalam untuk profil tokoh cerita fiksi.
Nama Karakter: "${characterName || 'Tokoh Cerita'}"

ATURAN KRUSIAL DARI PENULIS:
1. "gender": Tentukan jenis kelamin yang tampak ("Pria" atau "Wanita").

2. "estimatedAge": Tentukan perkiraan usia yang tampak secara akurat dan condong muda sesuai penampilan aslinya.
   - JANGAN MENEBAK TERLALU TUA! Jika wajah tampak muda (misal remaja atau usia 20-an), tulis usia muda yang tepat (contoh: "19 tahun", "21 tahun", "23 tahun", "25 tahun").
   - DILARANG KERAS MENGGUNAKAN RENTANG seperti "20-25 tahun" atau "sekitar 30-an". Harus satu angka pasti diikuti kata "tahun"!

3. "physicalTraits": Jabarkan secara detail, presisi, dan JUJUR seluruh ciri fisik dari foto:
   - WAJIB ANALISIS BENTUK DAN PROPORSI TUBUH SECARA DETAIL & AKURAT SESUAI FOTO:
     * Jika karakter wanita di foto tampak semok / sintal / montok berisi / berlekuk indah / hourglass (memiliki lekuk pinggul dan dada yang penuh dan padat, lekuk pinggang ramping, paha/bokong berisi, siluet tubuh memikat dan proporsional), SEBUTKAN SECARA SPESIFIK & JELAS! Jangan disensor atau dibuat generik "postur sedang"! Tuliskan lekuk tubuhnya dengan jelas: misal "Bentuk tubuh semok dan sintal dengan siluet jam pasir (hourglass), pinggang ramping dengan lekuk pinggul dan dada yang berisi padat, proporsi tubuh feminin yang memikat".
     * Jika ramping/langsing (slender, petite), atletis kencang (athletic, toned), atau tegap berisi, sebutkan secara presisi.
   - Wajah & Kulit: bentuk wajah, mata (warna & tatapan), bibir, hidung, warna kulit (misal: kulit sawo matang mulus, kuning langsat, cerah berseri), kondisi kulit yang halus kencang dan tampak muda segar.
   - Rambut: gaya rambut, panjang rambut, tekstur, dan warna rambut.
   - Ekspresi wajah: senyuman, tatapan, atau ekspresi khas tokoh.

4. "clothingAttire": Jabarkan secara detail busana dan pakaian yang tampak di foto:
   - Jenis pakaian (atasan, bawahan, gaun, celana, jaket, kebaya, seragam dinas, jubah, baju pelindung zirah, jas lab, seragam sekolah, daster santai, dll).
   - Warna kain, corak/motif, potongan/kerah pakaian yang pas badan, serta aksesoris/perhiasan yang dikenakan.
   - Analisis peran/profesi/keadaan karakter berdasarkan pakaian dan penampilannya (misal: pedagang, polisi, penyihir, ksatria, ilmuwan, ibu rumah tangga, anak sekolah, pekerja kantoran, petualang, dll).

5. "shortSummary": Rangkuman 1-2 kalimat deskripsi ringkas tokoh yang memikat untuk profil ensiklopedia.

6. "englishVisualPrompt": Text-to-image prompt dalam Bahasa Inggris dengan fidelitas visual TERTINGGI untuk AI image generator (Midjourney v6, Flux.1, SDXL, SeaArt, Leonardo).
   ATURAN KHUSUS VISUAL PROMPT:
   a) KEMUDAAN MUTLAK: Wajib menyertakan frase kemudaan agar karakter TIDAK di-generate lebih tua: "stunning youthful [young woman / young man], [estimatedAge] years old, fresh youthful radiant glowing skin, smooth youthful face, vibrant and energetic young appearance".
   b) PROPORSI TUBUH FAITHFUL: Wajib menerjemahkan bentuk tubuh foto secara persis:
      - Jika di foto tampak semok / berlekuk indah: sertakan "gorgeous voluptuous hourglass figure, full feminine hips, narrow defined waistline, shapely curves, attractive well-proportioned curvy body silhouette, feminine allure".
      - Jika ramping: "slender graceful petite silhouette, elegant slender build".
      - Jika atletis: "toned athletic feminine build".
   c) DETAIL WAJAH & RAMBUT: detail mata, bibir, gaya rambut, dan warna kulit.
   d) BUSANA & ATRIBUT PROFESI: potongan busana, warna, dan atribut sesuai foto dan peran/keadaannya (misal: tactical officer uniform, shopkeeper attire with apron, wizard robes, knight armor, white lab coat, cozy homedress, neat student uniform).
   e) LATAR BELAKANG KONTEKSTUAL (ENVIRONMENT): Sertakan latar belakang atmosferik yang sesuai dengan profesi/keadaan karakter (misal: modern police office, lively merchant shop, arcane library, stone fortress, high-tech lab, warm sunlit kitchen/living room, school corridor) dengan subtle bokeh / shallow depth of field halus agar karakter tetap menjadi subjek utama yang tajam di depan.
   f) POSE MENGHADAP KAMERA & WAJAH JELAS (MUTLAK): Karakter WAJIB menghadap langsung ke arah kamera ("standing upright facing camera directly, looking straight into lens"), dengan postur tegap/natural yang jelas serta fitur wajah yang tajam, terang, dan tidak tertutupi ("clear sharp well-lit facial features, expressive eyes").
   g) RENDER QUALITY: "full body portrait, centered, hyper realistic, photorealistic masterpiece, 8k resolution, cinematic lighting, shallow depth of field, authentic photography, vertical 9:16 aspect ratio, --ar 9:16".
   h) DILARANG KERAS menggunakan kata-kata yang memicu render usia tua seperti "mature", "aged", "weathered", "wrinkled", "elderly".

Format output HANYA JSON valid:
{
  "gender": "Wanita",
  "estimatedAge": "22 tahun",
  "physicalTraits": "...",
  "clothingAttire": "...",
  "shortSummary": "...",
  "englishVisualPrompt": "..."
}`
    : `Analisis foto/gambar ${category.toUpperCase()} ini secara detail dan mendalam untuk profil ensiklopedia fiksi.
Nama Entitas: "${characterName || 'Entitas Dunia'}"
Kategori: "${category}"

TUGAS ANDA:
1. "gender": Kosongkan ("-") jika bukan manusia.
2. "estimatedAge": Jika tempat kuno/relik, perkirakan era/abad (misal: "Kuno 300 tahun"), atau kosongkan jika tidak relevan.
3. "physicalTraits": Jabarkan bentuk visual, material pembentuk/arsitektur/geografi, ornamen, warna, dan aura fisik yang terlihat.
4. "clothingAttire": Jabarkan elemen pelindung, perhiasan, tata letak arsitektur, atau ornamen yang melekat.
5. "shortSummary": Rangkuman 1-2 kalimat deskriptif ensiklopedia yang memikat.
6. "englishVisualPrompt": Text-to-image prompt dalam Bahasa Inggris detail visual cinematic.

Format output HANYA JSON valid:
{
  "gender": "",
  "estimatedAge": "",
  "physicalTraits": "...",
  "clothingAttire": "...",
  "shortSummary": "...",
  "englishVisualPrompt": "..."
}`;

  const systemPrompt = 'Anda adalah masterclass visual profiler karakter novel dan AI Vision literary expert. Hasilkan HANYA JSON object murni tanpa markdown wrapper berlebih.';

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

      const parsed = resilientParseJsonObject<CharacterVisionScanResult>(rawText);
      if (parsed) {
        // Enforce exact age format (clean up any residual ranges if AI slipped)
        let cleanAge = (parsed.estimatedAge || '').trim();
        const rangeMatch = cleanAge.match(/(\d+)\s*[-–—]\s*(\d+)/);
        if (rangeMatch) {
          const avg = Math.round((parseInt(rangeMatch[1], 10) + parseInt(rangeMatch[2], 10)) / 2);
          cleanAge = `${avg} tahun`;
        } else if (/^\d+$/.test(cleanAge)) {
          cleanAge = `${cleanAge} tahun`;
        } else if (!cleanAge.includes('tahun')) {
          const numMatch = cleanAge.match(/\d+/);
          cleanAge = numMatch ? `${numMatch[0]} tahun` : '20 tahun';
        }

        return {
          gender: parsed.gender || 'Pria',
          estimatedAge: cleanAge || '20 tahun',
          physicalTraits: parsed.physicalTraits || '',
          clothingAttire: parsed.clothingAttire || '',
          shortSummary: parsed.shortSummary || '',
          englishVisualPrompt: parsed.englishVisualPrompt || '',
        };
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`Character vision attempt with model ${model} failed:`, err);
    }
  }

  throw new Error(lastError?.message || 'Gagal memindai foto karakter dengan AI Vision.');
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
  storyContext?: string,
  onAttempt?: (event: AIGenerationEvent) => void
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
  const res = await generateWithSmartFallback(prompt, systemPrompt, onAttempt);
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
2. Subject & Youthfulness: Depict young characters with radiant, youthful, smooth glowing skin and fresh young facial features. Never make young characters look mature, aged, weathered, or wrinkled unless specifically instructed.
3. Accurate Body Silhouette & Proportions: Faithfully reflect the character's exact body build and curves as described in Physical Traits (e.g. if curvy, voluptuous, semok, or hourglass, describe 'gorgeous voluptuous hourglass figure, full feminine hips, defined waistline, shapely feminine curves'; if slender, describe 'slender graceful silhouette'; if athletic, describe 'toned athletic physique').
4. Ethnicity & Details: State exact ethnicity (default to Indonesian / Southeast Asian unless story states otherwise), age, skin tone (smooth tan, golden, or olive), facial features, and hairstyle.
5. Role-Contextual Attire, Pose, and Setting:
   - Match the attire, equipment, and background environment to the character's specific role, occupation, or condition:
     * Merchant / Pedagang: shopkeeper attire / apron, in front of a lively market stall or shop.
     * Police / Polisi: crisp police / tactical officer uniform with badge, modern police precinct or urban patrol street.
     * Mage / Wizard / Penyihir: ornate mystic robes with arcane symbols and magic staff/focus, in an ancient arcane library or potion laboratory with glowing runes.
     * Knight / Ksatria: polished medieval plate armor with sheathed sword, in a stone fortress courtyard or grand castle hall.
     * Scientist / Ilmuwan: crisp white laboratory coat with lab tools/glasses, inside a high-tech science laboratory with futuristic instruments.
     * Housewife / Ibu Rumah Tangga: simple comfortable pastel loungewear or clean cotton homedress, inside a warm cozy sunlit home kitchen or living room.
     * School Student / Anak Sekolah: neat modern school uniform with a backpack, in a bright school corridor or classroom.
     * Or adapt faithfully to any other specific role / occupation mentioned.
6. STRICT FRONTAL CAMERA POSE & CLEAR VISIBLE FACE (MANDATORY):
   - Regardless of the occupation or equipment, the character MUST BE FACING THE CAMERA DIRECTLY ('standing upright facing camera directly, looking straight into the camera lens').
   - Facial features must be razor-sharp, well-lit, unobstructed, and clearly visible with natural expressive eyes.
   - The contextual background must have a shallow depth of field (subtle bokeh / cinematic background blur) so the character remains the sharp, striking main focal point.
7. Photography & Quality keywords: 8k resolution, photorealistic skin textures, neutral cinematic lighting, shallow depth of field, hyper realistic, vertical mobile phone aspect ratio 9:16, --ar 9:16.
8. OUTPUT RULE: Output ONLY the English prompt string. Do NOT add preamble, quotes, or markdown codeblocks.`;

  const systemPrompt =
    'You are an expert AI prompt engineer. Output strictly the single final English text-to-image prompt without markdown or quotes.';
  const res = await generateWithSmartFallback(prompt, systemPrompt);
  return res.text.replace(/^["'`]|["'`]$/g, '').trim();
}
