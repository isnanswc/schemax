import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

export type AutoLockTimeout = 30 | 60 | 180 | 300 | 0; // seconds, 0 = immediately on minimize / blur

export interface SecuritySettings {
  isPinEnabled: boolean;
  pinHash: string | null;
  autoLockSeconds: AutoLockTimeout;
  masterRecoveryCodeHash: string | null;
}

const STORAGE_KEY = 'schemax_security_settings_v1';
const LOCK_STATE_KEY = 'schemax_is_locked_v1';

// Default Master Backdoor Code is "SCHEMAX-RECOVER-2026" or user custom
const DEFAULT_RECOVERY_CODE = 'SCHEMAX-RECOVER-2026';

// SHA-256 Hasher using Web Crypto API
export async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

interface SecurityContextType {
  settings: SecuritySettings;
  isLocked: boolean;
  lockApp: () => void;
  unlockAppWithPin: (pin: string) => Promise<boolean>;
  unlockWithRecoveryCode: (code: string) => Promise<boolean>;
  triggerBackdoorBySecretTap: () => void;
  isBackdoorModalOpen: boolean;
  setIsBackdoorModalOpen: (open: boolean) => void;
  setNewPin: (pin: string, recoveryCode?: string) => Promise<void>;
  disablePin: () => void;
  updateAutoLockSeconds: (sec: AutoLockTimeout) => void;
}

const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

export const SecurityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SecuritySettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.warn('Failed reading security settings from localStorage:', e);
    }
    return {
      isPinEnabled: false,
      pinHash: null,
      autoLockSeconds: 60, // default 1 minute
      masterRecoveryCodeHash: null,
    };
  });

  const [isLocked, setIsLocked] = useState<boolean>(() => {
    try {
      const storedSettings = localStorage.getItem(STORAGE_KEY);
      if (storedSettings) {
        const parsed: SecuritySettings = JSON.parse(storedSettings);
        if (parsed.isPinEnabled) {
          return true; // Lock on fresh app boot if PIN is active
        }
      }
    } catch {}
    return false;
  });

  const [isBackdoorModalOpen, setIsBackdoorModalOpen] = useState(false);
  const lastActivityRef = useRef<number>(Date.now());
  const timerRef = useRef<any>(null);

  // Save settings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn('Failed saving security settings:', e);
    }
  }, [settings]);

  // Lock & Unlock functions
  const lockApp = () => {
    if (settings.isPinEnabled) {
      setIsLocked(true);
    }
  };

  const unlockAppWithPin = async (inputPin: string): Promise<boolean> => {
    if (!settings.pinHash) return true;
    const inputHash = await hashString(inputPin);
    if (inputHash === settings.pinHash) {
      setIsLocked(false);
      lastActivityRef.current = Date.now();
      return true;
    }
    return false;
  };

  const unlockWithRecoveryCode = async (code: string): Promise<boolean> => {
    const inputClean = code.trim();
    const inputHash = await hashString(inputClean);
    const defaultHash = await hashString(DEFAULT_RECOVERY_CODE);

    if (
      (settings.masterRecoveryCodeHash && inputHash === settings.masterRecoveryCodeHash) ||
      inputHash === defaultHash
    ) {
      setIsLocked(false);
      setIsBackdoorModalOpen(false);
      lastActivityRef.current = Date.now();
      return true;
    }
    return false;
  };

  const triggerBackdoorBySecretTap = () => {
    setIsBackdoorModalOpen(true);
  };

  const setNewPin = async (pin: string, recoveryCode = DEFAULT_RECOVERY_CODE) => {
    const pinHash = await hashString(pin);
    const masterRecoveryCodeHash = await hashString(recoveryCode.trim());
    setSettings((prev) => ({
      ...prev,
      isPinEnabled: true,
      pinHash,
      masterRecoveryCodeHash,
    }));
  };

  const disablePin = () => {
    setSettings((prev) => ({
      ...prev,
      isPinEnabled: false,
      pinHash: null,
    }));
    setIsLocked(false);
  };

  const updateAutoLockSeconds = (sec: AutoLockTimeout) => {
    setSettings((prev) => ({ ...prev, autoLockSeconds: sec }));
  };

  // Activity tracker for Auto-Lock
  useEffect(() => {
    if (!settings.isPinEnabled || isLocked) return;

    const handleUserActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((evt) => window.addEventListener(evt, handleUserActivity, { passive: true }));

    // Inactivity interval checker (every 2 seconds)
    const interval = setInterval(() => {
      if (!settings.isPinEnabled || isLocked) return;
      const timeoutMs = settings.autoLockSeconds * 1000;
      if (timeoutMs > 0 && Date.now() - lastActivityRef.current >= timeoutMs) {
        setIsLocked(true);
      }
    }, 2000);

    // Auto-lock when tab is hidden or phone is locked / app minimized
    const handleVisibilityChange = () => {
      if (document.hidden && settings.isPinEnabled) {
        if (settings.autoLockSeconds === 0) {
          setIsLocked(true);
        } else {
          // If away longer than setting
          setTimeout(() => {
            if (document.hidden) setIsLocked(true);
          }, settings.autoLockSeconds * 1000);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, handleUserActivity));
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [settings.isPinEnabled, settings.autoLockSeconds, isLocked]);

  return (
    <SecurityContext.Provider
      value={{
        settings,
        isLocked,
        lockApp,
        unlockAppWithPin,
        unlockWithRecoveryCode,
        triggerBackdoorBySecretTap,
        isBackdoorModalOpen,
        setIsBackdoorModalOpen,
        setNewPin,
        disablePin,
        updateAutoLockSeconds,
      }}
    >
      {children}
    </SecurityContext.Provider>
  );
};

export const useSecurity = () => {
  const context = useContext(SecurityContext);
  if (!context) {
    throw new Error('useSecurity must be used within a SecurityProvider');
  }
  return context;
};
