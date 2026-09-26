import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  Volume2,
  Sparkles,
  ChevronDown,
  X,
  Radio,
  Loader2,
  RefreshCw,
  AlertCircle,
  Bot
} from 'lucide-react';
import { ParagraphTensionItem, ParagraphEmotionTag } from '../../../types';
import { getEmotionAcoustics } from '../../../services/dramaDirectorService';
import {
  GEMINI_VOICES,
  GeminiVoiceOption,
  generateGeminiSpeechAudio
} from '../../../services/geminiTtsService';

export type TTSEngineMode = 'gemini' | 'browser';

interface ReaderTTSPlayerProps {
  paragraphs: string[];
  tensionItems?: ParagraphTensionItem[];
  emotionTags?: ParagraphEmotionTag[];
  onRunEmotionTagging?: () => Promise<void>;
  isTaggingEmotion?: boolean;
  activeParagraphIndex: number;
  onParagraphChange: (index: number) => void;
  onClose: () => void;
}

export const ReaderTTSPlayer: React.FC<ReaderTTSPlayerProps> = ({
  paragraphs,
  tensionItems = [],
  emotionTags = [],
  onRunEmotionTagging,
  isTaggingEmotion = false,
  activeParagraphIndex,
  onParagraphChange,
  onClose,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [baseRate, setBaseRate] = useState<number>(1.0);

  // Engine selection: 'gemini' (AI Studio) vs 'browser' (Offline Web Speech)
  const [ttsEngine, setTtsEngine] = useState<TTSEngineMode>('gemini');
  const [selectedGeminiVoice, setSelectedGeminiVoice] = useState<string>('Aoede');
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [engineNotice, setEngineNotice] = useState<string | null>(null);

  // Browser voices
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [isVoicePickerOpen, setIsVoicePickerOpen] = useState(false);

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const htmlAudioRef = useRef<HTMLAudioElement | null>(null);
  const isPlayingRef = useRef(false);

  isPlayingRef.current = isPlaying;

  // Load browser voices
  useEffect(() => {
    const updateVoices = () => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
        // Sort voices to place Indonesian voices at the very top
        const sorted = [...voices].sort((a, b) => {
          const aId =
            a.lang.toLowerCase().startsWith('id') ||
            a.name.toLowerCase().includes('indonesia') ||
            a.name.toLowerCase().includes('gadis') ||
            a.name.toLowerCase().includes('ardi');
          const bId =
            b.lang.toLowerCase().startsWith('id') ||
            b.name.toLowerCase().includes('indonesia') ||
            b.name.toLowerCase().includes('gadis') ||
            b.name.toLowerCase().includes('ardi');
          if (aId && !bId) return -1;
          if (!aId && bId) return 1;
          return a.name.localeCompare(b.name);
        });
        setAvailableVoices(sorted);

        // Prioritize Indonesian voices
        const idVoice = sorted.find(
          (v) =>
            v.lang.toLowerCase().startsWith('id') ||
            v.name.toLowerCase().includes('indonesia') ||
            v.name.toLowerCase().includes('gadis') ||
            v.name.toLowerCase().includes('ardi') ||
            v.name.toLowerCase().includes('andika')
        );
        if (idVoice) {
          setSelectedVoice(idVoice);
        } else {
          // Fallback to default or English
          const defaultVoice = voices.find((v) => v.default) || voices[0];
          setSelectedVoice(defaultVoice || null);
        }
    };

    updateVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }

    return () => {
      if (htmlAudioRef.current) {
        htmlAudioRef.current.pause();
        htmlAudioRef.current.src = '';
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Compute emotion modulation parameters based on current paragraph's tension score
  const currentTensionItem = tensionItems.find(
    (it) => it.paragraphIndex === activeParagraphIndex
  );

  const getTensionModulation = (score?: number) => {
    if (score === undefined) {
      return {
        rateMultiplier: 1.0,
        pitch: 1.0,
        label: 'Narasi Alami',
        color: 'text-slate-400 bg-slate-400/10 border-slate-400/20',
        icon: '📖',
      };
    }

    if (score <= 30) {
      return {
        rateMultiplier: 0.92,
        pitch: 0.95,
        label: 'Tenang (Rileks)',
        color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
        icon: '🌿',
      };
    }

    if (score <= 60) {
      return {
        rateMultiplier: 1.0,
        pitch: 0.92,
        label: 'Misteri (Berat)',
        color: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30',
        icon: '🔍',
      };
    }

    if (score <= 80) {
      return {
        rateMultiplier: 1.15,
        pitch: 1.08,
        label: 'Konflik (Cepat)',
        color: 'text-orange-600 dark:text-orange-400 bg-orange-500/10 border-orange-500/30',
        icon: '⚡',
      };
    }

    return {
      rateMultiplier: 1.25,
      pitch: 1.18,
      label: 'Klimaks (Adrenalin)',
      color: 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/30',
      icon: '🔥',
    };
  };

  const tensionModulation = getTensionModulation(currentTensionItem?.tensionScore);

  const currentEmotionTag = emotionTags.find(
    (it) => it.paragraphIndex === activeParagraphIndex
  );
  const currentEmotionAcoustics = currentEmotionTag
    ? getEmotionAcoustics(currentEmotionTag.emotion, currentEmotionTag.intensity)
    : null;

  const activeModulation = currentEmotionAcoustics
    ? {
        label: `${currentEmotionTag?.speaker}: ${currentEmotionAcoustics.label}`,
        color: currentEmotionAcoustics.color,
        icon: currentEmotionAcoustics.icon,
      }
    : tensionModulation;

  // Speak with browser Web Speech Synthesis
  const speakWithBrowser = (index: number) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (index < 0 || index >= paragraphs.length) {
      setIsPlaying(false);
      setIsPaused(false);
      return;
    }

    if (htmlAudioRef.current) {
      htmlAudioRef.current.pause();
    }
    window.speechSynthesis.cancel();

    const rawText = paragraphs[index]?.trim();
    if (!rawText) {
      if (index + 1 < paragraphs.length) {
        onParagraphChange(index + 1);
        speakParagraph(index + 1);
      } else {
        setIsPlaying(false);
      }
      return;
    }

    const tag = emotionTags.find((t) => t.paragraphIndex === index);
    const item = tensionItems.find((it) => it.paragraphIndex === index);
    const tensionMod = getTensionModulation(item?.tensionScore);

    const utterance = new SpeechSynthesisUtterance(rawText);
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    // Dynamic rate & pitch with base rate
    if (tag) {
      utterance.rate = Math.max(0.5, Math.min(2.0, baseRate * tag.rateMod));
      utterance.pitch = Math.max(0.5, Math.min(1.8, tag.pitchMod));
    } else {
      utterance.rate = Math.max(0.5, Math.min(2.0, baseRate * tensionMod.rateMultiplier));
      utterance.pitch = Math.max(0.5, Math.min(1.8, tensionMod.pitch));
    }

    utterance.onend = () => {
      if (isPlayingRef.current) {
        if (index + 1 < paragraphs.length) {
          onParagraphChange(index + 1);
          speakParagraph(index + 1);
        } else {
          setIsPlaying(false);
          setIsPaused(false);
        }
      }
    };

    utterance.onerror = (e) => {
      console.warn('Browser TTS playback error:', e);
      setIsPlaying(false);
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setIsPlaying(true);
    setIsPaused(false);
  };

  // Speak with Gemini AI Studio Audio
  const speakWithGemini = async (index: number) => {
    const rawText = paragraphs[index]?.trim();
    if (!rawText) {
      if (index + 1 < paragraphs.length) {
        onParagraphChange(index + 1);
        speakParagraph(index + 1);
      } else {
        setIsPlaying(false);
      }
      return;
    }

    if (htmlAudioRef.current) {
      htmlAudioRef.current.pause();
      htmlAudioRef.current.src = '';
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    setIsLoadingAudio(true);
    setEngineNotice(null);

    try {
      const tag = emotionTags.find((t) => t.paragraphIndex === index);
      const actingCue = tag
        ? `${tag.isDialogue ? 'Dialog karakter ' + tag.speaker : 'Narasi pencerita'}. Emosi: ${tag.emotionLabel}. Catatan: ${tag.actingNotes}`
        : undefined;

      const { audioUrl } = await generateGeminiSpeechAudio(
        rawText,
        selectedGeminiVoice,
        actingCue
      );

      const audio = new Audio(audioUrl);
      audio.playbackRate = baseRate;
      htmlAudioRef.current = audio;

      audio.onended = () => {
        if (isPlayingRef.current) {
          if (index + 1 < paragraphs.length) {
            onParagraphChange(index + 1);
            speakParagraph(index + 1);
          } else {
            setIsPlaying(false);
            setIsPaused(false);
          }
        }
      };

      audio.onerror = (e) => {
        console.warn('Gemini audio error, falling back to browser TTS:', e);
        speakWithBrowser(index);
      };

      await audio.play();
      setIsPlaying(true);
      setIsPaused(false);
    } catch (err: any) {
      console.warn('Gagal memutar audio Gemini AI:', err);
      setEngineNotice(err.message || 'Model AI Studio belum merespon.');
      setIsPlaying(false);
      setIsPaused(false);
    } finally {
      setIsLoadingAudio(false);
    }
  };

  // Main dispatch speak function
  const speakParagraph = (index: number) => {
    if (ttsEngine === 'gemini') {
      speakWithGemini(index);
    } else {
      speakWithBrowser(index);
    }
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      if (htmlAudioRef.current) {
        htmlAudioRef.current.pause();
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsPlaying(false);
      setIsPaused(true);
    } else {
      speakParagraph(activeParagraphIndex);
    }
  };

  const handleStop = () => {
    if (htmlAudioRef.current) {
      htmlAudioRef.current.pause();
      htmlAudioRef.current.currentTime = 0;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
    setIsPaused(false);
    setIsLoadingAudio(false);
  };

  const handlePrevParagraph = () => {
    const nextIdx = Math.max(0, activeParagraphIndex - 1);
    onParagraphChange(nextIdx);
    if (isPlaying) {
      speakParagraph(nextIdx);
    }
  };

  const handleNextParagraph = () => {
    const nextIdx = Math.min(paragraphs.length - 1, activeParagraphIndex + 1);
    onParagraphChange(nextIdx);
    if (isPlaying) {
      speakParagraph(nextIdx);
    }
  };

  const handleSpeedToggle = () => {
    const speeds = [0.75, 1.0, 1.25, 1.5, 2.0];
    const currIdx = speeds.indexOf(baseRate);
    const nextRate = speeds[(currIdx + 1) % speeds.length];
    setBaseRate(nextRate);
    if (htmlAudioRef.current) {
      htmlAudioRef.current.playbackRate = nextRate;
    }
    if (isPlaying && ttsEngine === 'browser') {
      speakParagraph(activeParagraphIndex);
    }
  };

  const currentGeminiVoice = GEMINI_VOICES.find((v) => v.id === selectedGeminiVoice) || GEMINI_VOICES[0];
  const isIndonesianBrowserVoice = selectedVoice?.lang.toLowerCase().startsWith('id');

  return (
    <div className="fixed bottom-3 inset-x-2 sm:inset-x-auto sm:right-6 sm:w-[440px] max-w-full z-40 animate-in slide-in-from-bottom-4 duration-250 select-none">
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-amber-500/30 dark:border-amber-500/25 rounded-3xl shadow-2xl p-3 sm:p-4 space-y-2.5">
        {/* Top Info Bar */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="p-1.5 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
              {isLoadingAudio ? (
                <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
              ) : (
                <Volume2 className="w-4 h-4 animate-pulse" />
              )}
            </span>
            <div className="min-w-0">
              <span className="text-[11px] font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5 truncate">
                <span>{ttsEngine === 'gemini' ? '🎙️ AI Studio Voice (Gemini)' : '🤖 Browser TTS (Offline)'}</span>
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                Paragraf {activeParagraphIndex + 1} dari {paragraphs.length}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* AI Director Emotion Tagging Trigger */}
            {onRunEmotionTagging && (
              emotionTags.length > 0 ? (
                <button
                  type="button"
                  onClick={onRunEmotionTagging}
                  disabled={isTaggingEmotion}
                  className="py-0.5 px-2 rounded-full border text-[10px] font-bold flex items-center gap-1 text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20 transition active:scale-95 disabled:opacity-50"
                  title="Naskah bab ini telah dibedah sutradara AI. Klik untuk membedah ulang."
                >
                  <RefreshCw className={`w-2.5 h-2.5 ${isTaggingEmotion ? 'animate-spin' : ''}`} />
                  <span className="hidden xs:inline">Emosi AI</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onRunEmotionTagging}
                  disabled={isTaggingEmotion}
                  className="py-1 px-2.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-[10px] flex items-center gap-1 shadow-xs transition active:scale-95 disabled:opacity-50"
                  title="Bedah emosi dialog & narasi dengan AI Sutradara Suara untuk intonasi vokal dramatis"
                >
                  {isTaggingEmotion ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Membedah...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3" />
                      <span>Bedah Emosi (AI)</span>
                    </>
                  )}
                </button>
              )
            )}

            {/* Active Emotion / Tension Badge */}
            <span
              className={`py-0.5 px-2 rounded-full border text-[10px] font-bold flex items-center gap-1 max-w-[130px] sm:max-w-[150px] truncate ${activeModulation.color}`}
              title={`Modulasi Suara Aktif (${activeModulation.label})`}
            >
              <span>{activeModulation.icon}</span>
              <span className="truncate">{activeModulation.label}</span>
            </span>

            <button
              type="button"
              onClick={() => {
                handleStop();
                onClose();
              }}
              className="p-1 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
              title="Tutup Player"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Engine Switcher Bar: [ AI Studio (Gemini) ] vs [ Browser ] */}
        <div className="flex items-center justify-between gap-2 p-1 bg-slate-100 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 text-[10px]">
          <span className="font-bold text-slate-500 dark:text-slate-400 pl-2">
            Mesin Suara:
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                handleStop();
                setTtsEngine('gemini');
              }}
              className={`py-1 px-2.5 rounded-xl font-bold transition flex items-center gap-1 ${
                ttsEngine === 'gemini'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Suara manusia AI ekspresif dari Google AI Studio (Pelafalan fasih Indonesia)"
            >
              <Sparkles className="w-3 h-3" />
              <span>AI Studio (Gemini)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                handleStop();
                setTtsEngine('browser');
              }}
              className={`py-1 px-2.5 rounded-xl font-bold transition flex items-center gap-1 ${
                ttsEngine === 'browser'
                  ? 'bg-slate-300 dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Suara bawaan OS/perangkat (Offline)"
            >
              <Bot className="w-3 h-3" />
              <span>Browser Offline</span>
            </button>
          </div>
        </div>

        {/* Notice Banner (If API key needed or error happened) */}
        {engineNotice && (
          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-800 dark:text-rose-200 flex items-start justify-between gap-2">
            <div className="flex items-start gap-1.5 flex-1 min-w-0">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-500" />
              <div className="leading-tight">
                <span className="font-bold block text-[11px]">Pemberitahuan Suara AI:</span>
                <span className="text-[10px] opacity-90 block">{engineNotice}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setEngineNotice(null);
                setTtsEngine('browser');
                speakWithBrowser(activeParagraphIndex);
              }}
              className="px-2 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-[10px] flex-shrink-0 active:scale-95 transition"
            >
              Gunakan Browser
            </button>
          </div>
        )}

        {/* Warning if in browser mode and no Indonesian voice is available */}
        {ttsEngine === 'browser' && !isIndonesianBrowserVoice && (
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-500" />
            <span className="flex-1 leading-tight text-[10px]">
              Perangkat belum memiliki paket suara Bahasa Indonesia. Jika suara terdengar seperti robot bahasa Inggris, pilih suara Indonesia di Microsoft Edge atau instal paket suara Indonesia di pengaturan sistem.
            </span>
          </div>
        )}

        {/* Vocal Acting Note Banner (if present from AI Director) */}
        {currentEmotionTag && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/20 rounded-xl text-[10px] text-slate-700 dark:text-slate-300 min-w-0">
            <span className="font-black text-amber-600 dark:text-amber-400 flex items-center gap-1 flex-shrink-0">
              {currentEmotionTag.isDialogue ? '💬' : '📖'} {currentEmotionTag.speaker}
            </span>
            <span className="text-slate-400 flex-shrink-0">•</span>
            <span className="truncate italic">
              &ldquo;{currentEmotionTag.actingNotes}&rdquo;
            </span>
          </div>
        )}

        {/* Player Controls Bar */}
        <div className="flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-950/80 p-2 rounded-2xl border border-slate-100 dark:border-slate-800">
          {/* Left: Speed control */}
          <button
            type="button"
            onClick={handleSpeedToggle}
            className="py-1 px-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300 active:scale-95 transition"
            title="Ubah Kecepatan Suara"
          >
            {baseRate}x
          </button>

          {/* Center Playback Buttons */}
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={handlePrevParagraph}
              disabled={activeParagraphIndex <= 0 || isLoadingAudio}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-40 transition active:scale-90"
              title="Paragraf Sebelumnya"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handlePlayPause}
              disabled={isLoadingAudio}
              className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-md shadow-amber-500/25 flex items-center justify-center transition active:scale-95 disabled:opacity-75"
              title={isPlaying ? 'Jeda (Pause)' : 'Mulai Membaca'}
            >
              {isLoadingAudio ? (
                <Loader2 className="w-5 h-5 animate-spin text-slate-950" />
              ) : isPlaying ? (
                <Pause className="w-5 h-5 fill-slate-950" />
              ) : (
                <Play className="w-5 h-5 fill-slate-950 ml-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={handleStop}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition active:scale-90"
              title="Berhenti (Stop)"
            >
              <Square className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleNextParagraph}
              disabled={activeParagraphIndex >= paragraphs.length - 1 || isLoadingAudio}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-40 transition active:scale-90"
              title="Paragraf Selanjutnya"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          {/* Right: Voice selector trigger */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsVoicePickerOpen(!isVoicePickerOpen)}
              className="py-1 px-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1 max-w-[100px] sm:max-w-[120px] truncate"
              title="Pilih Karakter Suara Narator"
            >
              {ttsEngine === 'gemini' ? (
                <>
                  <span>{currentGeminiVoice.avatar}</span>
                  <span className="truncate">{currentGeminiVoice.name}</span>
                </>
              ) : (
                <>
                  <Radio className="w-3 h-3 text-amber-500 flex-shrink-0" />
                  <span className="truncate">{selectedVoice ? selectedVoice.name.split(' ')[0] : 'Suara'}</span>
                </>
              )}
              <ChevronDown className="w-2.5 h-2.5 opacity-50 flex-shrink-0" />
            </button>

            {/* Voice Dropdown Picker */}
            {isVoicePickerOpen && (
              <div className="absolute right-0 bottom-full mb-2 w-64 max-h-56 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-1.5 z-50 animate-in fade-in zoom-in-95 text-xs">
                {ttsEngine === 'gemini' ? (
                  <>
                    <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Pilih Karakter AI Studio
                    </div>
                    {GEMINI_VOICES.map((v) => {
                      const isSel = selectedGeminiVoice === v.id;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => {
                            setSelectedGeminiVoice(v.id);
                            setIsVoicePickerOpen(false);
                            if (isPlaying) {
                              speakParagraph(activeParagraphIndex);
                            }
                          }}
                          className={`w-full text-left px-2.5 py-1.5 rounded-xl transition flex items-center gap-2 text-xs mb-0.5 ${
                            isSel
                              ? 'bg-amber-500 text-slate-950 font-bold'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <span className="text-sm">{v.avatar}</span>
                          <div className="min-w-0 flex-1">
                            <span className="block font-bold">{v.name}</span>
                            <span className={`text-[10px] block truncate ${isSel ? 'text-slate-900/80' : 'text-slate-400'}`}>
                              {v.description}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </>
                ) : (
                  <>
                    <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Suara Bawaan Sistem ({availableVoices.length})
                    </div>
                    {availableVoices.map((v) => {
                      const isSel = selectedVoice?.name === v.name;
                      const isId = v.lang.toLowerCase().startsWith('id');
                      return (
                        <button
                          key={v.name}
                          type="button"
                          onClick={() => {
                            setSelectedVoice(v);
                            setIsVoicePickerOpen(false);
                            if (isPlaying) {
                              speakParagraph(activeParagraphIndex);
                            }
                          }}
                          className={`w-full text-left px-2.5 py-1.5 rounded-xl transition flex items-center justify-between text-xs mb-0.5 ${
                            isSel
                              ? 'bg-amber-500 text-slate-950 font-bold'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <span className="truncate">{v.name}</span>
                          {isId && (
                            <span className={`text-[9px] px-1 rounded-sm ml-1 ${isSel ? 'bg-black/20 text-slate-950' : 'bg-emerald-500/20 text-emerald-600 font-bold'}`}>
                              INDONESIA
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Current Paragraph Sneak Peek */}
        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 italic px-1">
          &ldquo;{paragraphs[activeParagraphIndex] || ''}&rdquo;
        </p>
      </div>
    </div>
  );
};
