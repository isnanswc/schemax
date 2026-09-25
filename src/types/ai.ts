export type AIProviderType = 'gemini' | 'groq';

export interface AIModelOption {
  id: string;
  name: string;
  description: string;
}

export interface AISlotStats {
  totalRequests: number;
  successRequests: number;
  failedRequests: number;
  consecutiveFailures: number;
  lastUsedAt?: number;
  lastSuccessAt?: number;
  lastError?: string;
  avgLatencyMs?: number;
}

export interface AIKeySlot {
  id: string;
  provider: AIProviderType;
  label: string;
  apiKey: string;
  models?: [string, string, string]; // Optional per-slot override, defaults to provider global
  isActive: boolean;
  stats: AISlotStats;
}

export interface AIProviderGlobalConfig {
  fallbackModels: [string, string, string]; // 3 models applied across all API keys of this provider
  cachedModels: AIModelOption[];
  lastFetchedAt?: number;
}

export interface AISettingsConfig {
  smartAdjustEnabled: boolean;
  providerPriority: AIProviderType[];
  geminiConfig: AIProviderGlobalConfig;
  groqConfig: AIProviderGlobalConfig;
  slots: AIKeySlot[];
}

export interface AIGenerationEvent {
  provider: AIProviderType;
  slotLabel: string;
  model: string;
  status: 'attempt' | 'success' | 'fallback' | 'failed';
  error?: string;
  latencyMs?: number;
}

export interface AIGenerateResult {
  text: string;
  provider: AIProviderType;
  slotLabel: string;
  model: string;
  attempts: AIGenerationEvent[];
}
