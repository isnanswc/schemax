import React, { useState, useEffect } from 'react';
import { useSecurity } from '../../contexts/SecurityContext';
import { AlertCircle, Delete } from 'lucide-react';

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
  const [time, setTime] = useState<{ hh: string; mm: string; ss: string; dateStr: string }>({
    hh: '00',
    mm: '00',
    ss: '00',
    dateStr: '',
  });

  // Realtime clock (Hours, Minutes, Seconds) & Date
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      const dateStr = now.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      setTime({ hh, mm, ss, dateStr });
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Trigger tactile / haptic feedback if supported by browser/device
  const triggerHaptic = (type: 'tap' | 'error' | 'success' = 'tap') => {
    try {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        if (type === 'tap') navigator.vibrate(28);
        else if (type === 'error') navigator.vibrate([40, 70, 40]);
        else if (type === 'success') navigator.vibrate([30, 50, 100]);
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
      }, 700);
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
      setErrorMessage('PIN 6-digit tidak cocok. Silakan coba lagi.');
      setTimeout(() => {
        setErrorShake(false);
        setPinInput('');
      }, 600);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-between overflow-hidden bg-slate-950 text-slate-100 select-none animate-in fade-in duration-300">
      {/* 📜 CINEMATIC FLOATING TYPEWRITER LORE MATRIX (BACKGROUND) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.05] dark:opacity-[0.08] filter blur-[0.7px] select-none text-amber-200 font-mono text-[11px] sm:text-xs leading-loose">
        <div className="animate-typewriter-stream space-y-3 px-4 py-8">
          {[...BACKGROUND_LORE_LINES, ...BACKGROUND_LORE_LINES].map((line, idx) => (
            <p key={idx} className="whitespace-nowrap tracking-wider">
              {line}
            </p>
          ))}
        </div>
      </div>

      {/* 💥 EXPLODING LIGHTBURST SHOCKWAVE UPON UNLOCK */}
      {isUnlockedSuccess && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
          {/* Shockwave expanding ring 1 */}
          <div className="w-40 h-40 rounded-full border-4 border-amber-300 bg-gradient-to-r from-amber-400/40 via-yellow-200/60 to-emerald-400/40 blur-md animate-lightburst" />
          {/* Shockwave expanding ring 2 */}
          <div
            className="w-40 h-40 rounded-full border-2 border-emerald-400 bg-radial from-white via-amber-300/30 to-transparent blur-xl animate-lightburst"
            style={{ animationDelay: '0.15s' }}
          />
        </div>
      )}

      {/* Ambient Radial Glowing Halo */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-tr from-amber-500/15 via-orange-600/15 to-purple-600/20 rounded-full blur-3xl pointer-events-none" />

      {/* ========================================================
          TOP SECTION: REALTIME CLOCK & VECTOR CIRCUIT LOCK EMBLEM
          ======================================================== */}
      <div className="relative z-10 w-full flex flex-col items-center pt-8 sm:pt-10 px-4 space-y-4">
        
        {/* 🕒 REALTIME CLOCK (HH:MM:SS) & INDONESIAN DATE */}
        <div className="text-center space-y-1">
          <div className="flex items-baseline justify-center gap-1.5 font-mono">
            <span className="text-4xl sm:text-5xl font-black text-white tracking-tight drop-shadow-md">
              {time.hh}:{time.mm}
            </span>
            <span className="text-xl sm:text-2xl font-extrabold text-amber-400/90 w-8 text-left">
              :{time.ss}
            </span>
          </div>
          <p className="text-xs sm:text-sm font-medium text-slate-400 capitalize tracking-wide">
            {time.dateStr}
          </p>
        </div>

        {/* 🔒 HIGH-TECH VECTOR CIRCUIT LOCK ICON WITH TRAVELING LIGHT PATH */}
        <div
          onClick={handleSecretTap}
          className="relative cursor-pointer group active:scale-95 transition-transform"
          title="Brankas Schemax"
        >
          {/* Radiant pulse halo around lock */}
          <div
            className={`absolute -inset-3 rounded-full blur-xl transition-all duration-500 ${
              isUnlockedSuccess
                ? 'bg-emerald-400/60 scale-125 animate-ping'
                : 'bg-gradient-to-tr from-amber-500/25 to-orange-500/25 group-hover:scale-110 opacity-75'
            }`}
          />

          <div
            className={`relative w-20 h-20 sm:w-22 sm:h-22 rounded-3xl backdrop-blur-2xl flex items-center justify-center border-2 transition-all duration-500 shadow-2xl ${
              isUnlockedSuccess
                ? 'bg-emerald-950/80 border-emerald-400 shadow-emerald-500/40 scale-110'
                : 'bg-slate-900/90 border-amber-500/40 hover:border-amber-400 shadow-amber-500/15'
            }`}
          >
            {/* SVG Circuit Path Trace running along the border */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none rounded-3xl"
              viewBox="0 0 88 88"
              fill="none"
            >
              <rect
                x="2"
                y="2"
                width="84"
                height="84"
                rx="22"
                stroke={isUnlockedSuccess ? '#34d399' : '#f59e0b'}
                strokeWidth="2.5"
                strokeLinecap="round"
                className="animate-circuit-trace opacity-80"
              />
            </svg>

            {/* Custom SVG Lock Illustration with Shackle Animation */}
            <svg
              viewBox="0 0 48 48"
              className="w-10 h-10 sm:w-11 sm:h-11 transition-all duration-300"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Shackle (Gagang Gembok) */}
              {isUnlockedSuccess ? (
                /* Unlocked open shackle lifted up & rotated */
                <path
                  d="M17 22V14C17 10.134 20.134 7 24 7C27.866 7 31 10.134 31 14V17"
                  stroke="#34d399"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  className="transition-all duration-500 transform -translate-y-2 translate-x-1"
                />
              ) : (
                /* Closed sturdy shackle */
                <path
                  d="M17 22V15C17 11.134 20.134 8 24 8C27.866 8 31 11.134 31 15V22"
                  stroke="#fbbf24"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
              )}

              {/* Padlock Body (Badan Gembok Futuristik Berarsitektur) */}
              <rect
                x="11"
                y="22"
                width="26"
                height="19"
                rx="5"
                fill={isUnlockedSuccess ? '#064e3b' : '#1e293b'}
                stroke={isUnlockedSuccess ? '#34d399' : '#f59e0b'}
                strokeWidth="2.5"
              />

              {/* Keyhole Core / Center Glow */}
              <circle
                cx="24"
                cy="30"
                r="2.5"
                fill={isUnlockedSuccess ? '#6ee7b7' : '#fbbf24'}
              />
              <path
                d="M24 32.5V36"
                stroke={isUnlockedSuccess ? '#6ee7b7' : '#fbbf24'}
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* 🔢 EXACT 6-DIGIT PIN INDICATORS (SLOTS) */}
        <div className="space-y-2 pt-1">
          <div
            className={`flex items-center justify-center gap-3.5 transition-transform ${
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
                      ? 'border-rose-500 bg-rose-500 shadow-md shadow-rose-500/50 scale-110'
                      : isUnlockedSuccess
                      ? 'border-emerald-400 bg-emerald-400 shadow-lg shadow-emerald-400/60 scale-125'
                      : isFilled
                      ? 'border-amber-400 bg-amber-400 shadow-lg shadow-amber-500/60 scale-125'
                      : 'border-slate-700 bg-slate-800/80 shadow-inner'
                  }`}
                />
              );
            })}
          </div>

          {/* Error Message */}
          {errorMessage ? (
            <p className="text-xs font-bold text-rose-400 flex items-center justify-center gap-1 animate-fade-in">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{errorMessage}</span>
            </p>
          ) : (
            <p className="text-[11px] text-slate-400 font-serif italic text-center">
              "Masukkan 6 digit PIN untuk membuka brankas"
            </p>
          )}
        </div>
      </div>

      {/* ========================================================
          BOTTOM SECTION: ERGONOMIC THUMB-FRIENDLY FULL KEYPAD
          Positioned comfortably at bottom center for thumb reach
          Wrapped in a wandering neon laser beam border
          ======================================================== */}
      <div className="relative z-10 w-full flex flex-col items-center pb-6 sm:pb-8 px-4 safe-bottom">
        <div className="relative w-full max-w-sm rounded-[32px] p-[2px] overflow-hidden">
          
          {/* 🌌 Wandering Neon Laser Beam Border (Looping Trail Effect) */}
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 via-amber-400 to-amber-500/0 animate-neon-border opacity-70 blur-[1px]" />

          {/* Keypad Container: Large, spacious, easy thumb touch */}
          <div className="relative rounded-[30px] bg-slate-900/80 dark:bg-slate-950/85 backdrop-blur-2xl border border-slate-800/80 p-3 sm:p-4 shadow-2xl">
            <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5">
              {[
                { num: '1', sub: '' },
                { num: '2', sub: 'ABC' },
                { num: '3', sub: 'DEF' },
                { num: '4', sub: 'GHI' },
                { num: '5', sub: 'JKL' },
                { num: '6', sub: 'MNO' },
                { num: '7', sub: 'PQRS' },
                { num: '8', sub: 'TUV' },
                { num: '9', sub: 'WXYZ' },
              ].map((btn) => (
                <button
                  key={btn.num}
                  type="button"
                  onClick={() => handleKeyPress(btn.num)}
                  className="h-16 sm:h-17 rounded-2xl bg-white/5 hover:bg-white/10 active:bg-amber-500 active:text-slate-950 border border-white/10 text-slate-100 transition-all duration-100 active:scale-92 shadow-sm flex flex-col items-center justify-center gap-0.5 group"
                >
                  <span className="text-2xl sm:text-3xl font-bold font-mono group-active:text-slate-950 leading-none">
                    {btn.num}
                  </span>
                  {btn.sub && (
                    <span className="text-[9px] font-bold text-slate-400 group-active:text-slate-900 tracking-wider">
                      {btn.sub}
                    </span>
                  )}
                </button>
              ))}

              {/* Blank spacer left */}
              <div className="h-16 sm:h-17 flex items-center justify-center" />

              {/* Digit 0 */}
              <button
                type="button"
                onClick={() => handleKeyPress('0')}
                className="h-16 sm:h-17 rounded-2xl bg-white/5 hover:bg-white/10 active:bg-amber-500 active:text-slate-950 border border-white/10 text-slate-100 transition-all duration-100 active:scale-92 shadow-sm flex flex-col items-center justify-center group"
              >
                <span className="text-2xl sm:text-3xl font-bold font-mono group-active:text-slate-950 leading-none">
                  0
                </span>
                <span className="text-[9px] font-bold text-slate-400 group-active:text-slate-900 tracking-wider">
                  +
                </span>
              </button>

              {/* Delete / Backspace Button */}
              <button
                type="button"
                onClick={handleDelete}
                disabled={pinInput.length === 0}
                className="h-16 sm:h-17 rounded-2xl bg-white/5 hover:bg-rose-500/20 active:bg-rose-500 active:text-white disabled:opacity-20 border border-white/10 text-slate-400 hover:text-white transition-all duration-100 active:scale-92 shadow-sm flex flex-col items-center justify-center gap-1"
                aria-label="Hapus Digit"
              >
                <Delete className="w-5 h-5 sm:w-6 sm:h-6" />
                <span className="text-[9px] font-bold tracking-wider">HAPUS</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

