import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  Plus,
  Trash2,
  Edit3,
  BookOpen,
  Layers,
  ChevronDown,
  Copy,
  Check,
  Zap,
  Menu,
  X,
  Loader2,
  Compass,
  ArrowRight,
  RotateCcw,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { Book, StoryChapter, WorldEntity, InspirationChatSession, InspirationChatMessage } from '../../types';
import { db, getInspirationSessions, createInspirationSession, saveInspirationSession, deleteInspirationSession, updateInspirationSessionTitle } from '../../db';
import {
  fetchOpen5eInspiration,
  fetchTarotPrompt,
  fetchHistoricalPrompt,
  fetchUselessFact,
} from '../../services/externalInspirationService';
import {
  buildInspirationSystemPrompt,
  buildInspirationPrompt,
  formulateIdeaForArchitect,
} from '../../services/aiInspirationService';
import { generateWithSmartFallback } from '../../services/aiService';
import { parseStoryOptions, StoryOptionItem } from '../../utils/storyOptionsParser';

interface MarkdownRendererProps {
  content: string;
  isUser?: boolean;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, isUser }) => {
  if (isUser) {
    return <div className="whitespace-pre-wrap leading-relaxed select-text font-sans">{content}</div>;
  }

  const lines = content.split('\n');
  const renderedElements: React.ReactNode[] = [];
  let listItems: React.ReactNode[] = [];
  let isNumberedList = false;

  const flushList = () => {
    if (listItems.length > 0) {
      if (isNumberedList) {
        renderedElements.push(
          <ol key={`ol-${renderedElements.length}`} className="my-1.5 space-y-1 pl-0.5 list-none">
            {listItems}
          </ol>
        );
      } else {
        renderedElements.push(
          <ul key={`ul-${renderedElements.length}`} className="my-1.5 space-y-1 pl-0.5 list-none">
            {listItems}
          </ul>
        );
      }
      listItems = [];
      isNumberedList = false;
    }
  };

  const parseInline = (text: string): React.ReactNode[] => {
    const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
        return (
          <code
            key={idx}
            className="px-1.5 py-0.5 mx-0.5 rounded bg-slate-200/80 dark:bg-slate-800 text-[11px] font-mono text-amber-600 dark:text-amber-400 font-medium"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
        return (
          <strong key={idx} className="font-extrabold text-slate-900 dark:text-amber-300">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
        return (
          <em key={idx} className="italic text-slate-800 dark:text-slate-200">
            {part.slice(1, -1)}
          </em>
        );
      }
      return part;
    });
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      flushList();
      renderedElements.push(<hr key={index} className="my-2 border-slate-200 dark:border-slate-800" />);
      return;
    }

    if (trimmed.startsWith('### ')) {
      flushList();
      renderedElements.push(
        <h4 key={index} className="text-xs sm:text-sm font-black text-amber-600 dark:text-amber-400 mt-2 mb-1 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
          <span>{parseInline(trimmed.replace(/^###\s+/, ''))}</span>
        </h4>
      );
      return;
    }
    if (trimmed.startsWith('## ')) {
      flushList();
      renderedElements.push(
        <h3 key={index} className="text-sm sm:text-base font-black text-amber-600 dark:text-amber-400 mt-2.5 mb-1 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
          <span>{parseInline(trimmed.replace(/^##\s+/, ''))}</span>
        </h3>
      );
      return;
    }
    if (trimmed.startsWith('# ')) {
      flushList();
      renderedElements.push(
        <h2 key={index} className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-400 mt-3 mb-1.5">
          {parseInline(trimmed.replace(/^#\s+/, ''))}
        </h2>
      );
      return;
    }

    if (trimmed.startsWith('> ')) {
      flushList();
      renderedElements.push(
        <div key={index} className="border-l-2 border-amber-500 pl-2.5 py-1 my-1.5 italic text-slate-700 dark:text-slate-300 bg-amber-500/5 rounded-r-lg text-xs sm:text-sm">
          {parseInline(trimmed.replace(/^>\s+/, ''))}
        </div>
      );
      return;
    }

    const bulletMatch = trimmed.match(/^([*\-•])\s+(.+)$/);
    if (bulletMatch) {
      if (isNumberedList) flushList();
      isNumberedList = false;
      listItems.push(
        <li key={`li-${index}`} className="flex items-start gap-2 text-xs sm:text-sm my-0.5 leading-relaxed">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400 mt-1.5 flex-shrink-0" />
          <span className="flex-1">{parseInline(bulletMatch[2])}</span>
        </li>
      );
      return;
    }

    const numMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (numMatch) {
      if (!isNumberedList && listItems.length > 0) flushList();
      isNumberedList = true;
      listItems.push(
        <li key={`num-${index}`} className="flex items-start gap-2 text-xs sm:text-sm my-0.5 leading-relaxed">
          <span className="text-[10px] font-mono font-bold px-1 py-0.2 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0">
            {numMatch[1]}.
          </span>
          <span className="flex-1">{parseInline(numMatch[2])}</span>
        </li>
      );
      return;
    }

    flushList();
    if (trimmed === '') {
      renderedElements.push(<div key={index} className="h-1" />);
    } else {
      renderedElements.push(
        <p key={index} className="my-1 text-xs sm:text-sm leading-relaxed text-slate-800 dark:text-slate-200">
          {parseInline(line)}
        </p>
      );
    }
  });

  flushList();

  return <div className="space-y-0.5 leading-relaxed select-text font-sans">{renderedElements}</div>;
};

interface InspirationChatViewProps {
  books: Book[];
  onOpenArchitectWithIdea: (rawIdea: string, autoStart?: boolean) => void;
  onOpenAISettings: () => void;
}

export const InspirationChatView: React.FC<InspirationChatViewProps> = ({
  books,
  onOpenArchitectWithIdea,
  onOpenAISettings,
}) => {
  const [sessions, setSessions] = useState<InspirationChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<InspirationChatSession | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);
  const [sessionToDelete, setSessionToDelete] = useState<InspirationChatSession | null>(null);
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState('');

  // Pinned Book context
  const [pinnedBookId, setPinnedBookId] = useState<string>('');
  const [pinnedBookChapters, setPinnedBookChapters] = useState<StoryChapter[]>([]);
  const [pinnedBookEntities, setPinnedBookEntities] = useState<WorldEntity[]>([]);

  // Input & message states
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isFetchingExternal, setIsFetchingExternal] = useState(false);
  const [isFormulating, setIsFormulating] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load initial sessions from IndexedDB
  useEffect(() => {
    const initSessions = async () => {
      const list = await getInspirationSessions();
      if (list.length > 0) {
        setSessions(list);
        setActiveSession(list[0]);
        setPinnedBookId(list[0].pinnedBookId || '');
      } else {
        const newSess = await createInspirationSession('Brainstorming Ide Cerita');
        setSessions([newSess]);
        setActiveSession(newSess);
      }
    };
    initSessions();
  }, []);

  // Fetch chapters & entities when pinnedBookId changes
  useEffect(() => {
    if (!pinnedBookId) {
      setPinnedBookChapters([]);
      setPinnedBookEntities([]);
      return;
    }

    const loadBookData = async () => {
      try {
        const [chs, ents] = await Promise.all([
          db.chapters.where('bookId').equals(pinnedBookId).toArray(),
          db.worldEntities.where('bookId').equals(pinnedBookId).toArray(),
        ]);
        setPinnedBookChapters(chs);
        setPinnedBookEntities(ents);
      } catch (err) {
        console.error('Failed to load pinned book data:', err);
      }
    };
    loadBookData();
  }, [pinnedBookId]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages, isSending]);

  // Selected pinned book object
  const pinnedBook = books.find((b) => b.id === pinnedBookId) || null;

  // Handle creating new session
  const handleCreateNewSession = async () => {
    const newSess = await createInspirationSession('Sesi Ide Baru', pinnedBookId);
    setSessions((prev) => [newSess, ...prev]);
    setActiveSession(newSess);
    setIsDrawerOpen(false);
  };

  // Handle deleting session
  const handleConfirmDelete = async () => {
    if (!sessionToDelete) return;
    const id = sessionToDelete.id;
    setSessionToDelete(null);
    try {
      await deleteInspirationSession(id);
      const updated = sessions.filter((s) => s.id !== id);
      setSessions(updated);
      if (activeSession?.id === id) {
        if (updated.length > 0) {
          setActiveSession(updated[0]);
          setPinnedBookId(updated[0].pinnedBookId || '');
        } else {
          const fresh = await createInspirationSession();
          setSessions([fresh]);
          setActiveSession(fresh);
          setPinnedBookId('');
        }
      }
    } catch (err) {
      console.error('Failed to delete inspiration session:', err);
    }
  };

  // Handle editing title
  const handleStartEditTitle = (session: InspirationChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTitleId(session.id);
    setEditTitleValue(session.title);
  };

  const handleSaveTitle = async (id: string) => {
    if (editTitleValue.trim()) {
      await updateInspirationSessionTitle(id, editTitleValue.trim());
      setSessions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, title: editTitleValue.trim() } : s))
      );
      if (activeSession?.id === id) {
        setActiveSession((prev) => (prev ? { ...prev, title: editTitleValue.trim() } : null));
      }
    }
    setEditingTitleId(null);
  };

  // Change pinned book
  const handleSelectPinnedBook = async (bookId: string) => {
    setPinnedBookId(bookId);
    if (activeSession) {
      const updated = { ...activeSession, pinnedBookId: bookId || undefined };
      setActiveSession(updated);
      await saveInspirationSession(updated);
    }
  };

  // Send message
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || !activeSession || isSending) return;

    setInputMessage('');
    setIsSending(true);

    const userMsg: InspirationChatMessage = {
      id: 'msg_' + Date.now().toString(36),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    const updatedSession: InspirationChatSession = {
      ...activeSession,
      messages: [...activeSession.messages, userMsg],
      updatedAt: Date.now(),
    };

    // Auto-rename session title on first user message if still default
    if (activeSession.messages.length <= 1 && text.length > 3) {
      const cleanTitle = text.slice(0, 32) + (text.length > 32 ? '...' : '');
      updatedSession.title = cleanTitle;
    }

    setActiveSession(updatedSession);

    try {
      const systemPrompt = buildInspirationSystemPrompt(updatedSession, {
        allBooks: books,
        pinnedBook,
        pinnedBookChapters,
        pinnedBookEntities,
      });

      const prompt = buildInspirationPrompt(updatedSession, text);

      const aiResponse = await generateWithSmartFallback(prompt, systemPrompt);

      const assistantMsg: InspirationChatMessage = {
        id: 'msg_ai_' + Date.now().toString(36),
        role: 'assistant',
        content: aiResponse.text,
        timestamp: Date.now(),
      };

      const finalSession: InspirationChatSession = {
        ...updatedSession,
        messages: [...updatedSession.messages, assistantMsg],
        updatedAt: Date.now(),
      };

      setActiveSession(finalSession);
      await saveInspirationSession(finalSession);
      setSessions((prev) => prev.map((s) => (s.id === finalSession.id ? finalSession : s)));
    } catch (err: any) {
      console.error('Failed to generate inspiration message:', err);
      const errMsg: InspirationChatMessage = {
        id: 'msg_err_' + Date.now().toString(36),
        role: 'assistant',
        content: `⚠️ Maaf, terjadi kendala saat menghubungi AI: ${err.message || 'Error koneksi'}.\n\nSilakan pastikan API Key Gemini/Groq Anda aktif melalui Pengaturan AI.`,
        timestamp: Date.now(),
      };
      const errorSession = {
        ...updatedSession,
        messages: [...updatedSession.messages, errMsg],
      };
      setActiveSession(errorSession);
      await saveInspirationSession(errorSession);
    } finally {
      setIsSending(false);
    }
  };

  // External API Injection Handler (Now with literary contextual bridging)
  const handleTriggerExternal = async (type: 'tarot' | 'open5e' | 'history' | 'fact') => {
    if (!activeSession || isSending || isFetchingExternal) return;
    setIsFetchingExternal(true);

    try {
      let promptBody = '';

      if (type === 'tarot') {
        const card = await fetchTarotPrompt();
        promptBody = `Saya menarik simbol kartu "${card.name}" (Makna filosofis: ${card.meaning}). Bagaimana simbol atau pertanda ini bisa diadaptasi secara kreatif menjadi misteri, firasat, atau rahasia penting dalam alur cerita kita?`;
      } else if (type === 'open5e') {
        const item = await fetchOpen5eInspiration();
        promptBody = `Bantu saya mengadaptasi konsep ini ke dalam cerita:\nNama: ${item.name} (${item.category})\nDeskripsi: ${item.description}\n${item.extraInfo || ''}`;
      } else if (type === 'history') {
        const hist = await fetchHistoricalPrompt();
        promptBody = `Berikut catatan peristiwa sejarah tahun ${hist.year}: "${hist.eventText}". Bagaimana kita bisa mengambil inspirasi konflik dramatis ini untuk diadaptasi ke dalam fiksi cerita kita?`;
      } else {
        const fact = await fetchUselessFact();
        promptBody = `Berikut fakta unik: "${fact.fact}". Coba jadikan fakta unik ini sebagai detail menarik atau obrolan cerdas antar tokoh dalam cerita kita.`;
      }

      await handleSendMessage(promptBody);
    } catch (err) {
      console.error('Failed to fetch external inspiration:', err);
    } finally {
      setIsFetchingExternal(false);
    }
  };

  // Formulate to Story Architect (Direct autoStart generation)
  const handleFormulate = async () => {
    if (!activeSession || isFormulating) return;
    setIsFormulating(true);

    try {
      const formulatedIdea = await formulateIdeaForArchitect(activeSession, pinnedBook);
      onOpenArchitectWithIdea(formulatedIdea, true);
    } catch (err: any) {
      alert(`Gagal memformulasikan ide: ${err.message || 'Error AI'}`);
    } finally {
      setIsFormulating(false);
    }
  };

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgId(id);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  const handleSelectOptionInChat = (opt: StoryOptionItem) => {
    handleSendMessage(
      `Saya memilih ${opt.key}: "${opt.title}". Tolong kembangkan ide ini secara mendalam dengan fokus pada BAB PERTAMA (jangan langsung buat 5 bab). Rincikan secara terstruktur:\n` +
      `1. **Nama & Latar Belakang Karakter**: Siapa saja nama lengkap dan latar belakang (asal-usul) masing-masing karakter (protagonis, rival/antagonis, tokoh pendukung).\n` +
      `2. **Ciri-Ciri & Sifat Karakter**: Ciri fisik spesifik, sifat, kepribadian, kebiasaan, luka batin (flaw), serta motivasi want & need.\n` +
      `3. **Tempat / Lokasi**: Tempat-tempat penting di bab pertama beserta suasana/atmosfer visualnya.\n` +
      `4. **Alat / Item / Relik**: Benda, senjata, pusaka, atau instrumen penting yang digunakan atau menjadi pusat misteri.\n` +
      `5. **Lore & Aturan Dunia**: Sejarah, mitos, atau aturan supranatural/teknologi di baliknya.\n` +
      `6. **Plot Bab Pertama (Bab 1)**: Alur ketukan adegan rinci dari adegan pembuka yang memikat, insiden pengganggu, eskalasi konflik, hingga penutup bab pertama agar siap dirancang menjadi buku!`
    );
  };

  return (
    <div className="relative flex h-full w-full min-h-0 overflow-hidden select-text bg-slate-50 dark:bg-slate-950">
      {/* 1. DESKTOP PERSISTENT SIDEBAR */}
      {isDesktopSidebarOpen && (
        <aside className="hidden md:flex flex-col flex-shrink-0 w-64 lg:w-72 border-r border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md h-full select-none z-10 transition-all duration-200">
          {/* Sidebar Top Header */}
          <div className="flex items-center justify-between px-3.5 py-3 border-b border-slate-200/80 dark:border-slate-800/80">
            <h3 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <span>Sesi Brainstorming</span>
            </h3>
            <button
              type="button"
              onClick={() => setIsDesktopSidebarOpen(false)}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
              title="Sembunyikan Sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>

          {/* New Session Action */}
          <div className="p-3 pb-2">
            <button
              type="button"
              onClick={handleCreateNewSession}
              className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 transition active:scale-95 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Mulai Sesi Ide Baru</span>
            </button>
          </div>

          {/* Session List */}
          <div className="flex-1 overflow-y-auto px-3 py-1 space-y-1.5 scrollbar-thin">
            {sessions.map((sess) => {
              const isActive = activeSession?.id === sess.id;
              const isEditing = editingTitleId === sess.id;

              return (
                <div
                  key={sess.id}
                  onClick={() => {
                    setActiveSession(sess);
                    setPinnedBookId(sess.pinnedBookId || '');
                  }}
                  className={`group p-2.5 rounded-xl border transition cursor-pointer ${
                    isActive
                      ? 'bg-amber-500/15 border-amber-500/50 shadow-xs ring-1 ring-amber-500/20'
                      : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {isEditing ? (
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={editTitleValue}
                        onChange={(e) => setEditTitleValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveTitle(sess.id);
                        }}
                        className="flex-1 bg-white dark:bg-slate-900 border border-amber-500 rounded-lg px-2 py-1 text-xs"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveTitle(sess.id)}
                        className="p-1 text-emerald-500 font-bold"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs font-bold truncate ${isActive ? 'text-amber-800 dark:text-amber-300' : 'text-slate-800 dark:text-slate-200'}`}>
                          {sess.title}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                          {sess.messages.length} pesan • {new Date(sess.updatedAt).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition flex-shrink-0">
                        <button
                          type="button"
                          onClick={(e) => handleStartEditTitle(sess, e)}
                          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/80 dark:hover:bg-slate-700/60 transition"
                          title="Ganti Judul"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setSessionToDelete(sess);
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                          onTouchStart={(e) => e.stopPropagation()}
                          className="p-1 rounded-lg text-rose-500 hover:text-rose-600 bg-rose-500/10 hover:bg-rose-500/20 dark:bg-rose-500/20 dark:hover:bg-rose-500/30 transition active:scale-95"
                          title="Hapus Sesi"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>
      )}

      {/* 2. MAIN CHAT & BRAINSTORMING CANVAS */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* TOP HEADER BAR (Directly under status bar with safe-top) */}
        <header className="w-full bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-b border-slate-200/90 dark:border-slate-800/80 px-2.5 sm:px-4 py-2 safe-top flex-shrink-0 z-20 flex items-center justify-between gap-1.5 shadow-xs">
          <div className="flex items-center gap-1.5 min-w-0">
            {/* Mobile hamburger menu */}
            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              className="md:hidden p-1.5 sm:p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition active:scale-95 flex-shrink-0"
              title="Daftar Sesi Obrolan"
            >
              <Menu className="w-4 h-4" />
            </button>

            {/* Desktop reopen sidebar toggle button */}
            {!isDesktopSidebarOpen && (
              <button
                type="button"
                onClick={() => setIsDesktopSidebarOpen(true)}
                className="hidden md:flex p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition active:scale-95 flex-shrink-0"
                title="Buka Panel Sesi"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            )}

            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate flex items-center gap-1">
                <span className="p-0.5 rounded bg-amber-500/15 text-amber-500 flex-shrink-0">
                  <Sparkles className="w-3.5 h-3.5" />
                </span>
                <span className="truncate">{activeSession?.title || 'AI Inspiration'}</span>
              </h2>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                {activeSession ? `${activeSession.messages.length} pesan dalam memori` : 'Brainstorming Ide Cerita'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Pinned Book Selector */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl px-2 py-1 text-xs border border-slate-200/80 dark:border-slate-700/80">
              <BookOpen className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
              <select
                value={pinnedBookId}
                onChange={(e) => handleSelectPinnedBook(e.target.value)}
                className="bg-transparent font-bold text-slate-800 dark:text-slate-200 focus:outline-none max-w-[90px] sm:max-w-[200px] truncate text-[11px]"
              >
                <option value="">Ide Bebas</option>
                {books.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Formulate Button */}
            <button
              type="button"
              onClick={handleFormulate}
              disabled={isFormulating || !activeSession || activeSession.messages.length < 2}
              className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs transition shadow-sm active:scale-95 disabled:opacity-40"
              title="Formulasikan ide percakapan ini langsung ke AI Story Architect"
            >
              {isFormulating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Zap className="w-3.5 h-3.5 fill-current" />
              )}
              <span className="hidden sm:inline">Ke Architect</span>
              <span className="sm:hidden text-[11px]">Rancang</span>
            </button>
          </div>
        </header>

        {/* CHAT MESSAGES SCROLL CONTAINER */}
        <div className="flex-1 min-h-0 w-full overflow-y-auto px-3 sm:px-6 py-4 space-y-3.5 bg-slate-50/50 dark:bg-slate-950/40">
          <div className="max-w-3xl lg:max-w-4xl mx-auto w-full space-y-3.5">
            {activeSession?.messages.map((msg) => {
              const isUser = msg.role === 'user';
              const detectedOptions = !isUser ? parseStoryOptions(msg.content) : null;
              const hasMultipleOptions = Boolean(detectedOptions && detectedOptions.length >= 2);

              // Deteksi apakah pesan ini merupakan rancangan blueprint cerita TUNGGAL (bukan daftar opsi)
              const isBlueprint = !isUser && !hasMultipleOptions && (
                msg.content.includes('[STORY_BLUEPRINT_READY]') ||
                (/judul/i.test(msg.content) && /premis|logline/i.test(msg.content) && (/karakter|tokoh/i.test(msg.content) || /bab\s*1|daftar\s*bab/i.test(msg.content)))
              );
              const cleanContent = msg.content.replace(/\[STORY_BLUEPRINT_READY\]/g, '').trim();

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[92%] sm:max-w-[85%] ${
                    isUser ? 'ml-auto' : 'mr-auto'
                  } animate-fade-in`}
                >
                  {/* Message Header Badge */}
                  <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] font-mono text-slate-400">
                    <span>{isUser ? 'Penulis' : 'AI Inspiration'}</span>
                    <span>•</span>
                    <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>

                  {/* Message Bubble Card */}
                  <div
                    className={`relative group p-3 sm:p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed transition-all shadow-xs ${
                      isUser
                        ? 'bg-amber-500 text-slate-950 font-medium rounded-tr-xs'
                        : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200/80 dark:border-slate-800 rounded-tl-xs'
                    }`}
                  >
                    {/* Formatted Content with Markdown Renderer */}
                    <MarkdownRenderer content={cleanContent} isUser={isUser} />

                    {/* MULTI-OPTION SELECTION: Muncul bila AI memberikan 2 atau lebih opsi ide cerita */}
                    {hasMultipleOptions && detectedOptions && (
                      <div className="mt-3 pt-3 border-t border-amber-500/30 space-y-2 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent -mx-1.5 -mb-1 p-2.5 sm:p-3 rounded-xl">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Sparkles className="w-4 h-4 text-amber-500 flex-shrink-0 fill-current" />
                            <p className="text-xs font-black text-amber-800 dark:text-amber-300 truncate">
                              Pilih Opsi yang Ingin Dirancang Menjadi Buku:
                            </p>
                          </div>
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 flex-shrink-0">
                            {detectedOptions.length} Opsi
                          </span>
                        </div>

                        <div className="grid grid-cols-1 gap-2 mt-1.5">
                          {detectedOptions.map((opt) => (
                            <div
                              key={opt.id}
                              className="p-2.5 sm:p-3 rounded-xl bg-white/95 dark:bg-slate-900/95 border border-amber-500/30 shadow-xs hover:border-amber-500 transition-all flex flex-col gap-2"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-800 dark:text-amber-300 font-black text-[11px]">
                                    {opt.key}
                                  </span>
                                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                                    {opt.title !== opt.key ? opt.title : ''}
                                  </span>
                                </div>
                                {opt.preview && (
                                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                                    {opt.preview}
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800/80 flex-wrap">
                                {/* Action 1: Langsung Rancang Opsi Ini */}
                                <button
                                  type="button"
                                  onClick={() => onOpenArchitectWithIdea(opt.content, true)}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 text-xs font-black shadow-sm transition active:scale-95"
                                  title={`Buka AI Story Architect khusus untuk konsep ${opt.key}`}
                                >
                                  <Zap className="w-3.5 h-3.5 fill-current" />
                                  <span>Rancang {opt.key} Jadi Buku</span>
                                  <ArrowRight className="w-3 h-3" />
                                </button>

                                {/* Action 2: Pilih & Diskusikan di Chat */}
                                <button
                                  type="button"
                                  onClick={() => handleSelectOptionInChat(opt)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition active:scale-95 border border-slate-200 dark:border-slate-700"
                                  title={`Minta AI fokus memperdalam ${opt.key}`}
                                >
                                  <span>💬 Pilih &amp; Kembangkan</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* HERO ACTION: Hanya tampil jika AI telah menyusun SATU blueprint cerita utuh */}
                    {isBlueprint && (
                      <div className="mt-3 pt-2.5 border-t border-amber-500/30 flex items-center justify-between gap-2 bg-amber-500/10 dark:bg-amber-500/15 -mx-1.5 -mb-1 px-2.5 py-2 rounded-xl">
                        <div className="min-w-0">
                          <p className="text-[11px] font-black text-amber-700 dark:text-amber-400 flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Rancangan Blueprint Siap</span>
                          </p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                            Pindahkan langsung ke AI Story Architect
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => onOpenArchitectWithIdea(cleanContent, true)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black shadow-sm transition active:scale-95 flex-shrink-0"
                        >
                          <Zap className="w-3.5 h-3.5 fill-current" />
                          <span>Rancang jadi Buku</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    {/* Error Bubble Interactive Actions */}
                    {msg.id.startsWith('msg_err_') && (
                      <div className="mt-2.5 pt-2 border-t border-rose-200/80 dark:border-rose-900/60 flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={onOpenAISettings}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black transition active:scale-95 shadow-sm"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Buka Pengaturan AI</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const lastUser = [...(activeSession?.messages || [])].reverse().find((m) => m.role === 'user');
                            if (lastUser) handleSendMessage(lastUser.content);
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition active:scale-95"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Coba Kirim Ulang</span>
                        </button>
                      </div>
                    )}

                    {/* Assistant Copy Action */}
                    {!isUser && !msg.id.startsWith('msg_err_') && (
                      <div className={`flex items-center justify-end ${isBlueprint ? 'mt-1.5' : 'mt-2 pt-1.5 border-t border-slate-200/60 dark:border-slate-800/60'}`}>
                        <button
                          type="button"
                          onClick={() => handleCopyMessage(msg.id, cleanContent)}
                          className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition text-[11px] flex items-center gap-1"
                        >
                          {copiedMsgId === msg.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold">Tersalin</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Salin</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {isSending && (
              <div className="flex items-center gap-2 p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-xs animate-pulse">
                <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  AI sedang merangkai ide &amp; menganalisis cerita...
                </span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* 3. QUICK INSPIRATION & BLUEPRINT CHIPS */}
        <div className="w-full max-w-full min-w-0 flex-shrink-0 px-2.5 sm:px-4 py-1.5 bg-slate-100/70 dark:bg-slate-900/70 border-t border-slate-200/70 dark:border-slate-800/70 flex items-center z-10">
          <div className="max-w-3xl lg:max-w-4xl mx-auto w-full flex items-center gap-1.5 overflow-x-auto scrollbar-none snap-x">
            <button
              type="button"
              onClick={() =>
                handleSendMessage(
                  'Tolong rumuskan seluruh hasil diskusi kita sejauh ini menjadi Rancangan Blueprint Cerita lengkap dengan fokus mendalam pada BAB PERTAMA (jangan membuat 5 bab): rincikan nama & latar belakang karakter, ciri fisik & sifat, tempat, alat/relik, lore dunia, serta plot detail Bab 1 agar siap diwujudkan menjadi buku baru!'
                )
              }
              disabled={isSending || isFetchingExternal}
              className="flex-shrink-0 snap-start flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-800 dark:text-amber-300 border border-amber-500/40 text-[11px] font-black transition active:scale-95 disabled:opacity-50 shadow-xs"
            >
              <Sparkles className="w-3 h-3 text-amber-500 fill-current" />
              <span>📖 Rancang Blueprint Buku</span>
            </button>

            <button
              type="button"
              onClick={() =>
                handleSendMessage(
                  'Berikan 3 opsi plot twist mengejutkan yang logis dan meningkatkan ketegangan dramatis untuk cerita ini.'
                )
              }
              disabled={isSending || isFetchingExternal}
              className="flex-shrink-0 snap-start flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-500/15 hover:bg-purple-500/25 text-purple-700 dark:text-purple-300 border border-purple-500/30 text-[11px] font-bold transition active:scale-95 disabled:opacity-50"
            >
              <Zap className="w-3 h-3 text-purple-500" />
              <span>⚡ Ide Plot Twist</span>
            </button>

            <button
              type="button"
              onClick={() =>
                handleSendMessage(
                  'Bantu saya mendalami motif batin, luka masa lalu, dan dinamika konflik antar karakter dalam cerita ini.'
                )
              }
              disabled={isSending || isFetchingExternal}
              className="flex-shrink-0 snap-start flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-500/15 hover:bg-blue-500/25 text-blue-700 dark:text-blue-300 border border-blue-500/30 text-[11px] font-bold transition active:scale-95 disabled:opacity-50"
            >
              <span>👥 Karakter &amp; Konflik</span>
            </button>

            <button
              type="button"
              onClick={() =>
                handleSendMessage(
                  'Bantu deskripsikan detail latar suasana tempat (worldbuilding) yang kaya panca indra dan atmosferik untuk adegan ini.'
                )
              }
              disabled={isSending || isFetchingExternal}
              className="flex-shrink-0 snap-start flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[11px] font-bold transition active:scale-95 disabled:opacity-50"
            >
              <span>🏰 Dunia &amp; Suasana</span>
            </button>

            <button
              type="button"
              onClick={() => handleTriggerExternal('tarot')}
              disabled={isSending || isFetchingExternal}
              className="flex-shrink-0 snap-start flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 text-[11px] font-bold transition active:scale-95 disabled:opacity-50"
            >
              <span>🃏 Simbol Misterius</span>
            </button>
          </div>
        </div>

        {/* 4. INPUT AREA BAR (Docks directly above HomeBottomNavigation) */}
        <div className="w-full flex-shrink-0 px-2.5 sm:px-4 py-2 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-t border-slate-200/80 dark:border-slate-800/80 shadow-lg z-10">
          <div className="max-w-3xl lg:max-w-4xl mx-auto w-full">
            <div className="flex items-end gap-1.5 bg-slate-100/90 dark:bg-slate-900/90 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-1.5">
              <textarea
                ref={textareaRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder={
                  pinnedBook
                    ? `Tanyakan ide kelanjutan untuk "${pinnedBook.title}"...`
                    : 'Tanyakan ide cerita, twist, motivasi tokoh, atau sistem sihir...'
                }
                rows={1}
                className="flex-1 bg-transparent resize-none px-2.5 py-1.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none max-h-28 leading-relaxed"
              />

              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={!inputMessage.trim() || isSending}
                className="p-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-slate-950 font-bold transition active:scale-95 shadow-sm flex-shrink-0"
                title="Kirim Pesan"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 5. MOBILE DRAWER LIST SESI PERCAKAPAN (shown on mobile when hamburger clicked) */}
      {isDrawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-start animate-fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xs h-full p-4 border-r border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Sesi Brainstorming</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* New Session Button */}
            <button
              type="button"
              onClick={handleCreateNewSession}
              className="mt-3 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 transition active:scale-95 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Mulai Sesi Ide Baru</span>
            </button>

            {/* Session List */}
            <div className="flex-1 overflow-y-auto mt-4 space-y-2">
              {sessions.map((sess) => {
                const isActive = activeSession?.id === sess.id;
                const isEditing = editingTitleId === sess.id;

                return (
                  <div
                    key={sess.id}
                    onClick={() => {
                      setActiveSession(sess);
                      setPinnedBookId(sess.pinnedBookId || '');
                      setIsDrawerOpen(false);
                    }}
                    className={`group p-2.5 rounded-xl border transition cursor-pointer ${
                      isActive
                        ? 'bg-amber-500/15 border-amber-500/50 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editTitleValue}
                          onChange={(e) => setEditTitleValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveTitle(sess.id);
                          }}
                          className="flex-1 bg-white dark:bg-slate-900 border border-amber-500 rounded-lg px-2 py-1 text-xs"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveTitle(sess.id)}
                          className="p-1 text-emerald-500 font-bold"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                            {sess.title}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {sess.messages.length} pesan • {new Date(sess.updatedAt).toLocaleDateString()}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition flex-shrink-0">
                          <button
                            type="button"
                            onClick={(e) => handleStartEditTitle(sess, e)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/80 dark:hover:bg-slate-700/60 transition active:scale-95"
                            title="Ganti Judul"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              setSessionToDelete(sess);
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                            className="p-1.5 rounded-lg text-rose-500 hover:text-rose-600 bg-rose-500/10 hover:bg-rose-500/20 dark:bg-rose-500/20 dark:hover:bg-rose-500/30 transition active:scale-95"
                            title="Hapus Sesi"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 6. IN-APP CONFIRMATION MODAL FOR DELETING SESSION */}
      {sessionToDelete && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setSessionToDelete(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm p-4 sm:p-5 shadow-2xl space-y-3 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 text-rose-500">
              <div className="p-2 rounded-xl bg-rose-500/15">
                <Trash2 className="w-5 h-5 text-rose-500" />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                  Hapus Sesi Inspirasi?
                </h4>
                <p className="text-[11px] text-slate-400">
                  Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
              Sesi "<span className="font-bold text-slate-900 dark:text-white">{sessionToDelete.title}</span>" beserta {sessionToDelete.messages.length} pesan di dalamnya akan dihapus permanen.
            </p>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSessionToDelete(null)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 rounded-xl text-xs font-black text-white bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-600/20 transition active:scale-95 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Sekarang</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
