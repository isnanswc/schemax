import React, { useState } from 'react';
import { useSecurity, AutoLockTimeout } from '../../contexts/SecurityContext';
import { Lock, Unlock, KeyRound, Shield, Clock, AlertCircle, Check, X } from 'lucide-react';

interface PinSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PinSetupModal: React.FC<PinSetupModalProps> = ({ isOpen, onClose }) => {
  const { settings, setNewPin, disablePin, updateAutoLockSeconds, lockApp } = useSecurity();

  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [step, setStep] = useState<'status' | 'create_pin' | 'confirm_pin'>('status');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStartSetup = () => {
    setPin('');
    setConfirmPin('');
    setRecoveryCode('');
    setError(null);
    setSuccessMsg(null);
    setStep('create_pin');
  };

  const handleProceedToConfirm = () => {
    if (pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) {
      setError('PIN harus berupa 4 hingga 6 digit angka.');
      return;
    }
    setError(null);
    setStep('confirm_pin');
  };

  const handleSaveNewPin = async () => {
    if (pin !== confirmPin) {
      setError('Konfirmasi PIN tidak cocok. Silakan coba lagi.');
      return;
    }
    await setNewPin(pin, recoveryCode.trim() || undefined);
    setSuccessMsg('Kunci PIN berhasil diaktifkan!');
    setTimeout(() => {
      setStep('status');
      setSuccessMsg(null);
    }, 1200);
  };

  const handleDisablePin = () => {
    if (window.confirm('Apakah Anda yakin ingin menonaktifkan Kunci PIN?')) {
      disablePin();
      setStep('status');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div
        className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4 animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-amber-500/15 text-amber-500 font-bold">
              <Lock className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Keamanan Kunci PIN &amp; Auto-Lock
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* STEP: STATUS & SETTINGS */}
        {step === 'status' && (
          <div className="space-y-4 text-xs">
            {/* PIN Status Toggle */}
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-2xl flex items-center justify-center ${
                    settings.isPinEnabled
                      ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
                  }`}
                >
                  {settings.isPinEnabled ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                </div>
                <div>
                  <span className="font-bold text-slate-900 dark:text-white block">
                    Kunci PIN Aplikasi
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {settings.isPinEnabled ? 'Aktif (Dilindungi)' : 'Nonaktif'}
                  </span>
                </div>
              </div>

              {settings.isPinEnabled ? (
                <button
                  type="button"
                  onClick={handleDisablePin}
                  className="px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold text-[11px] transition"
                >
                  Matikan
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStartSetup}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] transition shadow-xs"
                >
                  Pasang PIN
                </button>
              )}
            </div>

            {/* Auto Lock Duration Config */}
            {settings.isPinEnabled && (
              <div className="space-y-2">
                <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  <span>Durasi Kunci Otomatis (Auto-Lock):</span>
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { sec: 30, label: '30 Detik' },
                    { sec: 60, label: '1 Menit' },
                    { sec: 180, label: '3 Menit' },
                    { sec: 300, label: '5 Menit' },
                  ].map((opt) => (
                    <button
                      key={opt.sec}
                      type="button"
                      onClick={() => updateAutoLockSeconds(opt.sec as AutoLockTimeout)}
                      className={`py-2 px-2 rounded-xl text-center font-bold text-xs transition ${
                        settings.autoLockSeconds === opt.sec
                          ? 'bg-amber-500 text-slate-950 shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleStartSetup}
                    className="w-full py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                  >
                    Ganti PIN / Kunci Pemulihan
                  </button>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      lockApp();
                    }}
                    className="w-full py-2.5 rounded-2xl bg-slate-900 dark:bg-slate-800 text-white font-black text-xs transition active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Kunci Sekarang</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP: CREATE PIN */}
        {step === 'create_pin' && (
          <div className="space-y-3 text-xs">
            <p className="text-slate-600 dark:text-slate-400">
              Masukkan <strong>4 hingga 6 digit angka</strong> sebagai PIN pengaman brankas Schemax:
            </p>

            <input
              type="password"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="Ketik 4-6 digit PIN..."
              className="w-full py-2.5 px-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-center text-lg tracking-widest font-mono text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 shadow-inner"
            />

            <div className="space-y-1 pt-1">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                Kunci Pemulihan Darurat (Backdoor Pribadi - Opsional):
              </label>
              <input
                type="text"
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value)}
                placeholder="Misal: RahasiaKu2026 (Default: SCHEMAX-RECOVER-2026)"
                className="w-full py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs font-mono text-amber-600 dark:text-amber-400 focus:outline-none focus:border-amber-500"
              />
              <span className="text-[10px] text-slate-400 block">
                Jika lupa PIN, ketuk ikon gembok 5x di layar kunci dan masukkan kunci ini.
              </span>
            </div>

            {error && <p className="text-xs text-rose-500 font-bold">{error}</p>}

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep('status')}
                className="py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleProceedToConfirm}
                disabled={pin.length < 4}
                className="py-2 px-4 rounded-xl bg-amber-500 text-slate-950 font-bold disabled:opacity-50"
              >
                Lanjut ➔
              </button>
            </div>
          </div>
        )}

        {/* STEP: CONFIRM PIN */}
        {step === 'confirm_pin' && (
          <div className="space-y-3 text-xs">
            <p className="text-slate-600 dark:text-slate-400">
              Ketik ulang PIN untuk memastikan tidak ada kesalahan ketik:
            </p>

            <input
              type="password"
              maxLength={6}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
              placeholder="Konfirmasi PIN..."
              className="w-full py-2.5 px-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-center text-lg tracking-widest font-mono text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 shadow-inner"
            />

            {error && <p className="text-xs text-rose-500 font-bold">{error}</p>}
            {successMsg && (
              <p className="text-xs text-emerald-500 font-bold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                <span>{successMsg}</span>
              </p>
            )}

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep('create_pin')}
                className="py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold"
              >
                Kembali
              </button>
              <button
                type="button"
                onClick={handleSaveNewPin}
                disabled={confirmPin.length < 4}
                className="py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black disabled:opacity-50 transition active:scale-95"
              >
                Simpan &amp; Aktifkan
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
