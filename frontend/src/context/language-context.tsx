"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations, Language } from '../lib/translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (path: string, variables?: Record<string, any>) => any;
  isHydrated: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('en');
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const savedLang = localStorage.getItem('sh_language') as Language;
    if (savedLang && translations[savedLang]) {
      setLanguageState(savedLang);
    }
    setIsHydrated(true);
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('sh_language', lang);
  };

  const t = (path: string, variables?: Record<string, any>) => {
    const keys = path.split('.');
    let current: any = translations[language];

    for (const key of keys) {
      if (current && current[key]) {
        current = current[key];
      } else {
        return path; // Fallback to path if translation not found
      }
    }

    if (typeof current === 'string' && variables) {
      return Object.entries(variables).reduce(
        (acc, [key, val]) => acc.replace(`{${key}}`, String(val)),
        current
      );
    }

    return current;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isHydrated }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
