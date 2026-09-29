import React, { useState } from 'react';
import { Book, StoryChapter, WorldEntity, MediaItem } from '../../types';
import { BookCoverImage } from './BookCoverImage';
import { EditBookModal } from './EditBookModal';
import { BookPdfExportModal } from './BookPdfExportModal';
import { useMediaUrl } from '../../hooks/useMediaUrl';
import { db, saveMediaItem } from '../../db';
import {
  FileText,
  Compass,
  Image as ImageIcon,
  CheckCircle2,
  Clock,
  Download,
  Upload,
  Calendar,
  Sparkles,
  TrendingUp,
  Tag,
  Edit3,
  X,
  Printer,
  BookOpen,
  Maximize2
} from 'lucide-react';
import { usePrivacy } from '../../contexts/PrivacyContext';
import { ImageViewerModal } from '../common/ImageViewerModal';

interface BookOverviewTabProps {
  book: Book;
  chapters: StoryChapter[];
  entities: WorldEntity[];
  mediaList: MediaItem[];
  onBookUpdated: (updated: Book) => void;
  onNavigateToTab: (tab: any) => void;
  onOpenGDriveSettings?: () => void;
}

export const BookOverviewTab: React.FC<BookOverviewTabProps> = ({
  book,
  chapters,
  entities,
  mediaList,
  onBookUpdated,
  onNavigateToTab,
  onOpenGDriveSettings,
}) => {
  const { getBlurTitleClass, getBlurTextClass, getBlurImageClass } = usePrivacy();
  const [synopsis, setSynopsis] = useState(book.synopsis || '');
  const [isEditingSynopsis, setIsEditingSynopsis] = useState(false);
  const [targetWordCount, setTargetWordCount] = useState(book.wordCountTarget || 50000);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSelectCoverModalOpen, setIsSelectCoverModalOpen] = useState(false);
  const [isPdfExportModalOpen, setIsPdfExportModalOpen] = useState(false);
  const [isCoverFullscreenOpen, setIsCoverFullscreenOpen] = useState(false);

  const { url: coverUrl } = useMediaUrl(book.coverMediaId);

  const totalWords = chapters.reduce((sum, c) => sum + (c.wordCount || 0), 0);
  const completedChapters = chapters.filter((c) => c.status === 'completed');
  const publishedWords = completedChapters.reduce((sum, c) => sum + (c.wordCount || 0), 0);
  
  // Reading Time calculation: average 200 words/minute
  const publishedMinutes = Math.ceil(publishedWords / 200);
  const publishedHours = Math.floor(publishedMinutes / 60);
  const remainingMinutes = publishedMinutes % 60;
  const readingTimeString =
    publishedHours > 0
      ? `${publishedHours} jam ${remainingMinutes > 0 ? `${remainingMinutes} mnt` : ''}`
      : `${publishedMinutes} menit`;

  // Average words per chapter
  const avgWordsPerChapter =
    chapters.length > 0 ? Math.round(totalWords / chapters.length) : 0;

  // Estimated paperback book pages (standard ~250 words per page)
  const estimatedPages = Math.ceil(totalWords / 250);

  const progressPercent = Math.min(100, Math.round((totalWords / (targetWordCount || 1)) * 100));

  const toggleStatus = async () => {
    const nextStatus = book.status === 'draft' ? 'released' : 'draft';
    const updated = { ...book, status: nextStatus, updatedAt: Date.now() };
    await db.books.update(book.id, { status: nextStatus, updatedAt: Date.now() });
    onBookUpdated(updated);
  };

  const saveSynopsis = async () => {
    const updated = { ...book, synopsis: synopsis.trim(), updatedAt: Date.now() };
    await db.books.update(book.id, { synopsis: synopsis.trim(), updatedAt: Date.now() });
    setIsEditingSynopsis(false);
    onBookUpdated(updated);
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const coverMediaId = await saveMediaItem(book.id, file, file.name);
    const updated = { ...book, coverMediaId, updatedAt: Date.now() };
    await db.books.update(book.id, { coverMediaId, updatedAt: Date.now() });
    onBookUpdated(updated);
  };

  const handleSelectCover = async (mediaId: string) => {
    const updated = { ...book, coverMediaId: mediaId, updatedAt: Date.now() };
    await db.books.update(book.id, { coverMediaId: mediaId, updatedAt: Date.now() });
    onBookUpdated(updated);
    setIsSelectCoverModalOpen(false);
  };

  // Export full book project as JSON
  const exportBookJson = () => {
    const data = {
      book,
      chapters,
      entities,
      exportedAt: new Date().toISOString(),
      app: 'Schemax Story Studio',
    };
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${book.title.replace(/[^a-zA-Z0-9]/g, '_')}_backup.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5 pb-24">
      {/* 🌟 1. CINEMATIC HERO BANNER & BOOK IDENTITY */}
      <div className="relative rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md transition-all duration-300">
        {/* Dynamic Blurred Cover Backdrop */}
        {coverUrl && (
          <div
            className="absolute inset-0 bg-cover bg-center scale-110 filter blur-2xl opacity-25 dark:opacity-20 pointer-events-none transition-all duration-500"
            style={{ backgroundImage: `url(${coverUrl})` }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-white/60 via-white/90 to-white dark:from-slate-900/60 dark:via-slate-900/90 dark:to-slate-900 pointer-events-none" />

        <div className="relative p-4 sm:p-6 flex flex-col sm:flex-row gap-5 items-center sm:items-start z-10">
          {/* Cover Preview & Change Button */}
          <div className="w-32 sm:w-44 flex-shrink-0 flex flex-col items-center gap-2 group/cover">
            <div
              onClick={() => coverUrl && setIsCoverFullscreenOpen(true)}
              className="relative cursor-pointer transition-transform duration-300 group-hover/cover:scale-[1.02]"
              title="Klik untuk melihat sampul fullscreen"
            >
              <BookCoverImage
                mediaId={book.coverMediaId}
                title={book.title}
                aspectRatio="book"
                className="rounded-2xl shadow-xl ring-2 ring-black/5 dark:ring-white/10"
              />
              {coverUrl && (
                <div className="absolute bottom-2 right-2 p-1.5 rounded-xl bg-black/60 backdrop-blur-md text-white opacity-0 group-hover/cover:opacity-100 transition-opacity">
                  <Maximize2 className="w-3.5 h-3.5" />
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-0.5">
              <label className="text-[11px] text-amber-700 dark:text-amber-400 hover:underline font-semibold cursor-pointer flex items-center gap-1">
                <Upload className="w-3 h-3" />
                <span>Upload</span>
                <input type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" />
              </label>
              <span className="text-slate-300 dark:text-slate-700 text-xs">•</span>
              <button
                type="button"
                onClick={() => setIsSelectCoverModalOpen(true)}
                className="text-[11px] text-purple-600 dark:text-purple-400 hover:underline font-semibold flex items-center gap-1"
              >
                <ImageIcon className="w-3 h-3" />
                <span>Galeri ({mediaList.length})</span>
              </button>
            </div>
          </div>

          {/* Info & Status Switch */}
          <div className="flex-1 flex flex-col justify-between space-y-3 w-full">
            <div>
              <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100/90 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border border-slate-200 dark:border-transparent">
                  {book.genre || 'Fiksi'}
                </span>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition active:scale-95 shadow-sm"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Edit Info Buku</span>
                  </button>

                  {/* Status Toggle Switch */}
                  <button
                    onClick={toggleStatus}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition active:scale-95 ${
                      book.status === 'released'
                        ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30'
                        : 'bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-400 border-amber-200 dark:border-amber-500/30'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        book.status === 'released' ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                    />
                    <span>Status: {book.status === 'released' ? 'Released' : 'Draft'}</span>
                    <span className="text-[10px] text-slate-400 ml-1">(Klik ganti)</span>
                  </button>
                </div>
              </div>

              <h2 className={`text-xl sm:text-3xl font-black text-slate-900 dark:text-white leading-tight ${getBlurTitleClass()}`}>
                {book.title}
              </h2>

              {/* Synopsis */}
              <div className="mt-3">
                {isEditingSynopsis ? (
                  <div className="space-y-2">
                    <textarea
                      rows={3}
                      value={synopsis}
                      onChange={(e) => setSynopsis(e.target.value)}
                      className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-amber-400 shadow-inner"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={saveSynopsis}
                        className="px-3 py-1 bg-amber-500 text-slate-950 font-bold rounded-lg text-xs"
                      >
                        Simpan
                      </button>
                      <button
                        onClick={() => setIsEditingSynopsis(false)}
                        className="px-3 py-1 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => setIsEditingSynopsis(true)}
                    className="group cursor-pointer p-2.5 rounded-xl bg-slate-50/80 hover:bg-slate-100 dark:bg-slate-950/40 dark:hover:bg-slate-950/70 border border-slate-200 dark:border-slate-800/60 transition"
                  >
                    <p className={`text-xs text-slate-700 dark:text-slate-300 leading-relaxed italic ${getBlurTextClass()}`}>
                      {book.synopsis || 'Belum ada sinopsis. Klik di sini untuk menambahkan sinopsis.'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Navigation Stat Pills */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/80 dark:border-slate-800/80">
              <button
                onClick={() => onNavigateToTab('chapters')}
                className="bg-slate-50/90 hover:bg-slate-100 dark:bg-slate-950/60 dark:hover:bg-slate-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-left transition shadow-xs"
              >
                <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 text-xs font-semibold mb-0.5">
                  <FileText className="w-3.5 h-3.5" />
                  <span>Bab</span>
                </div>
                <span className="text-sm font-bold text-slate-900 dark:text-white">{chapters.length}</span>
              </button>

              <button
                onClick={() => onNavigateToTab('world')}
                className="bg-slate-50/90 hover:bg-slate-100 dark:bg-slate-950/60 dark:hover:bg-slate-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-left transition shadow-xs"
              >
                <div className="flex items-center gap-1.5 text-pink-600 dark:text-pink-400 text-xs font-semibold mb-0.5">
                  <Compass className="w-3.5 h-3.5" />
                  <span>Lore</span>
                </div>
                <span className="text-sm font-bold text-slate-900 dark:text-white">{entities.length}</span>
              </button>

              <button
                onClick={() => onNavigateToTab('gallery')}
                className="bg-slate-50/90 hover:bg-slate-100 dark:bg-slate-950/60 dark:hover:bg-slate-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-left transition shadow-xs"
              >
                <div className="flex items-center gap-1.5 text-cyan-600 dark:text-cyan-400 text-xs font-semibold mb-0.5">
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Media</span>
                </div>
                <span className="text-sm font-bold text-slate-900 dark:text-white">{mediaList.length}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 📊 2. METRIK ANALITIK & ESTIMASI WAKTU BACA */}
      <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Metrik Menulis &amp; Analitik Naskah
            </h3>
          </div>
          <span className="text-xs font-black text-amber-700 dark:text-amber-400">
            {progressPercent}% Target Tercapai
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-3 bg-slate-100 dark:bg-slate-950 rounded-full overflow-hidden border border-slate-200 dark:border-slate-800/80 p-0.5">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* 4 Analytics Grid Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 text-center">
          {/* Card 1: Estimasi Waktu Baca Bab Published */}
          <div className="bg-slate-50 dark:bg-slate-950/60 p-3 rounded-2xl border border-slate-200/90 dark:border-slate-800/90 flex flex-col justify-between">
            <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 mb-1">
              <Clock className="w-3 h-3" />
              <span>Waktu Baca Rilis</span>
            </div>
            <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
              {publishedWords > 0 ? `~${readingTimeString}` : '0 menit'}
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5">
              {completedChapters.length} bab berstatus selesai
            </span>
          </div>

          {/* Card 2: Rata-Rata Kata per Bab */}
          <div className="bg-slate-50 dark:bg-slate-950/60 p-3 rounded-2xl border border-slate-200/90 dark:border-slate-800/90 flex flex-col justify-between">
            <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 mb-1">
              <FileText className="w-3 h-3" />
              <span>Rata-Rata per Bab</span>
            </div>
            <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
              ~{avgWordsPerChapter.toLocaleString()} kata
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5">
              Total {totalWords.toLocaleString()} kata
            </span>
          </div>

          {/* Card 3: Estimasi Halaman Cetak */}
          <div className="bg-slate-50 dark:bg-slate-950/60 p-3 rounded-2xl border border-slate-200/90 dark:border-slate-800/90 flex flex-col justify-between">
            <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mb-1">
              <BookOpen className="w-3 h-3" />
              <span>Estimasi Tebal Buku</span>
            </div>
            <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
              ~{estimatedPages} Halaman
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5">
              Standar novel A5 / Paperback
            </span>
          </div>

          {/* Card 4: Target Keseluruhan */}
          <div className="bg-slate-50 dark:bg-slate-950/60 p-3 rounded-2xl border border-slate-200/90 dark:border-slate-800/90 flex flex-col justify-between">
            <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 mb-1">
              <Sparkles className="w-3 h-3" />
              <span>Target Naskah</span>
            </div>
            <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
              {targetWordCount.toLocaleString()} kata
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5">
              Sisa {Math.max(0, targetWordCount - totalWords).toLocaleString()} kata
            </span>
          </div>
        </div>
      </div>

      {/* 📥 3. EKSPOR & DOKUMEN CETAK (PDF & JSON) */}
      <div className="bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
        <div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Ekspor Naskah &amp; Cadangan Buku</span>
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 max-w-md">
            Cetak naskah rapi ke format PDF (per bab atau seluruh bab dengan preview) atau cadangkan database JSON.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {/* Ekspor PDF Modal Button */}
          <button
            type="button"
            onClick={() => setIsPdfExportModalOpen(true)}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 rounded-2xl text-xs font-black transition active:scale-95 shadow-md shadow-amber-500/20"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak / Ekspor PDF</span>
          </button>

          {/* Backup JSON Button */}
          <button
            type="button"
            onClick={exportBookJson}
            className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white rounded-2xl text-xs font-bold transition active:scale-95 border border-slate-200 dark:border-slate-700 shadow-xs"
            title="Download file cadangan JSON"
          >
            <Download className="w-3.5 h-3.5 text-amber-500" />
            <span>JSON</span>
          </button>
        </div>
      </div>

      {/* Edit Book Modal */}
      <EditBookModal
        isOpen={isEditModalOpen}
        book={book}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={(updated) => {
          onBookUpdated(updated);
          setSynopsis(updated.synopsis || '');
          setTargetWordCount(updated.wordCountTarget || 50000);
        }}
        onOpenGDriveSettings={onOpenGDriveSettings}
      />

      {/* Select Cover from Gallery Modal */}
      {isSelectCoverModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in"
          onClick={() => setIsSelectCoverModalOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400">
                  <ImageIcon className="w-4 h-4" />
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Pilih Sampul Buku dari Galeri</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSelectCoverModalOpen(false)}
                className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {mediaList.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                Belum ada gambar yang diunggah di buku ini.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2.5 p-1 max-h-72 overflow-y-auto">
                {mediaList.map((m) => {
                  const url = URL.createObjectURL(m.blob);
                  const isCurrent = book.coverMediaId === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleSelectCover(m.id)}
                      className={`relative rounded-2xl overflow-hidden border-2 transition active:scale-95 group ${
                        isCurrent
                          ? 'border-amber-500 ring-2 ring-amber-500/30'
                          : 'border-slate-200 dark:border-slate-700 hover:border-amber-400'
                      }`}
                    >
                      <img src={url} alt={m.name} className="w-full h-28 object-cover" />
                      {isCurrent && (
                        <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-amber-500 text-slate-950 font-bold text-[9px]">
                          Aktif
                        </span>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                        <span className="text-[10px] font-bold text-white bg-black/60 px-2 py-0.5 rounded-full">
                          Pilih Ini
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsSelectCoverModalOpen(false)}
                className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Book PDF Export & Print Modal */}
      <BookPdfExportModal
        isOpen={isPdfExportModalOpen}
        book={book}
        chapters={chapters}
        onClose={() => setIsPdfExportModalOpen(false)}
      />

      {/* Cover Fullscreen Modal */}
      {coverUrl && (
        <ImageViewerModal
          isOpen={isCoverFullscreenOpen}
          imageUrl={coverUrl}
          title={`Sampul Buku: ${book.title}`}
          onClose={() => setIsCoverFullscreenOpen(false)}
        />
      )}
    </div>
  );
};
