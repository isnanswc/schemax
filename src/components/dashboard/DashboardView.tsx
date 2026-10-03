import React, { useState, useEffect } from 'react';
import { Book, StoryChapter } from '../../types';
import { BookCard } from '../books/BookCard';
import {
  Plus,
  BookOpen,
  Sparkles,
  ArrowRight,
  Flame,
  Layers,
  Feather,
  RotateCcw,
  Sun,
  Moon,
  Sunset,
  Quote,
  Clock,
  Calendar,
  Compass,
  Zap,
  ChevronRight
} from 'lucide-react';
import { usePrivacy } from '../../contexts/PrivacyContext';

interface DashboardViewProps {
  books: Book[];
  allChapters?: StoryChapter[];
  recentChapter?: StoryChapter | null;
  recentBook?: Book | null;
  chapterCounts: Record<string, number>;
  onSelectBook: (book: Book) => void;
  onResumeChapter?: (book: Book, chapter: StoryChapter) => void;
  onOpenCreateModal: () => void;
  onOpenStoryArchitect?: () => void;
  onOpenAISettings?: () => void;
  onNavigateToWorks: () => void;
}

// 📜 Curated Literary & Writing Quotes for Inspiration
const WRITING_QUOTES = [
  {
    quote: 'Menulislah dengan berani, revisilah tanpa ampun.',
    author: 'Ernest Hemingway',
  },
  {
    quote: 'Tugas seorang penulis bukan menyelesaikan masalah, tetapi mengangkatnya ke permukaan.',
    author: 'Anton Chekhov',
  },
  {
    quote: 'Kamu bisa memperbaiki halaman yang buruk, tapi kamu tidak bisa memperbaiki halaman yang kosong.',
    author: 'Jodi Picoult',
  },
  {
    quote: 'Orang boleh pandai setinggi langit, tapi selama ia tidak menulis, ia akan hilang di dalam masyarakat dan dari sejarah.',
    author: 'Pramoedya Ananta Toer',
  },
  {
    quote: 'Kata-kata adalah sumber sihir kita yang paling tak ada habisnya.',
    author: 'J.K. Rowling',
  },
  {
    quote: 'Mulailah dengan menulis apa yang membuat hatimu bergetar.',
    author: 'C.S. Lewis',
  },
  {
    quote: 'Jangan menunggu inspirasi. Kejar dia dengan tongkat pemukul.',
    author: 'Jack London',
  },
  {
    quote: 'Langkah pertama untuk menulis buku hebat adalah mempercayai bahwa duniamu layak diceritakan.',
    author: 'Schemax Muse',
  },
];

export const DashboardView: React.FC<DashboardViewProps> = ({
  books,
  allChapters = [],
  recentChapter,
  recentBook,
  chapterCounts,
  onSelectBook,
  onResumeChapter,
  onOpenCreateModal,
  onOpenStoryArchitect,
  onOpenAISettings,
  onNavigateToWorks,
}) => {
  const [quoteIndex, setQuoteIndex] = useState(() => Math.floor(Math.random() * WRITING_QUOTES.length));
  const [displayedQuote, setDisplayedQuote] = useState('');
  const [isTyping, setIsTyping] = useState(true);

  // Typewriter effect state
  const targetQuote = WRITING_QUOTES[quoteIndex].quote;
  const targetAuthor = WRITING_QUOTES[quoteIndex].author;

  useEffect(() => {
    let currentIdx = 0;
    setDisplayedQuote('');
    setIsTyping(true);

    const typingInterval = setInterval(() => {
      if (currentIdx < targetQuote.length) {
        setDisplayedQuote(targetQuote.slice(0, currentIdx + 1));
        currentIdx++;
      } else {
        setIsTyping(false);
        clearInterval(typingInterval);
      }
    }, 40); // Natural typewriter cadence

    return () => clearInterval(typingInterval);
  }, [quoteIndex]);

  const handleNextQuote = (e: React.MouseEvent) => {
    e.stopPropagation();
    setQuoteIndex((prev) => (prev + 1) % WRITING_QUOTES.length);
  };

  // 🕒 Realtime Clock & Aesthetic Date State
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedDate = currentTime.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const formattedTime = currentTime.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  // Determine dynamic greeting based on local time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 4 && hour < 11) {
      return { text: 'Selamat Pagi', icon: Sun, color: 'text-amber-500', glow: 'from-amber-500/20' };
    } else if (hour >= 11 && hour < 15) {
      return { text: 'Selamat Siang', icon: Sun, color: 'text-amber-500', glow: 'from-amber-500/20' };
    } else if (hour >= 15 && hour < 18) {
      return { text: 'Selamat Sore', icon: Sunset, color: 'text-orange-500', glow: 'from-orange-500/20' };
    } else {
      return { text: 'Selamat Malam', icon: Moon, color: 'text-indigo-400', glow: 'from-indigo-500/20' };
    }
  };

  const greeting = getGreeting();
  const GreetingIcon = greeting.icon;

  const totalWords = allChapters.reduce((acc, c) => acc + (c.wordCount || 0), 0);
  const publishedBooks = books.filter((b) => b.status === 'released');
  const draftBooks = books.filter((b) => b.status === 'draft');

  // Time formatter for recent chapter
  const formatTimeAgo = (timestamp?: number) => {
    if (!timestamp) return 'Baru saja';
    const diffMs = Date.now() - timestamp;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) return 'Baru saja';
    if (diffMins < 60) return `${diffMins}m lalu`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}j lalu`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}h lalu`;
  };

  // Recent 2 books
  const recentBooks = [...books]
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, 2);

  // Quick Resume calculations
  const { getBlurTitleClass, getBlurTextClass, bindEmptyAreaLongPress } = usePrivacy();

  const progressPercent = recentChapter
    ? Math.min(
        100,
        Math.round(
          ((recentChapter.wordCount || 0) / (recentChapter.targetWordCount || 1500)) * 100
        )
      )
    : 0;

  return (
    <div {...bindEmptyAreaLongPress()} className="relative space-y-5 pb-28">
      {/* ========================================================
          🌌 FULL CINEMATIC AMBIENT AURORA NEBULA
          Continuous edge-to-edge organic light without rigid blocks
          ======================================================== */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10 select-none">
        {/* Amber Aurora Orb - Top Right */}
        <div className="absolute -top-[10%] -right-[8%] w-[28rem] sm:w-[38rem] h-[28rem] sm:h-[38rem] rounded-full bg-gradient-to-br from-amber-500/25 via-orange-600/10 to-transparent blur-[100px] animate-aurora-drift-1" />
        {/* Mystic Violet Aurora Orb - Mid Left */}
        <div className="absolute top-[25%] -left-[12%] w-[26rem] sm:w-[36rem] h-[26rem] sm:h-[36rem] rounded-full bg-gradient-to-tr from-indigo-600/20 via-purple-600/10 to-transparent blur-[110px] animate-aurora-drift-2" />
        {/* Deep Emerald Starlight Dust - Bottom Right */}
        <div className="absolute -bottom-[8%] right-[8%] w-[24rem] sm:w-[32rem] h-[24rem] sm:h-[32rem] rounded-full bg-gradient-to-tl from-emerald-500/10 via-teal-500/5 to-transparent blur-[90px]" />
      </div>

      {/* ========================================================
          🌟 1. THE MUSE SANCTUM (Cinematic Greeting & Typewriter Quote)
          ======================================================== */}
      <section className="anim-entrance-1 cinematic-glass-card p-5 sm:p-7 relative overflow-hidden group">
        {/* Ambient watermark quotation mark */}
        <Quote className="absolute right-4 -bottom-6 w-32 h-32 text-amber-500/[0.04] dark:text-amber-400/[0.03] pointer-events-none rotate-12 transition-transform duration-700 group-hover:scale-105" />

        <div className="relative z-10 space-y-4">
          {/* Header Row: Dynamic Time Badge + Live Realtime Clock & Date HUD + Rotate Quote Button */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {/* Left: Dynamic Greeting Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/50 dark:bg-white/[0.06] border border-white/60 dark:border-white/10 shadow-xs backdrop-blur-md">
              <span className={`p-1 rounded-full bg-gradient-to-br ${greeting.glow} to-transparent ${greeting.color}`}>
                <GreetingIcon className="w-3.5 h-3.5" />
              </span>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-wide">
                {greeting.text}, <span className="text-shimmer-gold font-black">Penulis</span>
              </span>
            </div>

            {/* Right Group: Live Date & Time HUD + Rotate Button */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Aesthetic Live Date & Time Capsule */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/50 dark:bg-white/[0.06] border border-white/60 dark:border-white/10 shadow-xs backdrop-blur-md text-[11px] font-mono text-slate-700 dark:text-slate-300">
                <div className="flex items-center gap-1 font-semibold text-slate-600 dark:text-slate-400">
                  <Calendar className="w-3 h-3 text-amber-500 flex-shrink-0" />
                  <span className="capitalize">{formattedDate}</span>
                </div>
                <span className="w-1 h-1 rounded-full bg-amber-500 animate-ping flex-shrink-0" />
                <div className="flex items-center gap-1 font-black text-amber-600 dark:text-amber-400">
                  <Clock className="w-3 h-3 text-amber-500 flex-shrink-0" />
                  <span>{formattedTime}</span>
                </div>
              </div>

              {/* Rotate Quote Button */}
              <button
                type="button"
                onClick={handleNextQuote}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/40 dark:bg-white/[0.04] hover:bg-white/80 dark:hover:bg-white/[0.08] border border-white/40 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition-all active:scale-95 text-xs font-semibold backdrop-blur-md"
                title="Ganti Kutipan Inspirasi"
              >
                <RotateCcw className="w-3 h-3 transition-transform duration-500 group-hover:rotate-180" />
                <span className="hidden xs:inline text-[11px]">Inspirasi Lain</span>
              </button>
            </div>
          </div>

          {/* Typewriter Literary Quotation */}
          <div className="min-h-[58px] sm:min-h-[64px] flex flex-col justify-center pl-1 sm:pl-2">
            <blockquote className="font-serif italic text-sm sm:text-base text-slate-800 dark:text-slate-100 leading-relaxed tracking-wide">
              <span>"{displayedQuote}"</span>
              {/* Pulsating Golden Quill Cursor */}
              <span className="inline-block w-1.5 h-4 sm:h-4.5 ml-1.5 bg-gradient-to-b from-amber-400 to-amber-600 rounded-full align-middle animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
            </blockquote>

            <div className="flex items-center justify-between pt-2 text-[11px] font-sans">
              <div className="flex items-center gap-2">
                <span className="w-4 h-[1px] bg-amber-500/60" />
                <span className="font-semibold text-slate-600 dark:text-slate-300 tracking-wide">
                  {targetAuthor}
                </span>
              </div>
              <span className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 hidden sm:inline font-mono">
                Schemax Atelier
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          ⚡ 2. MASTERPIECE QUICK RESUME STAGE ("Lanjutkan Menulis")
          ======================================================== */}
      {recentChapter && recentBook && onResumeChapter && (
        <section
          onClick={() => onResumeChapter(recentBook, recentChapter)}
          className="anim-entrance-2 cinematic-glass-card cinematic-glass-card-interactive p-5 sm:p-6 group relative overflow-hidden"
        >
          {/* Subtle Warm Amber Glow Behind Card on Hover */}
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/[0.08] via-transparent to-indigo-500/[0.05] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

          <div className="relative z-10 space-y-3.5">
            {/* Top Micro-Header */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/15 dark:bg-amber-400/10 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                  Quick Resume
                </span>
                <span className="text-xs text-slate-600 dark:text-slate-400 truncate font-semibold flex items-center gap-1">
                  <Feather className="w-3 h-3 text-amber-500/80 flex-shrink-0" />
                  <span className={`truncate ${getBlurTitleClass()}`}>{recentBook.title}</span>
                </span>
              </div>

              <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono flex-shrink-0">
                <Clock className="w-3 h-3" />
                <span>{formatTimeAgo(recentChapter.updatedAt)}</span>
              </div>
            </div>

            {/* Title & Action Button Row */}
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h3 className={`text-base sm:text-xl font-black text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors truncate ${getBlurTitleClass()}`}>
                  Bab {recentChapter.order || 1}: {recentChapter.title || 'Bab Tanpa Judul'}
                </h3>
                <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400 mt-1 font-medium">
                  <span>{(recentChapter.wordCount || 0).toLocaleString()} kata</span>
                  <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                  <span>Target {recentChapter.targetWordCount || 1500} kata</span>
                  <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700 hidden xs:inline" />
                  <span className="text-amber-600 dark:text-amber-400 font-bold hidden xs:inline">
                    {progressPercent}%
                  </span>
                </div>
              </div>

              {/* Glowing Primary Action Pill */}
              <button
                type="button"
                className="py-2.5 px-4 sm:px-5 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/25 active:scale-95 transition-all duration-300 flex items-center gap-2 flex-shrink-0 group-hover:shadow-amber-500/40"
              >
                <span>Buka Studio</span>
                <ArrowRight className="w-4 h-4 stroke-[2.5] transition-transform duration-300 group-hover:translate-x-1" />
              </button>
            </div>

            {/* Luminous Golden Progress Rail */}
            <div className="relative pt-1">
              <div className="w-full bg-slate-200/80 dark:bg-black/40 rounded-full h-2 overflow-hidden border border-slate-300/50 dark:border-white/10 p-[1px]">
                <div
                  className="bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300 h-full rounded-full golden-shimmer-bar transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ========================================================
          🚀 3. AI STORY ARCHITECT PORTAL
          ======================================================== */}
      {onOpenStoryArchitect && (
        <section
          onClick={onOpenStoryArchitect}
          className="anim-entrance-3 cinematic-glass-card cinematic-glass-card-interactive p-4 sm:p-5 group relative overflow-hidden"
        >
          {/* Subtle Cosmic Nebula Flare */}
          <div className="absolute -right-8 -top-8 w-40 h-40 bg-gradient-to-br from-indigo-500/20 via-purple-500/15 to-transparent rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5 min-w-0">
              <div className="relative w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 via-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                <div className="absolute inset-0 rounded-2xl bg-amber-400/30 blur-sm animate-pulse" />
                <Sparkles className="w-5 h-5 text-amber-200 animate-star-sparkle relative z-10" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white group-hover:text-indigo-400 transition-colors">
                    AI Story Architect
                  </h3>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30">
                    Cosmic Planner
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-snug">
                  Punya 1 ide liar? AI menyusun sinopsis babak, profil karakter, lokasi, dan bab awal siap tulis.
                </p>
              </div>
            </div>

            <button
              type="button"
              className="py-2.5 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold text-xs shadow-md shadow-indigo-500/25 active:scale-95 transition-all duration-300 flex items-center justify-center gap-2 flex-shrink-0"
            >
              <span>Rancang Proyek Baru ✨</span>
            </button>
          </div>
        </section>
      )}

      {/* ========================================================
          📊 4. FLOATING TELEMETRY GLASS HUD RIBBON
          Unified momentum telemetry replacing 3 chunky separate boxes
          ======================================================== */}
      <section className="anim-entrance-4 cinematic-hud-ribbon p-3 sm:p-4">
        <div className="grid grid-cols-3 divide-x divide-slate-200/80 dark:divide-white/[0.08]">
          {/* Stat 1: Total Works */}
          <div className="px-2 sm:px-4 text-center space-y-0.5">
            <div className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <BookOpen className="w-3 h-3 text-amber-500" />
              <span>Total Karya</span>
            </div>
            <div className="text-base sm:text-xl font-black text-slate-900 dark:text-white">
              {books.length}{' '}
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Buku</span>
            </div>
          </div>

          {/* Stat 2: Total Chapters */}
          <div className="px-2 sm:px-4 text-center space-y-0.5">
            <div className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <Layers className="w-3 h-3 text-purple-500" />
              <span>Total Bab</span>
            </div>
            <div className="text-base sm:text-xl font-black text-amber-600 dark:text-amber-400">
              {allChapters.length}{' '}
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Bab</span>
            </div>
          </div>

          {/* Stat 3: Total Words */}
          <div className="px-2 sm:px-4 text-center space-y-0.5">
            <div className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <Flame className="w-3 h-3 text-orange-500" />
              <span>Kata Tertulis</span>
            </div>
            <div className="text-base sm:text-xl font-black text-indigo-600 dark:text-indigo-300">
              {totalWords > 1000 ? `${(totalWords / 1000).toFixed(1)}k` : totalWords}{' '}
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Kata</span>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          📚 5. KARYA TERKINI (Recent Works Gallery)
          ======================================================== */}
      <section className="anim-entrance-5 space-y-3.5 pt-1">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white tracking-tight">
              Karya Terkini
            </h3>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium font-mono">
              ({publishedBooks.length} Rilis, {draftBooks.length} Draf)
            </span>
          </div>

          <button
            type="button"
            onClick={onNavigateToWorks}
            className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:text-amber-500 flex items-center gap-1 transition group"
          >
            <span>Semua di Works</span>
            <ChevronRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
          </button>
        </div>

        {recentBooks.length === 0 ? (
          <div className="cinematic-glass-card text-center py-12 px-6 border-dashed border-slate-300 dark:border-white/10">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 mx-auto flex items-center justify-center mb-3">
              <BookOpen className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-slate-900 dark:text-white mb-1">
              Sanctum Penulisan Masih Bersih
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto mb-4">
              Mulai goreskan ide pertama Anda dan bangun semesta cerita Anda di Schemax.
            </p>
            <button
              onClick={onOpenCreateModal}
              className="inline-flex items-center gap-2 py-2.5 px-5 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black rounded-2xl text-xs shadow-lg shadow-amber-500/25 active:scale-95 transition"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Buat Buku Pertama</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {recentBooks.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                onSelect={onSelectBook}
                chapterCount={chapterCounts[book.id] || 0}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
