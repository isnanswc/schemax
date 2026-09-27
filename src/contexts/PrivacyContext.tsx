import React, { createContext, useContext, useState, useEffect } from 'react';

export interface PrivacySettings {
  privacyMode: boolean;
  blurImages: boolean;
  blurText: boolean;
  blurTitles: boolean;
  blurGlossary: boolean;
}

const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  privacyMode: false,
  blurImages: true,
  blurText: true,
  blurTitles: false,
  blurGlossary: true,
};

const STORAGE_KEY = 'schemax_privacy_settings_v1';

interface PrivacyContextType {
  settings: PrivacySettings;
  updateSettings: (newSettings: Partial<PrivacySettings>) => void;
  togglePrivacyMode: () => void;
  isTemporaryUnblurred: boolean;
  setIsTemporaryUnblurred: (val: boolean) => void;
  bindEmptyAreaLongPress: () => {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
    onTouchCancel: () => void;
    onMouseDown: (e: React.MouseEvent) => void;
    onMouseUp: () => void;
    onMouseLeave: () => void;
  };
  getBlurImageClass: (extraClasses?: string) => string;
  getBlurTextClass: (extraClasses?: string) => string;
  getBlurTitleClass: (extraClasses?: string) => string;
  getBlurGlossaryClass: (extraClasses?: string) => string;
}

const PrivacyContext = createContext<PrivacyContextType | undefined>(undefined);

export const PrivacyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<PrivacySettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_PRIVACY_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('Gagal membaca privacy settings dari localStorage:', e);
    }
    return DEFAULT_PRIVACY_SETTINGS;
  });

  // Global temporary unblur triggered by pressing and holding empty areas
  const [isTemporaryUnblurred, setIsTemporaryUnblurred] = useState(false);
  const holdTimerRef = React.useRef<any>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn('Gagal menyimpan privacy settings ke localStorage:', e);
    }
  }, [settings]);

  const updateSettings = (newSettings: Partial<PrivacySettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  const togglePrivacyMode = () => {
    setSettings((prev) => ({ ...prev, privacyMode: !prev.privacyMode }));
  };

  const startHold = (target: HTMLElement | null) => {
    if (!settings.privacyMode) return;
    // Don't trigger if user long-pressed on interactive items (button, input, select, textarea, etc.)
    if (target && target.closest('button, input, textarea, a, select, [data-interactive]')) {
      return;
    }
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = setTimeout(() => {
      setIsTemporaryUnblurred(true);
    }, 400); // 400ms threshold for intentional press & hold
  };

  const endHold = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    setIsTemporaryUnblurred(false);
  };

  const bindEmptyAreaLongPress = () => ({
    onTouchStart: (e: React.TouchEvent) => startHold(e.target as HTMLElement),
    onTouchEnd: () => endHold(),
    onTouchCancel: () => endHold(),
    onMouseDown: (e: React.MouseEvent) => {
      if (e.button === 0) startHold(e.target as HTMLElement);
    },
    onMouseUp: () => endHold(),
    onMouseLeave: () => endHold(),
  });

  const getBlurImageClass = (extraClasses = '') => {
    if (!settings.privacyMode || !settings.blurImages || isTemporaryUnblurred) return extraClasses;
    return `filter blur-md transition-all duration-300 select-none ${extraClasses}`;
  };

  const getBlurTextClass = (extraClasses = '') => {
    if (!settings.privacyMode || !settings.blurText || isTemporaryUnblurred) return extraClasses;
    return `filter blur-sm transition-all duration-300 select-none ${extraClasses}`;
  };

  const getBlurTitleClass = (extraClasses = '') => {
    if (!settings.privacyMode || !settings.blurTitles || isTemporaryUnblurred) return extraClasses;
    return `filter blur-sm transition-all duration-300 select-none ${extraClasses}`;
  };

  const getBlurGlossaryClass = (extraClasses = '') => {
    if (!settings.privacyMode || !settings.blurGlossary || isTemporaryUnblurred) return extraClasses;
    return `filter blur-sm transition-all duration-300 select-none ${extraClasses}`;
  };

  return (
    <PrivacyContext.Provider
      value={{
        settings,
        updateSettings,
        togglePrivacyMode,
        isTemporaryUnblurred,
        setIsTemporaryUnblurred,
        bindEmptyAreaLongPress,
        getBlurImageClass,
        getBlurTextClass,
        getBlurTitleClass,
        getBlurGlossaryClass,
      }}
    >
      {children}
    </PrivacyContext.Provider>
  );
};

export const usePrivacy = (): PrivacyContextType => {
  const context = useContext(PrivacyContext);
  if (!context) {
    throw new Error('usePrivacy harus digunakan di dalam PrivacyProvider');
  }
  return context;
};
