import React, { useState, useMemo } from 'react';
import { MediaItem, Book, StoryChapter, WorldEntity } from '../../types';
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
  Sparkles,
  BookOpen,
  FileText,
  User,
  Check,
  Search,
  ExternalLink,
  Layers,
  MapPin,
  Shield,
  Scroll,
  Tag
} from 'lucide-react';
import { navStack } from '../../services/backNavigationService';
import { usePrivacy } from '../../contexts/PrivacyContext';
import { ImageViewerModal } from '../common/ImageViewerModal';
import { GDriveMediaPickerModal } from './GDriveMediaPickerModal';

export interface MediaUsage {
  type: 'book' | 'chapter' | 'entity';
  label: string;
  id: string;
}

interface MediaGalleryViewProps {
  bookId: string;
  book?: Book | null;
  chapters?: StoryChapter[];
  entities?: WorldEntity[];
  mediaList: MediaItem[];
  onRefresh: () => void;
  onOpenGDriveSettings?: () => void;
  onBookUpdated?: (updated: Book) => void;
}

// ---------------------------------------------------------------------------
// Sub-Modal: Quick Apply Media Target (Book Cover, Chapter Cover, Entity Avatar)
// ---------------------------------------------------------------------------
interface MediaApplyModalProps {
  isOpen: boolean;
  onClose: () => void;
  mediaItem: MediaItem | null;
  book?: Book | null;
  chapters?: StoryChapter[];
  entities?: WorldEntity[];
  onRefresh: () => void;
  onBookUpdated?: (updated: Book) => void;
}

const MediaApplyModal: React.FC<MediaApplyModalProps> = ({
  isOpen,
  onClose,
  mediaItem,
  book,
  chapters = [],
  entities = [],
  onRefresh,
  onBookUpdated,
}) => {
  const { url } = useMediaUrl(mediaItem?.id);
  const [activeTab, setActiveTab] = useState<'book' | 'chapter' | 'entity'>('book');
  const [chapterSearch, setChapterSearch] = useState('');
  const [entitySearch, setEntitySearch] = useState('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  if (!isOpen || !mediaItem) return null;

  // Check current assignments
  const isBookCover = book?.coverMediaId === mediaItem.id;

  const handleSetBookCover = async (remove = false) => {
    if (!book) return;
    try {
      const newCoverId = remove ? undefined : mediaItem.id;
      await db.books.update(book.id, { coverMediaId: newCoverId, updatedAt: Date.now() });
      const updated = await db.books.get(book.id);
      if (updated && onBookUpdated) onBookUpdated(updated);
      onRefresh();
      showToast(remove ? 'Sampul buku berhasil dilepas.' : `Berhasil dijadikan sampul buku "${book.title}"!`);
    } catch (err) {
      console.error(err);
      alert('Gagal memperbarui sampul buku.');
    }
  };

  const handleSetChapterCover = async (chapter: StoryChapter, remove = false) => {
    try {
      const newCoverId = remove ? undefined : mediaItem.id;
      await db.chapters.update(chapter.id, { coverMediaId: newCoverId, updatedAt: Date.now() });
      onRefresh();
      showToast(
        remove
          ? `Sampul Bab ${chapter.order} berhasil dilepas.`
          : `Berhasil dijadikan sampul Bab ${chapter.order}: ${chapter.title || 'Tanpa Judul'}!`
      );
    } catch (err) {
      console.error(err);
      alert('Gagal memperbarui sampul bab.');
    }
  };

  const handleSetEntityAvatar = async (entity: WorldEntity, remove = false) => {
    try {
      const newAvatarId = remove ? undefined : mediaItem.id;
      await db.worldEntities.update(entity.id, { avatarMediaId: newAvatarId, updatedAt: Date.now() });
      onRefresh();
      showToast(
        remove
          ? `Avatar "${entity.name}" berhasil dilepas.`
          : `Berhasil dijadikan avatar untuk "${entity.name}"!`
      );
    } catch (err) {
      console.error(err);
      alert('Gagal memperbarui avatar entitas.');
    }
  };

  // Filtered chapters & entities
  const filteredChapters = chapters
    .filter((ch) =>
      chapterSearch ? (ch.title || '').toLowerCase().includes(chapterSearch.toLowerCase()) || String(ch.order).includes(chapterSearch) : true
    )
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const filteredEntities = entities.filter((ent) =>
    entitySearch ? ent.name.toLowerCase().includes(entitySearch.toLowerCase()) || (ent.faction || '').toLowerCase().includes(entitySearch.toLowerCase()) : true
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black text-slate-900 dark:text-white truncate">
                Terapkan Media Ini Sebagai...
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {mediaItem.name}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Thumbnail Preview Banner */}
        <div className="p-4 bg-slate-100/70 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3.5">
          <div className="w-16 h-16 rounded-2xl overflow-hidden bg-slate-900 border border-slate-300 dark:border-slate-700 flex-shrink-0 shadow-sm">
            {url ? (
              <img src={url} alt={mediaItem.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-500">
                <ImageIcon className="w-6 h-6" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 text-xs">
            <p className="font-bold text-slate-900 dark:text-slate-100 truncate">{mediaItem.name}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Ukuran: {(mediaItem.size / 1024).toFixed(1)} KB • {mediaItem.mimeType}
            </p>
            {toastMsg && (
              <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1 animate-in fade-in">
                <Check className="w-3.5 h-3.5" />
                <span>{toastMsg}</span>
              </p>
            )}
          </div>
        </div>

        {/* Segmented Tab Controls */}
        <div className="p-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('book')}
            className={`flex-1 py-2 px-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition ${
              activeTab === 'book'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Sampul Buku</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('chapter')}
            className={`flex-1 py-2 px-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition ${
              activeTab === 'chapter'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Sampul Bab ({chapters.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('entity')}
            className={`flex-1 py-2 px-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition ${
              activeTab === 'entity'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Avatar Entitas ({entities.length})</span>
          </button>
        </div>

        {/* Tab Body Content */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3 min-h-[220px]">
          {/* TAB 1: BOOK COVER */}
          {activeTab === 'book' && (
            <div className="space-y-3">
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-amber-500" />
                    <div>
                      <h4 className="text-xs font-black text-slate-900 dark:text-white">
                        {book?.title || 'Buku Ini'}
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        {isBookCover ? 'Gambar ini sedang menjadi sampul utama buku.' : 'Bukan sampul buku saat ini.'}
                      </p>
                    </div>
                  </div>
                  {isBookCover && (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      <span>Aktif</span>
                    </span>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleSetBookCover(false)}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-xs"
                  >
                    <Check className="w-4 h-4" />
                    <span>Jadikan Sampul Buku Utama</span>
                  </button>
                  {isBookCover && (
                    <button
                      type="button"
                      onClick={() => handleSetBookCover(true)}
                      className="py-2.5 px-3 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-rose-100 dark:hover:bg-rose-950 hover:text-rose-600 text-slate-600 dark:text-slate-300 text-xs font-bold transition active:scale-95"
                      title="Lepas dari sampul buku"
                    >
                      Lepas
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CHAPTER COVER */}
          {activeTab === 'chapter' && (
            <div className="space-y-2.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={chapterSearch}
                  onChange={(e) => setChapterSearch(e.target.value)}
                  placeholder="Cari nomor atau judul bab..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              {filteredChapters.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-6">
                  Tidak ada bab yang sesuai.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {filteredChapters.map((ch) => {
                    const isCover = ch.coverMediaId === mediaItem.id;
                    return (
                      <div
                        key={ch.id}
                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition ${
                          isCover
                            ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800'
                            : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                            Bab {ch.order}: {ch.title || 'Tanpa Judul'}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {isCover ? '✅ Sedang digunakan sebagai sampul bab ini' : ch.premise || 'Belum ada premis'}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {isCover ? (
                            <button
                              type="button"
                              onClick={() => handleSetChapterCover(ch, true)}
                              className="px-2.5 py-1 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-[11px] font-bold border border-rose-300 dark:border-rose-800 hover:bg-rose-200 transition"
                            >
                              Lepas
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSetChapterCover(ch, false)}
                              className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-bold transition shadow-xs active:scale-95"
                            >
                              Pilih
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ENTITY AVATAR */}
          {activeTab === 'entity' && (
            <div className="space-y-2.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={entitySearch}
                  onChange={(e) => setEntitySearch(e.target.value)}
                  placeholder="Cari karakter, faksi, atau lokasi..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              {filteredEntities.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-6">
                  Tidak ada entitas yang sesuai.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {filteredEntities.map((ent) => {
                    const isAvatar = ent.avatarMediaId === mediaItem.id;
                    return (
                      <div
                        key={ent.id}
                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition ${
                          isAvatar
                            ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800'
                            : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                              {ent.name}
                            </span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              {ent.category}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 truncate">
                            {isAvatar ? '✅ Sedang digunakan sebagai avatar' : ent.shortDescription || ent.faction || 'Entitas dunia'}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {isAvatar ? (
                            <button
                              type="button"
                              onClick={() => handleSetEntityAvatar(ent, true)}
                              className="px-2.5 py-1 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-[11px] font-bold border border-rose-300 dark:border-rose-800 hover:bg-rose-200 transition"
                            >
                              Lepas
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSetEntityAvatar(ent, false)}
                              className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-bold transition shadow-xs active:scale-95"
                            >
                              Pilih
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Thumbnail Component with Usage Pills & Quick Actions
// ---------------------------------------------------------------------------
const ImageThumbnail: React.FC<{
  item: MediaItem;
  usages: MediaUsage[];
  onSelect: (item: MediaItem) => void;
  onApply: (item: MediaItem) => void;
  onDelete: (id: string, name: string) => void;
}> = ({ item, usages, onSelect, onApply, onDelete }) => {
  const { url, loading } = useMediaUrl(item.id);
  const { getBlurImageClass } = usePrivacy();

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div
      onClick={() => onSelect(item)}
      className="group relative aspect-square rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 hover:border-slate-700 cursor-pointer shadow-sm transition-all hover:shadow-lg active:scale-[0.99]"
    >
      {loading ? (
        <div className="w-full h-full bg-slate-800 animate-pulse flex items-center justify-center">
          <ImageIcon className="w-6 h-6 text-slate-600 animate-bounce" />
        </div>
      ) : url ? (
        <img
          src={url}
          alt={item.name}
          className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${getBlurImageClass()}`}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-slate-600">
          <ImageIcon className="w-8 h-8" />
        </div>
      )}

      {/* Gradient Overlay & Info */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/40 opacity-90 group-hover:opacity-100 transition-opacity p-2.5 flex flex-col justify-between">
        {/* Top Badges & Delete */}
        <div className="flex items-start justify-between gap-1">
          {/* Active Usage Badges */}
          <div className="flex flex-col gap-1 min-w-0 max-w-[70%]">
            {usages.slice(0, 2).map((u, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-amber-500/90 text-slate-950 backdrop-blur-xs truncate shadow-xs"
              >
                {u.type === 'book' ? '📖' : u.type === 'chapter' ? '📑' : '👤'} {u.label}
              </span>
            ))}
            {usages.length > 2 && (
              <span className="text-[9px] font-bold text-amber-400 drop-shadow-xs">
                +{usages.length - 2} tempat lain
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(item.id, item.name);
            }}
            className="p-1 rounded-lg bg-black/60 text-slate-300 hover:text-red-400 hover:bg-black/90 transition shadow-xs"
            title="Hapus Gambar"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Bottom Filename & Apply Button */}
        <div className="space-y-1.5">
          <div className="min-w-0">
            <p className="text-white text-xs font-bold truncate leading-tight drop-shadow-xs">{item.name}</p>
            <span className="text-[10px] text-amber-400/90 font-mono">
              {formatSize(item.size || 0)}
            </span>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onApply(item);
            }}
            className="w-full py-1.5 px-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-black flex items-center justify-center gap-1 transition shadow-sm active:scale-95"
            title="Terapkan sebagai sampul atau avatar"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Terapkan</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main MediaGalleryView
// ---------------------------------------------------------------------------
export const MediaGalleryView: React.FC<MediaGalleryViewProps> = ({
  bookId,
  book,
  chapters = [],
  entities = [],
  mediaList,
  onRefresh,
  onOpenGDriveSettings,
  onBookUpdated,
}) => {
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [applyingMedia, setApplyingMedia] = useState<MediaItem | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isGDrivePickerOpen, setIsGDrivePickerOpen] = useState(false);
  const { url: previewUrl } = useMediaUrl(selectedMedia?.id);

  // Compute map of mediaId -> MediaUsage[]
  const mediaUsagesMap = useMemo(() => {
    const map: Record<string, MediaUsage[]> = {};

    if (book?.coverMediaId) {
      if (!map[book.coverMediaId]) map[book.coverMediaId] = [];
      map[book.coverMediaId].push({ type: 'book', label: 'Sampul Buku', id: book.id });
    }

    chapters.forEach((ch) => {
      if (ch.coverMediaId) {
        if (!map[ch.coverMediaId]) map[ch.coverMediaId] = [];
        map[ch.coverMediaId].push({ type: 'chapter', label: `Bab ${ch.order}`, id: ch.id });
      }
    });

    entities.forEach((ent) => {
      if (ent.avatarMediaId) {
        if (!map[ent.avatarMediaId]) map[ent.avatarMediaId] = [];
        map[ent.avatarMediaId].push({ type: 'entity', label: ent.name, id: ent.id });
      }
    });

    return map;
  }, [book, chapters, entities]);

  const handleOpenPreview = (item: MediaItem) => {
    navStack.push('modal-media-preview', () => setSelectedMedia(null));
    setSelectedMedia(item);
  };

  const handleClosePreview = () => {
    navStack.pop('modal-media-preview');
    setSelectedMedia(null);
  };

  const handleOpenApplyModal = (item: MediaItem) => {
    navStack.push('modal-media-apply', () => setApplyingMedia(null));
    setApplyingMedia(item);
  };

  const handleCloseApplyModal = () => {
    navStack.pop('modal-media-apply');
    setApplyingMedia(null);
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
      if (applyingMedia?.id === id) setApplyingMedia(null);
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

        {/* Action Buttons: GDrive & Upload */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsGDrivePickerOpen(true)}
            className="inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/15 hover:dark:bg-blue-500/25 active:scale-95 text-blue-700 dark:text-blue-300 font-bold rounded-xl text-xs border border-blue-200 dark:border-blue-500/30 transition shadow-sm"
          >
            <HardDrive className="w-4 h-4 text-blue-500" />
            <span>Impor dari GDrive</span>
          </button>

          <label className="inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-95 text-slate-950 font-bold rounded-xl text-xs shadow-md shadow-amber-500/20 cursor-pointer transition">
            <Plus className="w-4 h-4" />
            <span>{isUploading ? 'Menyimpan...' : 'Galeri HP / File'}</span>
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
      </div>

      {/* GDrive Media Picker Modal */}
      <GDriveMediaPickerModal
        isOpen={isGDrivePickerOpen}
        onClose={() => setIsGDrivePickerOpen(false)}
        bookId={bookId}
        title="Impor Gambar dari Google Drive"
        onSelectImage={() => {
          onRefresh();
        }}
        onOpenSettings={onOpenGDriveSettings}
      />

      {/* Media Apply Modal */}
      <MediaApplyModal
        isOpen={!!applyingMedia}
        onClose={handleCloseApplyModal}
        mediaItem={applyingMedia}
        book={book}
        chapters={chapters}
        entities={entities}
        onRefresh={onRefresh}
        onBookUpdated={onBookUpdated}
      />

      {/* Grid of Images */}
      {mediaList.length === 0 ? (
        <div className="text-center py-12 px-4 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl bg-slate-50 dark:bg-slate-900/40">
          <ImageIcon className="w-10 h-10 mx-auto text-slate-400 dark:text-slate-600 mb-3" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Galeri Visual Masih Kosong</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-4">
            Simpan gambar konsep, denah peta dunia, atau potret karakter ke dalam IndexedDB.
          </p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <label className="inline-flex items-center gap-2 py-2 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs cursor-pointer transition shadow-sm active:scale-95">
              <Plus className="w-4 h-4" />
              <span>Galeri HP / File</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            <button
              type="button"
              onClick={() => setIsGDrivePickerOpen(true)}
              className="inline-flex items-center gap-2 py-2 px-4 bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/15 hover:dark:bg-blue-500/25 text-blue-700 dark:text-blue-300 font-bold rounded-xl text-xs border border-blue-200 dark:border-blue-500/30 transition shadow-sm active:scale-95"
            >
              <HardDrive className="w-4 h-4 text-blue-500" />
              <span>Google Drive</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {mediaList.map((item) => (
            <ImageThumbnail
              key={item.id}
              item={item}
              usages={mediaUsagesMap[item.id] || []}
              onSelect={handleOpenPreview}
              onApply={handleOpenApplyModal}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Fullscreen Interactive Zoomable/Pannable Modal */}
      {selectedMedia && previewUrl && (
        <ImageViewerModal
          isOpen={!!selectedMedia}
          imageUrl={previewUrl}
          title={selectedMedia.name}
          subtitle={`Ukuran: ${(selectedMedia.size / 1024).toFixed(1)} KB • Tipe: ${selectedMedia.mimeType}`}
          onClose={handleClosePreview}
          onAction={() => handleOpenApplyModal(selectedMedia)}
          actionLabel="✨ Terapkan Gambar"
        />
      )}
    </div>
  );
};
