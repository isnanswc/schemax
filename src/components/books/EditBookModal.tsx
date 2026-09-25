import React, { useState, useEffect } from 'react';
import { X, Image as ImageIcon, Sparkles, BookOpen, Check, Loader2, RefreshCw, Wand2 } from 'lucide-react';
import { Book, BookStatus } from '../../types';
import { db, saveMediaItem } from '../../db';
import { BookCoverImage } from './BookCoverImage';
import { generateWithSmartFallback } from '../../services/aiService';
import { navStack } from '../../services/backNavigationService';

interface EditBookModalProps {
  isOpen: boolean;
  book: Book;
  onClose: () => void;
  onSuccess?: (updatedBook: Book) => void;
}

const GENRE_SUGGESTIONS = [
  'Fantasi / Isekai',
  'Sci-Fi / Cyberpunk',
  'Romansa / Drama',
  'Misteri / Thriller',
  'Horor / Supernatural',
  'Fiksi Sejarah',
  'Action / Petualangan',
  'Lainnya (Custom)'
];

export const EditBookModal: React.FC<EditBookModalProps> = ({
  isOpen,
  book,
  onClose,
  onSuccess,
}) => {
  const [title, setTitle] = useState(book.title);
  const [synopsis, setSynopsis] = useState(book.synopsis || '');
  const [genre, setGenre] = useState(
    GENRE_SUGGESTIONS.includes(book.genre) ? book.genre : 'Lainnya (Custom)'
  );
  const [customGenre, setCustomGenre] = useState(
    GENRE_SUGGESTIONS.includes(book.genre) ? '' : book.genre
  );
  const [status, setStatus] = useState<BookStatus>(book.status);
  const [wordTarget, setWordTarget] = useState(String(book.wordCountTarget || 50000));
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuccessMessage, setAiSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      navStack.push('modal-edit-book', onClose);
      setTitle(book.title);
      setSynopsis(book.synopsis || '');
      const isKnownGenre = GENRE_SUGGESTIONS.includes(book.genre);
      setGenre(isKnownGenre ? book.genre : 'Lainnya (Custom)');
      setCustomGenre(isKnownGenre ? '' : book.genre);
      setStatus(book.status);
      setWordTarget(String(book.wordCountTarget || 50000));
      setCoverFile(null);
      setCoverPreviewUrl(null);
      setAiError(null);
      setAiSuccessMessage(null);
    }
  }, [isOpen, book]);

  if (!isOpen) return null;

  const handleClose = () => {
    navStack.pop('modal-edit-book');
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverFile(file);
      const url = URL.createObjectURL(file);
      setCoverPreviewUrl(url);
    }
  };

  // Strip HTML utility to extract plain text from story chapters
  const stripHtml = (html: string) => {
    const tmp = document.createElement('DIV');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  // AI Synopsis Generation based on completed/published chapters
  const handleGenerateAiSynopsis = async () => {
    setIsGeneratingAi(true);
    setAiError(null);
    setAiSuccessMessage(null);

    try {
      // 1. Fetch all chapters for this book
      const chapters = await db.chapters.where('bookId').equals(book.id).sortBy('order');

      // 2. Filter completed/published chapters first
      let sourceChapters = chapters.filter(
        (c) => c.status === 'completed' && c.contentHtml && c.contentHtml.length > 30
      );

      // Fallback: if no completed chapters, check chapters with substantial text
      if (sourceChapters.length === 0) {
        sourceChapters = chapters.filter(
          (c) => c.contentHtml && stripHtml(c.contentHtml).trim().length > 50
        );
      }

      // Second fallback: if no text yet, check chapter premises
      if (sourceChapters.length === 0) {
        sourceChapters = chapters.filter((c) => c.premise && c.premise.trim().length > 10);
      }

      if (sourceChapters.length === 0) {
        setAiError(
          'Belum ada bab yang berstatus Selesai (Completed) atau memiliki naskah/premis. Tulis atau ubah status bab menjadi "Selesai" terlebih dahulu.'
        );
        setIsGeneratingAi(false);
        return;
      }

      // 3. Summarize chapters into a compact source text (prevent token overflow)
      const chapterExcerpts = sourceChapters
        .slice(0, 8) // Limit to first 8 chapters
        .map((c, i) => {
          const plainText = stripHtml(c.contentHtml || '').trim();
          const previewText = plainText.length > 500 ? plainText.slice(0, 500) + '...' : plainText;
          return `[Bab ${c.order || i + 1}: ${c.title || 'Tanpa Judul'}] (Status: ${c.status})\n${
            previewText || c.premise || 'Belum ada isi naskah.'
          }`;
        })
        .join('\n\n');

      const selectedGenre = genre === 'Lainnya (Custom)' ? customGenre : genre;

      const prompt = `Anda adalah editor sastra dan story architect novel profesional. Berdasarkan draf dan isi bab-bab yang telah selesai berikut, buatkan sinopsis buku yang kuat, dramatis, dan memikat pembaca (back-cover blurb).

Informasi Buku:
- Judul: "${title.trim() || book.title}"
- Genre: ${selectedGenre || 'Fiksi'}
- Jumlah Bab Sumber: ${sourceChapters.length} bab

Isi Rangkuman Bab Cerita:
${chapterExcerpts}

Instruksi Penulisan:
1. Buat sinopsis sepanjang 2 sampai 3 paragraf dalam Bahasa Indonesia yang hidup dan sastrawi.
2. Paragraf 1: Kenalkan protagonis, latar dunia, dan situasi awal yang mengubah hidupnya.
3. Paragraf 2: Munculkan konflik utama, antagonis atau ancaman, serta dilema moral atau pertaruhan terbesar.
4. Paragraf 3: Kalimat penutup yang memicu rasa penasaran mendalam tanpa membocorkan ending cerita (no spoiler).
5. Berikan HANYA teks sinopsisnya saja secara langsung tanpa kata pengantar atau basa-basi.`;

      const systemPrompt =
        'Anda adalah asisten editor novel dan copywriter buku profesional berbahasa Indonesia.';

      const result = await generateWithSmartFallback(prompt, systemPrompt);

      if (result && result.text) {
        setSynopsis(result.text.trim());
        setAiSuccessMessage(
          `✨ Sinopsis berhasil dirancang dari ${sourceChapters.length} bab (${result.provider.toUpperCase()} / ${result.model})!`
        );
      }
    } catch (err: any) {
      console.error('Gagal generate sinopsis AI:', err);
      setAiError(err.message || 'Gagal menghubungi AI. Pastikan API key sudah dikonfigurasi di AI Config.');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      let coverMediaId = book.coverMediaId;

      if (coverFile) {
        coverMediaId = await saveMediaItem(book.id, coverFile, coverFile.name);
      }

      const finalGenre = genre === 'Lainnya (Custom)' ? (customGenre.trim() || 'Fiksi') : genre;
      const finalWordTarget = parseInt(wordTarget) || book.wordCountTarget || 50000;

      const updatedBook: Book = {
        ...book,
        title: title.trim(),
        synopsis: synopsis.trim(),
        genre: finalGenre,
        status,
        coverMediaId,
        wordCountTarget: finalWordTarget,
        updatedAt: Date.now(),
      };

      await db.books.update(book.id, updatedBook);
      onSuccess?.(updatedBook);
      handleClose();
    } catch (err) {
      console.error('Gagal mengupdate buku:', err);
      alert('Terjadi kesalahan saat menyimpan perubahan buku ke IndexedDB.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full sm:max-w-lg max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-900/90 sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                Edit Informasi Buku
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Perbarui metadata &amp; sampul cerita</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Scrollable Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Status Selection Pill */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Status Buku *
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-950/80 rounded-xl border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setStatus('draft')}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                  status === 'draft'
                    ? 'bg-white dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-500 dark:bg-amber-400" />
                <span>Draft (Draf)</span>
                {status === 'draft' && <Check className="w-3.5 h-3.5 ml-1 text-amber-600 dark:text-amber-400" />}
              </button>

              <button
                type="button"
                onClick={() => setStatus('released')}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                  status === 'released'
                    ? 'bg-white dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                <span>Published (Rilis)</span>
                {status === 'released' && <Check className="w-3.5 h-3.5 ml-1 text-emerald-600 dark:text-emerald-400" />}
              </button>
            </div>
          </div>

          {/* Book Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Judul Cerita / Buku *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Petualangan Menembus Dimensi"
              className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500 text-sm shadow-sm"
            />
          </div>

          {/* Cover Image Upload (IndexedDB Blob) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Sampul Buku (Visual Media)
            </label>
            <div className="flex items-center gap-4">
              <div className="relative w-20 h-28 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-center flex-shrink-0 group shadow-sm">
                {coverPreviewUrl ? (
                  <img
                    src={coverPreviewUrl}
                    alt="Preview Sampul Baru"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <BookCoverImage
                    mediaId={book.coverMediaId}
                    title={title || book.title}
                    aspectRatio="book"
                    className="w-full h-full"
                  />
                )}
              </div>

              <div className="flex-1 space-y-2">
                <label className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 active:scale-95 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl cursor-pointer border border-slate-200 dark:border-slate-700 transition shadow-sm">
                  <ImageIcon className="w-4 h-4 text-amber-500" />
                  <span>{coverFile ? 'Ganti File Lain' : 'Ganti Sampul Buku'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                  Foto disimpan lokal di <strong>IndexedDB</strong> perangkat Anda.
                </p>
              </div>
            </div>
          </div>

          {/* Genre Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Genre / Kategori Cerita
            </label>
            <select
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 text-sm mb-2 shadow-sm"
            >
              {GENRE_SUGGESTIONS.map((g) => (
                <option key={g} value={g} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                  {g}
                </option>
              ))}
            </select>
            {genre === 'Lainnya (Custom)' && (
              <input
                type="text"
                value={customGenre}
                onChange={(e) => setCustomGenre(e.target.value)}
                placeholder="Ketik nama genre kustom..."
                className="w-full px-3.5 py-2 bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-amber-500 shadow-sm"
              />
            )}
          </div>

          {/* Target Word Count */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Target Jumlah Kata (Target Proyek)
            </label>
            <div className="relative">
              <input
                type="number"
                min="1000"
                step="500"
                value={wordTarget}
                onChange={(e) => setWordTarget(e.target.value)}
                placeholder="50000"
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500 text-sm shadow-sm"
              />
              <span className="absolute right-3.5 top-2.5 text-xs text-slate-400 font-medium pointer-events-none">
                kata
              </span>
            </div>
          </div>

          {/* Synopsis with AI Generator Button */}
          <div>
            <div className="flex items-center justify-between mb-1.5 gap-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Sinopsis / Logline Cerita
              </label>

              {/* AI Generator Button */}
              <button
                type="button"
                onClick={handleGenerateAiSynopsis}
                disabled={isGeneratingAi}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200 dark:border-indigo-500/30 hover:bg-indigo-100 dark:hover:bg-indigo-500/25 text-indigo-700 dark:text-indigo-300 text-xs font-bold transition shadow-sm active:scale-95 disabled:opacity-50"
                title="Rancang sinopsis otomatis berdasarkan isi bab yang selesai"
              >
                {isGeneratingAi ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600 dark:text-indigo-400" />
                    <span>Menganalisis Bab...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Generate by AI ✨</span>
                  </>
                )}
              </button>
            </div>

            {/* AI Feedback alerts */}
            {aiSuccessMessage && (
              <div className="p-2 mb-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-[11px] text-emerald-800 dark:text-emerald-300 leading-relaxed">
                {aiSuccessMessage}
              </div>
            )}
            {aiError && (
              <div className="p-2 mb-2 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-[11px] text-red-700 dark:text-red-300 leading-relaxed">
                {aiError}
              </div>
            )}

            <textarea
              rows={4}
              value={synopsis}
              onChange={(e) => setSynopsis(e.target.value)}
              placeholder="Tulis sinopsis atau ketuk 'Generate by AI' untuk merangkum otomatis dari bab yang telah selesai..."
              className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500 text-sm resize-none shadow-sm"
            />
            <div className="flex items-center justify-between mt-1 text-[11px] text-slate-400">
              <span>Rekomendasi: 2 - 3 paragraf logline</span>
              <span>{synopsis.length} karakter</span>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3 sticky bottom-0 bg-white dark:bg-slate-900 py-2">
            <button
              type="button"
              onClick={handleClose}
              className="py-2.5 px-4 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-xs transition"
            >
              Batal
            </button>

            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="py-2.5 px-6 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-95 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Simpan Perubahan</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
