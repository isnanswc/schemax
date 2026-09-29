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
  const [scriptUrl, setScriptUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [folderInfo, setFolderInfo] = useState<{ name: string; fileCount: number } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [testSuccess, setTestSuccess] = useState<string | null>(null);
  const [showScriptGuide, setShowScriptGuide] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const config = loadGDriveConfig();
      setFolderUrl(config.folderUrl || (config.folderId ? `https://drive.google.com/drive/folders/${config.folderId}` : ''));
      setScriptUrl(config.scriptUrl || '');
      setApiKey(config.apiKey || '');
      setTestError(null);
      setTestSuccess(null);
      if (config.folderName) {
        setFolderInfo({ name: config.folderName, fileCount: 0 });
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const effectiveCredential = scriptUrl.trim() || apiKey.trim() || getEffectiveGoogleApiKey();

  const handleTestConnection = async () => {
    setTestError(null);
    setTestSuccess(null);

    const folderId = extractGDriveFolderId(folderUrl);
    if (!folderId) {
      setTestError('Format URL folder Google Drive tidak valid. Salin link share folder dari Google Drive Anda.');
      return;
    }

    if (!effectiveCredential) {
      setTestError('Masukkan Google Apps Script Web App URL atau Google Cloud API Key.');
      return;
    }

    setIsTesting(true);
    try {
      const result = await testAndFetchGDriveFolder(folderId, effectiveCredential);
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
      scriptUrl: scriptUrl.trim() || undefined,
      apiKey: apiKey.trim() || undefined,
      lastSyncedAt: Date.now(),
    };
    saveGDriveConfig(config);
    onSaved?.();
    onClose();
  };

  const sampleAppsScriptCode = `function doGet(e) {
  var folderId = e.parameter.folderId;
  if (!folderId) {
    return ContentService.createTextOutput(JSON.stringify({error: "folderId required"}))
      .setMimeType(ContentService.MimeType.JSON);
  }
  try {
    var folder = DriveApp.getFolderById(folderId);
    var subfolders = folder.getFolders();
    var files = folder.getFiles();
    var result = [];

    while (subfolders.hasNext()) {
      var sf = subfolders.next();
      result.push({
        id: sf.getId(),
        name: sf.getName(),
        mimeType: "application/vnd.google-apps.folder",
        isFolder: true
      });
    }

    while (files.hasNext()) {
      var f = files.next();
      var mime = f.getMimeType();
      if (mime.indexOf("image/") === 0) {
        result.push({
          id: f.getId(),
          name: f.getName(),
          mimeType: mime,
          isFolder: false,
          size: f.getSize()
        });
      }
    }

    return ContentService.createTextOutput(JSON.stringify({
      name: folder.getName(),
      files: result
    })).setMimeType(ContentService.MimeType.JSON);

  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({error: err.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
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
          {/* Method 1: Google Apps Script Web App (Recommended) */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-500/10 via-indigo-50/40 dark:via-slate-950 to-purple-500/10 border border-blue-300/80 dark:border-blue-500/20 text-xs text-slate-700 dark:text-slate-300 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-blue-800 dark:text-blue-300">
                <Sparkles className="w-4 h-4 text-blue-500" />
                <span>Metode 1: Google Script Web App (Rekomendasi Utama)</span>
              </div>
              <button
                type="button"
                onClick={() => setShowScriptGuide((v) => !v)}
                className="text-[11px] font-bold text-blue-600 dark:text-blue-400 underline"
              >
                {showScriptGuide ? 'Tutup Panduan' : 'Lihat Cara Buat (1 Menit)'}
              </button>
            </div>

            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
              Bebas batasan permission &amp; tanpa perlu setup billing Google Cloud. Otomatis membaca folder &amp; semua subfolder Anda.
            </p>

            {showScriptGuide && (
              <div className="pt-2 border-t border-blue-200/60 dark:border-blue-800/60 space-y-2 text-[11px]">
                <ol className="list-decimal list-inside space-y-1 text-slate-600 dark:text-slate-400">
                  <li>Buka <a href="https://script.google.com" target="_blank" rel="noreferrer" className="text-blue-600 underline font-bold">script.google.com</a> &rarr; <strong>New project</strong>.</li>
                  <li>Hapus kode bawaan dan tempel kode berikut:</li>
                </ol>

                <div className="relative">
                  <pre className="p-2.5 bg-slate-900 text-slate-200 rounded-xl font-mono text-[10px] overflow-x-auto max-h-36">
                    {sampleAppsScriptCode}
                  </pre>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(sampleAppsScriptCode);
                      alert('Kode Google Apps Script berhasil disalin!');
                    }}
                    className="absolute top-2 right-2 px-2 py-1 rounded bg-blue-600 text-white font-bold text-[10px]"
                  >
                    Salin Kode
                  </button>
                </div>

                <ol start={3} className="list-decimal list-inside space-y-1 text-slate-600 dark:text-slate-400">
                  <li>Klik <strong>Deploy &rarr; New deployment</strong> &rarr; pilih <strong>Web app</strong>.</li>
                  <li>Set <i>Who has access</i> menjadi: <strong>"Anyone"</strong>.</li>
                  <li>Klik <strong>Deploy</strong> lalu salin <strong>Web app URL</strong>-nya ke kolom di bawah.</li>
                </ol>
              </div>
            )}
          </div>

          {/* Apps Script Web App URL Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Google Apps Script Web App URL
            </label>
            <input
              type="text"
              value={scriptUrl}
              onChange={(e) => setScriptUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/AKfycb.../exec"
              className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-400 font-mono shadow-sm"
            />
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
                className="w-full pl-10 pr-3 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-400 font-mono shadow-sm"
              />
            </div>
            <p className="text-[10px] text-slate-500">
              Pastikan akses folder Google Drive disetel ke <i>"Anyone with the link can view"</i>.
            </p>
          </div>

          {/* Method 2 (Alternative): API Key */}
          <div className="space-y-1.5 pt-1 border-t border-slate-200 dark:border-slate-800">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Metode 2: Google Cloud API Key (Opsional / Alternatif)
            </label>
            <div className="relative">
              <Key className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Hanya diperlukan jika tidak menggunakan Google Apps Script"
                className="w-full pl-10 pr-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-400 font-mono shadow-sm"
              />
            </div>
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
