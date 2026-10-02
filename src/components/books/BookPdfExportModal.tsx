import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Book, StoryChapter } from '../../types';
import { db } from '../../db';
import {
  X,
  Printer,
  FileText,
  Check,
  Copy,
  BookOpen,
  Layers,
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
  ChevronDown
} from 'lucide-react';

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
  const [includeChapterCover, setIncludeChapterCover] = useState(true);
  const [includeInlineImages, setIncludeInlineImages] = useState(true);
  const [includeToc, setIncludeToc] = useState(true);
  const [fontSize, setFontSize] = useState<'sm' | 'md' | 'lg'>('md');
  const [lineHeight, setLineHeight] = useState<'tight' | 'normal' | 'relaxed'>('normal');
  const [textAlign, setTextAlign] = useState<'justify' | 'left'>('justify');
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [copied, setCopied] = useState(false);

  // Loaded Media Object URLs
  const [bookCoverUrl, setBookCoverUrl] = useState<string | null>(book.coverImageUrl || null);
  const [chapterCovers, setChapterCovers] = useState<Record<string, string>>({});

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Load Book Cover and Chapter Covers from IndexedDB blob store
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    const createdUrls: string[] = [];

    const loadCovers = async () => {
      // 1. Book Cover
      if (book.coverMediaId) {
        try {
          const item = await db.media.get(book.coverMediaId);
          if (item && item.blob && isMounted) {
            const url = URL.createObjectURL(item.blob);
            createdUrls.push(url);
            setBookCoverUrl(url);
          }
        } catch (err) {
          console.error('Failed to load book cover from db.media:', err);
        }
      } else if (book.coverImageUrl) {
        setBookCoverUrl(book.coverImageUrl);
      } else {
        setBookCoverUrl(null);
      }

      // 2. Chapter Covers
      const chCoverMap: Record<string, string> = {};
      for (const ch of chapters) {
        if (ch.coverImageUrl) {
          chCoverMap[ch.id] = ch.coverImageUrl;
        }
        if (ch.coverMediaId) {
          try {
            const item = await db.media.get(ch.coverMediaId);
            if (item && item.blob && isMounted) {
              const url = URL.createObjectURL(item.blob);
              createdUrls.push(url);
              chCoverMap[ch.id] = url;
            }
          } catch (err) {
            console.error(`Failed to load cover for chapter ${ch.id}:`, err);
          }
        }
      }
      if (isMounted) {
        setChapterCovers(chCoverMap);
      }
    };

    loadCovers();

    return () => {
      isMounted = false;
      createdUrls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [isOpen, book.id, book.coverMediaId, book.coverImageUrl, chapters]);

  if (!isOpen) return null;

  // Filter chapters according to mode
  const exportChapters =
    exportMode === 'all'
      ? [...chapters].sort((a, b) => a.order - b.order)
      : chapters.filter((c) => c.id === selectedChapterId);

  // Clean html to printable text / elements
  const cleanHtml = (html?: string) => {
    if (!html) return '<p class="empty-text italic text-slate-400"><em>(Naskah bab ini belum ditulis)</em></p>';
    if (!includeInlineImages) {
      // Strip story-image-block figures and inline images if user opted out
      return html
        .replace(/<figure[^>]*class="[^"]*story-image-block[^"]*"[^>]*>[\s\S]*?<\/figure>/gi, '')
        .replace(/<figure[^>]*>[\s\S]*?<\/figure>/gi, '')
        .replace(/<img[^>]*>/gi, '');
    }
    return html;
  };

  // Calculate realistic starting page numbers for TOC based on word counts
  const wordsPerPage = paperSize === 'a5' ? 220 : paperSize === 'b5' ? 250 : 300;
  let runningPage = 1;
  if (includeCover && exportMode === 'all') runningPage += 1;
  if (includeToc && exportMode === 'all') {
    const tocPages = Math.max(1, Math.ceil(exportChapters.length / 28));
    runningPage += tocPages;
  }

  const chaptersWithPageNumbers = exportChapters.map((ch) => {
    const startPage = runningPage;
    const chWords = ch.wordCount || (ch.contentHtml ? ch.contentHtml.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length : 0);
    const coverExtra = (includeChapterCover && chapterCovers[ch.id]) ? 0.75 : 0;
    const pagesForThisChapter = Math.max(1, Math.ceil((chWords / wordsPerPage) + coverExtra));
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

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 15, 150));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 15, 60));
  const handleZoomReset = () => setZoomLevel(100);

  const handleJumpToSheet = (targetId: string) => {
    if (!targetId) return;
    const el = document.getElementById(targetId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Paper dimension styles for screen preview
  const paperDimensions: Record<PaperSize, string> = {
    a4: 'max-w-[210mm] min-h-[297mm]',
    letter: 'max-w-[216mm] min-h-[279mm]',
    a5: 'max-w-[148mm] min-h-[210mm]',
    b5: 'max-w-[176mm] min-h-[250mm]',
  };

  const fontSizeClass =
    fontSize === 'sm'
      ? 'text-xs sm:text-[13px]'
      : fontSize === 'lg'
      ? 'text-base sm:text-lg'
      : 'text-sm sm:text-[15px]';

  // Common styles for each physical sheet card in preview
  const sheetCommonStyle = `schemax-preview-sheet w-full ${paperDimensions[paperSize]} bg-white text-slate-900 shadow-2xl rounded-2xl border border-slate-300/90 font-serif leading-relaxed p-8 sm:p-14 transition-all print:p-0 print:border-none print:shadow-none print:rounded-none print:max-w-none print:m-0 print:bg-transparent print:block flex flex-col justify-between ${fontSizeClass}`;

  const modalContent = (
    <div className="schemax-modal-backdrop fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:m-0 print:bg-white print:overflow-visible print:static print:inset-auto print:h-auto print:w-full print:block">
      {/* Dynamic Print CSS for Page Layout, Margins, Page-Breaks, and Isolation */}
      <style>{`
        @media print {
          @page {
            size: ${paperSize === 'letter' ? 'letter' : paperSize.toUpperCase()};
            margin: 18mm 15mm 20mm 15mm;
            @bottom-center {
              content: counter(page);
              font-family: 'Times New Roman', Times, serif;
              font-size: 9pt;
              color: #475569;
            }
          }

          /* Hide entire React root outside of this portal */
          #root {
            display: none !important;
          }

          /* Ensure html & body flow infinitely without clipping viewports */
          html, body {
            background: #ffffff !important;
            background-color: #ffffff !important;
            color: #0f172a !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            min-height: 100% !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Hide non-print UI bars */
          .schemax-no-print,
          .print\\:hidden {
            display: none !important;
          }

          /* Reset all modal containers so they don't clip */
          .schemax-modal-backdrop,
          .schemax-modal-card,
          .schemax-preview-wrapper,
          .schemax-preview-sheet-wrapper {
            position: static !important;
            inset: auto !important;
            width: 100% !important;
            max-width: none !important;
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: transparent !important;
            border-radius: 0 !important;
            transform: none !important;
            backdrop-filter: none !important;
            display: block !important;
          }

          /* The printable book document container */
          #schemax-pdf-document {
            position: static !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            background: #ffffff !important;
            color: #0f172a !important;
            overflow: visible !important;
            height: auto !important;
            transform: none !important;
            display: block !important;
          }

          /* Sheet container reset on print */
          .schemax-preview-sheet {
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            background: transparent !important;
            width: 100% !important;
            max-width: 100% !important;
            min-height: 0 !important;
          }

          /* 1. Halaman Sampul Buku (Cover): Halaman 1 mandiri */
          .schemax-book-cover-page {
            page-break-before: auto !important;
            break-before: auto !important;
            page-break-after: always !important;
            break-after: page !important;
            min-height: 88vh !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: center !important;
            align-items: center !important;
            text-align: center !important;
            box-sizing: border-box !important;
            padding: 15mm 10mm !important;
          }

          /* 2. Halaman Daftar Isi (TOC): Mulai di halaman baru & akhiri halaman */
          .schemax-toc-page {
            page-break-before: always !important;
            break-before: page !important;
            page-break-after: always !important;
            break-after: page !important;
            min-height: auto !important;
            display: block !important;
            box-sizing: border-box !important;
            padding-top: 10mm !important;
          }

          /* 3. Setiap Bab: PASTI dimulai di lembar baru */
          .schemax-chapter-article {
            page-break-before: always !important;
            break-before: page !important;
            break-inside: auto !important;
            display: block !important;
            width: 100% !important;
            clear: both !important;
            box-sizing: border-box !important;
            padding-top: 10mm !important;
          }

          /* Jika bab adalah elemen pertama di dokumen (tanpa cover/toc atau mode per bab), mulai langsung di hal 1 */
          .schemax-printable-doc > .schemax-preview-sheet-wrapper:first-child .schemax-chapter-article {
            page-break-before: auto !important;
            break-before: auto !important;
            padding-top: 0 !important;
          }

          .schemax-chapter-header {
            page-break-after: avoid !important;
            break-after: avoid !important;
            margin-bottom: 18pt !important;
          }

          /* 4. Gambar: Sampul Buku, Sampul Bab, dan Gambar Sisipan */
          img {
            max-width: 100% !important;
            height: auto !important;
            object-fit: contain !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .schemax-book-cover-img {
            max-width: 80% !important;
            max-height: 52vh !important;
            width: auto !important;
            height: auto !important;
            object-fit: contain !important;
            margin: 0 auto 18pt auto !important;
            border-radius: 6pt !important;
            display: block !important;
          }

          .schemax-chapter-cover-box {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
            margin: 0 auto 16pt auto !important;
            text-align: center !important;
            width: 100% !important;
          }

          .schemax-chapter-cover-img {
            max-width: 100% !important;
            max-height: 280pt !important;
            width: auto !important;
            height: auto !important;
            object-fit: contain !important;
            margin: 0 auto !important;
            border-radius: 6pt !important;
            display: block !important;
          }

          /* Gambar sisipan di dalam naskah cerita */
          .story-image-block,
          figure {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin: 16pt auto !important;
            padding: 0 !important;
            background: transparent !important;
            border: none !important;
            text-align: center !important;
            width: 100% !important;
            display: block !important;
          }

          .story-image-block img,
          figure img {
            max-width: 100% !important;
            max-height: 380pt !important;
            width: auto !important;
            height: auto !important;
            margin: 0 auto !important;
            border-radius: 4pt !important;
            object-fit: contain !important;
            display: block !important;
          }

          figcaption {
            font-size: 9pt !important;
            color: #475569 !important;
            font-style: italic !important;
            margin-top: 6pt !important;
            text-align: center !important;
            page-break-before: avoid !important;
            break-before: avoid !important;
          }

          .entity-tag-pill {
            font-size: 8pt !important;
            padding: 1pt 5pt !important;
            border: 0.5pt solid #cbd5e1 !important;
            color: #475569 !important;
            background: #f8fafc !important;
            border-radius: 9999px !important;
            display: inline-block !important;
          }

          /* Tipografi & Paragraf */
          .prose-print {
            text-align: ${textAlign} !important;
            text-justify: inter-word !important;
            hyphens: auto !important;
            font-size: ${fontSize === 'sm' ? '10pt' : fontSize === 'lg' ? '13pt' : '11.5pt'} !important;
          }
          .prose-print p {
            text-indent: 1.5em !important;
            margin-bottom: 0.6em !important;
            line-height: ${lineHeight === 'relaxed' ? '1.8' : lineHeight === 'tight' ? '1.4' : '1.6'} !important;
            orphans: 3 !important;
            widows: 3 !important;
          }
          .prose-print p:first-of-type {
            text-indent: 0 !important;
          }
        }
      `}</style>

      {/* Modal Dialog Card */}
      <div className="schemax-modal-card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-6xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden my-auto print:max-h-none print:h-auto print:border-none print:shadow-none print:rounded-none print:overflow-visible print:w-full print:block print:m-0 print:p-0 animate-fade-in-up">
        {/* Header (Hidden on print) */}
        <div className="schemax-no-print print:hidden flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-2xl bg-amber-500/15 text-amber-500">
              <Printer className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight">
                Preview &amp; Cetak PDF Standar Buku
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tampilan lembar cetak presisi (A4, Letter, A5 Novel, B5 Akademik)
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
        <div className="schemax-no-print print:hidden p-3.5 bg-slate-100/80 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800/80 space-y-3 text-xs">
          {/* Main Controls Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                <option value="a4">A4 (210 x 297 mm) - Dokumen</option>
                <option value="letter">Letter (8.5 x 11 in) - Standar AS</option>
                <option value="a5">A5 (148 x 210 mm) - Standar Novel</option>
                <option value="b5">B5 (176 x 250 mm) - Akademik</option>
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

            {/* 4. Font size */}
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
          </div>

          {/* Sub Row: Checkbox Options & Jump / Zoom Controls */}
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-200/70 dark:border-slate-800/70 flex-wrap">
            {exportMode === 'single' ? (
              <div className="flex items-center gap-2 flex-1 min-w-[240px]">
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
              <div className="flex items-center gap-4 flex-wrap">
                <label className="inline-flex items-center gap-1.5 cursor-pointer font-bold text-slate-700 dark:text-slate-300 select-none">
                  <input
                    type="checkbox"
                    checked={includeCover}
                    onChange={(e) => setIncludeCover(e.target.checked)}
                    className="rounded text-amber-500 focus:ring-amber-500 w-3.5 h-3.5"
                  />
                  <span>Sampul Buku</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer font-bold text-slate-700 dark:text-slate-300 select-none">
                  <input
                    type="checkbox"
                    checked={includeToc}
                    onChange={(e) => setIncludeToc(e.target.checked)}
                    className="rounded text-amber-500 focus:ring-amber-500 w-3.5 h-3.5"
                  />
                  <span>Daftar Isi</span>
                </label>
              </div>
            )}

            {/* Image Checkboxes */}
            <div className="flex items-center gap-3.5 flex-wrap">
              <label className="inline-flex items-center gap-1.5 cursor-pointer font-bold text-slate-700 dark:text-slate-300 select-none">
                <input
                  type="checkbox"
                  checked={includeChapterCover}
                  onChange={(e) => setIncludeChapterCover(e.target.checked)}
                  className="rounded text-amber-500 focus:ring-amber-500 w-3.5 h-3.5"
                />
                <span>Sampul Bab</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer font-bold text-slate-700 dark:text-slate-300 select-none">
                <input
                  type="checkbox"
                  checked={includeInlineImages}
                  onChange={(e) => setIncludeInlineImages(e.target.checked)}
                  className="rounded text-amber-500 focus:ring-amber-500 w-3.5 h-3.5"
                />
                <span>Gambar Sisipan</span>
              </label>
            </div>

            {/* Quick Preview Sheet Navigator & Zoom Controls */}
            <div className="flex items-center gap-2 ml-auto">
              {/* Jump to sheet */}
              <div className="flex items-center gap-1">
                <span className="font-bold text-slate-600 dark:text-slate-400 text-[11px] hidden sm:inline">
                  Lompat:
                </span>
                <select
                  onChange={(e) => handleJumpToSheet(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 focus:outline-none"
                  defaultValue=""
                >
                  <option value="" disabled>
                    Pilih Lembar
                  </option>
                  {includeCover && exportMode === 'all' && (
                    <option value="preview-sheet-cover">Hal. 1: Sampul Buku</option>
                  )}
                  {includeToc && exportMode === 'all' && (
                    <option value="preview-sheet-toc">Hal. 2: Daftar Isi</option>
                  )}
                  {chaptersWithPageNumbers.map((ch) => (
                    <option key={ch.id} value={`preview-sheet-ch-${ch.id}`}>
                      Bab {ch.order}: {ch.title || 'Tanpa Judul'} (Hal. {ch.startPage})
                    </option>
                  ))}
                </select>
              </div>

              {/* Zoom Buttons */}
              <div className="flex items-center gap-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={handleZoomOut}
                  disabled={zoomLevel <= 60}
                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40"
                  title="Perkecil Preview"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleZoomReset}
                  className="px-1 text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300 hover:text-amber-600"
                  title="Reset Zoom 100%"
                >
                  {zoomLevel}%
                </button>
                <button
                  type="button"
                  onClick={handleZoomIn}
                  disabled={zoomLevel >= 150}
                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40"
                  title="Perbesar Preview"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Live Printable Preview Canvas (Drafting Desk Environment) */}
        <div className="schemax-preview-wrapper flex-1 overflow-y-auto p-4 sm:p-10 bg-slate-300/80 dark:bg-slate-950/90 flex flex-col items-center print:p-0 print:m-0 print:bg-white print:overflow-visible print:block print:w-full print:h-auto">
          <div
            id="schemax-pdf-document"
            style={{
              transform: zoomLevel !== 100 ? `scale(${zoomLevel / 100})` : undefined,
              transformOrigin: 'top center',
              transition: 'transform 0.15s ease-out',
            }}
            className="schemax-printable-doc w-full flex flex-col items-center space-y-10 print:space-y-0 print:transform-none"
          >
            {/* SHEET 1: Title / Cover Page (Dedicated Physical Sheet in Preview) */}
            {includeCover && exportMode === 'all' && (
              <div className="schemax-preview-sheet-wrapper w-full flex flex-col items-center">
                {/* Screen-only Sheet Header Bar */}
                <div className="schemax-no-print w-full max-w-[210mm] flex items-center justify-between text-[11px] font-sans font-bold text-slate-600 dark:text-slate-400 px-2 mb-1.5 select-none">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block shadow-xs" />
                    Lembar 1 • Halaman Sampul Buku
                  </span>
                  <span className="uppercase text-[10px] bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded-md font-mono">
                    {paperSize.toUpperCase()}
                  </span>
                </div>

                {/* The Physical Sheet */}
                <div
                  id="preview-sheet-cover"
                  className={`schemax-book-cover-page ${sheetCommonStyle}`}
                >
                  <div className="max-w-md mx-auto w-full flex flex-col items-center justify-center my-auto text-center py-6">
                    {/* Book Cover Image if available */}
                    {bookCoverUrl ? (
                      <div className="mb-6 sm:mb-8 w-full flex justify-center">
                        <img
                          src={bookCoverUrl}
                          alt={`Sampul ${book.title}`}
                          className="schemax-book-cover-img max-h-[380px] sm:max-h-[460px] w-auto max-w-[85%] object-contain rounded-xl shadow-2xl border border-slate-200 print:shadow-none print:border-none"
                        />
                      </div>
                    ) : (
                      <div className="mb-8 w-44 h-60 rounded-2xl bg-amber-50/80 border-2 border-dashed border-amber-300 flex flex-col items-center justify-center p-4 text-amber-700 shadow-inner schemax-no-print">
                        <BookOpen className="w-12 h-12 mb-2 opacity-50" />
                        <span className="text-xs font-sans font-bold text-center">
                          (Belum Ada Gambar Sampul Buku)
                        </span>
                      </div>
                    )}

                    <span className="text-xs uppercase tracking-widest font-sans font-bold text-amber-800 block mb-3">
                      {book.genre || 'Novel'}
                    </span>
                    <h1 className="text-3xl sm:text-5xl font-black font-sans tracking-tight text-slate-950 mb-4 leading-tight">
                      {book.title}
                    </h1>
                    {book.synopsis && (
                      <p className="text-xs sm:text-sm italic text-slate-600 max-w-lg mx-auto mb-8 font-sans leading-relaxed">
                        "{book.synopsis}"
                      </p>
                    )}
                    <div className="pt-6 border-t border-slate-300 inline-block px-8 text-xs font-sans text-slate-500">
                      Total {chapters.length} Bab • Schemax Story Studio
                    </div>
                  </div>

                  {/* Screen-only Sheet Bottom Page Counter */}
                  <div className="schemax-no-print pt-6 border-t border-slate-100 flex items-center justify-between text-[11px] font-sans text-slate-400">
                    <span>{book.title}</span>
                    <span>Halaman 1 (Sampul)</span>
                  </div>
                </div>
              </div>
            )}

            {/* SHEET 2: Table of Contents (Dedicated Physical Sheet in Preview) */}
            {includeToc && exportMode === 'all' && (
              <div className="schemax-preview-sheet-wrapper w-full flex flex-col items-center">
                {/* Screen-only Sheet Header Bar */}
                <div className="schemax-no-print w-full max-w-[210mm] flex items-center justify-between text-[11px] font-sans font-bold text-slate-600 dark:text-slate-400 px-2 mb-1.5 select-none">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block shadow-xs" />
                    Lembar 2 • Daftar Isi
                  </span>
                  <span className="uppercase text-[10px] bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded-md font-mono">
                    {paperSize.toUpperCase()}
                  </span>
                </div>

                {/* The Physical Sheet */}
                <div
                  id="preview-sheet-toc"
                  className={`schemax-toc-page ${sheetCommonStyle}`}
                >
                  <div className="w-full max-w-2xl mx-auto flex-1 flex flex-col">
                    <h2 className="text-xl sm:text-2xl font-sans font-black uppercase tracking-wider text-slate-900 mb-8 pb-3 border-b-2 border-slate-900 text-center">
                      Daftar Isi
                    </h2>
                    <div className="space-y-3 font-sans text-xs sm:text-sm flex-1">
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

                  {/* Screen-only Sheet Bottom Page Counter */}
                  <div className="schemax-no-print pt-6 border-t border-slate-100 flex items-center justify-between text-[11px] font-sans text-slate-400 mt-8">
                    <span>{book.title} • Daftar Isi</span>
                    <span>Halaman 2</span>
                  </div>
                </div>
              </div>
            )}

            {/* SHEETS 3..N: Chapters (Each Chapter as a Physical Sheet in Preview) */}
            {chaptersWithPageNumbers.map((ch) => (
              <div key={ch.id} className="schemax-preview-sheet-wrapper w-full flex flex-col items-center">
                {/* Screen-only Sheet Header Bar */}
                <div className="schemax-no-print w-full max-w-[210mm] flex items-center justify-between text-[11px] font-sans font-bold text-slate-600 dark:text-slate-400 px-2 mb-1.5 select-none">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block shadow-xs" />
                    Bab {ch.order} • {ch.title || 'Tanpa Judul'}
                  </span>
                  <span className="font-mono text-[10px] bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded-md font-bold">
                    Mulai Hal. {ch.startPage}
                  </span>
                </div>

                {/* The Physical Sheet */}
                <article
                  id={`preview-sheet-ch-${ch.id}`}
                  className={`schemax-chapter-article ${sheetCommonStyle}`}
                >
                  <header className="schemax-chapter-header mb-8 pb-3 border-b border-slate-200 text-center">
                    <span className="text-xs font-sans font-bold text-amber-700 tracking-widest uppercase block mb-1">
                      Bab {ch.order}
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-sans font-black text-slate-900 mb-1">
                      {ch.title || `Bab ${ch.order}`}
                    </h2>
                    <span className="text-[10px] font-sans text-slate-400 block print:hidden">
                      Perkiraan Halaman {ch.startPage} • {ch.wordCount || 0} Kata
                    </span>
                  </header>

                  {/* Chapter Cover Image if available & enabled */}
                  {includeChapterCover && chapterCovers[ch.id] && (
                    <div className="schemax-chapter-cover-box my-6">
                      <img
                        src={chapterCovers[ch.id]}
                        alt={`Sampul Bab ${ch.order}: ${ch.title}`}
                        className="schemax-chapter-cover-img max-h-[300px] w-auto max-w-full object-contain mx-auto rounded-xl shadow-md border border-slate-200 print:shadow-none print:border-none"
                      />
                      <p className="text-[10px] italic text-slate-500 mt-2 font-sans text-center print:hidden">
                        Ilustrasi Sampul Bab {ch.order}
                      </p>
                    </div>
                  )}

                  {/* Chapter Manuscript Content */}
                  <div
                    className={`prose-print max-w-none text-slate-900 leading-relaxed font-serif space-y-3 flex-1 ${
                      textAlign === 'justify' ? 'text-justify' : 'text-left'
                    }`}
                    style={{
                      textJustify: 'inter-word',
                      lineHeight: lineHeight === 'relaxed' ? 1.85 : lineHeight === 'tight' ? 1.45 : 1.65,
                    }}
                    dangerouslySetInnerHTML={{ __html: cleanHtml(ch.contentHtml) }}
                  />

                  {/* Screen-only Sheet Bottom Page Counter */}
                  <div className="schemax-no-print pt-6 border-t border-slate-100 flex items-center justify-between text-[11px] font-sans text-slate-400 mt-8">
                    <span>{book.title} • Bab {ch.order}</span>
                    <span>Halaman {ch.startPage}</span>
                  </div>
                </article>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Actions (Hidden on print) */}
        <div className="schemax-no-print print:hidden px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
            Tips: Pada dialog cetak browser, pilih tujuan <strong>"Save as PDF" / "Simpan sebagai PDF"</strong>.
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

  return createPortal(modalContent, document.body);
};
