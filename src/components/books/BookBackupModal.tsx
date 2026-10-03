import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  HardDrive,
  Download,
  Upload,
  Cloud,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  Compass,
  Image as ImageIcon,
  Volume2,
  RefreshCw,
  Copy,
  ArrowRight,
  Database,
  ExternalLink
} from 'lucide-react';
import { Book } from '../../types';
import { db } from '../../db';
import {
  createBookBackupBundle,
  downloadBackupBundleFile,
  readBackupBundleFromFile,
  inspectBackupBundle,
  restoreBookBackupBundle,
  getBackupFileName,
  SchemaxBookBackupBundle,
  BackupPreviewStats,
} from '../../services/bookBackupService';
import {
  loadGDriveConfig,
  uploadBackupToGDrive,
  listBackupFilesFromGDrive,
  fetchBackupContentFromGDrive,
  GDriveBackupItem,
} from '../../services/gdriveService';

interface BookBackupModalProps {
  isOpen: boolean;
  book: Book;
  onClose: () => void;
  onRestoreComplete?: (bookId: string) => void;
  onOpenGDriveSettings?: () => void;
}

export const BookBackupModal: React.FC<BookBackupModalProps> = ({
  isOpen,
  book,
  onClose,
  onRestoreComplete,
  onOpenGDriveSettings,
}) => {
  const [activeTab, setActiveTab] = useState<'backup' | 'restore'>('backup');

  // Stats Buku Saat Ini untuk Tab Backup
  const [bookStats, setBookStats] = useState<{
    chapterCount: number;
    wordCount: number;
    entityCount: number;
    mediaCount: number;
    ttsCount: number;
  }>({
    chapterCount: 0,
    wordCount: 0,
    entityCount: 0,
    mediaCount: 0,
    ttsCount: 0,
  });

  // State Proses Backup
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupProgressMsg, setBackupProgressMsg] = useState('');
  const [backupProgressPercent, setBackupProgressPercent] = useState(0);
  const [backupSuccessMsg, setBackupSuccessMsg] = useState<string | null>(null);
  const [backupErrorMsg, setBackupErrorMsg] = useState<string | null>(null);

  // State Proses Restore
  const [selectedBundle, setSelectedBundle] = useState<SchemaxBookBackupBundle | null>(null);
  const [previewStats, setPreviewStats] = useState<BackupPreviewStats | null>(null);
  const [restoreMode, setRestoreMode] = useState<'overwrite' | 'clone_as_new'>('overwrite');
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreProgressMsg, setRestoreProgressMsg] = useState('');
  const [restoreProgressPercent, setRestoreProgressPercent] = useState(0);
  const [restoreSuccessMsg, setRestoreSuccessMsg] = useState<string | null>(null);
  const [restoreErrorMsg, setRestoreErrorMsg] = useState<string | null>(null);

  // GDrive state
  const [gdriveBackups, setGdriveBackups] = useState<GDriveBackupItem[]>([]);
  const [isLoadingGDriveFiles, setIsLoadingGDriveFiles] = useState(false);
  const [gdriveError, setGdriveError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const gdriveConfig = loadGDriveConfig();
  const isGDriveConfigured = Boolean(gdriveConfig.folderId && (gdriveConfig.scriptUrl || gdriveConfig.apiKey));

  // Muat statistik data buku saat modal dibuka
  useEffect(() => {
    if (isOpen && book?.id) {
      setBackupSuccessMsg(null);
      setBackupErrorMsg(null);
      setRestoreSuccessMsg(null);
      setRestoreErrorMsg(null);
      setSelectedBundle(null);
      setPreviewStats(null);

      const loadStats = async () => {
        const chapters = await db.chapters.where('bookId').equals(book.id).toArray();
        const words = chapters.reduce((sum, c) => sum + (c.wordCount || 0), 0);
        const entities = await db.worldEntities.where('bookId').equals(book.id).toArray();
        const media = await db.media.where('bookId').equals(book.id).toArray();

        const chapterIdSet = new Set(chapters.map((c) => c.id));
        const allTTS = await db.ttsAudioCaches.toArray();
        const bookTTS = allTTS.filter((t) => t.chapterId && chapterIdSet.has(t.chapterId));

        setBookStats({
          chapterCount: chapters.length,
          wordCount: words,
          entityCount: entities.length,
          mediaCount: media.length,
          ttsCount: bookTTS.length,
        });
      };

      loadStats();
    }
  }, [isOpen, book?.id]);

  if (!isOpen) return null;

  // ══════════════════════════════════════════════════════════════
  // AKSI BACKUP: UNDUH LOKAL
  // ══════════════════════════════════════════════════════════════
  const handleDownloadLocalBackup = async () => {
    setIsBackingUp(true);
    setBackupSuccessMsg(null);
    setBackupErrorMsg(null);
    try {
      const bundle = await createBookBackupBundle(book.id, (msg, pct) => {
        setBackupProgressMsg(msg);
        setBackupProgressPercent(pct);
      });
      downloadBackupBundleFile(bundle);
      setBackupSuccessMsg('Berkas cadangan (.schemax.json) berhasil diunduh ke komputer Anda!');
    } catch (err: any) {
      console.error('Gagal unduh cadangan:', err);
      setBackupErrorMsg(err?.message || 'Gagal membuat berkas cadangan.');
    } finally {
      setIsBackingUp(false);
    }
  };

  // ══════════════════════════════════════════════════════════════
  // AKSI BACKUP: SIMPAN KE GOOGLE DRIVE
  // ══════════════════════════════════════════════════════════════
  const handleUploadGDriveBackup = async () => {
    if (!isGDriveConfigured || !gdriveConfig.folderId) {
      onOpenGDriveSettings?.();
      return;
    }

    setIsBackingUp(true);
    setBackupSuccessMsg(null);
    setBackupErrorMsg(null);
    try {
      const bundle = await createBookBackupBundle(book.id, (msg, pct) => {
        setBackupProgressMsg(msg);
        setBackupProgressPercent(pct);
      });

      setBackupProgressMsg('Mengunggah berkas cadangan ke Google Drive...');
      const safeTitle = bundle.book.title
        .replace(/[^a-zA-Z0-9_\-\s]/g, '')
        .trim()
        .replace(/\s+/g, '_') || 'buku';
      const dateStr = new Date().toISOString().slice(0, 10);
      const fileName = `${safeTitle}_backup_${dateStr}.schemax.json`;
      const jsonStr = JSON.stringify(bundle);

      const result = await uploadBackupToGDrive(
        gdriveConfig.folderId,
        fileName,
        jsonStr,
        gdriveConfig.scriptUrl
      );

      setBackupSuccessMsg(
        `Sukses! Berkas cadangan "${result.name || fileName}" berhasil disimpan ke Google Drive Anda.`
      );
    } catch (err: any) {
      console.error('Gagal simpan ke GDrive:', err);
      setBackupErrorMsg(err?.message || 'Gagal mengunggah cadangan ke Google Drive.');
    } finally {
      setIsBackingUp(false);
    }
  };

  // ══════════════════════════════════════════════════════════════
  // AKSI RESTORE: PILIH FILE DARI KOMPUTER
  // ══════════════════════════════════════════════════════════════
  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoreErrorMsg(null);
    setRestoreSuccessMsg(null);
    try {
      const bundle = await readBackupBundleFromFile(file);
      setSelectedBundle(bundle);
      const stats = await inspectBackupBundle(bundle, file.size);
      setPreviewStats(stats);
      setRestoreMode(stats.existsLocally ? 'overwrite' : 'clone_as_new');
    } catch (err: any) {
      setRestoreErrorMsg(err?.message || 'Gagal membaca berkas cadangan.');
    }
  };

  // ══════════════════════════════════════════════════════════════
  // AKSI RESTORE: AMBIL DARI GOOGLE DRIVE
  // ══════════════════════════════════════════════════════════════
  const handleLoadGDriveBackupList = async () => {
    if (!isGDriveConfigured || !gdriveConfig.folderId) {
      onOpenGDriveSettings?.();
      return;
    }

    setIsLoadingGDriveFiles(true);
    setGdriveError(null);
    try {
      const files = await listBackupFilesFromGDrive(
        gdriveConfig.folderId,
        gdriveConfig.scriptUrl || gdriveConfig.apiKey
      );
      setGdriveBackups(files);
      if (files.length === 0) {
        setGdriveError('Tidak ada file cadangan (.schemax.json) yang ditemukan di folder Google Drive ini.');
      }
    } catch (err: any) {
      setGdriveError(err?.message || 'Gagal membaca daftar cadangan Google Drive.');
    } finally {
      setIsLoadingGDriveFiles(false);
    }
  };

  const handleSelectGDriveFileToRestore = async (fileItem: GDriveBackupItem) => {
    setIsLoadingGDriveFiles(true);
    setGdriveError(null);
    setRestoreErrorMsg(null);
    try {
      const jsonText = await fetchBackupContentFromGDrive(
        fileItem.id,
        gdriveConfig.scriptUrl
      );
      const parsed = JSON.parse(jsonText) as SchemaxBookBackupBundle;
      setSelectedBundle(parsed);
      const stats = await inspectBackupBundle(parsed, fileItem.size);
      setPreviewStats(stats);
      setRestoreMode(stats.existsLocally ? 'overwrite' : 'clone_as_new');
    } catch (err: any) {
      setRestoreErrorMsg(err?.message || 'Gagal mengunduh atau membaca file dari Google Drive.');
    } finally {
      setIsLoadingGDriveFiles(false);
    }
  };

  // ══════════════════════════════════════════════════════════════
  // EKSEKUSI PEMULIHAN (RESTORE)
  // ══════════════════════════════════════════════════════════════
  const handleExecuteRestore = async () => {
    if (!selectedBundle) return;

    setIsRestoring(true);
    setRestoreErrorMsg(null);
    setRestoreSuccessMsg(null);
    try {
      const result = await restoreBookBackupBundle(selectedBundle, restoreMode, (msg, pct) => {
        setRestoreProgressMsg(msg);
        setRestoreProgressPercent(pct);
      });

      setRestoreSuccessMsg(result.message);
      if (onRestoreComplete) {
        onRestoreComplete(result.restoredBookId);
      }
    } catch (err: any) {
      console.error('Gagal restore buku:', err);
      setRestoreErrorMsg(err?.message || 'Terjadi kesalahan saat memulihkan buku.');
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-950/40">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="p-2 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Database className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white truncate">
                Pusat Cadangkan & Pulihkan (Backup & Restore)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Buku Aktif: <span className="font-bold text-slate-800 dark:text-slate-200">{book.title}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-5 pt-2 bg-slate-50/30 dark:bg-slate-950/20">
          <button
            type="button"
            onClick={() => setActiveTab('backup')}
            className={`flex items-center gap-2 py-3 px-4 font-bold text-xs sm:text-sm border-b-2 transition ${
              activeTab === 'backup'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Cadangkan Buku (Backup)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('restore')}
            className={`flex items-center gap-2 py-3 px-4 font-bold text-xs sm:text-sm border-b-2 transition ${
              activeTab === 'restore'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Pulihkan Buku (Restore)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {activeTab === 'backup' ? (
            /* ══════════════════════════════════════════════════════════════
               TAB 1: CADANGKAN (BACKUP)
               ══════════════════════════════════════════════════════════════ */
            <div className="space-y-4">
              {/* Info Box */}
              <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/40 text-xs space-y-2">
                <span className="font-extrabold text-amber-900 dark:text-amber-300 flex items-center gap-1.5 text-sm">
                  <span>📦</span> Seluruh Isi Buku Akan Dicadangkan Penuh
                </span>
                <p className="text-amber-800/90 dark:text-amber-200/80 leading-relaxed">
                  Paket cadangan Schemax mencakup <strong>seluruh naskah bab</strong>, posisi gambar ilustrasi bab,
                  <strong>ensiklopedia & jaringan relasi karakter</strong>, file foto/avatar biner, serta
                  <strong>seluruh file audio suara AI TTS</strong> yang telah tersimpan.
                </p>
              </div>

              {/* Data Statistics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 mb-1">
                    <FileText className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Bab Cerita</span>
                  </div>
                  <span className="text-lg font-black text-slate-900 dark:text-white">{bookStats.chapterCount} Bab</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">{bookStats.wordCount.toLocaleString()} kata</span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 text-pink-600 dark:text-pink-400 mb-1">
                    <Compass className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Lore & Tokoh</span>
                  </div>
                  <span className="text-lg font-black text-slate-900 dark:text-white">{bookStats.entityCount} Entitas</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Relasi terhubung</span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 text-cyan-600 dark:text-cyan-400 mb-1">
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">File Gambar</span>
                  </div>
                  <span className="text-lg font-black text-slate-900 dark:text-white">{bookStats.mediaCount} Berkas</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Sampul & naskah</span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 mb-1">
                    <Volume2 className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Audio AI TTS</span>
                  </div>
                  <span className="text-lg font-black text-slate-900 dark:text-white">{bookStats.ttsCount} Suara</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Offline 0 token</span>
                </div>
              </div>

              {/* Progress Indicator */}
              {isBackingUp && (
                <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                      <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                      {backupProgressMsg || 'Membuat paket cadangan...'}
                    </span>
                    <span className="text-amber-600 dark:text-amber-400">{backupProgressPercent}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-300 rounded-full"
                      style={{ width: `${backupProgressPercent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Feedback Alert */}
              {backupSuccessMsg && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span>{backupSuccessMsg}</span>
                </div>
              )}
              {backupErrorMsg && (
                <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
                  <span>{backupErrorMsg}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={handleDownloadLocalBackup}
                  disabled={isBackingUp}
                  className="w-full py-3.5 px-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 transition active:scale-98 shadow-md shadow-amber-500/10 disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  <span>Unduh Berkas Cadangan ke Komputer (.schemax.json)</span>
                </button>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Cloud className="w-4 h-4 text-indigo-500" />
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        Cadangkan ke Google Drive
                      </span>
                    </div>
                    {isGDriveConfigured ? (
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        Terhubung ({gdriveConfig.folderName || 'Folder Drive'})
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={onOpenGDriveSettings}
                        className="text-[10px] font-bold text-amber-600 dark:text-amber-400 underline hover:opacity-80"
                      >
                        Hubungkan Google Drive
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleUploadGDriveBackup}
                    disabled={isBackingUp}
                    className="w-full py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition active:scale-98 disabled:opacity-50"
                  >
                    <Cloud className="w-3.5 h-3.5" />
                    <span>{isGDriveConfigured ? 'Simpan Cadangan ke Google Drive' : 'Atur Google Drive Terlebih Dahulu'}</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ══════════════════════════════════════════════════════════════
               TAB 2: PULIHKAN (RESTORE)
               ══════════════════════════════════════════════════════════════ */
            <div className="space-y-5">
              {/* File Source Selector */}
              {!selectedBundle && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Source 1: Local File */}
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="group cursor-pointer p-4 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-amber-500 dark:hover:border-amber-400 bg-slate-50/50 dark:bg-slate-950/40 text-center transition flex flex-col items-center justify-center gap-2 min-h-[140px]"
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json,.schemax"
                        onChange={handleFileInputChange}
                        className="hidden"
                      />
                      <span className="p-3 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
                        <Upload className="w-6 h-6" />
                      </span>
                      <div>
                        <span className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200 block">
                          Pilih Berkas dari Komputer
                        </span>
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          Format .schemax.json atau .json
                        </span>
                      </div>
                    </div>

                    {/* Source 2: Google Drive */}
                    <div
                      onClick={handleLoadGDriveBackupList}
                      className="group cursor-pointer p-4 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 bg-slate-50/50 dark:bg-slate-950/40 text-center transition flex flex-col items-center justify-center gap-2 min-h-[140px]"
                    >
                      <span className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
                        {isLoadingGDriveFiles ? (
                          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                        ) : (
                          <Cloud className="w-6 h-6" />
                        )}
                      </span>
                      <div>
                        <span className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200 block">
                          Pilih dari Google Drive
                        </span>
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          {isGDriveConfigured ? 'Baca folder Google Drive Anda' : 'Perlu menghubungkan Google Drive'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Google Drive Files List Drawer */}
                  {gdriveBackups.length > 0 && (
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                        <span>Berkas Cadangan di Google Drive ({gdriveBackups.length}):</span>
                        <button
                          type="button"
                          onClick={handleLoadGDriveBackupList}
                          className="text-[10px] text-indigo-500 hover:underline flex items-center gap-1"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Segarkan</span>
                        </button>
                      </span>
                      <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                        {gdriveBackups.map((item) => (
                          <div
                            key={item.id}
                            onClick={() => handleSelectGDriveFileToRestore(item)}
                            className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-amber-400 dark:hover:border-amber-400 cursor-pointer flex items-center justify-between gap-2 text-xs transition"
                          >
                            <div className="min-w-0 flex items-center gap-2">
                              <Database className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                              <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                                {item.name}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 flex-shrink-0">
                              {item.size ? `${(item.size / 1024).toFixed(0)} KB` : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {gdriveError && (
                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 text-xs text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
                      {gdriveError}
                    </div>
                  )}
                </div>
              )}

              {/* Selected Backup Preview & Execution Plan */}
              {selectedBundle && previewStats && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  {/* File Banner */}
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider block">
                        Berkas Cadangan Terpilih
                      </span>
                      <h4 className="font-black text-base text-slate-900 dark:text-white">
                        {previewStats.bookTitle}
                      </h4>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                        Dibuat pada: {new Date(previewStats.exportedAt).toLocaleString('id-ID')}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedBundle(null);
                        setPreviewStats(null);
                      }}
                      className="px-2.5 py-1 text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800"
                    >
                      Ganti Berkas
                    </button>
                  </div>

                  {/* Summary Chips */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Naskah</span>
                      <span className="font-bold text-slate-900 dark:text-white">{previewStats.chapterCount} Bab</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Ensiklopedia</span>
                      <span className="font-bold text-slate-900 dark:text-white">{previewStats.entityCount} Lore</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Gambar</span>
                      <span className="font-bold text-slate-900 dark:text-white">{previewStats.mediaCount} File</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Audio TTS AI</span>
                      <span className="font-bold text-slate-900 dark:text-white">{previewStats.ttsAudioCount} Paragraf</span>
                    </div>
                  </div>

                  {/* Mode Selector (Jika buku sudah ada) */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                    <span className="text-xs font-extrabold text-slate-900 dark:text-white block">
                      Pilih Cara Pemulihan:
                    </span>

                    <div className="space-y-2">
                      {/* Option 1: Overwrite */}
                      <label
                        className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition ${
                          restoreMode === 'overwrite'
                            ? 'bg-amber-500/10 border-amber-500/40 text-slate-900 dark:text-white'
                            : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900'
                        }`}
                      >
                        <input
                          type="radio"
                          name="restoreMode"
                          value="overwrite"
                          checked={restoreMode === 'overwrite'}
                          onChange={() => setRestoreMode('overwrite')}
                          className="mt-1 text-amber-500 focus:ring-amber-400"
                        />
                        <div className="text-xs">
                          <span className="font-black block text-slate-900 dark:text-white">
                            🔄 [Rekomendasi] Timpa / Sinkronkan Buku yang Ada
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed block mt-0.5">
                            Data buku lokal akan diperbarui menjadi sama persis dengan versi cadangan ini.
                            Seluruh bab, lore, dan gambar tersinkronisasi rapi tanpa ada duplikasi ganda.
                          </span>
                        </div>
                      </label>

                      {/* Option 2: Clone as New */}
                      <label
                        className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition ${
                          restoreMode === 'clone_as_new'
                            ? 'bg-amber-500/10 border-amber-500/40 text-slate-900 dark:text-white'
                            : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900'
                        }`}
                      >
                        <input
                          type="radio"
                          name="restoreMode"
                          value="clone_as_new"
                          checked={restoreMode === 'clone_as_new'}
                          onChange={() => setRestoreMode('clone_as_new')}
                          className="mt-1 text-amber-500 focus:ring-amber-400"
                        />
                        <div className="text-xs">
                          <span className="font-black block text-slate-900 dark:text-white">
                            📋 Salin Sebagai Buku Baru (Clone)
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed block mt-0.5">
                            Buku yang sekarang tidak akan diubah. Berkas cadangan akan dibuka menjadi buku baru
                            dengan nama "{previewStats.bookTitle} (Restore)".
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Restore Progress Indicator */}
                  {isRestoring && (
                    <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                          <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                          {restoreProgressMsg || 'Memulihkan data buku...'}
                        </span>
                        <span className="text-amber-600 dark:text-amber-400">{restoreProgressPercent}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-300 rounded-full"
                          style={{ width: `${restoreProgressPercent}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Feedback Alerts */}
                  {restoreSuccessMsg && (
                    <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      <span>{restoreSuccessMsg}</span>
                    </div>
                  )}
                  {restoreErrorMsg && (
                    <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
                      <span>{restoreErrorMsg}</span>
                    </div>
                  )}

                  {/* Execute Button */}
                  <button
                    type="button"
                    onClick={handleExecuteRestore}
                    disabled={isRestoring}
                    className="w-full py-3.5 px-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 transition active:scale-98 shadow-md shadow-amber-500/10 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${isRestoring ? 'animate-spin' : ''}`} />
                    <span>Mulai Pulihkan Buku Ini Sekarang</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
