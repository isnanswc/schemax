import React, { useState } from 'react';
import { Book, StoryChapter, WorldEntity, MediaItem } from '../../types';
import { BookCoverImage } from './BookCoverImage';
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
  Tag
} from 'lucide-react';

interface BookOverviewTabProps {
  book: Book;
  chapters: StoryChapter[];
  entities: WorldEntity[];
  mediaList: MediaItem[];
  onBookUpdated: (updated: Book) => void;
  onNavigateToTab: (tab: any) => void;
}

export const BookOverviewTab: React.FC<BookOverviewTabProps> = ({
  book,
  chapters,
  entities,
  mediaList,
  onBookUpdated,
  onNavigateToTab,
}) => {
  const [synopsis, setSynopsis] = useState(book.synopsis || '');
  const [isEditingSynopsis, setIsEditingSynopsis] = useState(false);
  const [targetWordCount, setTargetWordCount] = useState(book.wordCountTarget || 50000);

  const totalWords = chapters.reduce((sum, c) => sum + (c.wordCount || 0), 0);
  const completedChapters = chapters.filter((c) => c.status === 'completed').length;
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
      {/* Book Hero Card */}
      <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-6 shadow-sm flex flex-col sm:flex-row gap-5">
        {/* Cover Preview & Change Button */}
        <div className="w-32 sm:w-40 mx-auto sm:mx-0 flex-shrink-0 flex flex-col items-center gap-2">
          <BookCoverImage
            mediaId={book.coverMediaId}
            title={book.title}
            aspectRatio="book"
            className="rounded-2xl shadow-xl ring-1 ring-slate-900/10 dark:ring-white/10"
          />
          <label className="text-[11px] text-amber-700 dark:text-amber-400 hover:underline font-semibold cursor-pointer flex items-center gap-1">
            <ImageIcon className="w-3 h-3" />
            <span>Ganti Sampul</span>
            <input type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" />
          </label>
        </div>

        {/* Info & Status Switch */}
        <div className="flex-1 flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium border border-slate-200 dark:border-transparent">
                {book.genre || 'Fiksi'}
              </span>

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

            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-tight">
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
                  className="group cursor-pointer p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-950/40 dark:hover:bg-slate-950/70 border border-slate-200 dark:border-slate-800/60 transition"
                >
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed italic">
                    {book.synopsis || 'Belum ada sinopsis. Klik di sini untuk menambahkan sinopsis.'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Stat Pills */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 dark:border-slate-800/80">
            <button
              onClick={() => onNavigateToTab('chapters')}
              className="bg-slate-50 hover:bg-slate-100 dark:bg-slate-950/60 dark:hover:bg-slate-950 p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-left transition shadow-sm"
            >
              <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 text-xs font-semibold mb-0.5">
                <FileText className="w-3.5 h-3.5" />
                <span>Bab</span>
              </div>
              <span className="text-sm font-bold text-slate-900 dark:text-white">{chapters.length}</span>
            </button>

            <button
              onClick={() => onNavigateToTab('world')}
              className="bg-slate-50 hover:bg-slate-100 dark:bg-slate-950/60 dark:hover:bg-slate-950 p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-left transition shadow-sm"
            >
              <div className="flex items-center gap-1.5 text-pink-600 dark:text-pink-400 text-xs font-semibold mb-0.5">
                <Compass className="w-3.5 h-3.5" />
                <span>Lore</span>
              </div>
              <span className="text-sm font-bold text-slate-900 dark:text-white">{entities.length}</span>
            </button>

            <button
              onClick={() => onNavigateToTab('gallery')}
              className="bg-slate-50 hover:bg-slate-100 dark:bg-slate-950/60 dark:hover:bg-slate-950 p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-left transition shadow-sm"
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

      {/* Progress & Target Section */}
      <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Target Kata & Capaian</h3>
          </div>
          <span className="text-xs font-bold text-amber-700 dark:text-amber-400">{progressPercent}%</span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-3 bg-slate-100 dark:bg-slate-950 rounded-full overflow-hidden border border-slate-200 dark:border-slate-800/80 p-0.5">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
          <span>{totalWords.toLocaleString()} kata tertulis</span>
          <span>Target: {targetWordCount.toLocaleString()} kata</span>
        </div>
      </div>

      {/* Backup & Export */}
      <div className="bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-sm">
        <div>
          <h4 className="text-xs font-bold text-slate-900 dark:text-white">Ekspor & Cadangkan Buku</h4>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Download salinan JSON cerita & worldbuilding ke perangkat Anda
          </p>
        </div>

        <button
          onClick={exportBookJson}
          className="inline-flex items-center gap-1.5 py-2 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white rounded-xl text-xs font-semibold transition active:scale-95 border border-slate-200 dark:border-slate-700 shadow-sm"
        >
          <Download className="w-3.5 h-3.5 text-amber-500" />
          <span>Cadangkan JSON</span>
        </button>
      </div>
    </div>
  );
};
