import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Send,
  Trash2,
  Brain,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  User,
  Shield,
  HelpCircle,
  X,
  Plus,
  Compass,
  RefreshCw,
  Film
} from 'lucide-react';
import { Book, WorldEntity, StoryChapter, MediaItem, CharacterChatMessage, CharacterChatSession } from '../../../types';
import { useMediaUrl } from '../../../hooks/useMediaUrl';
import {
  db,
  getCharacterChatSession,
  saveCharacterChatMessage,
  clearCharacterChat
} from '../../../db';
import { sendCharacterChatMessage } from '../../../services/characterChatService';

interface CharacterChatViewProps {
  book: Book;
  entities: WorldEntity[];
  chapters: StoryChapter[];
  media: MediaItem[];
  initialEntityId?: string;
  onOpenWorldbuilding?: () => void;
}

// Avatar subcomponent for individual character card
const CharacterAvatarThumb: React.FC<{
  entity: WorldEntity;
  isActive: boolean;
  onClick: () => void;
}> = ({ entity, isActive, onClick }) => {
  const { url } = useMediaUrl(entity.avatarMediaId);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-shrink-0 flex flex-col items-center gap-1.5 p-2 rounded-2xl transition-all duration-200 select-none text-left w-24 group relative ${
        isActive
          ? 'bg-amber-500/15 border-2 border-amber-500 shadow-lg shadow-amber-500/10 scale-105'
          : 'bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700'
      }`}
    >
      <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700">
        {url ? (
          <img src={url} alt={entity.name} className="w-full h-full object-cover" />
        ) : (
          <User className="w-6 h-6 text-slate-400 group-hover:text-amber-500 transition-colors" />
        )}
        {isActive && (
          <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full" />
        )}
      </div>
      <div className="w-full text-center">
        <span className={`block text-xs font-bold truncate ${isActive ? 'text-amber-700 dark:text-amber-400' : 'text-slate-800 dark:text-slate-200'}`}>
          {entity.name}
        </span>
        <span className="block text-[10px] text-slate-400 dark:text-slate-500 truncate">
          {entity.shortDescription || 'Karakter'}
        </span>
      </div>
    </button>
  );
};

export const CharacterChatView: React.FC<CharacterChatViewProps> = ({
  book,
  entities,
  chapters,
  media,
  initialEntityId,
  onOpenWorldbuilding,
}) => {
  // Filter characters only
  const characters = entities.filter((e) => e.category === 'character');

  // Selected character
  const [selectedEntityId, setSelectedEntityId] = useState<string>(() => {
    if (initialEntityId && characters.some((c) => c.id === initialEntityId)) {
      return initialEntityId;
    }
    return characters[0]?.id || '';
  });

  // Carousel collapse state with persistence
  const carouselStorageKey = `schemax_chat_carousel_hidden_${book.id}`;
  const [isCarouselHidden, setIsCarouselHidden] = useState<boolean>(() => {
    try {
      return localStorage.getItem(carouselStorageKey) === 'true';
    } catch (_) {
      return false;
    }
  });

  const toggleCarousel = () => {
    setIsCarouselHidden((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(carouselStorageKey, String(next));
      } catch (_) {}
      return next;
    });
  };

  // Chat Mode: in_character (in-universe) vs meta_interview (interview with author)
  const [chatMode, setChatMode] = useState<'in_character' | 'meta_interview'>('in_character');

  // Messages & Session State
  const [session, setSession] = useState<CharacterChatSession | null>(null);
  const [messages, setMessages] = useState<CharacterChatMessage[]>([]);
  const [authorKnownFacts, setAuthorKnownFacts] = useState<string[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatusText, setLoadingStatusText] = useState('Sedang merangkai jawaban...');

  // Fact Vault Modal
  const [isFactVaultOpen, setIsFactVaultOpen] = useState(false);
  const [newManualFact, setNewManualFact] = useState('');

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Active character object
  const activeChar = characters.find((c) => c.id === selectedEntityId) || characters[0];
  const { url: activeCharAvatarUrl } = useMediaUrl(activeChar?.avatarMediaId);

  // Load chat session when active character changes
  useEffect(() => {
    if (!activeChar) return;
    let isMounted = true;

    async function loadSession() {
      try {
        const s = await getCharacterChatSession(book.id, activeChar.id, activeChar.name);
        if (isMounted) {
          setSession(s);
          setMessages(s.messages || []);
          setAuthorKnownFacts(s.authorKnownFacts || []);
        }
      } catch (err) {
        console.error('Gagal memuat sesi chat karakter:', err);
      }
    }

    loadSession();
    return () => {
      isMounted = false;
    };
  }, [book.id, activeChar?.id, activeChar?.name]);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Suggested prompt chips
  const quickPrompts = [
    'Bagaimana perasaanmu tentang kejadian di bab terakhir?',
    'Ceritakan rahasia atau luka batin yang kamu sembunyikan.',
    'Apa pendapatmu tentang hubunganmu dengan tokoh lain?',
    'Jika kamu bisa mengubah takdirmu di cerita ini, apa yang kamu inginkan?',
    'Hobi saya suka mengamati orang dan menulis cerita larut malam.',
  ];

  // Send message
  const handleSendMessage = async (textToSend?: string) => {
    const raw = (textToSend !== undefined ? textToSend : inputText).trim();
    if (!raw || isLoading || !activeChar) return;

    setInputText('');
    const userMsg: CharacterChatMessage = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      sender: 'user',
      text: raw,
      timestamp: Date.now(),
    };

    // Optimistic UI update
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setIsLoading(true);

    const statusPhrases = [
      `${activeChar.name} sedang mengingat riwayat percakapan...`,
      `${activeChar.name} menatapmu dengan seksama...`,
      `${activeChar.name} merangkai jawaban dalam karakternya...`,
      `${activeChar.name} menimbang kata-katanya...`,
    ];
    setLoadingStatusText(statusPhrases[Math.floor(Math.random() * statusPhrases.length)]);

    try {
      const response = await sendCharacterChatMessage({
        character: activeChar,
        bookTitle: book.title,
        bookGenre: book.genre,
        bookSynopsis: book.synopsis,
        chapters,
        authorKnownFacts,
        history: updatedMessages,
        userMessage: raw,
        chatMode,
      });

      const charMsg: CharacterChatMessage = {
        id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        sender: 'character',
        text: response.reply,
        timestamp: Date.now(),
      };

      const finalMessages = [...updatedMessages, charMsg];
      setMessages(finalMessages);

      // Save to Dexie and update Fact Vault if new facts detected
      const updatedSession = await saveCharacterChatMessage(
        book.id,
        activeChar.id,
        activeChar.name,
        userMsg,
        response.detectedFacts
      );
      await saveCharacterChatMessage(
        book.id,
        activeChar.id,
        activeChar.name,
        charMsg,
        []
      );

      if (updatedSession) {
        setAuthorKnownFacts(updatedSession.authorKnownFacts || []);
      }
    } catch (err: any) {
      const errorMsg: CharacterChatMessage = {
        id: 'err_' + Date.now(),
        sender: 'character',
        text: `(Terjadi gangguan saat ${activeChar.name} menjawab: ${err?.message || 'Koneksi AI terputus.'} Silakan coba lagi.)`,
        timestamp: Date.now(),
      };
      setMessages([...updatedMessages, errorMsg]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  // Reset conversation
  const handleClearHistory = async () => {
    if (!activeChar) return;
    const confirm = window.confirm(`Hapus seluruh riwayat obrolan dengan ${activeChar.name}? Memori fakta yang sudah diingat tetap aman tersimpan.`);
    if (!confirm) return;

    await clearCharacterChat(book.id, activeChar.id);
    setMessages([]);
  };

  // Add manual fact to Fact Vault
  const handleAddManualFact = async () => {
    if (!newManualFact.trim() || !activeChar) return;
    const updatedFacts = Array.from(new Set([...authorKnownFacts, newManualFact.trim()]));
    setAuthorKnownFacts(updatedFacts);
    setNewManualFact('');

    if (session) {
      session.authorKnownFacts = updatedFacts;
      session.updatedAt = Date.now();
      await db.characterChats.put(session);
    }
  };

  // Delete fact from Fact Vault
  const handleDeleteFact = async (index: number) => {
    if (!activeChar) return;
    const updatedFacts = authorKnownFacts.filter((_, i) => i !== index);
    setAuthorKnownFacts(updatedFacts);
    if (session) {
      session.authorKnownFacts = updatedFacts;
      session.updatedAt = Date.now();
      await db.characterChats.put(session);
    }
  };

  // If no characters exist in the book
  if (characters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center min-h-[60vh] max-w-md mx-auto">
        <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4 text-amber-500">
          <Brain className="w-8 h-8" />
        </div>
        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-2">
          Belum Ada Karakter di Buku Ini
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
          Tambahkan karakter terlebih dahulu di menu Worldbuilding atau gunakan AI Story Architect agar Anda dapat mengobrol langsung dengan mereka.
        </p>
        {onOpenWorldbuilding && (
          <button
            type="button"
            onClick={onOpenWorldbuilding}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-amber-500/25 transition active:scale-95"
          >
            <Compass className="w-4 h-4" />
            <span>Buka Worldbuilding &amp; Tambah Karakter</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] sm:h-[calc(100vh-140px)] max-w-4xl mx-auto px-2 sm:px-4">
      {/* ========================================================================= */}
      {/* 1. TOP CAROUSEL & COLLAPSIBLE HEADER                                      */}
      {/* ========================================================================= */}
      <div className="flex-shrink-0 pt-2 pb-2">
        {/* Toggle Bar */}
        <div className="flex items-center justify-between mb-1.5 px-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 tracking-wide flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-amber-500" />
              <span>Studio Obrolan Karakter</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Fact Vault Badge Trigger */}
            <button
              type="button"
              onClick={() => setIsFactVaultOpen(true)}
              className="flex items-center gap-1 py-1 px-2.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold border border-indigo-500/20 transition"
              title="Lihat apa yang diingat tokoh tentang Anda"
            >
              <Brain className="w-3 h-3 text-indigo-500" />
              <span>{authorKnownFacts.length} Memori Ingatan</span>
            </button>

            {/* Carousel Hide/Show Toggle */}
            <button
              type="button"
              onClick={toggleCarousel}
              className="flex items-center gap-1 py-1 px-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold transition"
            >
              {isCarouselHidden ? (
                <>
                  <Eye className="w-3 h-3 text-amber-500" />
                  <span className="hidden sm:inline">Pilih Tokoh</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-3 h-3 text-slate-400" />
                  <span className="hidden sm:inline">Sembunyikan</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Expanded Carousel */}
        {!isCarouselHidden ? (
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none pt-1 animate-in fade-in slide-in-from-top-2 duration-200">
            {characters.map((char) => (
              <CharacterAvatarThumb
                key={char.id}
                entity={char}
                isActive={char.id === activeChar.id}
                onClick={() => setSelectedEntityId(char.id)}
              />
            ))}
          </div>
        ) : (
          /* Collapsed Compact Header Pill */
          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-100/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 animate-in fade-in duration-200">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-800 flex items-center justify-center border border-amber-500/30 flex-shrink-0">
                {activeCharAvatarUrl ? (
                  <img src={activeCharAvatarUrl} alt={activeChar.name} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-5 h-5 text-amber-500" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {activeChar.name}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    ({activeChar.shortDescription || 'Karakter'})
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Siap mengobrol • Paham konteks naskah</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={toggleCarousel}
              className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline px-2 py-1"
            >
              Ganti Tokoh 👥
            </button>
          </div>
        )}
      </div>

      {/* Mode Switch & Action Bar */}
      <div className="flex items-center justify-between px-1 py-1 mb-1.5 text-[10px]">
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-0.5 rounded-xl border border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setChatMode('in_character')}
            className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 ${
              chatMode === 'in_character'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Shield className="w-3 h-3" />
            <span>Mode Imersif Cerita</span>
          </button>
          <button
            type="button"
            onClick={() => setChatMode('meta_interview')}
            className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 ${
              chatMode === 'meta_interview'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Film className="w-3 h-3" />
            <span>Wawancara Penulis</span>
          </button>
        </div>

        <button
          type="button"
          onClick={handleClearHistory}
          disabled={messages.length === 0 || isLoading}
          className="flex items-center gap-1 py-1 px-2 text-slate-400 hover:text-rose-500 disabled:opacity-30 transition"
          title="Reset riwayat obrolan dengan tokoh ini"
        >
          <Trash2 className="w-3 h-3" />
          <span className="hidden sm:inline">Bersihkan Chat</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 2. CHAT STREAM / MESSAGE BUBBLES                                          */}
      {/* ========================================================================= */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto px-1 py-2 space-y-3.5 rounded-2xl bg-white/40 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800/60 backdrop-blur-sm scroll-smooth p-2"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8 px-4">
            <div className="w-14 h-14 rounded-2xl overflow-hidden bg-slate-200 dark:bg-slate-800 flex items-center justify-center border border-amber-500/20 mb-3 shadow-md">
              {activeCharAvatarUrl ? (
                <img src={activeCharAvatarUrl} alt={activeChar.name} className="w-full h-full object-cover" />
              ) : (
                <User className="w-7 h-7 text-amber-500" />
              )}
            </div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">
              Mulai Percakapan dengan {activeChar.name}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-4 leading-relaxed">
              {activeChar.name} mengingat alur cerita naskah dan fakta-fakta yang Anda ceritakan kepadanya. Anda bisa mengobrol santai seputar jalan cerita maupun hal di luar cerita.
            </p>

            {/* Quick starter chips */}
            <div className="flex flex-wrap justify-center gap-1.5 max-w-md">
              {quickPrompts.slice(0, 3).map((prompt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendMessage(prompt)}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-300 transition text-left active:scale-95 flex items-center gap-1.5"
                >
                  <Sparkles className="w-3 h-3 text-amber-500 flex-shrink-0" />
                  <span>&quot;{prompt}&quot;</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <div
                key={msg.id}
                className={`flex gap-2.5 items-start ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Avatar */}
                <div className="flex-shrink-0 mt-0.5">
                  {isUser ? (
                    <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white shadow-sm font-bold text-xs">
                      P
                    </div>
                  ) : (
                    <div className="w-7 h-7 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-800 flex items-center justify-center border border-amber-500/20 shadow-sm">
                      {activeCharAvatarUrl ? (
                        <img src={activeCharAvatarUrl} alt={activeChar.name} className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-4 h-4 text-amber-500" />
                      )}
                    </div>
                  )}
                </div>

                {/* Message Bubble */}
                <div
                  className={`max-w-[82%] sm:max-w-[75%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed shadow-sm ${
                    isUser
                      ? 'bg-amber-500 text-white rounded-tr-none font-medium'
                      : 'bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 text-slate-800 dark:text-slate-200 rounded-tl-none'
                  }`}
                >
                  {!isUser && (
                    <span className="block text-[10px] font-bold text-amber-600 dark:text-amber-400 mb-1">
                      {activeChar.name}
                    </span>
                  )}
                  <p className="whitespace-pre-wrap select-text">{msg.text}</p>
                  <span
                    className={`block text-[9px] mt-1 text-right ${
                      isUser ? 'text-amber-100/80' : 'text-slate-400'
                    }`}
                  >
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })
        )}

        {/* ========================================================================= */}
        {/* 3. CUSTOM 3-DOT WAVE & ORBITAL SWIRL LOADING ANIMATION                    */}
        {/* ========================================================================= */}
        {isLoading && (
          <div className="flex gap-2.5 items-start animate-in fade-in duration-200">
            <div className="w-7 h-7 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-800 flex items-center justify-center border border-amber-500/30 flex-shrink-0 mt-0.5">
              {activeCharAvatarUrl ? (
                <img src={activeCharAvatarUrl} alt={activeChar.name} className="w-full h-full object-cover" />
              ) : (
                <User className="w-4 h-4 text-amber-500" />
              )}
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm flex flex-col gap-2">
              <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 italic">
                {loadingStatusText}
              </span>

              {/* 3-Dot Harmonic Wave & Orbital Swirl Container */}
              <div className="flex items-center gap-2 h-5 pl-1">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50 animate-wave-orbit-1" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-sm shadow-amber-400/50 animate-wave-orbit-2" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-600 shadow-sm shadow-amber-600/50 animate-wave-orbit-3" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 4. QUICK SUGGESTION CHIPS                                                 */}
      {/* ========================================================================= */}
      {messages.length > 0 && !isLoading && (
        <div className="flex items-center gap-1 overflow-x-auto py-1.5 scrollbar-none">
          {quickPrompts.map((chip, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendMessage(chip)}
              className="flex-shrink-0 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-[10px] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 transition active:scale-95"
            >
              💡 {chip}
            </button>
          ))}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. INPUT BAR                                                              */}
      {/* ========================================================================= */}
      <div className="flex-shrink-0 pt-1 pb-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-end gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-1.5 shadow-lg shadow-slate-200/50 dark:shadow-none focus-within:border-amber-400 dark:focus-within:border-amber-500 transition"
        >
          <textarea
            ref={inputRef}
            rows={1}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={`Ajak bicara ${activeChar.name}... (Enter untuk mengirim)`}
            className="flex-1 bg-transparent px-3 py-2 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none resize-none max-h-24 leading-relaxed"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="p-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white disabled:opacity-30 disabled:pointer-events-none shadow-md shadow-amber-500/20 transition active:scale-95 flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* ========================================================================= */}
      {/* 6. FACT VAULT MODAL (LONG-TERM MEMORY INSPECTOR)                          */}
      {/* ========================================================================= */}
      {isFactVaultOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-4 shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-indigo-500" />
                <div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    Buku Memori: {activeChar.name}
                  </h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Fakta tentang Anda yang diingat tokoh bahkan setelah puluhan percakapan
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFactVaultOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Facts list */}
            <div className="space-y-1.5 max-h-56 overflow-y-auto p-1">
              {authorKnownFacts.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-4">
                  Belum ada fakta yang tercatat. Ceritakan hobi, kesukaan, atau rahasiamu saat mengobrol, dan {activeChar.name} akan mencatatnya di sini secara otomatis!
                </p>
              ) : (
                authorKnownFacts.map((fact, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-800 dark:text-slate-200"
                  >
                    <span>🧠 {fact}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteFact(idx)}
                      className="text-slate-400 hover:text-rose-500 p-1 transition"
                      title="Lupakan fakta ini"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Manual add fact */}
            <div className="flex gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <input
                type="text"
                value={newManualFact}
                onChange={(e) => setNewManualFact(e.target.value)}
                placeholder="Tambah fakta manual (misal: Hobi bermain catur)"
                className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-400"
              />
              <button
                type="button"
                onClick={handleAddManualFact}
                disabled={!newManualFact.trim()}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl disabled:opacity-40 transition flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Simpan</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
