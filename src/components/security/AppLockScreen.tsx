import React, { useState, useEffect } from 'react';
import { useSecurity } from '../../contexts/SecurityContext';
import { Lock, Unlock, AlertCircle, Sparkles } from 'lucide-react';

// Literary manuscript typewriter phrases for cinematic blurred background stream
const BACKGROUND_LORE_LINES = [
  "Bab I: Pada malam ketika kabut tebal merayap melintasi menara utara...",
  "Kutukan kuno yang terkubur dalam sanubari para penjaga gerbang takdir.",
  "Di balik dinding perpustakaan kuno, bisikan tinta rahasia mulai terdengar.",
  "Setiap kata yang terukir adalah potongan jiwa yang tak pernah padam.",
  "Sang pengembara menatap peta usang, mencari altar yang telah lama hilang.",
  "Api lilin bergoyang dihembus angin guratan pena yang menolak menyerah.",
  "Bab II: Menyelami rahasia yang tersembunyi di balik bayang-bayang masa lalu.",
  "Glosarium mantra rahasia: Aegis Veritas, Lux Perpetua, Umbra Obscura.",
  "Tak ada cerita yang benar-benar selesai, hingga titik terakhir dituliskan.",
  "Sang alkemis menorehkan bab pamungkas di atas perkamen bertabur debu emas.",
  "Bab III: Menemukan kembali cahaya yang terkubur di bawah reruntuhan peradaban.",
  "Dalam keheningan malam, kata demi kata menjelma menjadi dunia yang abadi.",
];

export const AppLockScreen: React.FC = () => {
  const { isLocked, unlockAppWithPin, triggerBackdoorBySecretTap } = useSecurity();

  const [pinInput, setPinInput] = useState<string>('');
  const [errorShake, setErrorShake] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [secretTapCount, setSecretTapCount] = useState(0);
  const [isUnlockedSuccess, setIsUnlockedSuccess] = useState(false);

  // Trigger tactile / haptic feedback if supported by browser/device
  const triggerHaptic = (type: 'tap' | 'error' | 'success' = 'tap') => {
    try {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        if (type === 'tap') navigator.vibrate(25);
        else if (type === 'error') navigator.vibrate([40, 60, 40]);
        else if (type === 'success') navigator.vibrate([30, 40, 80]);
      }
    } catch {}
  };

  // Reset states when locked state changes
  useEffect(() => {
    if (isLocked) {
      setPinInput('');
      setErrorShake(false);
      setErrorMessage(null);
      setSecretTapCount(0);
      setIsUnlockedSuccess(false);
    }
  }, [isLocked]);

  if (!isLocked) return null;

  // Secret 5-tap on lock icon unlocks app instantly without any UI prompt or confirmation
  const handleSecretTap = () => {
    triggerHaptic('tap');
    const nextCount = secretTapCount + 1;
    setSecretTapCount(nextCount);

    if (nextCount >= 5) {
      setSecretTapCount(0);
      setIsUnlockedSuccess(true);
      triggerHaptic('success');
      setTimeout(() => {
        triggerBackdoorBySecretTap();
      }, 300);
    }
  };

  const handleKeyPress = (num: string) => {
    if (pinInput.length >= 6 || isUnlockedSuccess) return;
    triggerHaptic('tap');
    const nextPin = pinInput + num;
    setPinInput(nextPin);
    setErrorMessage(null);

    // Auto-validate immediately when full 6 digits are typed
    if (nextPin.length === 6) {
      setTimeout(() => {
        validatePin(nextPin);
      }, 50);
    }
  };

  const handleDelete = () => {
    if (isUnlockedSuccess) return;
    triggerHaptic('tap');
    setPinInput((prev) => prev.slice(0, -1));
    setErrorMessage(null);
  };

  const validatePin = async (codeToTest: string) => {
    const success = await unlockAppWithPin(codeToTest);
    if (success) {
      setIsUnlockedSuccess(true);
      triggerHaptic('success');
      setPinInput('');
      setErrorMessage(null);
    } else {
      triggerHaptic('error');
      setErrorShake(true);
      setErrorMessage('PIN 6-digit salah. Coba lagi.');
      setTimeout(() => {
        setErrorShake(false);
        setPinInput('');
      }, 600);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-slate-950 text-slate-100 p-4 select-none animate-in fade-in duration-300">
      {/* 📜 CINEMATIC FLOATING TYPEWRITER LORE MATRIX (DARK & LIGHT COMPLIANT) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.06] dark:opacity-[0.09] filter blur-[0.8px] select-none text-slate-900 dark:text-amber-200 font-mono text-[11px] sm:text-xs leading-relaxed leading-7">
        <div className="animate-typewriter-stream space-y-3 px-4 py-8">
          {[...BACKGROUND_LORE_LINES, ...BACKGROUND_LORE_LINES].map((line, idx) => (
            <p key={idx} className="whitespace-nowrap tracking-wider">
              {line}
            </p>
          ))}
        </div>
      </div>

      {/* Ambient Radial Glowing Halo */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-tr from-amber-500/20 via-orange-600/15 to-purple-600/20 rounded-full blur-3xl pointer-events-none" />

      {/* Main Lock Vault Card */}
      <div className="relative z-10 w-full max-w-xs sm:max-w-sm flex flex-col items-center text-center space-y-5">
        
        {/* 🔒 Secret Tap Trigger: Clean, Aesthetic, High-Tech Vault Emblem (NO HINTS, NO COUNTER) */}
        <div
          onClick={handleSecretTap}
          className="relative cursor-pointer group active:scale-95 transition-transform"
        >
          {/* Looping outer aura ring */}
          <div className="absolute -inset-2 rounded-full bg-gradient-to-r from-amber-500/30 to-orange-500/30 blur-md opacity-70 group-hover:opacity-100 transition animate-pulse" />
          
          <div className="relative w-18 h-18 sm:w-20 sm:h-20 rounded-3xl bg-slate-900/90 dark:bg-slate-900/90 border-2 border-amber-500/40 backdrop-blur-xl flex items-center justify-center shadow-xl shadow-amber-500/10 group-hover:border-amber-400 transition-all">
            {isUnlockedSuccess ? (
              <Unlock className="w-8 h-8 sm:w-9 sm:h-9 text-emerald-400 transition-all scale-110" />
            ) : (
              <Lock className="w-8 h-8 sm:w-9 sm:h-9 text-amber-400 group-hover:scale-105 transition-all" />
            )}
          </div>
        </div>

        {/* Title & Lore Micro-tagline */}
        <div className="space-y-1 pt-1">
          <h2 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center justify-center gap-1.5">
            <span>Brankas Schemax</span>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
          </h2>
          <p className="text-[11px] sm:text-xs text-slate-400 font-serif italic">
            "Ruang rahasia karya &amp; imajinasi Anda."
          </p>
        </div>

        {/* 🔢 EXACT 6-DIGIT PIN INDICATORS */}
        <div
          className={`flex items-center justify-center gap-3 py-1 transition-transform ${
            errorShake ? 'animate-bounce text-rose-500' : ''
          }`}
        >
          {[0, 1, 2, 3, 4, 5].map((idx) => {
            const isFilled = pinInput.length > idx;
            return (
              <div
                key={idx}
                className={`w-3.5 h-3.5 rounded-full transition-all duration-200 border ${
                  errorShake
                    ? 'border-rose-500 bg-rose-500 shadow-md shadow-rose-500/50'
                    : isUnlockedSuccess
                    ? 'border-emerald-400 bg-emerald-400 shadow-md shadow-emerald-400/50 scale-125'
                    : isFilled
                    ? 'border-amber-400 bg-amber-400 shadow-md shadow-amber-500/50 scale-125'
                    : 'border-slate-700 bg-slate-800/80 shadow-inner'
                }`}
              />
            );
          })}
        </div>

        {/* Error message */}
        {errorMessage && (
          <p className="text-xs font-bold text-rose-400 flex items-center gap-1 animate-fade-in">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{errorMessage}</span>
          </p>
        )}

        {/* 🎮 Cinematic Keypad with Ambient Breathing Looping Border */}
        <div className="p-3 sm:p-4 rounded-3xl bg-slate-900/60 dark:bg-slate-950/70 border border-amber-500/20 backdrop-blur-xl animate-keypad-glow w-full max-w-[280px]">
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handleKeyPress(digit)}
                className="h-13 rounded-2xl bg-white/5 hover:bg-white/15 active:bg-amber-500 active:text-slate-950 border border-white/10 text-lg font-bold text-white transition-all active:scale-90 shadow-sm flex items-center justify-center font-mono"
              >
                {digit}
              </button>
            ))}

            {/* Empty Spacer */}
            <div className="h-13 flex items-center justify-center" />

            {/* Digit 0 */}
            <button
              type="button"
              onClick={() => handleKeyPress('0')}
              className="h-13 rounded-2xl bg-white/5 hover:bg-white/15 active:bg-amber-500 active:text-slate-950 border border-white/10 text-lg font-bold text-white transition-all active:scale-90 shadow-sm flex items-center justify-center font-mono"
            >
              0
            </button>

            {/* Delete Button */}
            <button
              type="button"
              onClick={handleDelete}
              disabled={pinInput.length === 0}
              className="h-13 rounded-2xl bg-white/5 hover:bg-rose-500/20 active:bg-rose-500 disabled:opacity-20 border border-white/5 text-xs font-bold text-slate-400 hover:text-white transition-all active:scale-90 flex items-center justify-center"
            >
              Hapus
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
