import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Folder,
  Image as ImageIcon,
  ArrowLeft,
  RefreshCw,
  Search,
  Check,
  Download,
  AlertCircle,
  HardDrive,
  ExternalLink,
  Maximize2,
  Eye,
  EyeOff
} from 'lucide-react';
import { GDriveItem } from '../../types';
import {
  loadGDriveConfig,
  getEffectiveGoogleApiKey,
  listGDriveFolderContents,
  downloadGDriveImageBlob
} from '../../services/gdriveService';
import { saveMediaItem } from '../../db';
import { usePrivacy } from '../../contexts/PrivacyContext';
import { ImageViewerModal } from '../common/ImageViewerModal';

interface GDriveMediaPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectImage: (mediaId: string, directUrl?: string) => void;
  bookId?: string;
  entityId?: string;
  category?: any;
  title?: string;
  onOpenSettings?: () => void;
}

interface FolderHistoryItem {
  id: string;
  name: string;
}

export const GDriveMediaPickerModal: React.FC<GDriveMediaPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectImage,
  bookId = 'global_asset',
  entityId,
  category,
  title = 'Pilih Gambar dari Google Drive',
  onOpenSettings,
}) => {
  const { settings, getBlurImageClass, bindEmptyAreaLongPress } = usePrivacy();
  const [config, setConfig] = useState(loadGDriveConfig());
  const [currentFolderId, setCurrentFolderId] = useState<string>('');
  const [folderHistory, setFolderHistory] = useState<FolderHistoryItem[]>([]);
  const [items, setItems] = useState<GDriveItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [downloadingItemId, setDownloadingItemId] = useState<string | null>(null);

  // Fullscreen Preview & Long-press unblur state
  const [fullscreenItem, setFullscreenItem] = useState<GDriveItem | null>(null);
  const [holdingItemId, setHoldingItemId] = useState<string | null>(null);
  const longPressTimerRef = useRef<any>(null);
  const isLongPressTriggeredRef = useRef<boolean>(false);
  const pointerStartPosRef = useRef<{ x: number; y: number } | null>(null);

  const apiKey = getEffectiveGoogleApiKey();

  // Reset & inisialisasi folder ketika modal dibuka
  useEffect(() => {
    if (isOpen) {
      const cfg = loadGDriveConfig();
      setConfig(cfg);
      if (cfg.folderId) {
        setCurrentFolderId(cfg.folderId);
        setFolderHistory([{ id: cfg.folderId, name: cfg.folderName || 'Folder Utama' }]);
        loadFolder(cfg.folderId, apiKey);
      } else {
        setItems([]);
        setError('Belum ada folder Google Drive yang dikonfigurasi. Silakan atur di Pengaturan Google Drive.');
      }
    }
  }, [isOpen]);

  const loadFolder = async (folderId: string, keyToUse: string) => {
    if (!folderId) return;
    if (!keyToUse) {
      setError('Google API Key belum terpasang. Masukkan API Key di Pengaturan AI atau Pengaturan Google Drive.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const fetchedItems = await listGDriveFolderContents(folderId, keyToUse);
      setItems(fetchedItems);
    } catch (err: any) {
      setError(err?.message || 'Gagal memuat isi folder Google Drive.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  // Navigasi masuk ke subfolder
  const handleOpenSubfolder = (item: GDriveItem) => {
    setCurrentFolderId(item.id);
    setFolderHistory((prev) => [...prev, { id: item.id, name: item.name }]);
    loadFolder(item.id, apiKey);
  };

  // Navigasi mundur ke folder sebelumnya
  const handleNavigateBack = (targetIndex: number) => {
    if (targetIndex >= folderHistory.length - 1) return;
    const targetFolder = folderHistory[targetIndex];
    const newHistory = folderHistory.slice(0, targetIndex + 1);
    setFolderHistory(newHistory);
    setCurrentFolderId(targetFolder.id);
    loadFolder(targetFolder.id, apiKey);
  };

  // Pilih gambar: unduh blob dan simpan ke IndexedDB lokal
  const handlePickImage = async (item: GDriveItem) => {
    setDownloadingItemId(item.id);
    try {
      // 1. Unduh Blob dari Google Drive
      const { blob } = await downloadGDriveImageBlob(item.id);

      // 2. Simpan Blob secara permanen ke IndexedDB Schemax
      const mediaId = await saveMediaItem(bookId, blob, item.name, {
        entityId,
        category,
        caption: `Diimpor dari Google Drive: ${item.name}`,
      });

      // 3. Callback ke komponen pemanggil
      onSelectImage(mediaId, item.directUrl);
      onClose();
    } catch (err: any) {
      alert(`Gagal mengunduh gambar ke penyimpanan lokal: ${err?.message || 'Error tidak diketahui'}`);
    } finally {
      setDownloadingItemId(null);
    }
  };

  // Pointer event handlers: Long-Press for Fullscreen & Hold-to-Unblur
  const handlePointerDown = (item: GDriveItem, e: React.PointerEvent) => {
    if (downloadingItemId) return;
    isLongPressTriggeredRef.current = false;
    pointerStartPosRef.current = { x: e.clientX, y: e.clientY };

    // Jika mode privasi aktif, unblur thumbnail ini seketika saat ditekan
    if (settings.privacyMode && settings.blurImages) {
      setHoldingItemId(item.id);
    }

    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      isLongPressTriggeredRef.current = true;
      setHoldingItemId(null);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate(40);
        } catch (e) {}
      }
      setFullscreenItem(item);
    }, 450); // 450ms untuk tahan lama layar penuh
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!pointerStartPosRef.current) return;
    const dx = Math.abs(e.clientX - pointerStartPosRef.current.x);
    const dy = Math.abs(e.clientY - pointerStartPosRef.current.y);
    // Jika bergeser lebih dari 10px (sedang scroll), batalkan long press
    if (dx > 10 || dy > 10) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      setHoldingItemId(null);
    }
  };

  const handlePointerUp = (item: GDriveItem) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    setHoldingItemId(null);
    pointerStartPosRef.current = null;

    // Jika sudah trigger mode full screen via long-press, jangan pilih gambar
    if (isLongPressTriggeredRef.current) {
      isLongPressTriggeredRef.current = false;
      return;
    }

    // Ketuk biasa: langsung pilih gambar
    handlePickImage(item);
  };

  const handlePointerCancel = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    setHoldingItemId(null);
    pointerStartPosRef.current = null;
    isLongPressTriggeredRef.current = false;
  };

  // Filter gambar & folder berdasarkan pencarian
  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white leading-tight">
                  {title}
                </h3>
                {settings.privacyMode && settings.blurImages && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                    <EyeOff className="w-3 h-3" />
                    <span>Privasi Aktif</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Pilih gambar dan simpan otomatis ke penyimpanan lokal
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => loadFolder(currentFolderId, apiKey)}
              disabled={isLoading || !currentFolderId}
              className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition disabled:opacity-40"
              title="Muat Ulang Folder"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-500' : ''}`} />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Breadcrumb Navigation & Search Bar */}
        <div className="p-3 border-b border-slate-200 dark:border-slate-800/80 bg-slate-100/60 dark:bg-slate-950/40 space-y-2 flex-shrink-0">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs font-semibold py-0.5">
            {folderHistory.map((folder, index) => {
              const isLast = index === folderHistory.length - 1;
              return (
                <React.Fragment key={folder.id}>
                  {index > 0 && <span className="text-slate-400 text-[10px]">/</span>}
                  <button
                    type="button"
                    onClick={() => handleNavigateBack(index)}
                    disabled={isLast}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg transition text-xs whitespace-nowrap ${
                      isLast
                        ? 'bg-amber-500/10 text-amber-800 dark:text-amber-300 font-bold border border-amber-500/20'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Folder className="w-3.5 h-3.5 text-amber-500" />
                    <span>{folder.name}</span>
                  </button>
                </React.Fragment>
              );
            })}
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama gambar atau folder..."
              className="w-full pl-9 pr-4 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-400 shadow-sm"
            />
          </div>
        </div>

        {/* Main Content Area (With Empty Area Long Press Support) */}
        <div
          className="flex-1 overflow-y-auto p-4 select-none"
          {...bindEmptyAreaLongPress()}
        >
          {error && (
            <div className="p-4 mb-3 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1.5 flex-1">
                <p className="font-semibold">{error}</p>
                {onOpenSettings && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenSettings();
                    }}
                    className="inline-flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-300 underline text-xs"
                  >
                    <span>Buka Pengaturan Google Drive</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="py-16 text-center space-y-3">
              <RefreshCw className="w-7 h-7 text-amber-500 animate-spin mx-auto" />
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Mengambil daftar file dan gambar dari Google Drive...
              </p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-16 text-center space-y-2 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">
              <ImageIcon className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {searchQuery ? 'Tidak ada gambar atau folder yang cocok.' : 'Folder ini kosong.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filteredItems.map((item) => {
                if (item.isFolder) {
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleOpenSubfolder(item)}
                      className="group p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/70 hover:bg-amber-50 dark:hover:bg-amber-500/10 border border-slate-200 dark:border-slate-800 hover:border-amber-300 dark:hover:border-amber-500/30 cursor-pointer transition shadow-xs flex flex-col items-center text-center space-y-2"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-amber-500/15 flex items-center justify-center text-amber-600 dark:text-amber-400 group-hover:scale-105 transition-transform">
                        <Folder className="w-6 h-6" />
                      </div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-amber-700 dark:group-hover:text-amber-300 truncate w-full">
                        {item.name}
                      </span>
                      <span className="text-[10px] text-slate-400">Folder</span>
                    </div>
                  );
                }

                const isDownloading = downloadingItemId === item.id;
                // Privacy blur: buram jika privasi aktif KECUALI sedang ditekan (holdingItemId === item.id)
                const isCardPrivacyBlur =
                  settings.privacyMode && settings.blurImages && holdingItemId !== item.id;

                return (
                  <div
                    key={item.id}
                    onPointerDown={(e) => handlePointerDown(item, e)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={() => handlePointerUp(item)}
                    onPointerCancel={handlePointerCancel}
                    onPointerLeave={handlePointerCancel}
                    className="group relative aspect-square rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-amber-400 dark:hover:border-amber-500 cursor-pointer transition shadow-sm hover:shadow-md select-none touch-manipulation"
                  >
                    {item.directUrl ? (
                      <img
                        src={item.directUrl}
                        alt={item.name}
                        loading="lazy"
                        draggable={false}
                        className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${
                          isCardPrivacyBlur
                            ? 'filter blur-md scale-105 select-none'
                            : 'filter blur-0'
                        }`}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400">
                        <ImageIcon className="w-8 h-8" />
                      </div>
                    )}

                    {/* Quick Fullscreen Button in top right */}
                    <div className="absolute top-2 right-2 z-10 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFullscreenItem(item);
                        }}
                        className="p-1.5 rounded-xl bg-black/60 hover:bg-black/85 text-white/90 hover:text-white transition backdrop-blur-sm shadow active:scale-95"
                        title="Lihat Layar Penuh"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-2.5 flex flex-col justify-end text-white pointer-events-none">
                      <span className="text-xs font-semibold truncate leading-tight">
                        {item.name}
                      </span>
                      <span className="text-[10px] text-amber-300 flex items-center gap-1 mt-0.5 font-medium">
                        <Download className="w-3 h-3" />
                        <span>Ketuk untuk simpan</span>
                      </span>
                    </div>

                    {/* Holding unblur indicator */}
                    {holdingItemId === item.id && settings.privacyMode && settings.blurImages && (
                      <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-lg bg-emerald-500/90 text-white text-[9px] font-bold shadow-md animate-pulse">
                        Melihat...
                      </div>
                    )}

                    {/* Loading download spinner */}
                    {isDownloading && (
                      <div className="absolute inset-0 bg-black/70 backdrop-blur-xs flex flex-col items-center justify-center text-white space-y-1.5 p-2 z-20">
                        <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
                        <span className="text-[11px] font-bold text-center">Menyimpan ke lokal...</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-slate-500 flex-shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-[11px]">
            <span>
              💡 Ketuk untuk memilih • <strong>Tahan lama</strong> untuk layar penuh
            </span>
            {settings.privacyMode && settings.blurImages && (
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                (Tahan untuk unblur)
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="self-end sm:self-auto py-1.5 px-4 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold transition text-xs"
          >
            Tutup
          </button>
        </div>

      </div>

      {/* Fullscreen Image Preview with built-in Privacy Blur & Hold-to-Unblur */}
      {fullscreenItem && (
        <ImageViewerModal
          isOpen={Boolean(fullscreenItem)}
          imageUrl={fullscreenItem.directUrl || null}
          title={fullscreenItem.name}
          subtitle="Google Drive • Tahan layar untuk melihat tanpa blur"
          onClose={() => setFullscreenItem(null)}
          onAction={() => {
            const itemToPick = fullscreenItem;
            setFullscreenItem(null);
            handlePickImage(itemToPick);
          }}
          actionLabel="Pilih Gambar Ini"
        />
      )}
    </div>
  );
};
