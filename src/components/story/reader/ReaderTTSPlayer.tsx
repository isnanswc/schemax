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
  Bot,
  Zap,
  Sliders,
  Repeat,
  Cloud,
  Key,
  Cpu,
  ShieldCheck
} from 'lucide-react';
import { ParagraphTensionItem, ParagraphEmotionTag } from '../../../types';
import { getEmotionAcoustics } from '../../../services/dramaDirectorService';
import {
  TTSEngineMode,
  AIVoiceOption,
  AITTSModelOption,
  getModelsForEngine,
  getVoicesForEngine,
  generateUnifiedSpeechAudio,
  AZURE_VOICES,
  AZURE_TTS_MODELS,
  GOOGLE_CLOUD_VOICES,
  GOOGLE_CLOUD_TTS_MODELS,
  WASM_VOICES,
  WASM_TTS_MODELS,
  GEMINI_VOICES,
  GEMINI_TTS_MODELS,
  GROQ_VOICES,
  GROQ_TTS_MODELS,
  AUTO_TTS_MODELS,
} from '../../../services/geminiTtsService';
import { TTSConfigModal } from './TTSConfigModal';

export type FullTTSEngine = TTSEngineMode | 'browser';

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
  const [isContinuous, setIsContinuous] = useState(true);

  // Engine selection: 'auto' | 'azure' | 'google-cloud' | 'wasm' | 'gemini' | 'groq' | 'browser'
  const [ttsEngine, setTtsEngine] = useState<FullTTSEngine>('auto');

  // Unified engine model & voice state
  const [selectedModel, setSelectedModel] = useState<string>('auto-pipeline');
  const [selectedVoice, setSelectedVoice] = useState<string>('id-ID-GadisNeural');

  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [engineNotice, setEngineNotice] = useState<string | null>(null);
  const [isTTSConfigOpen, setIsTTSConfigOpen] = useState(false);

  // Pickers modal toggles
  const [isModelPickerOpen, setIsModelPickerOpen] = useState(false);
  const [isVoicePickerOpen, setIsVoicePickerOpen] = useState(false);

  // Browser voices state
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedBrowserVoice, setSelectedBrowserVoice] = useState<SpeechSynthesisVoice | null>(null);

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const htmlAudioRef = useRef<HTMLAudioElement | null>(null);
  const isPlayingRef = useRef(false);
  const isContinuousRef = useRef(true);

  // Gapless audio prefetch cache & in-flight tracker
  const prefetchedAudiosRef = useRef<Map<number, HTMLAudioElement>>(new Map());
  const isPrefetchingRef = useRef<Set<number>>(new Set());

  isPlayingRef.current = isPlaying;
  isContinuousRef.current = isContinuous;

  // Load browser voices
  useEffect(() => {
    const updateVoices = () => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      const voices = window.speechSynthesis.getVoices();
      if (!voices || voices.length === 0) return;

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
        setSelectedBrowserVoice(idVoice);
      } else {
        const defaultVoice = voices.find((v) => v.default) || voices[0];
        setSelectedBrowserVoice(defaultVoice || null);
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
      prefetchedAudiosRef.current.forEach((audio) => {
        audio.pause();
        audio.src = '';
      });
      prefetchedAudiosRef.current.clear();
      isPrefetchingRef.current.clear();
    };
  }, []);

  // Invalidate prefetched audio cache when voice/model/engine changes
  useEffect(() => {
    prefetchedAudiosRef.current.forEach((audio) => {
      audio.pause();
      audio.src = '';
    });
    prefetchedAudiosRef.current.clear();
    isPrefetchingRef.current.clear();
  }, [ttsEngine, selectedModel, selectedVoice]);

  const handleEngineChange = (newEngine: FullTTSEngine) => {
    handleStop();
    setTtsEngine(newEngine);
    if (newEngine !== 'browser') {
      const models = getModelsForEngine(newEngine);
      const voices = getVoicesForEngine(newEngine);
      setSelectedModel(models[0]?.id || '');
      setSelectedVoice(voices[0]?.id || '');
    }
  };

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

  // Background prefetch function to buffer paragraph audio ahead of time
  const prefetchParagraph = async (index: number) => {
    if (index < 0 || index >= paragraphs.length || ttsEngine === 'browser') return;
    if (prefetchedAudiosRef.current.has(index) || isPrefetchingRef.current.has(index)) return;

    const rawText = paragraphs[index]?.trim();
    if (!rawText) return;

    isPrefetchingRef.current.add(index);
    try {
      const tag = emotionTags.find((t) => t.paragraphIndex === index);
      const res = await generateUnifiedSpeechAudio(
        rawText,
        ttsEngine as TTSEngineMode,
        selectedModel,
        selectedVoice,
        tag
      );

      if (res.audioUrl) {
        const audio = new Audio(res.audioUrl);
        audio.preload = 'auto';
        audio.playbackRate = baseRate;
        audio.load();
        prefetchedAudiosRef.current.set(index, audio);
      }
    } catch (e) {
      console.warn(`[TTS Prefetch] Background prefetch paragraf ${index}:`, e);
    } finally {
      isPrefetchingRef.current.delete(index);
    }
  };

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
      if (index + 1 < paragraphs.length && isContinuousRef.current) {
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
    if (selectedBrowserVoice) {
      utterance.voice = selectedBrowserVoice;
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
        if (index + 1 < paragraphs.length && isContinuousRef.current) {
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

  // Speak with Unified AI TTS Engine (Auto-Fallback, Azure, Google Cloud, WASM, Gemini, Groq)
  const speakWithUnifiedEngine = async (index: number) => {
    const rawText = paragraphs[index]?.trim();
    if (!rawText) {
      if (index + 1 < paragraphs.length && isContinuousRef.current) {
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

    setEngineNotice(null);

    // 1. Instant Play if Audio is Already Prefetched in Background
    if (prefetchedAudiosRef.current.has(index)) {
      const audio = prefetchedAudiosRef.current.get(index)!;
      prefetchedAudiosRef.current.delete(index);
      audio.playbackRate = baseRate;
      htmlAudioRef.current = audio;

      audio.onended = () => {
        if (isPlayingRef.current) {
          if (index + 1 < paragraphs.length && isContinuousRef.current) {
            onParagraphChange(index + 1);
            speakParagraph(index + 1);
          } else {
            setIsPlaying(false);
            setIsPaused(false);
          }
        }
      };

      audio.onerror = (e) => {
        console.warn('Audio playback error:', e);
        setEngineNotice('Gagal memutar stream audio.');
        setIsPlaying(false);
      };

      try {
        await audio.play();
        setIsPlaying(true);
        setIsPaused(false);
        setIsLoadingAudio(false);

        // Preload next paragraph while this one plays
        if (index + 1 < paragraphs.length) {
          prefetchParagraph(index + 1);
        }
        return;
      } catch (e) {
        console.warn('Prefetched audio play failed, falling back to fresh fetch:', e);
      }
    }

    // 2. Fresh Network Fetch (with loading indicator)
    setIsLoadingAudio(true);

    try {
      const tag = emotionTags.find((t) => t.paragraphIndex === index);
      const res = await generateUnifiedSpeechAudio(
        rawText,
        ttsEngine as TTSEngineMode,
        selectedModel,
        selectedVoice,
        tag
      );

      const audio = new Audio(res.audioUrl);
      audio.playbackRate = baseRate;
      htmlAudioRef.current = audio;

      audio.onended = () => {
        if (isPlayingRef.current) {
          if (index + 1 < paragraphs.length && isContinuousRef.current) {
            onParagraphChange(index + 1);
            speakParagraph(index + 1);
          } else {
            setIsPlaying(false);
            setIsPaused(false);
          }
        }
      };

      audio.onerror = (e) => {
        console.warn('Audio stream error:', e);
        setEngineNotice('Gagal memutar stream audio.');
        setIsPlaying(false);
      };

      await audio.play();
      setIsPlaying(true);
      setIsPaused(false);

      // Preload next paragraph immediately in background!
      if (index + 1 < paragraphs.length) {
        prefetchParagraph(index + 1);
      }
    } catch (err: any) {
      console.warn('Gagal memutar audio AI:', err);
      setEngineNotice(`Gagal Suara AI: ${err.message || 'Layanan TTS belum merespon'}`);
      setIsPlaying(false);
      setIsPaused(false);
    } finally {
      setIsLoadingAudio(false);
    }
  };

  // Main dispatch speak function
  const speakParagraph = (index: number) => {
    if (ttsEngine === 'browser') {
      speakWithBrowser(index);
    } else {
      speakWithUnifiedEngine(index);
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
      if (isPaused && htmlAudioRef.current && htmlAudioRef.current.src) {
        htmlAudioRef.current
          .play()
          .then(() => {
            setIsPlaying(true);
            setIsPaused(false);
            if (activeParagraphIndex + 1 < paragraphs.length) {
              prefetchParagraph(activeParagraphIndex + 1);
            }
          })
          .catch(() => {
            speakParagraph(activeParagraphIndex);
          });
      } else {
        speakParagraph(activeParagraphIndex);
      }
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

  const currentModels = ttsEngine !== 'browser' ? getModelsForEngine(ttsEngine as TTSEngineMode) : [];
  const currentVoices = ttsEngine !== 'browser' ? getVoicesForEngine(ttsEngine as TTSEngineMode) : [];
  const selectedModelObj = currentModels.find((m) => m.id === selectedModel) || currentModels[0];
  const selectedVoiceObj = currentVoices.find((v) => v.id === selectedVoice) || currentVoices[0];
  const isIndonesianBrowserVoice = selectedBrowserVoice?.lang.toLowerCase().startsWith('id');

  const getEngineDisplayLabel = () => {
    switch (ttsEngine) {
      case 'auto':
        return '✨ Auto-Fallback (Pintar)';
      case 'azure':
        return '🔷 Azure Neural AI';
      case 'google-cloud':
        return '🔴 Google Cloud TTS';
      case 'wasm':
        return '🛡️ WASM / Mobile Free';
      case 'gemini':
        return '🎙️ Gemini AI TTS';
      case 'groq':
        return '⚡ Groq Cloud TTS';
      default:
        return '🤖 Browser Offline';
    }
  };

  return (
    <>
      <div className="fixed bottom-3 inset-x-2 sm:inset-x-auto sm:right-6 sm:w-[480px] max-w-full z-40 animate-in slide-in-from-bottom-4 duration-250 select-none">
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
                  <span>{getEngineDisplayLabel()}</span>
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  Paragraf {activeParagraphIndex + 1} dari {paragraphs.length}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/* Button to open TTS Key Config */}
              <button
                type="button"
                onClick={() => setIsTTSConfigOpen(true)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-amber-500 hover:bg-amber-500/10 transition"
                title="Pengaturan Kunci API Azure & Google Cloud (Opsional)"
              >
                <Key className="w-3.5 h-3.5" />
              </button>

              {/* AI Director Emotion Tagging Trigger */}
              {onRunEmotionTagging &&
                (emotionTags.length > 0 ? (
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
                        <span>Bedah Emosi</span>
                      </>
                    )}
                  </button>
                ))}

              {/* Active Emotion / Tension Badge */}
              <span
                className={`py-0.5 px-2 rounded-full border text-[10px] font-bold flex items-center gap-1 max-w-[120px] sm:max-w-[140px] truncate ${activeModulation.color}`}
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

          {/* Engine Switcher Bar: [ Auto ] [ Azure ] [ Google ] [ WASM ] [ Gemini ] [ Groq ] [ Browser ] */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 text-[10px] overflow-x-auto no-scrollbar">
            <span className="font-bold text-slate-500 dark:text-slate-400 pl-1.5 flex-shrink-0 hidden xs:inline">
              Mesin:
            </span>
            <div className="flex items-center gap-1 w-full justify-start sm:justify-end flex-nowrap">
              <button
                type="button"
                onClick={() => handleEngineChange('auto')}
                className={`flex-shrink-0 py-1 px-2.5 rounded-xl font-bold transition flex items-center justify-center gap-1 ${
                  ttsEngine === 'auto'
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Auto-Fallback Pintar: Azure ➔ Google Cloud ➔ Gemini ➔ WASM Mobile Free"
              >
                <Sparkles className="w-3 h-3" />
                <span>Auto</span>
              </button>

              <button
                type="button"
                onClick={() => handleEngineChange('azure')}
                className={`flex-shrink-0 py-1 px-2 rounded-xl font-bold transition flex items-center justify-center gap-1 ${
                  ttsEngine === 'azure'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Microsoft Azure Speech (Gadis & Ardi Neural)"
              >
                <Cloud className="w-3 h-3" />
                <span>Azure</span>
              </button>

              <button
                type="button"
                onClick={() => handleEngineChange('google-cloud')}
                className={`flex-shrink-0 py-1 px-2 rounded-xl font-bold transition flex items-center justify-center gap-1 ${
                  ttsEngine === 'google-cloud'
                    ? 'bg-rose-500 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Google Cloud TTS (Neural2 / WaveNet)"
              >
                <Cpu className="w-3 h-3" />
                <span>Google</span>
              </button>

              <button
                type="button"
                onClick={() => handleEngineChange('wasm')}
                className={`flex-shrink-0 py-1 px-2 rounded-xl font-bold transition flex items-center justify-center gap-1 ${
                  ttsEngine === 'wasm'
                    ? 'bg-emerald-500 text-slate-950 shadow-xs font-black'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="WASM / Mobile Free: 100% Gratis Selamanya & Bebas Kuota"
              >
                <ShieldCheck className="w-3 h-3" />
                <span>WASM Free</span>
              </button>

              <button
                type="button"
                onClick={() => handleEngineChange('gemini')}
                className={`flex-shrink-0 py-1 px-2 rounded-xl font-bold transition flex items-center justify-center gap-1 ${
                  ttsEngine === 'gemini'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Google AI Studio Gemini Flash TTS"
              >
                <span>Gemini</span>
              </button>

              <button
                type="button"
                onClick={() => handleEngineChange('groq')}
                className={`flex-shrink-0 py-1 px-2 rounded-xl font-bold transition flex items-center justify-center gap-1 ${
                  ttsEngine === 'groq'
                    ? 'bg-indigo-500 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Groq Cloud Orpheus TTS"
              >
                <Zap className="w-3 h-3" />
                <span>Groq</span>
              </button>

              <button
                type="button"
                onClick={() => handleEngineChange('browser')}
                className={`flex-shrink-0 py-1 px-2 rounded-xl font-bold transition flex items-center justify-center gap-1 ${
                  ttsEngine === 'browser'
                    ? 'bg-slate-300 dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Suara Bawaan Sistem HP / OS Offline"
              >
                <Bot className="w-3 h-3" />
                <span>Browser</span>
              </button>
            </div>
          </div>

          {/* Model & Voice Config Row (When non-browser engine is active) */}
          {ttsEngine !== 'browser' && (
            <div className="flex items-center justify-between gap-2 px-1 text-[11px]">
              {/* Model Selector Pill */}
              <div className="relative min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsModelPickerOpen(!isModelPickerOpen);
                    setIsVoicePickerOpen(false);
                  }}
                  className="w-full py-1 px-2 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-1 text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate"
                  title="Pilih Model AI TTS"
                >
                  <div className="flex items-center gap-1 truncate">
                    <Sliders className="w-3 h-3 text-amber-500 flex-shrink-0" />
                    <span className="truncate">{selectedModelObj?.name || 'Pilih Model'}</span>
                  </div>
                  <ChevronDown className="w-2.5 h-2.5 opacity-50 flex-shrink-0" />
                </button>

                {/* Model Dropdown */}
                {isModelPickerOpen && (
                  <div className="absolute left-0 bottom-full mb-2 w-64 max-h-56 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-1.5 z-50 animate-in fade-in zoom-in-95 text-xs">
                    <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Model TTS Tersedia
                    </div>
                    {currentModels.map((m) => {
                      const isSel = selectedModel === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setSelectedModel(m.id);
                            setIsModelPickerOpen(false);
                          }}
                          className={`w-full text-left px-2.5 py-1.5 rounded-xl transition flex flex-col text-xs mb-0.5 ${
                            isSel
                              ? 'bg-amber-500 text-slate-950 font-bold'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <span className="truncate font-semibold">{m.name}</span>
                          <span className={`text-[10px] truncate ${isSel ? 'text-slate-900/80' : 'text-slate-400'}`}>
                            {m.description}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Voice Persona Pill */}
              <div className="relative min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsVoicePickerOpen(!isVoicePickerOpen);
                    setIsModelPickerOpen(false);
                  }}
                  className="w-full py-1 px-2 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-1 text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate"
                  title="Pilih Karakter Suara"
                >
                  <div className="flex items-center gap-1 truncate">
                    <span>{selectedVoiceObj?.avatar || '🎙️'}</span>
                    <span className="truncate">{selectedVoiceObj?.name || 'Pilih Suara'}</span>
                  </div>
                  <ChevronDown className="w-2.5 h-2.5 opacity-50 flex-shrink-0" />
                </button>

                {/* Voice Dropdown */}
                {isVoicePickerOpen && (
                  <div className="absolute right-0 bottom-full mb-2 w-64 max-h-56 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-1.5 z-50 animate-in fade-in zoom-in-95 text-xs">
                    <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Karakter Suara ({currentVoices.length})
                    </div>
                    {currentVoices.map((v) => {
                      const isSel = selectedVoice === v.id;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => {
                            setSelectedVoice(v.id);
                            setIsVoicePickerOpen(false);
                            if (isPlaying) speakParagraph(activeParagraphIndex);
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
                  </div>
                )}
              </div>
            </div>
          )}

        {/* Notice Banner (If API key needed or error happened) */}
        {engineNotice && (
          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-800 dark:text-rose-200 flex items-start justify-between gap-2 animate-in fade-in">
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
          {/* Left: Speed control & Continuous mode toggle */}
          <div className="flex items-center gap-1 sm:gap-1.5">
            <button
              type="button"
              onClick={handleSpeedToggle}
              className="py-1 px-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300 active:scale-95 transition"
              title="Ubah Kecepatan Suara"
            >
              {baseRate}x
            </button>
            <button
              type="button"
              onClick={() => setIsContinuous(!isContinuous)}
              className={`py-1 px-2 rounded-xl border text-[10px] font-bold flex items-center gap-1 transition active:scale-95 ${
                isContinuous
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300 shadow-xs'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400'
              }`}
              title={
                isContinuous
                  ? 'Mode Menyambung Aktif: Narasi otomatis berpindah ke paragraf berikutnya tanpa jeda (Gapless Prefetch).'
                  : 'Mode Per-Paragraf: Berhenti setelah membaca 1 paragraf.'
              }
            >
              <Repeat className={`w-3 h-3 ${isContinuous ? 'text-amber-500' : ''}`} />
              <span className="hidden sm:inline">{isContinuous ? 'Menyambung' : '1 Paragraf'}</span>
            </button>
          </div>

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

          {/* Right: Voice selector trigger for browser mode */}
          {ttsEngine === 'browser' ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsVoicePickerOpen(!isVoicePickerOpen)}
                className="py-1 px-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1 max-w-[100px] sm:max-w-[120px] truncate"
                title="Pilih Suara Browser Sistem"
              >
                <Radio className="w-3 h-3 text-amber-500 flex-shrink-0" />
                <span className="truncate">{selectedBrowserVoice ? selectedBrowserVoice.name.split(' ')[0] : 'Suara'}</span>
                <ChevronDown className="w-2.5 h-2.5 opacity-50 flex-shrink-0" />
              </button>

              {/* Browser Voice Dropdown */}
              {isVoicePickerOpen && (
                <div className="absolute right-0 bottom-full mb-2 w-64 max-h-56 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-1.5 z-50 animate-in fade-in zoom-in-95 text-xs">
                  <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Suara Bawaan Sistem ({availableVoices.length})
                  </div>
                  {availableVoices.map((v) => {
                    const isSel = selectedBrowserVoice?.name === v.name;
                    const isId = v.lang.toLowerCase().startsWith('id');
                    return (
                      <button
                        key={v.name}
                        type="button"
                        onClick={() => {
                          setSelectedBrowserVoice(v);
                          setIsVoicePickerOpen(false);
                          if (isPlaying) speakParagraph(activeParagraphIndex);
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
                </div>
              )}
            </div>
          ) : (
            <div className="text-[10px] text-slate-400 font-bold hidden sm:inline px-1">
              {getEngineDisplayLabel()}
            </div>
          )}
        </div>

        {/* Current Paragraph Sneak Peek */}
        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 italic px-1">
          &ldquo;{paragraphs[activeParagraphIndex] || ''}&rdquo;
        </p>
      </div>
    </div>

    <TTSConfigModal
      isOpen={isTTSConfigOpen}
      onClose={() => setIsTTSConfigOpen(false)}
    />
  </>
  );
};
