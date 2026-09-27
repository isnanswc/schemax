import React, { useState, useEffect } from 'react';
import {
  X,
  Shield,
  Eye,
  EyeOff,
  Sparkles,
  HardDrive,
  Moon,
  Sun,
  Laptop,
  Check,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  FileText,
  Bookmark,
  Scroll,
  Lock,
  KeyRound
} from 'lucide-react';
import { usePrivacy } from '../../contexts/PrivacyContext';
import { useSecurity } from '../../contexts/SecurityContext';
import { ThemeMode, getStoredThemeMode, applyTheme } from '../../services/themeService';

interface AppCornerMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAISettings: () => void;
  onOpenSyncModal: () => void;
  onOpenPinSetup: () => void;
}

export const AppCornerMenuModal: React.FC<AppCornerMenuModalProps> = ({
  isOpen,
  onClose,
  onOpenAISettings,
  onOpenSyncModal,
  onOpenPinSetup,
}) => {
  const { settings, updateSettings, togglePrivacyMode } = usePrivacy();
  const { settings: secSettings, lockApp } = useSecurity();
  const [showPrivacyDetails, setShowPrivacyDetails] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<ThemeMode>(() => getStoredThemeMode());

  // Synchronize currentTheme whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentTheme(getStoredThemeMode());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSetTheme = (theme: ThemeMode) => {
    setCurrentTheme(theme);
    applyTheme(theme);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-end p-3 sm:p-5 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xs mt-12 max-h-[calc(100vh-4rem)] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200 text-slate-900 dark:text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-amber-500/15 text-amber-500 font-bold">
              <Shield className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                Menu Pengaturan
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Privasi, AI, Tema &amp; Sinkronisasi
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 1. Mode Privasi (Privacy Mode) Section */}
        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {settings.privacyMode ? (
                <EyeOff className="w-4 h-4 text-emerald-500 animate-pulse" />
              ) : (
                <Eye className="w-4 h-4 text-slate-400" />
              )}
              <div>
                <span className="text-xs font-bold block leading-tight">
                  Mode Privasi
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  {settings.privacyMode ? 'Aktif (Konten Disamarkan)' : 'Nonaktif'}
                </span>
              </div>
            </div>

            {/* Switch Toggle */}
            <button
              type="button"
              onClick={togglePrivacyMode}
              className={`w-11 h-6 rounded-full transition-colors relative p-0.5 focus:outline-none ${
                settings.privacyMode ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                  settings.privacyMode ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Granular Settings Dropdown */}
          {settings.privacyMode && (
            <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800/80 space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Pilihan Elemen Blur:
                </span>
                <button
                  type="button"
                  onClick={() => setShowPrivacyDetails(!showPrivacyDetails)}
                  className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-0.5"
                >
                  <span>{showPrivacyDetails ? 'Tutup' : 'Sesuaikan'}</span>
                  {showPrivacyDetails ? (
                    <ChevronUp className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                </button>
              </div>

              {showPrivacyDetails && (
                <div className="space-y-1.5 pt-1">
                  {/* Blur Gambar */}
                  <label className="flex items-center justify-between text-xs cursor-pointer select-none p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900 transition">
                    <span className="flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-pink-500" />
                      <span>Blur Gambar &amp; Sampul</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={settings.blurImages}
                      onChange={(e) => updateSettings({ blurImages: e.target.checked })}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                  </label>

                  {/* Blur Teks Preview / Sinopsis */}
                  <label className="flex items-center justify-between text-xs cursor-pointer select-none p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900 transition">
                    <span className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-cyan-500" />
                      <span>Blur Teks Sinopsis &amp; Naskah</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={settings.blurText}
                      onChange={(e) => updateSettings({ blurText: e.target.checked })}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                  </label>

                  {/* Blur Judul */}
                  <label className="flex items-center justify-between text-xs cursor-pointer select-none p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900 transition">
                    <span className="flex items-center gap-1.5">
                      <Bookmark className="w-3.5 h-3.5 text-amber-500" />
                      <span>Blur Judul Buku &amp; Bab</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={settings.blurTitles}
                      onChange={(e) => updateSettings({ blurTitles: e.target.checked })}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                  </label>

                  {/* Blur Glosarium */}
                  <label className="flex items-center justify-between text-xs cursor-pointer select-none p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900 transition">
                    <span className="flex items-center gap-1.5">
                      <Scroll className="w-3.5 h-3.5 text-purple-500" />
                      <span>Blur Ensiklopedia / Glosarium</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={settings.blurGlossary}
                      onChange={(e) => updateSettings({ blurGlossary: e.target.checked })}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                  </label>
                </div>
              )}

              <p className="text-[10px] text-slate-500 dark:text-slate-400 italic bg-amber-500/10 dark:bg-amber-500/5 p-2 rounded-xl border border-amber-500/20">
                💡 <strong>Tips:</strong> Buka gambar ke mode fullscreen lalu tekan &amp; tahan layarnya untuk melihat tanpa blur.
              </p>
            </div>
          )}
        </div>

        {/* 2. Keamanan Kunci PIN & Auto-Lock */}
        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`p-1.5 rounded-xl ${secSettings.isPinEnabled ? 'bg-amber-500/15 text-amber-500' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'}`}>
                <Lock className="w-4 h-4" />
              </span>
              <div>
                <span className="text-xs font-bold block leading-tight">
                  Kunci PIN &amp; Auto-Lock
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  {secSettings.isPinEnabled
                    ? `Aktif (Auto-Lock ${
                        secSettings.autoLockSeconds === 30 ? '30 Dtk' :
                        secSettings.autoLockSeconds === 60 ? '1 Mnt' :
                        secSettings.autoLockSeconds === 180 ? '3 Mnt' :
                        secSettings.autoLockSeconds === 300 ? '5 Mnt' :
                        `${secSettings.autoLockSeconds}d`
                      })`
                    : 'Nonaktif'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenPinSetup();
              }}
              className="py-1 px-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] transition shadow-xs active:scale-95"
            >
              {secSettings.isPinEnabled ? 'Atur' : 'Aktifkan'}
            </button>
          </div>

          {secSettings.isPinEnabled && (
            <button
              type="button"
              onClick={() => {
                onClose();
                lockApp();
              }}
              className="w-full py-1.5 px-3 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-bold text-[11px] flex items-center justify-center gap-1.5 transition active:scale-95"
            >
              <KeyRound className="w-3.5 h-3.5 text-amber-500" />
              <span>Kunci Aplikasi Sekarang</span>
            </button>
          )}
        </div>

        {/* 3. Tema Tampilan (Light, Dark, Auto) */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Tema Tampilan:
          </span>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { id: 'light', label: 'Terang', icon: Sun },
              { id: 'dark', label: 'Gelap', icon: Moon },
              { id: 'auto', label: 'Sistem', icon: Laptop },
            ].map((t) => {
              const Icon = t.icon;
              const isActive = currentTheme === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleSetTheme(t.id as any)}
                  className={`py-1.5 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 active:scale-95 ${
                    isActive
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Action Buttons: Multi-AI & Simpan/IndexedDB */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
          {/* AI Settings Button */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenAISettings();
            }}
            className="w-full py-2 px-3 rounded-2xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 border border-amber-200 dark:border-amber-500/30 text-amber-900 dark:text-amber-300 text-xs font-bold transition flex items-center justify-between active:scale-98 shadow-xs"
          >
            <span className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Pengaturan Multi-AI</span>
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 font-mono">
              Gemini &amp; Groq
            </span>
          </button>

          {/* Sync / IndexedDB Button */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenSyncModal();
            }}
            className="w-full py-2 px-3 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition flex items-center justify-between active:scale-98 shadow-xs"
          >
            <span className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-emerald-500" />
              <span>Simpan &amp; Cadangan (IndexedDB)</span>
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </button>
        </div>
      </div>
    </div>
  );
};
