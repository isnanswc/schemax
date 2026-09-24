import React, { useState } from 'react';
import { X, Image as ImageIcon, Sparkles, BookOpen, Check, Layers } from 'lucide-react';
import { Book, BookStatus } from '../../types';
import { db, saveMediaItem, createSvgBlob } from '../../db';

interface CreateBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newBook: Book) => void;
  initialStatus?: BookStatus;
}

const GENRE_SUGGESTIONS = [
  'Fantasi / Isekai',
  'Sci-Fi / Cyberpunk',
  'Romansa / Drama',
  'Misteri / Thriller',
  'Horor / Supernatural',
  'Fiksi Sejarah',
  'Action / Petualangan'
];

export const CreateBookModal: React.FC<CreateBookModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialStatus = 'draft'
}) => {
  const [title, setTitle] = useState('');
  const [synopsis, setSynopsis] = useState('');
  const [genre, setGenre] = useState(GENRE_SUGGESTIONS[0]);
  const [customGenre, setCustomGenre] = useState('');
  const [status, setStatus] = useState<BookStatus>(initialStatus);
  const [wordTarget, setWordTarget] = useState('50000');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverFile(file);
      const url = URL.createObjectURL(file);
      setCoverPreviewUrl(url);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      const bookId = 'book_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
      let coverMediaId: string | undefined;

      if (coverFile) {
        // Save uploaded user image blob to IndexedDB
        coverMediaId = await saveMediaItem(bookId, coverFile, coverFile.name);
      } else {
        // Generate an elegant SVG gradient cover blob into IndexedDB
        const color = status === 'released' ? '#059669' : '#6366f1';
        const defaultBlob = createSvgBlob(title, color, '📖');
        coverMediaId = await saveMediaItem(bookId, defaultBlob, `${title}-cover.svg`);
      }

      const newBook: Book = {
        id: bookId,
        title: title.trim(),
        synopsis: synopsis.trim(),
        genre: customGenre.trim() || genre,
        status,
        coverMediaId,
        wordCountTarget: parseInt(wordTarget) || 50000,
        currentWordCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await db.books.add(newBook);
      onSuccess(newBook);
      onClose();
    } catch (err) {
      console.error('Gagal membuat buku:', err);
      alert('Terjadi kesalahan saat menyimpan buku ke IndexedDB.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full sm:max-w-lg max-h-[92vh] flex flex-col bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/80 bg-slate-900/90 sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">Buat Karya / Buku Baru</h2>
              <p className="text-xs text-slate-400">Simpan otomatis di IndexedDB lokal</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Scrollable Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Status Selection Pill (Mobile First Segmented Control) */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Status Buku *
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950/80 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setStatus('draft')}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all ${
                  status === 'draft'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                <span>Draft (Draf)</span>
                {status === 'draft' && <Check className="w-3.5 h-3.5 ml-1 text-amber-400" />}
              </button>

              <button
                type="button"
                onClick={() => setStatus('released')}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all ${
                  status === 'released'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>Released (Rilis)</span>
                {status === 'released' && <Check className="w-3.5 h-3.5 ml-1 text-emerald-400" />}
              </button>
            </div>
          </div>

          {/* Book Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Judul Cerita / Buku *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Petualangan Menembus Dimensi"
              className="w-full px-3.5 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/40 text-sm"
            />
          </div>

          {/* Cover Image Upload (IndexedDB Blob) */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Sampul Buku (Visual Media)
            </label>
            <div className="flex items-center gap-4">
              <div className="relative w-20 h-28 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center flex-shrink-0 group">
                {coverPreviewUrl ? (
                  <img
                    src={coverPreviewUrl}
                    alt="Preview Sampul"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-500 p-2 text-center">
                    <ImageIcon className="w-6 h-6 mb-1 text-slate-600" />
                    <span className="text-[10px] leading-tight">Auto Gradient</span>
                  </div>
                )}
              </div>

              <div className="flex-1 space-y-2">
                <label className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700/80 active:scale-95 text-slate-200 text-xs font-medium rounded-xl cursor-pointer border border-slate-700 transition">
                  <ImageIcon className="w-4 h-4 text-amber-400" />
                  <span>Pilih Gambar Sampul</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Disimpan langsung sebagai <strong>Blob di IndexedDB</strong> lokal tanpa upload ke server luar.
                </p>
              </div>
            </div>
          </div>

          {/* Synopsis */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Sinopsis / Logline Singkat
            </label>
            <textarea
              rows={3}
              value={synopsis}
              onChange={(e) => setSynopsis(e.target.value)}
              placeholder="Ceritakan premis utama cerita dalam 1-2 paragraf..."
              className="w-full px-3.5 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/40 text-sm resize-none"
            />
          </div>

          {/* Genre Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Genre / Kategori Cerita
            </label>
            <select
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-500/60 text-sm mb-2"
            >
              {GENRE_SUGGESTIONS.map((g) => (
                <option key={g} value={g} className="bg-slate-900 text-white">
                  {g}
                </option>
              ))}
            </select>
          </div>

          {/* Target Words */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Target Jumlah Kata (Opsional)
            </label>
            <input
              type="number"
              value={wordTarget}
              onChange={(e) => setWordTarget(e.target.value)}
              placeholder="50000"
              className="w-full px-3.5 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60 text-sm"
            />
          </div>

          {/* Submit Actions */}
          <div className="pt-2 pb-1">
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-[0.98] disabled:opacity-50 text-slate-950 font-bold rounded-xl text-sm shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition"
            >
              {isSubmitting ? (
                <>Menyimpan ke IndexedDB...</>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Buat Buku Sekarang</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
