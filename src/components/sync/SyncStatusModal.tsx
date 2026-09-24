import React, { useState, useEffect } from 'react';
import {
  X,
  HardDrive,
  Cloud,
  CheckCircle2,
  Download,
  Upload,
  RefreshCw,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import { db, seedInitialDataIfNeeded } from '../../db';

interface SyncStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataChanged: () => void;
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

  useEffect(() => {
    if (!isOpen) return;

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
        setQuotaInfo('Tersedia tanpa batas memori lokal browser');
      }
    };

    loadStats();
  }, [isOpen]);

  if (!isOpen) return null;

  const exportAllData = async () => {
    const books = await db.books.toArray();
    const chapters = await db.chapters.toArray();
    const entities = await db.worldEntities.toArray();

    const backupData = {
      app: 'Schemax Story & Worldbuilding Studio',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      books,
      chapters,
      entities,
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
  };

  const handleResetData = async () => {
    if (confirm('Apakah Anda yakin ingin mengatur ulang data kembali ke contoh awal?')) {
      await db.books.clear();
      await db.chapters.clear();
      await db.worldEntities.clear();
      await db.media.clear();
      await seedInitialDataIfNeeded();
      onDataChanged();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full sm:max-w-md max-h-[90vh] flex flex-col bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/80 bg-slate-900/90 sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">
                Penyimpanan & Sinkronisasi
              </h2>
              <p className="text-xs text-slate-400">Arsitektur Full Client-Side Local First</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Status Badge */}
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-bold text-emerald-300 block mb-0.5">
                Mode Offline / Local-First Aktif
              </span>
              <p className="text-emerald-200/80 leading-relaxed">
                Seluruh data naskah, bab, worldbuilding, dan binary foto disimpan aman di browser Anda via <strong>IndexedDB</strong> tanpa memerlukan koneksi internet.
              </p>
            </div>
          </div>

          {/* Storage Statistics */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-2.5">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Statistik Database Lokal
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80">
                <span className="text-slate-400 block text-[11px]">Total Buku</span>
                <span className="text-base font-bold text-white">{stats.books}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80">
                <span className="text-slate-400 block text-[11px]">Bab & Plot</span>
                <span className="text-base font-bold text-white">{stats.chapters}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80">
                <span className="text-slate-400 block text-[11px]">Entitas Lore</span>
                <span className="text-base font-bold text-white">{stats.entities}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80">
                <span className="text-slate-400 block text-[11px]">Media Gambar</span>
                <span className="text-base font-bold text-white">
                  {stats.media} ({(stats.mediaBytes / (1024 * 1024)).toFixed(1)} MB)
                </span>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 font-mono pt-1">{quotaInfo}</p>
          </div>

          {/* Future Cloud Sync Roadmap */}
          <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-start gap-3">
            <Cloud className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-bold text-indigo-300 block mb-0.5">
                Kesiapan Sinkronisasi Cloud
              </span>
              <p className="text-indigo-200/80 leading-relaxed">
                Struktur ID berbasis timestamp dan isolasi media siap dihubungkan ke backend cloud (Supabase, Firebase, CouchDB, atau Google Drive) kapan pun Anda siap.
              </p>
            </div>
          </div>

          {/* Backup / Export Actions */}
          <div className="space-y-2 pt-1">
            <button
              onClick={exportAllData}
              className="w-full py-2.5 px-3.5 bg-slate-800 hover:bg-slate-700 active:scale-[0.99] text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 border border-slate-700 transition"
            >
              <Download className="w-4 h-4 text-amber-400" />
              <span>Unduh Cadangan Semua Data (JSON)</span>
            </button>

            <button
              onClick={handleResetData}
              className="w-full py-2 px-3 text-slate-500 hover:text-slate-300 text-[11px] flex items-center justify-center gap-1.5 transition"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Muat Ulang Data Contoh Awal</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
