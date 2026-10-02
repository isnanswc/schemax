import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  Plus,
  Trash2,
  Edit2,
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
  ArrowRight
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

interface InspirationChatViewProps {
  books: Book[];
  onOpenArchitectWithIdea: (rawIdea: string) => void;
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
  const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Hapus sesi obrolan brainstorming ini?')) return;
    await deleteInspirationSession(id);
    const updated = sessions.filter((s) => s.id !== id);
    setSessions(updated);
    if (activeSession?.id === id) {
      if (updated.length > 0) {
        setActiveSession(updated[0]);
      } else {
        const fresh = await createInspirationSession();
        setSessions([fresh]);
        setActiveSession(fresh);
      }
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

  // External API Injection Handler
  const handleTriggerExternal = async (type: 'tarot' | 'open5e' | 'history' | 'fact') => {
    if (!activeSession || isSending || isFetchingExternal) return;
    setIsFetchingExternal(true);

    try {
      let promptTitle = '';
      let promptBody = '';

      if (type === 'tarot') {
        const card = await fetchTarotPrompt();
        promptTitle = `🃏 ${card.name}`;
        promptBody = card.narrativePrompt;
      } else if (type === 'open5e') {
        const item = await fetchOpen5eInspiration();
        promptTitle = `🐉 Inspirasi ${item.name} (${item.category})`;
        promptBody = `Bantu saya mengadaptasi konsep ini ke dalam cerita:\nNama: ${item.name} (${item.category})\nDeskripsi: ${item.description}\n${item.extraInfo || ''}`;
      } else if (type === 'history') {
        const hist = await fetchHistoricalPrompt();
        promptTitle = `⏳ Peristiwa Sejarah Tahun ${hist.year}`;
        promptBody = hist.storyPrompt;
      } else {
        const fact = await fetchUselessFact();
        promptTitle = `💡 Fakta Unik Dunia`;
        promptBody = fact.thoughtPrompt;
      }

      await handleSendMessage(promptBody);
    } catch (err) {
      console.error('Failed to fetch external inspiration:', err);
    } finally {
      setIsFetchingExternal(false);
    }
  };

  // Formulate to Story Architect
  const handleFormulate = async () => {
    if (!activeSession || isFormulating) return;
    setIsFormulating(true);

    try {
      const formulatedIdea = await formulateIdeaForArchitect(activeSession, pinnedBook);
      onOpenArchitectWithIdea(formulatedIdea);
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

  return (
    <div className="relative flex flex-col h-[calc(100vh-68px)] max-w-5xl mx-auto px-2 sm:px-4 py-2 select-text">
      {/* 1. TOP HEADER BAR */}
      <header className="flex items-center justify-between px-3 py-2.5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm z-20 flex-shrink-0 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition active:scale-95"
            title="Daftar Sesi Obrolan"
          >
            <Menu className="w-4 h-4" />
          </button>

          <div className="min-w-0">
            <h2 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate flex items-center gap-1.5">
              <span className="p-1 rounded-lg bg-amber-500/15 text-amber-500">
                <Sparkles className="w-3.5 h-3.5" />
              </span>
              <span>{activeSession?.title || 'AI Inspiration Studio'}</span>
            </h2>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
              {activeSession ? `${activeSession.messages.length} pesan dalam memori` : 'Lab brainstorming ide'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Pinned Book Selector */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-xl px-2.5 py-1 text-xs border border-slate-200/80 dark:border-slate-700/80">
            <BookOpen className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
            <select
              value={pinnedBookId}
              onChange={(e) => handleSelectPinnedBook(e.target.value)}
              className="bg-transparent font-bold text-slate-800 dark:text-slate-200 focus:outline-none max-w-[130px] sm:max-w-[200px] truncate text-[11px]"
            >
              <option value="">Ide Bebas (Semua Buku)</option>
              {books.map((b) => (
                <option key={b.id} value={b.id}>
                  Buku: {b.title}
                </option>
              ))}
            </select>
          </div>

          {/* Formulate Button */}
          <button
            type="button"
            onClick={handleFormulate}
            disabled={isFormulating || !activeSession || activeSession.messages.length < 2}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs transition shadow-sm active:scale-95 disabled:opacity-50"
            title="Formulasikan ide percakapan ini langsung ke AI Story Architect"
          >
            {isFormulating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Zap className="w-3.5 h-3.5 fill-current" />
            )}
            <span className="hidden sm:inline">Formulasikan ke Architect</span>
            <span className="sm:hidden">Architect</span>
          </button>
        </div>
      </header>

      {/* 2. CHAT MESSAGES SCROLL CONTAINER */}
      <div className="flex-1 overflow-y-auto px-2 sm:px-4 py-3 space-y-4 rounded-2xl bg-slate-50/50 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800/60">
        {activeSession?.messages.map((msg) => {
          const isUser = msg.role === 'user';
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
                className={`relative group p-3.5 sm:p-4 rounded-2xl text-xs sm:text-sm leading-relaxed transition-all shadow-xs ${
                  isUser
                    ? 'bg-amber-500 text-slate-950 font-medium rounded-tr-xs'
                    : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200/80 dark:border-slate-800 rounded-tl-xs'
                }`}
              >
                {/* Content with whitespace formatting */}
                <div className="whitespace-pre-wrap leading-relaxed select-text font-sans">
                  {msg.content}
                </div>

                {/* Assistant Bubble Actions (Copy & Formulate) */}
                {!isUser && (
                  <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleCopyMessage(msg.id, msg.content)}
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
                          <span>Salin Ide</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleFormulate}
                      disabled={isFormulating}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 text-[11px] font-bold border border-amber-500/30 transition active:scale-95"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Rancang jadi Buku</span>
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
              AI sedang merangkai ide &amp; menganalisis naskah...
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 3. QUICK EXTERNAL INSPIRATION CHIPS */}
      <div className="py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-shrink-0">
        <button
          type="button"
          onClick={() => handleTriggerExternal('tarot')}
          disabled={isSending || isFetchingExternal}
          className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-700 dark:text-purple-300 border border-purple-500/30 text-[11px] font-bold transition active:scale-95 disabled:opacity-50"
        >
          <span>🃏</span>
          <span>Tarik Tarot (Plot Twist)</span>
        </button>

        <button
          type="button"
          onClick={() => handleTriggerExternal('open5e')}
          disabled={isSending || isFetchingExternal}
          className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[11px] font-bold transition active:scale-95 disabled:opacity-50"
        >
          <span>🐉</span>
          <span>Monster &amp; Artefak (Open5e)</span>
        </button>

        <button
          type="button"
          onClick={() => handleTriggerExternal('history')}
          disabled={isSending || isFetchingExternal}
          className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 text-blue-700 dark:text-blue-300 border border-blue-500/30 text-[11px] font-bold transition active:scale-95 disabled:opacity-50"
        >
          <span>⏳</span>
          <span>Sejarah Hari Ini</span>
        </button>

        <button
          type="button"
          onClick={() => handleTriggerExternal('fact')}
          disabled={isSending || isFetchingExternal}
          className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[11px] font-bold transition active:scale-95 disabled:opacity-50"
        >
          <span>💡</span>
          <span>Fakta Unik Dunia</span>
        </button>
      </div>

      {/* 4. INPUT AREA BAR */}
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md p-2 flex items-end gap-2 flex-shrink-0">
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
              ? `Tanyakan ide kelanjutan untuk buku "${pinnedBook.title}"...`
              : 'Tanyakan ide cerita, plot twist, motivasi tokoh, atau sistem sihir...'
          }
          rows={1}
          className="flex-1 bg-transparent resize-none p-2 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none max-h-32 leading-relaxed"
        />

        <button
          type="button"
          onClick={() => handleSendMessage()}
          disabled={!inputMessage.trim() || isSending}
          className="p-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-slate-950 font-bold transition active:scale-95 shadow-sm"
          title="Kirim Pesan"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

      {/* 5. SIDEBAR / DRAWER LIST SESI PERCAKAPAN */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-start animate-fade-in">
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

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                          <button
                            type="button"
                            onClick={(e) => handleStartEditTitle(sess, e)}
                            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                            title="Ganti Judul"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteSession(sess.id, e)}
                            className="p-1 text-rose-400 hover:text-rose-600"
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
          </div>
        </div>
      )}
    </div>
  );
};
