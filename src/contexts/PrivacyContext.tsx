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

  const getBlurImageClass = (extraClasses = '') => {
    if (!settings.privacyMode || !settings.blurImages) return extraClasses;
    return `filter blur-md hover:blur-none transition-all duration-300 select-none ${extraClasses}`;
  };

  const getBlurTextClass = (extraClasses = '') => {
    if (!settings.privacyMode || !settings.blurText) return extraClasses;
    return `filter blur-sm hover:blur-none transition-all duration-300 select-none ${extraClasses}`;
  };

  const getBlurTitleClass = (extraClasses = '') => {
    if (!settings.privacyMode || !settings.blurTitles) return extraClasses;
    return `filter blur-sm hover:blur-none transition-all duration-300 select-none ${extraClasses}`;
  };

  const getBlurGlossaryClass = (extraClasses = '') => {
    if (!settings.privacyMode || !settings.blurGlossary) return extraClasses;
    return `filter blur-sm hover:blur-none transition-all duration-300 select-none ${extraClasses}`;
  };

  return (
    <PrivacyContext.Provider
      value={{
        settings,
        updateSettings,
        togglePrivacyMode,
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
