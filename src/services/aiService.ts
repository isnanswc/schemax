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
  EntityRelationship,
  EntityCondition,
  RelationshipType,
} from '../types';

// Modern baseline defaults (Gemini 3.1 / 3.0 series & Groq current lineup)
export const DEFAULT_GEMINI_MODELS: AIModelOption[] = [
  { id: 'gemini-3.1-flash', name: 'Gemini 3.1 Flash (Rekomendasi Utama)', description: 'Generasi 3.1: Super Cepat, Cerdas, Konteks Masif untuk Naskah Panjang' },
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
      fallbackModels: ['gemini-3.1-flash', 'gemini-3.1-pro', 'gemini-3.0-flash'],
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
              models: undefined, // Reset to provider global 3.1
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

    // Ensure geminiConfig & groqConfig exist with 3.1 models
    if (!parsed.geminiConfig) {
      parsed.geminiConfig = {
        fallbackModels: ['gemini-3.1-flash', 'gemini-3.1-pro', 'gemini-3.0-flash'],
        cachedModels: DEFAULT_GEMINI_MODELS,
      };
    } else {
      // Ensure cachedModels contains the new 3.1 models
      parsed.geminiConfig.cachedModels = DEFAULT_GEMINI_MODELS;
      // If previous fallback had legacy models, upgrade to 3.1
      if (!parsed.geminiConfig.fallbackModels || !parsed.geminiConfig.fallbackModels[0]?.includes('3.')) {
        parsed.geminiConfig.fallbackModels = ['gemini-3.1-flash', 'gemini-3.1-pro', 'gemini-3.0-flash'];
      }
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
        maxOutputTokens: 8192,
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
      max_tokens: 8192,
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
   Buatkan prompt visual text-to-image (untuk Midjourney/Flux/SD) untuk memvisualisasikan momen paling dramatis dari adegan ini dengan aturan:
   - Rasio Aspek: ${aspectRatio}
   - Gaya Visual: ${style}
   - Penggambaran Karakter: Gunakan label [person1], [person2], dst untuk karakter utama di adegan (sesuai urutan tokoh) agar dapat dicocokkan dengan referensi foto karakter yang dilampirkan.
   - Suasana & Komposisi: Natural scene, pencahayaan alami/sinematik, deskripsi latar yang kaya.
   - Kata Kunci Tambahan: ${extraKeywords}
   - Bahasa Prompt Gambar: ${promptLang}.

Berikan output HANYA berupa JSON array valid persis dengan struktur ini:
[
  {
    "sceneNumber": 1,
    "title": "Judul Singkat Adegan",
    "setting": "Latar tempat & waktu adegan",
    "characters": ["Nama Tokoh 1", "Nama Tokoh 2"],
    "summary": "Rangkuman kejadian dalam adegan ini secara detail",
    "goalConflict": "Tujuan tokoh atau konflik yang terjadi di adegan",
    "timelineType": "linear",
    "timeMarker": "Pagi hari di Dermaga",
    "branchGroup": "Garis Waktu Utama",
    "entitiesPresent": [
      { "name": "Nama Tokoh 1", "category": "character", "entityId": "" },
      { "name": "Dermaga", "category": "location", "entityId": "" },
      { "name": "Pedang Giok", "category": "item", "entityId": "" }
    ],
    "imagePrompt": "Hyper-realistic natural scene photo of [person1] standing at the foggy wooden pier in the morning, holding an ancient jade blade, cinematic soft morning sunlight, 8k resolution, authentic textures, phone wallpaper aspect ratio 9:16 --ar 9:16"
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
      imagePrompt: item.imagePrompt || '',
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
      imagePrompt: '',
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
  promptSettings?: ImagePromptSettings
): Promise<string> {
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

  const prompt = `Anda adalah AI Prompt Engineer spesialis pembuatan prompt gambar sinematik untuk Midjourney, Flux, Stable Diffusion, dan DALL-E 3.

Tugas Anda: Buat SATU prompt teks-ke-gambar (Text-to-Image Prompt) untuk adegan cerita berikut:

Judul Buku: "${bookTitle}"
Judul Bab: "${chapterTitle}"
Adegan: "${scene.title}"
Latar: ${scene.setting || 'Sesuai konteks adegan'}
Tokoh Terlibat: ${scene.characters.join(', ') || 'Karakter utama'}
Ringkasan Kejadian Adegan:
${scene.summary}

Aturan Pembuatan Prompt:
1. Rasio Aspek: ${aspectRatio} (tambahkan penanda --ar 9:16 jika relevan)
2. Gaya Visual: ${style}
3. Penggambaran Karakter: Wajib gunakan sebutan [person1], [person2] dst untuk merepresentasikan karakter yang hadir sesuai urutan tokoh (${charNaming}), sertakan deskripsi pakaian, postur, dan ekspresi emosional mereka.
4. Suasana Adegan: Natural scene, pencahayaan alami/sinematik, kedalaman ruang (depth of field), detail lingkungan latar.
5. Modifiers Tambahan: ${extraKeywords}
6. Bahasa: ${promptLang}.

Format Keluaran:
Tulis HANYA teks prompt gambar akhir siap salin tanpa kata pengantar, tanpa tanda kutip pembuka/penutup, dan tanpa format markdown.`;

  const systemPrompt =
    'Anda adalah world-class AI Image Prompt Engineer untuk novel visual. Keluarkan HANYA teks prompt murni siap pakai.';
  const res = await generateWithSmartFallback(prompt, systemPrompt);
  return res.text.replace(/^["']|["']$/g, '').trim();
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
  existingEntities: Array<{ id: string; name: string; category: string; aliases?: string[] }>
): Promise<Array<{
  id: string;
  name: string;
  category: 'character' | 'location' | 'item' | 'lore';
  shortDescription: string;
  isExisting: boolean;
  existingEntityId?: string;
  detectedAliasOf?: string;
  suggestedAction: 'register_new' | 'add_alias';
}>> {
  const existingListStr =
    existingEntities.length > 0
      ? existingEntities
          .map(
            (e) =>
              `- [ID: ${e.id}] [${e.category.toUpperCase()}] ${e.name}${
                e.aliases && e.aliases.length > 0 ? ` (Alias yang sudah ada: ${e.aliases.join(', ')})` : ''
              }`
          )
          .join('\n')
      : '(Belum ada entitas di Glosarium buku ini)';

  const prompt = `Anda adalah asisten kontinuitas cerita (story continuity expert) dan pengelola lore worldbuilding.

Analisis naskah bab berikut terhadap daftar Glosarium yang sudah ada di buku ini:

Judul Buku: "${bookTitle}"

Daftar Entitas Glosarium yang Sudah Ada di Buku:
${existingListStr}

Isi Naskah Bab:
${chapterText.slice(0, 60000)}

Tugas Analisis:
1. DETEKSI ENTITAS BARU:
   Cari karakter, lokasi, item/senjata, atau istilah lore penting yang muncul di bab ini TAPI BELUM ADA di daftar entitas buku di atas.
2. DETEKSI ALIAS / SEBUTAN LAIN:
   Cari sebutan lain, julukan, gelar, atau istilah pengganti dari entitas yang SUDAH ADA. Contoh: Jika di naskah ada julukan "Sang Pendekar Jubah Hitam" dan konteksnya merujuk pada Karakter "Ahmad", deteksi bahwa itu adalah ALIAS dari Ahmad!

Berikan output HANYA berupa JSON array valid persis dengan struktur ini:
[
  {
    "name": "Nama entitas atau sebutan alias yang ditemukan",
    "category": "character",
    "shortDescription": "Penjelasan singkat siapa/apa ini di bab ini",
    "isExisting": false,
    "existingEntityId": "",
    "detectedAliasOf": "",
    "suggestedAction": "register_new"
  }
]

Aturan:
- category HANYA boleh salah satu dari: "character", "location", "item", "lore"
- suggestedAction HANYA boleh: "register_new" (untuk entitas baru) atau "add_alias" (untuk julukan/alias entitas yang sudah ada)
- Jika alias, sertakan existingEntityId dari daftar di atas dan isi detectedAliasOf dengan nama entitas asli.`;

  const systemPrompt =
    'Anda adalah editor kontinuitas sastra profesional. Hasilkan HANYA JSON array valid.';
  const res = await generateWithSmartFallback(prompt, systemPrompt);

  try {
    const parsed = resilientParseJsonArray<any>(res.text);
    if (parsed.length > 0) {
      return parsed.map((item) => ({
        id: 'det_' + Math.random().toString(36).substring(2, 9),
        name: item.name || '',
        category: ['character', 'location', 'item', 'lore'].includes(item.category)
          ? item.category
          : 'character',
        shortDescription: item.shortDescription || '',
        isExisting: Boolean(item.isExisting),
        existingEntityId: item.existingEntityId || undefined,
        detectedAliasOf: item.detectedAliasOf || undefined,
        suggestedAction: item.suggestedAction === 'add_alias' ? 'add_alias' : 'register_new',
      }));
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
  intensity: 'Tinggi (Aksi/Konflik)' | 'Misteri (Plot Twist)' | 'Emosional (Drama)' | 'Eksplorasi (Lore)';
  rationale: string;
}

export async function generateNextChapterBranches(
  chapterTitle: string,
  bookTitle: string,
  contentText: string,
  premise?: string
): Promise<ChapterBranchOption[]> {
  const prompt = `Analisis bab ini dan hasilkan 3 rekomendasi cabang alur cerita (branching plot options) untuk bab berikutnya:
Judul Buku: "${bookTitle}"
Bab Saat Ini: "${chapterTitle}"
Premis Bab Ini: ${premise || 'Belum ada premis tertulis'}

Naskah Bab Ini:
${contentText ? contentText.slice(0, 60000) : (premise || 'Bab ini sedang ditulis')}

Tugas:
Rancang 3 arah alur bab selanjutnya yang sangat menarik dan berbeda:
1. Cabang Intensitas Tinggi (Aksi langsung, eskalasi konflik, konfrontasi berbahaya)
2. Cabang Plot Twist / Misteri (Pengungkapan rahasia mengejutkan, penemuan artefak, atau pengkhianatan)
3. Cabang Emosional / Karakter (Perkembangan hubungan tokoh, dilema moral batin, atau penyelaman lore mendalam)

Berikan output HANYA berupa JSON array valid persis dengan struktur ini:
[
  {
    "title": "Judul Bab Berikutnya yang Menarik",
    "premise": "Sinopsis/premis 2-3 kalimat mengenai apa yang akan terjadi di bab baru ini...",
    "hook": "Adegan pembuka yang memikat pembaca di paragraf pertama bab baru...",
    "intensity": "Tinggi (Aksi/Konflik)",
    "rationale": "Mengapa cabang ini seru untuk kelanjutan cerita..."
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
      rationale: 'Menjaga tempo ketegangan agar pembaca tidak kehilangan antusiasme.',
    },
    {
      id: 'branch_fallback_2',
      title: 'Rahasia di Balik Tabir',
      premise: 'Petunjuk tersembunyi yang tertinggal membongkar kebohongan salah satu pihak terdekat.',
      hook: 'Sebuah dokumen usang dengan cap segel merah tergeletak di tempat yang tak semestinya.',
      intensity: 'Misteri (Plot Twist)',
      rationale: 'Memicu rasa ingin tahu pembaca dengan teka-teki baru.',
    },
    {
      id: 'branch_fallback_3',
      title: 'Di Persimpangan Jalan',
      premise: 'Dilema moral memaksa tokoh utama merenungi kembali tujuan awalnya sebelum terlambat.',
      hook: 'Bayangan masa lalu kembali menghantui saat tatapan mata itu menuntut kepastian.',
      intensity: 'Emosional (Drama)',
      rationale: 'Memberi ruang bernapas untuk memperdalam kedalaman emosional karakter.',
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
  const mappedEntities = Array.isArray(parsed.mappedEntities) ? parsed.mappedEntities : [];

  return {
    factions,
    mappedEntities,
  };
}
