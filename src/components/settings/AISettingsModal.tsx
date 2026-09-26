import React, { useState, useEffect } from 'react';
import {
  AIProviderType,
  AIKeySlot,
  AISettingsConfig,
  AIModelOption,
} from '../../types/ai';
import {
  loadAISettings,
  saveAISettings,
  calculateSlotHealth,
  testSlotConnection,
  fetchLiveGeminiModels,
  fetchLiveGroqModels,
} from '../../services/aiService';
import {
  X,
  Sparkles,
  Key,
  ShieldCheck,
  AlertTriangle,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle2,
  RefreshCw,
  Cpu,
  Layers,
  Zap,
  Info,
  DownloadCloud
} from 'lucide-react';

interface AISettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export const AISettingsModal: React.FC<AISettingsModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const [config, setConfig] = useState<AISettingsConfig>(loadAISettings());
  const [activeTab, setActiveTab] = useState<AIProviderType>('gemini');
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const [testingSlotId, setTestingSlotId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [fetchModelNotice, setFetchModelNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setConfig(loadAISettings());
      setTestResults({});
      setFetchModelNotice(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentSlots = config.slots.filter((s) => s.provider === activeTab);
  const currentGlobalConfig = activeTab === 'gemini' ? config.geminiConfig : config.groqConfig;

  const toggleKeyVisibility = (slotId: string) => {
    setVisibleKeys((prev) => ({ ...prev, [slotId]: !prev[slotId] }));
  };

  const handleUpdateSlot = (slotId: string, updates: Partial<AIKeySlot>) => {
    setConfig((prev) => {
      const updatedSlots = prev.slots.map((s) => (s.id === slotId ? { ...s, ...updates } : s));
      const newConfig = { ...prev, slots: updatedSlots };
      saveAISettings(newConfig);
      return newConfig;
    });
  };

  const handleUpdateGlobalModel = (modelIndex: 0 | 1 | 2, modelId: string) => {
    setConfig((prev) => {
      const targetConfig = activeTab === 'gemini' ? { ...prev.geminiConfig } : { ...prev.groqConfig };
      const newFallback = [...targetConfig.fallbackModels] as [string, string, string];
      newFallback[modelIndex] = modelId;
      targetConfig.fallbackModels = newFallback;

      const newConfig = {
        ...prev,
        [activeTab === 'gemini' ? 'geminiConfig' : 'groqConfig']: targetConfig,
      };
      saveAISettings(newConfig);
      return newConfig;
    });
  };

  // Fetch live models directly from Gemini or Groq API
  const handleFetchLiveModels = async () => {
    // Find the first slot that has an API key
    const availableKeySlot = currentSlots.find((s) => s.apiKey && s.apiKey.trim().length > 0);
    if (!availableKeySlot) {
      alert(`Silakan masukkan minimal 1 API Key ${activeTab === 'gemini' ? 'Gemini' : 'Groq'} terlebih dahulu untuk mengambil daftar model terbaru dari server.`);
      return;
    }

    setIsFetchingModels(true);
    setFetchModelNotice(null);

    try {
      let liveModels: AIModelOption[] = [];
      if (activeTab === 'gemini') {
        liveModels = await fetchLiveGeminiModels(availableKeySlot.apiKey);
      } else {
        liveModels = await fetchLiveGroqModels(availableKeySlot.apiKey);
      }

      setConfig((prev) => {
        const targetConfig = activeTab === 'gemini' ? { ...prev.geminiConfig } : { ...prev.groqConfig };
        targetConfig.cachedModels = liveModels;
        targetConfig.lastFetchedAt = Date.now();

        // If current fallback models are not in the new list, pick top 3 available
        const availableIds = liveModels.map((m) => m.id);
        const newFallbacks: [string, string, string] = [
          targetConfig.fallbackModels[0] && availableIds.includes(targetConfig.fallbackModels[0])
            ? targetConfig.fallbackModels[0]
            : '',
          targetConfig.fallbackModels[1] && availableIds.includes(targetConfig.fallbackModels[1])
            ? targetConfig.fallbackModels[1]
            : '',
          targetConfig.fallbackModels[2] && availableIds.includes(targetConfig.fallbackModels[2])
            ? targetConfig.fallbackModels[2]
            : '',
        ];
        targetConfig.fallbackModels = newFallbacks;

        const newConfig = {
          ...prev,
          [activeTab === 'gemini' ? 'geminiConfig' : 'groqConfig']: targetConfig,
        };
        saveAISettings(newConfig);
        return newConfig;
      });

      setFetchModelNotice(`✅ Berhasil menyinkronkan ${liveModels.length} model terbaru dari API!`);
      setTimeout(() => setFetchModelNotice(null), 4000);
    } catch (err: any) {
      setFetchModelNotice(`❌ Gagal mengambil model: ${err?.message || 'Periksa API Key Anda.'}`);
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleAddSlot = (provider: AIProviderType) => {
    const existingCount = config.slots.filter((s) => s.provider === provider).length;
    const newSlot: AIKeySlot = {
      id: `slot_${provider}_${Date.now()}`,
      provider: provider,
      label: `${provider === 'gemini' ? 'Gemini' : 'Groq'} Key ${existingCount + 1}`,
      apiKey: '',
      isActive: true,
      stats: {
        totalRequests: 0,
        successRequests: 0,
        failedRequests: 0,
        consecutiveFailures: 0,
      },
    };

    const newConfig = { ...config, slots: [...config.slots, newSlot] };
    setConfig(newConfig);
    saveAISettings(newConfig);
  };

  const handleDeleteSlot = (slotId: string) => {
    if (confirm('Hapus slot API Key ini?')) {
      const newConfig = {
        ...config,
        slots: config.slots.filter((s) => s.id !== slotId),
      };
      setConfig(newConfig);
      saveAISettings(newConfig);
    }
  };

  const handleToggleSmartAdjust = () => {
    const newConfig = { ...config, smartAdjustEnabled: !config.smartAdjustEnabled };
    setConfig(newConfig);
    saveAISettings(newConfig);
  };

  const handleTestConnection = async (slot: AIKeySlot) => {
    if (!slot.apiKey || !slot.apiKey.trim()) {
      alert('Silakan masukkan API Key terlebih dahulu sebelum tes.');
      return;
    }

    setTestingSlotId(slot.id);
    const primaryModel = currentGlobalConfig.fallbackModels[0];
    const result = await testSlotConnection(slot, primaryModel);
    setTestingSlotId(null);

    setTestResults((prev) => ({
      ...prev,
      [slot.id]: {
        success: result.success,
        message: result.message,
      },
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Dim Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Main Settings Modal Box */}
      <div className="relative w-full sm:max-w-2xl bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl z-10 max-h-[92vh] flex flex-col animate-in slide-in-from-bottom duration-250 safe-bottom">
        {/* Mobile Swipe Handle */}
        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700/80 rounded-full mx-auto mt-3 mb-1 sm:hidden flex-shrink-0" />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950/60 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 shadow-md shadow-amber-500/20 font-black">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Pengaturan Multi-AI</h3>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                  Global Fallback
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Model API Live & Smart Adjust Cascading Fallback
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 no-scrollbar">
          {/* Smart Adjust Feature Card */}
          <div className="bg-gradient-to-r from-amber-500/10 via-amber-50/50 dark:via-slate-900 to-indigo-500/10 border border-amber-300/80 dark:border-amber-500/20 rounded-2xl p-3.5 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-400">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>Smart Adjust Prioritizer</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  </h4>
                  <p className="text-[10px] sm:text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
                    Otomatis mendahulukan API Slot & Model yang terbukti berhasil & stabil.
                  </p>
                </div>
              </div>

              {/* Toggle Switch */}
              <button
                type="button"
                onClick={handleToggleSmartAdjust}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  config.smartAdjustEnabled ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    config.smartAdjustEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Provider Selection Tabs */}
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-950/70 p-1 rounded-2xl border border-slate-200 dark:border-slate-800/80">
            <button
              onClick={() => setActiveTab('gemini')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition active:scale-95 ${
                activeTab === 'gemini'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Cpu className="w-4 h-4" />
              <span>Google Gemini</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-slate-950/20 text-slate-900 dark:text-amber-950">
                {config.slots.filter((s) => s.provider === 'gemini').length} Key
              </span>
            </button>

            <button
              onClick={() => setActiveTab('groq')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition active:scale-95 ${
                activeTab === 'groq'
                  ? 'bg-indigo-600 dark:bg-indigo-500 text-white shadow-md shadow-indigo-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Zap className="w-4 h-4" />
              <span>Groq Cloud</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-slate-950/20 text-white dark:text-indigo-200">
                {config.slots.filter((s) => s.provider === 'groq').length} Key
              </span>
            </button>
          </div>

          {/* 🌟 Global 3 Fallback Models Card (Applied to ALL keys of this provider) */}
          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800/80 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white">
                    3 Model Fallback {activeTab === 'gemini' ? 'Gemini' : 'Groq'} (Global)
                  </h4>
                  <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    Otomatis untuk Semua Slot
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Atur sekali di sini, otomatis berlaku untuk seluruh API Key {activeTab === 'gemini' ? 'Gemini' : 'Groq'}.
                </p>
              </div>

              {/* Sync Live Models Button */}
              <button
                type="button"
                onClick={handleFetchLiveModels}
                disabled={isFetchingModels}
                className="inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-amber-700 dark:text-amber-300 font-bold text-xs transition active:scale-95 border border-slate-200 dark:border-slate-700 disabled:opacity-50 flex-shrink-0 shadow-sm"
              >
                {isFetchingModels ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-500" />
                    <span>Menghubungi API...</span>
                  </>
                ) : (
                  <>
                    <DownloadCloud className="w-3.5 h-3.5 text-amber-500" />
                    <span>Muat Model Live dari API</span>
                  </>
                )}
              </button>
            </div>

            {/* Notice banner after fetching */}
            {fetchModelNotice && (
              <div className="p-2.5 bg-amber-50 dark:bg-slate-900 border border-amber-200 dark:border-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-200 animate-in fade-in">
                {fetchModelNotice}
              </div>
            )}

            {/* 3 Fallback Dropdowns */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              {/* 1. Model Utama */}
              <div>
                <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold uppercase tracking-wider block mb-1">
                  1. Model Utama
                </span>
                <select
                  value={currentGlobalConfig.fallbackModels[0] || ''}
                  onChange={(e) => handleUpdateGlobalModel(0, e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 text-xs text-amber-800 dark:text-amber-300 font-bold focus:outline-none focus:border-amber-400 shadow-sm"
                >
                  <option value="">-- Pilih Model Utama --</option>
                  {currentGlobalConfig.cachedModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Model Cadangan 1 */}
              <div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider block mb-1">
                  2. Cadangan 1 (Jika Limit)
                </span>
                <select
                  value={currentGlobalConfig.fallbackModels[1] || ''}
                  onChange={(e) => handleUpdateGlobalModel(1, e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-amber-400 shadow-sm"
                >
                  <option value="">-- Nonaktif (Opsional) --</option>
                  {currentGlobalConfig.cachedModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 3. Model Cadangan 2 */}
              <div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider block mb-1">
                  3. Cadangan 2
                </span>
                <select
                  value={currentGlobalConfig.fallbackModels[2] || ''}
                  onChange={(e) => handleUpdateGlobalModel(2, e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-amber-400 shadow-sm"
                >
                  <option value="">-- Nonaktif (Opsional) --</option>
                  {currentGlobalConfig.cachedModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
              <span>{currentGlobalConfig.cachedModels.length} model siap digunakan</span>
              {currentGlobalConfig.lastFetchedAt && (
                <span>
                  Disinkronkan: {new Date(currentGlobalConfig.lastFetchedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          </div>

          {/* Slots List (Simplified: Only Label, Key & Health) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Daftar Slot API Key ({currentSlots.length})
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                Cascading: Jika satu API gagal, otomatis lompat ke API berikutnya.
              </span>
            </div>

            {currentSlots.length === 0 ? (
              <div className="text-center py-8 px-4 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl bg-slate-50 dark:bg-slate-950/40">
                <Key className="w-8 h-8 mx-auto text-slate-400 dark:text-slate-600 mb-2" />
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                  Belum ada slot API Key untuk {activeTab === 'gemini' ? 'Gemini' : 'Groq'}.
                </p>
                <button
                  onClick={() => handleAddSlot(activeTab)}
                  className="inline-flex items-center gap-1.5 py-2 px-3.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-xs font-semibold shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Slot Pertama</span>
                </button>
              </div>
            ) : (
              currentSlots.map((slot) => {
                const health = calculateSlotHealth(slot);
                const testResult = testResults[slot.id];
                const isTesting = testingSlotId === slot.id;

                const healthBadge = {
                  healthy: {
                    label: `Stabil (${health.percentage}%)`,
                    class: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
                    dot: 'bg-emerald-500',
                  },
                  degraded: {
                    label: `Terdegradasi (${health.percentage}%)`,
                    class: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30',
                    dot: 'bg-amber-500',
                  },
                  failing: {
                    label: `Gagal / Limit (${health.percentage}%)`,
                    class: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30',
                    dot: 'bg-red-500',
                  },
                  untested: {
                    label: 'Siap',
                    class: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700',
                    dot: 'bg-slate-400',
                  },
                }[health.status];

                return (
                  <div
                    key={slot.id}
                    className="bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 space-y-2.5 shadow-sm"
                  >
                    {/* Slot Name & Status */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <input
                          type="text"
                          value={slot.label}
                          onChange={(e) => handleUpdateSlot(slot.id, { label: e.target.value })}
                          className="bg-transparent font-bold text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-b border-amber-400 truncate max-w-[150px] sm:max-w-xs"
                          placeholder="Label Akun..."
                        />
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${healthBadge.class}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${healthBadge.dot}`} />
                          <span>{healthBadge.label}</span>
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleUpdateSlot(slot.id, { isActive: !slot.isActive })}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition ${
                            slot.isActive
                              ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-500/40'
                              : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-500 border-slate-300 dark:border-slate-700'
                          }`}
                        >
                          {slot.isActive ? 'Aktif' : 'Nonaktif'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteSlot(slot.id)}
                          className="p-1 rounded-lg text-slate-400 hover:text-red-500 transition"
                          title="Hapus Slot"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* API Key Input */}
                    <div className="relative">
                      <input
                        type={visibleKeys[slot.id] ? 'text' : 'password'}
                        value={slot.apiKey}
                        onChange={(e) => handleUpdateSlot(slot.id, { apiKey: e.target.value })}
                        placeholder={
                          activeTab === 'gemini'
                            ? 'Tempel Gemini API Key (AIzaSy...)'
                            : 'Tempel Groq API Key (gsk_...)'
                        }
                        className="w-full pl-3 pr-24 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-amber-400 font-mono shadow-sm"
                      />

                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => toggleKeyVisibility(slot.id)}
                          className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1"
                          title="Lihat/Sembunyikan"
                        >
                          {visibleKeys[slot.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>

                        {/* Fast Test Button */}
                        <button
                          type="button"
                          onClick={() => handleTestConnection(slot)}
                          disabled={isTesting || !slot.apiKey}
                          className="py-1 px-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-amber-700 dark:text-amber-300 font-bold text-[10px] transition active:scale-95 disabled:opacity-40 border border-slate-200 dark:border-slate-700"
                        >
                          {isTesting ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'Tes'}
                        </button>
                      </div>
                    </div>

                    {/* Test Result Message */}
                    {testResult && (
                      <div
                        className={`p-2 rounded-xl text-[11px] flex items-center gap-1.5 animate-in fade-in ${
                          testResult.success
                            ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30'
                            : 'bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/30'
                        }`}
                      >
                        {testResult.success ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-400 flex-shrink-0" />
                        )}
                        <span className="truncate">{testResult.message}</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* Add Slot Button */}
            <button
              type="button"
              onClick={() => handleAddSlot(activeTab)}
              className="w-full py-2.5 px-4 rounded-2xl bg-white dark:bg-slate-950 border border-dashed border-slate-300 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-semibold text-xs transition active:scale-[0.99] flex items-center justify-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4 text-amber-500" />
              <span>Tambah Slot API Key {activeTab === 'gemini' ? 'Gemini' : 'Groq'} Baru</span>
            </button>
          </div>
        </div>

        {/* Modal Bottom Sticky Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between gap-3 flex-shrink-0">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            🔒 Disimpan lokal di browser Anda
          </div>

          <button
            type="button"
            onClick={() => {
              saveAISettings(config);
              onSaved?.();
              onClose();
            }}
            className="py-2.5 px-6 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-xs shadow-lg shadow-amber-500/20 active:scale-95 transition"
          >
            Selesai & Simpan
          </button>
        </div>
      </div>
    </div>
  );
};
