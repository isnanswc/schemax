import React, { useState } from 'react';
import { Book, StoryChapter } from '../../types';
import { X, Printer, FileText, Check, Copy, Eye, BookOpen, Layers } from 'lucide-react';

interface BookPdfExportModalProps {
  isOpen: boolean;
  book: Book;
  chapters: StoryChapter[];
  onClose: () => void;
}

export const BookPdfExportModal: React.FC<BookPdfExportModalProps> = ({
  isOpen,
  book,
  chapters,
  onClose,
}) => {
  const [exportMode, setExportMode] = useState<'all' | 'single'>('all');
  const [selectedChapterId, setSelectedChapterId] = useState<string>(
    chapters[0]?.id || ''
  );
  const [includeCover, setIncludeCover] = useState(true);
  const [includeToc, setIncludeToc] = useState(true);
  const [fontSize, setFontSize] = useState<'sm' | 'md' | 'lg'>('md');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Filter chapters according to mode
  const exportChapters =
    exportMode === 'all'
      ? [...chapters].sort((a, b) => a.order - b.order)
      : chapters.filter((c) => c.id === selectedChapterId);

  // Clean html to printable text / elements
  const cleanHtml = (html?: string) => {
    if (!html) return '<p class="empty-text"><em>(Naskah bab ini belum ditulis)</em></p>';
    return html;
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopyText = () => {
    let text = `${book.title.toUpperCase()}\n`;
    if (book.synopsis) text += `\nSinopsis:\n${book.synopsis}\n\n`;
    text += `=========================================\n\n`;

    exportChapters.forEach((ch) => {
      text += `BAB ${ch.order}: ${ch.title.toUpperCase()}\n\n`;
      const div = document.createElement('div');
      div.innerHTML = ch.contentHtml || ch.premise || '';
      text += `${(div.textContent || div.innerText || '').trim()}\n\n`;
      text += `-----------------------------------------\n\n`;
    });

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      {/* Container */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden my-auto animate-fade-in-up">
        {/* Header (Hidden on print) */}
        <div className="print:hidden flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-2xl bg-amber-500/15 text-amber-500">
              <Printer className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight">
                Cetak / Ekspor PDF Naskah Buku
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pilih bab, atur tata letak, lalu simpan sebagai PDF berkualitas cetak
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Configuration Bar (Hidden on print) */}
        <div className="print:hidden p-4 bg-slate-100/70 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          {/* Export Mode */}
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Cakupan Bab:
            </label>
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setExportMode('all')}
                className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition ${
                  exportMode === 'all'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Seluruh Bab ({chapters.length})
              </button>
              <button
                type="button"
                onClick={() => setExportMode('single')}
                className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition ${
                  exportMode === 'single'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Per Bab
              </button>
            </div>
          </div>

          {/* Select single chapter if mode is single */}
          {exportMode === 'single' ? (
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Pilih Bab:
              </label>
              <select
                value={selectedChapterId}
                onChange={(e) => setSelectedChapterId(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2 font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:border-amber-500"
              >
                {chapters.map((c) => (
                  <option key={c.id} value={c.id}>
                    Bab {c.order}: {c.title || 'Tanpa Judul'} ({c.wordCount || 0} kata)
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Halaman Tambahan:
              </label>
              <div className="flex items-center gap-3 pt-1.5">
                <label className="inline-flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={includeCover}
                    onChange={(e) => setIncludeCover(e.target.checked)}
                    className="rounded text-amber-500 focus:ring-amber-500 w-3.5 h-3.5"
                  />
                  <span>Sampul Buku</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={includeToc}
                    onChange={(e) => setIncludeToc(e.target.checked)}
                    className="rounded text-amber-500 focus:ring-amber-500 w-3.5 h-3.5"
                  />
                  <span>Daftar Isi</span>
                </label>
              </div>
            </div>
          )}

          {/* Font Size & Action Buttons */}
          <div className="flex flex-col justify-between">
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Ukuran Font Dokumen:
            </label>
            <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              {(['sm', 'md', 'lg'] as const).map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setFontSize(sz)}
                  className={`flex-1 py-1 rounded font-bold uppercase ${
                    fontSize === sz
                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white'
                      : 'text-slate-400'
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Live Printable Preview Canvas */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-200/70 dark:bg-slate-950/80">
          <div
            id="schemax-pdf-document"
            className={`max-w-2xl mx-auto bg-white text-slate-900 p-6 sm:p-12 rounded-2xl shadow-xl border border-slate-300/80 font-serif leading-relaxed print:p-0 print:border-none print:shadow-none print:max-w-none print:m-0 ${
              fontSize === 'sm'
                ? 'text-xs sm:text-sm'
                : fontSize === 'lg'
                ? 'text-base sm:text-lg'
                : 'text-sm sm:text-base'
            }`}
          >
            {/* Title / Cover Page */}
            {includeCover && exportMode === 'all' && (
              <div className="text-center py-12 sm:py-20 border-b-2 border-slate-900 mb-12 print:page-break-after">
                <span className="text-xs uppercase tracking-widest font-sans font-bold text-slate-500 block mb-3">
                  {book.genre || 'Novel'}
                </span>
                <h1 className="text-3xl sm:text-4xl font-black font-sans tracking-tight text-slate-950 mb-4">
                  {book.title}
                </h1>
                {book.synopsis && (
                  <p className="text-sm italic text-slate-600 max-w-md mx-auto mb-8 font-sans leading-relaxed">
                    "{book.synopsis}"
                  </p>
                )}
                <div className="pt-8 border-t border-slate-200 inline-block px-8 text-xs font-sans text-slate-400">
                  Total {chapters.length} Bab • Dibuat dengan Schemax Story Studio
                </div>
              </div>
            )}

            {/* Table of Contents */}
            {includeToc && exportMode === 'all' && (
              <div className="mb-12 pb-8 border-b border-slate-200 print:page-break-after">
                <h2 className="text-lg font-sans font-black uppercase tracking-wider text-slate-900 mb-4 pb-1 border-b border-slate-300">
                  Daftar Isi
                </h2>
                <div className="space-y-2 font-sans text-xs">
                  {exportChapters.map((ch) => (
                    <div key={ch.id} className="flex justify-between items-baseline border-b border-dotted border-slate-200 pb-1">
                      <span className="font-semibold text-slate-800">
                        Bab {ch.order}: {ch.title || 'Tanpa Judul'}
                      </span>
                      <span className="text-slate-400 font-mono text-[11px]">
                        {ch.wordCount || 0} kata
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Chapters Content */}
            <div className="space-y-12">
              {exportChapters.map((ch) => (
                <article key={ch.id} className="print:page-break-after">
                  <header className="mb-6 pb-2 border-b border-slate-200 text-center">
                    <span className="text-[11px] font-sans font-bold text-amber-700 tracking-wider uppercase block">
                      Bab {ch.order}
                    </span>
                    <h2 className="text-xl sm:text-2xl font-sans font-black text-slate-900 mt-1">
                      {ch.title || `Bab ${ch.order}`}
                    </h2>
                  </header>

                  <div
                    className="prose prose-slate max-w-none text-justify text-slate-800 leading-relaxed font-serif space-y-3"
                    dangerouslySetInnerHTML={{ __html: cleanHtml(ch.contentHtml) }}
                  />
                </article>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions (Hidden on print) */}
        <div className="print:hidden px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
            Tips: Pada dialog cetak, pilih <strong>"Save as PDF" / "Simpan sebagai PDF"</strong>.
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleCopyText}
              className="py-2.5 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition flex items-center gap-1.5"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Teks Tersalin!' : 'Salin Teks'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="py-2.5 px-5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black transition active:scale-95 shadow-md flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              <span>Simpan / Cetak PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
