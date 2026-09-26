import React, { useState, useEffect } from 'react';
import { X, Upload, Image as ImageIcon, Check, Loader2, Sparkles } from 'lucide-react';
import { WorldEntity, MediaItem } from '../../types';
import { db, saveMediaItem } from '../../db';

interface EntityImagePickerModalProps {
  isOpen: boolean;
  bookId: string;
  entity: WorldEntity | null;
  onClose: () => void;
  onSuccess: (updatedEntity: WorldEntity) => void;
}

export const EntityImagePickerModal: React.FC<EntityImagePickerModalProps> = ({
  isOpen,
  bookId,
  entity,
  onClose,
  onSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'gallery'>('upload');
  const [galleryItems, setGalleryItems] = useState<Array<MediaItem & { url: string }>>([]);
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(entity?.avatarMediaId || null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (entity) {
      setSelectedMediaId(entity.avatarMediaId || null);
    }
  }, [entity]);

  // Load existing media items from the book
  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    db.media
      .where('bookId')
      .equals(bookId)
      .toArray()
      .then((items) => {
        if (!active) return;
        const withUrls = items.map((item) => ({
          ...item,
          url: URL.createObjectURL(item.blob),
        }));
        setGalleryItems(withUrls);
      });

    return () => {
      active = false;
    };
  }, [isOpen, bookId]);

  if (!isOpen || !entity) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFile(file);
      setUploadPreview(URL.createObjectURL(file));
    }
  };

  const handleSaveUpload = async () => {
    if (!uploadFile) return;
    setIsProcessing(true);
    try {
      const mediaId = await saveMediaItem(
        bookId,
        uploadFile,
        `${entity.name}_avatar_${uploadFile.name}`,
        entity.id,
        {
          category: entity.category,
          tags: [entity.name, 'avatar', entity.category],
          caption: `Gambar utama untuk ${entity.name}`,
        }
      );

      const updated = {
        ...entity,
        avatarMediaId: mediaId,
        updatedAt: Date.now(),
      };
      await db.worldEntities.update(entity.id, {
        avatarMediaId: mediaId,
        updatedAt: Date.now(),
      });

      onSuccess(updated);
      onClose();
    } catch (err) {
      console.error('Gagal menyimpan gambar utama:', err);
      alert('Gagal mengunggah gambar utama.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSelectGallery = async (mediaId: string) => {
    setIsProcessing(true);
    try {
      const updated = {
        ...entity,
        avatarMediaId: mediaId,
        updatedAt: Date.now(),
      };
      await db.worldEntities.update(entity.id, {
        avatarMediaId: mediaId,
        updatedAt: Date.now(),
      });

      onSuccess(updated);
      onClose();
    } catch (err) {
      console.error('Gagal memilih gambar utama:', err);
      alert('Gagal menetapkan gambar dari galeri.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="fixed inset-0 bg-slate-900/50 dark:bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-2xl z-10 animate-in zoom-in-95 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-pink-500">Gambar Utama Entitas</span>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Pasang Gambar: {entity.name}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl mb-4 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition ${
              activeTab === 'upload'
                ? 'bg-white dark:bg-slate-800 text-pink-600 dark:text-pink-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Upload dari Perangkat</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('gallery')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition ${
              activeTab === 'gallery'
                ? 'bg-white dark:bg-slate-800 text-pink-600 dark:text-pink-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>Pilih dari Galeri ({galleryItems.length})</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-[220px]">
          {activeTab === 'upload' ? (
            <div className="space-y-4">
              <label className="block border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-pink-500 dark:hover:border-pink-500/80 rounded-2xl p-6 text-center cursor-pointer transition bg-slate-50 dark:bg-slate-950/40">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {uploadPreview ? (
                  <div className="space-y-3">
                    <img
                      src={uploadPreview}
                      alt="Preview Avatar"
                      className="w-32 h-32 rounded-2xl object-cover mx-auto shadow-md border-2 border-pink-500"
                    />
                    <p className="text-xs text-slate-500">Klik untuk mengganti berkas gambar</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="w-12 h-12 rounded-full bg-pink-500/10 text-pink-500 flex items-center justify-center mx-auto">
                      <Upload className="w-6 h-6" />
                    </div>
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      Sentuh atau tarik berkas foto/ilustrasi ke sini
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Mendukung JPG, PNG, WEBP untuk foto karakter, peta lokasi, atau wujud relik
                    </p>
                  </div>
                )}
              </label>

              {uploadFile && (
                <button
                  type="button"
                  onClick={handleSaveUpload}
                  disabled={isProcessing}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-400 hover:to-rose-500 text-white font-bold text-xs shadow-md shadow-pink-500/20 flex items-center justify-center gap-2 transition active:scale-95"
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Pasang Sebagai Gambar Utama</span>
                </button>
              )}
            </div>
          ) : (
            <div>
              {galleryItems.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  <ImageIcon className="w-10 h-10 mx-auto text-slate-500 mb-2" />
                  <p>Belum ada gambar yang diunggah ke buku ini.</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Gunakan tab "Upload dari Perangkat" untuk memasukkan foto pertama.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                  {galleryItems.map((item) => {
                    const isSelected = selectedMediaId === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectGallery(item.id)}
                        disabled={isProcessing}
                        className={`group relative aspect-square rounded-2xl overflow-hidden border-2 transition active:scale-95 text-left ${
                          isSelected
                            ? 'border-pink-500 ring-2 ring-pink-500/30'
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600'
                        }`}
                      >
                        <img
                          src={item.url}
                          alt={item.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                        />
                        {isSelected && (
                          <div className="absolute inset-0 bg-pink-500/30 backdrop-blur-[1px] flex items-center justify-center">
                            <div className="w-7 h-7 rounded-full bg-pink-500 text-white flex items-center justify-center shadow-lg">
                              <Check className="w-4 h-4" />
                            </div>
                          </div>
                        )}
                        <span className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-1 text-[9px] text-white font-medium truncate">
                          {item.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
