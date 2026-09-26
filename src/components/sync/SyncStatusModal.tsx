import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  HardDrive,
  Cloud,
  CheckCircle2,
  Download,
  Upload,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  FileCheck,
  Database
} from 'lucide-react';
import { db, seedInitialDataIfNeeded } from '../../db';

interface SyncStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataChanged: () => void;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const mime = parts[0]?.match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(parts[1] || '');
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

export const SyncStatusModal: React.FC<SyncStatusModalProps> = ({
  isOpen,
  onClose,
  onDataChanged,
}) => {
  const [stats, setStats] = useState({
    books: 0,
    chapters: 0,
    entities: 0,
    media: 0,
    mediaBytes: 0,
  });
  const [quotaInfo, setQuotaInfo] = useState<string>('Menghitung...');
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [includeMediaInBackup, setIncludeMediaInBackup] = useState(true);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadStats = async () => {
    const books = await db.books.count();
    const chapters = await db.chapters.count();
    const entities = await db.worldEntities.count();
    const mediaList = await db.media.toArray();
    const mediaBytes = mediaList.reduce((sum, m) => sum + (m.size || 0), 0);

    setStats({
      books,
      chapters,
      entities,
      media: mediaList.length,
      mediaBytes,
    });

    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      const usedMB = ((estimate.usage || 0) / (1024 * 1024)).toFixed(1);
      const quotaMB = ((estimate.quota || 0) / (1024 * 1024 * 1024)).toFixed(1);
      setQuotaInfo(`${usedMB} MB terpakai dari kuota browser ${quotaMB} GB`);
    } else {
      setQuotaInfo('Tersedia memori lokal browser');
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    loadStats();
    setStatusMessage(null);
  }, [isOpen]);

  if (!isOpen) return null;

  const exportAllData = async () => {
    setIsExporting(true);
    setStatusMessage({ text: 'Sedang menyiapkan berkas cadangan...', type: 'info' });

    try {
      const books = await db.books.toArray();
      const chapters = await db.chapters.toArray();
      const entities = await db.worldEntities.toArray();

      let mediaExport: any[] = [];
      if (includeMediaInBackup) {
        const mediaList = await db.media.toArray();
        mediaExport = await Promise.all(
          mediaList.map(async (m) => {
            let dataUrl = '';
            try {
              dataUrl = await blobToBase64(m.blob);
            } catch (err) {
              console.warn(`Gagal mengonversi media ${m.id} ke base64:`, err);
            }
            return {
              id: m.id,
              bookId: m.bookId,
              chapterId: m.chapterId,
              entityId: m.entityId,
              category: m.category,
              tags: m.tags,
              caption: m.caption,
              name: m.name,
              mimeType: m.mimeType,
              size: m.size,
              createdAt: m.createdAt,
              dataUrl,
            };
          })
        );
      }

      const backupData = {
        app: 'Schemax Story & Worldbuilding Studio',
        version: '1.2.0',
        exportedAt: new Date().toISOString(),
        hasMedia: includeMediaInBackup,
        books,
        chapters,
        entities,
        media: mediaExport,
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `schemax_full_backup_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);

      setStatusMessage({ text: 'Cadangan data berhasil diunduh!', type: 'success' });
    } catch (err: any) {
      console.error('Gagal mengekspor data:', err);
      setStatusMessage({ text: `Gagal mengekspor data: ${err.message || 'Error tidak dikenal'}`, type: 'error' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setStatusMessage({ text: 'Membaca dan memverifikasi berkas cadangan...', type: 'info' });

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data || typeof data !== 'object') {
        throw new Error('Format berkas JSON tidak valid.');
      }

      const importedBooks = Array.isArray(data.books) ? data.books : [];
      const importedChapters = Array.isArray(data.chapters) ? data.chapters : [];
      const importedEntities = Array.isArray(data.entities)
        ? data.entities
        : Array.isArray(data.worldEntities)
        ? data.worldEntities
        : [];
      const importedMedia = Array.isArray(data.media) ? data.media : [];

      if (importedBooks.length === 0 && importedChapters.length === 0 && importedEntities.length === 0) {
        throw new Error('Berkas tidak memuat data buku atau entitas yang dapat dipulihkan.');
      }

      const shouldOverwrite = confirm(
        `Ditemukan: ${importedBooks.length} buku, ${importedChapters.length} bab, ${importedEntities.length} entitas lore, dan ${importedMedia.length} berkas media.\n\n` +
        `Pilih "OK" untuk MENGGANTI TOTAL database saat ini dengan cadangan ini.\n` +
        `Pilih "Batal" untuk MENGGABUNGKAN data baru ke database tanpa menghapus data lama.`
      );

      if (shouldOverwrite) {
        await db.books.clear();
        await db.chapters.clear();
        await db.worldEntities.clear();
        await db.media.clear();
      }

      // Masukkan buku
      if (importedBooks.length > 0) {
        await db.books.bulkPut(importedBooks);
      }
      // Masukkan bab
      if (importedChapters.length > 0) {
        await db.chapters.bulkPut(importedChapters);
      }
      // Masukkan entitas
      if (importedEntities.length > 0) {
        await db.worldEntities.bulkPut(importedEntities);
      }
      // Masukkan media jika ada
      if (importedMedia.length > 0) {
        for (const item of importedMedia) {
          if (item.dataUrl && item.id) {
            try {
              const blob = dataUrlToBlob(item.dataUrl);
              await db.media.put({
                id: item.id,
                bookId: item.bookId,
                chapterId: item.chapterId,
                entityId: item.entityId,
                category: item.category,
                tags: item.tags,
                caption: item.caption,
                name: item.name || 'imported-media',
                mimeType: item.mimeType || blob.type,
                blob,
                size: blob.size,
                createdAt: item.createdAt || Date.now(),
              });
            } catch (err) {
              console.warn('Gagal memulihkan media item:', item.id, err);
            }
          }
        }
      }

      await loadStats();
      onDataChanged();
      setStatusMessage({
        text: `Data berhasil dipulihkan! (${importedBooks.length} buku, ${importedChapters.length} bab, ${importedEntities.length} entitas)`,
        type: 'success',
      });
    } catch (err: any) {
      console.error('Gagal mengimpor data cadangan:', err);
      setStatusMessage({
        text: `Gagal memulihkan cadangan: ${err.message || 'Format tidak sesuai.'}`,
        type: 'error',
      });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleResetData = async () => {
    if (confirm('Apakah Anda yakin ingin mengatur ulang data kembali ke contoh awal? Semua perubahan naskah akan dihapus.')) {
      await db.books.clear();
      await db.chapters.clear();
      await db.worldEntities.clear();
      await db.media.clear();
      await seedInitialDataIfNeeded();
      await loadStats();
      onDataChanged();
      setStatusMessage({ text: 'Data awal contoh berhasil dimuat ulang.', type: 'info' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40 dark:bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full sm:max-w-lg max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900/90 sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                Penyimpanan &amp; Sinkronisasi
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Arsitektur Full Client-Side Local First</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Status Message Notification */}
          {statusMessage && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                  : statusMessage.type === 'error'
                  ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-300 dark:border-rose-500/30 text-rose-800 dark:text-rose-300'
                  : 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-300 dark:border-indigo-500/30 text-indigo-800 dark:text-indigo-300'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              ) : statusMessage.type === 'error' ? (
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              ) : (
                <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" />
              )}
              <span className="font-semibold">{statusMessage.text}</span>
            </div>
          )}

          {/* Status Badge */}
          <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-bold text-emerald-800 dark:text-emerald-300 block mb-0.5">
                Mode Offline / Local-First Aktif
              </span>
              <p className="text-emerald-700 dark:text-emerald-200/80 leading-relaxed">
                Seluruh data naskah, bab, worldbuilding, dan binary foto disimpan aman di browser Anda via <strong>IndexedDB</strong> tanpa memerlukan koneksi internet.
              </p>
            </div>
          </div>

          {/* Storage Statistics */}
          <div className="bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2.5">
            <h4 className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span>Statistik Database Lokal</span>
              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono font-normal">IndexedDB Dexie</span>
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800/80">
                <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Total Buku</span>
                <span className="text-base font-bold text-slate-900 dark:text-white">{stats.books}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800/80">
                <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Bab &amp; Plot</span>
                <span className="text-base font-bold text-slate-900 dark:text-white">{stats.chapters}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800/80">
                <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Entitas Lore</span>
                <span className="text-base font-bold text-slate-900 dark:text-white">{stats.entities}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800/80">
                <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Media Gambar</span>
                <span className="text-base font-bold text-slate-900 dark:text-white">
                  {stats.media} ({(stats.mediaBytes / (1024 * 1024)).toFixed(1)} MB)
                </span>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 font-mono pt-1">{quotaInfo}</p>
          </div>

          {/* Backup / Export & Restore Actions */}
          <div className="space-y-3 pt-1">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Manajemen Cadangan (Backup &amp; Restore)
            </h4>

            {/* Checkbox include media */}
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 dark:text-slate-300 select-none">
              <input
                type="checkbox"
                checked={includeMediaInBackup}
                onChange={(e) => setIncludeMediaInBackup(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400 dark:border-slate-700 dark:bg-slate-800"
              />
              <span>Sertakan binary gambar &amp; cover dalam berkas cadangan</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Tombol Unduh Cadangan */}
              <button
                type="button"
                onClick={exportAllData}
                disabled={isExporting}
                className="py-2.5 px-3 bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition shadow-sm disabled:opacity-50"
              >
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span>Unduh Cadangan (JSON)</span>
              </button>

              {/* Tombol Pulihkan Data */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 active:scale-[0.99] text-slate-800 dark:text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 transition shadow-sm disabled:opacity-50"
              >
                {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4 text-indigo-500" />}
                <span>Pulihkan Data (JSON)</span>
              </button>

              {/* Hidden File Input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileSelected}
                className="hidden"
              />
            </div>

            {/* Muat ulang data contoh */}
            <button
              onClick={handleResetData}
              className="w-full py-2 px-3 text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 text-[11px] flex items-center justify-center gap-1.5 transition border-t border-slate-100 dark:border-slate-800/80 pt-2.5"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Muat Ulang Data Contoh Awal (Reset)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
