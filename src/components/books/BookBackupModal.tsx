import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Calendar,
  Clock,
  BookOpen,
  Search,
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

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export interface ParsedBackupFileItem extends GDriveBackupItem {
  bookTitle: string;
  backupDate: Date;
  displayDateStr: string;
  relativeTimeStr: string;
}

function parseBackupFileInfo(fileName: string, updatedAt?: string): {
  bookTitle: string;
  backupDate: Date;
  displayDateStr: string;
  relativeTimeStr: string;
} {
  const clean = fileName.replace(/\.(schemax\.json|json|schemax)$/i, '');
  let title = '';
  let date: Date | null = null;

  if (clean.includes('_backup_')) {
    const [left, ...rest] = clean.split('_backup_');
    const right = rest.join('_backup_');

    if (left.toLowerCase() === 'schemax' || left === '') {
      // e.g. schemax_backup_Sangkuriang_2026-10-03_14-30
      const dateMatch = right.match(/^(.*?)_(\d{4}-\d{2}-\d{2})[-_](\d{2})[-_](\d{2})/);
      if (dateMatch) {
        title = dateMatch[1].replace(/_/g, ' ').trim();
        date = new Date(`${dateMatch[2]}T${dateMatch[3]}:${dateMatch[4]}:00`);
      } else {
        title = right.replace(/_/g, ' ').trim();
      }
    } else {
      // standard format: Sangkuriang_backup_2026-10-03_14-30
      title = left.replace(/_/g, ' ').trim();
      const dateMatch = right.match(/(\d{4}-\d{2}-\d{2})[-_](\d{2})[-_](\d{2})/);
      if (dateMatch) {
        date = new Date(`${dateMatch[1]}T${dateMatch[2]}:${dateMatch[3]}:00`);
      }
    }
  }

  // Fallback date from updatedAt
  if ((!date || isNaN(date.getTime())) && updatedAt) {
    const d = new Date(updatedAt);
    if (!isNaN(d.getTime())) date = d;
  }
  if (!date || isNaN(date.getTime())) {
    date = new Date();
  }

  if (!title) {
    title = clean.replace(/_/g, ' ').trim() || 'Berkas Cadangan';
  }

  let displayDateStr = '';
  try {
    displayDateStr = date.toLocaleDateString('id-ID', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    displayDateStr = date.toISOString().slice(0, 16).replace('T', ' ');
  }

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  let relativeTimeStr = '';
  if (diffMinutes < 5) {
    relativeTimeStr = 'Baru saja';
  } else if (diffMinutes < 60) {
    relativeTimeStr = `${diffMinutes} mnt lalu`;
  } else if (diffHours < 24) {
    relativeTimeStr = `${diffHours} jam lalu`;
  } else if (diffDays < 7) {
    relativeTimeStr = `${diffDays} hari lalu`;
  } else {
    relativeTimeStr = displayDateStr;
  }

  return {
    bookTitle: title,
    backupDate: date,
    displayDateStr,
    relativeTimeStr,
  };
}

interface BookBackupModalProps {
  isOpen: boolean;
  book?: Book | null;
  onClose: () => void;
  onRestoreComplete?: (bookId: string) => void;
  onOpenGDriveSettings?: () => void;
  initialTab?: 'backup' | 'restore';
}

export const BookBackupModal: React.FC<BookBackupModalProps> = ({
  isOpen,
  book,
  onClose,
  onRestoreComplete,
  onOpenGDriveSettings,
  initialTab,
}) => {
  const [activeTab, setActiveTab] = useState<'backup' | 'restore'>(
    initialTab || (book ? 'backup' : 'restore')
  );

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
  const [isGDrivePickerOpen, setIsGDrivePickerOpen] = useState(false);
  const [expandedBooks, setExpandedBooks] = useState<Record<string, boolean>>({});
  const [searchBackupQuery, setSearchBackupQuery] = useState('');

  // 📚 Kelompokkan file cadangan Google Drive per Judul Buku & Urutkan Tanggal (Terbaru dahulu)
  const groupedBackups = useMemo(() => {
    const map = new Map<string, ParsedBackupFileItem[]>();

    for (const item of gdriveBackups) {
      const info = parseBackupFileInfo(item.name, item.updatedAt);
      const parsedItem: ParsedBackupFileItem = {
        ...item,
        bookTitle: info.bookTitle,
        backupDate: info.backupDate,
        displayDateStr: info.displayDateStr,
        relativeTimeStr: info.relativeTimeStr,
      };

      const currentList = map.get(info.bookTitle) || [];
      currentList.push(parsedItem);
      map.set(info.bookTitle, currentList);
    }

    // Urutkan item di setiap buku: PALING BARU DI ATAS (descending)
    map.forEach((items) => {
      items.sort((a, b) => b.backupDate.getTime() - a.backupDate.getTime());
    });

    const result: Array<{ bookTitle: string; items: ParsedBackupFileItem[] }> = [];
    map.forEach((items, bookTitle) => {
      result.push({ bookTitle, items });
    });

    // Urutkan buku: buku dengan cadangan terbaru muncul paling atas
    result.sort((a, b) => {
      const aTime = a.items[0]?.backupDate.getTime() || 0;
      const bTime = b.items[0]?.backupDate.getTime() || 0;
      return bTime - aTime;
    });

    return result;
  }, [gdriveBackups]);

  // Otomatis buka accordion buku pertama jika baru pertama kali dimuat
  useEffect(() => {
    if (groupedBackups.length > 0) {
      setExpandedBooks((prev) => {
        if (Object.keys(prev).length === 0) {
          return { [groupedBackups[0].bookTitle]: true };
        }
        return prev;
      });
    }
  }, [groupedBackups]);

  const filteredGroupedBackups = useMemo(() => {
    if (!searchBackupQuery.trim()) return groupedBackups;
    const q = searchBackupQuery.toLowerCase();
    return groupedBackups
      .map((group) => {
        const titleMatches = group.bookTitle.toLowerCase().includes(q);
        const filteredItems = group.items.filter(
          (it) => it.name.toLowerCase().includes(q) || it.displayDateStr.toLowerCase().includes(q)
        );
        if (titleMatches) return group;
        if (filteredItems.length > 0) return { ...group, items: filteredItems };
        return null;
      })
      .filter(Boolean) as Array<{ bookTitle: string; items: ParsedBackupFileItem[] }>;
  }, [groupedBackups, searchBackupQuery]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const gdriveConfig = loadGDriveConfig();
  const isGDriveConfigured = Boolean(gdriveConfig.folderId && (gdriveConfig.scriptUrl || gdriveConfig.apiKey));

  // Muat statistik data buku saat modal dibuka
  useEffect(() => {
    if (isOpen) {
      if (!book || initialTab === 'restore') {
        setActiveTab('restore');
      } else {
        setActiveTab('backup');
      }
      setBackupSuccessMsg(null);
      setBackupErrorMsg(null);
      setRestoreSuccessMsg(null);
      setRestoreErrorMsg(null);
      setSelectedBundle(null);
      setPreviewStats(null);

      if (book?.id) {
        const loadStats = async () => {
          const chapters = await db.chapters.where('bookId').equals(book.id).toArray();
        const words = chapters.reduce((sum, c) => sum + (c.wordCount || 0), 0);
        const entities = await db.worldEntities.where('bookId').equals(book.id).toArray();
        const media = await db.media.where('bookId').equals(book.id).toArray();

        const chapterIds = chapters.map((c) => c.id);
        const ttsCount = chapterIds.length > 0
          ? await db.ttsAudioCaches.where('chapterId').anyOf(chapterIds).count()
          : 0;

        setBookStats({
          chapterCount: chapters.length,
          wordCount: words,
          entityCount: entities.length,
          mediaCount: media.length,
          ttsCount,
        });
      };

      loadStats();
    }
  }
}, [isOpen, book?.id]);

  if (!isOpen) return null;

  // ══════════════════════════════════════════════════════════════
  // AKSI BACKUP: UNDUH LOKAL
  // ══════════════════════════════════════════════════════════════
  const handleDownloadLocalBackup = async () => {
    if (!book) return;
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
    if (!book) return;
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
      const fileName = getBackupFileName(bundle.book.title);
      const jsonStr = JSON.stringify(bundle);

      const result = await uploadBackupToGDrive(
        gdriveConfig.folderId,
        fileName,
        jsonStr,
        gdriveConfig.scriptUrl
      );

      setBackupSuccessMsg(
        `Sukses! Berkas cadangan "${result.name || fileName}" berhasil disimpan ke folder "${result.folderName || 'backup'}" di Google Drive Anda.`
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

    setIsGDrivePickerOpen(true);
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
      setIsGDrivePickerOpen(false);
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
                {book ? `Cadangan & Pulihkan: ${book.title}` : 'Pulihkan Buku dari Cadangan (Restore)'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {book ? (
                  <>Buku Aktif: <span className="font-bold text-slate-800 dark:text-slate-200">{book.title}</span></>
                ) : (
                  'Pilih berkas cadangan dari Komputer atau Google Drive'
                )}
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

        {/* Tab Selector (Hanya muncul jika ada buku aktif untuk dicadangkan) */}
        {book && (
          <div className="flex border-b border-slate-200 dark:border-slate-800 px-3 sm:px-5 pt-2 bg-slate-50/30 dark:bg-slate-950/20">
            <button
              type="button"
              onClick={() => setActiveTab('backup')}
              className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-3 px-2 sm:px-4 font-bold text-xs sm:text-sm border-b-2 transition min-w-0 ${
                activeTab === 'backup'
                  ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Download className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">Cadangkan <span className="hidden sm:inline">Buku (Backup)</span></span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('restore')}
              className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-3 px-2 sm:px-4 font-bold text-xs sm:text-sm border-b-2 transition min-w-0 ${
                activeTab === 'restore'
                  ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Upload className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">Pulihkan <span className="hidden sm:inline">Buku (Restore)</span></span>
            </button>
          </div>
        )}

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
                <div className="p-3.5 sm:p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 text-xs text-rose-800 dark:text-rose-300 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                    <span className="font-semibold leading-relaxed flex-1">{backupErrorMsg}</span>
                  </div>
                  {(backupErrorMsg.includes('tidak memiliki izin') ||
                    backupErrorMsg.includes('createFile') ||
                    backupErrorMsg.includes('auth/drive') ||
                    backupErrorMsg.includes('testAuthorize')) && (
                    <div className="pt-2 border-t border-rose-200/60 dark:border-rose-800/40 text-[11px] text-slate-700 dark:text-slate-300 space-y-1.5">
                      <p className="font-bold text-amber-700 dark:text-amber-400">
                        💡 Cara Mengaktifkan Izin Google Drive (Hanya 1 Menit):
                      </p>
                      <ol className="list-decimal list-inside space-y-1 text-slate-600 dark:text-slate-300 text-[10.5px]">
                        <li>Buka editor script Anda di <a href="https://script.google.com" target="_blank" rel="noreferrer" className="underline font-bold text-blue-600 dark:text-blue-400">script.google.com</a>.</li>
                        <li>Pastikan kode script sudah memuat fungsi <code>testAuthorize</code> (bisa disalin dari Pengaturan Google Drive).</li>
                        <li>Di bilah atas editor, pilih <strong>testAuthorize</strong> lalu klik tombol <strong>Run (Jalankan)</strong>.</li>
                        <li>Setujui izin akses: <strong>Review Permissions &rarr; Advanced &rarr; Allow</strong>.</li>
                        <li>Klik <strong>Deploy &rarr; Manage Deployments &rarr; Edit (ikon pensil) &rarr; Version: New version &rarr; Deploy</strong>.</li>
                      </ol>
                      {onOpenGDriveSettings && (
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={onOpenGDriveSettings}
                            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] transition"
                          >
                            Buka Pengaturan &amp; Salin Kode Script Terbaru
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={handleDownloadLocalBackup}
                  disabled={isBackingUp}
                  className="w-full py-3.5 px-3 sm:px-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition active:scale-98 shadow-md shadow-amber-500/10 disabled:opacity-50 text-center"
                >
                  <Download className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">Unduh Berkas Cadangan (.schemax.json)</span>
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

                  {/* Google Drive Files List Banner & Trigger */}
                  {gdriveBackups.length > 0 && (
                    <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-xs">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold flex-shrink-0">
                          <Cloud className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white block">
                            {gdriveBackups.length} Berkas Cadangan Terdeteksi
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                            Tersusun rapi per judul buku (Accordion)
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsGDrivePickerOpen(true)}
                        className="py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-500/20 flex items-center justify-center gap-2 active:scale-95 transition"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>Buka Daftar Cadangan Buku</span>
                      </button>
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

      {/* 🌟 Modal Accordion Cadangan Google Drive */}
      {isGDrivePickerOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-2.5 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-xl max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 flex-shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold flex-shrink-0">
                  <Cloud className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white leading-tight truncate">
                    Pilih Cadangan Buku (Google Drive)
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    Folder: <strong>{gdriveConfig.folderName || 'backup'}</strong> • {gdriveBackups.length} file cadangan
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={handleLoadGDriveBackupList}
                  disabled={isLoadingGDriveFiles}
                  className="p-2 rounded-xl text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  title="Segarkan daftar cadangan"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingGDriveFiles ? 'animate-spin' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsGDrivePickerOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Search Input */}
            {gdriveBackups.length > 0 && (
              <div className="p-3 sm:px-5 sm:py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex-shrink-0">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchBackupQuery}
                    onChange={(e) => setSearchBackupQuery(e.target.value)}
                    placeholder="Cari judul buku atau tanggal cadangan..."
                    className="w-full pl-9 pr-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-400"
                  />
                </div>
              </div>
            )}

            {/* Modal Body / Accordion List */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3">
              {isLoadingGDriveFiles ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Memuat daftar cadangan dari Google Drive...
                  </p>
                </div>
              ) : gdriveError ? (
                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 text-xs text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 space-y-2">
                  <div className="flex items-center gap-2 font-bold">
                    <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    <span>Perhatian</span>
                  </div>
                  <p>{gdriveError}</p>
                  {onOpenGDriveSettings && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsGDrivePickerOpen(false);
                        onOpenGDriveSettings();
                      }}
                      className="mt-2 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] transition"
                    >
                      Buka Pengaturan Google Drive
                    </button>
                  )}
                </div>
              ) : filteredGroupedBackups.length === 0 ? (
                <div className="py-10 text-center space-y-2 text-slate-400">
                  <Database className="w-8 h-8 mx-auto opacity-40" />
                  <p className="text-xs font-bold">
                    {searchBackupQuery
                      ? 'Tidak ada cadangan yang cocok dengan pencarian.'
                      : 'Belum ada file cadangan (.schemax.json) di folder Google Drive Anda.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredGroupedBackups.map((group) => {
                    const isExpanded = Boolean(expandedBooks[group.bookTitle]);
                    return (
                      <div
                        key={group.bookTitle}
                        className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-50/60 dark:bg-slate-950/40 transition-all shadow-sm"
                      >
                        {/* Accordion Trigger Header */}
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedBooks((prev) => ({
                              ...prev,
                              [group.bookTitle]: !prev[group.bookTitle],
                            }))
                          }
                          className="w-full p-3.5 sm:p-4 flex items-center justify-between gap-3 text-left hover:bg-slate-100/80 dark:hover:bg-slate-900/80 transition cursor-pointer"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                              <BookOpen className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-black text-xs sm:text-sm text-slate-900 dark:text-white leading-snug break-words">
                                {group.bookTitle}
                              </h4>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                Terakhir dicadangkan: <strong className="text-slate-700 dark:text-slate-300">{group.items[0].relativeTimeStr}</strong>
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                              {group.items.length} Cadangan
                            </span>
                            <div
                              className={`p-1 rounded-lg text-slate-400 transition-transform duration-200 ${
                                isExpanded ? 'transform rotate-180 text-amber-500' : ''
                              }`}
                            >
                              <ChevronDown className="w-4 h-4" />
                            </div>
                          </div>
                        </button>

                        {/* Accordion Content: List of Backups sorted by Date/Time */}
                        {isExpanded && (
                          <div className="px-3 pb-3 sm:px-4 sm:pb-4 space-y-2 border-t border-slate-200/80 dark:border-slate-800/80 pt-3 bg-white/70 dark:bg-slate-900/70 animate-in fade-in duration-150">
                            {group.items.map((item, idx) => (
                              <div
                                key={item.id}
                                className="p-3 rounded-xl border border-slate-200/90 dark:border-slate-800 hover:border-amber-400 dark:hover:border-amber-400 bg-white dark:bg-slate-950 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 transition shadow-xs"
                              >
                                <div className="space-y-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Clock className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                                    <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                                      {item.displayDateStr}
                                    </span>
                                    {idx === 0 && (
                                      <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                        Terbaru
                                      </span>
                                    )}
                                    <span className="text-[10px] font-semibold text-slate-400">
                                      ({item.relativeTimeStr})
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                    <span className="font-semibold text-slate-500 dark:text-slate-400">
                                      {formatBytes(item.size)}
                                    </span>
                                    <span>•</span>
                                    <span className="font-mono truncate max-w-[220px] sm:max-w-xs text-slate-400" title={item.name}>
                                      {item.name}
                                    </span>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleSelectGDriveFileToRestore(item)}
                                  className="w-full sm:w-auto py-2 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-sm flex items-center justify-center gap-1.5 active:scale-95 transition flex-shrink-0"
                                >
                                  <span>Pilih Cadangan Ini</span>
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 flex-shrink-0">
              <span className="text-[11px]">
                Cadangan diurutkan otomatis dari yang <strong>paling baru</strong>.
              </span>
              <button
                type="button"
                onClick={() => setIsGDrivePickerOpen(false)}
                className="font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
