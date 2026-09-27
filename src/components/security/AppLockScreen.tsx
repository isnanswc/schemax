import React, { useState, useEffect } from 'react';
import { useSecurity } from '../../contexts/SecurityContext';
import { Lock, Unlock, KeyRound, AlertCircle, ShieldAlert, Sparkles, X, Check } from 'lucide-react';

export const AppLockScreen: React.FC = () => {
  const {
    isLocked,
    unlockAppWithPin,
    unlockWithRecoveryCode,
    triggerBackdoorBySecretTap,
    isBackdoorModalOpen,
    setIsBackdoorModalOpen,
  } = useSecurity();

  const [pinInput, setPinInput] = useState<string>('');
  const [errorShake, setErrorShake] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [secretTapCount, setSecretTapCount] = useState(0);
  const [recoveryCodeInput, setRecoveryCodeInput] = useState('');
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  // Reset states when locked state changes
  useEffect(() => {
    if (isLocked) {
      setPinInput('');
      setErrorShake(false);
      setErrorMessage(null);
      setSecretTapCount(0);
    }
  }, [isLocked]);

  if (!isLocked) return null;

  // Handle secret 5-tap sequence on lock icon for backdoor trigger
  const handleSecretTap = () => {
    const nextCount = secretTapCount + 1;
    setSecretTapCount(nextCount);
    if (nextCount >= 5) {
      setSecretTapCount(0);
      triggerBackdoorBySecretTap();
    }
  };

  const handleKeyPress = (num: string) => {
    if (pinInput.length >= 6) return;
    const nextPin = pinInput + num;
    setPinInput(nextPin);
    setErrorMessage(null);

    // Auto-validate when 4 or 6 digits entered
    if (nextPin.length === 4 || nextPin.length === 6) {
      setTimeout(() => {
        validatePin(nextPin);
      }, 50);
    }
  };

  const handleDelete = () => {
    setPinInput((prev) => prev.slice(0, -1));
    setErrorMessage(null);
  };

  const validatePin = async (codeToTest: string) => {
    const success = await unlockAppWithPin(codeToTest);
    if (success) {
      setPinInput('');
      setErrorMessage(null);
    } else {
      if (codeToTest.length >= 4) {
        setErrorShake(true);
        setErrorMessage('PIN salah. Silakan coba lagi.');
        setTimeout(() => {
          setErrorShake(false);
          setPinInput('');
        }, 600);
      }
    }
  };

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError(null);
    const success = await unlockWithRecoveryCode(recoveryCodeInput);
    if (!success) {
      setRecoveryError('Kode pemulihan darurat tidak valid.');
    } else {
      setRecoveryCodeInput('');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 backdrop-blur-2xl text-slate-100 p-4 select-none animate-in fade-in duration-300">
      {/* Ambient Halo Behind */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-gradient-to-tr from-amber-500/20 via-purple-600/15 to-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

      {/* Main Lock Vault Card */}
      <div className="relative z-10 w-full max-w-xs sm:max-w-sm flex flex-col items-center text-center space-y-6">
        {/* Secret Tap Trigger (Lock Icon) */}
        <div
          onClick={handleSecretTap}
          className="group relative cursor-pointer active:scale-95 transition-transform"
          title="Brankas Naskah Terkunci"
        >
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-amber-500/20 to-slate-800/80 border border-amber-500/30 flex items-center justify-center shadow-lg shadow-amber-500/10 transition group-hover:border-amber-400">
            <Lock className="w-7 h-7 text-amber-400 group-hover:scale-110 transition-transform" />
          </div>
          {secretTapCount > 1 && secretTapCount < 5 && (
            <span className="absolute -bottom-2 -right-2 px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 font-bold text-[9px] animate-pulse">
              {secretTapCount}/5
            </span>
          )}
        </div>

        {/* Title & Micro-hint */}
        <div className="space-y-1">
          <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
            Brankas Schemax Terkunci
          </h2>
          <p className="text-xs text-slate-400 font-serif italic">
            "Kata-katamu tersimpan aman di sini."
          </p>
        </div>

        {/* PIN Indicators (4 to 6 slots) */}
        <div
          className={`flex items-center justify-center gap-3.5 py-2 transition-transform ${
            errorShake ? 'animate-bounce text-rose-500' : ''
          }`}
        >
          {[0, 1, 2, 3].map((idx) => {
            const isFilled = pinInput.length > idx;
            return (
              <div
                key={idx}
                className={`w-3.5 h-3.5 rounded-full transition-all duration-200 border ${
                  errorShake
                    ? 'border-rose-500 bg-rose-500 shadow-md shadow-rose-500/40'
                    : isFilled
                    ? 'border-amber-400 bg-amber-400 shadow-md shadow-amber-500/50 scale-110'
                    : 'border-slate-600 bg-slate-800/80'
                }`}
              />
            );
          })}
        </div>

        {/* Error message */}
        {errorMessage && (
          <p className="text-xs font-semibold text-rose-400 flex items-center gap-1 animate-fade-in">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{errorMessage}</span>
          </p>
        )}

        {/* Cinematic Frosted Glass Numpad */}
        <div className="grid grid-cols-3 gap-3 sm:gap-3.5 w-full max-w-[260px] pt-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleKeyPress(digit)}
              className="h-14 rounded-2xl bg-white/10 hover:bg-white/20 active:bg-amber-500 active:text-slate-950 border border-white/10 backdrop-blur-md text-lg font-bold text-white transition active:scale-90 shadow-sm flex items-center justify-center"
            >
              {digit}
            </button>
          ))}

          {/* Blank or special spacer */}
          <div className="h-14 flex items-center justify-center" />

          {/* Digit 0 */}
          <button
            type="button"
            onClick={() => handleKeyPress('0')}
            className="h-14 rounded-2xl bg-white/10 hover:bg-white/20 active:bg-amber-500 active:text-slate-950 border border-white/10 backdrop-blur-md text-lg font-bold text-white transition active:scale-90 shadow-sm flex items-center justify-center"
          >
            0
          </button>

          {/* Delete Button */}
          <button
            type="button"
            onClick={handleDelete}
            disabled={pinInput.length === 0}
            className="h-14 rounded-2xl bg-white/5 hover:bg-white/15 disabled:opacity-30 border border-white/5 text-xs font-bold text-slate-400 hover:text-white transition active:scale-90 flex items-center justify-center"
          >
            Hapus
          </button>
        </div>

        {/* Backdoor Help Link */}
        <div className="pt-2 text-[11px] text-slate-500 flex items-center justify-center gap-1">
          <KeyRound className="w-3 h-3 text-slate-500" />
          <span>Lupa PIN? Ketuk ikon gembok 5x untuk opsi darurat.</span>
        </div>
      </div>

      {/* 🚪 SECRET BACKDOOR EMERGENCY MODAL */}
      {isBackdoorModalOpen && (
        <div
          className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setIsBackdoorModalOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-slate-900 border border-amber-500/40 rounded-3xl p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-xl bg-amber-500/20 text-amber-400">
                  <ShieldAlert className="w-4 h-4" />
                </span>
                <h3 className="text-sm font-bold text-white">Pemulihan Darurat (Backdoor)</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsBackdoorModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Masukkan Master Passphrase / Kunci Pemulihan Darurat Anda. Jika belum pernah diatur, gunakan kode default:{' '}
              <code className="text-amber-400 font-mono bg-slate-800 px-1 py-0.5 rounded">
                SCHEMAX-RECOVER-2026
              </code>
            </p>

            <form onSubmit={handleRecoverySubmit} className="space-y-3">
              <input
                type="text"
                value={recoveryCodeInput}
                onChange={(e) => setRecoveryCodeInput(e.target.value)}
                placeholder="Ketik Master Recovery Key..."
                className="w-full py-2.5 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono text-amber-300 focus:outline-none focus:border-amber-500 shadow-inner"
              />

              {recoveryError && (
                <p className="text-[11px] text-rose-400 font-medium">{recoveryError}</p>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsBackdoorModalOpen(false)}
                  className="py-2 px-3 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!recoveryCodeInput.trim()}
                  className="py-2 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition active:scale-95 disabled:opacity-50"
                >
                  Buka Kunci
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
