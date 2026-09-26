import React, { useState, useEffect } from 'react';
import { X, Key, ShieldCheck, Info, Check, Cloud, Cpu, Sparkles, ExternalLink } from 'lucide-react';
import {
  TTSExtraConfig,
  loadTTSExtraConfig,
  saveTTSExtraConfig
} from '../../../services/geminiTtsService';

interface TTSConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export const TTSConfigModal: React.FC<TTSConfigModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const [config, setConfig] = useState<TTSExtraConfig>(loadTTSExtraConfig());
  const [showSavedFeedback, setShowSavedFeedback] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setConfig(loadTTSExtraConfig());
      setShowSavedFeedback(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveTTSExtraConfig(config);
    setShowSavedFeedback(true);
    if (onSaved) onSaved();
    setTimeout(() => {
      setShowSavedFeedback(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Key className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Pengaturan Kunci AI TTS Mandiri
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Terpisah 100% dari kuota Gemini Studio Anda
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSave} className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
          {/* Info Banner */}
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed text-slate-700 dark:text-slate-300">
              <span className="font-bold text-slate-900 dark:text-slate-100 block">
                Hemat Kuota Menulis Anda!
              </span>
              Memasukkan kunci Azure Speech atau Google Cloud di sini membuat pembacaan naskah di HP tidak menyedot kuota Gemini sama sekali. Jika dikosongkan, sistem otomatis menggunakan mesin <strong>WASM / Mobile Free</strong> (100% gratis tanpa kuota).
            </div>
          </div>

          {/* Section 1: Dedicated Gemini Key (100% Gratis Tanpa Billing/Kartu Kredit) */}
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-100">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Google AI Studio (Gemini Khusus TTS)</span>
              </div>
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold">
                100% Free • No Credit Card
              </span>
            </div>

            <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-tight">
              Dapatkan di <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-amber-600 dark:text-amber-400 font-bold underline">aistudio.google.com</a> secara gratis tanpa kartu kredit. Gunakan akun Gmail lain atau API Key terpisah agar <strong>kuota naskah cerita utama Anda 100% aman dan tidak tersedot TTS</strong>.
            </p>

            <div>
              <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                Gemini Dedicated API Key:
              </label>
              <input
                type="password"
                value={config.dedicatedGeminiApiKey}
                onChange={(e) => setConfig({ ...config, dedicatedGeminiApiKey: e.target.value })}
                placeholder="Contoh: AIzaSy... (Khusus TTS)"
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono focus:outline-hidden focus:border-amber-500"
              />
            </div>
          </div>

          {/* Section 2: Microsoft Azure Speech (F0 Tier) */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                <Cloud className="w-3.5 h-3.5 text-blue-500" />
                <span>Microsoft Azure Speech (F0 Free Tier)</span>
              </div>
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 font-bold">
                Butuh Akun Azure
              </span>
            </div>

            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
              Suara paling alami di dunia: <strong>Gadis &amp; Ardi (Neural)</strong>. <em>Catatan: Azure membutuhkan akun portal.azure.com (memerlukan billing/kartu saat mendaftar).</em>
            </p>

            <div className="space-y-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Azure Subscription Key:
                </label>
                <input
                  type="password"
                  value={config.azureApiKey}
                  onChange={(e) => setConfig({ ...config, azureApiKey: e.target.value })}
                  placeholder="Contoh: 8a4b3c2d1e... (Opsional)"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Azure Region:
                </label>
                <select
                  value={config.azureRegion}
                  onChange={(e) => setConfig({ ...config, azureRegion: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs focus:outline-hidden focus:border-amber-500"
                >
                  <option value="southeastasia">southeastasia (Singapura - Tercepat)</option>
                  <option value="eastasia">eastasia (Hong Kong)</option>
                  <option value="eastus">eastus (US East)</option>
                  <option value="westeurope">westeurope (Eropa Barat)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Google Cloud Text-to-Speech */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                <Cpu className="w-3.5 h-3.5 text-rose-500" />
                <span>Google Cloud TTS (Neural2 / WaveNet)</span>
              </div>
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold">
                Butuh Cloud Billing
              </span>
            </div>

            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
              Layanan TTS resmi Google Cloud (console.cloud.google.com). <em>Catatan: Memerlukan penautan billing Google Cloud untuk aktivasi.</em>
            </p>

            <div>
              <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                Google Cloud API Key:
              </label>
              <input
                type="password"
                value={config.googleCloudApiKey}
                onChange={(e) => setConfig({ ...config, googleCloudApiKey: e.target.value })}
                placeholder="Contoh: AIzaSy... (Opsional)"
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono focus:outline-hidden focus:border-amber-500"
              />
            </div>
          </div>

          {/* Section 4: WASM Mobile Free */}
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
            <div className="text-[10px] leading-tight text-emerald-800 dark:text-emerald-200">
              <span className="font-bold block text-[11px]">WASM / Mobile Free (Bebas Kuota &amp; Tanpa Kunci):</span>
              Jika kunci di atas dikosongkan, Schemax menggunakan audio gateway bebas kuota dengan pemecah kalimat cerdas. 100% gratis, aman, dan tanpa limit di HP.
            </div>
          </div>

          {/* Submit buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs"
            >
              Tutup
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 active:scale-95 transition flex items-center gap-1.5"
            >
              {showSavedFeedback ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Tersimpan!</span>
                </>
              ) : (
                <span>Simpan Pengaturan</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
