import React, { useState, useEffect } from 'react';
import { X, HardDrive, Check, AlertCircle, RefreshCw, Key, Folder, ExternalLink, Sparkles } from 'lucide-react';
import {
  loadGDriveConfig,
  saveGDriveConfig,
  extractGDriveFolderId,
  testAndFetchGDriveFolder,
  getEffectiveGoogleApiKey
} from '../../services/gdriveService';

interface GDriveSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export const GDriveSettingsModal: React.FC<GDriveSettingsModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const [folderUrl, setFolderUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [folderInfo, setFolderInfo] = useState<{ name: string; fileCount: number } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [testSuccess, setTestSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const config = loadGDriveConfig();
      setFolderUrl(config.folderUrl || (config.folderId ? `https://drive.google.com/drive/folders/${config.folderId}` : ''));
      setApiKey(config.apiKey || '');
      setTestError(null);
      setTestSuccess(null);
      if (config.folderName) {
        setFolderInfo({ name: config.folderName, fileCount: 0 });
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const effectiveKey = apiKey.trim() || getEffectiveGoogleApiKey();

  const handleTestConnection = async () => {
    setTestError(null);
    setTestSuccess(null);

    const folderId = extractGDriveFolderId(folderUrl);
    if (!folderId) {
      setTestError('Format URL folder Google Drive tidak valid. Salin link share folder dari Google Drive Anda.');
      return;
    }

    if (!effectiveKey) {
      setTestError('Google Cloud API Key belum dimasukkan.');
      return;
    }

    setIsTesting(true);
    try {
      const result = await testAndFetchGDriveFolder(folderId, effectiveKey);
      setFolderInfo(result);
      setTestSuccess(`Berhasil terhubung ke folder "${result.name}" (${result.fileCount} item terdeteksi)!`);
    } catch (err: any) {
      setTestError(err?.message || 'Gagal membaca folder Google Drive.');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    const folderId = extractGDriveFolderId(folderUrl);
    const config = {
      folderUrl: folderUrl.trim(),
      folderId: folderId || undefined,
      folderName: folderInfo?.name,
      apiKey: apiKey.trim() || undefined,
      lastSyncedAt: Date.now(),
    };
    saveGDriveConfig(config);
    onSaved?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 font-bold">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white leading-tight">
                Hubungkan Folder Google Drive
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Akses semua gambar &amp; subfolder tanpa login OAuth
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

        {/* Form Body */}
        <div className="p-5 space-y-4 overflow-y-auto max-h-[75vh]">
          {/* Guide Banner */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-50/40 dark:via-slate-950 to-indigo-500/10 border border-amber-300/80 dark:border-amber-500/20 text-xs text-slate-700 dark:text-slate-300 space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
              <Sparkles className="w-4 h-4" />
              <span>Cara Menyiapkan Folder Google Drive:</span>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
              <li>Buat 1 folder di Google Drive Anda (misal: <strong>Aset Novel</strong>).</li>
              <li>Klik kanan folder tersebut &rarr; <strong>Share / Bagikan</strong>.</li>
              <li>Ubah akses menjadi: <strong>"Anyone with the link can view"</strong> (Siapa saja dengan link dapat melihat).</li>
              <li>Salin link folder tersebut dan tempelkan di bawah ini.</li>
            </ol>
          </div>

          {/* Folder URL Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Link Folder Google Drive *
            </label>
            <div className="relative">
              <Folder className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={folderUrl}
                onChange={(e) => setFolderUrl(e.target.value)}
                placeholder="https://drive.google.com/drive/folders/1ABC_xyz..."
                className="w-full pl-10 pr-3 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-400 font-mono shadow-sm"
              />
            </div>
          </div>

          {/* Optional API Key Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Google Cloud API Key (Opsional)
              </label>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                {apiKey ? 'Key Khusus GDrive' : getEffectiveGoogleApiKey() ? '✓ Otomatis dari Slot Gemini' : 'Perlu API Key'}
              </span>
            </div>
            <div className="relative">
              <Key className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={getEffectiveGoogleApiKey() ? 'Menggunakan API Key Google Gemini bawaan' : 'Tempel Google API Key (AIzaSy...)'}
                className="w-full pl-10 pr-3 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-400 font-mono shadow-sm"
              />
            </div>
            <p className="text-[10px] text-slate-500">
              Jika dikosongkan, Schemax akan otomatis menggunakan API Key Gemini Anda yang sudah ada di Pengaturan AI.
            </p>
          </div>

          {/* Test Status Alerts */}
          {testError && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <span>{testError}</span>
            </div>
          )}

          {testSuccess && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
              <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
              <span>{testSuccess}</span>
            </div>
          )}

          {/* Action: Test Connection */}
          <div className="pt-1">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting || !folderUrl.trim()}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition flex items-center justify-center gap-2 disabled:opacity-40 border border-slate-200 dark:border-slate-700"
            >
              {isTesting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
                  <span>Mengecek Folder Google Drive...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 text-amber-500" />
                  <span>Uji Akses &amp; Cek Folder</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="py-2 px-4 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 font-semibold text-xs transition"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={!folderUrl.trim()}
            className="py-2.5 px-6 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-extrabold text-xs shadow-md shadow-amber-500/20 active:scale-95 transition disabled:opacity-50 flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>Simpan Pengaturan</span>
          </button>
        </div>

      </div>
    </div>
  );
};
