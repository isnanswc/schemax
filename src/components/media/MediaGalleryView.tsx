import React, { useState } from 'react';
import { MediaItem } from '../../types';
import { useMediaUrl } from '../../hooks/useMediaUrl';
import { db, saveMediaItem } from '../../db';
import {
  Image as ImageIcon,
  Plus,
  Trash2,
  Download,
  X,
  HardDrive,
  ZoomIn,
  Sparkles
} from 'lucide-react';
import { navStack } from '../../services/backNavigationService';

interface MediaGalleryViewProps {
  bookId: string;
  mediaList: MediaItem[];
  onRefresh: () => void;
}

const ImageThumbnail: React.FC<{
  item: MediaItem;
  onSelect: (item: MediaItem) => void;
  onDelete: (id: string, name: string) => void;
}> = ({ item, onSelect, onDelete }) => {
  const { url, loading } = useMediaUrl(item.id);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div
      onClick={() => onSelect(item)}
      className="group relative aspect-square rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 hover:border-slate-700 cursor-pointer shadow-sm transition-all hover:shadow-lg active:scale-95"
    >
      {loading ? (
        <div className="w-full h-full bg-slate-800 animate-pulse flex items-center justify-center">
          <ImageIcon className="w-6 h-6 text-slate-600 animate-bounce" />
        </div>
      ) : url ? (
        <img
          src={url}
          alt={item.name}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-slate-600">
          <ImageIcon className="w-8 h-8" />
        </div>
      )}

      {/* Gradient Overlay & Info */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 opacity-90 group-hover:opacity-100 transition-opacity p-2.5 flex flex-col justify-between">
        <div className="flex justify-end">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(item.id, item.name);
            }}
            className="p-1 rounded-lg bg-black/50 text-slate-300 hover:text-red-400 hover:bg-black/80 transition"
            title="Hapus Gambar"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <div>
          <p className="text-white text-xs font-semibold truncate leading-tight">{item.name}</p>
          <span className="text-[10px] text-amber-400/90 font-mono">
            {formatSize(item.size || 0)}
          </span>
        </div>
      </div>
    </div>
  );
};

export const MediaGalleryView: React.FC<MediaGalleryViewProps> = ({
  bookId,
  mediaList,
  onRefresh,
}) => {
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { url: previewUrl } = useMediaUrl(selectedMedia?.id);

  const handleOpenPreview = (item: MediaItem) => {
    navStack.push('modal-media-preview', () => setSelectedMedia(null));
    setSelectedMedia(item);
  };

  const handleClosePreview = () => {
    navStack.pop('modal-media-preview');
    setSelectedMedia(null);
  };

  const totalBytes = mediaList.reduce((acc, m) => acc + (m.size || 0), 0);
  const totalFormatted =
    totalBytes < 1024 * 1024
      ? (totalBytes / 1024).toFixed(1) + ' KB'
      : (totalBytes / (1024 * 1024)).toFixed(2) + ' MB';

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        await saveMediaItem(bookId, file, file.name);
      }
      onRefresh();
    } catch (err) {
      console.error('Gagal mengunggah media:', err);
      alert('Gagal menyimpan file ke IndexedDB.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Hapus gambar "${name}" dari IndexedDB?`)) {
      await db.media.delete(id);
      if (selectedMedia?.id === id) setSelectedMedia(null);
      onRefresh();
    }
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Storage Banner */}
      <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
              Penyimpanan Visual Lokal (IndexedDB)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {mediaList.length} media tersimpan • Total {totalFormatted}
            </p>
          </div>
        </div>

        {/* Upload Button */}
        <label className="inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-95 text-slate-950 font-bold rounded-xl text-xs shadow-md shadow-amber-500/20 cursor-pointer transition">
          <Plus className="w-4 h-4" />
          <span>{isUploading ? 'Menyimpan ke IndexedDB...' : 'Unggah Gambar Baru'}</span>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileUpload}
            disabled={isUploading}
            className="hidden"
          />
        </label>
      </div>

      {/* Grid of Images */}
      {mediaList.length === 0 ? (
        <div className="text-center py-12 px-4 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl bg-slate-50 dark:bg-slate-900/40">
          <ImageIcon className="w-10 h-10 mx-auto text-slate-400 dark:text-slate-600 mb-3" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Galeri Visual Masih Kosong</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-4">
            Simpan gambar konsep, denah peta dunia, atau potret karakter ke dalam IndexedDB.
          </p>
          <label className="inline-flex items-center gap-2 py-2 px-4 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-semibold rounded-xl text-xs border border-slate-300 dark:border-slate-700 cursor-pointer transition shadow-sm">
            <Plus className="w-4 h-4 text-amber-500" />
            <span>Pilih File Gambar</span>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {mediaList.map((item) => (
            <ImageThumbnail
              key={item.id}
              item={item}
              onSelect={handleOpenPreview}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Lightbox Modal */}
      {selectedMedia && previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative max-w-2xl w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95">
            {/* Top Bar */}
            <div className="flex items-center justify-between p-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70">
              <div className="min-w-0 pr-3">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">{selectedMedia.name}</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  MIME: {selectedMedia.mimeType} • Ukuran:{' '}
                  {(selectedMedia.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <button
                onClick={handleClosePreview}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-150 dark:hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Image Preview Canvas */}
            <div className="p-4 flex items-center justify-center max-h-[70vh] bg-slate-100 dark:bg-slate-950/90 overflow-hidden">
              <img
                src={previewUrl}
                alt={selectedMedia.name}
                className="max-h-[60vh] max-w-full object-contain rounded-lg shadow-lg"
              />
            </div>

            {/* Bottom Actions */}
            <div className="p-3 bg-slate-50 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <a
                href={previewUrl}
                download={selectedMedia.name}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-xs font-semibold text-slate-800 dark:text-white transition shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh File</span>
              </a>

              <button
                onClick={() => handleDelete(selectedMedia.id, selectedMedia.name)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-500/10 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus dari IndexedDB</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
