import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations, TranslationKey } from '../lib/translations';

type Language = 'default' | 'es-LA' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  getLanguageLabel: (lang: Language) => string;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('app-language');
    return (saved as Language) || 'default';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('app-language', lang);
  };

  const getLanguageLabel = (lang: Language) => {
    switch (lang) {
      case 'es-LA': return 'Español (Latinoamérica)';
      case 'en': return 'Inglés';
      default: return 'Predeterminado';
    }
  };

  const t = (key: TranslationKey, params?: Record<string, string | number>): string => {
    const currentLang = language === 'default' ? 'es-LA' : language;
    let text = translations[currentLang][key] || translations['es-LA'][key] || key;
    
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v));
      });
    }
    
    return text;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, getLanguageLabel, t }}>
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
