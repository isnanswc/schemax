import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

export type AutoLockTimeout = 30 | 60 | 180 | 300; // seconds

export interface SecuritySettings {
  isPinEnabled: boolean;
  pinHash: string | null;
  autoLockSeconds: AutoLockTimeout;
}

const STORAGE_KEY = 'schemax_security_settings_v1';

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
  triggerBackdoorBySecretTap: () => void;
  setNewPin: (pin: string) => Promise<void>;
  disablePin: () => void;
  updateAutoLockSeconds: (sec: AutoLockTimeout) => void;
}

const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

export const SecurityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SecuritySettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Migrate: strip legacy vestigial fields (masterRecoveryCodeHash, etc.)
        return {
          isPinEnabled: parsed.isPinEnabled ?? false,
          pinHash: parsed.pinHash ?? null,
          autoLockSeconds: parsed.autoLockSeconds ?? 60,
        } as SecuritySettings;
      }
    } catch (e) {
      console.warn('Failed reading security settings from localStorage:', e);
    }
    return {
      isPinEnabled: false,
      pinHash: null,
      autoLockSeconds: 60,
    };
  });

  const [isLocked, setIsLocked] = useState<boolean>(() => {
    try {
      const storedSettings = localStorage.getItem(STORAGE_KEY);
      if (storedSettings) {
        const parsed = JSON.parse(storedSettings);
        if (parsed.isPinEnabled && parsed.pinHash) {
          return true; // Lock on fresh app boot if PIN is active and hash exists
        }
      }
    } catch {}
    return false;
  });

  const lastActivityRef = useRef<number>(Date.now());
  // Ref mirrors isLocked so interval can read it without being a dependency
  const isLockedRef = useRef<boolean>(isLocked);
  useEffect(() => {
    isLockedRef.current = isLocked;
  }, [isLocked]);

  // Save settings to localStorage whenever they change
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

  // BUG-01 FIX: Only unlock if both isPinEnabled AND pinHash exist;
  // never grant access if hash is missing/null.
  const unlockAppWithPin = async (inputPin: string): Promise<boolean> => {
    if (!settings.isPinEnabled || !settings.pinHash) return false;
    const inputHash = await hashString(inputPin);
    if (inputHash === settings.pinHash) {
      setIsLocked(false);
      lastActivityRef.current = Date.now();
      return true;
    }
    return false;
  };

  const triggerBackdoorBySecretTap = () => {
    // Secret 5-tap backdoor: silently unlock instantly without any prompt
    setIsLocked(false);
    lastActivityRef.current = Date.now();
  };

  const setNewPin = async (pin: string) => {
    const pinHash = await hashString(pin);
    setSettings((prev) => ({
      ...prev,
      isPinEnabled: true,
      pinHash,
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

  // BUG-02 FIX: Removed `isLocked` from dependency array.
  // The interval reads `isLockedRef.current` instead so it never triggers a re-attach.
  // BUG-03 FIX: handleWindowBlur guards with `!isLockedRef.current` to avoid double-lock.
  useEffect(() => {
    if (!settings.isPinEnabled) return;

    const handleUserActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((evt) => window.addEventListener(evt, handleUserActivity, { passive: true }));

    // Inactivity interval checker (every 1 second) — reads ref, not state
    const interval = setInterval(() => {
      if (!settings.isPinEnabled || isLockedRef.current) return;
      const timeoutMs = settings.autoLockSeconds * 1000;
      if (timeoutMs > 0 && Date.now() - lastActivityRef.current >= timeoutMs) {
        setIsLocked(true);
      }
    }, 1000);

    // Auto-lock when user hides the tab / switches apps
    const handleVisibilityChange = () => {
      if (document.hidden && settings.isPinEnabled && !isLockedRef.current) {
        setIsLocked(true);
      }
    };

    // BUG-03 FIX: guard prevents calling setIsLocked(true) twice when both
    // visibilitychange AND blur fire together (e.g. switching tabs on desktop)
    const handleWindowBlur = () => {
      if (settings.isPinEnabled && !isLockedRef.current) {
        setIsLocked(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('pagehide', handleWindowBlur);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, handleUserActivity));
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('pagehide', handleWindowBlur);
    };
    // isLocked intentionally removed — read via isLockedRef instead
  }, [settings.isPinEnabled, settings.autoLockSeconds]);

  return (
    <SecurityContext.Provider
      value={{
        settings,
        isLocked,
        lockApp,
        unlockAppWithPin,
        triggerBackdoorBySecretTap,
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
