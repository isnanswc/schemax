import React, { useState } from 'react';
import { Book, StoryChapter } from '../../types';
import { X, Printer, FileText, Check, Copy, Eye, BookOpen, Layers } from 'lucide-react';

export type PaperSize = 'a4' | 'letter' | 'a5' | 'b5';

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
  const [paperSize, setPaperSize] = useState<PaperSize>('a4');
  const [includeCover, setIncludeCover] = useState(true);
  const [includeToc, setIncludeToc] = useState(true);
  const [fontSize, setFontSize] = useState<'sm' | 'md' | 'lg'>('md');
  const [lineHeight, setLineHeight] = useState<'tight' | 'normal' | 'relaxed'>('normal');
  const [textAlign, setTextAlign] = useState<'justify' | 'left'>('justify');
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

  // Calculate realistic starting page numbers for TOC based on word counts
  // Standard Paperback / A4 density: ~250 - 300 words per page
  const wordsPerPage = paperSize === 'a5' ? 220 : paperSize === 'b5' ? 250 : 300;
  let runningPage = 1;
  if (includeCover && exportMode === 'all') runningPage += 1;
  if (includeToc && exportMode === 'all') {
    const tocPages = Math.max(1, Math.ceil(exportChapters.length / 28));
    runningPage += tocPages;
  }

  const chaptersWithPageNumbers = exportChapters.map((ch) => {
    const startPage = runningPage;
    const chWords = ch.wordCount || (ch.contentHtml ? ch.contentHtml.replace(/<[^>]*>/g, '').split(/\s+/).length : 0);
    const pagesForThisChapter = Math.max(1, Math.ceil(chWords / wordsPerPage));
    runningPage += pagesForThisChapter;
    return {
      ...ch,
      startPage,
      pageCount: pagesForThisChapter,
    };
  });

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

  // Paper dimension styles for screen preview
  const paperDimensions: Record<PaperSize, string> = {
    a4: 'max-w-[210mm] min-h-[297mm]',
    letter: 'max-w-[216mm] min-h-[279mm]',
    a5: 'max-w-[148mm] min-h-[210mm]',
    b5: 'max-w-[176mm] min-h-[250mm]',
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      {/* Dynamic Print CSS for Page Layout, Margins, and Footers */}
      <style>{`
        @media print {
          @page {
            size: ${paperSize === 'letter' ? 'letter' : paperSize.toUpperCase()};
            margin: 20mm 15mm 20mm 15mm;
            @bottom-center {
              content: counter(page);
              font-family: serif;
              font-size: 10pt;
              color: #475569;
            }
          }
          body {
            background-color: #ffffff !important;
            color: #0f172a !important;
            counter-reset: page 1;
          }
          .print-page-break {
            page-break-after: always !important;
            break-after: page !important;
          }
          .prose-print {
            text-align: ${textAlign} !important;
            text-justify: inter-word !important;
            hyphens: auto !important;
          }
          .prose-print p {
            text-indent: 1.5em !important;
            margin-bottom: 0.5em !important;
            line-height: ${lineHeight === 'relaxed' ? '1.8' : lineHeight === 'tight' ? '1.4' : '1.6'} !important;
          }
          .prose-print p:first-of-type {
            text-indent: 0 !important;
          }
        }
      `}</style>

      {/* Container */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[94vh] overflow-hidden my-auto animate-fade-in-up">
        {/* Header (Hidden on print) */}
        <div className="print:hidden flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-2xl bg-amber-500/15 text-amber-500">
              <Printer className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight">
                Cetak &amp; Ekspor PDF Standar Buku
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Format naskah rapi sesuai aturan tipografi buku internasional (A4, Letter, A5, B5)
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
        <div className="print:hidden p-3.5 bg-slate-100/70 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          {/* 1. Paper Size Layout */}
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
              📐 Ukuran Kertas:
            </label>
            <select
              value={paperSize}
              onChange={(e) => setPaperSize(e.target.value as PaperSize)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-1.5 font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-amber-500 uppercase"
            >
              <option value="a4">A4 (210 x 297 mm) - Standar Dokumen</option>
              <option value="letter">Letter (8.5 x 11 in) - Standar AS</option>
              <option value="a5">A5 (148 x 210 mm) - Standar Novel</option>
              <option value="b5">B5 (176 x 250 mm) - Buku Akademik</option>
            </select>
          </div>

          {/* 2. Export Mode */}
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
              📑 Cakupan Bab:
            </label>
            <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setExportMode('all')}
                className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition text-[11px] ${
                  exportMode === 'all'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Semua ({chapters.length})
              </button>
              <button
                type="button"
                onClick={() => setExportMode('single')}
                className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition text-[11px] ${
                  exportMode === 'single'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Per Bab
              </button>
            </div>
          </div>

          {/* 3. Typography & Justify */}
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
              🖋️ Tipografi &amp; Rata Teks:
            </label>
            <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setTextAlign('justify')}
                className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition text-[11px] ${
                  textAlign === 'justify'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
                title="Rata Kanan-Kiri Presisi (Standar Buku Internasional)"
              >
                Justify (Rapi)
              </button>
              <button
                type="button"
                onClick={() => setTextAlign('left')}
                className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition text-[11px] ${
                  textAlign === 'left'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
                title="Rata Kiri Standar"
              >
                Rata Kiri
              </button>
            </div>
          </div>

          {/* 4. Options & Font size */}
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
              🔤 Ukuran Huruf:
            </label>
            <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
              {(['sm', 'md', 'lg'] as const).map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setFontSize(sz)}
                  className={`flex-1 py-1.5 rounded-lg font-bold uppercase text-[11px] ${
                    fontSize === sz
                      ? 'bg-slate-900 dark:bg-slate-700 text-white'
                      : 'text-slate-400'
                  }`}
                >
                  {sz === 'sm' ? '10pt' : sz === 'md' ? '11.5pt' : '13pt'}
                </button>
              ))}
            </div>
          </div>

          {/* Additional Row: Chapter select or Checkboxes */}
          <div className="col-span-2 sm:col-span-4 flex items-center justify-between gap-4 pt-1 border-t border-slate-200/60 dark:border-slate-800/60 flex-wrap">
            {exportMode === 'single' ? (
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <span className="font-bold text-slate-700 dark:text-slate-300">Pilih Bab:</span>
                <select
                  value={selectedChapterId}
                  onChange={(e) => setSelectedChapterId(e.target.value)}
                  className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-1.5 font-medium text-slate-800 dark:text-slate-200 text-xs"
                >
                  {chapters.map((c) => (
                    <option key={c.id} value={c.id}>
                      Bab {c.order}: {c.title || 'Tanpa Judul'} ({c.wordCount || 0} kata)
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <label className="inline-flex items-center gap-1.5 cursor-pointer font-bold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={includeCover}
                    onChange={(e) => setIncludeCover(e.target.checked)}
                    className="rounded text-amber-500 focus:ring-amber-500 w-3.5 h-3.5"
                  />
                  <span>Halaman Judul</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer font-bold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={includeToc}
                    onChange={(e) => setIncludeToc(e.target.checked)}
                    className="rounded text-amber-500 focus:ring-amber-500 w-3.5 h-3.5"
                  />
                  <span>Daftar Isi dengan Nomor Halaman</span>
                </label>
              </div>
            )}

            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Perkiraan Tebal: <strong>~{runningPage} Halaman Cetak</strong>
            </div>
          </div>
        </div>

        {/* Live Printable Preview Canvas */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-200/70 dark:bg-slate-950/80 flex justify-center">
          <div
            id="schemax-pdf-document"
            className={`w-full ${paperDimensions[paperSize]} bg-white text-slate-900 p-8 sm:p-14 rounded-2xl shadow-xl border border-slate-300/80 font-serif leading-relaxed print:p-0 print:border-none print:shadow-none print:max-w-none print:m-0 transition-all ${
              fontSize === 'sm'
                ? 'text-xs sm:text-[13px]'
                : fontSize === 'lg'
                ? 'text-base sm:text-lg'
                : 'text-sm sm:text-[15px]'
            }`}
          >
            {/* Title / Cover Page */}
            {includeCover && exportMode === 'all' && (
              <div className="text-center py-16 sm:py-24 border-b-2 border-slate-900 mb-14 print-page-break">
                <span className="text-xs uppercase tracking-widest font-sans font-bold text-slate-500 block mb-4">
                  {book.genre || 'Novel'}
                </span>
                <h1 className="text-3xl sm:text-5xl font-black font-sans tracking-tight text-slate-950 mb-5">
                  {book.title}
                </h1>
                {book.synopsis && (
                  <p className="text-sm italic text-slate-600 max-w-lg mx-auto mb-10 font-sans leading-relaxed">
                    "{book.synopsis}"
                  </p>
                )}
                <div className="pt-10 border-t border-slate-200 inline-block px-10 text-xs font-sans text-slate-400">
                  Total {chapters.length} Bab • Dibuat dengan Schemax Story Studio
                </div>
              </div>
            )}

            {/* Table of Contents with Page Numbers */}
            {includeToc && exportMode === 'all' && (
              <div className="mb-14 pb-8 border-b border-slate-200 print-page-break">
                <h2 className="text-xl font-sans font-black uppercase tracking-wider text-slate-900 mb-6 pb-2 border-b-2 border-slate-900 text-center">
                  Daftar Isi
                </h2>
                <div className="space-y-3 font-sans text-xs sm:text-sm">
                  {chaptersWithPageNumbers.map((ch) => (
                    <div
                      key={ch.id}
                      className="flex items-baseline justify-between border-b border-dotted border-slate-300 pb-1.5"
                    >
                      <span className="font-semibold text-slate-800 pr-2">
                        Bab {ch.order}: {ch.title || 'Tanpa Judul'}
                      </span>
                      <span className="text-slate-600 font-mono font-bold pl-2 flex-shrink-0">
                        Hal. {ch.startPage}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Chapters Content */}
            <div className="space-y-16">
              {chaptersWithPageNumbers.map((ch) => (
                <article key={ch.id} className="print-page-break">
                  <header className="mb-8 pb-3 border-b border-slate-200 text-center">
                    <span className="text-xs font-sans font-bold text-amber-700 tracking-widest uppercase block mb-1">
                      Bab {ch.order}
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-sans font-black text-slate-900">
                      {ch.title || `Bab ${ch.order}`}
                    </h2>
                    <span className="text-[10px] font-sans text-slate-400 mt-1 block">
                      Halaman {ch.startPage}
                    </span>
                  </header>

                  <div
                    className={`prose-print max-w-none text-slate-900 leading-relaxed font-serif space-y-3 ${
                      textAlign === 'justify' ? 'text-justify' : 'text-left'
                    }`}
                    style={{
                      textJustify: 'inter-word',
                      lineHeight: lineHeight === 'relaxed' ? 1.85 : lineHeight === 'tight' ? 1.45 : 1.65,
                    }}
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
