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
